import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { CreateCompanyForm } from "@/components/admin/CreateCompanyForm";
import { GenerateInviteDialog } from "@/components/admin/GenerateInviteDialog";
import { EditCompanyDialog } from "@/components/admin/EditCompanyDialog";
import { useCompanies, useCreateCompany } from "@/services/companies";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Building2, Plus, MoreHorizontal, Trash, Power, Search, X } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/companies")({
  component: CompaniesPage,
});

function CompaniesPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useCompanies();
  const create = useCreateCompany();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", address: "" });

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data;
    return data.filter((company) => {
      const c = company as typeof company & { trade_name?: string | null; cnpj?: string | null };
      const matchName = (c.name || "").toLowerCase().includes(q) || (c.trade_name || "").toLowerCase().includes(q);
      const matchAddress = (c.address || "").toLowerCase().includes(q);
      const matchPhone = (c.phone || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""));
      const matchDoc = (c.document || c.cnpj || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""));
      return matchName || matchAddress || matchPhone || matchDoc;
    });
  }, [data, searchQuery]);

  const handleToggleActive = async (companyId: string, isActive: boolean) => {
    const { error } = await supabase.from("companies").update({ is_active: !isActive }).eq("id", companyId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isActive ? "Empresa desativada" : "Empresa ativada");
      qc.invalidateQueries({ queryKey: ["companies"] });
    }
  };

  const handleDelete = async (companyId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta empresa?")) return;
    const { error } = await supabase.from("companies").delete().eq("id", companyId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Empresa excluída");
      qc.invalidateQueries({ queryKey: ["companies"] });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync(form);
      toast.success("Empresa cadastrada");
      setOpen(false);
      setForm({ name: "", phone: "", address: "" });
    } catch (err) { toast.error((err as Error).message); }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card shadow-card p-6 rounded-2xl border border-border/50">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground">Empresas</h1>
          <p className="text-sm text-muted-foreground font-medium">Lojistas conectados à sua operação ({filteredCompanies.length} empresas)</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <GenerateInviteDialog fixedRole="company" triggerLabel="Convidar Empresa" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="whitespace-nowrap flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0">
                <Plus className="h-4 w-4" /> Nova empresa
              </button>
            </DialogTrigger>
          <DialogContent 
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl"
          >
            <DialogHeader><DialogTitle className="text-2xl font-black">Cadastrar Empresa</DialogTitle></DialogHeader>
            <CreateCompanyForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* ── BARRA DE BUSCA DE EMPRESAS ── */}
      <div className="mb-6 max-w-md">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome da loja, endereço, telefone..."
            className="pl-10 pr-9 h-11 rounded-xl bg-card border-border shadow-sm text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Empresa</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Endereço</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Telefone</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filteredCompanies.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma empresa encontrada com os filtros aplicados.</td></tr>
              ) : (
                filteredCompanies.map((c) => (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent overflow-hidden shrink-0">
                          {c.logo_url ? <img src={c.logo_url} className="w-full h-full object-cover" /> : <Building2 className="h-4 w-4" />}
                        </div>
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.address || "—"}</td>
                    <td className="px-4 py-3">{c.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${c.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {c.is_active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <EditCompanyDialog company={c} />
                          <DropdownMenuItem onClick={() => handleToggleActive(c.id, !!c.is_active)}>
                            <Power className="h-4 w-4 mr-2" />
                            {c.is_active ? "Desativar" : "Ativar"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => handleDelete(c.id)}>
                            <Trash className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── BONASOFT Watermark ── */}
      <div className="pt-8 pb-4 flex justify-center opacity-40 select-none pointer-events-none">
        <span className="text-[10px] font-black tracking-[0.5em] text-muted-foreground uppercase">
          B O N A S O F T
        </span>
      </div>
    </AdminLayout>
  );
}
