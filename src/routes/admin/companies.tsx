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
import { Building2, Plus, MoreHorizontal, Trash, Power } from "lucide-react";
import { useState } from "react";
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
  const [form, setForm] = useState({ name: "", phone: "", address: "" });

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">Lojistas conectados à sua operação</p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateInviteDialog fixedRole="company" triggerLabel="Convidar Empresa" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova empresa</Button>
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
              ) : data.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma empresa cadastrada</td></tr>
              ) : (
                data.map((c) => (
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
