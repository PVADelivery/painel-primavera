// @ts-nocheck
import { Bell, Check, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatDeliveryValue } from "@/lib/delivery";
import { Link } from "@tanstack/react-router";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "success" | "warning";
}

const STORAGE_KEY = "epj_notifications_cleared";

import { useDeliveries } from "@/services/deliveries";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export function NotificationsPopover() {
  const { data: deliveriesData } = useDeliveries({ pageSize: 10 });
  const deliveries = deliveriesData?.data ?? [];
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);

  const pendingDeliveries = deliveries.filter(d => d.status === "pending");
  const unreadCount = pendingDeliveries.length;

  // Sound alert logic for new pending deliveries
  useEffect(() => {
    if (pendingDeliveries.length > 0) {
      const newestId = pendingDeliveries[0].id;
      if (newestId !== lastNotificationId) {
        if (lastNotificationId !== null) {
          const audio = new Audio(NOTIFICATION_SOUND);
          audio.play().catch(e => console.log("Audio play blocked by browser:", e));
        }
        setLastNotificationId(newestId);
      }
    }
  }, [pendingDeliveries, lastNotificationId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "text-warning";
      case "in_transit": return "text-primary";
      case "delivered": return "text-success";
      case "completed": return "text-success";
      case "cancelled": return "text-destructive";
      default: return "text-primary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Novo Pedido";
      case "accepted": return "Pedido Aceito";
      case "collecting": return "Coletando";
      case "in_transit": return "Em Rota";
      case "delivered": return "Finalizado";
      case "completed": return "Finalizado";
      case "cancelled": return "Cancelado";
      default: return status.toUpperCase();
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-xl hover:bg-muted transition-colors outline-none group">
          <Bell className={cn(
            "h-5 w-5 transition-colors",
            unreadCount > 0 ? "text-warning fill-warning/20" : "text-muted-foreground group-hover:text-foreground"
          )} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-destructive border-2 border-card flex items-center justify-center">
              <span className="block h-1 w-1 rounded-full bg-white animate-pulse" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 mr-4 mt-1 border-border shadow-2xl rounded-2xl overflow-hidden" align="end">
        <div className="bg-card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h4 className="font-bold text-sm">Central de Alertas</h4>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Atividade ao Vivo
            </span>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {deliveries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Bell className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhuma atividade</p>
                <p className="text-xs text-muted-foreground mt-1">Aguardando novos pedidos...</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {deliveries.map((d) => (
                  <div key={d.id} className={cn(
                    "p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                    d.status === "pending" && "bg-warning/5"
                  )}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider",
                        getStatusColor(d.status)
                      )}>
                        {getStatusLabel(d.status)}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {d.created_at ? format(new Date(d.created_at), "HH:mm", { locale: ptBR }) : ""}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-foreground leading-tight">
                      {d.companies?.name || "Empresa"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Para: {d.customer_name || "Cliente"}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                       <span className="text-[10px] font-medium px-2 py-0.5 bg-muted rounded-full">
                         R$ {formatDeliveryValue(d)}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-border bg-muted/20 text-center">
            <Link to="/admin/deliveries">
              <Button variant="link" className="text-xs h-auto p-0 font-bold">Ver todos os pedidos</Button>
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
