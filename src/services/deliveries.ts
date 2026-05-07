import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Delivery = Database["public"]["Tables"]["deliveries"]["Row"];
export type DeliveryStatus = Delivery["status"];

export function useDeliveries(params?: { status?: DeliveryStatus; sinceDays?: number }) {
  return useQuery({
    queryKey: ["deliveries", params],
    queryFn: async () => {
      let q = supabase.from("deliveries").select("*").order("created_at", { ascending: false }).limit(500);
      if (params?.status) q = q.eq("status", params.status);
      if (params?.sinceDays) {
        const since = new Date(Date.now() - params.sinceDays * 86400000).toISOString();
        q = q.gte("created_at", since);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database["public"]["Tables"]["deliveries"]["Insert"]) => {
      const { data, error } = await supabase.from("deliveries").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliveries"] }),
  });
}

export function useUpdateDeliveryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DeliveryStatus }) => {
      const { error } = await supabase.from("deliveries").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliveries"] }),
  });
}
