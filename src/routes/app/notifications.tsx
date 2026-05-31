import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Pin, X, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const seed = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").insert({
        user_id: user!.id,
        title: "A Medal é melhor no celular",
        body: "Baixe o app da Medal em seu celular para enviar e compartilhar seus clipes e ver o que seus amigos estão fazendo.",
        pinned: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notificação adicionada");
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
    },
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notificações</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => seed.mutate()} className="gap-1">
            <Plus className="h-4 w-4" /> Exemplo
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 text-success" onClick={() => markAll.mutate()}>
            <CheckCircle2 className="h-4 w-4" /> Atualizado
          </Button>
        </div>
      </div>

      {notifs.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Sem notificações.
        </p>
      )}

      <div className="space-y-3">
        {notifs.map((n) => (
          <div
            key={n.id}
            className={`relative flex gap-3 rounded-xl border p-4 ${
              n.pinned ? "border-l-4 border-l-primary border-border bg-card" : "border-border bg-card"
            }`}
          >
            {n.pinned && <Pin className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />}
            <div className="flex-1">
              <div className="font-bold">{n.title}</div>
              {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
            </div>
            <button
              onClick={() => remove.mutate(n.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
