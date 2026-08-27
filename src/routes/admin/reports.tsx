// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState, useEffect, useRef } from "react";
import { 
  DollarSign, TrendingUp, Package, ArrowUpCircle, ArrowDownCircle, 
  Trash2, Pencil, Calendar, Clock as ClockIcon, AlertCircle, Tag, Plus, X, Settings, Filter, Download, Printer, Search, FileText, Check
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

function getCfTypeDetails(type: string) {
  const isIncome = type === "income" || type === "entrada" || type === "receita";
  return isIncome
    ? {
        Icon: ArrowUpCircle,
        label: "Entrada",
        sign: "+",
        textColor: "text-emerald-500",
        barColor: "bg-emerald-500",
        badgeBg: "bg-emerald-500/10 text-emerald-500",
      }
    : {
        Icon: ArrowDownCircle,
        label: "Saída",
        sign: "-",
        textColor: "text-rose-500",
        barColor: "bg-rose-500",
        badgeBg: "bg-rose-500/10 text-rose-500",
      };
}

const PAYMENT_LABELS: Record<string, string> = {
  money: "Dinheiro",
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão (Maquininha)",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  convenio: "Convênio",
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

  // Filtros avançados do Fluxo de Caixa
  const [cfFilterType, setCfFilterType] = useState<"all" | "income" | "expense" | "receivable" | "payable">("all");
  const [cfSearch, setCfSearch] = useState("");
  const [cfCategoryFilter, setCfCategoryFilter] = useState("all");
  const [cfOriginFilter, setCfOriginFilter] = useState("all");
  const [cfPeriodFilter, setCfPeriodFilter] = useState("all");

  // Modal de Pagamento de Repasse ao Entregador
  const [payDriverDialogData, setPayDriverDialogData] = useState<{ name: string; id: string; due: number; deliveries: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Pix");
  const [payNotes, setPayNotes] = useState("");
  const [submittingPay, setSubmittingPay] = useState(false);
  const [driverSearchTerm, setDriverSearchTerm] = useState("");
  const isSubmittingPayRef = useRef(false);

  const openPayDriverModal = (drv: { name: string; id: string; due: number; deliveries: number; isFullyPaid?: boolean }) => {
    if (drv.due <= 0.05 || drv.isFullyPaid) {
      toast({
        title: "Repasse Já Quitado",
        description: `O entregador ${drv.name} já possui todos os repasses do período quitados.`,
      });
      return;
    }
    setPayDriverDialogData(drv);
    setPayAmount(drv.due > 0 ? drv.due.toFixed(2) : "0.00");
    setPayMethod("Pix");
    setPayNotes("");
  };

  const handleConfirmPayDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingPayRef.current) return;
    if (!payDriverDialogData || !payAmount || Number(payAmount) <= 0) {
      toast({ title: "Informe um valor de repasse válido", variant: "destructive" });
      return;
    }

    const amountVal = Number(payAmount);
    const dateStr = new Date().toISOString().split("T")[0];
    const descriptionStr = `Repasse Entregador: ${payDriverDialogData.name} (${payDriverDialogData.deliveries} entregas)${payNotes ? ` - ${payNotes}` : ''}`;

    // Previne duplicidade imediata se já existir lançamento idêntico no Fluxo de Caixa
    const isDuplicate = cashFlows.some((cf: any) =>
      cf.type === "expense" &&
      cf.date === dateStr &&
      Math.abs(Number(cf.amount) - amountVal) < 0.01 &&
      (cf.description?.toLowerCase().includes(payDriverDialogData.name.toLowerCase()) || cf.description?.toLowerCase() === descriptionStr.toLowerCase())
    );

    if (isDuplicate) {
      toast({
        title: "Repasse Já Lançado!",
        description: `Já existe um lançamento de repasse para ${payDriverDialogData.name} no valor de R$ ${amountVal.toFixed(2)} registrado hoje no Fluxo de Caixa.`,
        variant: "destructive"
      });
      setPayDriverDialogData(null);
      return;
    }

    isSubmittingPayRef.current = true;
    setSubmittingPay(true);
    try {
      const { error } = await supabase.from('platform_cash_flow').insert({
        description: descriptionStr,
        category: "Repasse Motoboy",
        amount: amountVal,
        type: "expense",
        date: dateStr,
        origin: payMethod || "Pix"
      });

      if (error) throw error;

      toast({
        title: "Repasse Efetuado com Sucesso!",
        description: `R$ ${amountVal.toFixed(2)} repassados a ${payDriverDialogData.name} e lançados como SAÍDA no Fluxo de Caixa.`,
      });

      setPayDriverDialogData(null);
      fetchCashFlow();
    } catch (err: any) {
      toast({
        title: "Erro ao registrar repasse",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      isSubmittingPayRef.current = false;
      setSubmittingPay(false);
    }
  };

  const DEFAULT_CATEGORIES = {
    expense: ["Repasse Motoboy", "Thyelle - pessoal", "Abastecimento", "Oficina - manutenção", "Fixo Mensal - empresa", "Aluguel", "Luz", "Internet - telefone", "Água", "Papelaria - limpeza", "Veículo", "Outras Despesas"],
    income: ["Venda - Créditos Lojista", "Venda - cupom 5,00", "Venda - cupom 6,00", "Açaí primavera", "Outras Receitas"],
    receivable: ["Contas a Receber", "Venda a Prazo", "Empresas Faturadas", "Cheque Pré-datado", "Outros Direitos"],
    payable: ["Contas a Pagar", "Fornecedores", "Impostos a Pagar", "Aluguel Futuro", "Empréstimo / Financiamento", "Outras Obrigações"]
  };
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [manageCategoryType, setManageCategoryType] = useState('expense');
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cashFlowCategories');
      if (saved) {
        const parsed = JSON.parse(saved);
        setCategories({
          ...DEFAULT_CATEGORIES,
          ...parsed,
          receivable: parsed.receivable || DEFAULT_CATEGORIES.receivable,
          payable: parsed.payable || DEFAULT_CATEGORIES.payable,
        });
      }
    } catch (e) {}
  }, []);

  const saveCategories = (newCats) => {
    setCategories(newCats);
    try { localStorage.setItem('cashFlowCategories', JSON.stringify(newCats)); } catch (e) {}
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

  // Mapeamento de repasses já pagos por entregador via Fluxo de Caixa (platform_cash_flow)
  const driverPaymentsMap = useMemo(() => {
    const map: Record<string, number> = {};
    cashFlows.forEach((cf: any) => {
      if (cf.type === "expense" && (cf.category === "Repasse Motoboy" || cf.category === "Repasse Entregador" || cf.description?.toLowerCase().includes("repasse entregador"))) {
        const match = cf.description.match(/Repasse Entregador:\s*([^(]+)/i);
        if (match && match[1]) {
          const nameKey = match[1].trim().toLowerCase();
          map[nameKey] = (map[nameKey] || 0) + Number(cf.amount || 0);
        }
      }
    });
    return map;
  }, [cashFlows]);

  // Relação por Entregador com controle de quitado e saldo devido restante
  const driverBreakdown = useMemo(() => {
    const map: Record<string, { id: string; name: string; deliveries: number; totalEarned: number; paidAmount: number; due: number; taxTotal: number; isFullyPaid: boolean }> = {};
    const finished = filteredDeliveries.filter((d) => d.status === "completed" || d.status === "delivered");

    finished.forEach((d) => {
      const name = d.driver_name || "Sem Nome";
      const id = d.driver_id || "sem_motoboy";
      if (!map[id]) {
        map[id] = { id, name, deliveries: 0, totalEarned: 0, paidAmount: 0, due: 0, taxTotal: 0, isFullyPaid: false };
      }
      map[id].deliveries += 1;
      // Repasse do motoboy (75% do valor da corrida)
      map[id].totalEarned += (d.delivery_fee * 0.75);
      // Taxa fixa devida à central por entrega
      map[id].taxTotal += (d.delivery_fee_tax || 0);
    });

    Object.values(map).forEach((drv) => {
      const nameKey = (drv.name || "").trim().toLowerCase();
      const paid = driverPaymentsMap[nameKey] || 0;
      drv.paidAmount = paid;
      drv.due = Math.max(0, drv.totalEarned - paid);
      drv.isFullyPaid = drv.totalEarned > 0 && drv.due <= 0.05;
    });

    return Object.values(map).sort((a, b) => b.due - a.due).slice(0, 30);
  }, [filteredDeliveries, driverPaymentsMap]);

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
    const receivable = Array.isArray(cashFlows) ? cashFlows.filter(c => c.type === 'receivable' || c.type === 'direito').reduce((acc, curr) => acc + Number(curr.amount), 0) : 0;
    const payable = Array.isArray(cashFlows) ? cashFlows.filter(c => c.type === 'payable' || c.type === 'obrigacao').reduce((acc, curr) => acc + Number(curr.amount), 0) : 0;
    return {
      income,
      expense,
      balance: income - expense,
      receivable,
      payable
    };
  }, [cashFlows]);

  const filteredCashFlows = useMemo(() => {
    return cashFlows.filter((item: any) => {
      // 1. Filtro por tipo clicado nos cards de resumo
      if (cfFilterType === "income" && item.type !== "income") return false;
      if (cfFilterType === "expense" && item.type !== "expense") return false;
      if (cfFilterType === "receivable" && item.type !== "receivable" && item.type !== "direito") return false;
      if (cfFilterType === "payable" && item.type !== "payable" && item.type !== "obrigacao") return false;

      // 2. Filtro por busca de texto (descrição, categoria, origem)
      if (cfSearch.trim()) {
        const query = cfSearch.toLowerCase();
        const descMatch = (item.description || "").toLowerCase().includes(query);
        const catMatch = (item.category || "").toLowerCase().includes(query);
        const originMatch = (item.origin || "").toLowerCase().includes(query);
        if (!descMatch && !catMatch && !originMatch) return false;
      }

      // 3. Filtro por categoria
      if (cfCategoryFilter !== "all" && item.category !== cfCategoryFilter) return false;

      // 4. Filtro por forma/origem
      if (cfOriginFilter !== "all" && item.origin !== cfOriginFilter) return false;

      // 5. Filtro por período de data
      if (cfPeriodFilter !== "all" && item.date) {
        const itemDate = new Date(item.date + "T00:00:00");
        const now = new Date();
        if (cfPeriodFilter === "today") {
          const todayStr = now.toISOString().split("T")[0];
          if (item.date !== todayStr) return false;
        } else if (cfPeriodFilter === "yesterday") {
          const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const yestStr = yest.toISOString().split("T")[0];
          if (item.date !== yestStr) return false;
        } else if (cfPeriodFilter === "7d") {
          const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (itemDate < past7) return false;
        } else if (cfPeriodFilter === "month") {
          if (itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) return false;
        } else if (cfPeriodFilter === "last_month") {
          const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
          const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
          if (itemDate.getMonth() !== lastMonth || itemDate.getFullYear() !== lastMonthYear) return false;
        }
      }

      return true;
    });
  }, [cashFlows, cfFilterType, cfSearch, cfCategoryFilter, cfOriginFilter, cfPeriodFilter]);

  const allUniqueCategories = useMemo(() => {
    const set = new Set<string>();
    cashFlows.forEach((c: any) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set).sort();
  }, [cashFlows]);

  const allUniqueOrigins = useMemo(() => {
    const set = new Set<string>();
    cashFlows.forEach((c: any) => {
      if (c.origin) set.add(c.origin);
    });
    return Array.from(set).sort();
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
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Financeiro / Relatórios</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">Análise de dados e exportação</p>
        </div>
        <Button
          onClick={() => {
            if (driverBreakdown.length > 0) {
              const firstDrv = driverBreakdown[0];
              openPayDriverModal({ name: firstDrv.name, id: firstDrv.id || "", due: firstDrv.due, deliveries: firstDrv.deliveries });
            } else {
              openPayDriverModal({ name: "Selecione o Entregador", id: "", due: 0, deliveries: 0 });
            }
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-5 py-2.5 rounded-2xl shadow-lg shadow-emerald-600/20 gap-2 shrink-0 border border-emerald-500/30"
        >
          <DollarSign className="h-5 w-5" />
          Pagar Entregador (Repasse)
        </Button>
      </div>

      <Tabs defaultValue="geral" className="w-full min-w-0">
        <div className="-mx-4 mb-6 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex h-auto w-max min-w-full flex-nowrap gap-1">
            <TabsTrigger value="geral" className="whitespace-nowrap text-xs sm:text-sm">
              <span className="sm:hidden">Corridas</span>
              <span className="hidden sm:inline">Painel Operacional (Corridas)</span>
            </TabsTrigger>
            <TabsTrigger value="creditos" className="whitespace-nowrap text-xs sm:text-sm">
              <span className="sm:hidden">Créditos</span>
              <span className="hidden sm:inline">Créditos de Lojas</span>
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="whitespace-nowrap text-xs sm:text-sm">
              <span className="sm:hidden">Caixa</span>
              <span className="hidden sm:inline">Fluxo de Caixa Operacional</span>
            </TabsTrigger>
          </TabsList>
        </div>


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
                  <Input 
                    type="date" 
                    value={dateFrom} 
                    onChange={(e) => {
                      setPeriod("custom");
                      setDateFrom(e.target.value);
                    }} 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Data Fim</Label>
                  <Input 
                    type="date" 
                    value={dateTo} 
                    onChange={(e) => {
                      setPeriod("custom");
                      setDateTo(e.target.value);
                    }} 
                  />
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
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao">Cartão (Maquininha)</SelectItem>
                      <SelectItem value="convenio">Convênio</SelectItem>
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
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-black text-sm text-foreground">
                              {drv.due.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                          {drv.isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 font-extrabold text-xs px-2.5 py-1 rounded-xl border border-emerald-500/20">
                              <Check className="h-3.5 w-3.5" /> Quitado
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => openPayDriverModal({ name: drv.name, id: drv.id || "", due: drv.due, deliveries: drv.deliveries, isFullyPaid: drv.isFullyPaid })}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 rounded-xl shadow-sm gap-1"
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                              Pagar
                            </Button>
                          )}
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
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                                {drv.isFullyPaid ? "Saldo Restante" : "Ganhos Entregador"}
                              </p>
                              <p className={`font-black text-base mt-1.5 ${drv.isFullyPaid ? "text-emerald-600/60 line-through" : "text-emerald-600"}`}>
                                {drv.due.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </p>
                            </div>
                            {drv.isFullyPaid ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 font-extrabold text-xs px-3 py-1.5 rounded-xl border border-emerald-500/20">
                                <Check className="h-4 w-4" /> Repasse Quitado
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => openPayDriverModal({ name: drv.name, id: drv.id || "", due: drv.due, deliveries: drv.deliveries, isFullyPaid: drv.isFullyPaid })}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 rounded-xl shadow-sm gap-1"
                              >
                                <DollarSign className="h-3.5 w-3.5" />
                                Pagar Repasse
                              </Button>
                            )}
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
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button variant="outline" size="sm" onClick={handlePrint} className="font-bold rounded-xl gap-1.5 h-10 text-xs sm:text-sm">
                    <Printer className="h-4 w-4 shrink-0" /> Imprimir
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="font-bold rounded-xl gap-1.5 h-10 text-xs sm:text-sm">
                    <FileText className="h-4 w-4 shrink-0" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV} className="col-span-2 font-bold rounded-xl gap-1.5 h-10 text-xs sm:col-span-1 sm:text-sm">
                    <Download className="h-4 w-4 shrink-0" /> Exportar CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="-mx-px overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm text-left border-collapse">
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
          <StoreCreditsPanel onCreditPurchased={fetchCashFlow} />
        </TabsContent>

        <TabsContent value="cashflow">
          {/* Top 5 Summary Cards — Botões Interativos de Filtro Rápido */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 mb-6">
            {/* 1. Total de Entradas */}
            <Card
              onClick={() => setCfFilterType(prev => prev === 'income' ? 'all' : 'income')}
              className={`cursor-pointer transition-all duration-200 select-none hover:scale-[1.02] active:scale-[0.98] ${
                cfFilterType === 'income'
                  ? 'border-green-500 bg-green-500/20 ring-2 ring-green-500 shadow-md shadow-green-500/10'
                  : 'border-green-500/30 bg-green-500/5 hover:border-green-500/60'
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400 flex items-center gap-1.5">
                  <span>Total de Entradas</span>
                  {cfFilterType === 'income' && (
                    <span className="text-[9px] bg-green-500 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase">Filtrando</span>
                  )}
                </CardTitle>
                <ArrowUpCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-black text-green-600 dark:text-green-400">
                  {cfStats.income.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 font-semibold">Toque para filtrar entradas</p>
              </CardContent>
            </Card>

            {/* 2. Total de Saídas */}
            <Card
              onClick={() => setCfFilterType(prev => prev === 'expense' ? 'all' : 'expense')}
              className={`cursor-pointer transition-all duration-200 select-none hover:scale-[1.02] active:scale-[0.98] ${
                cfFilterType === 'expense'
                  ? 'border-red-500 bg-red-500/20 ring-2 ring-red-500 shadow-md shadow-red-500/10'
                  : 'border-red-500/30 bg-red-500/5 hover:border-red-500/60'
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400 flex items-center gap-1.5">
                  <span>Total de Saídas</span>
                  {cfFilterType === 'expense' && (
                    <span className="text-[9px] bg-red-500 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase">Filtrando</span>
                  )}
                </CardTitle>
                <ArrowDownCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-black text-red-600 dark:text-red-400">
                  {cfStats.expense.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 font-semibold">Toque para filtrar saídas</p>
              </CardContent>
            </Card>

            {/* 3. Saldo Líquido */}
            <Card
              onClick={() => setCfFilterType('all')}
              className={`cursor-pointer transition-all duration-200 select-none hover:scale-[1.02] active:scale-[0.98] ${
                cfFilterType === 'all'
                  ? 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-500 shadow-md shadow-blue-500/10'
                  : 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500/60'
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <span>Saldo Líquido</span>
                  {cfFilterType === 'all' && (
                    <span className="text-[9px] bg-blue-500 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase">Todos</span>
                  )}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-black ${cfStats.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {cfStats.balance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 font-semibold">Toque para exibir todos</p>
              </CardContent>
            </Card>

            {/* 4. Direitos + */}
            <Card
              onClick={() => setCfFilterType(prev => prev === 'receivable' ? 'all' : 'receivable')}
              className={`cursor-pointer transition-all duration-200 select-none hover:scale-[1.02] active:scale-[0.98] ${
                cfFilterType === 'receivable'
                  ? 'border-amber-500 bg-amber-500/20 ring-2 ring-amber-500 shadow-md shadow-amber-500/10'
                  : 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60'
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <span>Direitos</span> <span className="text-amber-500 font-black">+</span>
                  {cfFilterType === 'receivable' && (
                    <span className="text-[9px] bg-amber-500 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase">Filtrando</span>
                  )}
                </CardTitle>
                <ClockIcon className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                  {cfStats.receivable.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 font-semibold">A receber no futuro</p>
              </CardContent>
            </Card>

            {/* 5. Obrigações - */}
            <Card
              onClick={() => setCfFilterType(prev => prev === 'payable' ? 'all' : 'payable')}
              className={`cursor-pointer transition-all duration-200 select-none hover:scale-[1.02] active:scale-[0.98] ${
                cfFilterType === 'payable'
                  ? 'border-rose-500 bg-rose-500/20 ring-2 ring-rose-500 shadow-md shadow-rose-500/10'
                  : 'border-rose-500/30 bg-rose-500/5 hover:border-rose-500/60'
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <span>Obrigações</span> <span className="text-rose-500 font-black">-</span>
                  {cfFilterType === 'payable' && (
                    <span className="text-[9px] bg-rose-500 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase">Filtrando</span>
                  )}
                </CardTitle>
                <AlertCircle className="h-4 w-4 text-rose-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-black text-rose-600 dark:text-rose-400">
                  {cfStats.payable.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 font-semibold">A pagar no futuro</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Novo Lançamento</CardTitle>
                  <CardDescription>Adicione uma receita, despesa, direito ou obrigação</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddCashFlow} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Tipo de Lançamento</Label>
                      <Select value={cfForm.type} onValueChange={(val) => setCfForm({ ...cfForm, type: val, category: "" })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Entrada (Receita)</SelectItem>
                          <SelectItem value="expense">Saída (Despesa)</SelectItem>
                          <SelectItem value="receivable">Direitos + (A Receber Futuro)</SelectItem>
                          <SelectItem value="payable">Obrigações - (A Pagar Futuro)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Input
                        id="description"
                        placeholder="Ex: Pagamento Motoboy ou Boleto Futuro"
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
                      <Label htmlFor="origin">Origem / Forma</Label>
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
                          <SelectItem value="Boleto">Boleto</SelectItem>
                          <SelectItem value="Faturado">Faturado</SelectItem>
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

                    <Button type="submit" className="w-full font-bold">
                      Salvar Lançamento
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2">
              <Card className="h-full">
                <CardHeader className="border-b pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-bold">Histórico de Movimentações</CardTitle>
                        <span className="text-xs bg-primary/15 text-primary font-bold px-2 py-0.5 rounded-full">
                          {filteredCashFlows.length} de {cashFlows.length}
                        </span>
                      </div>
                      <CardDescription className="text-xs mt-0.5">
                        {cfFilterType === 'income' && "Exibindo apenas: Entradas (Receitas)"}
                        {cfFilterType === 'expense' && "Exibindo apenas: Saídas (Despesas)"}
                        {cfFilterType === 'receivable' && "Exibindo apenas: Direitos a Receber (+)"}
                        {cfFilterType === 'payable' && "Exibindo apenas: Obrigações a Pagar (-)"}
                        {cfFilterType === 'all' && "Lançamentos e movimentações da plataforma"}
                      </CardDescription>
                    </div>

                    {(cfFilterType !== 'all' || cfSearch || cfCategoryFilter !== 'all' || cfOriginFilter !== 'all' || cfPeriodFilter !== 'all') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCfFilterType('all');
                          setCfSearch('');
                          setCfCategoryFilter('all');
                          setCfOriginFilter('all');
                          setCfPeriodFilter('all');
                        }}
                        className="h-8 px-3 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 gap-1.5 self-start sm:self-auto"
                      >
                        <X className="h-3.5 w-3.5" /> Limpar Filtros
                      </Button>
                    )}
                  </div>

                  {/* ── BARRA DE FILTROS DO FLUXO DE CAIXA ── */}
                  <div className="mt-4 space-y-3">
                    {/* Campo de Busca Rápida */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por descrição, motoboy, loja, categoria ou forma..."
                        value={cfSearch}
                        onChange={(e) => setCfSearch(e.target.value)}
                        className="pl-9 h-10 text-xs font-medium rounded-xl"
                      />
                      {cfSearch && (
                        <button
                          onClick={() => setCfSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Filtros em Grid (Categoria, Forma de Pagamento, Período) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Filtro de Categoria */}
                      <div>
                        <Select value={cfCategoryFilter} onValueChange={setCfCategoryFilter}>
                          <SelectTrigger className="h-9 text-xs rounded-xl">
                            <SelectValue placeholder="Todas as Categorias" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas as Categorias</SelectItem>
                            {allUniqueCategories.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Filtro de Origem / Forma */}
                      <div>
                        <Select value={cfOriginFilter} onValueChange={setCfOriginFilter}>
                          <SelectTrigger className="h-9 text-xs rounded-xl">
                            <SelectValue placeholder="Todas as Formas" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas as Formas / Origens</SelectItem>
                            {allUniqueOrigins.map((orig) => (
                              <SelectItem key={orig} value={orig}>{orig}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Filtro de Período */}
                      <div>
                        <Select value={cfPeriodFilter} onValueChange={setCfPeriodFilter}>
                          <SelectTrigger className="h-9 text-xs rounded-xl">
                            <SelectValue placeholder="Todo o Período" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todo o Histórico</SelectItem>
                            <SelectItem value="today">Hoje</SelectItem>
                            <SelectItem value="yesterday">Ontem</SelectItem>
                            <SelectItem value="7d">Últimos 7 dias</SelectItem>
                            <SelectItem value="month">Este Mês</SelectItem>
                            <SelectItem value="last_month">Mês Passado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0 sm:p-6 pt-4">
                  {isLoadingCF ? (
                    <div className="flex justify-center p-8 text-muted-foreground">Carregando fluxo de caixa...</div>
                  ) : filteredCashFlows.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-2xl mx-4 sm:mx-0">
                      <Filter className="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                      <p className="font-bold text-foreground">Nenhum lançamento encontrado para os filtros aplicados.</p>
                      <p className="text-xs text-muted-foreground mt-1">Tente remover os filtros ou buscar por outro termo.</p>
                      {(cfFilterType !== 'all' || cfSearch || cfCategoryFilter !== 'all' || cfOriginFilter !== 'all' || cfPeriodFilter !== 'all') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCfFilterType('all');
                            setCfSearch('');
                            setCfCategoryFilter('all');
                            setCfOriginFilter('all');
                            setCfPeriodFilter('all');
                          }}
                          className="mt-4 font-bold rounded-xl text-xs"
                        >
                          Limpar Todos os Filtros
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 sm:px-0 px-2 max-h-[750px] overflow-y-auto pr-1">
                      {filteredCashFlows.map((item: any) => {
                        const details = getCfTypeDetails(item.type);
                        const IconComp = details.Icon;
                        return (
                          <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-2xl hover:border-primary/40 bg-card hover:shadow-card transition-all relative overflow-hidden">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${details.barColor}`} />
                            
                            <div className="flex items-center gap-4 pl-2 mb-3 sm:mb-0">
                              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${details.badgeBg}`}>
                                <IconComp className="h-6 w-6" />
                              </div>
                              <div>
                                <p className="font-bold text-base text-foreground leading-none">{item.description}</p>
                                <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1 bg-secondary/80 text-secondary-foreground px-2.5 py-1 rounded-md">
                                    <Tag className="h-3 w-3" /> {item.category}
                                  </span>
                                  <span className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-md font-bold">
                                    {details.label}
                                  </span>
                                  {item.origin && (
                                    <span className="flex items-center gap-1 bg-secondary/60 text-secondary-foreground px-2.5 py-1 rounded-md">
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
                              <span className={`text-xl font-black tracking-tight ${details.textColor}`}>
                                {details.sign} {Number(item.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setEditingCf(item)} className="h-8 px-2.5 rounded-xl text-xs font-bold hover:bg-primary/10 hover:text-primary transition-colors gap-1">
                                  <Pencil className="h-3.5 w-3.5" /> Editar
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteCashFlow(item.id)} className="h-8 px-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 transition-colors gap-1">
                                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
                      <SelectItem value="receivable">Direitos + (A Receber Futuro)</SelectItem>
                      <SelectItem value="payable">Obrigações - (A Pagar Futuro)</SelectItem>
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

        {/* Modal de Repasse ao Entregador */}
        <Dialog open={!!payDriverDialogData} onOpenChange={(open) => !open && setPayDriverDialogData(null)}>
          <DialogContent className="w-[94vw] sm:max-w-[520px] rounded-3xl p-6 bg-background border border-border shadow-2xl overflow-hidden">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-foreground">
                <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <DollarSign className="h-6 w-6" />
                </div>
                Pagar Repasse ao Entregador
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Este pagamento será registrado e deduzido como <strong className="text-rose-500 font-bold">Saída (Repasse Motoboy)</strong> do seu Fluxo de Caixa.
              </DialogDescription>
            </DialogHeader>

            {payDriverDialogData && (
              <form onSubmit={handleConfirmPayDriver} className="space-y-4 pt-3 w-full overflow-hidden">
                <div className="space-y-1.5 w-full">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Buscar ou Selecionar Entregador</Label>
                  <div className="relative w-full mb-2">
                    <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="🔍 Digite o nome do entregador..."
                      value={driverSearchTerm}
                      onChange={(e) => setDriverSearchTerm(e.target.value)}
                      className="pl-10 h-11 rounded-2xl border border-input bg-card font-semibold w-full text-xs sm:text-sm"
                    />
                  </div>
                  <Select
                    value={payDriverDialogData.name}
                    onValueChange={(selectedName) => {
                      const found = driverBreakdown.find(d => d.name === selectedName);
                      if (found) {
                        openPayDriverModal({ name: found.name, id: found.id || "", due: found.due, deliveries: found.deliveries });
                      }
                    }}
                  >
                    <SelectTrigger className="font-bold rounded-2xl h-12 w-full border-border bg-card">
                      <SelectValue placeholder="Selecione um entregador" className="truncate" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[90vw] sm:max-w-[480px] max-h-[220px]">
                      {driverBreakdown
                        .filter(drv => drv.name.toLowerCase().includes((driverSearchTerm || "").toLowerCase()))
                        .map((drv) => (
                          <SelectItem key={drv.name} value={drv.name} className="font-medium text-xs sm:text-sm">
                            <span className="truncate">
                              {drv.name} ({drv.deliveries} entregas — {drv.isFullyPaid ? "✅ Quitado" : `${drv.due.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} a pagar`})
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1 w-full overflow-hidden">
                  <p className="text-[11px] text-emerald-600 uppercase font-extrabold tracking-wider">Entregador Beneficiário</p>
                  <p className="text-lg font-black text-foreground truncate">{payDriverDialogData.name}</p>
                  <p className="text-xs text-muted-foreground font-semibold">
                    Volume acumulado: <strong className="text-foreground">{payDriverDialogData.deliveries} entregas</strong> (Saldo Devido: <strong className="text-emerald-600 font-bold">{payDriverDialogData.due.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>)
                  </p>
                  {payDriverDialogData.due <= 0.05 && (
                    <p className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
                      <Check className="h-4 w-4" /> Este entregador já possui todos os repasses do período quitados.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <div className="space-y-1.5 w-full">
                    <Label htmlFor="payAmount" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Valor do Repasse (R$)</Label>
                    <CurrencyInput
                      id="payAmount"
                      value={payAmount}
                      onChangeValue={(v) => setPayAmount(v)}
                      className="h-12 w-full rounded-2xl border border-input bg-card px-4 py-2 text-base font-bold shadow-sm"
                      required
                    />
                  </div>

                  <div className="space-y-1.5 w-full">
                    <Label htmlFor="payMethod" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Forma de Pagamento</Label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger className="font-bold rounded-2xl h-12 w-full border-border bg-card">
                        <SelectValue placeholder="Forma de pagamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pix" className="font-semibold">Pix</SelectItem>
                        <SelectItem value="Dinheiro" className="font-semibold">Dinheiro</SelectItem>
                        <SelectItem value="Transferência" className="font-semibold">Transferência Bancária</SelectItem>
                        <SelectItem value="Boleto" className="font-semibold">Boleto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5 w-full">
                  <Label htmlFor="payNotes" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Observação (Opcional)</Label>
                  <Input
                    id="payNotes"
                    placeholder="Ex: Quitação semanal de corridas"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="h-12 rounded-2xl border-input bg-card px-4 font-medium"
                  />
                </div>

                <DialogFooter className="pt-3 border-t border-border flex-row gap-2 justify-end w-full">
                  <Button type="button" variant="outline" onClick={() => setPayDriverDialogData(null)} className="rounded-2xl h-12 px-5 font-bold flex-1 sm:flex-none">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submittingPay || payDriverDialogData.due <= 0.05} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl h-12 px-6 gap-2 flex-1 sm:flex-none shadow-lg shadow-emerald-600/20 disabled:opacity-50">
                    <DollarSign className="h-5 w-5" />
                    {submittingPay ? "Efetuando..." : payDriverDialogData.due <= 0.05 ? "Já Quitado" : "Confirmar Repasse"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </Tabs>
    </AdminLayout>
  );
}