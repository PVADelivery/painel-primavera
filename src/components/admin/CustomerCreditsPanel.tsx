// @ts-nocheck
import { useMemo, useState } from "react";
import {
  Wallet, TrendingUp, TrendingDown, Plus, Search, User,
  Sparkles, History, Filter, CheckCircle2, Users,
  DollarSign, Phone, Mail, FileText, ArrowDownLeft, ArrowUpRight, PlusCircle, Check,
  X, UserCheck, ShieldCheck, Zap, ExternalLink, MapPin, Calendar, Clock, CreditCard
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
} from "@/services/customerCredits";

const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão crédito", "Débito", "Transferência", "A prazo"];
const QUICK_AMOUNTS = [50, 100, 200, 300, 500, 1000];

interface CustomerCreditsPanelProps {
  onCreditRecharged?: () => void;
}

export function CustomerCreditsPanel({ onCreditRecharged }: CustomerCreditsPanelProps = {}) {
  const { data: customerCredits = [], isLoading: loadingCredits } = useCustomerCreditsList();
  const { data: transactions = [], isLoading: loadingTxs } = useCustomerCreditTransactionsList();
  const { data: profiles = [], isLoading: loadingProfiles } = useAllCustomerProfiles();
  const addCreditsMutation = useAddCustomerCredits();

  const [customerTab, setCustomerTab] = useState<"with_balance" | "all_clients">("all_clients");
  const [search, setSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("all");

  // Janela / Workspace de Recarga e Gestão de Créditos
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalCategoryFilter, setModalCategoryFilter] = useState<"all" | "balance" | "orders">("all");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

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

  // Estatísticas Globais
  const totals = useMemo(() => {
    const totalBalance = customerCredits.reduce((acc, c) => acc + Number(c.balance || 0), 0);
    const totalRecharged = customerCredits.reduce((acc, c) => acc + Number(c.total_recharged || 0), 0);
    const totalBonus = customerCredits.reduce((acc, c) => acc + Number(c.total_bonus || 0), 0);
    const totalSpent = customerCredits.reduce((acc, c) => acc + Number(c.total_spent || 0), 0);
    return { totalBalance, totalRecharged, totalBonus, totalSpent };
  }, [customerCredits]);

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
      const email = p.email || "";
      const cpf = p.cpf || "";
      const address = p.address || "";

      const primaryKey = uid || phone.replace(/\D/g, "") || name.toLowerCase().trim();
      if (!primaryKey || seen.has(primaryKey)) return;
      seen.add(primaryKey);

      // Tenta encontrar saldo de crédito
      const creditRow = creditsMap.get(uid) || creditsMap.get(name.toLowerCase().trim()) || (phone ? creditsMap.get(phone.replace(/\D/g, "")) : null);
      const balance = Number(creditRow?.balance || 0);
      const total_recharged = Number(creditRow?.total_recharged || 0);
      const total_spent = Number(creditRow?.total_spent || 0);

      list.push({
        id: uid || primaryKey,
        customer_id: uid || primaryKey,
        name,
        phone,
        email,
        cpf,
        address,
        balance,
        total_recharged,
        total_spent,
        source: p.source || "cadastro",
        hasCredits: balance > 0,
      });
    });

    // Se houver carteiras de crédito que não estavam na lista de perfis, adiciona
    customerCredits.forEach((c) => {
      const uid = c.customer_id || c.id;
      const name = c.customer_name || "Cliente";
      const phone = c.customer_phone || "";
      const primaryKey = uid || phone.replace(/\D/g, "") || name.toLowerCase().trim();

      if (!seen.has(primaryKey)) {
        seen.add(primaryKey);
        list.push({
          id: uid || primaryKey,
          customer_id: uid || primaryKey,
          name,
          phone,
          email: "",
          cpf: "",
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

  // Lista filtrada para o Workspace Interno de Recargas (Busca Universal em Tempo Real)
  const workspaceFilteredCustomers = useMemo(() => {
    const q = modalSearchQuery.trim().toLowerCase();
    let list = allSystemCustomers;

    if (modalCategoryFilter === "balance") {
      list = list.filter((c) => c.balance > 0);
    } else if (modalCategoryFilter === "orders") {
      list = list.filter((c) => c.source === "orders" || c.source === "deliveries" || c.source === "ride_requests");
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

  // Lista filtrada geral de transações
  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchType = txTypeFilter === "all" || tx.type === txTypeFilter;
      const matchSearch =
        !q ||
        tx.customer_name?.toLowerCase().includes(q) ||
        tx.customer_phone?.toLowerCase().includes(q) ||
        tx.description?.toLowerCase().includes(q) ||
        tx.reference_id?.toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [transactions, txSearch, txTypeFilter]);

  // Abre a Central de Recarga para um cliente específico
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
      setSelectedCustomer(allSystemCustomers[0] || null);
      setModalSearchQuery("");
      setRechargeForm({
        customerId: allSystemCustomers[0]?.id || "",
        customerName: allSystemCustomers[0]?.name || "",
        customerPhone: allSystemCustomers[0]?.phone || "",
        paidAmount: "100,00",
        bonusPercentage: 10,
        paymentMethod: "Pix",
        description: "",
        registerCashFlow: true,
      });
    }
    setIsWorkspaceOpen(true);
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
              Valor bruto recebido pelo Admin em Pix/Dinheiro
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
              +10% de créditos extras gerados aos clientes
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
              Gasto em pedidos, táxi, motoboy e serviços
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── BOTÃO DE ABERTURA DO WORKSPACE & TABELAS PRINCIPAIS ── */}
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
                    Histórico consolidado de recargas, bônus e pagamentos realizados na plataforma
                  </CardDescription>
                </div>
              </div>

              {/* Filtros do Extrato */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente, pedido, corrida ou descrição..."
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-xl"
                  />
                </div>

                <Select value={txTypeFilter} onValueChange={setTxTypeFilter}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Filtrar tipo de movimentação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Movimentações</SelectItem>
                    <SelectItem value="recharge">Recargas (+)</SelectItem>
                    <SelectItem value="bonus">Bônus Concedidos (+)</SelectItem>
                    <SelectItem value="payment_order">Pagamentos de Pedidos (-)</SelectItem>
                    <SelectItem value="payment_ride">Corridas Táxi / Moto (-)</SelectItem>
                    <SelectItem value="payment_errand">Entregas / Motoboy (-)</SelectItem>
                    <SelectItem value="refund">Estornos (+)</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* ══════════════════════════════════════════════════════════════════════════════
          ── JANELA / WORKSPACE GIGANTE DE GESTÃO E RECARGA DE CRÉDITOS (96vw x 90vh) ──
          ══════════════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isWorkspaceOpen} onOpenChange={setIsWorkspaceOpen}>
        <DialogContent className="w-[96vw] max-w-6xl h-[90vh] max-h-[90vh] p-0 rounded-3xl border-2 border-primary/40 flex flex-col overflow-hidden bg-background">
          
          {/* TOPO DO WORKSPACE */}
          <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-black flex items-center gap-2.5">
                <Sparkles className="w-6 h-6 text-primary" /> Central de Gestão & Recarga de Créditos (+10% Bônus)
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Workspace financeiro para localizar clientes, gerenciar saldos individuais e efetivar recargas instantâneas.
              </DialogDescription>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs bg-primary text-black font-black px-3 py-1 rounded-xl shadow-sm">
                BÔNUS AUTOMÁTICO DE +10%
              </span>
            </div>
          </DialogHeader>

          {/* CORPO DO WORKSPACE: 2 COLUNAS (BUSCA DE CLIENTES + PAINEL DE AÇÃO) */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
            
            {/* COLUNA ESQUERDA (5/12): LISTAGEM E BUSCA AVANÇADA DE CLIENTES */}
            <div className="md:col-span-5 border-r flex flex-col h-full bg-muted/10 overflow-hidden">
              
              {/* Barra de Busca de Clientes no Workspace */}
              <div className="p-4 border-b space-y-2.5 bg-background">
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
                    placeholder="Nome, telefone, WhatsApp, e-mail, CPF..."
                    className="pl-10 h-10 text-xs rounded-xl font-medium border-2 focus:border-primary"
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

                {/* Filtros rápidos da lista de clientes */}
                <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setModalCategoryFilter("all")}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      modalCategoryFilter === "all"
                        ? "bg-primary text-black font-black"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Todos ({allSystemCustomers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalCategoryFilter("balance")}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      modalCategoryFilter === "balance"
                        ? "bg-primary text-black font-black"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Com Saldo ({customerCredits.length})
                  </button>
                </div>

                {/* Opção para usar texto digitado como cliente avulso */}
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
                    className="w-full text-left p-2.5 rounded-xl text-xs bg-primary/20 hover:bg-primary/30 text-foreground border border-primary/40 flex items-center justify-between font-black transition-all"
                  >
                    <span className="truncate">✨ Usar "<strong>{modalSearchQuery}</strong>" como cliente</span>
                    <Plus className="w-4 h-4 text-primary shrink-0" />
                  </button>
                )}
              </div>

              {/* Lista Rolável de Clientes */}
              <div className="flex-1 overflow-y-auto divide-y divide-border p-2 space-y-1">
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
                        className={`w-full text-left p-3 rounded-2xl text-xs flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-primary text-black font-bold shadow-md ring-2 ring-primary"
                            : "hover:bg-muted/70 text-foreground border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
                            isSelected ? "bg-black text-white border-black" : "bg-primary/20 text-foreground border-primary/30"
                          }`}>
                            {c.name ? c.name.charAt(0).toUpperCase() : "C"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-sm leading-tight">{c.name}</p>
                            <p className="text-[11px] opacity-80 truncate mt-0.5">
                              {c.phone || c.email || c.cpf || "Sem contato"}
                            </p>
                            {c.address && (
                              <p className="text-[10px] opacity-70 truncate mt-0.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0" /> {c.address}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0 pl-2">
                          <p className={`font-black text-xs ${isSelected ? "text-black" : "text-primary"}`}>
                            {brl(c.balance)}
                          </p>
                          {c.total_spent > 0 && (
                            <p className="text-[9px] opacity-75">Gasto: {brl(c.total_spent)}</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* COLUNA DIREITA (7/12): DETALHES DO CLIENTE SELECIONADO & FORMULÁRIO DE RECARGA */}
            <div className="md:col-span-7 flex flex-col h-full overflow-y-auto bg-background p-6 space-y-6">
              
              {selectedCustomer ? (
                <>
                  {/* CARD DE DETALHES COMPLETOS DO CLIENTE */}
                  <div className="p-5 rounded-3xl border-2 border-primary/30 bg-primary/5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-14 h-14 rounded-2xl bg-primary text-black font-black text-xl flex items-center justify-center shrink-0 shadow-md">
                          {selectedCustomer.name ? selectedCustomer.name.charAt(0).toUpperCase() : "C"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-lg text-foreground truncate leading-tight">
                              {selectedCustomer.name}
                            </h3>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0 flex items-center gap-1">
                              <UserCheck className="w-3 h-3" /> Cliente Ativo
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap font-medium">
                            {selectedCustomer.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-primary" /> {selectedCustomer.phone}
                              </span>
                            )}
                            {selectedCustomer.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5 text-primary" /> {selectedCustomer.email}
                              </span>
                            )}
                            {selectedCustomer.cpf && (
                              <span className="flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-primary" /> CPF: {selectedCustomer.cpf}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Saldo Atual em Destaque */}
                      <div className="bg-background/80 p-3 rounded-2xl border text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Saldo Atual da Carteira
                        </span>
                        <span className="text-xl font-black text-primary">
                          {brl(selectedCustomer.balance || 0)}
                        </span>
                      </div>
                    </div>

                    {selectedCustomer.address && (
                      <div className="text-xs bg-background/60 p-2.5 rounded-xl border flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate"><strong>Endereço:</strong> {selectedCustomer.address}</span>
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
                        Preencha o valor pago e selecione a forma
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
                            className={`py-2 text-xs font-black rounded-xl border transition-all ${
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
                    <div className="bg-primary/10 border-2 border-primary/40 rounded-3xl p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-semibold">Valor Recebido do Cliente:</span>
                        <span className="font-black text-foreground text-sm">{brl(currentPaidVal)}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-500" /> Bônus de +{rechargeForm.bonusPercentage}% Concedido:
                        </span>
                        <span className="font-black text-amber-600 dark:text-amber-400 text-sm">
                          + {brl(currentBonusVal)}
                        </span>
                      </div>

                      <div className="h-px bg-primary/30 my-1" />

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-foreground font-black text-sm block">Total a ser Creditado:</span>
                          <span className="text-[11px] text-muted-foreground">
                            Novo Saldo Final: {brl((selectedCustomer.balance || 0) + currentTotalCredits)}
                          </span>
                        </div>
                        <span className="text-2xl sm:text-3xl text-primary font-black">
                          {brl(currentTotalCredits)}
                        </span>
                      </div>
                    </div>

                    {/* Checkbox Fluxo de Caixa */}
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-2xl border">
                      <input
                        type="checkbox"
                        id="workspaceRegisterCashFlow"
                        checked={rechargeForm.registerCashFlow}
                        onChange={(e) => setRechargeForm({ ...rechargeForm, registerCashFlow: e.target.checked })}
                        className="rounded border-border text-primary focus:ring-primary h-5 w-5 cursor-pointer"
                      />
                      <Label htmlFor="workspaceRegisterCashFlow" className="text-xs font-medium cursor-pointer text-foreground">
                        Lançar automaticamente como <strong>Entrada no Fluxo de Caixa</strong> ("Venda de Créditos Cliente - {rechargeForm.paymentMethod}")
                      </Label>
                    </div>

                    {/* BOTÃO DE AÇÃO GIGANTE */}
                    <Button
                      type="submit"
                      disabled={addCreditsMutation.isPending}
                      className="w-full h-14 text-base font-black rounded-2xl gap-2 bg-primary text-black hover:bg-primary/90 shadow-xl cursor-pointer"
                    >
                      {addCreditsMutation.isPending ? (
                        "Processando Recarga..."
                      ) : (
                        `⚡ Confirmar Recarga e Creditar ${brl(currentTotalCredits)} para ${selectedCustomer.name}`
                      )}
                    </Button>
                  </form>

                  {/* MINI EXTRATO RECENTE DO CLIENTE SELECIONADO */}
                  <div className="border-t pt-4 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-primary" /> Histórico Recente de {selectedCustomer.name} ({selectedCustomerTransactions.length})
                    </h4>

                    {selectedCustomerTransactions.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic p-3 bg-muted/20 rounded-xl border">
                        Nenhuma movimentação anterior registrada para este cliente.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedCustomerTransactions.map((tx) => (
                          <div key={tx.id} className="p-2.5 rounded-xl border bg-muted/20 flex items-center justify-between text-xs">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
