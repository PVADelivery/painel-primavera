// @ts-nocheck
import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, Plus, Search, Building2,
  ArrowUpCircle, ArrowDownCircle, Minus, History,
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

import { supabase } from "@/integrations/supabase/client";

const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const LOW_BALANCE = 30;

const PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão crédito", "Débito", "Transferência", "A prazo"];

const now = new Date();
const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

function getMonthKey(dateStr: string | Date) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthName(monthKey: string) {
  if (!monthKey || monthKey === "all") return "Todos os períodos";
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  const name = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

interface StoreCreditsPanelProps {
  onCreditPurchased?: () => void;
}

export function StoreCreditsPanel({ onCreditPurchased }: StoreCreditsPanelProps = {}) {
  const { data: companies = [], isLoading: loadingCompanies } = useCompanies();
  const { data: credits = [], isLoading: loadingCredits } = useCompanyCredits();
  const { data: txs = [], isLoading: loadingTxs } = useCreditTransactions();
  const addCredits = useAddCompanyCredits();

  // Filtro de Mês Selecionado (Padrão: Mês Atual - reinicia dia 01)
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [search, setSearch] = useState("");
  const [txSearchText, setTxSearchText] = useState("");
  const [dialogCompany, setDialogCompany] = useState<any>(null);
  const [mode, setMode] = useState<"purchase" | "debit">("purchase");
  const [form, setForm] = useState({ amount: "", payment_method: "Pix", description: "" });
  const [historyFilter, setHistoryFilter] = useState("all");

  // Lista dinâmica de meses disponíveis
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthKey);
    txs.forEach((t) => {
      if (t.created_at) {
        const k = getMonthKey(t.created_at);
        if (k) set.add(k);
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [txs]);

  // Transações filtradas pelo mês selecionado
  const monthTxs = useMemo(() => {
    if (selectedMonth === "all") return txs;
    return txs.filter((t) => t.created_at && getMonthKey(t.created_at) === selectedMonth);
  }, [txs, selectedMonth]);

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

  // Vendas e Consumos do período selecionado por loja
  const storePurchasedInPeriod = useMemo(() => {
    const map = new Map<string, number>();
    monthTxs.forEach((t) => {
      if (Number(t.amount) > 0) {
        map.set(t.company_id, (map.get(t.company_id) || 0) + Number(t.amount));
      }
    });
    return map;
  }, [monthTxs]);

  const storeConsumedInPeriod = useMemo(() => {
    const map = new Map<string, number>();
    monthTxs.forEach((t) => {
      if (Number(t.amount) < 0) {
        map.set(t.company_id, (map.get(t.company_id) || 0) + Math.abs(Number(t.amount)));
      }
    });
    return map;
  }, [monthTxs]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies
      .map((c) => {
        const cr = creditsByCompany.get(c.id);
        const purchasedInPeriod = storePurchasedInPeriod.get(c.id) || 0;
        const consumedInPeriod = storeConsumedInPeriod.get(c.id) || 0;
        return {
          ...c,
          balance: Number(cr?.balance ?? 0),
          total_purchased: selectedMonth === "all" ? Number(cr?.total_purchased ?? 0) : purchasedInPeriod,
          total_consumed: selectedMonth === "all" ? Number(cr?.total_consumed ?? 0) : consumedInPeriod,
        };
      })
      .filter((c) => {
        if (!q) return true;
        return (
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.balance - a.balance);
  }, [companies, creditsByCompany, search, storePurchasedInPeriod, storeConsumedInPeriod, selectedMonth]);

  // Métricas do período selecionado
  const totals = useMemo(() => {
    const balance = rows.reduce((s, r) => s + r.balance, 0);
    const purchased = monthTxs.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
    const consumed = monthTxs.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const low = rows.filter((r) => r.balance < LOW_BALANCE).length;
    return { balance, purchased, consumed, low };
  }, [rows, monthTxs]);

  // Gráfico de vendas exibindo exclusivamente os dias do mês selecionado (dia 01 ao fim do mês)
  const salesTrend = useMemo(() => {
    if (selectedMonth === "all") {
      const map = new Map<string, { date: string; value: number }>();
      txs.forEach((t) => {
        if (Number(t.amount) <= 0 || !t.created_at) return;
        const key = getMonthKey(t.created_at);
        const label = formatMonthName(key);
        if (!map.has(key)) map.set(key, { date: label, value: 0 });
        map.get(key)!.value += Number(t.amount);
      });
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v);
    }

    const [year, month] = selectedMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const map = new Map<string, { date: string; value: number }>();

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, "0");
      const key = `${year}-${String(month).padStart(2, "0")}-${dayStr}`;
      map.set(key, {
        date: `${dayStr}/${String(month).padStart(2, "0")}`,
        value: 0,
      });
    }

    monthTxs.forEach((t) => {
      if (Number(t.amount) <= 0 || !t.created_at) return;
      const key = t.created_at.split("T")[0];
      if (map.has(key)) {
        map.get(key)!.value += Number(t.amount);
      }
    });

    return Array.from(map.values());
  }, [monthTxs, selectedMonth, txs]);

  const topStores = useMemo(
    () => rows.filter((r) => r.balance > 0).slice(0, 8).map((r) => ({ name: r.name, saldo: r.balance })),
    [rows],
  );

  // Extrato filtrado por mês, loja selecionada e texto de busca
  const filteredTxs = useMemo(() => {
    const q = txSearchText.trim().toLowerCase();
    return monthTxs.filter((t) => {
      const matchCompany = historyFilter === "all" || t.company_id === historyFilter;
      const compName = companyById.get(t.company_id)?.name?.toLowerCase() || "";
      const desc = t.description?.toLowerCase() || "";
      const method = t.payment_method?.toLowerCase() || "";
      const matchText = !q || compName.includes(q) || desc.includes(q) || method.includes(q);
      return matchCompany && matchText;
    });
  }, [monthTxs, historyFilter, txSearchText, companyById]);

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

      {/* ── BARRA SUPERIOR: FILTRO DE MÊS & PERÍODO ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-card border-2 border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/20 text-foreground flex items-center justify-center font-black shrink-0">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              Gestão de Créditos de Lojas & Lojistas
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              Período selecionado: <strong className="text-foreground">{formatMonthName(selectedMonth)}</strong>
              {selectedMonth === currentMonthKey && " (Mês Atual • Reinicia dia 01)"}
            </p>
          </div>
        </div>

        {/* Seletor de Mês Dinâmico */}
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-10 min-w-[200px] text-xs font-bold rounded-xl bg-background border-2 border-border">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={m} className="text-xs font-semibold">
                  {formatMonthName(m)} {m === currentMonthKey ? "★ (Mês Atual)" : ""}
                </SelectItem>
              ))}
              <SelectItem value="all" className="text-xs font-semibold text-primary">
                📊 Todos os Meses (Histórico Completo)
              </SelectItem>
            </SelectContent>
          </Select>

          {selectedMonth !== currentMonthKey && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedMonth(currentMonthKey)}
              className="h-10 text-xs font-bold rounded-xl border-primary/40 bg-primary/10 hover:bg-primary text-black cursor-pointer"
            >
              Voltar ao Mês Atual
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          sub={`Período: ${formatMonthName(selectedMonth)}`}
          icon={TrendingUp}
          color="success"
        />
        <StatsCard
          title="Créditos consumidos"
          value={brl(totals.consumed)}
          sub={`Entregas em ${formatMonthName(selectedMonth)}`}
          icon={TrendingDown}
          color="info"
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
              Vendas de créditos — {formatMonthName(selectedMonth)}
            </CardTitle>
            <CardDescription className="text-xs">
              {selectedMonth === "all" ? "Valores consolidados por mês" : "Valores recebidos por dia do mês selecionado"}
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
              Exibindo compras e consumos de <strong>{formatMonthName(selectedMonth)}</strong>
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9 text-xs" placeholder="Buscar por loja, WhatsApp..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">Comprado ({formatMonthName(selectedMonth)})</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">Consumido ({formatMonthName(selectedMonth)})</th>
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
              <History className="h-4 w-4" /> Extrato de créditos — {formatMonthName(selectedMonth)}
            </CardTitle>
            <CardDescription className="text-xs">
              {filteredTxs.length} movimentações no período selecionado
            </CardDescription>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            {/* Campo de Busca Textual no Extrato */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar no extrato..."
                value={txSearchText}
                onChange={(e) => setTxSearchText(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Filtro por Loja */}
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="w-full sm:w-48 h-9 text-xs"><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTxs ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : filteredTxs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed p-12 text-center text-sm text-muted-foreground">
              Nenhuma movimentação registrada
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
