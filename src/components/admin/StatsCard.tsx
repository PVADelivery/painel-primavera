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
  const iconMap = {
    primary: "bg-primary/15 text-primary ring-1 ring-primary/20",
    accent: "bg-accent/15 text-accent-foreground ring-1 ring-accent/30",
    success: "bg-success/15 text-success ring-1 ring-success/20",
    warning: "bg-warning/15 text-warning ring-1 ring-warning/20",
    info: "bg-info/15 text-info ring-1 ring-info/20",
  };
  const glowMap = {
    primary: "before:bg-primary/20",
    accent: "before:bg-accent/20",
    success: "before:bg-success/20",
    warning: "before:bg-warning/20",
    info: "before:bg-info/20",
  };
  return (
    <Card
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden p-5 transition-all duration-300 shadow-card border border-border/60",
        "before:absolute before:-right-12 before:-top-12 before:h-32 before:w-32 before:rounded-full before:blur-3xl before:opacity-40 before:transition-opacity",
        glowMap[color],
        onClick && "cursor-pointer hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] hover:border-primary/30 before:hover:opacity-70"
      )}
    >
      <div className="relative flex items-start justify-between">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110", iconMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
        {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />}
      </div>
      <p className="relative mt-5 text-3xl font-extrabold tracking-tight tabular-nums">{value}</p>
      <p className="relative mt-0.5 text-sm font-medium text-muted-foreground">{title}</p>
      {sub && <p className="relative mt-1 text-xs text-muted-foreground/80">{sub}</p>}
    </Card>
  );
}
