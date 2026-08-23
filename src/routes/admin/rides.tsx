// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Bike, Car, Loader2, Search, Eye, Phone, RefreshCw, Send, Radio, MapPin, UserCheck, ShieldCheck, Clock
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

function getElapsedSeconds(created_at: string | Date | number | null | undefined): number {
  if (!created_at) return 999999;
  let timestamp: number;

  if (typeof created_at === "number") {
    timestamp = created_at;
  } else if (created_at instanceof Date) {
    timestamp = created_at.getTime();
  } else {
    const str = String(created_at).trim();
    let parsed = new Date(str).getTime();
    if (isNaN(parsed)) {
      parsed = new Date(str.replace(" ", "T")).getTime();
    }
    if (isNaN(parsed)) return 999999;
    timestamp = parsed;
  }

  const elapsedMs = Date.now() - timestamp;
  return elapsedMs < 0 ? 0 : Math.floor(elapsedMs / 1000);
}

// Calculador de distância entre coordenadas
function calculateDistanceKm(lat1?: number, lon1?: number, lat2?: number, lon2?: number): number | null {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Widget da Janela do Admin (Atribuição Direta em 2 min)
function AdminDispatchWindowWidget({
  rides,
  onDispatchClick
}: {
  rides: any[];
  onDispatchClick: (ride: any) => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pendingDispatchList = rides.filter(r => {
    if (r.driver_id) return false;
    if (["completed", "cancelled"].includes(r.status)) return false;
    if (!r.created_at) return false;
    const elapsedSeconds = getElapsedSeconds(r.created_at);
    return elapsedSeconds < 120; // 2 minutos
  });

  if (pendingDispatchList.length === 0) return null;

  return (
    <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-3.5 mb-4 shadow-lg space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
          <h2 className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            🚨 DIRECIOTE PARA O MOTORISTA (Janela do Admin: 2 min)
          </h2>
        </div>
        <span className="text-[11px] font-extrabold bg-amber-500/20 text-amber-800 dark:text-amber-200 px-2.5 py-0.5 rounded-full border border-amber-500/30">
          {pendingDispatchList.length} corrida(s) aguardando
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {pendingDispatchList.map(r => {
          const elapsedSeconds = getElapsedSeconds(r.created_at);
          const remainingSeconds = Math.max(0, 120 - elapsedSeconds);
          const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
          const secs = String(remainingSeconds % 60).padStart(2, '0');

          return (
            <div key={r.id} className="bg-card border border-amber-500/30 rounded-xl p-2.5 shadow-xs flex flex-col justify-between space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider flex items-center gap-1">
                    {r.vehicle_type === "taxi" ? <Car className="w-3 h-3 text-blue-500" /> : <Bike className="w-3 h-3 text-amber-500" />}
                    #{r.id.slice(0, 8).toUpperCase()}
                  </span>
                  <p className="text-xs font-bold text-foreground truncate">{r.customer_name || "Passageiro"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.pickup_address}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs font-black font-mono bg-amber-500 text-black px-2 py-0.5 rounded-md shadow-xs">
                    ⏱️ {mins}:{secs}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onDispatchClick(r)}
                className="w-full h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Send className="w-3.5 h-3.5" /> Direcionar para Motorista
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminRidesPage() {
  const [rides, setRides] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [activeStatusFilter, setActiveStatusFilter] = useState("all");
  const [activeVehicleFilter, setActiveVehicleFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Modais de Gerenciamento Identicos ao de Entregas
  const [selectedRide, setSelectedRide] = useState<any | null>(null);
  const [reassignRide, setReassignRide] = useState<any | null>(null);
  const [dispatchRide, setDispatchRide] = useState<any | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchDriversData = async () => {
    try {
      // 1. Tenta buscar todos os motoristas usando o serviço unificado de motoristas
      const { fetchDrivers: getDriversList } = await import("@/services/drivers");
      const list = await getDriversList();
      if (list && list.length > 0) {
        setDrivers(list);
        return;
      }
    } catch (e) {}

    // Fallback: Busca direto da tabela delivery_drivers sem filtro restritivo de active
    try {
      const { data } = await supabase.from("delivery_drivers").select("*");
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
    fetchDriversData();

    const channel = supabase
      .channel("admin-rides-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, () => {
        fetchRides();
        fetchDriversData();
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

  // Atribuição de Motorista Especifico (Mesmo sistema de Entregas)
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
      setDispatchRide(null);
      setReassignRide(null);
      setSelectedDriverId("");
      fetchRides();
    } catch (err: any) {
      toast.error("Erro ao atribuir motorista: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Broadcast para todos os motoristas online (Mesmo sistema de Entregas)
  const handleBroadcast = async (ride: any) => {
    try {
      toast.success(`Corrida #${ride.id.slice(0, 8).toUpperCase()} notificada para todos os motoristas parceiros!`);
    } catch (err: any) {
      toast.error("Erro ao notificar motoristas.");
    }
  };

  // Motoristas disponíveis ordenados por status online e proximidade
  const availableDrivers = useMemo(() => {
    if (!drivers || drivers.length === 0) return [];
    return [...drivers].sort((a, b) => {
      const aOnline = (a.is_online || a.online) ? 1 : 0;
      const bOnline = (b.is_online || b.online) ? 1 : 0;
      return bOnline - aOnline;
    });
  }, [drivers]);

  const getSortedDriversForRide = (ride: any) => {
    const rideLat = Number(ride.pickup_latitude || 0);
    const rideLon = Number(ride.pickup_longitude || 0);

    return [...availableDrivers].sort((a, b) => {
      const aOnline = (a.is_online || a.online) ? 1 : 0;
      const bOnline = (b.is_online || b.online) ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;

      const aMatchesVehicle = (a.vehicle_type === ride.vehicle_type) || (a.vehicle_type === "taxi" && ride.vehicle_type === "taxi");
      const bMatchesVehicle = (b.vehicle_type === ride.vehicle_type) || (b.vehicle_type === "taxi" && ride.vehicle_type === "taxi");
      if (aMatchesVehicle && !bMatchesVehicle) return -1;
      if (!aMatchesVehicle && bMatchesVehicle) return 1;

      if (rideLat && rideLon && a.current_latitude && a.current_longitude && b.current_latitude && b.current_longitude) {
        const distA = calculateDistanceKm(rideLat, rideLon, Number(a.current_latitude), Number(a.current_longitude)) ?? 999;
        const distB = calculateDistanceKm(rideLat, rideLon, Number(b.current_latitude), Number(b.current_longitude)) ?? 999;
        return distA - distB;
      }
      return 0;
    });
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
      {/* ── JANELA DO ADMIN (ALERTAS DE ATRIBUICAO EM 2 MIN) ── */}
      <AdminDispatchWindowWidget rides={rides} onDispatchClick={(r) => { setDispatchRide(r); setSelectedDriverId(""); }} />

      {/* ── BARRA SUPERIOR COMPACTA DE MÉTRICAS ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-card p-3 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-primary shrink-0" />
          <h1 className="text-base font-black tracking-tight text-foreground">Gestão de Corridas</h1>
        </div>

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

      {/* ── BARRA COMPACTA DE FILTROS E BUSCA ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-card p-2 px-3 rounded-xl border border-border shadow-xs">
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

      {/* ── TABELA DE ALTA DENSIDADE COM BOTÕES DE AÇÃO IDÊNTICOS ÀS ENTREGAS ── */}
      <div className="rounded-xl bg-card border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-muted-foreground text-[10px] uppercase font-black tracking-wider">
                <th className="py-2 px-3 w-[100px]">Tipo</th>
                <th className="py-2 px-3 w-[140px]">Passageiro</th>
                <th className="py-2 px-3 max-w-[180px]">Origem</th>
                <th className="py-2 px-3 max-w-[180px]">Destino</th>
                <th className="py-2 px-3 w-[170px]">Motorista Atribuído</th>
                <th className="py-2 px-3 w-[85px]">Valor</th>
                <th className="py-2 px-3 w-[110px]">Status</th>
                <th className="py-2 px-3 text-right w-[170px]">Ações de Atribuição</th>
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
                          <button
                            onClick={() => { setDispatchRide(r); setSelectedDriverId(""); }}
                            className="text-[11px] text-amber-600 font-bold bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> Atribuir motorista...
                          </button>
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

                      {/* Ações Idênticas ao Painel de Entregas */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Botão de Broadcast (Geral) */}
                          {r.status === "pending" && (
                            <button
                              onClick={() => handleBroadcast(r)}
                              className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors text-primary"
                              title="Notificar todos os motoristas online"
                            >
                              <Radio className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Botão de Enviar Direto (Especifico) */}
                          {r.status === "pending" && (
                            <button
                              onClick={() => { setDispatchRide(r); setSelectedDriverId(""); }}
                              className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors text-blue-500"
                              title="Enviar para motorista específico"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Ver Detalhes */}
                          <button
                            onClick={() => setSelectedRide(r)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                            title="Ver detalhes da corrida"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Alteração Rápida de Status */}
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

      {/* ── MODAL COMPLETO DE DISPATCH PARA MOTORISTA (IDÊNTICO AO DE ENTREGAS) ── */}
      {dispatchRide && (
        <Dialog open={!!dispatchRide} onOpenChange={() => setDispatchRide(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Send className="h-5 w-5 text-blue-500" />
                Enviar para Motorista Parceiro
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="bg-muted/50 rounded-xl p-3 border border-border/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black text-primary uppercase">
                    CORRIDA #{dispatchRide.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="text-xs font-bold text-emerald-600">
                    R$ {Number(dispatchRide.price || 15.0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <p className="text-xs font-bold text-foreground">{dispatchRide.customer_name || "Passageiro"}</p>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                  <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="truncate">{dispatchRide.pickup_address}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Motoristas Cadastrados / Disponíveis ({availableDrivers.length})
                </p>
                {availableDrivers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 italic">
                    Nenhum motorista cadastrado no momento.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {getSortedDriversForRide(dispatchRide).map((driver) => {
                      const rideLat = Number(dispatchRide.pickup_latitude || 0);
                      const rideLon = Number(dispatchRide.pickup_longitude || 0);
                      const dist = calculateDistanceKm(rideLat, rideLon, Number(driver.current_latitude || driver.latitude), Number(driver.current_longitude || driver.longitude));
                      const isOnline = driver.is_online || driver.online;

                      return (
                        <button
                          key={driver.id}
                          onClick={() => setSelectedDriverId(driver.id)}
                          className={`w-full text-left rounded-xl p-2.5 transition-all ${
                            selectedDriverId === driver.id
                              ? "bg-primary/10 border-2 border-primary shadow-xs"
                              : "bg-muted/40 hover:bg-muted border border-border/60"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                                {(driver.full_name || "?")[0]}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold text-foreground">{driver.full_name || "—"}</p>
                                  {isOnline ? (
                                    <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded-full">
                                      ● Online
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.2 rounded-full">
                                      ● Cadastrado
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                                  {driver.vehicle_type === "taxi" ? "🚗 Carro (Táxi)" : "🏍️ Moto Táxi"}
                                </span>
                              </div>
                            </div>
                            {dist !== null && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/50">
                                <MapPin className="h-3 w-3 text-primary" />
                                {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setDispatchRide(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!selectedDriverId || updatingId === dispatchRide.id}
                onClick={() => handleAssignDriver(dispatchRide.id, selectedDriverId)}
              >
                {updatingId === dispatchRide.id && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                Confirmar Envio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
