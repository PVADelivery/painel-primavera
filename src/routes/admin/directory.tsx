import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDirectory, useCreateDirectoryBusiness, useUpdateDirectoryBusiness, useDeleteDirectoryBusiness, DirectoryBusiness, useDirectoryCategories, useUpdateDirectoryCategories } from "@/services/directory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building2, Plus, MoreHorizontal, Trash, Edit, Upload, Image as ImageIcon, Search, Check, ChevronDown, Tag, Smile, Sparkles, X, Pencil, ArrowDownAZ } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
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
    if (!confirm("Tem certeza que deseja excluir este prestador / cartão do PPP?")) return;
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

      const bucketName = "avatars";
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
          <h1 className="text-2xl font-bold tracking-tight">PPP — Prestadores de Serviços</h1>
          <p className="text-sm text-muted-foreground">Painel Profissional de Prestadores de Serviços e Cartões de Visita do App Marketplace</p>
        </div>
        <div className="flex items-center gap-2">
          <CategoryManager />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Novo Prestador / Cartão</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
              <DialogHeader><DialogTitle className="text-2xl font-black">{editingId ? "Editar Prestador / Cartão PPP" : "Novo Prestador / Cartão PPP"}</DialogTitle></DialogHeader>
              
              <form onSubmit={handleSave} className="space-y-4 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Nome do Prestador / Empresa</label>
                    <Input required value={form.name || ""} onChange={e => set("name", e.target.value)} placeholder="Ex: Eletricista Silva" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Categoria do PPP</label>
                    <CategorySelector value={form.category || ""} onChange={cat => set("category", cat)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">WhatsApp (apenas números)</label>
                    <Input value={form.whatsapp || ""} onChange={e => set("whatsapp", e.target.value)} placeholder="Ex: 66999998888" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Telefone Comum</label>
                    <Input value={form.phone || ""} onChange={e => set("phone", e.target.value)} placeholder="Ex: 6634981122" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Endereço Completo</label>
                    <Input value={form.address || ""} onChange={e => set("address", e.target.value)} placeholder="Ex: Av. Cuiabá, 123 - Centro" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Site ou Link</label>
                    <Input value={form.website || ""} onChange={e => set("website", e.target.value)} placeholder="Ex: https://instagram.com/perfil" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Horário de Func.</label>
                    <Input value={form.hours || ""} onChange={e => set("hours", e.target.value)} placeholder="Ex: Seg a Sex: 08h às 18h" />
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <label className="flex items-center gap-2 cursor-pointer border border-border p-2.5 rounded-xl hover:bg-muted/50 w-full">
                      <input 
                        type="checkbox" 
                        checked={Boolean(form.featured)} 
                        onChange={e => set("featured", e.target.checked)} 
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-semibold text-foreground">⭐ Marcar como Destaque no App PPP</span>
                    </label>
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
          <p className="text-muted-foreground">Carregando prestadores do PPP...</p>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground">Nenhum prestador ou empresa cadastrado no PPP.</p>
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

const EMOJI_GROUPS = [
  {
    label: "Profissões & Serviços",
    emojis: ["🦷", "🩺", "💊", "💉", "👓", "⚡", "🔧", "🔨", "🪚", "🧰", "🧹", "🎨", "⚖️", "📐", "🧱", "🪠", "🚿", "🔒", "🎓", "📸"]
  },
  {
    label: "Beleza & Bem-Estar",
    emojis: ["💇", "💈", "💅", "🧖", "💄", "🧴", "🏋️", "🧘", "✨", "🌺"]
  },
  {
    label: "Alimentação & Bebidas",
    emojis: ["🍽️", "🍕", "🍔", "🌭", "🥪", "🍣", "🍰", "🍦", "☕", "🍻", "🥐", "🥖", "🥩", "🍉", "🥤", "🍩"]
  },
  {
    label: "Automotivo & Transporte",
    emojis: ["🚗", "🏍️", "🛵", "🚲", "🚚", "🛞", "⛽", "🧽", "🚕", "🚙"]
  },
  {
    label: "Comércio, Moda & Pets",
    emojis: ["🛒", "🛍️", "👗", "👟", "💍", "🎁", "📦", "📚", "🐶", "🐱", "🐾", "💻", "📱"]
  },
  {
    label: "Destaque & Outros",
    emojis: ["⭐", "🏷️", "📍", "📞", "🤝", "🎯", "🏆", "💡", "🔔", "🏢", "🏠"]
  }
];

const QUICK_EMOJIS = ["🦷", "🍽️", "🍔", "🛒", "💊", "🥖", "🐶", "💇", "🚗", "⚡", "🔧", "🧹", "🎨", "⚖️", "📱", "👗", "⭐"];

const EMOJI_REGEX = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u;

const sortCategoriesAlphabetically = (list: string[]) => {
  const isTudo = (c: string) => c.replace(EMOJI_REGEX, "").trim().toLowerCase() === "tudo";
  const tudo = list.filter(isTudo);
  const rest = list
    .filter(c => !isTudo(c))
    .sort((a, b) => {
      const aClean = a.replace(EMOJI_REGEX, "").trim();
      const bClean = b.replace(EMOJI_REGEX, "").trim();
      return aClean.localeCompare(bClean, "pt-BR", { sensitivity: "base" });
    });
  return [...tudo, ...rest];
};

function CategoryManager() {
  const { data: rawCategories = [], isLoading } = useDirectoryCategories();
  const categories = useMemo(() => sortCategoriesAlphabetically(rawCategories), [rawCategories]);
  const update = useUpdateDirectoryCategories();
  const [open, setOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🏷️");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customEmoji, setCustomEmoji] = useState("");

  // Edição inline de categoria existente
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [editEmoji, setEditEmoji] = useState("🏷️");
  const [editName, setEditName] = useState("");
  const [editPickerOpen, setEditPickerOpen] = useState(false);

  const handleNameChange = (val: string) => {
    const match = val.match(EMOJI_REGEX);
    if (match) {
      setSelectedEmoji(match[1]);
      setNewCat(val.replace(EMOJI_REGEX, "").trimStart());
    } else {
      setNewCat(val);
    }
  };

  const handleSortAll = async () => {
    const sorted = sortCategoriesAlphabetically(rawCategories);
    try {
      await update.mutateAsync(sorted);
      toast.success("Categorias organizadas em ordem alfabética (A-Z) com sucesso!");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCat.replace(EMOJI_REGEX, "").trim();
    if (!cleanName) {
      toast.error("Por favor, digite o nome da categoria.");
      return;
    }

    const fullCat = selectedEmoji ? `${selectedEmoji} ${cleanName}` : cleanName;

    // Evita duplicatas ignorando case e emojis
    const cleanLower = cleanName.toLowerCase();
    if (categories.some(c => c.replace(EMOJI_REGEX, "").trim().toLowerCase() === cleanLower)) {
      toast.error("Essa categoria já existe na lista!");
      return;
    }

    const updated = sortCategoriesAlphabetically([...categories, fullCat]);
    try {
      await update.mutateAsync(updated);
      setNewCat("");
      toast.success(`Categoria "${fullCat}" adicionada em ordem alfabética!`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStartEdit = (cat: string) => {
    const match = cat.match(EMOJI_REGEX);
    if (match) {
      setEditEmoji(match[1]);
      setEditName(cat.replace(EMOJI_REGEX, "").trim());
    } else {
      setEditEmoji("🏷️");
      setEditName(cat.trim());
    }
    setEditingCatName(cat);
  };

  const handleSaveEdit = async (originalCat: string) => {
    const cleanName = editName.replace(EMOJI_REGEX, "").trim();
    if (!cleanName) {
      toast.error("O nome da categoria não pode ficar vazio.");
      return;
    }
    const fullCat = editEmoji ? `${editEmoji} ${cleanName}` : cleanName;
    const updated = sortCategoriesAlphabetically(
      categories.map(c => c === originalCat ? fullCat : c)
    );
    try {
      await update.mutateAsync(updated);
      setEditingCatName(null);
      toast.success(`Categoria atualizada para "${fullCat}" e reordenada de A a Z!`);
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
      <DialogContent className="sm:max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <Sparkles className="h-5 w-5 text-primary" /> Gerenciar Categorias com Emojis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Formulário de Criação com Seletor de Emoji */}
          <form onSubmit={handleAdd} className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Nova Categoria
            </span>

            <div className="flex gap-2 items-center">
              {/* Botão de Escolha do Emoji com Popover */}
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="Clique para escolher um emoji"
                    className="h-11 w-14 rounded-xl border border-border bg-background hover:bg-muted text-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95 cursor-pointer"
                  >
                    {selectedEmoji}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3 rounded-2xl shadow-2xl max-h-80 overflow-y-auto z-50">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-border">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <Smile className="h-3.5 w-3.5 text-primary" /> Escolha o Emoji
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          maxLength={4}
                          value={customEmoji}
                          onChange={(e) => {
                            setCustomEmoji(e.target.value);
                            if (e.target.value.trim()) {
                              setSelectedEmoji(e.target.value.trim());
                              setPickerOpen(false);
                            }
                          }}
                          placeholder="Colar..."
                          className="h-6 w-14 text-xs text-center border border-border rounded-md bg-background"
                          title="Digite ou cole qualquer emoji aqui"
                        />
                      </div>
                    </div>

                    {EMOJI_GROUPS.map((group) => (
                      <div key={group.label} className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                          {group.label}
                        </span>
                        <div className="grid grid-cols-6 gap-1.5">
                          {group.emojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setSelectedEmoji(emoji);
                                setPickerOpen(false);
                              }}
                              className={`h-9 w-9 rounded-lg text-lg flex items-center justify-center transition-all hover:scale-110 hover:bg-primary/20 ${
                                selectedEmoji === emoji ? "bg-primary/30 border border-primary" : "hover:bg-muted"
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Input 
                value={newCat} 
                onChange={e => handleNameChange(e.target.value)} 
                placeholder="Nome da categoria (ex: Dentistas, Mecânica)..." 
                className="rounded-xl h-11 text-sm font-medium"
                required
              />
              <Button type="submit" disabled={update.isPending || isLoading} className="h-11 rounded-xl font-bold px-4 shrink-0">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>

            {/* Atalhos rápidos de emojis populares */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                Sugestões rápidas:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`h-8 w-8 rounded-lg text-base flex items-center justify-center transition-transform hover:scale-115 active:scale-95 border ${
                      selectedEmoji === emoji ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background border-border/70 hover:bg-muted"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Prévia elegante em tempo real */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground font-medium">Prévia no App:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 font-bold text-xs shadow-xs">
                <span>{selectedEmoji}</span>
                <span>{newCat.trim() || "Nova Categoria"}</span>
              </span>
            </div>
          </form>

          {/* Lista de Categorias com Opção de Edição Inline de Emoji */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Categorias Cadastradas ({categories.length})
                </span>
                <span className="text-[10px] text-muted-foreground lowercase block">
                  Ordem alfabética (A-Z) com Tudo no topo
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSortAll}
                disabled={update.isPending || isLoading}
                className="h-8 text-xs font-bold rounded-xl border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Reorganizar e salvar todas as categorias em ordem alfabética de A a Z"
              >
                <ArrowDownAZ className="h-4 w-4" /> Organizar A-Z
              </Button>
            </div>

            <div className="border border-border rounded-2xl divide-y max-h-[50vh] overflow-y-auto bg-background">
              {isLoading ? (
                <p className="p-6 text-center text-muted-foreground text-sm">Carregando categorias...</p>
              ) : categories.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground text-sm">Nenhuma categoria cadastrada.</p>
              ) : (
                categories.map((cat) => {
                  const isEditing = editingCatName === cat;

                  if (isEditing) {
                    return (
                      <div key={cat} className="p-3 bg-primary/5 flex items-center gap-2">
                        {/* Seletor de Emoji no modo edição */}
                        <Popover open={editPickerOpen} onOpenChange={setEditPickerOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="h-9 w-10 rounded-lg border border-border bg-background text-lg flex items-center justify-center shrink-0 hover:bg-muted cursor-pointer"
                            >
                              {editEmoji}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-3 rounded-2xl shadow-2xl max-h-72 overflow-y-auto z-50">
                            <div className="space-y-3">
                              <span className="text-xs font-bold block pb-1 border-b border-border">
                                Alterar Emoji da Categoria
                              </span>
                              {EMOJI_GROUPS.map((group) => (
                                <div key={group.label} className="space-y-1">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                    {group.label}
                                  </span>
                                  <div className="grid grid-cols-6 gap-1">
                                    {group.emojis.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => {
                                          setEditEmoji(emoji);
                                          setEditPickerOpen(false);
                                        }}
                                        className="h-8 w-8 rounded text-base flex items-center justify-center hover:bg-primary/20 cursor-pointer"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>

                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-9 text-xs font-semibold rounded-lg flex-1"
                        />

                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(cat)}
                          disabled={update.isPending}
                          className="h-9 rounded-lg px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingCatName(null)}
                          className="h-9 w-9 p-0 rounded-lg cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  }

                  const match = cat.match(EMOJI_REGEX);
                  const hasEmoji = Boolean(match);
                  const emojiChar = match ? match[1] : null;
                  const textOnly = match ? cat.replace(EMOJI_REGEX, "").trim() : cat;

                  return (
                    <div key={cat} className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        {hasEmoji ? (
                          <span className="text-xl shrink-0">{emojiChar}</span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground border shrink-0">sem emoji</span>
                        )}
                        <span className="font-semibold text-sm truncate">{textOnly}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg cursor-pointer" 
                          onClick={() => handleStartEdit(cat)}
                          title="Alterar emoji ou nome"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer" 
                          onClick={() => handleRemove(cat)} 
                          disabled={update.isPending}
                          title="Excluir categoria"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategorySelector({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const { data: categories = [] } = useDirectoryCategories();
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const sortedCategories = useMemo(() => sortCategoriesAlphabetically(categories), [categories]);

  // Lista de categorias filtradas pelo que o usuário digita na busca
  const filteredCategories = sortedCategories.filter(c => 
    c.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  const handleSelect = (categoryName: string) => {
    onChange(categoryName);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Gatilho principal estilizado como Select limpo */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-border bg-background px-3.5 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all hover:bg-muted/30"
      >
        <span className={value ? "font-semibold text-foreground flex items-center gap-2" : "text-muted-foreground flex items-center gap-2"}>
          <Tag className="h-4 w-4 text-primary" />
          {value || "Selecione ou busque uma categoria..."}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown elegante que abre com campo de busca interna */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-popover text-popover-foreground border border-border/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Campo de busca interno com ícone */}
          <div className="p-2 border-b border-border/60 bg-muted/20">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar ou cadastrar nova categoria..."
                className="h-8.5 w-full bg-background border border-border rounded-lg pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              />
            </div>
          </div>

          {/* Lista de Categorias com Scroll */}
          <div className="max-h-56 overflow-y-auto py-1 divide-y divide-border/30">
            {filteredCategories.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Nenhuma categoria encontrada com "{searchTerm}".</p>
                {searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelect(searchTerm.trim())}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 transition-all shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Usar "{searchTerm.trim()}"
                  </button>
                )}
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const isSelected = value?.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelect(cat)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-left transition-colors ${
                      isSelected 
                        ? "bg-primary/15 text-primary font-bold" 
                        : "hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${isSelected ? "bg-primary" : "bg-muted-foreground/40"}`} />
                      {cat}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-primary font-bold" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
