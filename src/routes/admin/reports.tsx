// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDeliveries } from "@/services/deliveries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState, useEffect } from "react";
import { DollarSign, TrendingUp, Package, ArrowUpCircle, ArrowDownCircle, Trash2 } from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { data = [] } = useDeliveries({ sinceDays: 30 });
  const { toast } = useToast();

  const stats = useMemo(() => {
    const delivered = data.filter((d) => d.status === "completed");
    const revenue = delivered.reduce((s, d) => s + Number(d.value || 0), 0);
    const commission = delivered.reduce((s, d) => s + Number(d.commission || 0), 0);
    const ticket = delivered.length ? revenue / delivered.length : 0;
    return { revenue, commission, ticket, count: delivered.length };
  }, [data]);

  // CASH FLOW STATE
  const [cashFlows, setCashFlows] = useState([]);
  const [isLoadingCF, setIsLoadingCF] = useState(true);
  const [cfForm, setCfForm] = useState({
    description: "",
    category: "",
    amount: "",
    type: "expense",
    date: new Date().toISOString().split("T")[0]
  });

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
    fetchCashFlow();
  }, []);

  const cfStats = useMemo(() => {
    const income = cashFlows.filter(c => c.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const expense = cashFlows.filter(c => c.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
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
      date: cfForm.date
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

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Gestão financeira e relatórios da plataforma</p>
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="geral">Visão Geral (Entregas)</TabsTrigger>
          <TabsTrigger value="cashflow">Fluxo de Caixa Operacional</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatsCard title="Faturamento total" value={stats.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} icon={DollarSign} color="success" />
            <StatsCard title="Ticket médio" value={stats.ticket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} icon={TrendingUp} color="primary" />
            <StatsCard title="Entregas concluídas" value={stats.count} icon={Package} color="info" />
          </div>
          <Card className="mt-6 p-12 text-center shadow-card text-sm text-muted-foreground">
            Relatórios detalhados por empresa e entregador em breve.
          </Card>
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
                      <Select value={cfForm.category} onValueChange={(val) => setCfForm({ ...cfForm, category: val })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {cfForm.type === 'expense' ? (
                            <>
                              <SelectItem value="Repasse Motoboy">Repasse Motoboy</SelectItem>
                              <SelectItem value="Thyelle - pessoal">Thyelle - pessoal</SelectItem>
                              <SelectItem value="Abastecimento">Abastecimento</SelectItem>
                              <SelectItem value="Oficina - manutenção">Oficina - manutenção</SelectItem>
                              <SelectItem value="Fixo Mensal - empresa">Fixo Mensal - empresa</SelectItem>
                              <SelectItem value="Aluguel">Aluguel</SelectItem>
                              <SelectItem value="Luz">Luz</SelectItem>
                              <SelectItem value="Internet - telefone">Internet - telefone</SelectItem>
                              <SelectItem value="Água">Água</SelectItem>
                              <SelectItem value="Papelaria - limpeza">Papelaria - limpeza</SelectItem>
                              <SelectItem value="Veículo">Veículo</SelectItem>
                              <SelectItem value="Outras Despesas">Outras Despesas</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="Venda - cupom 5,00">Venda - cupom 5,00</SelectItem>
                              <SelectItem value="Venda - cupom 6,00">Venda - cupom 6,00</SelectItem>
                              <SelectItem value="Açaí primavera">Açaí primavera</SelectItem>
                              <SelectItem value="Outras Receitas">Outras Receitas</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Valor (R$)</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={cfForm.amount}
                          onChange={(e) => setCfForm({ ...cfForm, amount: e.target.value })}
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
                <CardContent>
                  {isLoadingCF ? (
                    <div className="flex justify-center p-8 text-muted-foreground">Carregando fluxo de caixa...</div>
                  ) : cashFlows.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      Nenhum lançamento encontrado.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cashFlows.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${item.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              {item.type === 'income' ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{item.description}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="bg-secondary px-2 py-0.5 rounded-full">{item.category}</span>
                                <span>{new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`font-bold ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                              {item.type === 'income' ? '+' : '-'} 
                              {Number(item.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCashFlow(item.id)} className="h-8 w-8 text-muted-foreground hover:text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
      </Tabs>
    </AdminLayout>
  );
}