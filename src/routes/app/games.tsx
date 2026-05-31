import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/games")({ component: GamesPage });

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mi`;
  if (n >= 1_000) return `${Math.round(n / 1000)} mil`;
  return `${n}`;
}

function GamesPage() {
  const { data: games = [] } = useQuery({
    queryKey: ["all-games"],
    queryFn: async () => {
      const { data } = await supabase.from("games").select("*").order("followers_count", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-3xl font-black">Mais Populares na Medal</h1>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {games.map((g) => (
          <div key={g.id} className="group flex flex-col gap-2">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary transition-transform group-hover:scale-105">
              {g.cover_url && <img src={g.cover_url} alt={g.name} className="h-full w-full object-cover" />}
            </div>
            <div className="truncate text-sm font-bold">{g.name}</div>
            <div className="text-xs text-muted-foreground">{fmt(g.followers_count)} seguidores</div>
          </div>
        ))}
      </div>
    </div>
  );
}
