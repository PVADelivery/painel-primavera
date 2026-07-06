import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type CityRow = Tables<"cities">;
export type CreateCityInput = TablesInsert<"cities">;
export type UpdateCityInput = TablesUpdate<"cities">;

export async function fetchCities() {
  const { data, error } = await supabase.from("cities").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createCity(city: CreateCityInput) {
  const { data, error } = await supabase.from("cities").insert(city).select().single();
  if (error) throw error;
  return data;
}

export async function updateCity(id: string, updates: UpdateCityInput) {
  const { data, error } = await supabase.from("cities").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCity(id: string) {
  const { error } = await supabase.from("cities").delete().eq("id", id);
  if (error) throw error;
}

export function useCities() {
  return useQuery({
    queryKey: ["cities-table"],
    queryFn: fetchCities,
  });
}

export function useCreateCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCity,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cities-table"] }),
  });
}

export function useUpdateCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateCityInput }) => updateCity(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cities-table"] }),
  });
}

export function useDeleteCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCity,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cities-table"] }),
  });
}
