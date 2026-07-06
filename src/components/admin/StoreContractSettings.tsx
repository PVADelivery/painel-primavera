import { Edit2, ShieldAlert, Store, Loader2, ArrowRightCircle, HandCoins, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CompanyPricingMatrixDialog } from "./CompanyPricingMatrixDialog";

interface StoreContractSettingsProps {
  companies: any[];
  isLoading: boolean;
  onEditCompany: (company: any) => void;
}

export function StoreContractSettings({ companies, isLoading, onEditCompany }: StoreContractSettingsProps) {
  const [matrixCompany, setMatrixCompany] = useState<any>(null);

  const getDeliveryModeBadge = (mode: string) => {
    switch (mode) {
      case "store_pays":
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-500"><HandCoins className="h-3 w-3" /> Loja Paga (Subsidiado)</span>;
      case "fixed_fee":
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-500"><ShieldAlert className="h-3 w-3" /> Taxa Fixa Contrato</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">Cliente Paga (Padrão)</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
        <p>Carregando contratos...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card shadow-card overflow-hidden">
      <div className="p-6 border-b border-border bg-muted/20">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          Modelos de Contrato
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie como cada empresa será cobrada (Comissão sobre vendas e quem paga a entrega do motoboy).
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Empresa</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Comissão (%)</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Modelo de Entrega</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Taxa Fixa (R$)</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Configurar</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma empresa encontrada</td></tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                        {c.logo_url ? <img src={c.logo_url} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary">{c.name[0]}</span>}
                      </div>
                      <span className="font-medium text-foreground">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-primary text-base">{Number(c.commission_percentage ?? 10.00).toFixed(1)}%</span>
                  </td>
                  <td className="px-4 py-3">
                    {getDeliveryModeBadge(c.delivery_mode)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">
                    {c.delivery_mode === "fixed_fee" ? `R$ ${Number(c.delivery_fee || 0).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setMatrixCompany(c)}
                        className="rounded-xl border-primary/20 text-primary hover:bg-primary/10"
                      >
                        <Map className="h-4 w-4 mr-1.5" /> Matriz
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => onEditCompany(c)}
                        className="rounded-xl border-muted text-muted-foreground hover:bg-muted/50"
                      >
                        <Edit2 className="h-4 w-4 mr-1.5" /> Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {matrixCompany && (
        <CompanyPricingMatrixDialog 
          company={matrixCompany} 
          open={!!matrixCompany} 
          onOpenChange={(open) => !open && setMatrixCompany(null)} 
        />
      )}
    </div>
  );
}
