// @ts-nocheck
import { useMemo, useState } from "react";
import {
  Wallet, TrendingUp, TrendingDown, Plus, Search, User,
  ArrowUpCircle, ArrowDownCircle, Sparkles, History, Filter, CheckCircle2,
  DollarSign, Phone, Mail, FileText, ArrowDownLeft, ArrowUpRight, PlusCircle,
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

  const [search, setSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("all");

  // Modal de Recarga
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [rechargeForm, setRechargeForm] = useState({
    customerId: "",
    customerName: "",
    customerPhone: "",
    paidAmount: "",
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

  // Lista filtrada de carteiras
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customerCredits;
    return customerCredits.filter(
      (c) =>
        c.customer_name?.toLowerCase().includes(q) ||
        c.customer_phone?.toLowerCase().includes(q) ||
        c.customer_id?.toLowerCase().includes(q)
    );
  }, [customerCredits, search]);

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
    setSelectedCustomer(customer);
    setRechargeForm({
      customerId: customer.customer_id || customer.id,
      customerName: customer.customer_name || customer.full_name || customer.name || "Cliente",
      customerPhone: customer.customer_phone || customer.phone || "",
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

    if (!rechargeForm.customerId) {
      toast.error("Selecione um cliente para receber os créditos.");
      return;
    }

    const bonusAmount = Number((rawPaid * (rechargeForm.bonusPercentage / 100)).toFixed(2));
    const totalCredits = rawPaid + bonusAmount;

    try {
      await addCreditsMutation.mutateAsync({
        customer_id: rechargeForm.customerId,
        customer_name: rechargeForm.customerName,
        customer_phone: rechargeForm.customerPhone,
        paid_amount: rawPaid,
        bonus_amount: bonusAmount,
        payment_method: rechargeForm.paymentMethod,
        description: rechargeForm.description || `Recarga de R$ ${rawPaid.toFixed(2)} (+R$ ${bonusAmount.toFixed(2)} Bônus 10%)`,
        registerCashFlow: rechargeForm.registerCashFlow,
      });

      toast.success(
        `Sucesso! Creditado R$ ${totalCredits.toFixed(2)} (R$ ${rawPaid.toFixed(2)} + R$ ${bonusAmount.toFixed(2)} bônus) para ${rechargeForm.customerName}!`
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
        
        {/* COLUNA ESQUERDA: LISTAGEM DE CARTEIRAS DE CLIENTES */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Carteiras de Clientes</CardTitle>
                  <CardDescription className="text-xs">Saldos individuais cadastrados</CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedCustomer(null);
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
                  className="font-bold text-xs gap-1.5 rounded-xl h-9"
                >
                  <PlusCircle className="w-4 h-4" /> Nova Recarga
                </Button>
              </div>

              {/* Barra de Busca de Clientes */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente por nome ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0 max-h-[600px] overflow-y-auto divide-y divide-border">
              {loadingCredits ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Carregando carteiras...</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhum cliente com créditos encontrado.
                </div>
              ) : (
                filteredCustomers.map((cust) => (
                  <div key={cust.id} className="p-3.5 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
                        {cust.customer_name ? cust.customer_name.charAt(0).toUpperCase() : "C"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-foreground truncate leading-tight">
                          {cust.customer_name || "Cliente"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {cust.customer_phone || "Sem telefone"}
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
                        className="h-7 px-2 text-[10px] font-bold rounded-lg"
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
                  Nenhuma transação encontrada para os filtros selecionados.
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
        <DialogContent className="sm:max-w-[480px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Recarga de Créditos do Cliente
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adicione saldo à carteira do cliente com cálculo automático de +10% de Bônus.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRecharge} className="space-y-4 pt-2">
            {/* Seleção do Cliente */}
            <div className="space-y-2">
              <Label className="text-xs font-bold">Cliente</Label>
              <Select
                value={rechargeForm.customerId}
                onValueChange={(val) => {
                  const prof = profiles.find((p) => p.id === val);
                  setRechargeForm({
                    ...rechargeForm,
                    customerId: val,
                    customerName: prof?.name || prof?.full_name || "Cliente",
                    customerPhone: prof?.phone || "",
                  });
                }}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl">
                  <SelectValue placeholder="Selecione o cliente cadastrado" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || p.full_name || "Cliente"} {p.phone ? `(${p.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Inputs de Nome e Telefone Manuais se necessário */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome de Exibição</Label>
                <Input
                  value={rechargeForm.customerName}
                  onChange={(e) => setRechargeForm({ ...rechargeForm, customerName: e.target.value })}
                  placeholder="Nome do cliente"
                  className="h-9 text-xs rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp / Telefone</Label>
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
                <span className="text-muted-foreground">Valor Pago em Dinheiro/Pix:</span>
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
                <span className="text-primary">Total de Créditos Creditados:</span>
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
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
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
                className="font-bold text-xs rounded-xl gap-1.5"
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
