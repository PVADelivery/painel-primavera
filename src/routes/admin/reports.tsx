// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDeliveries } from "@/services/deliveries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState, useEffect } from "react";
import { DollarSign, TrendingUp, Package, ArrowUpCircle, ArrowDownCircle, Trash2, Pencil, Calendar, Tag } from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
  const [editingCf, setEditingCf] = useState(null);

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

  const handleUpdateCashFlow = async (e) => {
    e.preventDefault();
    if (!editingCf.description || !editingCf.category || !editingCf.amount || !editingCf.date) return;

    const { error } = await supabase.from('platform_cash_flow').update({
      description: editingCf.description,
      category: editingCf.category,
      amount: Number(editingCf.amount),
      type: editingCf.type,
      date: editingCf.date
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
                          {/* Left visual bar depending on type */}
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
                    <Input type="number" step="0.01" min="0" value={editingCf.amount} onChange={(e) => setEditingCf({ ...editingCf, amount: e.target.value })} required className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={editingCf.date} onChange={(e) => setEditingCf({ ...editingCf, date: e.target.value })} required className="rounded-xl h-11" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={editingCf.category} onValueChange={(val) => setEditingCf({ ...editingCf, category: val })}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {editingCf.type === 'expense' ? (
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

                <DialogFooter className="mt-6 pt-4 border-t border-border">
                  <Button type="button" variant="ghost" onClick={() => setEditingCf(null)} className="rounded-xl h-11 font-bold">Cancelar</Button>
                  <Button type="submit" className="rounded-xl h-11 font-bold px-6">Salvar Alterações</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </Tabs>
    </AdminLayout>
  );
}