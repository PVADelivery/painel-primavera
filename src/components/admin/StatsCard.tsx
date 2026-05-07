import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronRight, type LucideIcon } from "lucide-react";

export function StatsCard({
  title, value, sub, icon: Icon, color = "primary", onClick,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  color?: "primary" | "accent" | "success" | "warning" | "info";
  onClick?: () => void;
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    info: "bg-info/10 text-info",
  };
  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-5 transition-all shadow-card",
        onClick && "cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5"
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", colorMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
        {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground">{title}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}
