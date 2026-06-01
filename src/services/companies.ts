import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export async function fetchCompanies() {
  const { data, error } = await supabase.from("companies").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export function useCompanies() {
  return useQuery({ queryKey: ["companies"], queryFn: fetchCompanies });
}

export async function fetchCompanyByUserId(userId: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;

  if (!data || data.length === 0) {
    // Admin fallback: pick the first company
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (isAdmin) {
      const { data: fb } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1);
      return fb?.[0] ?? null;
    }
    return null;
  }
  return data.find((c) => !c.name.toLowerCase().includes("teste")) ?? data[0];
}

export function useCompany(userId?: string) {
  return useQuery({
    queryKey: ["company", userId],
    queryFn: () => (userId ? fetchCompanyByUserId(userId) : null),
    enabled: !!userId,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      const { error } = await supabase.from("companies").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useMyCompany() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-company", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
}
