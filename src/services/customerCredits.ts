// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface CustomerCredit {
  id: string;
  customer_id: string;
  customer_phone?: string;
  customer_name?: string;
  balance: number;
  total_recharged: number;
  total_bonus: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreditTransaction {
  id: string;
  customer_id: string;
  customer_phone?: string;
  customer_name?: string;
  amount: number;
  paid_amount?: number;
  bonus_amount?: number;
  type: "recharge" | "bonus" | "payment_order" | "payment_ride" | "payment_errand" | "refund" | "admin_adjustment";
  reference_id?: string;
  description: string;
  created_by: string;
  created_at: string;
}

export function useCustomerCreditsList() {
  return useQuery<CustomerCredit[]>({
    queryKey: ["admin-customer-credits"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("customer_credits")
          .select("*")
          .order("balance", { ascending: false });
        if (error) {
          console.warn("[CustomerCredits] Erro ao listar carteiras:", error.message);
          return [];
        }
        return (data || []) as CustomerCredit[];
      } catch (err) {
        console.warn("[CustomerCredits] Exceção:", err);
        return [];
      }
    },
    staleTime: 1000 * 20,
  });
}

export function useCustomerCreditTransactionsList(limit = 400) {
  return useQuery<CustomerCreditTransaction[]>({
    queryKey: ["admin-customer-credit-transactions", limit],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("customer_credit_transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) {
          console.warn("[CustomerCredits] Erro ao listar transações:", error.message);
          return [];
        }
        return (data || []) as CustomerCreditTransaction[];
      } catch (err) {
        console.warn("[CustomerCredits] Exceção:", err);
        return [];
      }
    },
    staleTime: 1000 * 20,
  });
}

/** Hook para buscar clientes cadastrados em profiles */
export function useAllCustomerProfiles() {
  return useQuery({
    queryKey: ["admin-all-profiles-customers"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, phone, email, full_name")
          .order("name", { ascending: true })
          .limit(500);
        if (error) {
          console.warn("[CustomerCredits] Erro ao buscar profiles:", error.message);
          return [];
        }
        return data || [];
      } catch (err) {
        return [];
      }
    },
    staleTime: 1000 * 60,
  });
}

/** Mutation para Adicionar Créditos (Recarga + Bônus 10%) e Alimentar Fluxo de Caixa */
export function useAddCustomerCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      customer_id: string;
      customer_name?: string;
      customer_phone?: string;
      paid_amount: number;
      bonus_amount: number;
      description?: string;
      payment_method?: string;
      registerCashFlow?: boolean;
    }) => {
      const totalCredits = Number(input.paid_amount || 0) + Number(input.bonus_amount || 0);

      // 1. Tenta executar via RPC atômica
      let rpcSuccess = false;
      try {
        const { data, error } = await supabase.rpc("rpc_add_customer_credits", {
          p_customer_id: input.customer_id,
          p_customer_name: input.customer_name || "Cliente",
          p_customer_phone: input.customer_phone || "",
          p_paid_amount: input.paid_amount,
          p_bonus_amount: input.bonus_amount,
          p_description: input.description || `Recarga de créditos com bônus de 10% (Pago: R$ ${input.paid_amount.toFixed(2)})`,
          p_admin_identifier: "admin",
        });
        if (!error) {
          rpcSuccess = true;
        } else {
          console.warn("[CustomerCredits] RPC indisponível, usando fallback direto:", error.message);
        }
      } catch (e) {
        console.warn("[CustomerCredits] Falha ao invocar RPC:", e);
      }

      // Fallback direto se a RPC ainda não tiver sido criada
      if (!rpcSuccess) {
        // Upsert na tabela customer_credits
        const { data: existing } = await supabase
          .from("customer_credits")
          .select("balance, total_recharged, total_bonus")
          .eq("customer_id", input.customer_id)
          .maybeSingle();

        const newBal = (Number(existing?.balance) || 0) + totalCredits;
        const newRecharged = (Number(existing?.total_recharged) || 0) + input.paid_amount;
        const newBonus = (Number(existing?.total_bonus) || 0) + input.bonus_amount;

        await supabase.from("customer_credits").upsert({
          customer_id: input.customer_id,
          customer_name: input.customer_name || "Cliente",
          customer_phone: input.customer_phone || "",
          balance: newBal,
          total_recharged: newRecharged,
          total_bonus: newBonus,
          updated_at: new Date().toISOString(),
        });

        // Inserir registro no extrato
        await supabase.from("customer_credit_transactions").insert({
          customer_id: input.customer_id,
          customer_name: input.customer_name || "Cliente",
          customer_phone: input.customer_phone || "",
          amount: totalCredits,
          paid_amount: input.paid_amount,
          bonus_amount: input.bonus_amount,
          type: "recharge",
          description: input.description || `Recarga de R$ ${input.paid_amount.toFixed(2)} (+R$ ${input.bonus_amount.toFixed(2)} bônus 10%)`,
          created_by: "admin",
        });
      }

      // 2. Registrar no Fluxo de Caixa como Entrada ("Venda de Créditos Cliente")
      if (input.registerCashFlow !== false && input.paid_amount > 0) {
        try {
          const today = new Date().toISOString().split("T")[0];
          await supabase.from("platform_cash_flow").insert({
            type: "income",
            category: "Venda de Créditos Cliente",
            description: `Recarga de Créditos (+10% Bônus) - Cliente: ${input.customer_name || "Cliente"} (${input.customer_phone || ""})`,
            amount: input.paid_amount,
            origin: input.payment_method || "Pix",
            date: today,
          });
        } catch (cfErr) {
          console.warn("[CustomerCredits] Aviso ao salvar no fluxo de caixa:", cfErr);
        }
      }

      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customer-credits"] });
      qc.invalidateQueries({ queryKey: ["admin-customer-credit-transactions"] });
      qc.invalidateQueries({ queryKey: ["platform-cash-flow"] });
    },
  });
}
