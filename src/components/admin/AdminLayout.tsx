import { ReactNode, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AdminSidebar } from "./AdminSidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useRealtimeDeliveries } from "@/hooks/useRealtimeDeliveries";
import { useGlobalChatNotifications } from "@/hooks/useGlobalChatNotifications";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsPopover } from "./NotificationsPopover";
import { GlobalSearch } from "./GlobalSearch";
import { ThemeToggle } from "../shared/ThemeToggle";

export function AdminLayout({ children }: { children: ReactNode }) {
  useRealtimeDeliveries();
  useGlobalChatNotifications();

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCollapsed(localStorage.getItem("admin_sidebar_collapsed") === "true");
    }
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("admin_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="relative min-h-screen bg-background">
        {/* Ambient background */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -top-40 left-1/3 h-[480px] w-[480px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-accent/10 blur-[140px]" />
        </div>

        <AdminSidebar collapsed={collapsed} onToggle={toggleSidebar} />

        <main className={`${collapsed ? "md:ml-16" : "md:ml-64"} transition-all duration-300 min-h-screen flex flex-col`}>
          {/* TOPBAR GLOBAL DO PAINEL ADMIN COM CENTRAL DE NOTIFICAÇÕES */}
          <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 pl-12 md:pl-0">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground hidden sm:inline">
                AO VIVO
              </span>
              <span className="text-xs text-muted-foreground font-medium hidden lg:inline">
                • {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <GlobalSearch />
              <NotificationsPopover />
              <ThemeToggle />
            </div>
          </header>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 mx-auto max-w-[1600px] w-full p-3 md:p-6"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
