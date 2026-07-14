// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDrivers } from "@/services/drivers";
import { useEffect, useState, useMemo } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { Bike, Navigation } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/admin/tracking")({
  component: TrackingPage,
});

function TrackingPage() {
  const { data: drivers = [] } = useDrivers();
  const [viewState, setViewState] = useState({
    longitude: -54.2972, // Primavera do Leste
    latitude: -15.5597, // Primavera do Leste
    zoom: 12
  });

  const onlineDrivers = useMemo(() => Array.isArray(drivers) ? drivers.filter(d => d.online && d.latitude && d.longitude) : [], [drivers]);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Rastreio em Tempo Real</h1>
        <p className="text-sm text-muted-foreground">Monitore a localização da frota no mapa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[70vh]">
        {/* Painel lateral */}
        <Card className="lg:col-span-1 p-4 shadow-card flex flex-col h-full overflow-hidden bg-card/50 backdrop-blur">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Bike className="w-5 h-5 text-primary" />
            Em campo ({onlineDrivers.length})
          </h2>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {onlineDrivers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhum motoboy online com localização ativa no momento.</p>
            ) : (
              onlineDrivers.map(driver => (
                <div 
                  key={driver.id} 
                  className="flex items-center justify-between bg-background border border-border/50 p-3 rounded-xl hover:border-primary/50 cursor-pointer transition-colors"
                  onClick={() => setViewState({
                    longitude: driver.longitude!,
                    latitude: driver.latitude!,
                    zoom: 15
                  })}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{driver.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{driver.vehicle_plate || "Sem Placa"}</p>
                  </div>
                  <Navigation className="w-4 h-4 text-primary" />
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Mapa */}
        <Card className="lg:col-span-3 rounded-2xl overflow-hidden shadow-card border border-border/60 relative h-full">
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
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
            mapLib={maplibregl}
            style={{ width: "100%", height: "100%" }}
            attributionControl={false}
          >
            <NavigationControl position="bottom-right" />
            
            {onlineDrivers.map(driver => (
              <Marker 
                key={driver.id} 
                longitude={driver.longitude!} 
                latitude={driver.latitude!}
                anchor="bottom"
              >
                <div className="relative group cursor-pointer">
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-md">
                    {driver.full_name}
                  </div>
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-background z-10 relative">
                    <Bike className="w-4 h-4 text-primary-foreground" />
                  </div>
                  {/* Ping animation */}
                  <div className="absolute inset-0 bg-primary/40 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                </div>
              </Marker>
            ))}
          </Map>
        </Card>
      </div>
    </AdminLayout>
  );
}
