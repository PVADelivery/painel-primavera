import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AttackMonitorConfig {
  maxClicksPerSecond?: number;
  maxRouteChangesPerMinute?: number;
  maxErrorsPerMinute?: number;
  enableInjectionDetection?: boolean;
  enableScrapingDetection?: boolean;
}

export function useAttackMonitor(config: AttackMonitorConfig = {}) {
  const {
    maxClicksPerSecond = 35,
    maxRouteChangesPerMinute = 60,
    maxErrorsPerMinute = 15,
    enableInjectionDetection = true,
    enableScrapingDetection = true,
  } = config;

  const clicksRef = useRef<number[]>([]);
  const untrustedClicksRef = useRef<number[]>([]);
  const routeChangesRef = useRef<number[]>([]);
  const lastPathRef = useRef<string>(typeof window !== "undefined" ? window.location.pathname : "");
  const errorsRef = useRef<number[]>([]);
  const copyRef = useRef<number[]>([]);
  const lastReportedTimeRef = useRef<Record<string, number>>({});

  const reportAttack = useCallback(async (type: string, reason: string, details: Record<string, unknown>) => {
    const now = Date.now();
    const last = lastReportedTimeRef.current[type] || 0;
    // Cooldown de 90 segundos por categoria para não flodar o Telegram
    if (now - last < 90000) return;
    lastReportedTimeRef.current[type] = now;

    try {
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      
      const requestBody = {
        app_name: "Express Lane Nexus (Frontend)",
        error_message: `[ATAQUE DETECTADO] ${reason}`,
        stack_trace: "",
        user_id: user?.id || "Não autenticado",
        user_email: user?.email || "Anônimo",
        url: window.location.href,
        is_attack: true,
        additional_info: {
          userAgent: navigator.userAgent,
          screenResolution: `${window.innerWidth}x${window.innerHeight}`,
          time: new Date().toISOString(),
          ...details
        }
      };

      await supabase.functions.invoke("telegram-logger", {
        body: requestBody
      });
      
      console.warn("🚨 Atividade suspeita reportada com sucesso.");
    } catch (err) {
      console.error("Falha ao reportar ataque:", err);
    }
  }, []);

  // 1. Monitorar Cliques (Autoclicker / Scripts Injetores)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleClick = (e: MouseEvent) => {
      const now = Date.now();

      // Caso 1: Cliques sintéticos / não confiáveis
      if (e.isTrusted === false) {
        untrustedClicksRef.current = untrustedClicksRef.current.filter((t) => now - t < 1000);
        untrustedClicksRef.current.push(now);

        if (untrustedClicksRef.current.length >= 10) {
          reportAttack("untrusted_clicks", "Script Injetor / Autoclicker Detectado (Cliques Sintéticos)", {
            clicksInLastSecond: untrustedClicksRef.current.length,
            target: (e.target as HTMLElement)?.tagName || "Unknown",
            className: (e.target as HTMLElement)?.className?.toString()?.slice(0, 80) || "",
            isTrusted: false,
          });
          untrustedClicksRef.current = [];
        }
        return;
      }

      // Caso 2: Cliques confiáveis de hardware
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase() || "";
      const isContainer = (tag === "DIV" || tag === "MAIN" || tag === "BODY" || tag === "HTML") && !target?.onclick && !target?.getAttribute("role");
      const threshold = isContainer ? maxClicksPerSecond * 1.5 : maxClicksPerSecond;

      clicksRef.current = clicksRef.current.filter(t => now - t < 1000);
      clicksRef.current.push(now);

      if (clicksRef.current.length >= threshold) {
        reportAttack("clicks", "Flood Extremo de Cliques / Autoclicker Detectado", {
          clicksInLastSecond: clicksRef.current.length,
          target: tag || "Unknown",
          className: target?.className?.toString()?.slice(0, 80) || "",
          x: e.clientX,
          y: e.clientY
        });
        clicksRef.current = [];
      }
    };

    window.addEventListener("click", handleClick, true);
    return () => window.removeEventListener("click", handleClick, true);
  }, [maxClicksPerSecond, reportAttack]);

  // 2. Monitorar Erros (Interceptar chamadas de API falhas em excesso)
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async function (...args) {
      try {
        const response = await originalFetch.apply(this, args);
        if (!response.ok && response.status >= 400 && response.status !== 401 && response.status !== 404) {
          const now = Date.now();
          errorsRef.current = errorsRef.current.filter(t => now - t < 60000);
          errorsRef.current.push(now);

          if (errorsRef.current.length >= maxErrorsPerMinute) {
            reportAttack("api_errors", "Múltiplos Erros Críticos de API Detectados", {
              errorsInLastMinute: errorsRef.current.length,
              lastUrl: typeof args[0] === 'string' ? args[0] : (args[0] as Request).url,
              status: response.status
            });
            errorsRef.current = [];
          }
        }
        return response;
      } catch (error) {
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [maxErrorsPerMinute, reportAttack]);

  // 3. Monitorar XSS / SQLi via Inputs
  useEffect(() => {
    if (!enableInjectionDetection) return;

    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!target || typeof target.value !== 'string') return;

      const value = target.value;
      const suspiciousPattern = /(<script.*?>.*?<\/script>|javascript:|UNION\s+SELECT|DROP\s+TABLE|INSERT\s+INTO|DELETE\s+FROM)/i;
      
      if (suspiciousPattern.test(value)) {
        reportAttack("injection", "Tentativa de Injeção de Código (XSS/SQLi)", {
          target: target.name || target.id || target.tagName,
          payload: value.slice(0, 100)
        });
      }
    };

    document.addEventListener('change', handleInput, true);
    return () => document.removeEventListener('change', handleInput, true);
  }, [enableInjectionDetection, reportAttack]);

  // 4. Monitorar Scraping (Cópia excessiva)
  useEffect(() => {
    if (!enableScrapingDetection) return;

    const handleCopy = () => {
      const selection = window.getSelection()?.toString() || "";
      if (selection.length > 1500) {
        const now = Date.now();
        copyRef.current = copyRef.current.filter(t => now - t < 60000);
        copyRef.current.push(now);

        if (copyRef.current.length >= 5) {
          reportAttack("scraping", "Possível Scraping de Dados Detectado (Cópia em Massa)", {
            copiesInLastMinute: copyRef.current.length,
            lastCopiedLength: selection.length
          });
          copyRef.current = [];
        }
      }
    };

    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [enableScrapingDetection, reportAttack]);

  // 5. Monitorar Bots de Navegação (Route Changes Rápidas de Rotas Distintas)
  useEffect(() => {
    if (typeof window === "undefined" || !history) return;

    const checkDistinctRouteChange = () => {
      const currentPath = window.location.pathname;
      if (currentPath === lastPathRef.current) return;
      lastPathRef.current = currentPath;

      const now = Date.now();
      routeChangesRef.current = routeChangesRef.current.filter(t => now - t < 60000);
      routeChangesRef.current.push(now);

      if (routeChangesRef.current.length >= maxRouteChangesPerMinute) {
        reportAttack("routes", "Navegação Anormal / Bot de Varredura", {
          routeChangesInLastMinute: routeChangesRef.current.length,
          lastPath: currentPath
        });
        routeChangesRef.current = [];
      }
    };

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const res = originalPushState.apply(history, args);
      checkDistinctRouteChange();
      return res;
    };

    history.replaceState = function (...args) {
      const res = originalReplaceState.apply(history, args);
      checkDistinctRouteChange();
      return res;
    };

    window.addEventListener('popstate', checkDistinctRouteChange);

    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', checkDistinctRouteChange);
    };
  }, [maxRouteChangesPerMinute, reportAttack]);

  return {
    reportSuspiciousActivity: (reason: string, details: Record<string, unknown> = {}) =>
      reportAttack("custom", reason, details)
  };
}
