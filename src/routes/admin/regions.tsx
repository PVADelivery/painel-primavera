import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useRegions, useCreateRegion, useUpdateRegion, useDeleteRegion } from "@/services/regions";
import {
  useNeighborhoods,
  useCreateNeighborhood,
  useUpdateNeighborhood,
  useDeleteNeighborhood,
  type NeighborhoodRow,
} from "@/services/regionNeighborhoods";
import { toast } from "sonner";
import {
  Plus, Trash2, Loader2, Search, X, ChevronDown, ChevronUp,
  Check, Pencil, MapPin, Eye, EyeOff, ArrowRightLeft,
} from "lucide-react";

export const Route = createFileRoute("/admin/regions")({
  component: RegionsPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nenhuma região encontrada.</div>,
  head: () => ({
    meta: [
      { title: "Regiões e Bairros | MT 24 Horas Express" },
      { name: "description", content: "Planilha de regiões de entrega, bairros e valores do painel administrativo MT 24 Horas Express." },
      { property: "og:title", content: "Regiões e Bairros | MT 24 Horas Express" },
      { property: "og:description", content: "Gerencie regiões, bairros e taxas de entrega do sistema MT 24 Horas Express." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RegionsPage() {
  const { data: regions, isLoading } = useRegions();
  const { data: neighborhoods } = useNeighborhoods();

  const createRegion = useCreateRegion();
  const updateRegion = useUpdateRegion();
  const deleteRegion = useDeleteRegion();
  const createHood = useCreateNeighborhood();
  const updateHood = useUpdateNeighborhood();
  const deleteHood = useDeleteNeighborhood();

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sortedRegions = useMemo(() => {
    const list = Array.isArray(regions) ? [...regions] : [];
    return list.sort(
      (a: any, b: any) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || Number(a.price) - Number(b.price),
    );
  }, [regions]);

  const hoodsByRegion = useMemo(() => {
    const map: Record<string, NeighborhoodRow[]> = {};
    (neighborhoods ?? []).forEach((n) => {
      (map[n.region_id] ||= []).push(n);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
    );
    return map;
  }, [neighborhoods]);

  const term = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!term) return null;
    return (neighborhoods ?? []).filter((n) => n.name.toLowerCase().includes(term));
  }, [neighborhoods, term]);

  const handleAddRegion = async () => {
    const nextOrder = sortedRegions.length + 1;
    try {
      await createRegion.mutateAsync({
        name: `Região ${nextOrder}`,
        color: "#eab308",
        price: 0,
        is_active: true,
        sort_order: nextOrder,
      } as any);
      toast.success("Região criada");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteRegion = async (id: string, name: string) => {
    const count = (hoodsByRegion[id] ?? []).length;
    const msg = count
      ? `Excluir "${name}"? ${count} bairro(s) vinculado(s) também serão removidos.`
      : `Excluir "${name}"?`;
    if (!confirm(msg)) return;
    try {
      await deleteRegion.mutateAsync(id);
      toast.success("Região excluída");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto w-full">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" /> Regiões
          </h1>
          <p className="text-sm text-muted-foreground">Planilha de regiões, bairros e valores de entrega</p>
        </div>

        {/* toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar bairro..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-card border border-border text-sm outline-none focus:border-primary"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {sortedRegions.length} regiões · {(neighborhoods ?? []).length} bairros
            </span>
            <button
              onClick={handleAddRegion}
              disabled={createRegion.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Nova Região
            </button>
          </div>
        </div>

        {/* search results */}
        {matches && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-3">
              {matches.length} resultado(s) para "{search}"
            </p>
            <div className="space-y-2">
              {matches.map((m) => {
                const r: any = sortedRegions.find((x: any) => x.id === m.region_id);
                return (
                  <div key={m.id} className="flex items-center justify-between text-sm border-b border-border/60 pb-2 last:border-0">
                    <span className="font-semibold text-foreground">{m.name}</span>
                    <span className="text-muted-foreground">
                      {r?.name ?? "—"} · <strong className="text-primary">{brl(Number(r?.price ?? 0))}</strong>
                    </span>
                  </div>
                );
              })}
              {matches.length === 0 && <p className="text-sm text-muted-foreground">Nenhum bairro encontrado.</p>}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando regiões...
          </div>
        ) : (
          <div className="space-y-3">
            {sortedRegions.map((region: any, idx: number) => (
              <RegionSheetRow
                key={region.id}
                index={idx + 1}
                region={region}
                regions={sortedRegions}
                hoods={hoodsByRegion[region.id] ?? []}
                expanded={!!expanded[region.id]}
                onToggle={() => setExpanded((p) => ({ ...p, [region.id]: !p[region.id] }))}
                onSaveRegion={async (updates) => {
                  try {
                    await updateRegion.mutateAsync({ id: region.id, updates: updates as any });
                    toast.success("Região atualizada");
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
                onDeleteRegion={() => handleDeleteRegion(region.id, region.name)}
                onAddHood={async (name) => {
                  try {
                    await createHood.mutateAsync({
                      region_id: region.id,
                      name,
                      sort_order: (hoodsByRegion[region.id] ?? []).length + 1,
                    });
                    toast.success("Bairro adicionado");
                  } catch (e: any) {
                    toast.error(e.message?.includes("duplicate") ? "Esse bairro já existe nessa região" : e.message);
                  }
                }}
                onRenameHood={async (id, name) => {
                  try {
                    await updateHood.mutateAsync({ id, name });
                    toast.success("Bairro atualizado");
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
                onMoveHood={async (id, region_id) => {
                  try {
                    await updateHood.mutateAsync({ id, region_id });
                    toast.success("Bairro movido");
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
                onDeleteHood={async (id) => {
                  try {
                    await deleteHood.mutateAsync(id);
                    toast.success("Bairro removido");
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
              />
            ))}
            {sortedRegions.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-3 opacity-40" />
                Nenhuma região cadastrada.
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

interface RowProps {
  index: number;
  region: any;
  regions: any[];
  hoods: NeighborhoodRow[];
  expanded: boolean;
  onToggle: () => void;
  onSaveRegion: (updates: { name?: string; price?: number; is_active?: boolean; color?: string }) => Promise<void>;
  onDeleteRegion: () => void;
  onAddHood: (name: string) => Promise<void>;
  onRenameHood: (id: string, name: string) => Promise<void>;
  onMoveHood: (id: string, regionId: string) => Promise<void>;
  onDeleteHood: (id: string) => Promise<void>;
}

const PRESET_COLORS = [
  "#ef4444", // Vermelho
  "#f97316", // Laranja
  "#eab308", // Amarelo
  "#22c55e", // Verde
  "#06b6d4", // Ciano
  "#3b82f6", // Azul
  "#8b5cf6", // Roxo
  "#ec4899", // Rosa
  "#64748b", // Cinza/Slate
  "#10b981", // Esmeralda
];

function RegionSheetRow({
  index, region, regions, hoods, expanded, onToggle,
  onSaveRegion, onDeleteRegion, onAddHood, onRenameHood, onMoveHood, onDeleteHood,
}: RowProps) {
  const [name, setName] = useState(region.name as string);
  const [price, setPrice] = useState(String(Number(region.price ?? 0).toFixed(2)));
  const [color, setColor] = useState(region.color || "#eab308");
  const [newHood, setNewHood] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const dirty = name !== region.name || Number(price) !== Number(region.price) || color !== (region.color || "#eab308");

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* header row */}
      <div className="flex flex-wrap items-center gap-3 p-4">
        {/* Número da Região com a cor configurada */}
        <div
          className="h-9 w-9 shrink-0 rounded-xl grid place-items-center font-black text-sm text-white shadow-sm transition-colors"
          style={{ backgroundColor: color }}
        >
          {index}
        </div>

        {/* Seletor de Cor (Paleta Rápida + Input Color) */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/50">
          <label className="relative cursor-pointer flex items-center justify-center w-7 h-7 rounded-lg overflow-hidden border border-border hover:scale-105 transition-transform" title="Escolher cor personalizada">
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
              }}
              className="absolute -top-4 -left-4 w-16 h-16 cursor-pointer opacity-0"
            />
            <div className="w-full h-full rounded-md" style={{ backgroundColor: color }} />
          </label>

          <div className="hidden sm:flex items-center gap-1">
            {PRESET_COLORS.slice(0, 5).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c);
                }}
                className={`w-4 h-4 rounded-full border transition-all ${color.toLowerCase() === c.toLowerCase() ? "scale-125 border-foreground shadow-sm ring-1 ring-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
                style={{ backgroundColor: c }}
                title={`Cor ${c}`}
              />
            ))}
          </div>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-[160px] bg-transparent border-b border-transparent hover:border-border focus:border-primary text-sm font-bold text-foreground outline-none py-1"
          placeholder="Nome da região..."
        />

        <div className="flex items-center gap-1 rounded-xl bg-muted px-3 py-1.5">
          <span className="text-xs font-bold text-muted-foreground">R$</span>
          <input
            type="number"
            step="0.50"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-20 bg-transparent text-sm font-black text-primary outline-none"
          />
        </div>

        {dirty && (
          <button
            onClick={() => onSaveRegion({ name: name.trim(), price: Number(price), color })}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90"
          >
            <Check className="h-3.5 w-3.5" /> Salvar
          </button>
        )}

        <button
          onClick={() => onSaveRegion({ is_active: !region.is_active })}
          title={region.is_active ? "Desativar região" : "Ativar região"}
          className={`p-2 rounded-xl border text-xs font-bold ${
            region.is_active
              ? "border-border text-muted-foreground hover:text-foreground"
              : "border-destructive/40 text-destructive"
          }`}
        >
          {region.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>

        <button
          onClick={onDeleteRegion}
          className="p-2 rounded-xl border border-border text-muted-foreground hover:text-destructive"
          title="Excluir região"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-xs font-bold text-foreground"
        >
          {hoods.length} bairros
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3 bg-muted/30">
          <div className="grid sm:grid-cols-2 gap-2">
            {hoods.map((h) => (
              <div key={h.id} className="flex items-center gap-2 rounded-xl bg-card border border-border px-3 py-2">
                {editingId === h.id ? (
                  <>
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && editingName.trim()) {
                          await onRenameHood(h.id, editingName);
                          setEditingId(null);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 bg-transparent text-xs font-bold outline-none"
                    />
                    <button
                      onClick={async () => {
                        if (editingName.trim()) await onRenameHood(h.id, editingName);
                        setEditingId(null);
                      }}
                      className="text-primary"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-xs font-bold text-foreground truncate">{h.name}</span>
                    <button
                      onClick={() => { setEditingId(h.id); setEditingName(h.name); }}
                      className="text-muted-foreground hover:text-foreground"
                      title="Renomear"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <div className="relative" title="Mover para outra região">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <select
                        value={h.region_id}
                        onChange={(e) => e.target.value !== h.region_id && onMoveHood(h.id, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                      >
                        {regions.map((r: any) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => onDeleteHood(h.id)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Remover bairro"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
            {hoods.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">Nenhum bairro nesta região ainda.</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <input
              value={newHood}
              onChange={(e) => setNewHood(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newHood.trim()) {
                  await onAddHood(newHood);
                  setNewHood("");
                }
              }}
              placeholder="Adicionar bairro nesta região..."
              className="flex-1 px-3 py-2.5 rounded-xl bg-card border border-border text-xs font-semibold outline-none focus:border-primary"
            />
            <button
              onClick={async () => {
                if (!newHood.trim()) return;
                await onAddHood(newHood);
                setNewHood("");
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
