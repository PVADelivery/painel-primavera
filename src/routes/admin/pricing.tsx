import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Table as TableIcon, Search, Trash2, Settings, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const brl = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const Route = createFileRoute("/admin/pricing")({
  component: PricingPage,
});

function PricingPage() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // Managing rules modal
  const [selectedTable, setSelectedTable] = useState<any>(null);

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["pricing-tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_tables")
        .select("*, pricing_rules(count)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const filteredTables = tables.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateTable = async () => {
    if (!newTableName.trim()) return;
    setIsCreating(true);
    try {
      const { error } = await supabase.from("pricing_tables").insert({
        name: newTableName,
        is_default: tables.length === 0,
      });
      if (error) throw error;
      
      toast.success("Tabela criada com sucesso!");
      setIsCreateTableOpen(false);
      setNewTableName("");
      qc.invalidateQueries({ queryKey: ["pricing-tables"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar tabela");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm("Tem certeza? Esta ação removerá a tabela e todas as suas regras, e pode afetar lojistas que usam esta tabela.")) return;
    
    try {
      const { error } = await supabase.from("pricing_tables").delete().eq("id", id);
      if (error) throw error;
      toast.success("Tabela excluída.");
      qc.invalidateQueries({ queryKey: ["pricing-tables"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir tabela");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tabelas de Preço</h1>
        <p className="text-muted-foreground mt-2">
          Matriz de precificação de Origem x Destino
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar tabela..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        
        <Button onClick={() => setIsCreateTableOpen(true)} className="rounded-xl shrink-0">
          <Plus className="mr-2 h-4 w-4" /> Nova Tabela
        </Button>
      </div>

      {isLoading ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTables.map((t) => (
            <div key={t.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              {t.is_default && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-bl-xl">
                  Padrão
                </div>
              )}
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <TableIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground uppercase tracking-tight">{t.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t.pricing_rules?.[0]?.count || 0} regras ativas
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mb-6 line-clamp-2 min-h-10">
                Configure a matriz de preços entre bairros e regiões para as empresas que usam esta tabela.
              </p>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl"
                  onClick={() => setSelectedTable(t)}
                >
                  <Settings className="mr-2 h-4 w-4" /> Gerenciar Regras
                </Button>
                
                {!t.is_default && (
                  <Button 
                    variant="ghost" 
                    className="w-10 px-0 rounded-xl text-destructive hover:bg-destructive hover:text-white shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteTable(t.id)}
                    title="Excluir tabela"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          
          {filteredTables.length === 0 && (
            <div className="col-span-full h-40 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl text-muted-foreground">
              <TableIcon className="h-8 w-8 mb-2 opacity-50" />
              <p>Nenhuma tabela encontrada.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={isCreateTableOpen} onOpenChange={setIsCreateTableOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova Tabela de Preços</DialogTitle>
            <DialogDescription>
              Crie uma tabela exclusiva para um Lojista ou um grupo específico.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              placeholder="Ex: Tabela Souza Aviamentos"
              autoFocus
              className="rounded-xl h-12"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateTableOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleCreateTable} disabled={isCreating || !newTableName.trim()} className="rounded-xl">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Salvar Tabela"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* TODO: Add Managing Rules Component here later */}
      {selectedTable && (
         <PricingRulesManager 
           table={selectedTable} 
           onClose={() => setSelectedTable(null)} 
         />
      )}
    </div>
  );
}

// Sub-component for managing rules
function PricingRulesManager({ table, onClose }: { table: any, onClose: () => void }) {
  const qc = useQueryClient();
  const [originId, setOriginId] = useState("");
  const [destId, setDestId] = useState("");
  const [baseValue, setBaseValue] = useState("");
  
  const { data: regions = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data } = await supabase.from("regions").select("*").order("name");
      return data || [];
    }
  });

  const { data: rules = [], isLoading: isLoadingRules } = useQuery({
    queryKey: ["pricing-rules", table.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pricing_rules")
        .select("*, origin:regions!pricing_rules_origin_region_id_fkey(name), dest:regions!pricing_rules_destination_region_id_fkey(name)")
        .eq("pricing_table_id", table.id);
      return data || [];
    }
  });

  const handleAddRule = async () => {
    if (!originId || !destId || !baseValue) {
      toast.error("Preencha origem, destino e valor base.");
      return;
    }
    
    const baseNum = parseFloat(baseValue.replace(",", "."));
    
    if (isNaN(baseNum)) {
      toast.error("Valor base inválido.");
      return;
    }

    try {
      const { error } = await supabase.from("pricing_rules").insert({
        pricing_table_id: table.id,
        origin_region_id: originId,
        destination_region_id: destId,
        base_value: baseNum,
        return_value: 0,
      });

      if (error) throw error;
      
      toast.success("Regra adicionada!");
      setOriginId("");
      setDestId("");
      setBaseValue("");
      qc.invalidateQueries({ queryKey: ["pricing-rules", table.id] });
      qc.invalidateQueries({ queryKey: ["pricing-tables"] });
    } catch (err: any) {
      if (err.message?.includes("duplicate")) {
         toast.error("Já existe uma regra para esta origem e destino!");
      } else {
         toast.error(err.message || "Erro ao adicionar regra.");
      }
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await supabase.from("pricing_rules").delete().eq("id", ruleId);
      qc.invalidateQueries({ queryKey: ["pricing-rules", table.id] });
      qc.invalidateQueries({ queryKey: ["pricing-tables"] });
      toast.success("Regra removida.");
    } catch (err) {
      toast.error("Erro ao remover regra.");
    }
  };

  return (
    <Dialog open={!!table} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20 shrink-0">
          <DialogTitle className="text-xl">Regras: {table.name}</DialogTitle>
          <DialogDescription>
            Defina o preço da corrida entre as regiões.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-background">
          <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
            <h3 className="font-bold text-sm uppercase tracking-wider mb-4">Adicionar Nova Regra</h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
              <div className="space-y-2 sm:col-span-1">
                <label className="text-xs font-semibold text-muted-foreground">Origem</label>
                <Select value={originId} onValueChange={setOriginId}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {regions.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-center pb-2 shrink-0 sm:col-span-1">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="space-y-2 sm:col-span-1">
                <label className="text-xs font-semibold text-muted-foreground">Destino</label>
                <Select value={destId} onValueChange={setDestId}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {regions.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-1">
                <label className="text-xs font-semibold text-muted-foreground">Custo (R$)</label>
                <Input 
                  value={baseValue}
                  onChange={(e) => setBaseValue(e.target.value.replace(/[^0-9,.]/g, ""))}
                  placeholder="Ex: 8,50" 
                  className="rounded-xl h-10"
                />
              </div>

              <div className="sm:col-span-1">
                <Button onClick={handleAddRule} className="w-full rounded-xl h-10 font-bold">
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider mb-4">Matriz de Preços Configuradas</h3>
            {isLoadingRules ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rules.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-border rounded-2xl text-muted-foreground">
                <TableIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhuma regra definida para esta tabela.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Origem</th>
                      <th className="px-4 py-3 font-semibold">Destino</th>
                      <th className="px-4 py-3 font-semibold text-right">Valor</th>
                      <th className="px-4 py-3 font-semibold w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rules.map((rule: any) => (
                      <tr key={rule.id} className="bg-card hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{rule.origin?.name}</td>
                        <td className="px-4 py-3 font-medium">{rule.dest?.name}</td>
                        <td className="px-4 py-3 font-bold text-right text-primary">{brl(rule.base_value)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-white hover:bg-destructive rounded-lg"
                            onClick={() => handleDeleteRule(rule.id)}
                            title="Remover regra"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
