import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";

import { useDeliveries } from "@/services/deliveries";
import { DeliveryStatusBadge } from "@/components/admin/DeliveryStatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card as UICard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { Search, Package } from "lucide-react";

export const Route = createFileRoute("/admin/deliveries")({
  component: DeliveriesPage,
});

function DeliveriesPage() {
  const { data = [], isLoading } = useDeliveries();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return data.filter((d) =>
      !q ||
      d.customer_name?.toLowerCase().includes(q) ||
      d.address?.toLowerCase().includes(q)
    );
  }, [data, query]);

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Corridas</h1>
          <p className="text-sm text-muted-foreground">Gerencie todas as entregas</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 w-64" />
        </div>
      </div>

      <UICard className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma entrega encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Destino</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{d.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{d.address}</td>
                    <td className="px-4 py-3"><DeliveryStatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {Number(d.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </UICard>
    </AdminLayout>
  );
}
