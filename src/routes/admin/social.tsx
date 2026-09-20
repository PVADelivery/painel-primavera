import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useSocialPosts,
  useApproveSocialPost,
  useUpdateSocialPost,
  useDeleteSocialPost,
  useCreateSocialPost,
  SocialPost,
  SocialCategory,
  CATEGORY_LABEL,
} from "@/services/social";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Share2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Edit,
  Phone,
  MessageCircle,
  Eye,
  EyeOff,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Tag,
  Calendar,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { WhatsappIcon } from "@/components/icons/WhatsappIcon";

export const Route = createFileRoute("/admin/social")({
  component: AdminSocialPage,
});

function AdminSocialPage() {
  const { data: posts = [], isLoading } = useSocialPosts();
  const approve = useApproveSocialPost();
  const update = useUpdateSocialPost();
  const remove = useDeleteSocialPost();
  const create = useCreateSocialPost();

  const [tab, setTab] = useState<"pending" | "active" | "all">("pending");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);

  const [form, setForm] = useState<{
    category: SocialCategory;
    title: string;
    body: string;
    contact: string;
    is_active: boolean;
  }>({
    category: "vagas",
    title: "",
    body: "",
    contact: "",
    is_active: true,
  });

  const pendingCount = useMemo(() => posts.filter((p) => !p.is_active).length, [posts]);
  const activeCount = useMemo(() => posts.filter((p) => p.is_active).length, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (tab === "pending" && p.is_active) return false;
      if (tab === "active" && !p.is_active) return false;
      if (selectedCategory !== "all" && p.category !== selectedCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = p.title?.toLowerCase().includes(q);
        const matchBody = p.body?.toLowerCase().includes(q);
        const matchContact = p.contact?.toLowerCase().includes(q);
        return matchTitle || matchBody || matchContact;
      }
      return true;
    });
  }, [posts, tab, selectedCategory, search]);

  const openNewModal = () => {
    setEditingPost(null);
    setForm({
      category: "vagas",
      title: "",
      body: "",
      contact: "",
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (post: SocialPost) => {
    setEditingPost(post);
    setForm({
      category: post.category,
      title: post.title,
      body: post.body || "",
      contact: post.contact || "",
      is_active: post.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Informe um título para o classificado.");
      return;
    }

    try {
      if (editingPost) {
        await update.mutateAsync({
          id: editingPost.id,
          data: {
            category: form.category,
            title: form.title.trim(),
            body: form.body.trim() || null,
            contact: form.contact.trim() || null,
            is_active: form.is_active,
          },
        });
        toast.success("Classificado atualizado com sucesso!");
      } else {
        await create.mutateAsync({
          category: form.category,
          title: form.title.trim(),
          body: form.body.trim() || null,
          contact: form.contact.trim() || null,
          is_active: form.is_active,
        });
        toast.success("Classificado criado e publicado!");
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Tente novamente"));
    }
  };

  const handleApprove = async (post: SocialPost) => {
    try {
      await approve.mutateAsync(post.id);
      toast.success(`Classificado "${post.title}" aprovado e publicado com sucesso!`);
    } catch (err: any) {
      toast.error("Erro ao aprovar: " + (err.message || "Tente novamente"));
    }
  };

  const handleToggleActive = async (post: SocialPost) => {
    try {
      await update.mutateAsync({
        id: post.id,
        data: { is_active: !post.is_active },
      });
      toast.success(
        !post.is_active ? "Classificado ativado com sucesso!" : "Classificado pausado/desativado."
      );
    } catch (err: any) {
      toast.error("Erro ao alterar status: " + err.message);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Tem certeza que deseja excluir o classificado "${title}"?`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Classificado excluído.");
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-2xl bg-primary/20 text-primary flex items-center justify-center font-bold">
                <Share2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  Espaço Social & Classificados
                </h1>
                <p className="text-xs text-muted-foreground">
                  Gerencie aprovações de pagamentos e publicações de classificados da comunidade.
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={openNewModal}
            className="h-11 px-5 rounded-2xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Novo Classificado
          </Button>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-2xl font-black text-foreground mt-1">{posts.length}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
              <Share2 className="h-5 w-5" />
            </div>
          </div>

          <div
            onClick={() => setTab("pending")}
            className={`p-4 rounded-3xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
              pendingCount > 0
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15"
                : "bg-card border-border/80 text-muted-foreground"
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-black uppercase tracking-wider">Pendentes</p>
                {pendingCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </div>
              <p className="text-2xl font-black mt-1 text-foreground">{pendingCount}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div
            onClick={() => setTab("active")}
            className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs flex items-center justify-between cursor-pointer hover:border-border transition-all"
          >
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Publicados</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Taxa por Anúncio</p>
              <p className="text-2xl font-black text-foreground mt-1">R$ 0,99</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
              PIX
            </div>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Abas de Status */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-2xl w-full md:w-auto">
            <button
              type="button"
              onClick={() => setTab("pending")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tab === "pending"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Pendentes</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black font-black text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setTab("active")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tab === "active"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Publicados ({activeCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tab === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Todos ({posts.length})</span>
            </button>
          </div>

          {/* Busca e Categoria */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título ou contato..."
                className="pl-10 h-10 rounded-2xl bg-muted/40 border-border/60 text-xs font-medium"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-10 px-3 rounded-2xl bg-muted/40 border border-border/60 text-xs font-bold text-foreground outline-none cursor-pointer"
            >
              <option value="all">Todas Categorias</option>
              <option value="vagas">Vagas de Emprego</option>
              <option value="achados">Achados e Perdidos</option>
              <option value="doacoes">Doações</option>
              <option value="servicos">Serviços</option>
            </select>
          </div>
        </div>

        {/* Lista de Classificados */}
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground font-medium text-sm">
            Carregando classificados...
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-card border border-border/80 space-y-3">
            <div className="h-14 w-14 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
              <Share2 className="h-7 w-7" />
            </div>
            <h3 className="font-bold text-base text-foreground">Nenhum classificado encontrado</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {tab === "pending"
                ? "Não há solicitações pendentes de aprovação no momento."
                : "Nenhum anúncio corresponde aos filtros selecionados."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPosts.map((post) => {
              const rawContact = post.contact ? post.contact.replace(/\D/g, "") : "";
              const waLink = rawContact
                ? `https://wa.me/55${rawContact}?text=${encodeURIComponent(
                    `Olá! Sobre o seu anúncio *${post.title}* no Espaço Social do MT 24horas express:`
                  )}`
                : null;

              return (
                <div
                  key={post.id}
                  className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 relative ${
                    !post.is_active
                      ? "bg-amber-500/[0.04] border-amber-500/30 shadow-sm"
                      : "bg-card border-border/80 shadow-xs hover:border-border"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Status & Category */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                        {CATEGORY_LABEL[post.category] || post.category}
                      </span>

                      {!post.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <Clock className="h-3 w-3 animate-spin" /> Aguardando Pagamento / Aprovação
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3" /> Publicado
                        </span>
                      )}
                    </div>

                    {/* Título & Descrição */}
                    <div>
                      <h3 className="font-display font-black text-base text-foreground leading-snug">
                        {post.title}
                      </h3>
                      {post.body && (
                        <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap leading-relaxed line-clamp-4">
                          {post.body}
                        </p>
                      )}
                    </div>

                    {/* Contato & Data */}
                    <div className="pt-2 border-t border-border/50 space-y-1.5 text-xs text-muted-foreground">
                      {post.contact && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold text-foreground">
                            <Phone className="h-3.5 w-3.5 text-emerald-500" /> {post.contact}
                          </span>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] transition-colors"
                            >
                              <WhatsappIcon className="h-3.5 w-3.5" /> WhatsApp
                            </a>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                        <Calendar className="h-3 w-3" /> {formatDate(post.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="pt-3 border-t border-border/60 flex items-center gap-2">
                    {!post.is_active ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleApprove(post)}
                        className="flex-1 h-9 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Aprovar & Publicar
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(post)}
                        className="flex-1 h-9 rounded-xl font-bold text-xs border-border/80 text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center gap-1"
                      >
                        <EyeOff className="h-3.5 w-3.5" /> Desativar
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditModal(post)}
                      className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Editar anúncio"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(post.id, post.title)}
                      className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-destructive cursor-pointer"
                      title="Excluir anúncio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de Criação / Edição */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-md w-[92vw] rounded-3xl bg-background border border-border p-6 shadow-2xl">
            <DialogHeader className="pb-3 border-b border-border/50 text-left">
              <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                <span>{editingPost ? "Editar Classificado" : "Novo Classificado"}</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Categoria</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as SocialCategory })}
                  className="w-full h-11 px-3 rounded-2xl bg-muted/40 border border-border/70 text-sm font-semibold outline-none focus:border-primary"
                >
                  <option value="vagas">Vaga de Emprego</option>
                  <option value="achados">Achados e Perdidos</option>
                  <option value="doacoes">Doação</option>
                  <option value="servicos">Serviço</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Vaga Recepcionista, Chave encontrada..."
                  className="h-11 rounded-2xl bg-muted/40 border-border/70 text-sm font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Descrição</Label>
                <Textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Detalhes adicionais do anúncio..."
                  rows={4}
                  className="rounded-2xl bg-muted/40 border-border/70 text-sm resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Telefone / WhatsApp</Label>
                <Input
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  placeholder="(66) 99999-9999"
                  className="h-11 rounded-2xl bg-muted/40 border-border/70 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_active_check"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary cursor-pointer"
                />
                <Label htmlFor="is_active_check" className="text-xs font-bold text-foreground cursor-pointer">
                  Publicado / Ativo imediatamente
                </Label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  className="h-11 px-4 rounded-xl font-bold text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="h-11 px-6 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {editingPost ? "Salvar Alterações" : "Criar Anúncio"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
