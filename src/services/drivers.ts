import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type DriverWithProfile = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  online: boolean;
  rating: number;
  latitude: number | null;
  longitude: number | null;
  commission_rate: number;
  created_at?: string;
};

export async function fetchDrivers(): Promise<DriverWithProfile[]> {
  const { data: drivers, error } = await supabase
    .from("delivery_drivers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!drivers || drivers.length === 0) return [];

  const userIds = drivers.map((d) => d.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone, avatar_url")
    .in("user_id", userIds);

  return drivers.map((d) => {
    const p = profiles?.find((x) => x.user_id === d.user_id);
    return {
      id: d.id,
      user_id: d.user_id,
      full_name: p?.full_name || "Entregador",
      phone: p?.phone ?? null,
      avatar_url: p?.avatar_url ?? null,
      vehicle_type: d.vehicle_type ?? d.vehicle ?? "Moto",
      vehicle_plate: d.vehicle_plate ?? d.license_plate ?? null,
      online: Boolean(d.online ?? d.is_online),
      rating: Number(d.rating ?? 5),
      latitude: d.latitude,
      longitude: d.longitude,
      commission_rate: Number(d.commission_rate ?? 0),
      created_at: d.created_at,
    };
  });
}

export function useDrivers() {
  return useQuery({ queryKey: ["drivers"], queryFn: fetchDrivers });
}

export function useToggleDriverOnline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ driverId, online }: { driverId: string; online: boolean }) => {
      const { error } = await supabase
        .from("delivery_drivers")
        .update({ online, is_online: online } as any)
        .eq("id", driverId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drivers"] }),
  });
}
