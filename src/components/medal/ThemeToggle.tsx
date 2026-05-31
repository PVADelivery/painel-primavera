import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label="Alternar tema"
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-foreground transition-all hover:scale-105 hover:bg-accent hover:text-accent-foreground"
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
