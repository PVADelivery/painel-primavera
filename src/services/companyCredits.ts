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

export function useCreditTransactions(limit = 500) {
  return useQuery({
    queryKey: ["company-credit-transactions", limit],
    queryFn: async () => {
      try {
        const [res1, res2] = await Promise.all([
          supabase
            .from("company_credit_transactions")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(limit),
          supabase
            .from("credit_transactions")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(limit),
        ]);

        const items1 = res1.data ?? [];
        const items2 = (res2.data ?? []).map((t: any) => ({
          id: t.id,
          company_id: t.company_id,
          type: t.type === "topup" ? "purchase" : t.type,
          amount: Number(t.amount ?? 0),
          balance_after: Number(t.balance_after ?? 0),
          description: t.description || null,
          reference_id: t.delivery_id || null,
          payment_method: t.description?.includes("Pix") ? "Pix" : "Sistema",
          created_at: t.created_at,
        }));

        const map = new Map<string, any>();
        for (const item of items1) {
          map.set(item.id, item);
        }
        for (const item of items2) {
          const alreadyExists = Array.from(map.values()).some(
            (existing) =>
              existing.id === item.id ||
              (existing.reference_id && item.reference_id && existing.reference_id === item.reference_id)
          );
          if (!alreadyExists) {
            map.set(item.id, item);
          }
        }

        return Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } catch (err) {
        console.error("[useCreditTransactions admin error]:", err);
        return [];
      }
    },
  });
}

/**
 * Realiza o estorno garantido da taxa de uma entrega cancelada para o lojista
 */
export async function refundCancelledDelivery(deliveryId: string): Promise<boolean> {
  if (!deliveryId) return false;

  // 1. Tentar RPC no banco
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("cancel_delivery_and_refund", {
      p_delivery_id: deliveryId,
    });
    if (!rpcErr && (rpcRes as any)?.success) {
      return true;
    }
  } catch (_) {}

  // 2. Fallback direto
  try {
    const { data: delivery, error: delErr } = await supabase
      .from("deliveries")
      .select("id, company_id, delivery_fee, value, short_id, status")
      .eq("id", deliveryId)
      .maybeSingle();

    if (delErr || !delivery || !delivery.company_id) return false;

    const fee = Number(delivery.delivery_fee || delivery.value || 0);
    if (fee <= 0) return true;

    // Verificar se já estornado
    const { data: existingRefund } = await supabase
      .from("company_credit_transactions")
      .select("id")
      .eq("reference_id", deliveryId)
      .maybeSingle();

    if (existingRefund) return true;

    // Tentar RPC add_company_credits
    try {
      const { data: addRes, error: addErr } = await supabase.rpc("add_company_credits", {
        _company_id: delivery.company_id,
        _amount: fee,
        _description: `Estorno de entrega cancelada ${delivery.short_id || ""}`.trim(),
        _payment_method: "Sistema",
        _type: "refund",
      });
      if (!addErr && (addRes as any)?.success) return true;
    } catch (_) {}

    // Fallback manual no saldo
    const { data: existingCredit } = await supabase
      .from("company_credits")
      .select("balance")
      .eq("company_id", delivery.company_id)
      .maybeSingle();

    const curBal = Number(existingCredit?.balance || 0);
    const newBal = curBal + fee;

    await supabase.from("company_credits").upsert({
      company_id: delivery.company_id,
      balance: newBal,
      updated_at: new Date().toISOString(),
    });

    const desc = `Estorno de entrega cancelada ${delivery.short_id || ""}`.trim();

    try {
      await supabase.from("company_credit_transactions").insert({
        company_id: delivery.company_id,
        type: "refund",
        amount: fee,
        balance_after: newBal,
        description: desc,
        reference_id: delivery.id,
        payment_method: "Sistema",
      });
    } catch (_) {}

    try {
      await supabase.from("credit_transactions").insert({
        company_id: delivery.company_id,
        type: "refund",
        amount: fee,
        balance_after: newBal,
        description: desc,
        delivery_id: delivery.id,
      });
    } catch (_) {}

    return true;
  } catch (err) {
    console.error("[refundCancelledDelivery admin error]:", err);
    return false;
  }
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
      company_name?: string;
      amount: number;
      description?: string;
      payment_method?: string | null;
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

      // Lançar no fluxo de caixa se for compra de créditos (Lançamento Único Centralizado)
      if (input.type !== "debit" && input.amount > 0) {
        try {
          const compName = input.company_name || input.description || "Lojista";
          const desc = input.description && input.description.startsWith("Solicitação")
            ? input.description
            : `Venda de Créditos: ${compName}`;
          await supabase.from("platform_cash_flow").insert({
            type: "income",
            category: "Venda - Créditos Lojista",
            description: desc,
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
