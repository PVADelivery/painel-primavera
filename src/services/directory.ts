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
      const { data, error } = await (supabase as any).from("business_directory").select("*").order("name");
      if (error) throw error;
      return data as DirectoryBusiness[];
    },
  });
}

export function useCreateDirectoryBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (business: Partial<DirectoryBusiness>) => {
      const { data, error } = await (supabase as any).from("business_directory").insert([business]).select().single();
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
      const { data, error } = await (supabase as any).from("business_directory").update(args.data).eq("id", args.id).select().single();
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
      const { error } = await (supabase as any).from("business_directory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directory"] });
    },
  });
}

export function useDirectoryCategories() {
  return useQuery({
    queryKey: ["directory_categories"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "directory_categories")
          .maybeSingle();

        const defaultCategories = [
          "Tudo",
          "Automotivo",
          "Beleza",
          "Construção",
          "Dentistas",
          "Farmácia",
          "Funilaria",
          "Hamburgueria",
          "Mercado",
          "Padaria",
          "Pet Shop",
          "Restaurante",
          "Saúde",
          "Serviços"
        ];
        
        const raw = (!data || !data.value || !Array.isArray(data.value)) 
          ? defaultCategories 
          : (data.value as string[]);

        const isTudo = (c: string) => (c || "").replace(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u, "").trim().toLowerCase() === "tudo";
        const tudo = raw.filter(isTudo);
        const rest = raw
          .filter(c => !isTudo(c))
          .sort((a, b) => {
            const aClean = a.replace(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u, "").trim();
            const bClean = b.replace(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u, "").trim();
            return aClean.localeCompare(bClean, "pt-BR", { sensitivity: "base" });
          });

        return [...(tudo.length > 0 ? ["Tudo"] : []), ...rest];
      } catch {
        return [
          "Tudo",
          "Automotivo",
          "Beleza",
          "Construção",
          "Dentistas",
          "Farmácia",
          "Funilaria",
          "Hamburgueria",
          "Mercado",
          "Padaria",
          "Pet Shop",
          "Restaurante",
          "Saúde",
          "Serviços"
        ];
      }
    },
  });
}

export function useUpdateDirectoryCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categories: string[]) => {
      // Busca registro existente por key para evitar erro de constraint no onConflict
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id")
        .eq("key", "directory_categories")
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("platform_settings")
          .update({
            value: categories,
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("platform_settings")
          .insert({
            key: "directory_categories",
            value: categories,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
      }

      return categories;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directory_categories"] });
    },
  });
}
