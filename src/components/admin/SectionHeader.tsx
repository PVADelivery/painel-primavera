import React from "react";
import { cn } from "@/lib/utils";

export type SectionTone = "primary" | "info" | "warning" | "accent" | "success";

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tone: SectionTone;
  compact?: boolean;
  action?: { label: string; onClick: () => void };
  rightSlot?: React.ReactNode;
}

/**
 * Cabeçalho unificado para todos os cards do painel inferior do Dashboard.
 * Garante a mesma altura, tipografia e espaçamento entre Frota, Empresas, Cidades e Atividade.
 */
export function SectionHeader({
  icon,
  title,
  subtitle,
  tone,
  compact = false,
  action,
  rightSlot,
}: SectionHeaderProps) {
  const toneStyles: Record<SectionTone, string> = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
    accent: "bg-accent text-accent-foreground",
    success: "bg-success/10 text-success",
  };
  const actionStyles: Record<SectionTone, string> = {
    primary: "text-primary bg-primary/10 hover:bg-primary/20 focus-visible:ring-primary/40",
    info: "text-info bg-info/10 hover:bg-info/20 focus-visible:ring-info/40",
    warning: "text-warning bg-warning/10 hover:bg-warning/20 focus-visible:ring-warning/40",
    accent: "text-accent-foreground bg-accent hover:bg-accent/80 focus-visible:ring-accent/40",
    success: "text-success bg-success/10 hover:bg-success/20 focus-visible:ring-success/40",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-border/30 bg-muted/10 shrink-0",
        compact ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={cn(
            "rounded-xl flex items-center justify-center shrink-0",
            compact ? "w-7 h-7" : "w-8 h-8",
            toneStyles[tone],
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground leading-tight truncate tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {rightSlot}
        {action && (
          <button
            onClick={action.onClick}
            className={cn(
              "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider transition-all shrink-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-95",
              actionStyles[tone],
            )}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  cta?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * Empty state harmonioso e padronizado para todos os cards.
 * Mantém altura mínima preservando a grade equilibrada.
 */
export function EmptyState({ icon, title, subtitle, cta, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full min-h-[180px] py-8 px-6 text-center",
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-3 border border-dashed border-border/60 text-muted-foreground/40">
        {icon}
      </div>
      <p className="text-sm font-bold text-foreground">{title}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{subtitle}</p>
      )}
      {cta && (
        <button
          onClick={cta.onClick}
          className="mt-3 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95"
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}

export type StatusBadgeVariant = "online" | "offline" | "count" | "currency" | "neutral";

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label?: string;
  value?: string | number;
  title?: string;
  className?: string;
}

/**
 * Badge padronizado para indicadores (Online/Offline, contagens, valores monetários).
 */
export function StatusBadge({ variant, label, value, title, className }: StatusBadgeProps) {
  const styles: Record<StatusBadgeVariant, string> = {
    online: "bg-success/15 text-success",
    offline: "bg-muted text-muted-foreground",
    count: "bg-info/10 text-info",
    currency: "bg-success/10 text-success",
    neutral: "bg-muted text-muted-foreground",
  };
  const dot: Partial<Record<StatusBadgeVariant, string>> = {
    online: "bg-success",
    offline: "bg-muted-foreground/40",
  };

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums tracking-wide",
        styles[variant],
        className,
      )}
    >
      {dot[variant] && <span className={cn("h-1.5 w-1.5 rounded-full", dot[variant])} />}
      {label && <span className="uppercase">{label}</span>}
      {value !== undefined && <span>{value}</span>}
    </span>
  );
}
