import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/discover")({ component: DiscoverPage });

function DiscoverPage() {
  const { data: games = [] } = useQuery({
    queryKey: ["discover-games"],
    queryFn: async () => {
      const { data } = await supabase.from("games").select("*").eq("trending", true);
      return data ?? [];
    },
  });
  return (
    <div className="p-6">
      <h1 className="mb-6 text-3xl font-black">Descobrir</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {games.map((g) => (
          <div key={g.id} className="overflow-hidden rounded-xl bg-secondary">
            {g.cover_url && <img src={g.cover_url} alt={g.name} className="aspect-[3/4] w-full object-cover" />}
            <div className="p-2 text-sm font-bold truncate">{g.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
