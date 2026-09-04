import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

import appCss from "../styles.css?url";
import { initializeGlobalErrorHandlers, reportErrorToTelegram } from "@/services/logger";
import { useEffect } from "react";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MT 24horas express — Gestão de Entregas" },
      { name: "description", content: "Plataforma MT 24horas express — gestão de entregas last-mile em tempo real" },
      { property: "og:title", content: "MT 24horas express — Gestão de Entregas" },
      { name: "twitter:title", content: "MT 24horas express — Gestão de Entregas" },
      { property: "og:description", content: "Plataforma MT 24horas express — gestão de entregas last-mile em tempo real" },
      { name: "twitter:description", content: "Plataforma MT 24horas express — gestão de entregas last-mile em tempo real" },
      { property: "og:image", content: "https://painel.mt24horasexpress.com/pwa-512x512-v3.png" },
      { name: "twitter:image", content: "https://painel.mt24horasexpress.com/pwa-512x512-v3.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon-v3.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
      { rel: "stylesheet", href: "https://unpkg.com/maplibre-gl@3.x/dist/maplibre-gl.css" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Página não encontrada</p>
        <a href="/" className="mt-6 inline-block text-primary hover:underline">Voltar ao início</a>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => {
    if (typeof window !== "undefined") {
      const msg = (error?.message || "").toLowerCase();
      const stack = (error?.stack || "").toLowerCase();
      const isOutdatedBundle = 
        msg.includes("before initialization") ||
        msg.includes("dynamically imported module") ||
        msg.includes("loading chunk") ||
        stack.includes("before initialization") ||
        stack.includes("reports-bd39l2ds");

      const hasReloaded = sessionStorage.getItem("admin_auto_reloaded_for_update");
      if (isOutdatedBundle && !hasReloaded) {
        sessionStorage.setItem("admin_auto_reloaded_for_update", "true");
        window.location.reload();
        return null;
      }
    }

    reportErrorToTelegram({
      error_message: error?.message || "Erro na rota admin",
      stack_trace: error?.stack || "",
      url: typeof window !== "undefined" ? window.location.href : "",
    }, "Painel Administrador");

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="p-8 max-w-md w-full bg-card border border-border rounded-2xl shadow-xl text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4">
            <svg className="w-7 h-7 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
              <path d="M12 3a9 9 0 0 1 9 9" />
            </svg>
          </div>
          <h2 className="font-bold text-lg text-foreground mb-1">Atualização do Sistema</h2>
          <p className="text-xs text-muted-foreground mb-6">
            Uma nova versão da plataforma foi publicada. Clique abaixo para sincronizar seus recursos agora.
          </p>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("admin_auto_reloaded_for_update");
                window.location.reload();
              }
            }}
            className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl transition shadow-md flex items-center justify-center gap-2"
          >
            🔄 Recarregar Painel
          </button>
        </div>
      </div>
    );
  },
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    initializeGlobalErrorHandlers("Painel Administrador");
    if (typeof window !== "undefined") {
      // Desregistra Service Workers antigos que possam estar servindo arquivos obsoletos em cache
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const reg of regs) {
            reg.unregister();
          }
        }).catch(() => {});
      }

      if (window.location.hostname.includes("lovable.app")) {
        window.location.replace(`https://painel.mt24horasexpress.com${window.location.pathname}${window.location.search}`);
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
