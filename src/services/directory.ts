import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DirectoryBusiness = {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  website: string | null;
  hours: string | null;
  rating: number | null;
  featured: boolean;
  card_image_url: string | null;
  card_style: string | null;
};

export function useDirectory() {
  return useQuery({
    queryKey: ["directory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_directory").select("*").order("name");
      if (error) throw error;
      return data as DirectoryBusiness[];
    },
  });
}

export function useCreateDirectoryBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (business: Partial<DirectoryBusiness>) => {
      const { data, error } = await supabase.from("business_directory").insert([business]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directory"] });
    },
  });
}

export function useUpdateDirectoryBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; data: Partial<DirectoryBusiness> }) => {
      const { data, error } = await supabase.from("business_directory").update(args.data).eq("id", args.id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directory"] });
    },
  });
}

export function useDeleteDirectoryBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_directory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directory"] });
    },
  });
}
