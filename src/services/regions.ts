import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRegions() {
  return useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("regions").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function updateRegionPrice(id: string, price: number) {
  const { error } = await supabase.from("regions").update({ price }).eq("id", id);
  if (error) throw error;
}
