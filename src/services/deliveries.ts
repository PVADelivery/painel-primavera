import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeliveryStatus =
  | "pending" | "broadcasted" | "accepted" | "collecting"
  | "in_route" | "in_transit" | "completed" | "delivered"
  | "cancelled" | "returned";

export interface DeliveryWithRelations {
  id: string;
  company_id: string | null;
  driver_id: string | null;
  region_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  value: number;
  commission: number;
  status: DeliveryStatus;
  notes: string | null;
  accepted_at: string | null;
  collected_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string | null;
  delivery_drivers?: {
    id: string;
    user_id: string;
    vehicle_type: string | null;
    vehicle_plate: string | null;
  } | null;
  companies?: { name: string | null; phone: string | null } | null;
}

export interface UseDeliveriesParams {
  status?: string;
  search?: string;
  companyId?: string;
  driverId?: string;
  sinceDays?: number;
  enabled?: boolean;
}

export function useDeliveries(params?: UseDeliveriesParams) {
  const { status, search, companyId, driverId, sinceDays, enabled = true } = params || {};

  return useQuery<DeliveryWithRelations[]>({
    queryKey: ["deliveries", status, search, companyId, driverId, sinceDays],
    queryFn: async () => {
      let query = supabase
        .from("deliveries")
        .select(`*, companies(name, phone), delivery_drivers(id, user_id, vehicle_type, vehicle_plate)`)
        .order("created_at", { ascending: false });

      if (status && status !== "all") query = query.eq("status", status as any);
      if (companyId) query = query.eq("company_id", companyId);
      if (driverId) query = query.eq("driver_id", driverId);
      if (search) query = query.or(`customer_name.ilike.%${search}%,address.ilike.%${search}%`);
      if (sinceDays) {
        const since = new Date();
        since.setDate(since.getDate() - sinceDays);
        query = query.gte("created_at", since.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as DeliveryWithRelations[];
    },
    enabled,
  });
}

export function useUpdateDeliveryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DeliveryStatus }) => {
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = { status, updated_at: now };
      if (status === "accepted") updates.accepted_at = now;
      if (status === "collecting") updates.collected_at = now;
      if (status === "completed" || status === "delivered") updates.completed_at = now;
      if (status === "cancelled") updates.cancelled_at = now;
      const { error } = await supabase.from("deliveries").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliveries"] }),
  });
}

export function useReassignDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, driverId }: { id: string; driverId: string | null }) => {
      const { error } = await supabase
        .from("deliveries")
        .update({ driver_id: driverId, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliveries"] }),
  });
}

export function useCreateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      const { data, error } = await supabase.from("deliveries").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliveries"] }),
  });
}
