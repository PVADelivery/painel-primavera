import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Truck, MessageSquare, Building2, Bike,
  MapPin, DollarSign, LogOut, Menu, X, User as UserIcon
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Truck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Rota</p>
          <p className="text-xs text-muted-foreground leading-tight">Admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to, item.exact);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Link to="/admin/profile" className="flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{profile?.full_name || "Admin"}</p>
            <p className="text-xs text-muted-foreground">Administrador</p>
          </div>
        </Link>
        <Button variant="ghost" size="sm" onClick={signOut} className="mt-2 w-full justify-start text-muted-foreground">
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
        className="fixed left-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-card shadow-card md:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-sidebar shadow-xl animate-[slide-in_0.25s_ease-out]">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded p-1 hover:bg-muted"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar fixed left-0 top-0">
        {SidebarContent}
      </aside>
    </>
  );
}
