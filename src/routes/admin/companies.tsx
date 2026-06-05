import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { CreateCompanyForm } from "@/components/admin/CreateCompanyForm";
import { GenerateInviteDialog } from "@/components/admin/GenerateInviteDialog";
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

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : data.length === 0 ? (
        <Card className="p-16 text-center shadow-card">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma empresa cadastrada</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Card key={c.id} className="p-5 shadow-card hover:shadow-card-hover transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.address || "—"}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger className="p-2 rounded-lg hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {c.phone && <p>{c.phone}</p>}
                <p>{c.is_active ? "Ativa" : "Inativa"}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
