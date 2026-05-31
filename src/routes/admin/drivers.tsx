import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDrivers } from "@/services/drivers";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bike, Star } from "lucide-react";

export const Route = createFileRoute("/admin/drivers")({
  component: DriversPage,
});

function DriversPage() {
  const { data = [], isLoading } = useDrivers();
  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Entregadores</h1>
        <p className="text-sm text-muted-foreground">Gerencie sua frota de motoboys</p>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : data.length === 0 ? (
        <Card className="p-16 text-center shadow-card">
          <Bike className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">Nenhum entregador cadastrado</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((d) => (
            <Card key={d.id} className="p-5 shadow-card hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {(d.full_name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-semibold">{d.full_name}</p>
                  <p className="text-xs text-muted-foreground">{d.phone || "—"}</p>
                </div>
                <span className={`h-2 w-2 rounded-full ${d.online ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`} />
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{d.vehicle_type || "Moto"} {d.vehicle_plate || ""}</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" /> {Number(d.rating ?? 5).toFixed(1)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Badge variant="outline">{d.online ? "Online" : "Offline"}</Badge>
                <span className="text-xs text-muted-foreground">Comissão {Number(d.commission_rate).toFixed(0)}%</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
