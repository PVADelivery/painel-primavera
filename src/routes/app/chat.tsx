import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, Search, Users, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/chat")({ component: ChatPage });

function ChatPage() {
  const { user } = useAuth();
  const { data: messages = [] } = useQuery({
    queryKey: ["chat-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="flex h-full">
      <aside className="w-80 shrink-0 border-r border-border p-4">
        <Button className="w-full justify-start gap-2 mb-2"><MessageSquareText className="h-4 w-4" /> Criar Bate-papo</Button>
        <Button variant="secondary" className="w-full justify-start gap-2 mb-4"><Users className="h-4 w-4" /> Iniciar Grupo</Button>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Encontre uma conversa..." />
        </div>
        <div className="mt-4 space-y-1">
          {messages.length === 0 && (
            <p className="px-2 py-8 text-center text-xs text-muted-foreground">Sem conversas ainda.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg px-3 py-2 hover:bg-secondary cursor-pointer">
              <div className="truncate text-sm font-semibold">{m.sender_id === user?.id ? "Você" : "Amigo"}</div>
              <div className="truncate text-xs text-muted-foreground">{m.body}</div>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
        <MessageSquare className="mb-4 h-20 w-20 opacity-50" />
        <h3 className="text-xl font-bold">Poxa, você não tem nenhuma mensagem.</h3>
        <p>Comece uma conversa!</p>
      </div>
    </div>
  );
}
