import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useRegions } from "@/services/regions";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/admin/regions")({
  component: RegionsPage,
});

function RegionsPage() {
  const { data = [], isLoading } = useRegions();
  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Regiões</h1>
        <p className="text-sm text-muted-foreground">Áreas de cobertura e tarifas</p>
      </div>
      <Card className="p-5 shadow-card mb-4">
        <div className="flex h-72 items-center justify-center rounded-lg bg-gradient-to-br from-muted to-secondary text-muted-foreground">
          <div className="text-center">
            <MapPin className="mx-auto h-10 w-10" />
            <p className="mt-2 text-sm">Mapa interativo (em breve)</p>
          </div>
        </div>
      </Card>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : data.length === 0 ? (
        <Card className="p-12 text-center shadow-card">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma região cadastrada</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.map((r) => (
            <Card key={r.id} className="p-5 shadow-card">
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.city}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <span>Base: <strong>R$ {Number(r.base_price).toFixed(2)}</strong></span>
                <span>/km: <strong>R$ {Number(r.price_per_km).toFixed(2)}</strong></span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
