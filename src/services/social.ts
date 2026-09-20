import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SocialCategory = "vagas" | "achados" | "doacoes" | "servicos";

export type SocialPost = {
  id: string;
  user_id: string;
  category: SocialCategory;
  title: string;
  body: string | null;
  contact: string | null;
  images: string[] | null;
  is_active: boolean;
  created_at: string;
};

export const CATEGORY_LABEL: Record<SocialCategory, string> = {
  vagas: "Vaga de Emprego",
  achados: "Achados e Perdidos",
  doacoes: "Doação",
  servicos: "Serviço",
};

export function useSocialPosts() {
  return useQuery({
    queryKey: ["admin_social_posts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("social_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[admin_social_posts]", error);
        throw error;
      }
      return (data || []) as SocialPost[];
    },
  });
}

export function useCreateSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (post: Partial<SocialPost>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("social_posts")
        .insert([{
          ...post,
          user_id: post.user_id || user?.id,
          is_active: post.is_active ?? true,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_social_posts"] });
    },
  });
}

export function useUpdateSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SocialPost> }) => {
      const { data: updated, error } = await (supabase as any)
        .from("social_posts")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_social_posts"] });
    },
  });
}

export function useDeleteSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("social_posts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_social_posts"] });
    },
  });
}

export function useApproveSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from("social_posts")
        .update({ is_active: true })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_social_posts"] });
    },
  });
}
