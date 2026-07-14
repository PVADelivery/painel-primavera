// @ts-nocheck
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Map, Plus, Trash2, Loader2, ArrowRight } from "lucide-react";
import { useRegions } from "@/services/regions";

interface PricingRule {
  from: string;
  to: string;
  price: number;
  return_price: number;
}

interface CompanyPricingMatrixDialogProps {
  company: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyPricingMatrixDialog({ company, open, onOpenChange }: CompanyPricingMatrixDialogProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { data: regions } = useRegions();

  const [rules, setRules] = useState<PricingRule[]>([]);
  const [newRule, setNewRule] = useState<PricingRule>({ from: "", to: "", price: 0, return_price: 0 });

  useEffect(() => {
    if (company && open) {
      if (company.delivery_regions_pricing && typeof company.delivery_regions_pricing === "object") {
        const pricing = company.delivery_regions_pricing as any;
        setRules(pricing.matrix || []);
      } else {
        setRules([]);
      }
      setNewRule({ from: "", to: "", price: 0, return_price: 0 });
    }
  }, [company, open]);

  const handleAddRule = () => {
    if (!newRule.from || !newRule.to) {
      toast.error("Selecione a Origem e o Destino!");
      return;
    }
    if (newRule.price < 0 || newRule.return_price < 0) {
      toast.error("Valores não podem ser negativos!");
      return;
    }
    
    // Check for duplicate
    const exists = rules.find(r => r.from === newRule.from && r.to === newRule.to);
    if (exists) {
      toast.error("Já existe uma regra para essa Origem -> Destino!");
      return;
    }

    setRules([...rules, { ...newRule }]);
    setNewRule({ from: "", to: "", price: 0, return_price: 0 });
  };

  const handleRemoveRule = (index: number) => {
    const newRules = [...rules];
    newRules.splice(index, 1);
    setRules(newRules);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = {
        matrix: rules
      };

      const { error } = await supabase
        .from("companies")
        .update({ delivery_regions_pricing: payload as any })
        .eq("id", company.id);

      if (error) throw error;

      toast.success("Tabela de preços salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRegionName = (id: string) => {
    const r = regions?.find(x => x.id === id);
    return r ? r.name : "Desconhecida";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Map className="w-6 h-6 text-primary" />
            Matriz de Preço por Região - {company?.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure o preço exato de entrega e retorno baseado na região de coleta e entrega.
          </p>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Formulário de Adição */}
          <div className="bg-muted/30 p-4 rounded-xl border border-border flex flex-wrap lg:flex-nowrap items-end gap-3">
            <div className="flex-1 min-w-[150px]">
              <Label className="text-xs mb-1 block text-muted-foreground">Região de Origem (Coleta)</Label>
              <select
                value={newRule.from}
                onChange={e => setNewRule({ ...newRule, from: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-semibold"
              >
                <option value="">Selecione...</option>
                {(regions || []).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center justify-center pb-2 px-1">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-[150px]">
              <Label className="text-xs mb-1 block text-muted-foreground">Região de Destino (Entrega)</Label>
              <select
                value={newRule.to}
                onChange={e => setNewRule({ ...newRule, to: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-semibold"
              >
                <option value="">Selecione...</option>
                {(regions || []).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="w-28">
              <Label className="text-xs mb-1 block text-muted-foreground">Valor (R$)</Label>
              <CurrencyInput
                value={newRule.price || ""}
                onChangeValue={v => setNewRule({ ...newRule, price: parseFloat(v) || 0 })}
                className="h-10"
              />
            </div>

            <div className="w-28">
              <Label className="text-xs mb-1 block text-muted-foreground">Retorno (R$)</Label>
              <CurrencyInput
                value={newRule.return_price || ""}
                onChangeValue={v => setNewRule({ ...newRule, return_price: parseFloat(v) || 0 })}
                className="h-10"
              />
            </div>

            <Button onClick={handleAddRule} className="h-10 px-4 whitespace-nowrap">
              <Plus className="w-4 h-4 mr-2" /> Adicionar
            </Button>
          </div>

          {/* Tabela de Regras */}
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Origem</th>
                  <th className="px-4 py-3 text-left font-medium">Destino</th>
                  <th className="px-4 py-3 text-left font-medium">Valor</th>
                  <th className="px-4 py-3 text-left font-medium">Retorno</th>
                  <th className="px-4 py-3 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma regra configurada. A empresa usará a precificação padrão das regiões se nada for adicionado aqui.
                    </td>
                  </tr>
                ) : (
                  rules.map((rule, idx) => (
                    <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-semibold text-primary">{getRegionName(rule.from)}</td>
                      <td className="px-4 py-3 font-semibold text-primary">{getRegionName(rule.to)}</td>
                      <td className="px-4 py-3 font-mono">R$ {rule.price.toFixed(2)}</td>
                      <td className="px-4 py-3 font-mono">R$ {rule.return_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveRule(idx)} className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar Matriz
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
