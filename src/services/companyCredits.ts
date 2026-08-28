// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useCompanyCredits() {
  return useQuery({
    queryKey: ["company-credits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_credits").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreditTransactions(limit = 300) {
  return useQuery({
    queryKey: ["company-credit-transactions", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_credit_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Hook para buscar solicitações pendentes de compra de créditos feitas pelos lojistas */
export function useCreditPurchaseRequestsAdmin() {
  return useQuery({
    queryKey: ["admin-credit-purchase-requests"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("credit_purchase_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) return [];
        return data ?? [];
      } catch (err) {
        return [];
      }
    },
  });
}

export function useAddCompanyCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      company_id: string;
      amount: number;
      description?: string;
      payment_method?: string;
      type?: string;
    }) => {
      let success = false;
      try {
        const { data, error } = await supabase.rpc("add_company_credits", {
          _company_id: input.company_id,
          _amount: input.amount,
          _description: input.description ?? null,
          _payment_method: input.payment_method ?? null,
          _type: input.type ?? "purchase",
        });
        if (!error) success = true;
      } catch (e) {}

      if (!success) {
        // Fallback direto
        const { data: existing } = await supabase
          .from("company_credits")
          .select("balance, total_purchased, total_consumed")
          .eq("company_id", input.company_id)
          .maybeSingle();

        const curBal = Number(existing?.balance || 0);
        const newBal = input.type === "debit" ? curBal - input.amount : curBal + input.amount;
        const newPurchased = input.type === "purchase" ? (Number(existing?.total_purchased || 0) + input.amount) : (Number(existing?.total_purchased || 0));

        await supabase.from("company_credits").upsert({
          company_id: input.company_id,
          balance: newBal,
          total_purchased: newPurchased,
          updated_at: new Date().toISOString(),
        });

        // Inserir registro na tabela de transações
        try {
          await supabase.from("company_credit_transactions").insert({
            company_id: input.company_id,
            type: input.type || "purchase",
            amount: input.type === "debit" ? -Math.abs(input.amount) : input.amount,
            balance_after: newBal,
            description: input.description || `Recarga de Créditos (${input.payment_method || "Pix"})`,
            payment_method: input.payment_method || "Pix",
          });
        } catch (e) {}

        // Tenta inserir também em credit_transactions se for a tabela usada pelo lojista
        try {
          await supabase.from("credit_transactions").insert({
            company_id: input.company_id,
            type: input.type === "debit" ? "debit" : "topup",
            amount: input.type === "debit" ? -Math.abs(input.amount) : input.amount,
            balance_after: newBal,
            description: input.description || `Recarga de Créditos (${input.payment_method || "Pix"})`,
          });
        } catch (e) {}
      }

      // Lançar no fluxo de caixa se for compra de créditos
      if (input.type !== "debit" && input.amount > 0) {
        try {
          await supabase.from("platform_cash_flow").insert({
            type: "income",
            category: "Venda de Créditos Loja",
            description: `Recarga de Créditos Loja - ${input.description || "Recarga de Saldo"}`,
            amount: input.amount,
            origin: input.payment_method || "Pix",
            date: new Date().toISOString().split("T")[0],
          });
        } catch (cfErr) {}
      }

      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-credits"] });
      qc.invalidateQueries({ queryKey: ["company-credit-transactions"] });
      qc.invalidateQueries({ queryKey: ["admin-credit-purchase-requests"] });
      qc.invalidateQueries({ queryKey: ["platform-cash-flow"] });
    },
  });
}

/** Aprovar solicitação de compra de créditos de loja */
export function useApproveCreditPurchaseRequest() {
  const qc = useQueryClient();
  const addCredits = useAddCompanyCredits();

  return useMutation({
    mutationFn: async (req: {
      id: string;
      company_id: string;
      amount: number;
      notes?: string;
      payment_method?: string;
      company_name?: string;
    }) => {
      // 1. Credita o valor
      await addCredits.mutateAsync({
        company_id: req.company_id,
        amount: Number(req.amount),
        description: `Solicitação aprovada: ${req.notes || "Recarga de saldo"} (${req.company_name || "Loja"})`,
        payment_method: req.payment_method || "Pix",
        type: "purchase",
      });

      // 2. Atualiza o status do pedido para approved
      const { error } = await supabase
        .from("credit_purchase_requests")
        .update({
          status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-credit-purchase-requests"] });
      qc.invalidateQueries({ queryKey: ["company-credits"] });
    },
  });
}

/** Recusar solicitação de compra de créditos de loja */
export function useRejectCreditPurchaseRequest() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (reqId: string) => {
      const { error } = await supabase
        .from("credit_purchase_requests")
        .update({
          status: "rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reqId);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-credit-purchase-requests"] });
    },
  });
}
