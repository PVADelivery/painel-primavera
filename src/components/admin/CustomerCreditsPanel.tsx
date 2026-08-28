// @ts-nocheck
import { useMemo, useState } from "react";
import {
  Wallet, TrendingUp, TrendingDown, Plus, Search, User,
  Sparkles, History, Filter, CheckCircle2, Users,
  DollarSign, Phone, Mail, FileText, ArrowDownLeft, ArrowUpRight, PlusCircle, Check
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

interface CustomerCreditsPanelProps {
  onCreditRecharged?: () => void;
}

export function CustomerCreditsPanel({ onCreditRecharged }: CustomerCreditsPanelProps = {}) {
  const { data: customerCredits = [], isLoading: loadingCredits } = useCustomerCreditsList();
  const { data: transactions = [], isLoading: loadingTxs } = useCustomerCreditTransactionsList();
  const { data: profiles = [], isLoading: loadingProfiles } = useAllCustomerProfiles();
  const addCreditsMutation = useAddCustomerCredits();

  const [customerTab, setCustomerTab] = useState<"with_balance" | "all_clients">("with_balance");
  const [search, setSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("all");

  // Modal de Recarga
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
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

  // Mapa de saldo de créditos por customer_id
  const creditsByCustomerId = useMemo(() => {
    const map = new Map<string, any>();
    customerCredits.forEach((c) => {
      if (c.customer_id) map.set(c.customer_id, c);
    });
    return map;
  }, [customerCredits]);

  // Lista combinada de todos os clientes do sistema
  const allSystemCustomers = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    // 1. Clientes com carteira
    customerCredits.forEach((c) => {
      const id = c.customer_id || c.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push({
          id,
          customer_id: id,
          name: c.customer_name || "Cliente",
          phone: c.customer_phone || "",
          balance: Number(c.balance || 0),
          total_recharged: Number(c.total_recharged || 0),
          total_spent: Number(c.total_spent || 0),
          hasCreditAccount: true,
        });
      }
    });

    // 2. Perfis de usuários cadastrados
    profiles.forEach((p) => {
      const id = p.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        const cr = creditsByCustomerId.get(id);
        list.push({
          id,
          customer_id: id,
          name: p.name || p.full_name || "Cliente",
          phone: p.phone || "",
          email: p.email || "",
          balance: Number(cr?.balance || 0),
          total_recharged: Number(cr?.total_recharged || 0),
          total_spent: Number(cr?.total_spent || 0),
          hasCreditAccount: !!cr,
        });
      }
    });

    return list.sort((a, b) => (b.balance || 0) - (a.balance || 0));
  }, [customerCredits, profiles, creditsByCustomerId]);

  // Lista filtrada para a coluna esquerda
  const displayCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const baseList = customerTab === "with_balance" && customerCredits.length > 0
      ? customerCredits.map((c) => ({
          id: c.customer_id || c.id,
          customer_id: c.customer_id || c.id,
          name: c.customer_name || "Cliente",
          phone: c.customer_phone || "",
          balance: Number(c.balance || 0),
          total_spent: Number(c.total_spent || 0),
        }))
      : allSystemCustomers;

    if (!q) return baseList;
    return baseList.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.customer_id?.toLowerCase().includes(q)
    );
  }, [customerTab, customerCredits, allSystemCustomers, search]);

  // Sugestões de busca dentro do modal de recarga
  const modalCustomerSuggestions = useMemo(() => {
    const q = clientSearchQuery.trim().toLowerCase();
    if (!q) return allSystemCustomers.slice(0, 15);
    return allSystemCustomers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [allSystemCustomers, clientSearchQuery]);

  // Lista filtrada de transações
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

  // Abre modal de recarga para um cliente específico
  const handleOpenRechargeFor = (customer: any) => {
    const cid = customer.customer_id || customer.id || crypto.randomUUID();
    const cname = customer.name || customer.customer_name || customer.full_name || "Cliente";
    const cphone = customer.phone || customer.customer_phone || "";
    
    setSelectedCustomer(customer);
    setClientSearchQuery(cname);
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
    setIsRechargeModalOpen(true);
  };

  // Submissão da recarga
  const handleSubmitRecharge = async (e: React.FormEvent) => {
    e.preventDefault();

    const rawPaid = Number(rechargeForm.paidAmount.replace(/\./g, "").replace(",", ".")) || 0;
    if (rawPaid <= 0) {
      toast.error("Informe um valor válido maior que zero.");
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
        description: rechargeForm.description || `Recarga de R$ ${rawPaid.toFixed(2)} (+R$ ${bonusAmount.toFixed(2)} Bônus 10%)`,
        registerCashFlow: rechargeForm.registerCashFlow,
      });

      toast.success(
        `Sucesso! Creditado R$ ${totalCredits.toFixed(2)} (R$ ${rawPaid.toFixed(2)} + R$ ${bonusAmount.toFixed(2)} bônus 10%) para ${targetName}!`
      );
      setIsRechargeModalOpen(false);
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
        <Card className="border-primary/40 bg-primary/5">
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

        {/* 2. Total Recarregado */}
        <Card className="border-emerald-500/30 bg-emerald-500/5">
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
        <Card className="border-amber-500/30 bg-amber-500/5">
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
        <Card className="border-blue-500/30 bg-blue-500/5">
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

      {/* ── BOTÃO DE RECARGA & TABELAS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: LISTAGEM DE CLIENTES & CARTEIRAS */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Clientes & Carteiras</CardTitle>
                  <CardDescription className="text-xs">
                    {allSystemCustomers.length} clientes encontrados no sistema
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setClientSearchQuery("");
                    setRechargeForm({
                      customerId: "",
                      customerName: "",
                      customerPhone: "",
                      paidAmount: "100,00",
                      bonusPercentage: 10,
                      paymentMethod: "Pix",
                      description: "",
                      registerCashFlow: true,
                    });
                    setIsRechargeModalOpen(true);
                  }}
                  className="font-bold text-xs gap-1.5 rounded-xl h-9 bg-primary text-black hover:bg-primary/90 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4 text-black" /> Nova Recarga
                </Button>
              </div>

              {/* Seletor de visualização (Com Saldo vs Todos os Clientes) */}
              <div className="grid grid-cols-2 gap-1.5 mt-3 p-1 bg-muted/50 rounded-xl border">
                <button
                  type="button"
                  onClick={() => setCustomerTab("with_balance")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    customerTab === "with_balance"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Com Saldo ({customerCredits.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerTab("all_clients")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    customerTab === "all_clients"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Todos ({allSystemCustomers.length})
                </button>
              </div>

              {/* Barra de Busca de Clientes */}
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou e-mail..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0 max-h-[580px] overflow-y-auto divide-y divide-border">
              {loadingCredits && loadingProfiles ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Carregando clientes...</div>
              ) : displayCustomers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-3">
                  <User className="w-8 h-8 mx-auto mb-1 opacity-30 text-muted-foreground" />
                  <p className="font-bold text-foreground">Nenhum cliente com créditos encontrado.</p>
                  <p className="text-[11px] text-muted-foreground">
                    Clique no botão abaixo para buscar qualquer cliente do app ou fazer a primeira recarga!
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setCustomerTab("all_clients");
                      setIsRechargeModalOpen(true);
                    }}
                    className="font-bold text-xs bg-primary text-black hover:bg-primary/90 rounded-xl"
                  >
                    <PlusCircle className="w-4 h-4 mr-1 text-black" /> Recarregar Primeiro Cliente
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
                          {cust.phone || cust.email || "Sem telefone"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="font-black text-xs text-primary">{brl(cust.balance)}</p>
                        <p className="text-[9px] text-muted-foreground">Gasto: {brl(cust.total_spent)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenRechargeFor(cust)}
                        className="h-7 px-2 text-[10px] font-bold rounded-lg border-primary/40 hover:bg-primary/10"
                      >
                        + Recarregar
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
          <Card>
            <CardHeader className="border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold">Extrato Geral de Créditos</CardTitle>
                    <span className="text-xs bg-primary/15 text-primary font-bold px-2 py-0.5 rounded-full">
                      {filteredTransactions.length} movimentações
                    </span>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Histórico de recargas, bônus e pagamentos realizados na plataforma
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
                                  +R$ {Number(tx.bonus_amount).toFixed(2)} Bônus 10%
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
                            {Number(tx.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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

      {/* ── MODAL DE NOVA RECARGA DE CRÉDITOS ── */}
      <Dialog open={isRechargeModalOpen} onOpenChange={setIsRechargeModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Recarga de Créditos do Cliente
            </DialogTitle>
            <DialogDescription className="text-xs">
              Busque qualquer cliente cadastrado ou digite os dados para recarga com +10% de Bônus.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRecharge} className="space-y-4 pt-2">
            {/* Campo Inteligente de Busca / Seleção de Cliente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">1. Selecionar Cliente do Sistema</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={clientSearchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setClientSearchQuery(q);
                    setRechargeForm((prev) => ({
                      ...prev,
                      customerName: q,
                    }));
                  }}
                  placeholder="Digite o nome, WhatsApp ou e-mail do cliente..."
                  className="pl-9 h-10 text-xs rounded-xl font-medium"
                />
              </div>

              {/* Lista rápida de sugestões de clientes */}
              <div className="max-h-44 overflow-y-auto border rounded-xl divide-y bg-muted/20 p-1 space-y-1">
                {clientSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      const isEmail = clientSearchQuery.includes("@");
                      const generatedId = crypto.randomUUID();
                      setRechargeForm((prev) => ({
                        ...prev,
                        customerId: generatedId,
                        customerName: isEmail ? clientSearchQuery.split("@")[0] : clientSearchQuery,
                        customerPhone: isEmail ? "" : prev.customerPhone,
                      }));
                    }}
                    className="w-full text-left p-2 rounded-lg text-xs bg-primary/20 hover:bg-primary/30 text-foreground border border-primary/40 flex items-center justify-between font-bold"
                  >
                    <span>✨ Usar "<strong>{clientSearchQuery}</strong>" como cliente</span>
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  </button>
                )}

                {modalCustomerSuggestions.length === 0 && !clientSearchQuery ? (
                  <p className="text-[11px] text-muted-foreground p-2 text-center">
                    Nenhum cliente pré-cadastrado encontrado. Preencha os campos abaixo para criar a carteira!
                  </p>
                ) : (
                  modalCustomerSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setClientSearchQuery(c.name);
                        setRechargeForm((prev) => ({
                          ...prev,
                          customerId: c.customer_id || c.id,
                          customerName: c.name,
                          customerPhone: c.phone || "",
                        }));
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        rechargeForm.customerId === c.id
                          ? "bg-primary text-black font-bold"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{c.name}</p>
                        <p className="text-[10px] opacity-80 truncate">{c.email || c.phone || "Sem contato"}</p>
                      </div>
                      {rechargeForm.customerId === c.id && <Check className="w-4 h-4 text-black shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Inputs de Confirmação do Nome e Telefone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nome do Cliente</Label>
                <Input
                  value={rechargeForm.customerName}
                  onChange={(e) => setRechargeForm({ ...rechargeForm, customerName: e.target.value })}
                  placeholder="Ex: Anthony Both"
                  className="h-9 text-xs rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">WhatsApp / Telefone</Label>
                <Input
                  value={rechargeForm.customerPhone}
                  onChange={(e) => setRechargeForm({ ...rechargeForm, customerPhone: e.target.value })}
                  placeholder="(66) 99999-9999"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            {/* Valor Pago e Forma */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Valor Real Pago (R$)</Label>
                <CurrencyInput
                  value={rechargeForm.paidAmount}
                  onChangeValue={(v) => setRechargeForm({ ...rechargeForm, paidAmount: v })}
                  placeholder="100,00"
                  className="h-9 text-xs font-bold rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Forma de Pagamento</Label>
                <Select
                  value={rechargeForm.paymentMethod}
                  onValueChange={(val) => setRechargeForm({ ...rechargeForm, paymentMethod: val })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Forma" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Box Demonstrativo do Bônus de 10% */}
            <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Valor Pago no Pix/Dinheiro:</span>
                <span className="font-bold text-foreground">R$ {currentPaidVal.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-500 font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Bônus de +10%:
                </span>
                <span className="font-black text-amber-500">+ R$ {currentBonusVal.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="h-px bg-primary/20 my-1" />
              <div className="flex items-center justify-between text-sm font-black">
                <span className="text-foreground">Total Creditado ao Cliente:</span>
                <span className="text-xl text-primary font-black">
                  R$ {currentTotalCredits.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>

            {/* Checkbox Fluxo de Caixa */}
            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="registerCashFlow"
                checked={rechargeForm.registerCashFlow}
                onChange={(e) => setRechargeForm({ ...rechargeForm, registerCashFlow: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              />
              <Label htmlFor="registerCashFlow" className="text-xs font-medium cursor-pointer text-muted-foreground">
                Lançar automaticamente como <strong>Entrada no Fluxo de Caixa</strong> ("Venda de Créditos Cliente")
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsRechargeModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={addCreditsMutation.isPending}
                className="font-bold text-xs rounded-xl gap-1.5 bg-primary text-black hover:bg-primary/90 shadow-sm"
              >
                {addCreditsMutation.isPending ? "Processando..." : `Confirmar Recarga (+${brl(currentTotalCredits)})`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
