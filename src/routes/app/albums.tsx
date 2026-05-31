import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, Star, UserPlus, Share2, Clock, Trash2, Plus, Folder } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/app/albums")({
  component: AlbumsPage,
});

const SYSTEM_ICONS: Record<string, { icon: typeof Heart; label: string }> = {
  liked: { icon: Heart, label: "Liked" },
  favorites: { icon: Star, label: "Favoritos" },
  clips_in: { icon: UserPlus, label: "Clips You Are In" },
  sent_by_friends: { icon: Share2, label: "Enviado por amigos" },
  history: { icon: Clock, label: "Watch History" },
  trash: { icon: Trash2, label: "Recentemente excluído" },
};

function AlbumsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<"meus" | "jogos" | "shared">("meus");
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);

  const { data: albums = [] } = useQuery({
    queryKey: ["albums", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("albums")
        .select("*")
        .order("is_system", { ascending: false })
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("albums").insert({ name, owner_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Álbum criado");
      setNewName(""); setOpen(false);
      qc.invalidateQueries({ queryKey: ["albums"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("albums").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Álbum excluído");
      qc.invalidateQueries({ queryKey: ["albums"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const system = albums.filter((a) => a.is_system);
  const mine = albums.filter((a) => !a.is_system);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-4xl font-black">Álbuns</h1>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {system.map((a) => {
          const meta = SYSTEM_ICONS[a.system_key ?? ""] ?? { icon: Folder, label: a.name };
          const Icon = meta.icon;
          return (
            <button
              key={a.id}
              className="flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-4 text-left transition-colors hover:bg-secondary"
            >
              <Icon className="h-5 w-5 text-foreground" />
              <span className="text-sm font-bold">{a.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-6 flex items-center gap-8 border-b border-border">
        {([
          ["meus", "Meus álbuns"],
          ["jogos", "Meus jogos"],
          ["shared", "Compartilhados comigo"],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`relative pb-3 text-sm font-bold transition-colors ${
              tab === k ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
            {tab === k && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="group flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <Plus className="h-7 w-7" />
              <span className="text-sm font-semibold">Novo Álbum</span>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar novo álbum</DialogTitle></DialogHeader>
            <Input placeholder="Nome do álbum" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <DialogFooter>
              <Button disabled={!newName || create.isPending} onClick={() => create.mutate(newName)}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {mine.map((a) => (
          <div key={a.id} className="group relative flex flex-col gap-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-secondary">
              <div className="absolute inset-x-3 -top-1 h-3 rounded-t-md bg-secondary/80" />
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Folder className="h-10 w-10" />
              </div>
              <button
                onClick={() => remove.mutate(a.id)}
                className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="truncate text-sm font-semibold">{a.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
