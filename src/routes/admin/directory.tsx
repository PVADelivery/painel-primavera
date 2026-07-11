import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDirectory, useCreateDirectoryBusiness, useUpdateDirectoryBusiness, useDeleteDirectoryBusiness, DirectoryBusiness, useDirectoryCategories, useUpdateDirectoryCategories } from "@/services/directory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Building2, Plus, MoreHorizontal, Trash, Edit, Upload, Image as ImageIcon } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/admin/directory")({
  component: DirectoryAdminPage,
});

function DirectoryAdminPage() {
  const { data = [], isLoading } = useDirectory();
  const create = useCreateDirectoryBusiness();
  const update = useUpdateDirectoryBusiness();
  const remove = useDeleteDirectoryBusiness();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<DirectoryBusiness>>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const resetForm = () => {
    setForm({
      name: "", category: "Tudo", phone: "", whatsapp: "", address: "", website: "",
      hours: "", rating: 5, featured: false, card_style: "dark", card_image_url: ""
    });
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (b: DirectoryBusiness) => {
    setForm(b);
    setEditingId(b.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este item da agenda?")) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Excluído com sucesso");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await update.mutateAsync({ id: editingId, data: form });
        toast.success("Atualizado com sucesso");
      } else {
        await create.mutateAsync(form);
        toast.success("Criado com sucesso");
      }
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `directory_${Math.random().toString(36).substring(2)}-${Date.now()}.${ext}`;
      const filePath = user?.id ? `${user.id}/${fileName}` : `${fileName}`;

      // Requer um bucket chamado 'directory-assets' criado e público no Supabase
      // Se nao existir, vamos tentar 'avatars' que j sabemos que existe
      const bucketName = "avatars"; // Alterado para avatars para garantir que funciona imediatamente, o user no precisa criar.
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      
      setForm(prev => ({ ...prev, card_image_url: urlData.publicUrl }));
      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao enviar imagem: " + error.message);
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const set = (k: keyof DirectoryBusiness, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda da Cidade</h1>
          <p className="text-sm text-muted-foreground">Gerencie os cartões de visita virtuais do app cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <CategoryManager />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Novo Cartão</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
              <DialogHeader><DialogTitle className="text-2xl font-black">{editingId ? "Editar Cartão" : "Novo Cartão"}</DialogTitle></DialogHeader>
              
              <form onSubmit={handleSave} className="space-y-4 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Nome da Empresa</label>
                    <Input required value={form.name || ""} onChange={e => set("name", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Categoria</label>
                    <Input required value={form.category || ""} onChange={e => set("category", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">WhatsApp (apenas números)</label>
                    <Input value={form.whatsapp || ""} onChange={e => set("whatsapp", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Telefone Comum</label>
                    <Input value={form.phone || ""} onChange={e => set("phone", e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Endereço Completo</label>
                    <Input value={form.address || ""} onChange={e => set("address", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Site ou Link</label>
                    <Input value={form.website || ""} onChange={e => set("website", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Horário de Func.</label>
                    <Input value={form.hours || ""} onChange={e => set("hours", e.target.value)} />
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-4">
                  <h3 className="font-bold text-lg mb-3">Aparência do Cartão</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Estilo de Cores (Gerado Automaticamente)</label>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2 border border-border p-3 rounded-xl cursor-pointer hover:bg-muted">
                          <input type="radio" name="card_style" checked={form.card_style === "dark"} onChange={() => set("card_style", "dark")} />
                          <span className="font-medium">Dark Premium (Preto/Amarelo)</span>
                        </label>
                        <label className="flex items-center gap-2 border border-border p-3 rounded-xl cursor-pointer hover:bg-muted">
                          <input type="radio" name="card_style" checked={form.card_style === "light"} onChange={() => set("card_style", "light")} />
                          <span className="font-medium">Light Clean (Branco/Azul)</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">OU Arte Pronta do Cartão (Imagem)</label>
                      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUploadImage} />
                      
                      {form.card_image_url ? (
                        <div className="relative rounded-2xl overflow-hidden border border-border w-full max-w-sm aspect-[1.58] group">
                          <img src={form.card_image_url} alt="Cartão" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                              {uploading ? "Enviando..." : "Trocar Imagem"}
                            </Button>
                            <Button type="button" variant="destructive" size="sm" onClick={() => set("card_image_url", null)}>Remover</Button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors max-w-sm aspect-[1.58]"
                        >
                          {uploading ? (
                            <span className="font-medium text-muted-foreground animate-pulse">Enviando imagem...</span>
                          ) : (
                            <>
                              <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                              <span className="font-medium text-muted-foreground">Clique para fazer upload da arte</span>
                              <span className="text-xs text-muted-foreground/70 mt-1">Formato ideal: Retangular (Cartão de Visita)</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={uploading || create.isPending || update.isPending}>Salvar Cartão</Button>
                </div>
              </form>

            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando agenda...</p>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma empresa na agenda.</p>
        ) : (
          data.map((c) => (
            <div key={c.id} className="rounded-2xl bg-card border border-border shadow-card overflow-hidden flex flex-col">
              {c.card_image_url ? (
                <div className="w-full aspect-[1.58] bg-muted">
                  <img src={c.card_image_url} alt={c.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`w-full aspect-[1.58] p-5 flex flex-col justify-between ${c.card_style === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-zinc-950 text-white'}`}>
                  <div>
                    <h3 className="font-bold text-lg leading-tight truncate">{c.name}</h3>
                    <p className={`text-xs font-bold uppercase mt-1 ${c.card_style === 'light' ? 'text-blue-600' : 'text-primary'}`}>{c.category}</p>
                  </div>
                  {c.phone && <p className="text-xs truncate">{c.phone}</p>}
                </div>
              )}
              
              <div className="p-4 flex items-center justify-between mt-auto">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.category} • {c.whatsapp || c.phone}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(c)}>
                      <Edit className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => handleDelete(c.id)}>
                      <Trash className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
}

function CategoryManager() {
  const { data: categories = [], isLoading } = useDirectoryCategories();
  const update = useUpdateDirectoryCategories();
  const [open, setOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    // Evita duplicatas ignorando case sensitivity
    if (categories.find(c => c.toLowerCase() === newCat.trim().toLowerCase())) {
      toast.error("Categoria já existe");
      return;
    }
    const updated = [...categories, newCat.trim()];
    try {
      await update.mutateAsync(updated);
      setNewCat("");
      toast.success("Categoria adicionada");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemove = async (cat: string) => {
    if (!confirm(`Remover categoria "${cat}"?`)) return;
    const updated = categories.filter(c => c !== cat);
    try {
      await update.mutateAsync(updated);
      toast.success("Categoria removida");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Building2 className="mr-2 h-4 w-4" /> Categorias</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input 
              value={newCat} 
              onChange={e => setNewCat(e.target.value)} 
              placeholder="Nova categoria..." 
            />
            <Button type="submit" disabled={update.isPending || isLoading}>Adicionar</Button>
          </form>
          <div className="border border-border rounded-xl divide-y max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <p className="p-4 text-center text-muted-foreground text-sm">Carregando...</p>
            ) : categories.length === 0 ? (
              <p className="p-4 text-center text-muted-foreground text-sm">Nenhuma categoria.</p>
            ) : (
              categories.map(cat => (
                <div key={cat} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                  <span className="font-medium text-sm">{cat}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleRemove(cat)} disabled={update.isPending}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
