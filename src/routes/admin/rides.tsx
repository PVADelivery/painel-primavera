// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Bike, Car, Loader2, Search, Eye, Phone, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/rides")({
  component: AdminRidesPage,
});

const statusFilters = [
  { label: "Todas", value: "all" },
  { label: "Pendentes", value: "pending" },
  { label: "Aceitas", value: "accepted" },
  { label: "Em Andamento", value: "in_progress" },
  { label: "Concluídas", value: "completed" },
  { label: "Canceladas", value: "cancelled" },
];

const vehicleFilters = [
  { label: "Todos Veículos", value: "all" },
  { label: "Táxi (Carro)", value: "taxi" },
  { label: "Moto Táxi", value: "mototaxi" },
];

const statusLabels: Record<string, string> = {
  pending: "Procurando",
  accepted: "Aceita",
  in_progress: "Em Andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse",
  accepted: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  in_progress: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  cancelled: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

function AdminRidesPage() {
  const [rides, setRides] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [activeStatusFilter, setActiveStatusFilter] = useState("all");
  const [activeVehicleFilter, setActiveVehicleFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Modais
  const [selectedRide, setSelectedRide] = useState<any | null>(null);
  const [reassignRide, setReassignRide] = useState<any | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from("delivery_drivers")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      setDrivers(data ?? []);
    } catch (err: any) {
      console.error("Erro ao carregar motoristas:", err);
    }
  };

  const fetchRides = async () => {
    try {
      const { data, error } = await supabase
        .from("ride_requests")
        .select(`
          *,
          driver:delivery_drivers(*)
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
    fetchDrivers();

    const channel = supabase
      .channel("admin-rides-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, () => {
        fetchRides();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (rideId: string, newStatus: string) => {
    setUpdatingId(rideId);
    try {
      const updateData: any = { 
        status: newStatus, 
        updated_at: new Date().toISOString() 
      };
      const { error } = await supabase
        .from("ride_requests")
        .update(updateData)
        .eq("id", rideId);

      if (error) throw error;
      toast.success(`Status da corrida atualizado para: ${statusLabels[newStatus] || newStatus}`);
      fetchRides();
    } catch (err: any) {
      toast.error("Erro ao atualizar status: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAssignDriver = async (rideId: string, driverId: string) => {
    if (!driverId) return;
    setUpdatingId(rideId);
    try {
      const { error } = await supabase
        .from("ride_requests")
        .update({ 
          driver_id: driverId, 
          status: "accepted", 
          updated_at: new Date().toISOString() 
        })
        .eq("id", rideId);

      if (error) throw error;
      toast.success("Motorista atribuído com sucesso!");
      setReassignRide(null);
      setSelectedDriverId("");
      fetchRides();
    } catch (err: any) {
      toast.error("Erro ao atribuir motorista: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtragem local resiliente
  const filteredRides = useMemo(() => {
    return rides.filter((r) => {
      if (activeStatusFilter !== "all" && r.status !== activeStatusFilter) return false;
      if (activeVehicleFilter !== "all" && r.vehicle_type !== activeVehicleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = (r.customer_name || "").toLowerCase().includes(q);
        const matchesPhone = (r.customer_phone || "").toLowerCase().includes(q);
        const matchesPickup = (r.pickup_address || "").toLowerCase().includes(q);
        const matchesDropoff = (r.dropoff_address || "").toLowerCase().includes(q);
        const matchesDriver = (r.driver?.full_name || "").toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesPickup && !matchesDropoff && !matchesDriver) {
          return false;
        }
      }
      return true;
    });
  }, [rides, activeStatusFilter, activeVehicleFilter, search]);

  // Indicadores Numéricos
  const stats = useMemo(() => {
    const total = rides.length;
    const pending = rides.filter((r) => r.status === "pending").length;
    const active = rides.filter((r) => r.status === "accepted" || r.status === "in_progress").length;
    const completed = rides.filter((r) => r.status === "completed").length;
    const revenue = rides
      .filter((r) => r.status === "completed")
      .reduce((sum, r) => sum + Number(r.price || 0), 0);
    return { total, pending, active, completed, revenue };
  }, [rides]);

  return (
    <AdminLayout>
      {/* ── BARRA SUPERIOR COMPACTA DE MÉTRICAS ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-card p-3 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-primary shrink-0" />
          <h1 className="text-base font-black tracking-tight text-foreground">Gestão de Corridas</h1>
        </div>

        {/* Badges de Resumo em Linha (Sem espaço desperdiçado) */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <span className="bg-secondary px-2.5 py-1 rounded-lg border border-border">
            Total: <strong className="text-foreground">{stats.total}</strong>
          </span>
          <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-lg border border-amber-500/20">
            Pendentes: <strong>{stats.pending}</strong>
          </span>
          <span className="bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/20">
            Em Andamento: <strong>{stats.active}</strong>
          </span>
          <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            Concluídas: <strong>{stats.completed}</strong>
          </span>
          <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-lg border border-primary/20 font-bold">
            Faturamento: R$ {stats.revenue.toFixed(2).replace('.', ',')}
          </span>
          <Button variant="ghost" size="sm" onClick={() => fetchRides()} className="h-7 w-7 p-0 ml-1" title="Atualizar">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── BARRA COMPACTA DE FILTROS E BUSCA (UMA ÚNICA LINHA) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-card p-2 px-3 rounded-xl border border-border shadow-xs">
        {/* Pills de Status */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {statusFilters.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setActiveStatusFilter(sf.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                activeStatusFilter === sf.value
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-secondary/60 hover:bg-secondary text-muted-foreground"
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>

        {/* Busca e Tipo de Veículo */}
        <div className="flex items-center gap-1.5 ml-auto">
          <select
            value={activeVehicleFilter}
            onChange={(e) => setActiveVehicleFilter(e.target.value)}
            className="h-8 px-2 text-[11px] bg-background border border-border rounded-lg font-medium focus:ring-1 focus:ring-primary focus:outline-none"
          >
            {vehicleFilters.map((vf) => (
              <option key={vf.value} value={vf.value}>{vf.label}</option>
            ))}
          </select>

          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar cliente, endereço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-[11px] bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ── TABELA ALTA DENSIDADE COMPACTA ── */}
      <div className="rounded-xl bg-card border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-muted-foreground text-[10px] uppercase font-black tracking-wider">
                <th className="py-2 px-3 w-[110px]">Tipo</th>
                <th className="py-2 px-3 w-[140px]">Passageiro</th>
                <th className="py-2 px-3 max-w-[180px]">Origem</th>
                <th className="py-2 px-3 max-w-[180px]">Destino</th>
                <th className="py-2 px-3 w-[170px]">Motorista Atribuído</th>
                <th className="py-2 px-3 w-[90px]">Valor</th>
                <th className="py-2 px-3 w-[110px]">Status</th>
                <th className="py-2 px-3 text-right w-[150px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" /> Carregando corridas...
                    </div>
                  </td>
                </tr>
              ) : filteredRides.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    <Car className="w-6 h-6 mx-auto opacity-30 mb-1" />
                    Nenhuma corrida encontrada.
                  </td>
                </tr>
              ) : (
                filteredRides.map((r) => {
                  const driverObj = r.driver;
                  const ridePrice = (() => {
                    const p = Number(r.price || 0);
                    if (p > 0) return p;
                    const dist = Number(r.distance_km || 0);
                    const base = r.vehicle_type === "taxi" ? 9.99 : 6.99;
                    const rate = r.vehicle_type === "taxi" ? 3.0 : 2.0;
                    if (dist > 0) return Number((base + dist * rate).toFixed(2));
                    return r.vehicle_type === "taxi" ? 15.0 : 10.0;
                  })();

                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      {/* Tipo */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-bold text-[11px]">
                          {r.vehicle_type === "taxi" ? (
                            <><Car className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Táxi</>
                          ) : (
                            <><Bike className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Moto</>
                          )}
                        </span>
                      </td>

                      {/* Passageiro */}
                      <td className="py-2 px-3">
                        <p className="font-bold text-foreground truncate max-w-[130px]" title={r.customer_name || ""}>
                          {r.customer_name || "—"}
                        </p>
                        {r.customer_phone && <p className="text-[10px] text-muted-foreground">{r.customer_phone}</p>}
                      </td>

                      {/* Origem */}
                      <td className="py-2 px-3 max-w-[180px]">
                        <p className="truncate text-muted-foreground text-[11px]" title={r.pickup_address}>
                          {r.pickup_address}
                        </p>
                      </td>

                      {/* Destino */}
                      <td className="py-2 px-3 max-w-[180px]">
                        <p className="truncate text-muted-foreground text-[11px]" title={r.dropoff_address}>
                          {r.dropoff_address}
                        </p>
                      </td>

                      {/* Motorista */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {driverObj?.full_name ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground truncate max-w-[110px]" title={driverObj.full_name}>
                              {driverObj.full_name}
                            </span>
                            <button 
                              className="text-[10px] font-bold text-primary hover:underline"
                              onClick={() => { setReassignRide(r); setSelectedDriverId(r.driver_id || ""); }}
                            >
                              Trocar
                            </button>
                          </div>
                        ) : (
                          <select
                            disabled={updatingId === r.id}
                            className="h-7 text-[11px] bg-background border border-border rounded-md px-1.5 focus:ring-1 focus:ring-primary focus:outline-none max-w-[150px] font-medium"
                            onChange={(e) => {
                              if (e.target.value) handleAssignDriver(r.id, e.target.value);
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>Atribuir motorista...</option>
                            {drivers.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.full_name} ({d.vehicle_type === "taxi" ? "🚗 Carro" : "🏍️ Moto"})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="py-2 px-3 font-extrabold text-emerald-600 whitespace-nowrap text-xs">
                        R$ {ridePrice.toFixed(2).replace('.', ',')}
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${statusColors[r.status] || "bg-muted text-foreground"}`}>
                          {statusLabels[r.status] || r.status}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] gap-1"
                            onClick={() => setSelectedRide(r)}
                          >
                            <Eye className="w-3 h-3" /> Detalhes
                          </Button>

                          <select
                            disabled={updatingId === r.id}
                            value={r.status}
                            onChange={(e) => handleUpdateStatus(r.id, e.target.value)}
                            className="h-7 px-1.5 text-[11px] bg-background border border-border rounded-md font-bold focus:ring-1 focus:ring-primary focus:outline-none"
                          >
                            <option value="pending">Pendente</option>
                            <option value="accepted">Aceita</option>
                            <option value="in_progress">Em Andamento</option>
                            <option value="completed">Concluída</option>
                            <option value="cancelled">Cancelar</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes Completos */}
      {selectedRide && (
        <Dialog open={!!selectedRide} onOpenChange={() => setSelectedRide(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                {selectedRide.vehicle_type === "taxi" ? <Car className="w-5 h-5 text-blue-500" /> : <Bike className="w-5 h-5 text-amber-500" />}
                Detalhes da Corrida
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-1 text-xs">
              <div className="bg-secondary/40 p-2.5 rounded-xl border border-border/60 flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Passageiro</span>
                  <span className="font-bold text-sm text-foreground">{selectedRide.customer_name || "Não informado"}</span>
                </div>
                {selectedRide.customer_phone && (
                  <a href={`tel:${selectedRide.customer_phone}`} className="flex items-center gap-1 text-primary font-bold bg-primary/10 px-2 py-1 rounded-lg">
                    <Phone className="w-3.5 h-3.5" /> {selectedRide.customer_phone}
                  </a>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Origem</span>
                    <span className="font-medium text-foreground">{selectedRide.pickup_address}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 mt-1" />
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Destino</span>
                    <span className="font-medium text-foreground">{selectedRide.dropoff_address}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <div className="bg-muted/40 p-2 rounded-xl">
                  <span className="text-[10px] text-muted-foreground block font-semibold">Valor da Corrida</span>
                  <span className="text-base font-extrabold text-emerald-600">
                    R$ {Number(selectedRide.price || 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="bg-muted/40 p-2 rounded-xl">
                  <span className="text-[10px] text-muted-foreground block font-semibold">Distância</span>
                  <span className="text-base font-extrabold text-foreground">
                    {selectedRide.distance_km ? `${selectedRide.distance_km} km` : "Calculado no mapa"}
                  </span>
                </div>
              </div>

              {selectedRide.driver && (
                <div className="bg-primary/5 border border-primary/20 p-2.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-primary uppercase block">Motorista Designado</span>
                    <span className="font-bold text-foreground text-sm">{selectedRide.driver.full_name}</span>
                    <p className="text-[10px] text-muted-foreground">{selectedRide.driver.vehicle} • {selectedRide.driver.license_plate}</p>
                  </div>
                  {selectedRide.driver.phone && (
                    <a href={`tel:${selectedRide.driver.phone}`} className="p-2 rounded-full bg-primary text-primary-foreground">
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedRide(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Reatribuição */}
      {reassignRide && (
        <Dialog open={!!reassignRide} onOpenChange={() => setReassignRide(null)}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Atribuir Motorista</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <p className="text-muted-foreground">
                Selecione o motorista para a corrida de <strong className="text-foreground">{reassignRide.customer_name || "Passageiro"}</strong>.
              </p>

              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-background border border-border rounded-xl font-medium focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="">Selecione um motorista...</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} ({d.vehicle_type === "taxi" ? "🚗 Carro" : "🏍️ Moto"})
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setReassignRide(null)}>
                Cancelar
              </Button>
              <Button 
                size="sm" 
                disabled={!selectedDriverId || updatingId === reassignRide.id}
                onClick={() => handleAssignDriver(reassignRide.id, selectedDriverId)}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── BONASOFT Watermark ── */}
      <div className="mt-8 pb-4 text-center opacity-40 select-none pointer-events-none">
        <p className="text-[10px] font-black uppercase tracking-[0.6em] text-muted-foreground ml-2">BONASOFT</p>
      </div>
    </AdminLayout>
  );
}
