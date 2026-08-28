// @ts-nocheck
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Bell, Check, Trash2, Wallet, Truck, ShoppingBag, Car, MessageSquare,
  Sparkles, ArrowRight, CheckCircle2, Clock, Building2, User
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCreditPurchaseRequestsAdmin } from "@/services/companyCredits";
import { useDeliveries } from "@/services/deliveries";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function NotificationsPopover() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "credits" | "deliveries" | "orders">("all");
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("admin_read_notifications");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const prevTotalRef = useRef<number>(0);

  // 1. Busca solicitações pendentes de crédito de lojas
  const { data: creditRequests = [] } = useCreditPurchaseRequestsAdmin();
  const pendingCredits = useMemo(
    () => creditRequests.filter((r) => r.status === "pending"),
    [creditRequests]
  );

  // 2. Busca entregas/corridas pendentes
  const { data: deliveriesData } = useDeliveries({ pageSize: 30 });
  const deliveries = Array.isArray(deliveriesData?.data) ? deliveriesData.data : [];
  const pendingDeliveries = useMemo(
    () => deliveries.filter((d) => d.status === "pending"),
    [deliveries]
  );

  // 3. Busca vendas de lojas recentes / pedidos pendentes
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data } = await supabase
          .from("orders")
          .select("id, customer_name, total, status, created_at, company_id")
          .in("status", ["pending", "confirmed"])
          .order("created_at", { ascending: false })
          .limit(20);
        if (data) setPendingOrders(data);
      } catch {}
    };
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  // 4. Busca corridas de passageiros pendentes
  const [pendingRides, setPendingRides] = useState<any[]>([]);
  useEffect(() => {
    const fetchRides = async () => {
      try {
        const { data } = await supabase
          .from("ride_requests")
          .select("id, customer_name, pickup_address, dropoff_address, price, status, created_at")
          .in("status", ["pending", "searching"])
          .order("created_at", { ascending: false })
          .limit(20);
        if (data) setPendingRides(data);
      } catch {}
    };
    fetchRides();
    const interval = setInterval(fetchRides, 15000);
    return () => clearInterval(interval);
  }, []);

  // Lista consolidada de todas as notificações do sistema
  const allNotifications = useMemo(() => {
    const list: any[] = [];

    // Notificações de Solicitações de Crédito de Lojas (Prioridade Alta)
    pendingCredits.forEach((c) => {
      const compName = c.companies?.name || "Loja do Sistema";
      list.push({
        id: `credit-${c.id}`,
        rawId: c.id,
        category: "credits",
        type: "credit_request",
        title: `🏪 Solicitação de Crédito (${compName})`,
        message: `${compName} solicitou recarga de ${brl(c.amount)}${c.notes ? ` ("${c.notes}")` : ""}`,
        actionLabel: "Aprovar na Aba Créditos",
        link: "/admin/reports?tab=creditos",
        time: c.created_at,
        isUrgent: true,
        icon: Wallet,
        iconBg: "bg-amber-500 text-black",
      });
    });

    // Notificações de Corridas & Entregas Pendentes
    pendingDeliveries.forEach((d) => {
      const compName = d.companies?.name || "Empresa";
      list.push({
        id: `delivery-${d.id}`,
        rawId: d.id,
        category: "deliveries",
        type: "delivery_pending",
        title: `🛵 Nova Entrega Solicitada`,
        message: `${compName} → Cliente: ${d.customer_name || "Cliente"} (${brl(d.fee || d.value || 0)})`,
        actionLabel: "Ver no Painel de Corridas",
        link: "/admin/deliveries",
        time: d.created_at,
        isUrgent: false,
        icon: Truck,
        iconBg: "bg-primary text-black",
      });
    });

    // Notificações de Vendas de Lojas (Marketplace)
    pendingOrders.forEach((o) => {
      list.push({
        id: `order-${o.id}`,
        rawId: o.id,
        category: "orders",
        type: "store_order",
        title: `🛍️ Novo Pedido no Marketplace`,
        message: `Cliente: ${o.customer_name || "Cliente"} • Total: ${brl(o.total || 0)}`,
        actionLabel: "Ver Vendas de Lojas",
        link: "/admin/store-sales",
        time: o.created_at,
        isUrgent: false,
        icon: ShoppingBag,
        iconBg: "bg-emerald-500 text-white",
      });
    });

    // Notificações de Corridas Táxi / Moto
    pendingRides.forEach((r) => {
      list.push({
        id: `ride-${r.id}`,
        rawId: r.id,
        category: "deliveries",
        type: "ride_request",
        title: `🚕 Nova Corrida Táxi / Moto`,
        message: `Passageiro: ${r.customer_name || "Passageiro"} • Destino: ${r.dropoff_address || r.pickup_address || "Destino"}`,
        actionLabel: "Ver Táxi & Moto",
        link: "/admin/rides",
        time: r.created_at,
        isUrgent: false,
        icon: Car,
        iconBg: "bg-yellow-500 text-black",
      });
    });

    return list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [pendingCredits, pendingDeliveries, pendingOrders, pendingRides]);

  // Contagem de não lidos
  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => !readIds.has(n.id)).length;
  }, [allNotifications, readIds]);

  // Som de Notificação ao entrar novas notificações
  useEffect(() => {
    const total = allNotifications.length;
    if (total > prevTotalRef.current && prevTotalRef.current > 0) {
      try {
        const audio = new Audio(NOTIFICATION_SOUND);
        audio.volume = 0.6;
        audio.play().catch(() => {});
      } catch {}
    }
    prevTotalRef.current = total;
  }, [allNotifications]);

  // Realtime Postgres Changes
  useEffect(() => {
    const channel = supabase
      .channel("admin-global-notifications-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "credit_purchase_requests" }, () => {
        try {
          new Audio(NOTIFICATION_SOUND).play().catch(() => {});
        } catch {}
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "deliveries" }, () => {
        try {
          new Audio(NOTIFICATION_SOUND).play().catch(() => {});
        } catch {}
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Lista filtrada para exibição
  const filteredNotifications = useMemo(() => {
    if (activeFilter === "all") return allNotifications;
    return allNotifications.filter((n) => n.category === activeFilter);
  }, [allNotifications, activeFilter]);

  // Marcar todas como lidas
  const markAllAsRead = () => {
    const newSet = new Set(allNotifications.map((n) => n.id));
    setReadIds(newSet);
    try {
      localStorage.setItem("admin_read_notifications", JSON.stringify(Array.from(newSet)));
    } catch {}
  };

  // Navega para a aba correta e fecha o popover
  const handleNavigate = (link: string, notifId: string) => {
    const nextSet = new Set(readIds);
    nextSet.add(notifId);
    setReadIds(nextSet);
    try {
      localStorage.setItem("admin_read_notifications", JSON.stringify(Array.from(nextSet)));
    } catch {}

    setIsOpen(false);
    
    // Se for link com query param (ex: /admin/reports?tab=creditos)
    if (link.includes("?")) {
      const [path, query] = link.split("?");
      window.location.href = link;
    } else {
      navigate({ to: link as any });
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Central de Notificações"
          className="relative p-2.5 rounded-2xl bg-card hover:bg-muted transition-all border border-border outline-none group cursor-pointer shadow-sm"
        >
          <Bell className={cn(
            "h-5 w-5 transition-transform group-hover:scale-110",
            unreadCount > 0 ? "text-amber-500 fill-amber-500/20" : "text-muted-foreground group-hover:text-foreground"
          )} />
          
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 text-black text-[11px] font-black px-1 shadow-md border-2 border-card animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[380px] sm:w-[440px] p-0 mr-4 mt-2 border-2 border-border shadow-2xl rounded-3xl overflow-hidden bg-card"
        align="end"
      >
        {/* HEADER DA CENTRAL DE NOTIFICAÇÕES */}
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> Central de Notificações
              </h3>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black px-2 py-0.5 rounded-full border border-amber-500/30">
                  {unreadCount} novas
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
              Central de alertas de créditos, corridas e pedidos
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-[11px] font-bold text-primary hover:underline"
            >
              Marcar lidas
            </button>
          )}
        </div>

        {/* FILTROS POR CATEGORIA */}
        <div className="flex items-center gap-1 p-2 border-b bg-muted/10 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={cn(
              "px-3 py-1 text-xs font-bold rounded-xl transition-all shrink-0",
              activeFilter === "all" ? "bg-primary text-black font-black" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Todas ({allNotifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("credits")}
            className={cn(
              "px-3 py-1 text-xs font-bold rounded-xl transition-all shrink-0 flex items-center gap-1",
              activeFilter === "credits" ? "bg-amber-500 text-black font-black" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Wallet className="w-3 h-3" /> Créditos Lojas ({pendingCredits.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("deliveries")}
            className={cn(
              "px-3 py-1 text-xs font-bold rounded-xl transition-all shrink-0 flex items-center gap-1",
              activeFilter === "deliveries" ? "bg-primary text-black font-black" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Truck className="w-3 h-3" /> Corridas ({pendingDeliveries.length + pendingRides.length})
          </button>
        </div>

        {/* LISTA DE NOTIFICAÇÕES */}
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border p-1 space-y-1">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-bold text-foreground">Tudo em dia!</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Nenhuma solicitação ou corrida pendente aguardando ação no momento.
              </p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const Icon = n.icon;
              const isUnread = !readIds.has(n.id);
              return (
                <div
                  key={n.id}
                  onClick={() => handleNavigate(n.link, n.id)}
                  className={cn(
                    "p-3 rounded-2xl transition-all cursor-pointer flex items-start gap-3 hover:bg-muted/60 border border-transparent",
                    isUnread ? "bg-primary/5 border-primary/20 hover:border-primary/40" : "hover:border-border",
                    n.isUrgent && "bg-amber-500/10 border-amber-500/30"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black shadow-sm", n.iconBg)}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-black text-xs text-foreground truncate leading-tight">
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" />
                        {n.time ? format(new Date(n.time), "HH:mm", { locale: ptBR }) : ""}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground mt-1 leading-snug">
                      {n.message}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/40">
                      <span className="text-[11px] font-black text-primary flex items-center gap-1 hover:underline">
                        {n.actionLabel} <ArrowRight className="w-3 h-3" />
                      </span>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RODAPÉ DA CENTRAL */}
        <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => handleNavigate("/admin/reports?tab=creditos", "all")}
            className="font-bold text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1"
          >
            <Wallet className="w-3.5 h-3.5 text-amber-500" /> Ver Créditos de Lojas
          </button>
          <button
            type="button"
            onClick={() => handleNavigate("/admin/deliveries", "all")}
            className="font-bold text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1"
          >
            <Truck className="w-3.5 h-3.5 text-primary" /> Painel de Corridas
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
