import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PropertyDeal = "locacao" | "venda";
export type PropertyType = "casa" | "apartamento" | "sala" | "kitnet" | "terreno";
export type VehicleType = "carro" | "moto" | "caminhao" | "utilitario" | "outro";

export interface Property {
  id: string;
  owner_id?: string | null;
  agency_name: string | null;
  deal_type: PropertyDeal;
  property_type: PropertyType;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  total_area: number | null;
  built_area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  price: number | null;
  contact_phone: string | null;
  images: string[];
  is_active: boolean;
  created_at: string;
}

export interface Vehicle {
  id: string;
  owner_id?: string | null;
  seller_name: string | null;
  vehicle_type: VehicleType;
  brand: string | null;
  model: string;
  year: number | null;
  km: number | null;
  fuel: string | null;
  transmission: string | null;
  color: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  price: number | null;
  contact_phone: string | null;
  images: string[];
  is_active: boolean;
  created_at: string;
}

// ─── IMÓVEIS (PROPERTIES) ───
export function useProperties() {
  return useQuery<Property[]>({
    queryKey: ["admin_properties"],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("properties")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("[useProperties] Erro ou tabela pendente:", error.message);
          return [];
        }
        return (data || []) as Property[];
      } catch (err) {
        console.warn("[useProperties] Erro resiliente:", err);
        return [];
      }
    },
  });
}

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Property>) => {
      const { data, error } = await (supabase as any)
        .from("properties")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data as Property;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_properties"] });
    },
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Property> }) => {
      const { data: updated, error } = await (supabase as any)
        .from("properties")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return updated as Property;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_properties"] });
    },
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("properties")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_properties"] });
    },
  });
}

// ─── VEÍCULOS (VEHICLES) ───
export function useVehicles() {
  return useQuery<Vehicle[]>({
    queryKey: ["admin_vehicles"],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("vehicles")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("[useVehicles] Erro ou tabela pendente:", error.message);
          return [];
        }
        return (data || []) as Vehicle[];
      } catch (err) {
        console.warn("[useVehicles] Erro resiliente:", err);
        return [];
      }
    },
  });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Vehicle>) => {
      const { data, error } = await (supabase as any)
        .from("vehicles")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data as Vehicle;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_vehicles"] });
    },
  });
}

export function useUpdateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Vehicle> }) => {
      const { data: updated, error } = await (supabase as any)
        .from("vehicles")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return updated as Vehicle;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_vehicles"] });
    },
  });
}

export function useDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("vehicles")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_vehicles"] });
    },
  });
}
