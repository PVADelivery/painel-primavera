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
    maxClicksPerSecond = 8,
    maxRouteChangesPerMinute = 20,
    maxErrorsPerMinute = 10,
    enableInjectionDetection = true,
    enableScrapingDetection = true,
  } = config;

  const clicksRef = useRef<number[]>([]);
  const routeChangesRef = useRef<number[]>([]);
  const errorsRef = useRef<number[]>([]);
  const copyRef = useRef<number[]>([]);
  const isReportingRef = useRef(false);

  const reportAttack = useCallback(async (reason: string, details: Record<string, unknown>) => {
    if (isReportingRef.current) return;
    isReportingRef.current = true;

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
    } finally {
      // Cooldown de 10 segundos para não flodar o Telegram com o mesmo ataque
      setTimeout(() => {
        isReportingRef.current = false;
      }, 10000);
    }
  }, []);

  // Monitorar Cliques (Rage Clicks / Bot Clicks)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const now = Date.now();
      clicksRef.current = clicksRef.current.filter(t => now - t < 1000); // Manter cliques do último 1 segundo
      clicksRef.current.push(now);

      if (clicksRef.current.length >= maxClicksPerSecond) {
        // Possível Bot ou Autoclicker
        reportAttack("Rage Clicks / Autoclicker Detectado", {
          clicksInLastSecond: clicksRef.current.length,
          target: (e.target as HTMLElement)?.tagName || "Unknown",
          x: e.clientX,
          y: e.clientY
        });
        clicksRef.current = []; // Limpar para não acionar múltiplas vezes imediatamente
      }
    };

    window.addEventListener("click", handleClick, true);
    return () => window.removeEventListener("click", handleClick, true);
  }, [maxClicksPerSecond, reportAttack]);

  // Monitorar Erros (Interceptar chamadas de API falhas em excesso)
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async function (...args) {
      try {
        const response = await originalFetch.apply(this, args);
        if (!response.ok && response.status >= 400 && response.status !== 401 && response.status !== 404) {
          const now = Date.now();
          errorsRef.current = errorsRef.current.filter(t => now - t < 60000); // Último 1 minuto
          errorsRef.current.push(now);

          if (errorsRef.current.length >= maxErrorsPerMinute) {
            reportAttack("Múltiplos Erros de API Detectados", {
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

  // Monitorar XSS / SQLi via Inputs
  useEffect(() => {
    if (!enableInjectionDetection) return;

    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!target || typeof target.value !== 'string') return;

      const value = target.value;
      const suspiciousPattern = /(<script.*?>.*?<\/script>|javascript:|UNION\s+SELECT|DROP\s+TABLE|INSERT\s+INTO|DELETE\s+FROM)/i;
      
      if (suspiciousPattern.test(value)) {
        reportAttack("Tentativa de Injeção de Código (XSS/SQLi)", {
          target: target.name || target.id || target.tagName,
          payload: value
        });
      }
    };

    document.addEventListener('change', handleInput, true);
    return () => document.removeEventListener('change', handleInput, true);
  }, [enableInjectionDetection, reportAttack]);

  // Monitorar Scraping (Cópia excessiva)
  useEffect(() => {
    if (!enableScrapingDetection) return;

    const handleCopy = () => {
      const selection = window.getSelection()?.toString() || "";
      if (selection.length > 500) {
        const now = Date.now();
        copyRef.current = copyRef.current.filter(t => now - t < 60000);
        copyRef.current.push(now);

        if (copyRef.current.length >= 3) {
          reportAttack("Possível Scraping de Dados Detectado (Cópia em Massa)", {
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

  // Monitorar Bots de Navegação (Route Changes Rápidas)
  useEffect(() => {
    const handleRouteChange = () => {
      const now = Date.now();
      routeChangesRef.current = routeChangesRef.current.filter(t => now - t < 60000);
      routeChangesRef.current.push(now);

      if (routeChangesRef.current.length >= maxRouteChangesPerMinute) {
        reportAttack("Navegação Anormal / Bot de Varredura", {
          routeChangesInLastMinute: routeChangesRef.current.length,
          lastPath: window.location.pathname
        });
        routeChangesRef.current = [];
      }
    };

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      handleRouteChange();
      return originalPushState.apply(history, args);
    };

    history.replaceState = function (...args) {
      handleRouteChange();
      return originalReplaceState.apply(history, args);
    };

    window.addEventListener('popstate', handleRouteChange);

    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [maxRouteChangesPerMinute, reportAttack]);

  return {
    reportSuspiciousActivity: (reason: string, details: Record<string, unknown> = {}) => reportAttack(reason, details)
  };
}
