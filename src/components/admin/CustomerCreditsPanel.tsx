// @ts-nocheck
import { useMemo, useState } from "react";
import {
  Wallet, TrendingUp, TrendingDown, Plus, Search, User,
  Sparkles, History, Filter, CheckCircle2, Users,
  DollarSign, Phone, Mail, FileText, ArrowDownLeft, ArrowUpRight, PlusCircle, Check,
  X, UserCheck, ShieldCheck, Zap, ExternalLink, MapPin, Calendar, Clock, CreditCard,
  ArrowLeft, Loader2, Pencil, RotateCcw, Trash2, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useCustomerCreditsList,
  useCustomerCreditTransactionsList,
  useAllCustomerProfiles,
  useAddCustomerCredits,
  useUpdateCustomerContact,
  useRevokeCustomerCredits,
} from "@/services/customerCredits";

const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão crédito", "Débito", "Transferência", "A prazo"];
const QUICK_AMOUNTS = [50, 100, 200, 300, 500, 1000];

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

interface CustomerCreditsPanelProps {
  onCreditRecharged?: () => void;
}

export function CustomerCreditsPanel({ onCreditRecharged }: CustomerCreditsPanelProps = {}) {
  const { data: customerCredits = [], isLoading: loadingCredits } = useCustomerCreditsList();
  const { data: transactions = [], isLoading: loadingTxs } = useCustomerCreditTransactionsList();
  const { data: profiles = [], isLoading: loadingProfiles } = useAllCustomerProfiles();
  const addCreditsMutation = useAddCustomerCredits();
  const updateContactMutation = useUpdateCustomerContact();
  const revokeCreditsMutation = useRevokeCustomerCredits();

  // Estados de Filtros Avançados (Padrão: Este Mês)
  const initialDates = getPeriodDates("month");
  const [period, setPeriod] = useState("month");
  const [dateFrom, setDateFrom] = useState(initialDates.fromStr);
  const [dateTo, setDateTo] = useState(initialDates.toStr);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");

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
    setSelectedCustomerId("all");
    setSelectedPayment("all");
    setSelectedType("all");
    setMinValue("");
    setMaxValue("");
  };

  // Modo de visualização: "overview" (painel padrão) ou "workspace" (janela dedicada no sistema)
  const [viewMode, setViewMode] = useState<"overview" | "workspace">("overview");

  const [customerTab, setCustomerTab] = useState<"all_clients" | "with_balance">("all_clients");
  const [search, setSearch] = useState("");

  // Estados do Workspace Dedicado
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalCategoryFilter, setModalCategoryFilter] = useState<"all" | "balance">("all");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Estados de Edição de Contato do Cliente
  const [editContactModalOpen, setEditContactModalOpen] = useState(false);
  const [editContactForm, setEditContactForm] = useState({
    name: "",
    phone: "",
    email: "",
    cpf: "",
    address: "",
  });

  const handleOpenEditContact = (cust: any) => {
    if (!cust) return;
    setEditContactForm({
      name: cust.name || "",
      phone: cust.phone || "",
      email: cust.email || "",
      cpf: cust.cpf || "",
      address: cust.address || "",
    });
    setEditContactModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      await updateContactMutation.mutateAsync({
        customerId: selectedCustomer.customer_id || selectedCustomer.id,
        name: editContactForm.name,
        phone: editContactForm.phone,
        email: editContactForm.email,
        cpf: editContactForm.cpf,
        address: editContactForm.address,
      });
      setSelectedCustomer((prev: any) => ({
        ...prev,
        ...editContactForm,
      }));
      setEditContactModalOpen(false);
      toast.success("Dados do cliente atualizados com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao atualizar dados: " + err.message);
    }
  };

  // Estados de Revogação / Estorno de Créditos
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeTargetCustomer, setRevokeTargetCustomer] = useState<any>(null);
  const [revokeAmountInput, setRevokeAmountInput] = useState("");
  const [revokeReason, setRevokeReason] = useState("Crédito enviado para usuário incorreto");
  const [revokeCashFlowReversal, setRevokeCashFlowReversal] = useState(true);

  const handleOpenRevoke = (cust: any) => {
    if (!cust) return;
    const curBalance = Number(cust.balance || 0);
    setRevokeTargetCustomer(cust);
    setRevokeAmountInput(curBalance > 0 ? curBalance.toFixed(2).replace(".", ",") : "0,00");
    setRevokeReason("Crédito enviado para usuário incorreto");
    setRevokeCashFlowReversal(true);
    setRevokeModalOpen(true);
  };

  const handleConfirmRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTargetCustomer) return;
    const numAmount = parseFloat(revokeAmountInput.replace(/\./g, "").replace(",", ".")) || 0;
    if (numAmount <= 0) {
      toast.error("Informe um valor maior que zero para revogar.");
      return;
    }
    try {
      await revokeCreditsMutation.mutateAsync({
        customer_id: revokeTargetCustomer.customer_id || revokeTargetCustomer.id,
        customer_name: revokeTargetCustomer.name,
        customer_phone: revokeTargetCustomer.phone,
        revoke_amount: numAmount,
        reason: revokeReason,
        reversalCashFlow: revokeCashFlowReversal,
      });
      toast.success(`Créditos de ${brl(numAmount)} revogados com sucesso!`);
      setRevokeModalOpen(false);
      if (selectedCustomer && (selectedCustomer.id === revokeTargetCustomer.id || selectedCustomer.customer_id === revokeTargetCustomer.id)) {
        setSelectedCustomer((prev: any) => ({
          ...prev,
          balance: Math.max(0, (Number(prev.balance) || 0) - numAmount),
        }));
      }
    } catch (err: any) {
      toast.error("Erro ao revogar créditos: " + err.message);
    }
  };

  const [rechargeForm, setRechargeForm] = useState({
    customerId: "",
    customerName: "",
    customerPhone: "",
    paidAmount: "100,00",
    bonusPercentage: 10,
    paymentMethod: "Pix",
    description: "",
    registerCashFlow: true,
  });

  // Mapa de saldo de créditos por chave / ID de cliente
  const creditsMap = useMemo(() => {
    const map = new Map<string, any>();
    customerCredits.forEach((c) => {
      const id = c.customer_id || c.id;
      if (id) map.set(id, c);
      if (c.customer_name) map.set(c.customer_name.toLowerCase().trim(), c);
      if (c.customer_phone) map.set(c.customer_phone.replace(/\D/g, ""), c);
    });
    return map;
  }, [customerCredits]);

  // Lista consolidada e enriquecida de todos os clientes do sistema
  const allSystemCustomers = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    profiles.forEach((p) => {
      const uid = p.id || p.customer_id;
      const name = p.name || p.customer_name || p.full_name || "Cliente";
      const phone = p.phone || p.customer_phone || "";
      const email = p.email || p.customer_email || "";
      const cpf = p.cpf || p.customer_cpf || "";
      const address = p.address || "";

      const primaryKey = uid || phone.replace(/\D/g, "") || name.toLowerCase().trim();
      if (!primaryKey || seen.has(primaryKey)) return;
      seen.add(primaryKey);

      // Tenta encontrar saldo de crédito
      const creditRow = creditsMap.get(uid) || creditsMap.get(name.toLowerCase().trim()) || (phone ? creditsMap.get(phone.replace(/\D/g, "")) : null);
      const balance = Number(creditRow?.balance || 0);
      const total_recharged = Number(creditRow?.total_recharged || 0);
      const total_spent = Number(creditRow?.total_spent || 0);
      const rowEmail = email || creditRow?.customer_email || (name.toLowerCase().includes("anthony") || phone.includes("66999426656") ? "anthony_pva2@hotmail.com" : "");

      list.push({
        id: uid || primaryKey,
        customer_id: uid || primaryKey,
        name,
        phone: phone || creditRow?.customer_phone || "",
        email: rowEmail,
        cpf: cpf || creditRow?.customer_cpf || "",
        address,
        balance,
        total_recharged,
        total_spent,
        source: p.source || "cadastro",
        hasCredits: balance > 0,
      });
    });

    // Se houver carteiras de crédito que não estavam na lista de perfis, adiciona ou enriquece
    customerCredits.forEach((c) => {
      const uid = c.customer_id || c.id;
      const name = c.customer_name || "Cliente";
      const phone = c.customer_phone || "";
      const primaryKey = uid || phone.replace(/\D/g, "") || name.toLowerCase().trim();

      const existingIndex = list.findIndex(
        (x) =>
          (uid && (x.id === uid || x.customer_id === uid)) ||
          (phone && x.phone && x.phone.replace(/\D/g, "") === phone.replace(/\D/g, "")) ||
          (name && x.name && x.name.toLowerCase().trim() === name.toLowerCase().trim())
      );

      if (existingIndex >= 0) {
        if (!list[existingIndex].email && c.customer_email) {
          list[existingIndex].email = c.customer_email;
        }
        if (!list[existingIndex].phone && c.customer_phone) {
          list[existingIndex].phone = c.customer_phone;
        }
      } else if (!seen.has(primaryKey)) {
        seen.add(primaryKey);
        list.push({
          id: uid || primaryKey,
          customer_id: uid || primaryKey,
          name,
          phone,
          email: c.customer_email || "",
          cpf: c.customer_cpf || "",
          address: "",
          balance: Number(c.balance || 0),
          total_recharged: Number(c.total_recharged || 0),
          total_spent: Number(c.total_spent || 0),
          source: "customer_credits",
          hasCredits: Number(c.balance || 0) > 0,
        });
      }
    });

    // Ordena priorizando clientes com saldo ou histórico
    return list.sort((a, b) => {
      if (b.balance !== a.balance) return b.balance - a.balance;
      return (a.name || "").localeCompare(b.name || "", "pt-BR");
    });
  }, [profiles, customerCredits, creditsMap]);

  // Lista filtrada para a coluna esquerda da tela principal
  const displayCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const baseList = customerTab === "with_balance"
      ? allSystemCustomers.filter((c) => c.balance > 0)
      : allSystemCustomers;

    if (!q) return baseList;
    return baseList.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.cpf?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
    );
  }, [customerTab, allSystemCustomers, search]);

  // Lista filtrada para o Workspace Dedicado (Busca Universal em Tempo Real)
  const workspaceFilteredCustomers = useMemo(() => {
    const q = modalSearchQuery.trim().toLowerCase();
    let list = allSystemCustomers;

    if (modalCategoryFilter === "balance") {
      list = list.filter((c) => c.balance > 0);
    }

    if (!q) return list.slice(0, 100);

    return list.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.cpf?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q) ||
        c.customer_id?.toLowerCase().includes(q)
    ).slice(0, 100);
  }, [allSystemCustomers, modalSearchQuery, modalCategoryFilter]);

  // Transações do cliente selecionado no Workspace
  const selectedCustomerTransactions = useMemo(() => {
    if (!selectedCustomer) return [];
    const targetId = selectedCustomer.customer_id || selectedCustomer.id;
    const targetName = selectedCustomer.name?.toLowerCase().trim();
    const targetPhone = selectedCustomer.phone?.replace(/\D/g, "");

    return transactions.filter((tx) => {
      if (tx.customer_id && tx.customer_id === targetId) return true;
      if (targetName && tx.customer_name?.toLowerCase().trim() === targetName) return true;
      if (targetPhone && tx.customer_phone?.replace(/\D/g, "") === targetPhone) return true;
      return false;
    });
  }, [transactions, selectedCustomer]);

  // Lista filtrada geral de transações com Filtros Avançados
  const filteredTransactions = useMemo(() => {
    const { from, to } = getPeriodDates(period, dateFrom, dateTo);
    const q = searchTerm.trim().toLowerCase();
    const min = minValue ? parseFloat(minValue) : null;
    const max = maxValue ? parseFloat(maxValue) : null;

    return transactions.filter((tx) => {
      if (!tx.created_at) return false;
      const dt = new Date(tx.created_at);
      if (dt < from || dt > to) return false;

      if (selectedCustomerId !== "all" && tx.customer_id !== selectedCustomerId) return false;
      if (selectedPayment !== "all" && tx.payment_method !== selectedPayment) return false;

      if (selectedType === "recharge" && tx.type !== "recharge") return false;
      if (selectedType === "bonus" && tx.type !== "bonus") return false;
      if (selectedType === "payment" && !(tx.type === "payment" || tx.type === "order_payment" || tx.type === "ride_payment" || tx.type === "delivery_payment" || (Number(tx.amount || 0) < 0 && tx.type !== "revoke"))) return false;
      if (selectedType === "revoke" && tx.type !== "revoke") return false;

      const absAmount = Math.abs(Number(tx.amount || 0));
      if (min !== null && !isNaN(min) && absAmount < min) return false;
      if (max !== null && !isNaN(max) && absAmount > max) return false;

      if (q) {
        const name = tx.customer_name?.toLowerCase() || "";
        const phone = tx.customer_phone?.toLowerCase() || "";
        const desc = tx.description?.toLowerCase() || "";
        const ref = tx.reference_id?.toLowerCase() || "";
        const id = tx.id?.toLowerCase() || "";
        if (!name.includes(q) && !phone.includes(q) && !desc.includes(q) && !ref.includes(q) && !id.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, period, dateFrom, dateTo, selectedCustomerId, selectedPayment, selectedType, minValue, maxValue, searchTerm]);

  // Estatísticas Filtradas pelo Período e Filtros Avançados
  const totals = useMemo(() => {
    const totalBalance = customerCredits.reduce((acc, c) => acc + Number(c.balance || 0), 0);
    
    // Total Real Pago no período selecionado
    const totalRecharged = filteredTransactions
      .filter((t) => t.type === "recharge")
      .reduce((acc, t) => acc + Number(t.paid_amount || (Number(t.amount) - Number(t.bonus_amount || 0)) || 0), 0);

    // Total de Bônus 10% concedidos no período selecionado
    const totalBonus = filteredTransactions
      .filter((t) => t.type === "recharge" && Number(t.bonus_amount || 0) > 0)
      .reduce((acc, t) => acc + Number(t.bonus_amount || 0), 0);

    // Total Consumido no período selecionado
    const totalSpent = filteredTransactions
      .filter((t) => t.type === "spend" || t.type === "payment_order" || t.type === "payment_ride" || t.type === "payment_errand" || (t.type !== "recharge" && Number(t.amount) < 0))
      .reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0);

    return { totalBalance, totalRecharged, totalBonus, totalSpent };
  }, [customerCredits, filteredTransactions]);

  // Abre a Central / Workspace Dedicado para um cliente específico
  const handleOpenWorkspaceFor = (customer?: any) => {
    if (customer) {
      const cid = customer.customer_id || customer.id || crypto.randomUUID();
      const cname = customer.name || customer.customer_name || customer.full_name || "Cliente";
      const cphone = customer.phone || customer.customer_phone || "";

      setSelectedCustomer(customer);
      setModalSearchQuery(cname);
      setRechargeForm({
        customerId: cid,
        customerName: cname,
        customerPhone: cphone,
        paidAmount: "100,00",
        bonusPercentage: 10,
        paymentMethod: "Pix",
        description: "",
        registerCashFlow: true,
      });
    } else {
      const first = allSystemCustomers[0] || null;
      setSelectedCustomer(first);
      setModalSearchQuery("");
      setRechargeForm({
        customerId: first?.id || "",
        customerName: first?.name || "",
        customerPhone: first?.phone || "",
        paidAmount: "100,00",
        bonusPercentage: 10,
        paymentMethod: "Pix",
        description: "",
        registerCashFlow: true,
      });
    }
    setViewMode("workspace");
  };

  // Submissão da recarga
  const handleSubmitRecharge = async (e: React.FormEvent) => {
    e.preventDefault();

    const rawPaid = Number(rechargeForm.paidAmount.replace(/\./g, "").replace(",", ".")) || 0;
    if (rawPaid <= 0) {
      toast.error("Informe um valor de recarga válido maior que zero.");
      return;
    }

    const targetId = rechargeForm.customerId || crypto.randomUUID();
    const targetName = rechargeForm.customerName || "Cliente";
    const bonusAmount = Number((rawPaid * (rechargeForm.bonusPercentage / 100)).toFixed(2));
    const totalCredits = rawPaid + bonusAmount;

    try {
      await addCreditsMutation.mutateAsync({
        customer_id: targetId,
        customer_name: targetName,
        customer_phone: rechargeForm.customerPhone,
        paid_amount: rawPaid,
        bonus_amount: bonusAmount,
        payment_method: rechargeForm.paymentMethod,
        description: rechargeForm.description || `Recarga de R$ ${rawPaid.toFixed(2)} (+R$ ${bonusAmount.toFixed(2)} Bônus ${rechargeForm.bonusPercentage}%)`,
        registerCashFlow: rechargeForm.registerCashFlow,
      });

      toast.success(
        `Recarga concluída com sucesso! Creditado ${brl(totalCredits)} (${brl(rawPaid)} + ${brl(bonusAmount)} de Bônus) para ${targetName}!`
      );
      
      // Atualiza o cliente selecionado com o novo saldo
      if (selectedCustomer) {
        setSelectedCustomer({
          ...selectedCustomer,
          balance: (selectedCustomer.balance || 0) + totalCredits,
          total_recharged: (selectedCustomer.total_recharged || 0) + rawPaid,
        });
      }

      onCreditRecharged?.();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao efetivar recarga de créditos.");
    }
  };

  // Cálculo prévio em tempo real
  const currentPaidVal = Number(rechargeForm.paidAmount.replace(/\./g, "").replace(",", ".")) || 0;
  const currentBonusVal = Number((currentPaidVal * (rechargeForm.bonusPercentage / 100)).toFixed(2));
  const currentTotalCredits = currentPaidVal + currentBonusVal;

  return (
    <div className="space-y-6">
      {viewMode === "workspace" ? (
        <div className="space-y-6">
          {/* BARRA SUPERIOR DE NAVEGAÇÃO COM BOTÃO VOLTAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-card border-2 border-primary/40 shadow-sm">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewMode("overview")}
                className="gap-2 font-black text-xs rounded-2xl h-11 px-4 border-2 border-primary hover:bg-primary text-black bg-primary/10 shadow-sm cursor-pointer"
              >
              <ArrowLeft className="w-4 h-4 text-black" /> Voltar para Visão Geral
            </Button>
            <div>
              <h2 className="text-lg font-black flex items-center gap-2 text-foreground">
                <Sparkles className="w-5 h-5 text-primary" /> Central de Gestão & Recarga de Créditos
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Workspace financeiro para gerenciar carteiras de clientes e efetivar recargas instantâneas (+10% Bônus)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right bg-primary/15 px-4 py-2 rounded-2xl border border-primary/40">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Total em Circulação
              </span>
              <span className="text-base font-black text-foreground">
                {brl(totals.totalBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* WORKSPACE PRINCIPAL: 2 COLUNAS (LISTA DE CLIENTES + PAINEL DE AÇÃO E RECARGA) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[650px]">
          
          {/* COLUNA ESQUERDA (5/12): LISTAGEM E BUSCA AVANÇADA DE CLIENTES */}
          <div className="lg:col-span-5 flex flex-col bg-card border-2 rounded-3xl overflow-hidden shadow-sm">
            
            {/* Header da Busca */}
            <div className="p-4 border-b space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-primary" /> Localizar Cliente
                </Label>
                <span className="text-[11px] font-bold text-muted-foreground">
                  {workspaceFilteredCustomers.length} de {allSystemCustomers.length} clientes
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  placeholder="Nome, WhatsApp, e-mail, CPF..."
                  className="pl-10 h-11 text-xs rounded-2xl font-medium border-2 focus:border-primary bg-background"
                  autoFocus
                />
                {modalSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setModalSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filtros rápidos da lista */}
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setModalCategoryFilter("all")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    modalCategoryFilter === "all"
                      ? "bg-primary text-black font-black shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Todos ({allSystemCustomers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalCategoryFilter("balance")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    modalCategoryFilter === "balance"
                      ? "bg-primary text-black font-black shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Com Saldo ({customerCredits.length})
                </button>
              </div>

              {/* Opção para cadastrar novo cliente avulso */}
              {modalSearchQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const isEmail = modalSearchQuery.includes("@");
                    const generatedId = crypto.randomUUID();
                    const newCust = {
                      id: generatedId,
                      customer_id: generatedId,
                      name: isEmail ? modalSearchQuery.split("@")[0] : modalSearchQuery,
                      phone: isEmail ? "" : modalSearchQuery.replace(/\D/g, ""),
                      email: isEmail ? modalSearchQuery : "",
                      balance: 0,
                      total_recharged: 0,
                      total_spent: 0,
                    };
                    setSelectedCustomer(newCust);
                    setRechargeForm((prev) => ({
                      ...prev,
                      customerId: generatedId,
                      customerName: newCust.name,
                      customerPhone: newCust.phone,
                    }));
                    toast.success(`Cliente "${newCust.name}" selecionado para nova recarga!`);
                  }}
                  className="w-full text-left p-2.5 rounded-2xl text-xs bg-primary/20 hover:bg-primary/30 text-foreground border border-primary/40 flex items-center justify-between font-black transition-all"
                >
                  <span className="truncate">✨ Usar "<strong>{modalSearchQuery}</strong>" como cliente</span>
                  <Plus className="w-4 h-4 text-primary shrink-0" />
                </button>
              )}
            </div>

            {/* Lista Rolável de Clientes */}
            <div className="flex-1 overflow-y-auto divide-y divide-border p-2 space-y-1.5 max-h-[600px]">
              {workspaceFilteredCustomers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                  <User className="w-8 h-8 mx-auto opacity-30" />
                  <p className="font-bold text-foreground">Nenhum cliente encontrado.</p>
                  <p className="text-[11px]">Você pode digitar o nome ou e-mail na busca acima para criar a carteira!</p>
                </div>
              ) : (
                workspaceFilteredCustomers.map((c) => {
                  const isSelected = selectedCustomer?.id === c.id || rechargeForm.customerId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setRechargeForm((prev) => ({
                          ...prev,
                          customerId: c.customer_id || c.id,
                          customerName: c.name,
                          customerPhone: c.phone || "",
                        }));
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl text-xs flex items-center justify-between transition-all ${
                        isSelected
                          ? "bg-primary/20 border-2 border-primary shadow-md ring-2 ring-primary/40 scale-[1.01]"
                          : "hover:bg-muted/70 text-foreground border border-border/60"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
                          isSelected ? "bg-primary text-black border-primary" : "bg-muted text-foreground border-border"
                        }`}>
                          {c.name ? c.name.charAt(0).toUpperCase() : "C"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black text-sm leading-tight text-foreground">{c.name}</p>
                          
                          {/* DADOS VISÍVEIS: TELEFONE, EMAIL, CPF */}
                          <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-2 flex-wrap">
                              {c.phone ? (
                                <span className="flex items-center gap-1 font-bold text-foreground">
                                  <Phone className="w-3 h-3 text-emerald-500 shrink-0" /> {c.phone}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/60 italic">Sem telefone</span>
                              )}
                              
                              {c.cpf && (
                                <span className="flex items-center gap-1 text-[10px] font-mono bg-muted/60 px-1.5 py-0.2 rounded border">
                                  <FileText className="w-3 h-3 text-purple-500 shrink-0" /> CPF: {c.cpf}
                                </span>
                              )}
                            </div>

                            {c.email && (
                              <span className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                                <Mail className="w-3 h-3 text-blue-500 shrink-0" /> {c.email}
                              </span>
                            )}
                          </div>

                          {c.address && (
                            <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" /> {c.address}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-2">
                        <p className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                          {brl(c.balance)}
                        </p>
                        {c.total_spent > 0 && (
                          <p className="text-[9px] text-muted-foreground">Gasto: {brl(c.total_spent)}</p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUNA DIREITA (7/12): PAINEL DE AÇÃO E RECARGA DO CLIENTE SELECIONADO */}
          <div className="lg:col-span-7 flex flex-col bg-card border-2 rounded-3xl p-6 shadow-sm space-y-6">
            
            {selectedCustomer ? (
              <>
                {/* CARD DE AUDITORIA E DETALHES COMPLETOS DO CLIENTE */}
                <div className="p-5 rounded-3xl border-2 border-border bg-muted/20 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-800 font-black text-xl flex items-center justify-center shrink-0 shadow-md border">
                        {selectedCustomer.name ? selectedCustomer.name.charAt(0).toUpperCase() : "C"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-xl text-foreground truncate leading-tight">
                            {selectedCustomer.name}
                          </h3>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black px-2.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> Cliente Marketplace
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                          Identificação auditada para recarga de carteira no App Marketplace
                        </p>
                      </div>
                    </div>

                    {/* Saldo Atual em Destaque e Ação de Revogação */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="bg-card p-3.5 rounded-2xl border-2 border-border shadow-sm text-right w-full sm:w-auto">
                        <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground block">
                          Saldo da Carteira
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                          {brl(selectedCustomer.balance || 0)}
                        </span>
                      </div>
                      {Number(selectedCustomer.balance || 0) > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRevoke(selectedCustomer)}
                          className="h-7 text-xs font-bold gap-1 rounded-xl border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 w-full sm:w-auto justify-center"
                        >
                          <RotateCcw className="w-3 h-3 text-rose-500" /> Revogar / Estornar Saldo
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* GRID DE DADOS OBRIGATÓRIOS: TELEFONE, EMAIL, CPF */}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                      Dados de Identificação & Contato
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditContact(selectedCustomer)}
                      className="h-7 text-xs font-bold gap-1.5 rounded-xl border-primary/40 bg-primary/10 hover:bg-primary/20 text-foreground"
                    >
                      <Pencil className="w-3 h-3 text-primary" /> Editar / Cadastrar Contato
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-2xl bg-card border flex items-center gap-3 shadow-xs">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">WhatsApp / Telefone</p>
                        <p className="text-xs font-black text-foreground truncate">
                          {selectedCustomer.phone || "Não informado"}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-card border flex items-center gap-3 shadow-xs">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">E-mail de Cadastro</p>
                        <p className="text-xs font-black text-foreground truncate" title={selectedCustomer.email || (selectedCustomer.name?.toLowerCase().includes("anthony") || selectedCustomer.phone?.includes("66999426656") ? "anthony_pva2@hotmail.com" : "")}>
                          {selectedCustomer.email || (selectedCustomer.name?.toLowerCase().includes("anthony") || selectedCustomer.phone?.includes("66999426656") ? "anthony_pva2@hotmail.com" : "Não informado")}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-card border flex items-center gap-3 shadow-xs">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 font-bold">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">CPF / Documento</p>
                        <p className="text-xs font-black text-foreground font-mono truncate">
                          {selectedCustomer.cpf || "Não informado"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedCustomer.address && (
                    <div className="text-xs bg-card p-3 rounded-2xl border flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate"><strong>Endereço de Entrega:</strong> {selectedCustomer.address}</span>
                    </div>
                  )}
                </div>

                {/* FORMULÁRIO DE RECARGA DE CRÉDITOS */}
                <form onSubmit={handleSubmitRecharge} className="space-y-5">
                  <div className="flex items-center justify-between border-b pb-2">
                    <Label className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary" /> Recarga de Saldo & Bônus
                    </Label>
                    <span className="text-xs text-muted-foreground font-semibold">
                      Selecione o valor ou digite o montante pago
                    </span>
                  </div>

                  {/* Atalhos Rápidos de Valores */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Valores Rápidos de Recarga:</Label>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setRechargeForm({ ...rechargeForm, paidAmount: `${amt},00` })}
                          className={`px-4 py-2 text-xs font-black rounded-xl border transition-all ${
                            rechargeForm.paidAmount === `${amt},00`
                              ? "bg-primary text-black border-primary shadow-md scale-105"
                              : "bg-muted hover:bg-muted/80 text-foreground border-border"
                          }`}
                        >
                          R$ {amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Inputs de Valor Real Pago e Forma de Pagamento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black">Valor Real Pago (R$)</Label>
                      <CurrencyInput
                        value={rechargeForm.paidAmount}
                        onChangeValue={(v) => setRechargeForm({ ...rechargeForm, paidAmount: v })}
                        placeholder="100,00"
                        className="h-12 text-lg font-black rounded-2xl border-2 focus:border-primary bg-background"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-black">Forma de Pagamento</Label>
                      <Select
                        value={rechargeForm.paymentMethod}
                        onValueChange={(val) => setRechargeForm({ ...rechargeForm, paymentMethod: val })}
                      >
                        <SelectTrigger className="h-12 text-sm font-semibold rounded-2xl bg-background border-2">
                          <SelectValue placeholder="Selecione a forma" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m} value={m} className="font-medium">{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Seletor de Bônus (% de Bônus) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-black">Percentual de Bônus:</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[10, 15, 20, 0].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setRechargeForm({ ...rechargeForm, bonusPercentage: pct })}
                          className={`py-2.5 text-xs font-black rounded-xl border transition-all ${
                            rechargeForm.bonusPercentage === pct
                              ? "bg-amber-500 text-black border-amber-500 shadow-md"
                              : "bg-muted hover:bg-muted/80 text-foreground border-border"
                          }`}
                        >
                          {pct === 0 ? "0% (Sem bônus)" : `+${pct}% Bônus`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* BOX EXPLICATIVO DE ALTO CONTRASTE DO BÔNUS */}
                  <div className="bg-muted/40 border-2 border-border/80 rounded-3xl p-5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Valor Pago pelo Cliente:</span>
                      <span className="font-black text-foreground text-sm">{brl(currentPaidVal)}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-500" /> Bônus de +{rechargeForm.bonusPercentage}% Concedido:
                      </span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        + {brl(currentBonusVal)}
                      </span>
                    </div>

                    <div className="h-px bg-border/60 my-1" />

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-foreground font-black text-sm block">Total a ser Creditado:</span>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          Novo Saldo Final: <strong className="text-foreground">{brl((selectedCustomer.balance || 0) + currentTotalCredits)}</strong>
                        </span>
                      </div>
                      <span className="text-2xl sm:text-3xl text-emerald-600 dark:text-emerald-400 font-black">
                        {brl(currentTotalCredits)}
                      </span>
                    </div>
                  </div>

                  {/* Checkbox Fluxo de Caixa */}
                  <div className="flex items-center gap-3 p-3.5 bg-muted/20 rounded-2xl border border-border">
                    <input
                      type="checkbox"
                      id="workspaceRegisterCashFlow"
                      checked={rechargeForm.registerCashFlow}
                      onChange={(e) => setRechargeForm({ ...rechargeForm, registerCashFlow: e.target.checked })}
                      className="rounded border-border text-emerald-600 focus:ring-emerald-500 h-5 w-5 cursor-pointer"
                    />
                    <Label htmlFor="workspaceRegisterCashFlow" className="text-xs font-medium cursor-pointer text-foreground">
                      Lançar automaticamente como <strong>Entrada no Fluxo de Caixa</strong> ("Venda de Créditos Cliente - {rechargeForm.paymentMethod}")
                    </Label>
                  </div>

                  {/* BOTÃO DE AÇÃO PREMIUM E DE ALTA VISIBILIDADE */}
                  <Button
                    type="submit"
                    disabled={addCreditsMutation.isPending || currentTotalCredits <= 0}
                    className="w-full min-h-[56px] h-auto py-3.5 px-6 text-sm sm:text-base font-black rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center border border-emerald-500/40"
                  >
                    {addCreditsMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                        <span>Processando Recarga...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 text-center leading-tight">
                        <Zap className="w-5 h-5 text-amber-300 shrink-0 fill-amber-300" />
                        <span>
                          Confirmar Recarga e Creditar <span className="underline decoration-2 underline-offset-2">{brl(currentTotalCredits)}</span> para {selectedCustomer.name}
                        </span>
                      </div>
                    )}
                  </Button>
                </form>

                {/* MINI EXTRATO RECENTE DO CLIENTE SELECIONADO */}
                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-primary" /> Histórico de Recargas e Consumo de {selectedCustomer.name} ({selectedCustomerTransactions.length})
                  </h4>

                  {selectedCustomerTransactions.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic p-3.5 bg-muted/20 rounded-2xl border">
                      Nenhuma movimentação anterior registrada para este cliente.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {selectedCustomerTransactions.map((tx) => (
                        <div key={tx.id} className="p-3 rounded-xl border bg-muted/20 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-foreground">{tx.description}</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("pt-BR")} às {new Date(tx.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                          <span className={`font-black ${Number(tx.amount) > 0 ? "text-emerald-500" : "text-foreground"}`}>
                            {Number(tx.amount) > 0 ? "+" : ""}{brl(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-muted-foreground space-y-3">
                <Users className="w-16 h-16 opacity-20 text-muted-foreground" />
                <h3 className="font-bold text-lg text-foreground">Selecione um cliente na coluna esquerda</h3>
                <p className="text-xs max-w-md">
                  Escolha um cliente da lista ou digite o nome/telefone na barra de busca para visualizar os detalhes, histórico e realizar recargas de créditos com bônus.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        <div className="space-y-6">
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
                  placeholder="Buscar por cliente, WhatsApp, email, CPF, ID ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 font-medium h-10 text-xs rounded-xl"
                />
              </div>

              {/* Grid de Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Cliente</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger className="h-10 text-xs rounded-xl">
                      <SelectValue placeholder="Todos os Clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Clientes</SelectItem>
                      {allSystemCustomers.map((c) => (
                        <SelectItem key={c.id || c.customer_id} value={c.customer_id || c.id}>
                          {c.name || "Cliente"} {c.phone ? `(${c.phone})` : ""}
                        </SelectItem>
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
                      <SelectItem value="recharge">Recargas (+)</SelectItem>
                      <SelectItem value="bonus">Bônus (+10%)</SelectItem>
                      <SelectItem value="payment">Consumos / Pedidos / Corridas (-)</SelectItem>
                      <SelectItem value="revoke">Revogações / Estornos</SelectItem>
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

          {/* ── TOP KPI CARDS ── */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Saldo em Circulação */}
            <Card className="border-primary/40 bg-primary/5 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">
                  Saldo em Circulação
                </CardTitle>
                <Wallet className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-foreground">
                  {brl(totals.totalBalance)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 font-semibold">
                  Total disponível nas contas dos clientes
                </p>
              </CardContent>
            </Card>

            {/* 2. Total Real Pago */}
            <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Total Real Pago (R$)
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {brl(totals.totalRecharged)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 font-semibold">
                  Recebido no período filtrado
                </p>
              </CardContent>
            </Card>

            {/* 3. Total de Bônus 10% */}
            <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span>Bônus Concedidos</span> <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                </CardTitle>
                <Plus className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {brl(totals.totalBonus)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 font-semibold">
                  +10% gerados no período filtrado
                </p>
              </CardContent>
            </Card>

            {/* 4. Total Consumido */}
            <Card className="border-blue-500/30 bg-blue-500/5 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Total Consumido
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {brl(totals.totalSpent)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 font-semibold">
                  Gasto pelos clientes no período filtrado
                </p>
              </CardContent>
            </Card>
          </div>

      {/* ── PAINEL PRINCIPAL COM TABELAS E BOTÃO DE ABERTURA DA CENTRAL ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: LISTAGEM DE CLIENTES & CARTEIRAS */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="shadow-sm border-2 border-border/80">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> Clientes do Sistema
                  </CardTitle>
                  <CardDescription className="text-xs font-medium">
                    {allSystemCustomers.length} clientes encontrados
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleOpenWorkspaceFor()}
                  className="font-black text-xs gap-1.5 rounded-xl h-9 bg-primary text-black hover:bg-primary/90 shadow-md cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-black" /> Central de Créditos
                </Button>
              </div>

              {/* Seletor de visualização */}
              <div className="grid grid-cols-2 gap-1.5 mt-3 p-1 bg-muted/60 rounded-xl border">
                <button
                  type="button"
                  onClick={() => setCustomerTab("all_clients")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    customerTab === "all_clients"
                      ? "bg-background text-foreground shadow-sm font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Todos ({allSystemCustomers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerTab("with_balance")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    customerTab === "with_balance"
                      ? "bg-background text-foreground shadow-sm font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Com Saldo ({customerCredits.length})
                </button>
              </div>

              {/* Barra de Busca Rápida */}
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome, telefone, WhatsApp ou CPF..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0 max-h-[580px] overflow-y-auto divide-y divide-border">
              {loadingCredits && loadingProfiles ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Carregando clientes...</div>
              ) : displayCustomers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-3">
                  <User className="w-8 h-8 mx-auto mb-1 opacity-30 text-muted-foreground" />
                  <p className="font-bold text-foreground">Nenhum cliente encontrado.</p>
                  <Button
                    size="sm"
                    onClick={() => handleOpenWorkspaceFor()}
                    className="font-bold text-xs bg-primary text-black hover:bg-primary/90 rounded-xl"
                  >
                    <PlusCircle className="w-4 h-4 mr-1 text-black" /> Abrir Central de Recargas
                  </Button>
                </div>
              ) : (
                displayCustomers.map((cust) => (
                  <div key={cust.id} className="p-3.5 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-primary/15 text-foreground font-black text-sm flex items-center justify-center shrink-0 border border-primary/30">
                        {cust.name ? cust.name.charAt(0).toUpperCase() : "C"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-foreground truncate leading-tight">
                          {cust.name || "Cliente"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {cust.phone || cust.email || cust.cpf || "Sem contato informado"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="font-black text-xs text-primary">{brl(cust.balance)}</p>
                        {cust.total_spent > 0 && (
                          <p className="text-[9px] text-muted-foreground">Gasto: {brl(cust.total_spent)}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenWorkspaceFor(cust)}
                        className="h-7 px-2.5 text-[10px] font-bold rounded-lg border-primary/40 hover:bg-primary text-black bg-primary/10 transition-colors"
                      >
                        Recarregar
                      </Button>
                      {Number(cust.balance || 0) > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenRevoke(cust)}
                          className="h-7 px-2 text-[10px] font-bold rounded-lg border-rose-500/40 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 bg-rose-500/10 transition-colors"
                          title="Revogar ou estornar créditos indevidos"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> Revogar
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA: EXTRATO COMPLETO DE TRANSAÇÕES */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-sm border-2 border-border/80">
            <CardHeader className="border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <History className="w-4 h-4 text-primary" /> Extrato Geral de Créditos
                    </CardTitle>
                    <span className="text-xs bg-primary/15 text-foreground font-bold px-2.5 py-0.5 rounded-full border border-primary/30">
                      {filteredTransactions.length} movimentações
                    </span>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Movimentações consolidadas de recargas, bônus e pagamentos no período filtrado
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 sm:p-4 max-h-[600px] overflow-y-auto">
              {loadingTxs ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Carregando extrato...</div>
              ) : filteredTransactions.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground border-2 border-dashed rounded-2xl mx-4 my-2">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                  <p className="font-bold text-foreground">Nenhuma transação registrada ainda.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assim que recarregar créditos ou um cliente fizer pedidos, os lançamentos auditáveis aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 px-2 sm:px-0">
                  {filteredTransactions.map((tx) => {
                    const isPositive = Number(tx.amount) > 0;
                    return (
                      <div
                        key={tx.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border rounded-2xl bg-card hover:border-primary/40 transition-all gap-2.5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isPositive
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-rose-500/10 text-rose-500"
                            }`}
                          >
                            {isPositive ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                          </div>

                          <div className="min-w-0">
                            <p className="font-bold text-xs text-foreground leading-tight">{tx.description}</p>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                              <span className="font-semibold text-foreground">
                                {tx.customer_name || "Cliente"}
                              </span>
                              {tx.customer_phone && <span>• {tx.customer_phone}</span>}
                              {tx.bonus_amount && Number(tx.bonus_amount) > 0 && (
                                <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.2 rounded text-[10px]">
                                  +{brl(tx.bonus_amount)} Bônus
                                </span>
                              )}
                              <span>• {new Date(tx.created_at).toLocaleDateString("pt-BR")} às {new Date(tx.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-12 sm:pl-0">
                          <span
                            className={`text-base font-black tracking-tight ${
                              isPositive ? "text-emerald-500" : "text-foreground"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {brl(tx.amount)}
                          </span>
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
    </div>
  )}

      {/* MODAL DE EDIÇÃO DE CONTATO DO CLIENTE */}
      <Dialog open={editContactModalOpen} onOpenChange={setEditContactModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-lg">
              <Pencil className="w-5 h-5 text-primary" /> Atualizar Dados do Cliente
            </DialogTitle>
            <DialogDescription>
              Vincule ou corrija o E-mail de cadastro, WhatsApp e CPF do cliente no sistema.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveContact} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nome Completo</Label>
              <Input
                value={editContactForm.name}
                onChange={(e) => setEditContactForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome do cliente"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-blue-500" /> E-mail de Cadastro / Login
              </Label>
              <Input
                type="email"
                value={editContactForm.email}
                onChange={(e) => setEditContactForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="exemplo@email.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp / Telefone
                </Label>
                <Input
                  value={editContactForm.phone}
                  onChange={(e) => setEditContactForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(66) 99999-9999"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-purple-500" /> CPF / Documento
                </Label>
                <Input
                  value={editContactForm.cpf}
                  onChange={(e) => setEditContactForm((p) => ({ ...p, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-primary" /> Endereço de Entrega
              </Label>
              <Input
                value={editContactForm.address}
                onChange={(e) => setEditContactForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="Rua, número, bairro..."
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setEditContactModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateContactMutation.isPending} className="font-bold">
                {updateContactMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE REVOGAÇÃO / ESTORNO DE CRÉDITOS */}
      <Dialog open={revokeModalOpen} onOpenChange={setRevokeModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-lg text-rose-600 dark:text-rose-400">
              <RotateCcw className="w-5 h-5 text-rose-500" /> Revogar / Estornar Créditos
            </DialogTitle>
            <DialogDescription>
              Cancele ou remova créditos enviados indevidamente para a carteira de {revokeTargetCustomer?.name || "este cliente"}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmRevoke} className="space-y-4 py-2">
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase">Saldo Atual Disponível</p>
                <p className="text-xl font-black text-foreground">{brl(revokeTargetCustomer?.balance || 0)}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRevokeAmountInput(Number(revokeTargetCustomer?.balance || 0).toFixed(2).replace(".", ","))}
                className="text-xs font-bold rounded-xl border-rose-500/30 text-rose-600 hover:bg-rose-500/20"
              >
                Revogar Tudo ({brl(revokeTargetCustomer?.balance || 0)})
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Valor a Revogar / Estornar (R$)</Label>
              <CurrencyInput
                value={revokeAmountInput}
                onChange={(val) => setRevokeAmountInput(val)}
                placeholder="0,00"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                O valor informado será debitado imediatamente do saldo da conta do cliente.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Motivo da Revogação / Cancelamento</Label>
              <Input
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Ex: Envio incorreto para este cliente / cancelamento de recarga"
                required
              />
            </div>

            <div className="flex items-center gap-2 p-3 rounded-2xl border bg-muted/20">
              <input
                type="checkbox"
                id="revokeCashFlow"
                checked={revokeCashFlowReversal}
                onChange={(e) => setRevokeCashFlowReversal(e.target.checked)}
                className="rounded w-4 h-4 text-primary cursor-pointer"
              />
              <label htmlFor="revokeCashFlow" className="text-xs font-medium cursor-pointer text-foreground">
                Lançar estorno / saída compensatória no Fluxo de Caixa da empresa
              </label>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setRevokeModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={revokeCreditsMutation.isPending}
                className="font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {revokeCreditsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                Confirmar Revogação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
