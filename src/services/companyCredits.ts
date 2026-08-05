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
      const { data, error } = await supabase.rpc("add_company_credits", {
        _company_id: input.company_id,
        _amount: input.amount,
        _description: input.description ?? null,
        _payment_method: input.payment_method ?? null,
        _type: input.type ?? "purchase",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-credits"] });
      qc.invalidateQueries({ queryKey: ["company-credit-transactions"] });
    },
  });
}
