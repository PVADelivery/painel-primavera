import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  MessageSquare,
  Search,
  Send,
  User as UserIcon,
  Phone,
  Store,
  Bike,
  CheckCheck,
  Loader2,
  RefreshCw,
  Trash2,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/admin/chat")({
  component: AdminChatPage,
});

interface Conversation {
  id: string;
  order_id: string | null;
  participants: string[];
  created_at: string;
  updated_at: string;
  subject?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  participantInfo?: {
    name: string;
    phone: string | null;
    avatarUrl: string | null;
    role: "customer" | "driver" | "company" | "admin" | "unknown";
    roleLabel: string;
  };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

const QUICK_REPLIES = [
  "Olá! Como posso te ajudar hoje?",
  "Olá! Já estou verificando a sua solicitação, só um instante.",
  "Seu pedido já foi despachado e está a caminho!",
  "Pode me enviar uma foto ou comprovante para conferirmos?",
  "O entregador já foi avisado e está se deslocando.",
  "Solicitação resolvida! Se precisar de mais alguma coisa, estamos à disposição.",
];

export function AdminChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "support" | "orders" | "drivers" | "companies">("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carrega todas as conversas do banco e cruza com dados de usuários/perfis
  const loadConversations = async () => {
    try {
      setLoading(true);
      const { data: convData, error: convError } = await supabase
        .from("conversations" as any)
        .select("*")
        .order("updated_at", { ascending: false });

      if (convError) {
        console.error("Erro ao buscar conversas:", convError);
        toast.error("Erro ao carregar lista de conversas");
        return;
      }

      if (!convData || convData.length === 0) {
        setConversations([]);
        return;
      }

      // Extrai todos os participantes únicos
      const allUserIds = new Set<string>();
      convData.forEach((c: any) => {
        if (Array.isArray(c.participants)) {
          c.participants.forEach((p: string) => {
            if (p && p !== user?.id) allUserIds.add(p);
          });
        }
      });

      // Busca dados dos perfis, motoristas, empresas e clientes
      const userIdsList = Array.from(allUserIds);
      const [profilesRes, driversRes, companiesRes, customersRes] = await Promise.all([
        userIdsList.length > 0
          ? supabase.from("profiles" as any).select("user_id, full_name, phone, avatar_url, role").in("user_id", userIdsList)
          : Promise.resolve({ data: [] }),
        userIdsList.length > 0
          ? supabase.from("drivers" as any).select("user_id, full_name, phone").in("user_id", userIdsList)
          : Promise.resolve({ data: [] }),
        userIdsList.length > 0
          ? supabase.from("companies" as any).select("user_id, name, phone, logo_url").in("user_id", userIdsList)
          : Promise.resolve({ data: [] }),
        userIdsList.length > 0
          ? supabase.from("customers" as any).select("user_id, full_name, phone").in("user_id", userIdsList)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));
      const driverMap = new Map((driversRes.data || []).map((d: any) => [d.user_id, d]));
      const companyMap = new Map((companiesRes.data || []).map((c: any) => [c.user_id, c]));
      const customerMap = new Map((customersRes.data || []).map((c: any) => [c.user_id, c]));

      // Busca a última mensagem de cada conversa
      const enrichedConversations: Conversation[] = await Promise.all(
        convData.map(async (conv: any) => {
          const { data: latestMsgs } = await supabase
            .from("messages" as any)
            .select("*")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(5);

          let subject = "";
          let lastMessage = "";
          let lastMessageAt = conv.updated_at || conv.created_at;

          if (latestMsgs && latestMsgs.length > 0) {
            // Procura assunto
            const subjectMsg = latestMsgs.find((m: any) => m.content.startsWith("[Assunto:"));
            if (subjectMsg) {
              subject = subjectMsg.content.replace("[Assunto:", "").replace("]", "").trim();
            }

            // Pega a mensagem real mais recente
            const actualMsg = latestMsgs.find((m: any) => !m.content.startsWith("[Assunto:")) || latestMsgs[0];
            lastMessage = actualMsg ? actualMsg.content.replace(/\u200B/g, "") : "";
            lastMessageAt = actualMsg ? actualMsg.created_at : lastMessageAt;
          }

          // Identifica o participante principal (diferente do admin atual)
          const otherParticipantId = conv.participants?.find((p: string) => p !== user?.id) || conv.participants?.[0];

          let name = "Usuário";
          let phone: string | null = null;
          let avatarUrl: string | null = null;
          let role: "customer" | "driver" | "company" | "admin" | "unknown" = "customer";
          let roleLabel = "Cliente";

          if (otherParticipantId) {
            const p = profileMap.get(otherParticipantId) as any;
            const d = driverMap.get(otherParticipantId) as any;
            const c = companyMap.get(otherParticipantId) as any;
            const cust = customerMap.get(otherParticipantId) as any;

            if (c) {
              name = c.name || "Empresa";
              phone = c.phone;
              avatarUrl = c.logo_url;
              role = "company";
              roleLabel = "Loja / Empresa";
            } else if (d) {
              name = d.full_name || "Entregador";
              phone = d.phone;
              role = "driver";
              roleLabel = "Entregador";
            } else if (p) {
              name = p.full_name || cust?.full_name || "Cliente";
              phone = p.phone || cust?.phone;
              avatarUrl = p.avatar_url;
              if (p.role === "driver") {
                role = "driver";
                roleLabel = "Entregador";
              } else if (p.role === "company") {
                role = "company";
                roleLabel = "Loja / Empresa";
              } else if (p.role === "admin" || p.role === "master") {
                role = "admin";
                roleLabel = "Administrador";
              } else {
                role = "customer";
                roleLabel = "Cliente";
              }
            } else if (cust) {
              name = cust.full_name || "Cliente";
              phone = cust.phone;
              role = "customer";
              roleLabel = "Cliente";
            }
          }

          return {
            id: conv.id,
            order_id: conv.order_id,
            participants: conv.participants || [],
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            subject,
            lastMessage,
            lastMessageAt,
            participantInfo: {
              name,
              phone,
              avatarUrl,
              role,
              roleLabel,
            },
          };
        })
      );

      // Ordena pelas mensagens mais recentes
      enrichedConversations.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());

      setConversations(enrichedConversations);

      // Se nenhum chat estiver selecionado, seleciona o primeiro
      if (!selectedConvId && enrichedConversations.length > 0) {
        setSelectedConvId(enrichedConversations[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar conversas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();

    // Escuta novas conversas em tempo real
    const convChannel = supabase
      .channel("admin_conversations_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
    };
  }, [user]);

  // Carrega as mensagens da conversa selecionada
  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        setLoadingMessages(true);
        const { data, error } = await supabase
          .from("messages" as any)
          .select("*")
          .eq("conversation_id", selectedConvId)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Erro ao carregar mensagens:", error);
          toast.error("Falha ao carregar histórico da conversa");
          return;
        }

        setMessages((data as Message[]) || []);
      } catch (err) {
        console.error("Erro ao buscar mensagens:", err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();

    // Inscrição Realtime para novas mensagens na conversa atual
    const channelName = `admin_chat_${selectedConvId}_${Math.random().toString(36).substring(7)}`;
    const msgChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Atualiza o preview na lista de conversas
          setConversations((prev) =>
            prev.map((c) =>
              c.id === selectedConvId
                ? {
                    ...c,
                    lastMessage: newMsg.content.replace(/\u200B/g, ""),
                    lastMessageAt: newMsg.created_at,
                  }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [selectedConvId]);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Envio de mensagem
  const handleSendMessage = async (customContent?: string) => {
    const textToSend = (customContent || newMessage).trim();
    if (!textToSend || !selectedConvId || !user || sending) return;

    try {
      setSending(true);

      const conv = conversations.find((c) => c.id === selectedConvId);

      // Garante que o admin é participante da conversa
      if (conv && !conv.participants.includes(user.id)) {
        await supabase
          .from("conversations" as any)
          .update({
            participants: Array.from(new Set([...conv.participants, user.id])),
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", selectedConvId);
      }

      // Adiciona o zero-width space invisível \u200B no final para diferenciar que veio do Admin
      const contentWithMark = textToSend + "\u200B";

      const optimisticMsg: Message = {
        id: crypto.randomUUID(),
        conversation_id: selectedConvId,
        sender_id: user.id,
        content: contentWithMark,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setNewMessage("");

      const { error } = await supabase.from("messages" as any).insert({
        id: optimisticMsg.id,
        conversation_id: selectedConvId,
        sender_id: user.id,
        content: contentWithMark,
      } as any);

      if (error) {
        console.error("Erro ao enviar mensagem:", error);
        toast.error("Erro ao enviar mensagem");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      } else {
        // Atualiza updated_at da conversa
        await supabase
          .from("conversations" as any)
          .update({ updated_at: new Date().toISOString() } as any)
          .eq("id", selectedConvId);
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      toast.error("Falha de conexão ao enviar");
    } finally {
      setSending(false);
    }
  };

  // Excluir ou encerrar conversa
  const handleDeleteConversation = async (convId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta conversa e todo o histórico?")) return;

    try {
      const { error } = await supabase.from("conversations" as any).delete().eq("id", convId);
      if (error) {
        toast.error("Erro ao excluir conversa");
      } else {
        toast.success("Conversa excluída");
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (selectedConvId === convId) {
          setSelectedConvId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      toast.error("Erro ao excluir conversa");
    }
  };

  // Filtragem das conversas
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Filtro por termo de busca
      const searchMatch =
        searchTerm === "" ||
        c.participantInfo?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.participantInfo?.phone?.includes(searchTerm) ||
        c.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!searchMatch) return false;

      // Filtro por abas
      if (filterTab === "support") return !c.order_id;
      if (filterTab === "orders") return !!c.order_id;
      if (filterTab === "drivers") return c.participantInfo?.role === "driver";
      if (filterTab === "companies") return c.participantInfo?.role === "company";

      return true;
    });
  }, [conversations, searchTerm, filterTab]);

  const currentSelectedConv = conversations.find((c) => c.id === selectedConvId);

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-6.5rem)] max-h-[920px] gap-4">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              Central de Atendimento & Chat
            </h1>
            <p className="text-sm text-muted-foreground">
              Comunicação em tempo real com clientes, motoristas, entregadores e lojistas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadConversations}
              disabled={loading}
              className="gap-1.5 shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Main Chat Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 bg-card rounded-2xl border border-border/80 shadow-sm overflow-hidden">
          {/* Left Column: Conversations List */}
          <div className="md:col-span-4 lg:col-span-4 flex flex-col border-r border-border/60 bg-muted/20 min-h-0">
            {/* Search and Filters */}
            <div className="p-3 border-b border-border/60 space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar conversa ou cliente..."
                  className="pl-9 h-9 text-sm bg-background/80"
                />
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar text-xs">
                <button
                  onClick={() => setFilterTab("all")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                    filterTab === "all"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Todos ({conversations.length})
                </button>
                <button
                  onClick={() => setFilterTab("support")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                    filterTab === "support"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Suporte
                </button>
                <button
                  onClick={() => setFilterTab("drivers")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                    filterTab === "drivers"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Entregadores
                </button>
                <button
                  onClick={() => setFilterTab("companies")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                    filterTab === "companies"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Lojas
                </button>
                <button
                  onClick={() => setFilterTab("orders")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                    filterTab === "orders"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pedidos
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border/40">
              {loading && conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs">Carregando conversas...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-10 w-10 stroke-1 opacity-40 mb-2" />
                  <p className="text-sm font-medium">Nenhuma conversa encontrada</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    As mensagens iniciadas pelos usuários no app aparecerão aqui.
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = conv.id === selectedConvId;
                  const info = conv.participantInfo;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`w-full text-left p-3.5 transition-all flex items-start gap-3 relative ${
                        isSelected
                          ? "bg-primary/10 hover:bg-primary/15"
                          : "hover:bg-muted/50 bg-background/50"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                      )}

                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {info?.avatarUrl ? (
                          <img
                            src={info.avatarUrl}
                            alt={info.name}
                            className="w-11 h-11 rounded-full object-cover border border-border/80"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
                            {info?.name.charAt(0).toUpperCase() || "U"}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${
                            info?.role === "driver"
                              ? "bg-blue-500"
                              : info?.role === "company"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          title={info?.roleLabel}
                        />
                      </div>

                      {/* Info & Snippet */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className="font-semibold text-sm truncate text-foreground">
                            {info?.name || "Usuário"}
                          </p>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {conv.lastMessageAt
                              ? new Date(conv.lastMessageAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-4 font-normal"
                          >
                            {info?.roleLabel}
                          </Badge>
                          {conv.subject && (
                            <span className="text-[11px] font-medium text-primary truncate max-w-[140px]">
                              {conv.subject}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {conv.lastMessage || "Nenhuma mensagem ainda"}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Chat Window */}
          <div className="md:col-span-8 lg:col-span-8 flex flex-col min-h-0 bg-background/50">
            {selectedConvId && currentSelectedConv ? (
              <>
                {/* Chat Header */}
                <div className="p-3.5 border-b border-border/60 bg-card flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {currentSelectedConv.participantInfo?.avatarUrl ? (
                        <img
                          src={currentSelectedConv.participantInfo.avatarUrl}
                          alt={currentSelectedConv.participantInfo.name}
                          className="w-10 h-10 rounded-full object-cover border border-border/80"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
                          {currentSelectedConv.participantInfo?.name.charAt(0).toUpperCase() || "U"}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-sm text-foreground truncate">
                          {currentSelectedConv.participantInfo?.name}
                        </h2>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                          {currentSelectedConv.participantInfo?.roleLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {currentSelectedConv.participantInfo?.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="h-3 w-3" />
                            {currentSelectedConv.participantInfo.phone}
                          </span>
                        )}
                        {currentSelectedConv.subject && (
                          <span className="text-primary font-medium">
                            • {currentSelectedConv.subject}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {currentSelectedConv.participantInfo?.phone && (
                      <a
                        href={`https://wa.me/55${currentSelectedConv.participantInfo.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all"
                        title="Abrir no WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteConversation(currentSelectedConv.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Excluir Conversa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 custom-scrollbar">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-6">
                      <MessageSquare className="h-10 w-10 stroke-1 opacity-40 mb-2" />
                      <p className="text-sm font-medium">Nenhuma mensagem neste chat</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Envie uma mensagem abaixo para iniciar o atendimento.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      // Mensagem de assunto inicial
                      if (msg.content.startsWith("[Assunto:")) {
                        const subjectText = msg.content.replace("[Assunto:", "").replace("]", "").trim();
                        return (
                          <div key={msg.id} className="flex justify-center my-3">
                            <div className="bg-primary/10 border border-primary/20 rounded-full px-3.5 py-1 flex items-center gap-1.5 shadow-sm">
                              <HelpCircle className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs font-semibold text-primary">
                                Assunto do Atendimento: {subjectText}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      // Identifica se a mensagem é do Admin
                      const isAdminMsg =
                        msg.sender_id === user?.id ||
                        msg.content.endsWith("\u200B");

                      const cleanContent = msg.content.replace(/\u200B/g, "");

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col w-full ${isAdminMsg ? "items-end" : "items-start"}`}
                        >
                          <div
                            className={`relative max-w-[80%] px-3.5 py-2.5 rounded-2xl shadow-sm ${
                              isAdminMsg
                                ? "bg-primary text-primary-foreground rounded-br-xs"
                                : "bg-card border border-border/80 text-foreground rounded-bl-xs"
                            }`}
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap pr-10">
                              {cleanContent}
                            </p>
                            <div className="flex items-center justify-end gap-1 absolute bottom-1 right-2">
                              <span
                                className={`text-[10px] ${
                                  isAdminMsg
                                    ? "text-primary-foreground/75"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {new Date(msg.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {isAdminMsg && (
                                <CheckCheck className="h-3 w-3 text-primary-foreground/90" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Replies */}
                <div className="px-3 pt-2 pb-1 border-t border-border/40 bg-card/40 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                  <span className="text-[11px] font-semibold text-muted-foreground shrink-0 flex items-center gap-1 pl-1">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    Respostas Rápidas:
                  </span>
                  {QUICK_REPLIES.map((reply, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(reply)}
                      disabled={sending}
                      className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border border-border/60 transition-all shrink-0 whitespace-nowrap disabled:opacity-50"
                    >
                      {reply}
                    </button>
                  ))}
                </div>

                {/* Input Area */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="p-3 bg-card border-t border-border/60 flex items-center gap-2 shrink-0"
                >
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite sua resposta para o cliente..."
                    className="flex-1 h-10 text-sm bg-background"
                    disabled={sending}
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="h-10 px-4 gap-1.5 shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span className="hidden sm:inline">Enviar</span>
                      </>
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3 shadow-inner">
                  <MessageSquare className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-base text-foreground">Nenhuma conversa selecionada</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Selecione uma conversa na lista lateral para visualizar o histórico e responder em tempo real.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
