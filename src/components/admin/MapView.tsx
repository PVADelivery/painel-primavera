// @ts-nocheck
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useDrivers } from "@/services/drivers";
import { useDeliveries } from "@/services/deliveries";
import { useCompanies } from "@/services/companies";
import { useToast } from "@/hooks/use-toast";

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface MapViewProps {
  centerCity?: { name: string; lat: number; lng: number } | null;
  darkTheme?: boolean;
}

export function MapView({ centerCity, darkTheme = false }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const labelsRef = useRef<any[]>([]);
  const regionsRenderedRef = useRef<string[]>([]);
  const { toast } = useToast();

  const { data: allDrivers } = useDrivers();
  const drivers = Array.isArray(allDrivers) ? allDrivers.filter(d => d.status === "active" || d.status === "approved") : [];
  const { data: deliveriesData } = useDeliveries({ status: "in_transit" });
  const { data: companies } = useCompanies();

  const getCentroid = (coords: [number, number][]) => {
    let x = 0, y = 0;
    coords.forEach(([lng, lat]) => {
      x += lng;
      y += lat;
    });
    return [x / coords.length, y / coords.length] as [number, number];
  };

  const defaultCenter: [number, number] = centerCity
    ? [centerCity.lng, centerCity.lat]
    : [-54.2972, -15.5597];

  useEffect(() => {
    if (!mapContainer.current || map.current || typeof window === "undefined") return;

    let isMounted = true;
    import("maplibre-gl").then((maplibreglModule) => {
      if (!isMounted || !mapContainer.current) return;
      const maplibregl = maplibreglModule.default || maplibreglModule;

      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
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
        },
        center: defaultCenter,
        zoom: 12,
      });

      map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");
    });

    return () => {
      isMounted = false;
      try {
        if (markersRef.current) markersRef.current.forEach((m) => m.remove());
        if (labelsRef.current) labelsRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        labelsRef.current = [];
        if (map.current) map.current.remove();
      } catch (e) {
        console.warn("Maplibre remove error safely caught:", e);
      }
      map.current = null;
    };
  }, [centerCity]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map.current || !centerCity) return;
    map.current.flyTo({ center: [centerCity.lng, centerCity.lat], zoom: 13, duration: 1500 });
  }, [centerCity?.lat, centerCity?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render driver + company markers
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || typeof window === "undefined") return;

    let cancelled = false;
    import("maplibre-gl").then((mod) => {
      if (cancelled) return;
      const maplibregl: any = (mod as any).default || mod;
      renderMarkers(maplibregl, currentMap);
    });
    return () => { cancelled = true; };
  }, [drivers, companies]);

  function renderMarkers(maplibregl: any, currentMap: any) {
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    (drivers ?? []).forEach((driver) => {
      const lat = driver.latitude;
      const lng = driver.longitude;
      if (!lat || !lng) return;

      const el = document.createElement("div");
      el.className = "driver-marker-container";
      
      // Premium Google-Maps-Style PIN with Pulse
      el.innerHTML = `
        <div class="pin-wrapper" style="
          position: relative;
          cursor: pointer;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
          <!-- Pulse Effect -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 30px;
            height: 30px;
            background: #22c55e;
            border-radius: 50%;
            opacity: 0.6;
            animation: pinPulse 2s ease-out infinite;
          "></div>
          
          <!-- Outer Circle -->
          <div style="
            width: 44px; 
            height: 44px; 
            border-radius: 50%; 
            background: #22c55e; 
            border: 3px solid white; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            position: relative;
            z-index: 2;
          ">
            <!-- Icon Background -->
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background: white;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              font-size: 18px;
            ">
              <span>${(driver.vehicle_type || '').toLowerCase().includes('taxi') || (driver.vehicle_type || '').toLowerCase().includes('car') ? '🚖' : '🏍️'}</span>
            </div>
          </div>
          
          <!-- Tooltip (Small and fast) -->
          <div style="
            position: absolute;
            bottom: -25px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.85);
            backdrop-filter: blur(4px);
            color: white;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 800;
            white-space: nowrap;
            z-index: 3;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          ">${escapeHtml(driver.full_name?.split(" ")[0] || "Entregador")}</div>
        </div>
        
        <style>
          @keyframes pinPulse {
            0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
            100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
          }
        </style>
      `;

      const popupContent = `
        <div style="
          padding: 16px; 
          font-family: 'Inter', sans-serif; 
          min-width: 200px;
          background: #ffffff;
          border-radius: 20px;
        ">
          <div style="display: flex; items-center; gap: 12px; margin-bottom: 12px;">
            <div style="width: 48px; height: 48px; border-radius: 12px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; font-size: 24px;">
              <span>${(driver.vehicle_type || '').toLowerCase().includes('taxi') || (driver.vehicle_type || '').toLowerCase().includes('car') ? '🚖' : '🏍️'}</span>
            </div>
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #111827;">${escapeHtml(driver.full_name || "Entregador")}</div>
              <div style="font-size: 12px; color: #22c55e; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                <div style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></div>
                Em Rota de Entrega
              </div>
            </div>
          </div>
          
          <div style="display: grid; grid-template-cols: 1fr; gap: 8px;">
            <a href="https://wa.me/${encodeURIComponent(driver.phone?.replace(/\D/g, "") || "")}" target="_blank" style="
              text-decoration: none;
              background: #25D366;
              color: white;
              padding: 10px;
              border-radius: 12px;
              text-align: center;
              font-size: 13px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
              transition: transform 0.2s;
            ">
              WhatsApp Direto
            </a>
            <div style="font-size: 11px; text-align: center; color: #6b7280; font-weight: 500;">
              Avaliação: ⭐ ${Number(driver.rating).toFixed(1)}
            </div>
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(popupContent))
        .addTo(currentMap);

      markersRef.current.push(marker);
    });

    (companies ?? []).forEach((company) => {
      if (!company.latitude || !company.longitude) return;

      const el = document.createElement("div");
      const statusColor = company.is_active ? "#22c55e" : "#ef4444";
      el.innerHTML = `
        <div style="
          width: 36px; height: 36px; border-radius: 10px;
          background: ${statusColor};
          border: 3px solid white;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          font-size: 16px;
        ">🏪</div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([company.longitude, company.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setHTML(`
            <div style="font-family: sans-serif; padding: 4px; min-width: 120px;">
              <strong style="font-size: 14px;">${escapeHtml(company.name)}</strong><br/>
              <div style="margin-top: 4px; border-top: 1px solid #eee; padding-top: 4px;">
                <small style="color: #666;">${escapeHtml(company.address || "Sem endereço")}</small><br/>
                <span style="display: inline-block; margin-top: 4px; color: ${company.is_active ? "#22c55e" : "#ef4444"}; font-weight: 600; font-size: 11px;">
                  ● ${company.is_active ? "Aberta" : "Fechada"}
                </span>
              </div>
            </div>
          `)
        )
        .addTo(currentMap);

      markersRef.current.push(marker);
    });
  }

  return (
    <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden" />
  );
}

