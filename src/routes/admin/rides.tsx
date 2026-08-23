// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Trash2, Bike, Car, Loader2, Search, Filter, Eye, UserCheck, 
  CheckCircle2, Clock, MapPin, Phone, ShieldCheck, XCircle, RefreshCw
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
  pending: "Procurando Motorista",
  accepted: "Aceita (A caminho)",
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

  // Modal de Detalhes e Reatribuição
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
      // 1. Filtro por status
      if (activeStatusFilter !== "all" && r.status !== activeStatusFilter) return false;
      // 2. Filtro por veículo
      if (activeVehicleFilter !== "all" && r.vehicle_type !== activeVehicleFilter) return false;
      // 3. Busca por texto
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
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-card shadow-sm p-6 rounded-2xl border border-border">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Car className="w-6 h-6 text-primary" /> Gestão de Corridas (Táxi & Moto Táxi)
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Gerenciamento em tempo real de passageiros, solicitações e atribuição de motoristas parceiros.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchRides()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar Listagem
        </Button>
      </div>

      {/* Cards de Resumo Operacional */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <Card className="p-4 bg-card border-border shadow-sm">
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Total Corridas</p>
          <p className="text-2xl font-black text-foreground mt-1">{stats.total}</p>
        </Card>
        <Card className="p-4 bg-amber-500/10 border-amber-500/20 shadow-sm">
          <p className="text-[11px] font-bold text-amber-600 uppercase">Pendentes</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats.pending}</p>
        </Card>
        <Card className="p-4 bg-blue-500/10 border-blue-500/20 shadow-sm">
          <p className="text-[11px] font-bold text-blue-600 uppercase">Em Andamento</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{stats.active}</p>
        </Card>
        <Card className="p-4 bg-emerald-500/10 border-emerald-500/20 shadow-sm">
          <p className="text-[11px] font-bold text-emerald-600 uppercase">Concluídas</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.completed}</p>
        </Card>
        <Card className="p-4 bg-primary/10 border-primary/20 shadow-sm">
          <p className="text-[11px] font-bold text-primary uppercase">Faturamento Concluído</p>
          <p className="text-xl font-black text-primary mt-1">R$ {stats.revenue.toFixed(2).replace('.', ',')}</p>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6 bg-card p-4 rounded-2xl border border-border shadow-sm">
        {/* Filtros por Status */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-2 md:pb-0">
          {statusFilters.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setActiveStatusFilter(sf.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeStatusFilter === sf.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/60 hover:bg-secondary text-muted-foreground"
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>

        {/* Busca e Tipo de Veículo */}
        <div className="flex items-center gap-2">
          <select
            value={activeVehicleFilter}
            onChange={(e) => setActiveVehicleFilter(e.target.value)}
            className="h-10 px-3 text-xs bg-background border border-border rounded-xl font-medium focus:ring-1 focus:ring-primary focus:outline-none"
          >
            {vehicleFilters.map((vf) => (
              <option key={vf.value} value={vf.value}>{vf.label}</option>
            ))}
          </select>

          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por cliente, endereço ou motorista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-xs bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabela Principal de Gerenciamento de Corridas */}
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                <th className="px-4 py-3.5 text-left font-bold uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3.5 text-left font-bold uppercase tracking-wider">Passageiro</th>
                <th className="px-4 py-3.5 text-left font-bold uppercase tracking-wider">Origem</th>
                <th className="px-4 py-3.5 text-left font-bold uppercase tracking-wider">Destino</th>
                <th className="px-4 py-3.5 text-left font-bold uppercase tracking-wider">Motorista Atribuído</th>
                <th className="px-4 py-3.5 text-left font-bold uppercase tracking-wider">Valor</th>
                <th className="px-4 py-3.5 text-left font-bold uppercase tracking-wider">Status</th>
                <th className="px-4 py-3.5 text-right font-bold uppercase tracking-wider">Gerenciamento (Ações)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" /> Carregando corridas...
                    </div>
                  </td>
                </tr>
              ) : filteredRides.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Car className="w-8 h-8 mx-auto opacity-40 mb-2" />
                    Nenhuma corrida encontrada para o filtro selecionado.
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
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      {/* Tipo */}
                      <td className="px-4 py-3 font-semibold">
                        <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
                          {r.vehicle_type === "taxi" ? (
                            <><Car className="w-4 h-4 text-blue-500" /> Táxi (Carro)</>
                          ) : (
                            <><Bike className="w-4 h-4 text-amber-500" /> Moto Táxi</>
                          )}
                        </span>
                      </td>

                      {/* Passageiro */}
                      <td className="px-4 py-3">
                        <p className="font-bold text-foreground">{r.customer_name || "Passageiro sem nome"}</p>
                        {r.customer_phone && <p className="text-[10px] text-muted-foreground">{r.customer_phone}</p>}
                      </td>

                      {/* Origem */}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate text-muted-foreground">{r.pickup_address}</p>
                      </td>

                      {/* Destino */}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate text-muted-foreground">{r.dropoff_address}</p>
                      </td>

                      {/* Motorista / Seletor Rápido */}
                      <td className="px-4 py-3">
                        {driverObj?.full_name ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{driverObj.full_name}</span>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 px-1.5 text-[10px] text-primary"
                              onClick={() => { setReassignRide(r); setSelectedDriverId(r.driver_id || ""); }}
                            >
                              Trocar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <select
                              disabled={updatingId === r.id}
                              className="text-xs bg-background border border-border rounded-lg px-2 py-1 focus:ring-1 focus:ring-primary focus:outline-none max-w-[170px] font-medium"
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
                          </div>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3 font-extrabold text-emerald-600 text-sm">
                        R$ {ridePrice.toFixed(2).replace('.', ',')}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold border ${statusColors[r.status] || "bg-muted text-foreground"}`}>
                          {statusLabels[r.status] || r.status}
                        </span>
                      </td>

                      {/* Ações (Gerenciamento Completo do Admin) */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ver Detalhes */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs gap-1"
                            onClick={() => setSelectedRide(r)}
                          >
                            <Eye className="w-3.5 h-3.5" /> Detalhes
                          </Button>

                          {/* Seletor de Alteração Rápida de Status */}
                          <select
                            disabled={updatingId === r.id}
                            value={r.status}
                            onChange={(e) => handleUpdateStatus(r.id, e.target.value)}
                            className="h-8 px-2 text-xs bg-background border border-border rounded-lg font-bold focus:ring-1 focus:ring-primary focus:outline-none"
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

      {/* Modal de Detalhes Completos da Corrida */}
      {selectedRide && (
        <Dialog open={!!selectedRide} onOpenChange={() => setSelectedRide(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                {selectedRide.vehicle_type === "taxi" ? <Car className="w-5 h-5 text-blue-500" /> : <Bike className="w-5 h-5 text-amber-500" />}
                Detalhes da Corrida
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="bg-secondary/40 p-3 rounded-xl border border-border/60 flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Passageiro</span>
                  <span className="font-bold text-sm text-foreground">{selectedRide.customer_name || "Não informado"}</span>
                </div>
                {selectedRide.customer_phone && (
                  <a href={`tel:${selectedRide.customer_phone}`} className="flex items-center gap-1 text-primary font-bold bg-primary/10 px-2.5 py-1 rounded-lg">
                    <Phone className="w-3.5 h-3.5" /> {selectedRide.customer_phone}
                  </a>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Origem (Embarque)</span>
                    <span className="font-medium text-foreground">{selectedRide.pickup_address}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Destino (Desembarque)</span>
                    <span className="font-medium text-foreground">{selectedRide.dropoff_address}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <div className="bg-muted/40 p-2.5 rounded-xl">
                  <span className="text-[10px] text-muted-foreground block font-semibold">Valor da Corrida</span>
                  <span className="text-base font-extrabold text-emerald-600">
                    R$ {Number(selectedRide.price || 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="bg-muted/40 p-2.5 rounded-xl">
                  <span className="text-[10px] text-muted-foreground block font-semibold">Distância Estimada</span>
                  <span className="text-base font-extrabold text-foreground">
                    {selectedRide.distance_km ? `${selectedRide.distance_km} km` : "Calculado no mapa"}
                  </span>
                </div>
              </div>

              {selectedRide.driver && (
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-primary uppercase block">Motorista Designado</span>
                    <span className="font-bold text-foreground text-sm">{selectedRide.driver.full_name}</span>
                    <p className="text-[10px] text-muted-foreground">{selectedRide.driver.vehicle} • {selectedRide.driver.license_plate}</p>
                  </div>
                  {selectedRide.driver.phone && (
                    <a href={`tel:${selectedRide.driver.phone}`} className="p-2 rounded-full bg-primary text-primary-foreground">
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}

              {selectedRide.notes && (
                <div className="bg-muted/30 p-2.5 rounded-xl border border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Observações do Passageiro</span>
                  <p className="italic text-foreground mt-0.5">{selectedRide.notes}</p>
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

      {/* Modal de Reatribuição de Motorista */}
      {reassignRide && (
        <Dialog open={!!reassignRide} onOpenChange={() => setReassignRide(null)}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Atribuir Motorista</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <p className="text-muted-foreground">
                Selecione o motorista parceiro para atender a corrida de <strong className="text-foreground">{reassignRide.customer_name || "Passageiro"}</strong>.
              </p>

              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-background border border-border rounded-xl font-medium focus:ring-1 focus:ring-primary focus:outline-none"
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
                Confirmar Atribuição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── BONASOFT Watermark ── */}
      <div className="mt-16 pb-8 text-center opacity-40 select-none pointer-events-none">
        <p className="text-[11px] font-black uppercase tracking-[0.6em] text-muted-foreground ml-2">BONASOFT</p>
      </div>
    </AdminLayout>
  );
}
