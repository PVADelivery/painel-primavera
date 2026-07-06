import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { useDeliveries } from "@/services/deliveries";
import { format } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDeliveryValue } from "@/lib/delivery";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 8;

const statusConfig: Record<string, { icon: string; label: string; colorClass: string; bgClass: string }> = {
  pending: { icon: "📦", label: "Novo pedido", colorClass: "text-warning", bgClass: "bg-warning/10" },
  broadcasted: { icon: "📡", label: "Enviado p/ motoboys", colorClass: "text-info", bgClass: "bg-info/10" },
  accepted: { icon: "✅", label: "Pedido aceito", colorClass: "text-primary", bgClass: "bg-primary/10" },
  collecting: { icon: "🏪", label: "Em coleta", colorClass: "text-accent", bgClass: "bg-accent/10" },
  in_transit: { icon: "🏍️", label: "Em rota", colorClass: "text-violet-500", bgClass: "bg-violet-500/10" },
  delivered: { icon: "🎉", label: "Finalizado", colorClass: "text-success", bgClass: "bg-success/10" },
  completed: { icon: "🎉", label: "Finalizado", colorClass: "text-success", bgClass: "bg-success/10" },
  cancelled: { icon: "❌", label: "Cancelado", colorClass: "text-destructive", bgClass: "bg-destructive/10" },
};

export function NotificationsPanel() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useDeliveries({ pageSize: PAGE_SIZE, page });
  const deliveries = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground leading-tight">Atividade Recente</h3>
            <p className="text-[11px] text-muted-foreground">{totalCount} registros hoje</p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 relative">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="w-3/4 h-3 rounded" />
                  <Skeleton className="w-1/2 h-2.5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : deliveries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center py-8">
            <Bell className="h-8 w-8 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Sem atividade no momento</p>
          </div>
        ) : (
          <div className="py-2">
            {/* Timeline Line */}
            <div className="absolute left-[34px] top-6 bottom-6 w-[1.5px] bg-border/40" />

            {deliveries.map((d) => {
              const config = statusConfig[d.status] || { icon: "📦", label: d.status, colorClass: "text-muted-foreground", bgClass: "bg-muted" };
              const companyName = d.companies?.name || "Loja";

              return (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate({ to: "/admin/deliveries" })}
                  className={cn(
                    "relative flex items-start gap-4 px-5 py-3.5 cursor-pointer group transition-all",
                    "hover:bg-muted/30 active:scale-[0.995]",
                    "focus-visible:outline-none focus-visible:bg-muted/40",
                  )}
                >
                  <div className={cn(
                    "relative z-10 w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm shadow-sm transition-transform group-hover:scale-110",
                    config.bgClass
                  )}>
                    {config.icon}
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className={cn("text-xs font-bold truncate transition-colors group-hover:text-primary", config.colorClass)}>
                        {config.label}
                      </p>
                      <span className="text-[10px] font-medium text-muted-foreground/70 tabular-nums shrink-0">
                        {d.updated_at ? format(new Date(d.updated_at), "HH:mm") : "—"}
                      </span>
                    </div>

                    <p className="text-[11px] text-foreground font-medium truncate mb-1">
                      {companyName} <span className="text-muted-foreground/60 mx-1">→</span> {d.customer_name || "Cliente"}
                    </p>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-success tabular-nums bg-success/5 px-1.5 py-0.5 rounded border border-success/10">
                        R$ {formatDeliveryValue(d)}
                      </span>
                      {d.driver_id && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                          Motoboy atribuído
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="border-t border-border/30 px-4 py-3 flex items-center justify-between bg-muted/5 shrink-0">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              page === 0 ? "text-muted-foreground/30" : "text-foreground hover:bg-muted"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
            Página {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
            disabled={page + 1 >= totalPages}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              page + 1 >= totalPages ? "text-muted-foreground/30" : "text-foreground hover:bg-muted"
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
