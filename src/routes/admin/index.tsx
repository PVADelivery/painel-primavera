// @ts-nocheck
import { useMemo } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatsCard } from "@/components/admin/StatsCard";
import { DeliveryStatusBadge } from "@/components/admin/DeliveryStatusBadge";
import { useDeliveries } from "@/services/deliveries";
import { useDrivers } from "@/services/drivers";
import { useRealtimeDeliveries } from "@/hooks/useRealtimeDeliveries";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Truck, DollarSign, Package, Bike, RefreshCw, Bike as BikeIcon } from "lucide-react";
import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { format, startOfDay, eachDayOfInterval, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

function DashboardPage() {
  useRealtimeDeliveries();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"1" | "7" | "30">("7");
  const days = parseInt(period, 10);

  const { data: deliveries = [], isLoading: loadingDel, refetch } = useDeliveries({ sinceDays: days });
  const { data: drivers = [], isLoading: loadingDrv } = useDrivers();

  const stats = useMemo(() => {
    const inTransit = deliveries.filter((d) => d.status === "in_route").length;
    const delivered = deliveries.filter((d) => d.status === "completed");
    const revenue = delivered.reduce((s, d) => s + Number(d.value || 0), 0);
    const onlineDrivers = drivers.filter((d) => d.online).length;
    return {
      inTransit,
      revenue,
      total: deliveries.length,
      delivered: delivered.length,
      onlineDrivers,
      totalDrivers: drivers.length,
    };
  }, [deliveries, drivers]);

  const trendData = useMemo(() => {
    const start = startOfDay(subDays(new Date(), days - 1));
    const range = eachDayOfInterval({ start, end: new Date() });
    return range.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const total = deliveries
        .filter((d) => d.status === "completed" && d.completed_at?.startsWith(dayStr))
        .reduce((s, d) => s + Number(d.value || 0), 0);
      return { day: format(day, "dd/MM", { locale: ptBR }), value: total };
    });
  }, [deliveries, days]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    deliveries.forEach((d) => { counts[d.status] = (counts[d.status] || 0) + 1; });
    const colors: Record<string, string> = {
      pending: "hsl(38 92% 50%)", broadcasted: "hsl(210 100% 52%)", accepted: "hsl(217 91% 50%)",
      collecting: "hsl(32 95% 52%)", in_route: "hsl(280 70% 55%)", completed: "hsl(145 63% 42%)",
      cancelled: "hsl(0 84% 60%)", returned: "hsl(220 10% 50%)",
    };
    return Object.entries(counts).map(([name, value]) => ({ name, value, fill: colors[name] || "#888" }));
  }, [deliveries]);

  return (
    <AdminLayout>
      {/* Hero header */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                AO VIVO
              </span>
              <span className="text-xs capitalize text-muted-foreground">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Visão geral em tempo real da sua operação</p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as typeof period)} variant="outline" size="sm" className="rounded-xl border border-border/80 bg-background/60 p-1 shadow-sm backdrop-blur">
              <ToggleGroupItem value="1" className="rounded-lg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow">Hoje</ToggleGroupItem>
              <ToggleGroupItem value="7" className="rounded-lg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow">7 dias</ToggleGroupItem>
              <ToggleGroupItem value="30" className="rounded-lg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow">30 dias</ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="rounded-xl">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingDel ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <StatsCard title="Em Trânsito" value={stats.inTransit} icon={Truck} color="info"
              onClick={() => navigate({ to: "/admin/deliveries" })} />
            <StatsCard title="Faturamento" value={stats.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              sub={`${stats.delivered} entregas concluídas`} icon={DollarSign} color="success" />
            <StatsCard title="Pedidos" value={stats.total} sub={`${stats.delivered} entregues`} icon={Package} color="primary"
              onClick={() => navigate({ to: "/admin/deliveries" })} />
            <StatsCard title="Frota Online" value={`${stats.onlineDrivers}/${stats.totalDrivers}`} icon={Bike} color="accent"
              onClick={() => navigate({ to: "/admin/drivers" })} />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold">Tendência de Receita</h3>
          {loadingDel ? <Skeleton className="h-64" /> : trendData.every((d) => d.value === 0) ? (
            <EmptyChart label="Sem receita no período" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(217 91% 50%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(217 91% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                <Area type="monotone" dataKey="value" stroke="hsl(217 91% 50%)" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold">Distribuição de Status</h3>
          {loadingDel ? <Skeleton className="h-64" /> : statusData.length === 0 ? (
            <EmptyChart label="Sem entregas no período" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Operacional */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold">Frota</h3>
          {loadingDrv ? <Skeleton className="h-48" /> : drivers.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <BikeIcon className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">Nenhum entregador cadastrado</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-auto">
              {drivers.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {(d.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{d.full_name}</p>
                    <p className="text-xs text-muted-foreground">{d.vehicle_type || "Moto"} {d.vehicle_plate ? `· ${d.vehicle_plate}` : ""}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${d.online ? "text-success" : "text-muted-foreground"}`}>
                    <span className={`h-2 w-2 rounded-full ${d.online ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`} />
                    {d.online ? "Online" : "Offline"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold">Atividade Recente</h3>
          {loadingDel ? <Skeleton className="h-48" /> : deliveries.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">Sem atividade recente</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-auto">
              {deliveries.slice(0, 8).map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg p-2 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.customer_name || "Cliente"}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.address}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <DeliveryStatusBadge status={d.status} />
                    <span className="text-xs font-semibold">
                      {Number(d.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── BONASOFT Watermark ── */}
      <div className="mt-16 pb-8 text-center opacity-40 select-none pointer-events-none">
        <p className="text-[11px] font-black uppercase tracking-[0.6em] text-muted-foreground ml-2">BONASOFT</p>
      </div>
    </AdminLayout>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-center">
      <Package className="h-10 w-10 text-muted-foreground/40" />
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}