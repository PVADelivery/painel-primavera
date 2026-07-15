import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit, Loader2 } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRegions } from "@/services/regions";

export function EditCompanyDialog({ company }: { company: any }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { data: regions } = useRegions();
  
  const { data: pricingTables } = useQuery({
    queryKey: ["pricing-tables-select"],
    queryFn: async () => {
      const { data } = await supabase.from("pricing_tables").select("id, name, is_default").order("is_default", { ascending: false });
      return data || [];
    },
    enabled: open
  });
  
  const [form, setForm] = useState({
    name: company.name || "",
    phone: company.phone || "",
    address: company.address || "",
    region_id: company.region_id || "",
    pricing_table_id: company.pricing_table_id || "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: company.name || "",
        phone: company.phone || "",
        address: company.address || "",
        region_id: company.region_id || "",
        pricing_table_id: company.pricing_table_id || "",
      });
    }
  }, [open, company]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from("companies").update({
        name: form.name,
        phone: form.phone,
        address: form.address,
        region_id: form.region_id || null,
        pricing_table_id: form.pricing_table_id || null,
      }).eq("id", company.id);

      if (error) throw error;
      
      toast.success("Empresa atualizada com sucesso!");
      setOpen(false);
      // Let parent handle invalidation, or we can force reload
      window.dispatchEvent(new Event("focus")); // quick trigger for react-query if configured, or just manual invalidate
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
          <Edit className="h-4 w-4 mr-2" />
          Editar Dados
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-3xl" onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Editar Empresa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1 block">Nome da Empresa</label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Telefone</label>
            <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Endereço</label>
            <Input value={form.address} onChange={e => set("address", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Região Padrão</label>
            <select 
              value={form.region_id} 
              onChange={(e) => set("region_id", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Nenhuma região</option>
              {regions?.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Tabela de Preços (Matriz de Entrega)</label>
            <select 
              value={form.pricing_table_id || ""} 
              onChange={(e) => set("pricing_table_id", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Padrão do Sistema</option>
              {pricingTables?.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name} {t.is_default ? "(Padrão)" : ""}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Selecione a tabela de regras de preço para esta loja.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
