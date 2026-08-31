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
    reportErrorToTelegram({
      error_message: error?.message || "Erro na rota admin",
      stack_trace: error?.stack || "",
      url: typeof window !== "undefined" ? window.location.href : "",
    }, "Painel Administrador");
    return (
      <div className="p-8 text-sm text-destructive">
        <h2 className="font-bold text-base mb-2">Erro de Carregamento</h2>
        <p>{error?.message || "Ocorreu um erro ao carregar a página."}</p>
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
    if (typeof window !== "undefined" && window.location.hostname.includes("lovable.app")) {
      window.location.replace(`https://painel.mt24horasexpress.com${window.location.pathname}${window.location.search}`);
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
