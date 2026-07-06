// @ts-nocheck
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useCities, useCreateCity, useDeleteCity, useUpdateCity } from "@/services/cities";
import { Building2, Globe, MapPin, Plus, Trash2, Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { BaseManagerModal } from "@/components/admin/BaseManagerModal";

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute('/admin/bases')({
  component: BasesPage,
});

function BasesPage() {
  const { data: cities, isLoading } = useCities();
  const { mutateAsync: createCity } = useCreateCity();
  const { mutateAsync: updateCity } = useUpdateCity();
  const { mutateAsync: deleteCity } = useDeleteCity();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [cityName, setCityName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editCityId, setEditCityId] = useState("");
  const [editCityName, setEditCityName] = useState("");

  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [managerCityId, setManagerCityId] = useState("");
  const [managerCityName, setManagerCityName] = useState("");

  const handleCreate = async () => {
    if (!cityName.trim()) return toast.error("Nome da cidade obrigatório");
    setIsSubmitting(true);
    try {
      await createCity({ name: cityName.trim().toUpperCase(), active: true });
      toast.success("Base criada com sucesso");
      setIsCreateOpen(false);
      setCityName("");
    } catch (e: any) {
      toast.error("Erro ao criar: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editCityName.trim()) return toast.error("Nome da cidade obrigatório");
    setIsSubmitting(true);
    try {
      await updateCity({ id: editCityId, updates: { name: editCityName.trim().toUpperCase() } });
      toast.success("Base atualizada com sucesso");
      setIsEditOpen(false);
    } catch (e: any) {
      toast.error("Erro ao atualizar: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (id: string, name: string) => {
    setEditCityId(id);
    setEditCityName(name);
    setIsEditOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover a base ${name}?`)) return;
    try {
      await deleteCity(id);
      toast.success("Base removida");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    try {
      await updateCity({ id, updates: { active: !active } });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  return (
    <AdminLayout title="Bases" subtitle="Gestão das cidades de atendimento da plataforma">
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Globe className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Bases</p>
                  <p className="text-3xl font-black text-foreground">{cities?.length || 0}</p>
                </div>
              </div>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Base
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Nova Base</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Nome da Cidade</Label>
                      <Input 
                        value={cityName} 
                        onChange={e => setCityName(e.target.value)} 
                        placeholder="Ex: CUIABÁ - MT"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                      <Button onClick={handleCreate} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Base"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border bg-muted/20">
            <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
              <MapPin className="h-5 w-5 text-primary" />
              Bases Cadastradas
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Cidades cadastradas no sistema que podem ter regiões de entrega.
            </p>
          </div>
          
          <div className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground">Carregando...</div>
            ) : cities?.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground border-dashed border-2 border-border/50 m-6 rounded-2xl">
                <Globe className="w-12 h-12 mx-auto text-muted mb-3" />
                Nenhuma base cadastrada ainda. Clique em "Nova Base" para começar.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-6 py-4 text-left font-semibold text-muted-foreground">Cidade</th>
                    <th className="px-6 py-4 text-left font-semibold text-muted-foreground">Status</th>
                    <th className="px-6 py-4 text-right font-semibold text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cities?.map(city => (
                    <tr key={city.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-6 py-4 font-bold text-base">{city.name}</td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => toggleActive(city.id, !!city.active)}
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ${city.active ? "bg-success/10 text-success hover:bg-success/20" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                        >
                          {city.active ? "Operante" : "Desativada"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setManagerCityId(city.id); setManagerCityName(city.name); setIsManagerOpen(true); }}>
                            Gerenciar Base
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(city.id, city.name)} className="text-primary hover:bg-primary/10">
                            <Edit2 className="w-4 h-4 mr-1.5" /> Editar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(city.id, city.name)} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Base</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nome da Cidade</Label>
              <Input 
                value={editCityName} 
                onChange={e => setEditCityName(e.target.value)} 
                placeholder="Ex: CUIABÁ - MT"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
              <Button onClick={handleEdit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isManagerOpen && (
        <BaseManagerModal
          isOpen={isManagerOpen}
          onClose={() => setIsManagerOpen(false)}
          cityId={managerCityId}
          cityName={managerCityName}
        />
      )}
    </AdminLayout>
  );
}
