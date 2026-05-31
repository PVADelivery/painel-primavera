import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, Star, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clips")({ component: ClipsPage });

function ClipsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [thumb, setThumb] = useState("");

  const { data: clips = [] } = useQuery({
    queryKey: ["clips", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clips")
        .select("*, games(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clips").insert({
        owner_id: user!.id,
        title,
        thumbnail_url: thumb || null,
        duration_seconds: 30,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clip adicionado"); setOpen(false); setTitle(""); setThumb("");
      qc.invalidateQueries({ queryKey: ["clips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: "liked" | "favorite"; value: boolean }) => {
      const patch = field === "liked" ? { liked: value } : { favorite: value };
      const { error } = await supabase.from("clips").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clips"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clip excluído");
      qc.invalidateQueries({ queryKey: ["clips"] });
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-black">Clips</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo clip</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar clip</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input placeholder="URL da miniatura (opcional)" value={thumb} onChange={(e) => setThumb(e.target.value)} />
            </div>
            <DialogFooter>
              <Button disabled={!title || create.isPending} onClick={() => create.mutate()}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {clips.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center text-muted-foreground">
          <Play className="mb-3 h-10 w-10" />
          <p>Você ainda não tem clips. Clique em "Novo clip" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {clips.map((c) => (
            <div key={c.id} className="group overflow-hidden rounded-xl bg-card border border-border">
              <div className="relative aspect-video bg-secondary">
                {c.thumbnail_url ? (
                  <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Play className="h-10 w-10" />
                  </div>
                )}
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
                  {c.duration_seconds}s
                </span>
              </div>
              <div className="p-3">
                <div className="mb-2 truncate text-sm font-semibold">{c.title}</div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggle.mutate({ id: c.id, field: "liked", value: !c.liked })}
                      className={`flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary ${c.liked ? "text-red-500" : "text-muted-foreground"}`}
                    >
                      <Heart className="h-4 w-4" fill={c.liked ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => toggle.mutate({ id: c.id, field: "favorite", value: !c.favorite })}
                      className={`flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary ${c.favorite ? "text-yellow-500" : "text-muted-foreground"}`}
                    >
                      <Star className="h-4 w-4" fill={c.favorite ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <button
                    onClick={() => remove.mutate(c.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
