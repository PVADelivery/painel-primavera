import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useRegions, updateRegionPrice } from "@/services/regions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MapPin, DollarSign, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/regions")({
  component: RegionsPage,
});

function RegionsPage() {
  const { data = [], isLoading } = useRegions();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const handleEdit = (id: string, currentPrice: number) => {
    setEditingId(id);
    setEditValue(currentPrice.toString());
  };

  const handleSave = async (id: string) => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) {
      toast.error("Valor inválido");
      return;
    }
    try {
      await updateRegionPrice(id, val);
      toast.success("Valor atualizado com sucesso!");
      qc.invalidateQueries({ queryKey: ["regions"] });
      setEditingId(null);
    } catch {
      toast.error("Erro ao atualizar valor");
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Regiões e Tarifas</h1>
        <p className="text-sm text-muted-foreground">Áreas de cobertura e valores pagos aos entregadores</p>
      </div>
      <Card className="p-5 shadow-card mb-4">
        <div className="flex h-72 items-center justify-center rounded-lg bg-gradient-to-br from-muted to-secondary text-muted-foreground">
          <div className="text-center">
            <MapPin className="mx-auto h-10 w-10" />
            <p className="mt-2 text-sm">Mapa interativo (em breve)</p>
          </div>
        </div>
      </Card>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : data.length === 0 ? (
        <Card className="p-12 text-center shadow-card">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma região cadastrada</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.map((r) => (
            <Card key={r.id} className="p-5 shadow-card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">MT</p>
                </div>
                <Badge variant={r.is_active ? "default" : "outline"}>{r.is_active ? "Ativa" : "Inativa"}</Badge>
              </div>
              <div className="flex items-center justify-between border-t pt-3 mt-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
                  <DollarSign className="h-4 w-4" />
                  Valor Base:
                </div>
                {editingId === r.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-sm">R$</span>
                    <input
                      type="number"
                      step="0.10"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={() => handleSave(r.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      R$ {Number(r.price || 0).toFixed(2)}
                    </span>
                    <Button variant="link" size="sm" className="h-6 px-2 text-xs" onClick={() => handleEdit(r.id, Number(r.price || 0))}>
                      Editar
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
