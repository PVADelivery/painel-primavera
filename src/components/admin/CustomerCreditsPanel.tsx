// @ts-nocheck
import { useMemo, useState } from "react";
import {
  Wallet, TrendingUp, TrendingDown, Plus, Search, User,
  Sparkles, History, Filter, CheckCircle2, Users,
  DollarSign, Phone, Mail, FileText, ArrowDownLeft, ArrowUpRight, PlusCircle, Check,
  X, UserCheck, ShieldCheck, Zap
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

  const [customerTab, setCustomerTab] = useState<"with_balance" | "all_clients">("with_balance");
  const [search, setSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("all");

  // Modal de Recarga
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
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

  // Lista consolidada de todos os clientes do sistema
  const allSystemCustomers = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    // 1. Clientes com carteira de crédito
    customerCredits.forEach((c) => {
      const id = c.customer_id || c.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push({
          id,
          customer_id: id,
          name: c.customer_name || "Cliente",
          phone: c.customer_phone || "",
          email: "",
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

  // Lista filtrada para a coluna esquerda do painel principal
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

  // Lista filtrada dentro do Modal de Recarga (Busca em Tempo Real para Milhares de Clientes)
  const modalFilteredCustomers = useMemo(() => {
    const q = modalSearchQuery.trim().toLowerCase();
    if (!q) return allSystemCustomers.slice(0, 50);
    return allSystemCustomers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.customer_id?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [allSystemCustomers, modalSearchQuery]);

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
    setIsRechargeModalOpen(true);
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
        description: rechargeForm.description || `Recarga de R$ ${rawPaid.toFixed(2)} (+R$ ${bonusAmount.toFixed(2)} Bônus 10%)`,
        registerCashFlow: rechargeForm.registerCashFlow,
      });

      toast.success(
        `Recarga concluída com sucesso! Creditado R$ ${totalCredits.toFixed(2)} (R$ ${rawPaid.toFixed(2)} + R$ ${bonusAmount.toFixed(2)} bônus de 10%) para ${targetName}!`
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
                    {allSystemCustomers.length} clientes cadastrados
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setModalSearchQuery("");
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

      {/* ── MODAL EXPANDIDO DE NOVA RECARGA DE CRÉDITOS ── */}
      <Dialog open={isRechargeModalOpen} onOpenChange={setIsRechargeModalOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto rounded-3xl p-6 border-2 border-primary/20">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-black flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" /> Recarga de Créditos do Cliente
                </DialogTitle>
                <DialogDescription className="text-xs mt-1">
                  Selecione qualquer cliente cadastrado no app ou cadastre uma nova carteira com +10% de Bônus.
                </DialogDescription>
              </div>
              <span className="text-xs bg-primary/20 text-black dark:text-primary font-black px-3 py-1 rounded-full border border-primary/40">
                +10% BÔNUS AUTOMÁTICO
              </span>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmitRecharge} className="space-y-5 pt-3">
            
            {/* ETAPA 1: BUSCA E SELEÇÃO DE CLIENTE (AMPLA E ULTRA RÁPIDA) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <User className="w-4 h-4 text-primary" /> 1. Buscar Cliente Cadastrado
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {modalFilteredCustomers.length} clientes encontrados
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={modalSearchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setModalSearchQuery(q);
                    setRechargeForm((prev) => ({
                      ...prev,
                      customerName: q,
                    }));
                  }}
                  placeholder="🔍 Digite qualquer parte do Nome, Telefone, WhatsApp, E-mail ou CPF..."
                  className="pl-10 h-11 text-sm rounded-2xl font-medium border-2 focus:border-primary"
                />
              </div>

              {/* Botão de Criação Rápida caso seja digitado um e-mail ou nome não listado */}
              {modalSearchQuery.trim().length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-xl border border-primary/30 text-xs">
                  <Zap className="w-4 h-4 text-primary shrink-0" />
                  <span className="flex-1 text-foreground">
                    Deseja recarregar diretamente para <strong>"{modalSearchQuery}"</strong>?
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const isEmail = modalSearchQuery.includes("@");
                      const generatedId = crypto.randomUUID();
                      setRechargeForm((prev) => ({
                        ...prev,
                        customerId: generatedId,
                        customerName: isEmail ? modalSearchQuery.split("@")[0] : modalSearchQuery,
                        customerPhone: isEmail ? "" : modalSearchQuery.replace(/\D/g, ""),
                      }));
                      toast.success(`Cliente "${modalSearchQuery}" selecionado!`);
                    }}
                    className="h-7 text-[11px] font-bold bg-primary text-black hover:bg-primary/90 rounded-lg px-2.5"
                  >
                    Usar este Cliente
                  </Button>
                </div>
              )}

              {/* Grid / Lista Rolável de Clientes Encontrados */}
              <div className="max-h-48 overflow-y-auto border-2 rounded-2xl divide-y bg-muted/20 p-1.5 space-y-1">
                {modalFilteredCustomers.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    <User className="w-6 h-6 mx-auto mb-1 opacity-30" />
                    Nenhum cliente encontrado com esse termo. Digite o nome ou e-mail acima para criar a carteira!
                  </div>
                ) : (
                  modalFilteredCustomers.map((c) => {
                    const isSelected = rechargeForm.customerId === (c.customer_id || c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setModalSearchQuery(c.name);
                          setRechargeForm((prev) => ({
                            ...prev,
                            customerId: c.customer_id || c.id,
                            customerName: c.name,
                            customerPhone: c.phone || "",
                          }));
                        }}
                        className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-primary text-black font-bold shadow-sm"
                            : "hover:bg-muted text-foreground border border-transparent hover:border-border"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${isSelected ? "bg-black text-white" : "bg-primary/20 text-primary"}`}>
                            {c.name ? c.name.charAt(0).toUpperCase() : "C"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-sm leading-tight">{c.name}</p>
                            <p className="text-[11px] opacity-80 truncate mt-0.5">
                              {c.email ? `${c.email} • ` : ""}{c.phone || "Sem telefone"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {c.balance > 0 && (
                            <span className={`text-[11px] px-2 py-0.5 rounded-md font-black ${isSelected ? "bg-black/20 text-black" : "bg-primary/20 text-primary"}`}>
                              Saldo: {brl(c.balance)}
                            </span>
                          )}
                          {isSelected ? (
                            <Check className="w-5 h-5 text-black shrink-0" />
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-semibold px-2 py-1 bg-muted rounded-md">
                              Selecionar
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ETAPA 2: DADOS DO CLIENTE CONFIRMADO */}
            <div className="bg-muted/40 p-3.5 rounded-2xl border space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <span>Cliente Destino dos Créditos</span>
                {rechargeForm.customerId && (
                  <span className="text-emerald-500 font-bold flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" /> Confirmado
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nome de Exibição</Label>
                  <Input
                    value={rechargeForm.customerName}
                    onChange={(e) => setRechargeForm({ ...rechargeForm, customerName: e.target.value })}
                    placeholder="Ex: Anthony Both"
                    className="h-10 text-xs rounded-xl bg-background"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">WhatsApp / Telefone</Label>
                  <Input
                    value={rechargeForm.customerPhone}
                    onChange={(e) => setRechargeForm({ ...rechargeForm, customerPhone: e.target.value })}
                    placeholder="(66) 99999-9999"
                    className="h-10 text-xs rounded-xl bg-background"
                  />
                </div>
              </div>
            </div>

            {/* ETAPA 3: VALOR, ATALHOS RÁPIDOS E PAGAMENTO */}
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                2. Valor da Recarga e Pagamento
              </Label>
              
              {/* Atalhos Rápidos de Valores */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-muted-foreground self-center mr-1">Atalhos:</span>
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setRechargeForm({ ...rechargeForm, paidAmount: `${amt},00` })}
                    className={`px-3 py-1 text-xs font-black rounded-lg border transition-all ${
                      rechargeForm.paidAmount === `${amt},00`
                        ? "bg-primary text-black border-primary shadow-sm"
                        : "bg-muted hover:bg-muted/80 text-foreground border-border"
                    }`}
                  >
                    R$ {amt}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Valor Real Pago (R$)</Label>
                  <CurrencyInput
                    value={rechargeForm.paidAmount}
                    onChangeValue={(v) => setRechargeForm({ ...rechargeForm, paidAmount: v })}
                    placeholder="100,00"
                    className="h-11 text-base font-black rounded-xl border-2 focus:border-primary"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Forma de Pagamento</Label>
                  <Select
                    value={rechargeForm.paymentMethod}
                    onValueChange={(val) => setRechargeForm({ ...rechargeForm, paymentMethod: val })}
                  >
                    <SelectTrigger className="h-11 text-xs rounded-xl">
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
            </div>

            {/* BOX DE BÔNUS DE 10% EM DESTAQUE */}
            <div className="bg-primary/10 border-2 border-primary/40 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Valor Pago no Pix/Dinheiro:</span>
                <span className="font-bold text-foreground">R$ {currentPaidVal.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Bônus de +10% Concedido:
                </span>
                <span className="font-black text-amber-600 dark:text-amber-400 text-sm">+ R$ {currentBonusVal.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="h-px bg-primary/30 my-1" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-bold">Total a ser Creditado:</span>
                <span className="text-2xl text-primary font-black">
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

            <DialogFooter className="pt-2 border-t flex flex-col sm:flex-row gap-2">
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
                className="font-black text-sm rounded-xl gap-2 bg-primary text-black hover:bg-primary/90 shadow-md h-11 px-6 flex-1 sm:flex-none cursor-pointer"
              >
                {addCreditsMutation.isPending ? "Processando..." : `⚡ Confirmar Recarga (+${brl(currentTotalCredits)})`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
