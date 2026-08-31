// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Coins, Clock, CheckCircle2, AlertCircle, FileText, 
  ExternalLink, Search, RefreshCw, Eye, ArrowUpRight, 
  Receipt, Building2, User, ChevronRight, ShieldCheck, 
  DollarSign, Send, Check, Filter, Calendar, Store, ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function CreditPayoutsManager() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState("all");
  const [tab, setTab] = useState<"pending_stores" | "all_orders" | "payout_history">("pending_stores");

  // Estados do Modal de Efetuar Repasse
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [selectedStoreForPayout, setSelectedStoreForPayout] = useState<any | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [pixKeyInput, setPixKeyInput] = useState("");
  const [receiptUrlInput, setReceiptUrlInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [submittingPayout, setSubmittingPayout] = useState(false);

  // Modal de Detalhes do Lote
  const [viewPayoutModal, setViewPayoutModal] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Carregar Empresas
      const { data: companiesData } = await supabase
        .from("companies")
        .select("id, name, phone, pix_key, address")
        .order("name");

      if (companiesData) {
        setCompanies(companiesData);
      }

      // 2. Carregar Pedidos pagos com créditos
      const { data: ordersData, error: ordersErr } = await supabase
        .from("orders")
        .select(`
          id, company_id, total, status, created_at, delivery_fee, 
          payment_method, payout_status, payout_id, payout_at,
          companies (id, name, phone, pix_key),
          customers (name, phone)
        `)
        .eq("payment_method", "credits")
        .order("created_at", { ascending: false });

      if (!ordersErr && ordersData) {
        setOrders(ordersData);
      }

      // 3. Carregar Histórico de Repasses
      try {
        const { data: payoutsData, error: payoutsErr } = await supabase
          .from("merchant_credit_payouts")
          .select(`
            *,
            companies (name, phone)
          `)
          .order("paid_at", { ascending: false });

        if (!payoutsErr && payoutsData) {
          setPayouts(payoutsData);
        }
      } catch (err) {
        console.warn("[CreditPayoutsManager] Tabela merchant_credit_payouts ainda não pronta:", err);
      }
    } catch (e) {
      console.error("[CreditPayoutsManager] Erro ao carregar dados:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Métricas Consolidadas
  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "cancelled");
    const totalCreditSales = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    
    // Pendentes de repasse: payout_status != 'paid'
    const pendingOrders = validOrders.filter((o) => o.payout_status !== "paid");
    const pendingAmount = pendingOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    // Repassados / Pagos
    const paidOrders = validOrders.filter((o) => o.payout_status === "paid");
    const paidAmount = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    // Lojas únicas com pendências
    const pendingStoresCount = new Set(pendingOrders.map((o) => o.company_id)).size;

    return {
      totalCreditSales,
      pendingAmount,
      paidAmount,
      totalCount: validOrders.length,
      pendingCount: pendingOrders.length,
      paidCount: paidOrders.length,
      pendingStoresCount,
    };
  }, [orders]);

  // Agrupamento por Loja com Pedidos Pendentes
  const pendingStores = useMemo(() => {
    const storeMap = new Map<string, { company: any; orders: any[]; total: number }>();

    orders.forEach((o) => {
      if (o.status === "cancelled" || o.payout_status === "paid") return;

      const compId = o.company_id || "unknown";
      if (!storeMap.has(compId)) {
        const comp = companies.find((c) => c.id === compId) || o.companies || { id: compId, name: "Loja Não Identificada" };
        storeMap.set(compId, { company: comp, orders: [], total: 0 });
      }

      const item = storeMap.get(compId)!;
      item.orders.push(o);
      item.total += Number(o.total || 0);
    });

    return Array.from(storeMap.values()).sort((a, b) => b.total - a.total);
  }, [orders, companies]);

  // Filtro de Todos os Pedidos
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (selectedCompanyFilter !== "all" && order.company_id !== selectedCompanyFilter) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const shortId = order.id.slice(0, 8).toLowerCase();
        const storeName = (order.companies?.name || "").toLowerCase();
        const custName = (order.customers?.name || "").toLowerCase();
        return shortId.includes(term) || storeName.includes(term) || custName.includes(term);
      }

      return true;
    });
  }, [orders, selectedCompanyFilter, searchTerm]);

  // Abrir Modal para Efetuar Repasse
  const handleOpenPayoutModal = (storeGroup: { company: any; orders: any[]; total: number }) => {
    setSelectedStoreForPayout(storeGroup);
    setSelectedOrderIds(storeGroup.orders.map((o) => o.id));
    setPixKeyInput(storeGroup.company.pix_key || "");
    setReceiptUrlInput("");
    setNotesInput(`Repasse de vendas em créditos (${storeGroup.orders.length} pedidos) - MT 24 Horas Express`);
    setPayoutModalOpen(true);
  };

  // Calcular valor total do repasse selecionado no modal
  const payoutTotalAmount = useMemo(() => {
    if (!selectedStoreForPayout) return 0;
    return selectedStoreForPayout.orders
      .filter((o: any) => selectedOrderIds.includes(o.id))
      .reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
  }, [selectedStoreForPayout, selectedOrderIds]);

  // Submeter Repasse
  const handleConfirmPayout = async () => {
    if (!selectedStoreForPayout || selectedOrderIds.length === 0) {
      toast({ title: "Erro", description: "Selecione ao menos um pedido para liquidar.", variant: "destructive" });
      return;
    }

    setSubmittingPayout(true);
    try {
      const companyId = selectedStoreForPayout.company.id;
      const amount = payoutTotalAmount;

      // 1. Tentar chamar a RPC segura
      let rpcSuccess = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("process_merchant_credit_payout", {
          p_company_id: companyId,
          p_order_ids: selectedOrderIds,
          p_amount: amount,
          p_pix_key: pixKeyInput.trim() || null,
          p_receipt_url: receiptUrlInput.trim() || null,
          p_notes: notesInput.trim() || null,
        });

        if (!rpcErr && rpcRes && rpcRes.success) {
          rpcSuccess = true;
        }
      } catch {}

      // 2. Fallback caso a RPC ainda não exista no banco
      if (!rpcSuccess) {
        const { data: insertData, error: insErr } = await supabase
          .from("merchant_credit_payouts")
          .insert({
            company_id: companyId,
            amount: amount,
            status: "paid",
            order_ids: selectedOrderIds,
            pix_key: pixKeyInput.trim() || null,
            receipt_url: receiptUrlInput.trim() || null,
            notes: notesInput.trim() || null,
            paid_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insErr) throw insErr;

        // Atualiza pedidos
        await supabase
          .from("orders")
          .update({
            payout_status: "paid",
            payout_id: insertData?.id,
            payout_at: new Date().toISOString(),
          } as any)
          .in("id", selectedOrderIds);
      }

      toast({
        title: "Repasse Efetuado com Sucesso!",
        description: `O repasse de ${fmt(amount)} para ${selectedStoreForPayout.company.name} foi liquidado e registrado.`,
      });

      setPayoutModalOpen(false);
      fetchData();
    } catch (e: any) {
      toast({
        title: "Erro ao processar repasse",
        description: e?.message || "Não foi possível liquidar o repasse. Verifique o banco de dados.",
        variant: "destructive",
      });
    } finally {
      setSubmittingPayout(false);
    }
  };

  const fmt = (val: number) => {
    return Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Ações */}
      <div className="bg-gradient-to-r from-amber-500/15 via-primary/10 to-card border border-amber-500/30 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-inner">
            <Coins className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              Gestão de Repasses: Vendas em Créditos
              <Badge className="bg-amber-500 text-white font-black text-[10px] uppercase">
                Marketplace
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Controle e liquidação dos valores pagos pelos clientes via saldo de créditos para repassar aos lojistas.
            </p>
          </div>
        </div>

        <Button 
          variant="outline" 
          onClick={fetchData} 
          disabled={loading}
          className="rounded-2xl font-bold gap-2 shrink-0 border-border/80 hover:bg-muted shadow-sm"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar Dados
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total em Créditos */}
        <Card className="rounded-3xl border-border/70 shadow-sm relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Vendas em Créditos</CardTitle>
            <Coins className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{fmt(metrics.totalCreditSales)}</div>
            <p className="text-xs font-bold text-muted-foreground mt-1">{metrics.totalCount} pedidos no marketplace</p>
          </CardContent>
        </Card>

        {/* Pendente de Repasse Global */}
        <Card className="rounded-3xl border-amber-500/40 bg-amber-500/[0.03] shadow-sm relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Total Pendente de Repasse</CardTitle>
            <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{fmt(metrics.pendingAmount)}</div>
            <p className="text-xs font-bold text-amber-700/80 dark:text-amber-300 mt-1">
              {metrics.pendingStoresCount} {metrics.pendingStoresCount === 1 ? "loja aguardando repasse" : "lojas aguardando repasse"}
            </p>
          </CardContent>
        </Card>

        {/* Total Já Repassado */}
        <Card className="rounded-3xl border-success/40 bg-success/[0.02] shadow-sm relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-success">Total Já Repassado</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-success">{fmt(metrics.paidAmount)}</div>
            <p className="text-xs font-bold text-muted-foreground mt-1">{metrics.paidCount} pedidos liquidados</p>
          </CardContent>
        </Card>

        {/* Lotes de Repasses Efetuados */}
        <Card className="rounded-3xl border-border/70 shadow-sm relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Lotes Liquidados</CardTitle>
            <Receipt className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{payouts.length} lotes</div>
            <p className="text-xs font-bold text-muted-foreground mt-1">Transferências comprovadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Principais */}
      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList className="bg-muted/60 border border-border/50 rounded-2xl p-1.5 gap-1.5 h-auto flex-wrap">
          <TabsTrigger value="pending_stores" className="rounded-xl text-xs font-black data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Lojas com Repasses Pendentes ({pendingStores.length})
          </TabsTrigger>
          <TabsTrigger value="all_orders" className="rounded-xl text-xs font-black data-[state=active]:shadow-sm">
            <Coins className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
            Todos os Pedidos em Créditos ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="payout_history" className="rounded-xl text-xs font-black data-[state=active]:shadow-sm">
            <Receipt className="h-3.5 w-3.5 mr-1.5 text-primary" />
            Histórico de Repasses Realizados ({payouts.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Lojas com Repasses Pendentes */}
        <TabsContent value="pending_stores" className="mt-4 space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <RefreshCw className="h-7 w-7 animate-spin text-primary" />
              <span className="text-xs font-bold">Carregando repasses pendentes...</span>
            </div>
          ) : pendingStores.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-border/80 bg-muted/10 p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-success/10 text-success flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black text-foreground">Todos os repasses estão em dia!</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Não há nenhuma loja com vendas em créditos pendentes de transferência no momento.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingStores.map((item) => (
                <Card key={item.company.id} className="rounded-3xl border-border/80 shadow-sm hover:border-primary/40 transition-all overflow-hidden flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                          <Store className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-black text-foreground truncate max-w-[180px]">
                            {item.company.name}
                          </CardTitle>
                          <p className="text-[11px] text-muted-foreground">{item.company.phone || "Sem telefone"}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-black shrink-0">
                        {item.orders.length} {item.orders.length === 1 ? "pedido" : "pedidos"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="bg-muted/40 p-3 rounded-2xl space-y-1.5 border border-border/40">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Total a Repassar:</span>
                        <span className="text-base font-black text-amber-600 dark:text-amber-400">{fmt(item.total)}</span>
                      </div>
                      {item.company.pix_key && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground font-medium">Chave Pix:</span>
                          <span className="font-mono font-bold text-foreground truncate max-w-[150px]">{item.company.pix_key}</span>
                        </div>
                      )}
                    </div>

                    <Button 
                      onClick={() => handleOpenPayoutModal(item)}
                      className="w-full rounded-2xl font-black gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                    >
                      <Send className="h-4 w-4" />
                      Efetuar Repasse ({fmt(item.total)})
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Todos os Pedidos em Créditos */}
        <TabsContent value="all_orders" className="mt-4 space-y-4">
          <Card className="rounded-3xl border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-black text-foreground">Extrato de Pedidos em Créditos</CardTitle>
                  <CardDescription className="text-xs">Visualize todas as vendas realizadas com créditos do cliente</CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  {/* Filtro por Empresa */}
                  <select
                    value={selectedCompanyFilter}
                    onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                    className="h-9 px-3 text-xs font-bold rounded-xl border border-border/60 bg-card text-foreground"
                  >
                    <option value="all">Todas as Empresas</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Busca */}
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID (#XXXX), Loja ou Cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 rounded-xl border-border/60 bg-muted/20 text-xs h-9"
                />
              </div>
            </CardHeader>

            <CardContent>
              {filteredOrders.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs font-bold">
                  Nenhum pedido encontrado.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filteredOrders.map((order) => {
                    const isPaid = order.payout_status === "paid";
                    const isCancelled = order.status === "cancelled";

                    return (
                      <div key={order.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 px-2 rounded-xl transition-all">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                            isPaid ? "bg-success/10 text-success" : isCancelled ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                          )}>
                            {isPaid ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Clock className="h-4.5 w-4.5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-foreground">
                                Pedido #{order.id.slice(0, 8).toUpperCase()}
                              </span>
                              <Badge 
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-black uppercase px-2 py-0.5",
                                  isPaid 
                                    ? "bg-success/10 text-success border-success/30" 
                                    : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                )}
                              >
                                {isPaid ? "Repassado" : "Pendente de Repasse"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                              <span className="font-bold text-foreground">{order.companies?.name || "Loja"}</span>
                              <span>•</span>
                              <span>Cliente: {order.customers?.name || "Cliente"}</span>
                              <span>•</span>
                              <span>{format(new Date(order.created_at), "dd/MM/yy HH:mm")}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
                          <span className="text-sm font-black text-foreground">{fmt(order.total)}</span>
                          {isPaid && order.payout_at && (
                            <span className="text-[10px] font-bold text-success">
                              Liquidado em {format(new Date(order.payout_at), "dd/MM/yy")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Histórico de Repasses Realizados */}
        <TabsContent value="payout_history" className="mt-4 space-y-4">
          <Card className="rounded-3xl border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black text-foreground">Lotes de Repasses Liquidados</CardTitle>
              <CardDescription className="text-xs">Registro oficial de todas as transferências efetuadas para os lojistas</CardDescription>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs font-bold">
                  Nenhum repasse registrado ainda.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {payouts.map((payout) => (
                    <div 
                      key={payout.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 px-2 rounded-xl transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-success/10 text-success flex items-center justify-center shrink-0">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-foreground">
                              {payout.companies?.name || "Empresa"}
                            </span>
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px] font-black">
                              {fmt(payout.amount)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                            <span>Data: {format(new Date(payout.paid_at || payout.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            <span>•</span>
                            <span>{payout.order_ids?.length || 1} pedidos liquidados</span>
                            {payout.pix_key && (
                              <>
                                <span>•</span>
                                <span className="font-mono">Pix: {payout.pix_key}</span>
                              </>
                            )}
                          </div>
                          {payout.notes && (
                            <p className="text-[11px] text-muted-foreground italic mt-1 bg-muted/40 px-2.5 py-1 rounded-lg">
                              "{payout.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {payout.receipt_url && (
                          <a
                            href={payout.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl border border-primary/20 transition-all"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Comprovante
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewPayoutModal(payout)}
                          className="rounded-xl text-xs font-bold"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Ver Detalhes
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Efetuar Repasse */}
      <Dialog open={payoutModalOpen} onOpenChange={setPayoutModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <Coins className="h-5 w-5 text-amber-500" />
              Efetuar Repasse para Lojista
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecione os pedidos a liquidar, anexe o comprovante de pagamento e confirme a transferência.
            </DialogDescription>
          </DialogHeader>

          {selectedStoreForPayout && (
            <div className="space-y-4 py-2 text-xs">
              {/* Card da Loja */}
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Loja Beneficiária:</span>
                  <span className="font-black text-sm text-foreground">{selectedStoreForPayout.company.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Total Selecionado:</span>
                  <span className="font-black text-lg text-amber-600 dark:text-amber-400">{fmt(payoutTotalAmount)}</span>
                </div>
              </div>

              {/* Lista de Pedidos com Checkbox */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-black">Pedidos a Liquidar ({selectedOrderIds.length}/{selectedStoreForPayout.orders.length})</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] font-bold text-primary"
                    onClick={() => {
                      if (selectedOrderIds.length === selectedStoreForPayout.orders.length) {
                        setSelectedOrderIds([]);
                      } else {
                        setSelectedOrderIds(selectedStoreForPayout.orders.map((o: any) => o.id));
                      }
                    }}
                  >
                    {selectedOrderIds.length === selectedStoreForPayout.orders.length ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-border/60 rounded-xl p-2 bg-muted/20">
                  {selectedStoreForPayout.orders.map((o: any) => {
                    const isSelected = selectedOrderIds.includes(o.id);
                    return (
                      <div
                        key={o.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedOrderIds(selectedOrderIds.filter((id) => id !== o.id));
                          } else {
                            setSelectedOrderIds([...selectedOrderIds, o.id]);
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all text-[11px]",
                          isSelected ? "bg-primary/10 border border-primary/30" : "bg-card border border-border/40 hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn("w-4 h-4 rounded flex items-center justify-center border", isSelected ? "bg-primary text-primary-foreground border-primary" : "border-border")}>
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <span className="font-mono font-bold">#{o.id.slice(0, 8).toUpperCase()}</span>
                          <span className="text-muted-foreground">• {format(new Date(o.created_at), "dd/MM HH:mm")}</span>
                        </div>
                        <span className="font-black text-foreground">{fmt(o.total)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chave Pix */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Chave Pix Utilizada para o Pagamento</Label>
                <Input
                  placeholder="Ex: 66999426656, CNPJ, Email ou Chave Aleatória"
                  value={pixKeyInput}
                  onChange={(e) => setPixKeyInput(e.target.value)}
                  className="rounded-xl border-border/60 bg-muted/20 text-xs h-9"
                />
              </div>

              {/* Link / URL do Comprovante */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Link do Comprovante ou Código de Transação</Label>
                <Input
                  placeholder="Ex: https://comprovante.com/123 ou ID da transação bancária"
                  value={receiptUrlInput}
                  onChange={(e) => setReceiptUrlInput(e.target.value)}
                  className="rounded-xl border-border/60 bg-muted/20 text-xs h-9"
                />
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Observações / Recibo para a Loja</Label>
                <Textarea
                  placeholder="Instruções ou detalhes sobre a transferência..."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="rounded-xl border-border/60 bg-muted/20 text-xs resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPayoutModalOpen(false)}
              disabled={submittingPayout}
              className="rounded-xl font-bold"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmPayout}
              disabled={submittingPayout || selectedOrderIds.length === 0}
              className="rounded-xl font-black bg-success hover:bg-success/90 text-white gap-2"
            >
              {submittingPayout ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Confirmar e Liquidar Repasse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Ver Detalhes do Lote */}
      <Dialog open={!!viewPayoutModal} onOpenChange={(o) => !o && setViewPayoutModal(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <Receipt className="h-5 w-5 text-primary" />
              Recibo de Repasse Liquidado
            </DialogTitle>
          </DialogHeader>

          {viewPayoutModal && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-muted/40 p-4 rounded-2xl space-y-2.5 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Empresa:</span>
                  <span className="font-black text-sm text-foreground">{viewPayoutModal.companies?.name || "Empresa"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Valor Repassado:</span>
                  <span className="text-base font-black text-success">{fmt(viewPayoutModal.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Data do Pagamento:</span>
                  <span className="font-bold text-foreground">
                    {format(new Date(viewPayoutModal.paid_at || viewPayoutModal.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {viewPayoutModal.pix_key && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Chave Pix:</span>
                    <span className="font-mono font-bold text-foreground">{viewPayoutModal.pix_key}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Pedidos Incluídos:</span>
                  <span className="font-bold text-foreground">{viewPayoutModal.order_ids?.length || 1} pedidos</span>
                </div>
              </div>

              {viewPayoutModal.notes && (
                <div className="space-y-1">
                  <span className="font-bold text-muted-foreground text-[11px] uppercase tracking-wider">Observações:</span>
                  <p className="p-3 bg-muted/30 border border-border/40 rounded-xl text-xs text-foreground">
                    {viewPayoutModal.notes}
                  </p>
                </div>
              )}

              {viewPayoutModal.receipt_url && (
                <a
                  href={viewPayoutModal.receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-2xl text-primary font-bold transition-all"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Abrir Comprovante de Pagamento
                  </span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewPayoutModal(null)}
              className="rounded-xl font-bold w-full"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
