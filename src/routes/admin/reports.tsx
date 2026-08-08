// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState, useEffect } from "react";
import { 
  DollarSign, TrendingUp, Package, ArrowUpCircle, ArrowDownCircle, 
  Trash2, Pencil, Calendar, Tag, Plus, X, Settings, Filter, Download, Printer, Search, FileText
} from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { StoreCreditsPanel } from "@/components/admin/StoreCreditsPanel";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

const PIE_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#eab308"];

const PAYMENT_LABELS: Record<string, string> = {
  money: "Dinheiro",
  pix: "Pix",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  voucher: "Vale Refeição",
  online: "Pagamento Online",
  "Não informado": "Não informado"
};

function ReportsPage() {
  const { toast } = useToast();

  // Filtros Avançados
  const [period, setPeriod] = useState("month");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedDriver, setSelectedDriver] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState("all");
  const [valMin, setValMin] = useState("");
  const [valMax, setValMax] = useState("");

  // Dados carregados do Banco
  const [allDeliveries, setAllDeliveries] = useState([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [drivers, setDrivers] = useState([]);

  // Fluxo de Caixa states
  const [cashFlows, setCashFlows] = useState([]);
  const [isLoadingCF, setIsLoadingCF] = useState(true);
  const [cfForm, setCfForm] = useState({
    description: "",
    category: "",
    amount: "",
    type: "expense",
    date: new Date().toISOString().split("T")[0],
    origin: ""
  });
  const [editingCf, setEditingCf] = useState(null);

  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('cashFlowCategories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      expense: ["Repasse Motoboy", "Thyelle - pessoal", "Abastecimento", "Oficina - manutenção", "Fixo Mensal - empresa", "Aluguel", "Luz", "Internet - telefone", "Água", "Papelaria - limpeza", "Veículo", "Outras Despesas"],
      income: ["Venda - cupom 5,00", "Venda - cupom 6,00", "Açaí primavera", "Outras Receitas"]
    };
  });
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [manageCategoryType, setManageCategoryType] = useState('expense');
  const [newCategoryName, setNewCategoryName] = useState('');

  const saveCategories = (newCats) => {
    setCategories(newCats);
    localStorage.setItem('cashFlowCategories', JSON.stringify(newCats));
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCats = { ...categories };
    if (!newCats[manageCategoryType].includes(newCategoryName.trim())) {
      newCats[manageCategoryType].push(newCategoryName.trim());
      saveCategories(newCats);
    }
    setNewCategoryName('');
  };

  const handleRemoveCategory = (cat) => {
    if (!confirm(`Tem certeza que deseja remover a categoria "${cat}"?`)) return;
    const newCats = { ...categories };
    newCats[manageCategoryType] = newCats[manageCategoryType].filter(c => c !== cat);
    saveCategories(newCats);
  };

  // Carregar dados iniciais
  const fetchData = async () => {
    setLoadingDeliveries(true);

    // 1. Buscar empresas e motoristas para preencher filtros e breakdowns
    const [companiesRes, driversRes, profilesRes] = await Promise.all([
      supabase.from("companies").select("id, name, commission_percentage"),
      supabase.from("delivery_drivers").select("id, user_id, delivery_fee_tax"),
      supabase.from("profiles").select("user_id, full_name, phone")
    ]);

    const compData = companiesRes.data || [];
    setCompanies(compData);

    const profMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);
    const drvData = (driversRes.data || []).map(d => ({
      ...d,
      full_name: profMap.get(d.user_id)?.full_name || "Motoboy Base",
      phone: profMap.get(d.user_id)?.phone || ""
    }));
    setDrivers(drvData);

    // 2. Buscar todas as entregas do Supabase
    const { data: delData, error: delErr } = await supabase
      .from("deliveries")
      .select(`
        *,
        companies(id, name, commission_percentage),
        delivery_drivers(id, user_id, delivery_fee_tax),
        orders(id, payment_method)
      `)
      .order("created_at", { ascending: false });

    if (!delErr && delData) {
      // Normalizar motoristas com nomes reais obtidos do Map de perfis
      const normalized = delData.map((d: any) => {
        const drv = d.delivery_drivers;
        let driver_name = "Motoboy Base";
        let delivery_fee_tax = 0.40; // taxa padrão
        if (drv) {
          driver_name = profMap.get(drv.user_id)?.full_name || "Motoboy Base";
          delivery_fee_tax = drv.delivery_fee_tax !== null && drv.delivery_fee_tax !== undefined ? Number(drv.delivery_fee_tax) : 0.40;
        }

        const orderValue = d.order_value !== null && d.order_value !== undefined ? Number(d.order_value) : 0;
        const deliveryFee = d.value !== null && d.value !== undefined ? Number(d.value) : 0;
        const compCommPercent = d.companies?.commission_percentage !== null && d.companies?.commission_percentage !== undefined ? Number(d.companies.commission_percentage) : 0;

        return {
          ...d,
          driver_name,
          delivery_fee_tax,
          order_value: orderValue,
          delivery_fee: deliveryFee,
          company_commission_percent: compCommPercent,
          payment_method: d.orders?.payment_method || "Não informado"
        };
      });
      setAllDeliveries(normalized);
    }
    setLoadingDeliveries(false);
  };

  const fetchCashFlow = async () => {
    setIsLoadingCF(true);
    const { data: cfData, error } = await supabase
      .from('platform_cash_flow')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && cfData) {
      setCashFlows(cfData);
    }
    setIsLoadingCF(false);
  };

  useEffect(() => {
    fetchData();
    fetchCashFlow();
  }, []);

  // Calcular limites de datas baseados no período rápido
  useEffect(() => {
    if (period === "custom") return;
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (period === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === "yesterday") {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
    } else if (period === "7d") {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === "last_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else {
      // Período desconhecido — remove filtros de data
      setDateFrom("");
      setDateTo("");
      return;
    }

    // Converter para YYYY-MM-DD no fuso horário local
    const toLocalDate = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    setDateFrom(toLocalDate(start));
    setDateTo(toLocalDate(end));
  }, [period]);

  // Aplicar Filtros nos dados locais carregados
  const filteredDeliveries = useMemo(() => {
    return allDeliveries.filter((d) => {
      // 1. Filtro Geral
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const customerMatch = d.customer_name?.toLowerCase().includes(search);
        const addressMatch = d.address?.toLowerCase().includes(search) || d.dropoff_address?.toLowerCase().includes(search);
        const idMatch = d.id?.toLowerCase().includes(search);
        if (!customerMatch && !addressMatch && !idMatch) return false;
      }

      // 2. Filtro de Empresa
      if (selectedCompany !== "all" && d.company_id !== selectedCompany) return false;

      // 3. Filtro de Motorista/Entregador
      if (selectedDriver !== "all" && d.driver_id !== selectedDriver) return false;

      // 4. Filtro de Status
      if (selectedStatus !== "all" && d.status !== selectedStatus) return false;

      // 5. Filtro de Forma de Pagamento
      if (selectedPayment !== "all" && d.payment_method !== selectedPayment) return false;

      // 6. Datas — comparar no fuso horário local
      if (dateFrom) {
        const [fy, fm, fd] = dateFrom.split("-").map(Number);
        const fromDate = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
        const created = new Date(d.created_at);
        if (created < fromDate) return false;
      }
      if (dateTo) {
        const [ty, tm, td] = dateTo.split("-").map(Number);
        const toDate = new Date(ty, tm - 1, td, 23, 59, 59, 999);
        const created = new Date(d.created_at);
        if (created > toDate) return false;
      }

      // 7. Faixa de Valores
      if (valMin && d.delivery_fee < Number(valMin)) return false;
      if (valMax && d.delivery_fee > Number(valMax)) return false;

      return true;
    });
  }, [allDeliveries, searchTerm, selectedCompany, selectedDriver, selectedStatus, selectedPayment, dateFrom, dateTo, valMin, valMax]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filteredDeliveries.length;
    const finished = filteredDeliveries.filter((d) => d.status === "completed" || d.status === "delivered").length;
    const successRate = total > 0 ? (finished / total) * 100 : 0;

    // Faturamento Total (Bruto das taxas de entrega finalizadas)
    const finishedDeliveries = filteredDeliveries.filter((d) => d.status === "completed" || d.status === "delivered");
    const grossRevenue = finishedDeliveries.reduce((s, d) => s + d.delivery_fee, 0);

    // Comissões Estimadas da Central (retidos do entregador)
    // Regra: Motoboy recebe 75% da taxa de entrega, App retém 25% da taxa de entrega
    const estimatedCommissions = finishedDeliveries.reduce((s, d) => s + (d.delivery_fee * 0.25), 0);

    // Ticket Médio
    const averageTicket = finished > 0 ? grossRevenue / finished : 0;

    return {
      total,
      finished,
      successRate,
      grossRevenue,
      estimatedCommissions,
      averageTicket
    };
  }, [filteredDeliveries]);

  // Gráfico de Tendência (Agrupado por dia)
  const chartData = useMemo(() => {
    const dailyMap = new Map();
    const finished = filteredDeliveries.filter((d) => d.status === "completed" || d.status === "delivered");

    finished.forEach((d) => {
      const dateStr = new Date(d.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { name: dateStr, Faturamento: 0, Comissão: 0 });
      }
      const dayData = dailyMap.get(dateStr);
      dayData.Faturamento += d.delivery_fee;
      dayData.Comissão += (d.delivery_fee * 0.25);
    });

    return Array.from(dailyMap.values()).reverse();
  }, [filteredDeliveries]);

  // Distribuição de status (Gráfico Pizza)
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = { Finalizada: 0, Cancelada: 0, Outros: 0 };
    filteredDeliveries.forEach((d) => {
      if (d.status === "completed" || d.status === "delivered") {
        counts.Finalizada += 1;
      } else if (d.status === "cancelled") {
        counts.Cancelada += 1;
      } else {
        counts.Outros += 1;
      }
    });

    return [
      { name: "Finalizada", value: counts.Finalizada },
      { name: "Cancelada", value: counts.Cancelada },
      { name: "Outros", value: counts.Outros },
    ].filter(v => v.value > 0);
  }, [filteredDeliveries]);

  // Relação por Empresa (Top 20)
  const companyBreakdown = useMemo(() => {
    const map: Record<string, { name: string; deliveries: number; revenue: number; due: number }> = {};
    const finished = filteredDeliveries.filter((d) => d.status === "completed" || d.status === "delivered");

    finished.forEach((d) => {
      const name = d.companies?.name || "Lojas / Diretas";
      const id = d.company_id || "diretas";
      if (!map[id]) {
        map[id] = { name, deliveries: 0, revenue: 0, due: 0 };
      }
      map[id].deliveries += 1;
      map[id].revenue += d.order_value; // faturamento de vendas da loja
      map[id].due += (d.order_value * (d.company_commission_percent / 100)); // comissão da loja devida à plataforma
    });

    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  }, [filteredDeliveries]);

  // Relação por Entregador
  const driverBreakdown = useMemo(() => {
    const map: Record<string, { name: string; deliveries: number; due: number; taxTotal: number }> = {};
    const finished = filteredDeliveries.filter((d) => d.status === "completed" || d.status === "delivered");

    finished.forEach((d) => {
      const name = d.driver_name;
      const id = d.driver_id || "sem_motoboy";
      if (!map[id]) {
        map[id] = { name, deliveries: 0, due: 0, taxTotal: 0 };
      }
      map[id].deliveries += 1;
      // Repasse do motoboy (75% do valor da corrida)
      map[id].due += (d.delivery_fee * 0.75);
      // Taxa fixa devida à central por entrega
      map[id].taxTotal += d.delivery_fee_tax;
    });

    return Object.values(map).sort((a, b) => b.due - a.due).slice(0, 20);
  }, [filteredDeliveries]);

  // Limpar Filtros
  const handleClearFilters = () => {
    setPeriod("30d");
    setSearchTerm("");
    setSelectedCompany("all");
    setSelectedDriver("all");
    setSelectedStatus("all");
    setSelectedPayment("all");
    setValMin("");
    setValMax("");
  };

  // Exportadores e Impressão
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ["Data", "ID Corrida", "Cliente", "Empresa", "Endereço", "Status", "Forma Pgto", "Valor Corrida", "Comissão Central (25%)"];
    const rows = filteredDeliveries.map(d => [
      new Date(d.created_at).toLocaleString("pt-BR"),
      d.id,
      d.customer_name || "N/A",
      d.companies?.name || "Direta",
      d.address || d.dropoff_address || "",
      d.status,
      PAYMENT_LABELS[d.payment_method] || d.payment_method,
      d.delivery_fee.toFixed(2),
      (d.delivery_fee * 0.25).toFixed(2)
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_Financeiro_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fluxo de Caixa Operations
  const cfStats = useMemo(() => {
    const income = Array.isArray(cashFlows) ? cashFlows.filter(c => c.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0) : 0;
    const expense = Array.isArray(cashFlows) ? cashFlows.filter(c => c.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0) : 0;
    return { income, expense, balance: income - expense };
  }, [cashFlows]);

  const handleAddCashFlow = async (e) => {
    e.preventDefault();
    if (!cfForm.description || !cfForm.category || !cfForm.amount || !cfForm.date) return;

    const { error } = await supabase.from('platform_cash_flow').insert({
      description: cfForm.description,
      category: cfForm.category,
      amount: Number(cfForm.amount),
      type: cfForm.type,
      date: cfForm.date,
      origin: cfForm.origin || null
    });

    if (error) {
      toast({ title: "Erro ao adicionar lançamento", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lançamento adicionado com sucesso!" });
      setCfForm({ ...cfForm, description: "", amount: "" });
      fetchCashFlow();
    }
  };

  const handleDeleteCashFlow = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
    const { error } = await supabase.from('platform_cash_flow').delete().eq('id', id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lançamento excluído" });
      fetchCashFlow();
    }
  };

  const handleUpdateCashFlow = async (e) => {
    e.preventDefault();
    if (!editingCf.description || !editingCf.category || !editingCf.amount || !editingCf.date) return;

    const { error } = await supabase.from('platform_cash_flow').update({
      description: editingCf.description,
      category: editingCf.category,
      amount: Number(editingCf.amount),
      type: editingCf.type,
      date: editingCf.date,
      origin: editingCf.origin || null
    }).eq('id', editingCf.id);

    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lançamento atualizado com sucesso!" });
      setEditingCf(null);
      fetchCashFlow();
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro / Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise de dados e exportação</p>
        </div>
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="geral">Painel Operacional (Corridas)</TabsTrigger>
          <TabsTrigger value="creditos">Créditos de Lojas</TabsTrigger>
          <TabsTrigger value="cashflow">Fluxo de Caixa Operacional</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          {/* Filtros Avançados */}
          <Card className="mb-6 border-border/80 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  Filtros Avançados
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="font-bold rounded-xl text-xs h-8">
                  Limpar Filtros
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              {/* Período Rápido — botões em linha */}
              <div>
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Período Rápido:</Label>
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
                      onClick={() => setPeriod(p.value)}
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
                  placeholder="Buscar por cliente, ID ou endereço..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 font-medium"
                />
              </div>

              {/* Filtros em grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                    <SelectTrigger>
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
                  <Label>Entregador</Label>
                  <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os Entregadores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Entregadores</SelectItem>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Data Início</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={period !== "custom"} />
                </div>

                <div className="space-y-1.5">
                  <Label>Data Fim</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} disabled={period !== "custom"} />
                </div>

                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="delivered">Entregue</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                      <SelectItem value="in_transit">Em trânsito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Forma de Pagamento</Label>
                  <Select value={selectedPayment} onValueChange={setSelectedPayment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as Formas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Formas</SelectItem>
                      <SelectItem value="pix">Pix</SelectItem>
                      <SelectItem value="money">Dinheiro</SelectItem>
                      <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                      <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                      <SelectItem value="voucher">Vale Refeição</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Valor Mínimo (R$)</Label>
                  <Input type="number" placeholder="0.00" value={valMin} onChange={(e) => setValMin(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label>Valor Máximo (R$)</Label>
                  <Input type="number" placeholder="999.00" value={valMax} onChange={(e) => setValMax(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards KPI */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6">
            <Card className="rounded-3xl border-border/80 shadow-sm relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total de Corridas</CardTitle>
                <Package className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-foreground">{kpis.total}</div>
                <p className="text-xs font-bold text-green-600 mt-1">{kpis.finished} finalizadas ({kpis.successRate.toFixed(1)}% taxa sucesso)</p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/80 shadow-sm relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Faturamento Total</CardTitle>
                <DollarSign className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-foreground">
                  {kpis.grossRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Receita bruta processada das entregas</p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/80 shadow-sm relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Comissões Estimadas</CardTitle>
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-foreground">
                  {kpis.estimatedCommissions.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Comissões pagas aos entregadores
                </p>
                {kpis.grossRevenue > 0 && (
                  <p className="text-xs font-bold text-blue-500 mt-0.5">
                    {((kpis.estimatedCommissions / kpis.grossRevenue) * 100).toFixed(1)}% do faturamento
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/80 shadow-sm relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ticket Médio</CardTitle>
                <DollarSign className="h-5 w-5 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-foreground">
                  {kpis.averageTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Valor médio por entrega</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos de Tendência & Distribuição Operacional */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2 shadow-sm rounded-3xl border-border/80">
              <CardHeader>
                <CardTitle className="text-base font-bold">Tendência de Faturamento</CardTitle>
                <CardDescription>Volume financeiro diário e comissão</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                {chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados para exibir.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCom" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ChartTooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} />
                      <Area type="monotone" dataKey="Faturamento" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorFat)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Comissão" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCom)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm rounded-3xl border-border/80 flex flex-col justify-between">
              <CardHeader>
                <CardTitle className="text-base font-bold">Status Operacional</CardTitle>
                <CardDescription>Distribuição de corridas</CardDescription>
              </CardHeader>
              <CardContent className="h-[180px] flex items-center justify-center relative">
                {statusChartData.length === 0 ? (
                  <div className="text-muted-foreground text-sm">Sem dados.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-black">{kpis.total}</span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total</span>
                </div>
              </CardContent>
              <div className="p-6 pt-0 flex flex-wrap justify-center gap-4 text-xs font-bold border-t border-border/40">
                {statusChartData.map((d, i) => (
                  <span key={d.name} className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded-md" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {d.name} ({d.value})
                  </span>
                ))}
              </div>
            </Card>
          </div>

          {/* Breakdown por Empresa e por Entregador */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="rounded-3xl border-border/80 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span>🏢 Breakdown por Empresa</span>
                  <span className="text-xs text-muted-foreground">Receita e volume por empresa</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[350px] overflow-y-auto">
                {companyBreakdown.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Nenhum registro.</div>
                ) : (
                  <div className="divide-y">
                    {companyBreakdown.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          <div>
                            <p className="font-bold text-sm text-foreground leading-tight">{c.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{c.deliveries} entregas</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-sm text-foreground">
                            {c.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/80 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span>🛵 Breakdown por Motorista</span>
                  <span className="text-xs text-muted-foreground">Entregas e ganhos por entregador</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[350px] overflow-y-auto">
                {driverBreakdown.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Nenhum registro.</div>
                ) : (
                  <div className="divide-y">
                    {driverBreakdown.map((drv, i) => (
                      <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-xs font-bold text-blue-600">
                            {i + 1}
                          </span>
                          <div>
                            <p className="font-bold text-sm text-foreground leading-tight">{drv.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{drv.deliveries} entregas</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-sm text-foreground">
                            {drv.due.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cobranças Plataforma & Saldos Devidos — integrado na aba principal */}
          <Card className="mb-6 rounded-3xl border-border/80 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                🪙 Cobranças Plataforma & Saldos Devidos
              </CardTitle>
              <CardDescription>Saldos devidos pelos lojistas (% sobre vendas) e entregadores (taxa fixa por entrega)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
                {/* Lojistas */}
                <div>
                  <div className="px-5 py-3 border-b bg-muted/5">
                    <p className="text-sm font-bold">🏢 Cobrança de Lojistas (% sobre Vendas)</p>
                  </div>
                  <div className="divide-y max-h-[400px] overflow-y-auto">
                    {companyBreakdown.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">Sem saldos devidos.</div>
                    ) : (
                      companyBreakdown.map((c, i) => (
                        <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/5 transition-colors">
                          <div>
                            <p className="font-bold text-sm text-foreground leading-tight">{c.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Vendas: {c.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} • {c.deliveries} entregas
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Devido</p>
                            <p className="font-black text-base text-primary mt-1.5">
                              {c.due.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {/* Entregadores */}
                <div>
                  <div className="px-5 py-3 border-b bg-muted/5">
                    <p className="text-sm font-bold">🏍️ Cobrança de Entregadores (Taxa por Entrega)</p>
                  </div>
                  <div className="divide-y max-h-[400px] overflow-y-auto">
                    {driverBreakdown.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">Sem saldos devidos.</div>
                    ) : (
                      driverBreakdown.map((drv, i) => (
                        <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/5 transition-colors">
                          <div>
                            <p className="font-bold text-sm text-foreground leading-tight">{drv.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Corridas: {drv.deliveries} • Taxa por entrega: {drv.deliveries > 0 ? (drv.taxTotal / drv.deliveries).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,40"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Devido</p>
                            <p className="font-black text-base text-blue-600 mt-1.5">
                              {drv.taxTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Detalhamento Geral */}
          <Card className="shadow-sm border-border/80 rounded-3xl overflow-hidden">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold">Detalhamento Financeiro</CardTitle>
                  <CardDescription>{filteredDeliveries.length} registros válidos</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={handlePrint} className="font-bold rounded-xl gap-1.5 h-10">
                    <Printer className="h-4 w-4" /> Imprimir Relatório
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="font-bold rounded-xl gap-1.5 h-10">
                    <FileText className="h-4 w-4" /> Exportar PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV} className="font-bold rounded-xl gap-1.5 h-10">
                    <Download className="h-4 w-4" /> Exportar CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-muted/30 text-xs uppercase font-bold text-muted-foreground border-b">
                    <tr>
                      <th className="p-4">Data / ID</th>
                      <th className="p-4">Cliente & Empresa</th>
                      <th className="p-4">Endereço de Entrega</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Valor</th>
                      <th className="p-4 text-right">Comissão (25%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loadingDeliveries ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando relatórios financeiros...</td>
                      </tr>
                    ) : filteredDeliveries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma entrega encontrada para os filtros aplicados.</td>
                      </tr>
                    ) : (
                      filteredDeliveries.map((d) => (
                        <tr key={d.id} className="hover:bg-muted/10">
                          <td className="p-4">
                            <p className="text-xs text-muted-foreground leading-none">{new Date(d.created_at).toLocaleString("pt-BR")}</p>
                            <p className="text-xs font-bold text-foreground mt-1.5">#{d.id?.slice(0, 8)}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-foreground leading-none">{d.customer_name || "N/A"}</p>
                            <p className="text-xs font-semibold text-primary mt-1.5">{d.companies?.name || "Direta / Lojista"}</p>
                          </td>
                          <td className="p-4 max-w-[200px] truncate">
                            <p className="text-xs leading-tight text-muted-foreground">{d.address || d.dropoff_address}</p>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              d.status === "completed" || d.status === "delivered" 
                                ? "bg-green-100 text-green-700" 
                                : d.status === "cancelled" 
                                ? "bg-red-100 text-red-700" 
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {d.status === "completed" || d.status === "delivered" ? "Finalizada" : d.status === "cancelled" ? "Cancelada" : d.status}
                            </span>
                          </td>
                          <td className="p-4 text-right font-semibold text-foreground">
                            {d.delivery_fee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className="p-4 text-right font-bold text-green-600">
                            {(d.delivery_fee * 0.25).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="creditos">
          <StoreCreditsPanel />
        </TabsContent>

        <TabsContent value="cashflow">
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Entradas</CardTitle>
                <ArrowUpCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {cfStats.income.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Saídas</CardTitle>
                <ArrowDownCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {cfStats.expense.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Líquido</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${cfStats.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {cfStats.balance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Novo Lançamento</CardTitle>
                  <CardDescription>Adicione uma receita ou despesa operacional</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddCashFlow} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Tipo de Lançamento</Label>
                      <Select value={cfForm.type} onValueChange={(val) => setCfForm({ ...cfForm, type: val })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Entrada (Receita)</SelectItem>
                          <SelectItem value="expense">Saída (Despesa)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Input
                        id="description"
                        placeholder="Ex: Pagamento Motoboy"
                        value={cfForm.description}
                        onChange={(e) => setCfForm({ ...cfForm, description: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Categoria</Label>
                      <Select value={cfForm.category} onValueChange={(val) => {
                        if (val === 'MANAGE_CATEGORIES') {
                          setManageCategoryType(cfForm.type);
                          setIsManageCategoriesOpen(true);
                        } else {
                          setCfForm({ ...cfForm, category: val });
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories[cfForm.type]?.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                          <SelectItem value="MANAGE_CATEGORIES" className="text-primary font-bold">
                            ⚙️ Gerenciar Categorias...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="origin">Origem</Label>
                      <Select value={cfForm.origin} onValueChange={(val) => setCfForm({ ...cfForm, origin: val })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a origem" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="Pix">Pix</SelectItem>
                          <SelectItem value="Cartão crédito">Cartão crédito</SelectItem>
                          <SelectItem value="Débito">Débito</SelectItem>
                          <SelectItem value="A prazo">A prazo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Valor (R$)</Label>
                        <CurrencyInput
                          id="amount"
                          placeholder="0,00"
                          value={cfForm.amount}
                          onChangeValue={(v) => setCfForm({ ...cfForm, amount: v })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date">Data</Label>
                        <Input
                          id="date"
                          type="date"
                          value={cfForm.date}
                          onChange={(e) => setCfForm({ ...cfForm, date: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full">
                      Salvar Lançamento
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Histórico de Movimentações</CardTitle>
                  <CardDescription>Lançamentos recentes da plataforma</CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                  {isLoadingCF ? (
                    <div className="flex justify-center p-8 text-muted-foreground">Carregando fluxo de caixa...</div>
                  ) : cashFlows.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-2xl mx-4 sm:mx-0">
                      Nenhum lançamento encontrado.
                    </div>
                  ) : (
                    <div className="space-y-3 sm:px-0 px-2">
                      {cashFlows.map((item) => (
                        <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-2xl hover:border-primary/40 bg-card hover:shadow-card transition-all relative overflow-hidden">
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`} />
                          
                          <div className="flex items-center gap-4 pl-2 mb-3 sm:mb-0">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${item.type === 'income' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                              {item.type === 'income' ? <ArrowUpCircle className="h-6 w-6" /> : <ArrowDownCircle className="h-6 w-6" />}
                            </div>
                            <div>
                              <p className="font-bold text-base text-foreground leading-none">{item.description}</p>
                              <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1 bg-secondary/80 text-secondary-foreground px-2.5 py-1 rounded-md">
                                  <Tag className="h-3 w-3" /> {item.category}
                                </span>
                                {item.origin && (
                                  <span className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                                    <DollarSign className="h-3 w-3" /> {item.origin}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" /> {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-6 pl-2 sm:pl-0 border-t sm:border-none pt-3 sm:pt-0 mt-2 sm:mt-0">
                            <span className={`text-xl font-black tracking-tight ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                              {item.type === 'income' ? '+' : '-'} 
                              {Number(item.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" onClick={() => setEditingCf(item)} className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteCashFlow(item.id)} className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Dialog for Editing Cash Flow */}
        <Dialog open={!!editingCf} onOpenChange={(open) => { if (!open) setEditingCf(null); }}>
          <DialogContent className="sm:max-w-[425px] rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-black text-2xl">Editar Lançamento</DialogTitle>
              <DialogDescription>
                Atualize as informações de receita ou despesa.
              </DialogDescription>
            </DialogHeader>
            {editingCf && (
              <form onSubmit={handleUpdateCashFlow} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Tipo de Lançamento</Label>
                  <Select value={editingCf.type} onValueChange={(val) => setEditingCf({ ...editingCf, type: val })}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Entrada (Receita)</SelectItem>
                      <SelectItem value="expense">Saída (Despesa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={editingCf.description} onChange={(e) => setEditingCf({ ...editingCf, description: e.target.value })} required className="rounded-xl h-11" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <CurrencyInput value={editingCf.amount} onChangeValue={(v) => setEditingCf({ ...editingCf, amount: v })} required className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={editingCf.date} onChange={(e) => setEditingCf({ ...editingCf, date: e.target.value })} required className="rounded-xl h-11" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={editingCf.category} onValueChange={(val) => {
                    if (val === 'MANAGE_CATEGORIES') {
                      setManageCategoryType(editingCf.type);
                      setIsManageCategoriesOpen(true);
                    } else {
                      setEditingCf({ ...editingCf, category: val });
                    }
                  }}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories[editingCf.type]?.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                      <SelectItem value="MANAGE_CATEGORIES" className="text-primary font-bold">
                        ⚙️ Gerenciar Categorias...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select value={editingCf.origin || ""} onValueChange={(val) => setEditingCf({ ...editingCf, origin: val })}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione a origem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Pix">Pix</SelectItem>
                      <SelectItem value="Cartão crédito">Cartão crédito</SelectItem>
                      <SelectItem value="Débito">Débito</SelectItem>
                      <SelectItem value="A prazo">A prazo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter className="mt-6 pt-4 border-t border-border">
                  <Button type="button" variant="ghost" onClick={() => setEditingCf(null)} className="rounded-xl h-11 font-bold">Cancelar</Button>
                  <Button type="submit" className="rounded-xl h-11 font-bold px-6">Salvar Alterações</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog for Managing Categories */}
        <Dialog open={isManageCategoriesOpen} onOpenChange={setIsManageCategoriesOpen}>
          <DialogContent className="sm:max-w-[425px] rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-black text-2xl flex items-center gap-2">
                <Settings className="h-6 w-6 text-primary" />
                Gerenciar Categorias
              </DialogTitle>
              <DialogDescription>
                Adicione ou remova categorias de {manageCategoryType === 'expense' ? 'despesas' : 'receitas'}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="flex gap-2">
                <Input 
                  placeholder="Nova categoria..." 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                  className="rounded-xl"
                />
                <Button onClick={handleAddCategory} className="rounded-xl shrink-0 h-10 w-10 p-0">
                  <Plus className="h-5 w-5" />
                </Button>
              </div>

              <div className="border rounded-2xl overflow-hidden mt-4 bg-muted/30">
                <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                  {categories[manageCategoryType]?.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada.</div>
                  ) : (
                    categories[manageCategoryType]?.map(cat => (
                      <div key={cat} className="flex items-center justify-between p-2 hover:bg-card border border-transparent hover:border-border rounded-xl group transition-all">
                        <span className="text-sm font-medium">{cat}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveCategory(cat)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-2 pt-4 border-t border-border">
              <Button type="button" onClick={() => setIsManageCategoriesOpen(false)} className="rounded-xl h-11 font-bold w-full">
                Concluído
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Tabs>
    </AdminLayout>
  );
}