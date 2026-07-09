import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Bike, Car, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/rides")({
  component: AdminRidesPage,
});

function AdminRidesPage() {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRides = async () => {
    try {
      const { data, error } = await supabase
        .from("ride_requests")
        .select(`
          *,
          driver:delivery_drivers(
            id,
            profiles(full_name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRides(data ?? []);
    } catch (err: any) {
      toast.error("Erro ao carregar corridas: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRides();

    // Inscrição em tempo real
    const channel = supabase
      .channel("admin-rides")
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, () => {
        fetchRides();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCancel = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta corrida?")) return;
    try {
      const { error } = await supabase
        .from("ride_requests")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Corrida cancelada!");
      fetchRides();
    } catch (err: any) {
      toast.error("Erro ao cancelar: " + err.message);
    }
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    accepted: "Aceita",
    in_progress: "Em Andamento",
    completed: "Concluída",
    cancelled: "Cancelada",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    accepted: "bg-blue-100 text-blue-800",
    in_progress: "bg-indigo-100 text-indigo-800",
    completed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-rose-100 text-rose-800",
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 bg-card shadow-card p-6 rounded-2xl border border-border/50">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-foreground tracking-tight">Gestão de Corridas</h2>
          <p className="text-sm text-muted-foreground font-medium">Monitore solicitações de Táxi e Moto Táxi</p>
        </div>
      </div>

      <div className="rounded-2xl bg-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Passageiro</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Origem</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Destino</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Motorista</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Valor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" /> Carregando...
                    </div>
                  </td>
                </tr>
              ) : rides.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma corrida encontrada
                  </td>
                </tr>
              ) : (
                rides.map((r) => (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-bold">
                        {r.vehicle_type === "taxi" ? (
                          <><Car className="w-4 h-4 text-primary" /> Táxi</>
                        ) : (
                          <><Bike className="w-4 h-4 text-primary" /> Moto</>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{r.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{r.pickup_address}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{r.dropoff_address}</td>
                    <td className="px-4 py-3">
                      {r.driver?.profiles?.full_name ? (
                        <span className="font-semibold text-foreground">{r.driver.profiles.full_name}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Não atribuído</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-500">R$ {Number(r.price ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${statusColors[r.status] || "bg-muted"}`}>
                        {statusLabels[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status !== "cancelled" && r.status !== "completed" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancel(r.id)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── BONASOFT Watermark ── */}
      <div className="mt-16 pb-8 text-center opacity-40 select-none pointer-events-none">
        <p className="text-[11px] font-black uppercase tracking-[0.6em] text-muted-foreground ml-2">BONASOFT</p>
      </div>
    </AdminLayout>
  );
}
