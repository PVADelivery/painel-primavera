import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const map: Record<string, { label: string; cls: string }> = {
  pending:     { label: "Pendente",   cls: "bg-warning/15 text-warning border-warning/30" },
  broadcasted: { label: "Enviada",    cls: "bg-info/15 text-info border-info/30" },
  accepted:    { label: "Aceita",     cls: "bg-primary/15 text-primary border-primary/30" },
  collecting:  { label: "Em Coleta",  cls: "bg-accent/15 text-accent border-accent/30" },
  in_route:  { label: "Em Rota",    cls: "bg-[hsl(280_70%_55%/0.15)] text-[hsl(280_70%_55%)] border-[hsl(280_70%_55%/0.3)]" },
  completed:   { label: "Finalizada", cls: "bg-success/15 text-success border-success/30" },
  cancelled:   { label: "Cancelada",  cls: "bg-destructive/15 text-destructive border-destructive/30" },
  returned:    { label: "Devolvida",  cls: "bg-muted text-muted-foreground border-border" },
};

export function DeliveryStatusBadge({ status }: { status: string }) {
  const item = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={cn("font-medium", item.cls)}>{item.label}</Badge>;
}
