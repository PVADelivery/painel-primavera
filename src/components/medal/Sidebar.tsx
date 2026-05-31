import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Film, FolderOpen, Gamepad2, Diamond, UserPlus, Smartphone, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import icon from "@/assets/primavera-icon.png";

const items = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/clips", label: "Clips", icon: Film },
  { to: "/app/albums", label: "Álbuns", icon: FolderOpen },
  { to: "/app/games", label: "Jogos", icon: Gamepad2 },
  { to: "/app/discover", label: "Descobrir", icon: Diamond },
  { to: "/app/friends", label: "Amigos", icon: UserPlus },
];

export function MedalSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center justify-between border-r border-sidebar-border bg-sidebar py-3">
      <div className="flex flex-col items-center gap-1">
        <Link to="/app" className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-black overflow-hidden">
          <img src={icon} alt="Primavera Delivery" className="h-10 w-10 object-contain" />
        </Link>
        {items.map((it) => {
          const active = it.exact ? path === it.to : path.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              title={it.label}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <div className="flex flex-col items-center text-[10px] leading-tight">
          <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30" />
          <span className="mt-1 font-semibold">0 Bytes</span>
          <span>Sem Limite</span>
        </div>
        <button title="Mobile" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-sidebar-accent hover:text-foreground">
          <Smartphone className="h-5 w-5" />
        </button>
        <button title="Ajuda" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-sidebar-accent hover:text-foreground">
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}
