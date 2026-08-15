import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDrivers } from "@/services/drivers";
import { useEffect, useState, useMemo } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Bike, Car, Navigation, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/tracking")({
  component: TrackingPage,
});

function TrackingPage() {
  const [mounted, setMounted] = useState(false);
  const { data: drivers = [], refetch } = useDrivers();

  // Primavera do Leste - MT Centro
  const [viewState, setViewState] = useState({
    longitude: -54.2972,
    latitude: -15.5597,
    zoom: 13
  });

  useEffect(() => { 
    setMounted(true); 

    // Atualização em tempo real de posições e status dos entregadores
    const ch = supabase
      .channel("admin-tracking-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_drivers" }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetch]);

  // Todos os entregadores com status Online ativo
  const allOnlineDrivers = useMemo(() => {
    if (!Array.isArray(drivers)) return [];
    return drivers.filter(d => d.is_online === true || d.online === true);
  }, [drivers]);

  // Entregadores online que possuem coordenadas de GPS transmitidas pelo dispositivo
  const onlineDriversWithGPS = useMemo(() => {
    return allOnlineDrivers.filter(d => 
      typeof d.latitude === "number" && 
      typeof d.longitude === "number" && 
      !isNaN(d.latitude) && 
      !isNaN(d.longitude) && 
      d.latitude !== 0 && 
      d.longitude !== 0
    );
  }, [allOnlineDrivers]);

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Rastreio em Tempo Real</h1>
          <p className="text-sm text-muted-foreground">Monitore a localização exata da frota no mapa</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {allOnlineDrivers.length} Online ({onlineDriversWithGPS.length} com GPS ativo)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[70vh]">
        {/* Painel lateral */}
        <Card className="lg:col-span-1 p-4 shadow-card flex flex-col h-full overflow-hidden bg-card/50 backdrop-blur">
          <h2 className="font-semibold mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-primary" />
              Em campo ({allOnlineDrivers.length})
            </span>
          </h2>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {allOnlineDrivers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhum motoboy ou motorista online no momento.</p>
            ) : (
              allOnlineDrivers.map(driver => {
                const hasGPS = typeof driver.latitude === "number" && typeof driver.longitude === "number" && driver.latitude !== 0;
                const isCar = ["car", "carro", "taxi", "carro_aberto", "van", "truck"].includes(String(driver.vehicle_type).toLowerCase());

                return (
                  <div 
                    key={driver.id} 
                    className={cn(
                      "flex items-center justify-between bg-background border p-3 rounded-xl transition-all cursor-pointer",
                      hasGPS ? "border-border/60 hover:border-primary/60 hover:bg-muted/40" : "border-border/30 opacity-70"
                    )}
                    onClick={() => {
                      if (hasGPS) {
                        setViewState({
                          longitude: driver.longitude!,
                          latitude: driver.latitude!,
                          zoom: 16
                        });
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isCar ? <Car className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <Bike className="w-3.5 h-3.5 text-primary shrink-0" />}
                        <p className="text-sm font-semibold truncate">{driver.full_name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate ml-5">{driver.vehicle_plate || (isCar ? "Carro/Táxi" : "Moto")}</p>
                    </div>
                    {hasGPS ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                        <Navigation className="w-3 h-3" /> GPS
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                        Aguardando GPS
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Mapa */}
        <Card className="lg:col-span-3 rounded-2xl overflow-hidden shadow-card border border-border/60 relative h-full">
          {mounted ? (
            <Map
              {...viewState}
              onMove={evt => setViewState(evt.viewState)}
              mapLib={maplibregl}
              mapStyle={{
              version: 8,
              sources: {
                osm: {
                  type: "raster",
                  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                  tileSize: 256,
                  attribution: "&copy; OpenStreetMap Contributors",
                },
              },
              layers: [
                {
                  id: "osm",
                  type: "raster",
                  source: "osm",
                  minzoom: 0,
                  maxzoom: 19,
                },
              ],
            }}
            style={{ width: "100%", height: "100%" }}
            attributionControl={false}
          >
            <NavigationControl position="bottom-right" />
            
            {onlineDriversWithGPS.map(driver => {
              const isCar = ["car", "carro", "taxi", "carro_aberto", "van", "truck"].includes(String(driver.vehicle_type).toLowerCase());
              return (
                <Marker 
                  key={driver.id} 
                  longitude={driver.longitude!} 
                  latitude={driver.latitude!}
                  anchor="bottom"
                >
                  <div className="relative group cursor-pointer">
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-bold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-md border border-border/50">
                      {driver.full_name} • {driver.vehicle_plate || (isCar ? "Carro/Táxi" : "Moto")}
                    </div>
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center shadow-lg border-2 border-background z-10 relative",
                      isCar ? "bg-blue-600 text-white" : "bg-primary text-primary-foreground"
                    )}>
                      {isCar ? <Car className="w-4 h-4" /> : <Bike className="w-4 h-4" />}
                    </div>
                    {/* Ping animation */}
                    <div className={cn(
                      "absolute inset-0 rounded-full animate-ping opacity-75",
                      isCar ? "bg-blue-500/40" : "bg-primary/40"
                    )} style={{ animationDuration: '2s' }} />
                  </div>
                </Marker>
              );
            })}
          </Map>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-bold">
              Carregando mapa...
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
