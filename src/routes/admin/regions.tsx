import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useRegions } from "@/services/regions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
        <p className="text-sm text-muted-foreground">Áreas de cobertura</p>
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
              <div className="flex items-center justify-between">
                <p className="font-semibold">{r.name}</p>
                <Badge variant={r.is_active ? "default" : "outline"}>{r.is_active ? "Ativa" : "Inativa"}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.city} — {r.state}</p>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
