// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDeliveries } from "@/services/deliveries";
import { Card } from "@/components/ui/card";
import { useMemo } from "react";
import { DollarSign, TrendingUp, Package } from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { data = [] } = useDeliveries({ sinceDays: 30 });
  const stats = useMemo(() => {
    const delivered = data.filter((d) => d.status === "completed");
    const revenue = delivered.reduce((s, d) => s + Number(d.value || 0), 0);
    const commission = delivered.reduce((s, d) => s + Number(d.commission || 0), 0);
    const ticket = delivered.length ? revenue / delivered.length : 0;
    return { revenue, commission, ticket, count: delivered.length };
  }, [data]);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Relatórios dos últimos 30 dias</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatsCard title="Faturamento total" value={stats.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} icon={DollarSign} color="success" />
        <StatsCard title="Ticket médio" value={stats.ticket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} icon={TrendingUp} color="primary" />
        <StatsCard title="Entregas concluídas" value={stats.count} icon={Package} color="info" />
      </div>
      <Card className="mt-6 p-12 text-center shadow-card text-sm text-muted-foreground">
        Relatórios detalhados por empresa e entregador em breve.
      </Card>
    </AdminLayout>
  );
}