import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Table as TableIcon, Search, Trash2, Settings, Store, Check, Pencil, X, ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AdminLayout } from "@/components/admin/AdminLayout";

const DEFAULT_TABLE_ID = "__regions_default__";

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

  const { data: regions = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data } = await supabase.from("regions").select("*").order("name");
      return data || [];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, logo_url, pricing_table_id")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // A tabela padrão é a própria tabela de Regiões (planilha)
  const defaultTable = {
    id: DEFAULT_TABLE_ID,
    name: "Tabela de Regiões",
    isRegionsDefault: true,
    regionsCount: regions.length,
  };

  const allTables: any[] = [defaultTable, ...tables];

  const filteredTables = allTables.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const linkedCompanies = (t: any) =>
    t.isRegionsDefault
      ? companies.filter((c: any) => !c.pricing_table_id)
      : companies.filter((c: any) => c.pricing_table_id === t.id);

  const handleCreateTable = async () => {
    if (!newTableName.trim()) return;
    setIsCreating(true);
    try {
      const { error } = await supabase.from("pricing_tables").insert({
        name: newTableName,
        is_default: false,
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
    if (!confirm("Tem certeza? Esta ação removerá a tabela e todas as suas regras. As lojas vinculadas voltarão a usar a Tabela de Regiões.")) return;

    try {
      await supabase.from("companies").update({ pricing_table_id: null }).eq("pricing_table_id", id);
      const { error } = await supabase.from("pricing_tables").delete().eq("id", id);
      if (error) throw error;
      toast.success("Tabela excluída.");
      qc.invalidateQueries({ queryKey: ["pricing-tables"] });
      qc.invalidateQueries({ queryKey: ["companies-pricing"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir tabela");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tabelas de Preço</h1>
        <p className="text-muted-foreground mt-2">
          A Tabela de Regiões é o padrão. Crie tabelas extras para lojas com valores diferentes.
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
          {filteredTables.map((t) => {
            const linked = linkedCompanies(t);
            return (
            <div key={t.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              {t.isRegionsDefault && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-bl-xl">
                  Padrão
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  {t.isRegionsDefault
                    ? <MapPin className="h-6 w-6 text-primary" />
                    : <TableIcon className="h-6 w-6 text-primary" />}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground uppercase tracking-tight">{t.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t.isRegionsDefault
                      ? `${t.regionsCount} regiões (valores oficiais)`
                      : `${t.pricing_rules?.[0]?.count || 0} regiões personalizadas`}
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-10">
                {t.isRegionsDefault
                  ? "Valores padrão de cada região. Toda loja sem tabela própria usa esta."
                  : "Defina o valor de entrega de cada região para as lojas que usam esta tabela."}
              </p>

              <div className="mb-6 flex flex-wrap gap-1.5">
                {linked.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">Nenhuma loja vinculada</span>
                ) : (
                  <>
                    {linked.slice(0, 4).map((c: any) => (
                      <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        <Store className="h-3 w-3" /> {c.name}
                      </span>
                    ))}
                    {linked.length > 4 && (
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        +{linked.length - 4}
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setSelectedTable(t)}
                >
                  <Settings className="mr-2 h-4 w-4" /> Editar Valores
                </Button>

                {!t.isRegionsDefault && (
                  <Button
                    variant="ghost"
                    className="w-10 px-0 rounded-xl text-destructive hover:bg-destructive hover:text-white shrink-0"
                    onClick={() => handleDeleteTable(t.id)}
                    title="Excluir tabela"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            );
          })}

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

      {selectedTable && (
         <PricingRulesManager
           table={selectedTable}
           onClose={() => setSelectedTable(null)}
         />
      )}
      </div>
    </AdminLayout>
  );
}

// Sub-component: edita apenas o valor de cada região nesta tabela
function PricingRulesManager({ table, onClose }: { table: any, onClose: () => void }) {
  const qc = useQueryClient();
  const isDefault = !!table.isRegionsDefault;
  const [editingRegion, setEditingRegion] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingCompany, setSavingCompany] = useState<string | null>(null);
  const [storesOpen, setStoresOpen] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");

  const { data: regions = [], isLoading: isLoadingRegions } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data } = await supabase.from("regions").select("*").order("name");
      return data || [];
    }
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-pricing"],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, logo_url, pricing_table_id")
        .order("name");
      return data || [];
    }
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["pricing-rules", table.id],
    enabled: !isDefault,
    queryFn: async () => {
      const { data } = await supabase
        .from("pricing_rules")
        .select("*")
        .eq("pricing_table_id", table.id);
      return data || [];
    }
  });

  const isLinked = (c: any) => (isDefault ? !c.pricing_table_id : c.pricing_table_id === table.id);

  const linkedCount = companies.filter(isLinked).length;

  const filteredCompanies = useMemo(
    () =>
      companies.filter((c: any) =>
        c.name?.toLowerCase().includes(storeSearch.trim().toLowerCase())
      ),
    [companies, storeSearch]
  );

  const ruleForRegion = (regionId: string) =>
    rules.find((r: any) => r.origin_region_id === regionId && r.destination_region_id === regionId);

  const toggleCompany = async (company: any) => {
    const linked = isLinked(company);
    if (isDefault && linked) {
      toast.info("Esta loja já usa a Tabela de Regiões (padrão).");
      return;
    }
    setSavingCompany(company.id);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ pricing_table_id: isDefault ? null : (linked ? null : table.id) })
        .eq("id", company.id);
      if (error) throw error;
      toast.success(
        linked ? `${company.name} voltou para a Tabela de Regiões.` : `${company.name} usará esta tabela.`
      );
      qc.invalidateQueries({ queryKey: ["companies-pricing"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao vincular loja.");
    } finally {
      setSavingCompany(null);
    }
  };

  const handleSaveRegionValue = async (regionId: string) => {
    const num = parseFloat(editValue.replace(",", "."));
    if (isNaN(num) || num < 0) {
      toast.error("Valor inválido.");
      return;
    }
    setSaving(true);
    try {
      if (isDefault) {
        const { error } = await supabase.from("regions").update({ price: num }).eq("id", regionId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["regions"] });
      } else {
        const existing = ruleForRegion(regionId);
        if (existing) {
          const { error } = await supabase
            .from("pricing_rules")
            .update({ base_value: num })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("pricing_rules").insert({
            pricing_table_id: table.id,
            origin_region_id: regionId,
            destination_region_id: regionId,
            base_value: num,
            return_value: 0,
          });
          if (error) throw error;
        }
        qc.invalidateQueries({ queryKey: ["pricing-rules", table.id] });
        qc.invalidateQueries({ queryKey: ["pricing-tables"] });
      }
      toast.success("Valor atualizado!");
      setEditingRegion(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar valor.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetRegion = async (regionId: string) => {
    const existing = ruleForRegion(regionId);
    if (!existing) return;
    try {
      await supabase.from("pricing_rules").delete().eq("id", existing.id);
      qc.invalidateQueries({ queryKey: ["pricing-rules", table.id] });
      qc.invalidateQueries({ queryKey: ["pricing-tables"] });
      toast.success("Valor voltou ao padrão da região.");
    } catch {
      toast.error("Erro ao restaurar valor padrão.");
    }
  };

  return (
    <Dialog open={!!table} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20 shrink-0">
          <DialogTitle className="text-xl">Valores: {table.name}</DialogTitle>
          <DialogDescription>
            {isDefault
              ? "Estes são os valores oficiais das regiões, usados por toda loja sem tabela própria."
              : "Edite o valor de entrega de cada região nesta tabela e escolha quais lojas a usam."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-background">
          {/* Lojas vinculadas — lista recolhível com busca */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setStoresOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-muted/30 transition-colors"
            >
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                  <Store className="h-4 w-4 text-primary" /> Lojas que usam esta tabela
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {linkedCount} loja(s) vinculada(s) — clique para {storesOpen ? "ocultar" : "abrir"} a lista
                </p>
              </div>
              {storesOpen
                ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
            </button>

            {storesOpen && (
              <div className="border-t border-border p-5 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    placeholder="Pesquisar nome da loja..."
                    className="pl-9 h-10 rounded-xl"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2 max-h-64 overflow-y-auto pr-1">
                  {filteredCompanies.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma loja encontrada.</p>
                  )}
                  {filteredCompanies.map((c: any) => {
                    const linked = isLinked(c);
                    const otherTable = !linked && !!c.pricing_table_id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCompany(c)}
                        disabled={savingCompany === c.id}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                          linked
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:bg-muted/40"
                        }`}
                      >
                        <div className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center ${linked ? "bg-primary border-primary" : "border-border"}`}>
                          {savingCompany === c.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : linked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{c.name}</p>
                          {otherTable && (
                            <p className="text-[11px] text-muted-foreground">Usando outra tabela</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Valores por região */}
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider mb-4">Valores por Região</h3>
            {isLoadingRegions ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : regions.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-border rounded-2xl text-muted-foreground">
                <TableIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhuma região cadastrada.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Região</th>
                      <th className="px-4 py-3 font-semibold text-right">Valor nesta tabela</th>
                      <th className="px-4 py-3 font-semibold w-28"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {regions.map((region: any) => {
                      const rule = isDefault ? null : ruleForRegion(region.id);
                      const value = rule ? Number(rule.base_value) : Number(region.price || 0);
                      const isEditing = editingRegion === region.id;
                      return (
                        <tr key={region.id} className="bg-card hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium">{region.name}</span>
                            {!isDefault && !rule && (
                              <span className="ml-2 text-[11px] text-muted-foreground">(padrão da região)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value.replace(/[^0-9,.]/g, ""))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveRegionValue(region.id);
                                  if (e.key === "Escape") setEditingRegion(null);
                                }}
                                autoFocus
                                className="h-9 w-28 ml-auto rounded-lg text-right"
                              />
                            ) : (
                              <span className="font-bold text-primary">{brl(value)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={saving}
                                    className="h-8 w-8 p-0 text-primary rounded-lg"
                                    onClick={() => handleSaveRegionValue(region.id)}
                                    title="Salvar"
                                  >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-lg"
                                    onClick={() => setEditingRegion(null)}
                                    title="Cancelar"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-lg"
                                    onClick={() => { setEditingRegion(region.id); setEditValue(String(value).replace(".", ",")); }}
                                    title="Editar valor"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {rule && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-destructive hover:text-white hover:bg-destructive rounded-lg"
                                      onClick={() => handleResetRegion(region.id)}
                                      title="Voltar ao valor padrão da região"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
