import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

export type NeighborhoodRow = Tables<"region_neighborhoods">;

export async function fetchNeighborhoods() {
  const { data, error } = await supabase
    .from("region_neighborhoods")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export function useNeighborhoods() {
  return useQuery({ queryKey: ["region-neighborhoods"], queryFn: fetchNeighborhoods });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["region-neighborhoods"] });
    qc.invalidateQueries({ queryKey: ["regions"] });
  };
}

export function useCreateNeighborhood() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ region_id, name, sort_order }: { region_id: string; name: string; sort_order?: number }) => {
      const { data, error } = await supabase
        .from("region_neighborhoods")
        .insert({ region_id, name: name.trim(), sort_order: sort_order ?? 999 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateNeighborhood() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, name, region_id }: { id: string; name?: string; region_id?: string }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (region_id !== undefined) updates.region_id = region_id;
      const { data, error } = await supabase
        .from("region_neighborhoods")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteNeighborhood() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("region_neighborhoods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
