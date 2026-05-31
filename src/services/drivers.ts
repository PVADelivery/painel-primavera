import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DriverRow = Database["public"]["Tables"]["delivery_drivers"]["Row"];
export type Driver = DriverRow & {
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
};

export function useDrivers() {
  return useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data: drivers, error } = await supabase
        .from("delivery_drivers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = drivers ?? [];
      const userIds = list.map((d) => d.user_id).filter(Boolean) as string[];
      let profMap = new Map<string, { full_name: string | null; phone: string | null; avatar_url: string | null }>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone, avatar_url")
          .in("user_id", userIds);
        profMap = new Map((profs ?? []).map((p) => [p.user_id, p]));
      }
      return list.map((d) => {
        const p = profMap.get(d.user_id);
        return {
          ...d,
          full_name: p?.full_name ?? "Entregador",
          phone: p?.phone ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      });
    },
  });
}

export function useUpdateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<DriverRow>) => {
      const { error } = await supabase.from("delivery_drivers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drivers"] }),
  });
}
