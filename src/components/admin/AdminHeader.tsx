import { Bell, Search } from "lucide-react";
import { NotificationsPopover } from "./NotificationsPopover";
import { GlobalSearch } from "./GlobalSearch";
import { ThemeToggle } from "../shared/ThemeToggle";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
}

export function AdminHeader({ title, subtitle }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <GlobalSearch />
          <ThemeToggle />
          <NotificationsPopover />
        </div>
      </div>
    </header>
  );
}
