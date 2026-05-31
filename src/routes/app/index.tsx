import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/")({
  component: HomePage,
});

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mi`;
  if (n >= 1_000) return `${Math.round(n / 1000)} mil`;
  return `${n}`;
}

function HomePage() {
  const { data: trending = [] } = useQuery({
    queryKey: ["games", "trending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("games")
        .select("*")
        .eq("trending", true)
        .order("followers_count", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: popular = [] } = useQuery({
    queryKey: ["games", "popular"],
    queryFn: async () => {
      const { data } = await supabase
        .from("games")
        .select("*")
        .order("followers_count", { ascending: false })
        .limit(16);
      return data ?? [];
    },
  });

  const featured = trending[0];

  return (
    <div className="p-6 space-y-10">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Jogos Novos em Alta</h2>
          <div className="flex gap-2">
            <Button size="icon" variant="ghost" className="rounded-full"><ChevronLeft /></Button>
            <Button size="icon" variant="ghost" className="rounded-full"><ChevronRight /></Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr_1fr]">
          {featured && (
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-secondary">
              {featured.cover_url && (
                <img src={featured.cover_url} alt={featured.name} className="absolute inset-0 h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute left-4 top-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/30 backdrop-blur">
                  <Monitor className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{featured.name}</h3>
                  <p className="text-xs text-white/70">Trailer cinematográfico</p>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <div>
                  <h3 className="text-2xl font-extrabold text-white">{featured.name}</h3>
                  <p className="text-sm text-white/80">{formatFollowers(featured.followers_count)} seguidores</p>
                </div>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Seguir</Button>
              </div>
            </div>
          )}

          {trending.slice(1, 3).map((g, i) => (
            <div key={g.id} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-secondary">
              {g.cover_url && <img src={g.cover_url} alt={g.name} className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute right-3 top-3 text-3xl font-black text-white drop-shadow-lg">#{i + 1}</div>
              <div className="absolute bottom-3 left-3 right-3 text-sm font-bold text-white truncate">{g.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold">Mais Populares na Medal</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {popular.map((g) => (
            <Link
              to="/app/games"
              key={g.id}
              className="group flex flex-col gap-2"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary transition-transform group-hover:scale-105">
                {g.cover_url && <img src={g.cover_url} alt={g.name} className="h-full w-full object-cover" />}
              </div>
              <div>
                <div className="truncate text-sm font-semibold">{g.name}</div>
                <div className="text-xs text-muted-foreground">{formatFollowers(g.followers_count)} seguidores</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
