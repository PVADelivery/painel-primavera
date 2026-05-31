import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Check, X, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/friends")({ component: FriendsPage });

function FriendsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: friendships = [] } = useQuery({
    queryKey: ["friendships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("friendships").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const respond = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "rejected" }) => {
      const { error } = await supabase.from("friendships").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["friendships"] });
    },
  });

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-black">Amigos</h1>
      {friendships.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center text-muted-foreground">
          <UserPlus className="mb-3 h-10 w-10" />
          <p>Nenhuma solicitação de amizade ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {friendships.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <div>
                <div className="text-sm font-semibold">{f.requester_id === user?.id ? "Para" : "De"}: {(f.requester_id === user?.id ? f.addressee_id : f.requester_id).slice(0, 8)}…</div>
                <div className="text-xs text-muted-foreground">Status: {f.status}</div>
              </div>
              {f.status === "pending" && f.addressee_id === user?.id && (
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => respond.mutate({ id: f.id, status: "accepted" })}>
                    <Check className="h-4 w-4 text-success" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => respond.mutate({ id: f.id, status: "rejected" })}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
