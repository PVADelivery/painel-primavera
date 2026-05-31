import { Search, Gem, MessageSquare, Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import { ThemeToggle } from "./ThemeToggle";
import logo from "@/assets/primavera-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MedalTopbar() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  const { data: unread = 0 } = useQuery({
    queryKey: ["notif-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
    refetchInterval: 15000,
  });

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <div className="flex items-center gap-1">
        <button
          onClick={() => router.history.back()}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => router.history.forward()}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <Link to="/app" className="ml-2 flex items-center">
        <img src={logo} alt="Primavera Delivery" className="h-9 object-contain" />
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <button className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-accent hover:text-accent-foreground">
          <Search className="h-4 w-4" />
        </button>
        <button title="Apoiar" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-accent hover:text-accent-foreground">
          <Gem className="h-4 w-4" />
        </button>
        <Link to="/app/chat" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-accent hover:text-accent-foreground">
          <MessageSquare className="h-4 w-4" />
        </Link>
        <Link to="/app/notifications" className="relative flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-accent hover:text-accent-foreground">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Link>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary hover:bg-primary/30">
              <span className="text-sm font-bold">
                {(profile?.full_name || user?.email || "?").charAt(0).toUpperCase()}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
                {(profile?.full_name || "?").charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{profile?.full_name || user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.navigate({ to: "/app/profile" })}>Perfil</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.navigate({ to: "/app/profile" })}>Configurações</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={async () => {
                await signOut();
                router.navigate({ to: "/login" });
              }}
            >
              Desconectar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
