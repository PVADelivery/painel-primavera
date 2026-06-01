import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRealtimeDeliveries() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("realtime-deliveries")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "deliveries" }, (payload) => {
        const d = payload.new as { customer_name?: string };
        toast.success(`📦 Nova entrega: ${d.customer_name || "cliente"}`);
        qc.invalidateQueries({ queryKey: ["deliveries"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "deliveries" }, (payload) => {
        const d = payload.new as { status?: string; customer_name?: string };
        const emoji: Record<string, string> = {
          completed: "✅", in_route: "🏍️", cancelled: "❌", accepted: "👍", collecting: "📥",
        };
        if (d.status && emoji[d.status]) {
          toast.message(`${emoji[d.status]} ${d.customer_name || "Entrega"} — ${d.status}`);
        }
        qc.invalidateQueries({ queryKey: ["deliveries"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_drivers" }, () => {
        qc.invalidateQueries({ queryKey: ["drivers"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}
