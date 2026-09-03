// @ts-nocheck
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, Plus, Search, Building2,
  ArrowUpCircle, ArrowDownCircle, Minus, History, Filter, Percent,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatsCard } from "@/components/admin/StatsCard";
import { useCompanies } from "@/services/companies";
import {
  useCompanyCredits, useCreditTransactions, useAddCompanyCredits,
  useCreditPurchaseRequestsAdmin, useApproveCreditPurchaseRequest, useRejectCreditPurchaseRequest,
} from "@/services/companyCredits";

const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const LOW_BALANCE = 30;

const PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão crédito", "Débito", "Transferência", "A prazo"];

const getPeriodDates = (periodKey: string, customFrom?: string, customTo?: string) => {
  const n = new Date();
  let from = new Date(n.getFullYear(), n.getMonth(), 1, 0, 0, 0);
  let to = new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59, 999);

  if (periodKey === "today") {
    from = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0);
    to = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999);
  } else if (periodKey === "yesterday") {
    const y = new Date(n);
    y.setDate(y.getDate() - 1);
    from = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
    to = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
  } else if (periodKey === "7d") {
    const d7 = new Date(n);
    d7.setDate(d7.getDate() - 6);
    from = new Date(d7.getFullYear(), d7.getMonth(), d7.getDate(), 0, 0, 0);
    to = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999);
  } else if (periodKey === "month") {
    from = new Date(n.getFullYear(), n.getMonth(), 1, 0, 0, 0);
    to = new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (periodKey === "last_month") {
    from = new Date(n.getFullYear(), n.getMonth() - 1, 1, 0, 0, 0);
    to = new Date(n.getFullYear(), n.getMonth(), 0, 23, 59, 59, 999);
  } else if (periodKey === "custom") {
    if (customFrom) from = new Date(`${customFrom}T00:00:00`);
    if (customTo) to = new Date(`${customTo}T23:59:59.999`);
  }

  const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  const toStr = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}`;
  return { from, to, fromStr, toStr };
};

interface StoreCreditsPanelProps {
  onCreditPurchased?: () => void;
}

export function StoreCreditsPanel({ onCreditPurchased }: StoreCreditsPanelProps = {}) {
  const { data: companies = [], isLoading: loadingCompanies } = useCompanies();
  const { data: credits = [], isLoading: loadingCredits } = useCompanyCredits();
  const { data: txs = [], isLoading: loadingTxs } = useCreditTransactions();
  const addCredits = useAddCompanyCredits();

  // Estados de Filtros Avançados (Padrão: Este Mês)
  const initialDates = getPeriodDates("month");
  const [period, setPeriod] = useState("month");
  const [dateFrom, setDateFrom] = useState(initialDates.fromStr);
  const [dateTo, setDateTo] = useState(initialDates.toStr);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");

  // Busca entregas reais criadas pelas lojas no período filtrado para somar o consumo real de créditos
  const { data: storeDeliveries = [], isLoading: loadingDeliveries } = useQuery({
    queryKey: ["store-deliveries-consumed", period, dateFrom, dateTo],
    queryFn: async () => {
      try {
        const { from, to } = getPeriodDates(period, dateFrom, dateTo);
        const { data, error } = await supabase
          .from("deliveries")
          .select("id, company_id, delivery_fee, value, status, created_at")
          .not("company_id", "is", null)
          .gte("created_at", from.toISOString())
          .lte("created_at", to.toISOString())
          .neq("status", "cancelled");

        if (error) {
          console.warn("[storeDeliveries query error]:", error);
          return [];
        }
        return data ?? [];
      } catch (e) {
        return [];
      }
    },
  });

  const [dialogCompany, setDialogCompany] = useState<any>(null);
  const [mode, setMode] = useState<"purchase" | "debit">("purchase");
  const [form, setForm] = useState({ amount: "", payment_method: "Pix", description: "" });

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    if (newPeriod !== "custom") {
      const dates = getPeriodDates(newPeriod);
      setDateFrom(dates.fromStr);
      setDateTo(dates.toStr);
    }
  };

  const handleClearFilters = () => {
    const dates = getPeriodDates("month");
    setPeriod("month");
    setDateFrom(dates.fromStr);
    setDateTo(dates.toStr);
    setSearchTerm("");
    setSelectedCompany("all");
    setSelectedPayment("all");
    setSelectedType("all");
    setMinValue("");
    setMaxValue("");
  };

  const creditsByCompany = useMemo(() => {
    const m = new Map<string, any>();
    credits.forEach((c) => m.set(c.company_id, c));
    return m;
  }, [credits]);

  const companyById = useMemo(() => {
    const m = new Map<string, any>();
    companies.forEach((c) => m.set(c.id, c));
    return m;
  }, [companies]);

  // Transações filtradas pelos Filtros Avançados
  const filteredTxs = useMemo(() => {
    const { from, to } = getPeriodDates(period, dateFrom, dateTo);
    const q = searchTerm.trim().toLowerCase();
    const min = minValue ? parseFloat(minValue) : null;
    const max = maxValue ? parseFloat(maxValue) : null;

    return txs.filter((t) => {
      if (!t.created_at) return false;
      const dt = new Date(t.created_at);
      if (dt < from || dt > to) return false;

      if (selectedCompany !== "all" && t.company_id !== selectedCompany) return false;
      if (selectedPayment !== "all" && t.payment_method !== selectedPayment) return false;

      if (selectedType === "purchase" && Number(t.amount) <= 0) return false;
      if (selectedType === "debit" && Number(t.amount) >= 0) return false;

      const absAmount = Math.abs(Number(t.amount || 0));
      if (min !== null && !isNaN(min) && absAmount < min) return false;
      if (max !== null && !isNaN(max) && absAmount > max) return false;

      if (q) {
        const compName = companyById.get(t.company_id)?.name?.toLowerCase() || "";
        const desc = t.description?.toLowerCase() || "";
        const method = t.payment_method?.toLowerCase() || "";
        const id = t.id?.toLowerCase() || "";
        if (!compName.includes(q) && !desc.includes(q) && !method.includes(q) && !id.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [txs, period, dateFrom, dateTo, selectedCompany, selectedPayment, selectedType, minValue, maxValue, searchTerm, companyById]);

  // Vendas e Consumos por loja no período filtrado
  const storePurchasedInPeriod = useMemo(() => {
    const map = new Map<string, number>();
    filteredTxs.forEach((t) => {
      if (Number(t.amount) > 0) {
        map.set(t.company_id, (map.get(t.company_id) || 0) + Number(t.amount));
      }
    });
    return map;
  }, [filteredTxs]);

  const storeConsumedInPeriod = useMemo(() => {
    const map = new Map<string, number>();

    // 1. Débitos manuais da tabela company_credit_transactions
    filteredTxs.forEach((t) => {
      if (Number(t.amount) < 0) {
        map.set(t.company_id, (map.get(t.company_id) || 0) + Math.abs(Number(t.amount)));
      }
    });

    // 2. Entregas reais de lojas no período (taxa de entrega consumida)
    storeDeliveries.forEach((d: any) => {
      if (!d.company_id) return;
      if (selectedCompany !== "all" && d.company_id !== selectedCompany) return;
      const fee = Number(d.delivery_fee || d.value || 0);
      if (fee > 0) {
        map.set(d.company_id, (map.get(d.company_id) || 0) + fee);
      }
    });

    return map;
  }, [filteredTxs, storeDeliveries, selectedCompany]);

  const rows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return companies
      .map((c) => {
        const cr = creditsByCompany.get(c.id);
        const purchasedInPeriod = storePurchasedInPeriod.get(c.id) || 0;
        const consumedInPeriod = storeConsumedInPeriod.get(c.id) || 0;
        return {
          ...c,
          balance: Number(cr?.balance ?? 0),
          total_purchased: purchasedInPeriod,
          total_consumed: consumedInPeriod,
        };
      })
      .filter((c) => {
        if (selectedCompany !== "all" && c.id !== selectedCompany) return false;
        if (!q) return true;
        return (
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.balance - a.balance);
  }, [companies, creditsByCompany, searchTerm, selectedCompany, storePurchasedInPeriod, storeConsumedInPeriod]);

  // Métricas do período selecionado
  const totals = useMemo(() => {
    const balance = credits.reduce((s, c) => s + Number(c.balance || 0), 0);
    const purchased = filteredTxs.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
    const manualDebits = filteredTxs.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

    const filteredDeliveries = storeDeliveries.filter((d: any) => {
      if (selectedCompany !== "all" && d.company_id !== selectedCompany) return false;
      return true;
    });
    const deliveriesConsumed = filteredDeliveries.reduce((s, d: any) => s + Number(d.delivery_fee || d.value || 0), 0);
    const consumed = manualDebits + deliveriesConsumed;
    const totalDebitsCount = filteredTxs.filter((t) => Number(t.amount) < 0).length + filteredDeliveries.length;

    const low = companies.filter((c) => (creditsByCompany.get(c.id)?.balance || 0) < LOW_BALANCE).length;
    const platformCommission = purchased * 0.02;
    return { balance, purchased, consumed, low, platformCommission, totalDebitsCount, deliveriesCount: filteredDeliveries.length };
  }, [credits, filteredTxs, companies, creditsByCompany, storeDeliveries, selectedCompany]);

  // Gráfico de vendas dia a dia no período filtrado
  const salesTrend = useMemo(() => {
    const { from, to } = getPeriodDates(period, dateFrom, dateTo);
    const map = new Map<string, { date: string; value: number }>();

    const cur = new Date(from);
    while (cur <= to) {
      const key = cur.toISOString().split("T")[0];
      const label = cur.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      map.set(key, { date: label, value: 0 });
      cur.setDate(cur.getDate() + 1);
    }

    filteredTxs.forEach((t) => {
      if (Number(t.amount) <= 0 || !t.created_at) return;
      const key = t.created_at.split("T")[0];
      if (map.has(key)) {
        map.get(key)!.value += Number(t.amount);
      }
    });

    return Array.from(map.values());
  }, [filteredTxs, period, dateFrom, dateTo]);

  const topStores = useMemo(
    () => rows.filter((r) => r.balance > 0).slice(0, 8).map((r) => ({ name: r.name, saldo: r.balance })),
    [rows],
  );

  const openDialog = (company: any, m: "purchase" | "debit") => {
    setDialogCompany(company);
    setMode(m);
    setForm({ amount: "", payment_method: "Pix", description: "" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(form.amount);
    if (!value || value <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    try {
      await addCredits.mutateAsync({
        company_id: dialogCompany.id,
        company_name: dialogCompany.name,
        amount: mode === "purchase" ? value : -value,
        payment_method: mode === "purchase" ? form.payment_method : null,
        description: form.description || (mode === "purchase" ? "Compra de créditos" : "Ajuste manual"),
        type: mode === "purchase" ? "purchase" : "adjustment",
      });

      if (mode === "purchase") {
        toast.success(
          `${brl(value)} em créditos adicionados e lançados nas ENTRADAS do Fluxo de Caixa para ${dialogCompany.name}!`,
        );
      } else {
        toast.success(`${brl(value)} debitados de ${dialogCompany.name}`);
      }

      if (onCreditPurchased) onCreditPurchased();
      setDialogCompany(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const isLoading = loadingCompanies || loadingCredits;
  const { data: creditRequests = [] } = useCreditPurchaseRequestsAdmin();
  const approveCreditReq = useApproveCreditPurchaseRequest();
  const rejectCreditReq = useRejectCreditPurchaseRequest();

  const pendingCreditRequests = useMemo(
    () => creditRequests.filter((r) => r.status === "pending"),
    [creditRequests]
  );

  const handleApprove = async (req: any) => {
    const compName = req.companies?.name || companyById.get(req.company_id)?.name || "Loja";
    try {
      await approveCreditReq.mutateAsync({
        id: req.id,
        company_id: req.company_id,
        amount: Number(req.amount),
        notes: req.notes,
        payment_method: "Pix",
        company_name: compName,
      });
      toast.success(`Solicitação de ${brl(req.amount)} para ${compName} aprovada com sucesso!`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aprovar solicitação.");
    }
  };

  const handleReject = async (reqId: string) => {
    try {
      await rejectCreditReq.mutateAsync(reqId);
      toast.info("Solicitação de recarga recusada.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao recusar solicitação.");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── SOLICITAÇÕES PENDENTES DE RECARGA DE LOJAS ── */}
      {pendingCreditRequests.length > 0 && (
        <Card className="border-2 border-amber-500/50 bg-amber-500/10 shadow-lg animate-pulse-subtle">
          <CardHeader className="pb-3 border-b border-amber-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black text-xs">
                  {pendingCreditRequests.length}
                </div>
                <div>
                  <CardTitle className="text-base font-black text-amber-900 dark:text-amber-300">
                    Solicitações de Recarga de Créditos de Lojas Pendentes
                  </CardTitle>
                  <CardDescription className="text-xs text-amber-800 dark:text-amber-400 font-medium">
                    Lojistas aguardando aprovação e liberação de saldo no painel
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 divide-y divide-amber-500/20">
            {pendingCreditRequests.map((req) => {
              const comp = req.companies || companyById.get(req.company_id);
              return (
                <div
                  key={req.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-3 hover:bg-amber-500/5 rounded-2xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-black text-sm text-amber-900 dark:text-amber-300 shrink-0">
                      {comp?.name ? comp.name.charAt(0).toUpperCase() : "L"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground leading-tight">
                        {comp?.name || "Loja do Sistema"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Solicitou: <strong className="text-foreground text-sm font-black">{brl(req.amount)}</strong>
                        {req.notes && ` • Observação: "${req.notes}"`}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Em: {new Date(req.created_at).toLocaleDateString("pt-BR")} às {new Date(req.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(req)}
                      disabled={approveCreditReq.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-9 px-4 rounded-xl shadow-md gap-1.5"
                    >
                      ✓ Aprovar e Creditar {brl(req.amount)}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(req.id)}
                      disabled={rejectCreditReq.isPending}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 font-bold text-xs h-9 px-3 rounded-xl"
                    >
                      ✕ Recusar
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── CARD FILTROS AVANÇADOS ── */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filtros Avançados
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="font-bold rounded-xl text-xs h-8"
            >
              Limpar Filtros
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {/* Período Rápido */}
          <div>
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
              Período Rápido:
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "today", label: "Hoje" },
                { value: "yesterday", label: "Ontem" },
                { value: "7d", label: "Últimos 7 Dias" },
                { value: "month", label: "Este Mês" },
                { value: "last_month", label: "Mês Passado" },
                { value: "custom", label: "Personalizado" },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handlePeriodChange(p.value)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    period === p.value
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Busca Geral */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por loja, telefone, WhatsApp, descrição, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 font-medium h-10 text-xs rounded-xl"
            />
          </div>

          {/* Grid de Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Empresa / Loja</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="h-10 text-xs rounded-xl">
                  <SelectValue placeholder="Todas as Empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Empresas</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Forma de Pagamento</Label>
              <Select value={selectedPayment} onValueChange={setSelectedPayment}>
                <SelectTrigger className="h-10 text-xs rounded-xl">
                  <SelectValue placeholder="Todas as Formas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Formas</SelectItem>
                  {PAYMENT_METHODS.map((pm) => (
                    <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Data Início</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setPeriod("custom");
                  setDateFrom(e.target.value);
                }}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Data Fim</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setPeriod("custom");
                  setDateTo(e.target.value);
                }}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Tipo de Movimentação</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="h-10 text-xs rounded-xl">
                  <SelectValue placeholder="Todos os Tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="purchase">Compras / Recargas (+)</SelectItem>
                  <SelectItem value="debit">Consumos / Entregas (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Valor Mínimo (R$)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Valor Máximo (R$)</Label>
              <Input
                type="number"
                placeholder="999.00"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatsCard
          title="Créditos em circulação"
          value={brl(totals.balance)}
          sub={`${rows.length} lojas no sistema`}
          icon={Wallet}
          color="primary"
        />
        <StatsCard
          title="Créditos vendidos"
          value={brl(totals.purchased)}
          sub={`${filteredTxs.filter(t => Number(t.amount) > 0).length} compras no período`}
          icon={TrendingUp}
          color="success"
        />
        <StatsCard
          title="Créditos consumidos"
          value={brl(totals.consumed)}
          sub={`${totals.totalDebitsCount || 0} consumos (${totals.deliveriesCount || 0} entregas)`}
          icon={TrendingDown}
          color="info"
        />
        <StatsCard
          title="Comissão da Plataforma"
          value={brl(totals.platformCommission)}
          sub={`2,0% dos créditos vendidos (${brl(totals.purchased)})`}
          icon={Percent}
          color="primary"
        />
        <StatsCard
          title="Lojas com saldo baixo"
          value={totals.low}
          sub={`Abaixo de ${brl(LOW_BALANCE)}`}
          icon={AlertTriangle}
          color="warning"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">
              Vendas de créditos no período ({salesTrend.length} dias)
            </CardTitle>
            <CardDescription className="text-xs">
              Valores diários recebidos de recargas de lojas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={salesTrend}>
                <defs>
                  <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => [brl(v), "Créditos"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#creditGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Saldo por loja</CardTitle>
            <CardDescription className="text-xs">Maiores saldos ativos em carteira</CardDescription>
          </CardHeader>
          <CardContent>
            {topStores.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] text-center">
                <Wallet className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma loja com saldo</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topStores} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => [brl(v), "Saldo"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="saldo" radius={[0, 6, 6, 0]}>
                    {topStores.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stores table */}
      <Card className="shadow-card overflow-hidden">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-bold">Carteira das lojas</CardTitle>
            <CardDescription className="text-xs">
              Saldos atuais e movimentações filtradas no período
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma loja encontrada</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Loja</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo Atual</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">Comprado (no período)</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">Consumido (no período)</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                            {c.logo_url ? <img src={c.logo_url} alt={c.name} className="h-full w-full object-cover" /> : <Building2 className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-semibold leading-tight">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.phone || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${c.balance < LOW_BALANCE ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                          {brl(c.balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden md:table-cell">{brl(c.total_purchased)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden md:table-cell">{brl(c.total_consumed)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => openDialog(c, "purchase")}>
                            <Plus className="mr-1 h-3.5 w-3.5" /> Créditos
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openDialog(c, "debit")}>
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <History className="h-4 w-4" /> Extrato de créditos
            </CardTitle>
            <CardDescription className="text-xs">
              {filteredTxs.length} movimentações encontradas com os filtros aplicados
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTxs ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : filteredTxs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed p-12 text-center text-sm text-muted-foreground">
              Nenhuma movimentação encontrada para os filtros selecionados
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTxs.map((t) => {
                const positive = Number(t.amount) > 0;
                return (
                  <div key={t.id} className="relative flex flex-col gap-2 overflow-hidden rounded-2xl border p-4 transition-all hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between">
                    <div className={`absolute bottom-0 left-0 top-0 w-1 ${positive ? "bg-success" : "bg-destructive"}`} />
                    <div className="flex items-center gap-3 pl-2">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {positive ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-bold leading-tight">{companyById.get(t.company_id)?.name ?? "Loja removida"}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.description || "—"}
                          {t.payment_method ? ` • ${t.payment_method}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="pl-2 text-left sm:text-right">
                      <p className={`font-extrabold tabular-nums ${positive ? "text-success" : "text-destructive"}`}>
                        {positive ? "+" : "-"} {brl(Math.abs(Number(t.amount)))}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("pt-BR")}
                        {t.balance_after != null ? ` • saldo ${brl(t.balance_after)}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={!!dialogCompany} onOpenChange={(o) => !o && setDialogCompany(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              {mode === "purchase" ? "Adicionar créditos" : "Debitar créditos"}
            </DialogTitle>
            <DialogDescription>
              {dialogCompany?.name} • saldo atual {brl(dialogCompany?.balance ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credit-amount">Valor (R$)</Label>
              <CurrencyInput
                id="credit-amount"
                placeholder="0,00"
                value={form.amount}
                onChangeValue={(v) => setForm({ ...form, amount: v })}
                required
              />
            </div>
            {mode === "purchase" && (
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="credit-desc">Observação</Label>
              <Input
                id="credit-desc"
                placeholder={mode === "purchase" ? "Ex: Recarga de créditos - pago via Pix" : "Ex: Estorno de entrega"}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogCompany(null)}>Cancelar</Button>
              <Button type="submit" disabled={addCredits.isPending}>
                {addCredits.isPending ? "Salvando..." : mode === "purchase" ? "Adicionar créditos" : "Debitar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
