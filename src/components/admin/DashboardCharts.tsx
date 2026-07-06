import { useMemo } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { DeliveryWithRelations } from "@/services/deliveries";
import type { DriverWithProfile } from "@/services/drivers";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingUp } from "lucide-react";

interface Props {
  deliveries: DeliveryWithRelations[];
  drivers?: DriverWithProfile[];
  period: "today" | "7d" | "30d";
  isLoading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(38, 92%, 50%)", broadcasted: "hsl(210, 100%, 52%)",
  accepted: "hsl(217, 91%, 50%)", collecting: "hsl(32, 95%, 52%)",
  in_transit: "hsl(270, 60%, 55%)", delivered: "hsl(145, 63%, 42%)",
  cancelled: "hsl(0, 84%, 60%)", returned: "hsl(220, 10%, 50%)",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente", broadcasted: "Enviado", accepted: "Aceito",
  collecting: "Coletando",
  in_transit: "Em Trânsito",
  delivered: "Entregue",
  completed: "Entregue",
  cancelled: "Cancelado",
  returned: "Devolvido",
};

export function DashboardCharts({ deliveries, period, isLoading }: Props) {
  const revenueTrend = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; count: number }>();
    const now = new Date();
    const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const label = days <= 7
        ? d.toLocaleDateString("pt-BR", { weekday: "short" })
        : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      map.set(key, { date: label, revenue: 0, count: 0 });
    }
    deliveries.forEach((d) => {
      if (d.status !== "delivered") return;
      const key = (d.delivered_at || d.created_at)?.split("T")[0];
      if (key && map.has(key)) {
        const e = map.get(key)!;
        e.revenue += Number(d.value ?? 0);
        e.count += 1;
      }
    });
    return Array.from(map.values());
  }, [deliveries, period]);

  const statusDist = useMemo(() => {
    const c: Record<string, number> = {};
    deliveries.forEach((d) => { c[d.status] = (c[d.status] || 0) + 1; });
    return Object.entries(c)
      .map(([s, v]) => ({ name: STATUS_LABELS[s] || s, value: v, color: STATUS_COLORS[s] || "#888" }))
      .sort((a, b) => b.value - a.value);
  }, [deliveries]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <Skeleton className="w-36 h-4 rounded mb-4" />
          <Skeleton className="w-full h-[200px] rounded-xl" />
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <Skeleton className="w-28 h-4 rounded mb-4" />
          <Skeleton className="w-full h-[200px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Revenue Trend */}
      <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-success" />
          <h3 className="text-sm font-bold text-foreground">Receita</h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={revenueTrend}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(145,63%,42%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(145,63%,42%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(220,10%,50%)" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(220,10%,50%)" tickFormatter={(v) => `R$${v}`} />
            <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            <Area type="monotone" dataKey="revenue" stroke="hsl(145,63%,42%)" strokeWidth={2.5} fill="url(#revGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Status Distribution */}
      <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-4 w-4 text-info" />
          <h3 className="text-sm font-bold text-foreground">Status</h3>
        </div>
        {statusDist.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                {statusDist.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <Package className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs font-medium text-muted-foreground">Sem entregas no período</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Selecione outro intervalo</p>
          </div>
        )}
      </div>
    </div>
  );
}
