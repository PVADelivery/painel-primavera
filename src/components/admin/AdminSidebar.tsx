import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Truck, MessageSquare, Building2, Bike,
  MapPin, DollarSign, LogOut, Menu, X, User as UserIcon
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import icon from "@/assets/primavera-icon.png";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const items: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/deliveries", label: "Corridas", icon: Truck },
  { to: "/admin/chat", label: "Chat", icon: MessageSquare },
  { to: "/admin/companies", label: "Empresas", icon: Building2 },
  { to: "/admin/drivers", label: "Entregadores", icon: Bike },
  { to: "/admin/regions", label: "Regiões", icon: MapPin },
  { to: "/admin/reports", label: "Financeiro", icon: DollarSign },
];

export function AdminSidebar() {
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const SidebarContent = (
    <>
      <div className="flex h-20 items-center gap-3 border-b border-sidebar-border/60 px-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-md" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-amber-500 shadow-lg shadow-primary/30 ring-1 ring-primary/40">
            <img src={icon} alt="Primavera Delivery" className="h-10 w-10 object-contain drop-shadow" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold leading-tight tracking-tight">Primavera Delivery</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground leading-tight">Painel Admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Operação</p>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to, item.exact);
          return (
            <Link
              key={item.to}
              to={item.to as "/admin"}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-gradient-to-r from-primary/20 to-primary/5 text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-foreground hover:translate-x-0.5"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
              )}
              <Icon className={cn("h-[18px] w-[18px] transition-colors", active && "text-primary")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border/60 p-3">
        <Link to="/admin/profile" className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-sidebar-accent/70">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-amber-500 text-sm font-bold text-primary-foreground ring-2 ring-background">
            {(profile?.full_name || "A").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold">{profile?.full_name || "Admin"}</p>
            <p className="text-[11px] text-muted-foreground">Administrador</p>
          </div>
          <UserIcon className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Button variant="ghost" size="sm" onClick={signOut} className="mt-1 w-full justify-start text-muted-foreground hover:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/90 backdrop-blur shadow-card md:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-sidebar shadow-2xl animate-[slide-in_0.25s_ease-out]">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 hover:bg-muted"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-64 flex-col border-r border-sidebar-border/60 bg-sidebar/95 backdrop-blur-xl fixed left-0 top-0 z-20">
        {SidebarContent}
      </aside>
    </>
  );
}
