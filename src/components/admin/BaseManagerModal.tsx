import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompanies } from "@/services/companies";
import { useDrivers } from "@/services/drivers";
import { Button } from "@/components/ui/button";
import { CheckCircle2, UserPlus, Store, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface BaseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cityId: string;
  cityName: string;
}

export function BaseManagerModal({ isOpen, onClose, cityId, cityName }: BaseManagerModalProps) {
  const qc = useQueryClient();
  const { data: companies = [], isLoading: isLoadingCompanies } = useCompanies();
  const { data: drivers = [], isLoading: isLoadingDrivers } = useDrivers();
  const [isUpdating, setIsUpdating] = useState(false);

  // Filter linked vs available
  const linkedCompanies = companies.filter(c => c.city_id === cityId);
  const availableCompanies = companies.filter(c => c.city_id !== cityId);

  const linkedDrivers = drivers.filter(d => d.city_id === cityId);
  const availableDrivers = drivers.filter(d => d.city_id !== cityId);

  const handleUpdateCompany = async (companyId: string, newCityId: string | null) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase.from("companies").update({ city_id: newCityId }).eq("id", companyId);
      if (error) throw error;
      toast.success(newCityId ? "Empresa vinculada à base" : "Empresa removida da base");
      qc.invalidateQueries({ queryKey: ["companies"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateDriver = async (driverId: string, newCityId: string | null) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase.from("delivery_drivers").update({ city_id: newCityId } as any).eq("id", driverId);
      if (error) throw error;
      toast.success(newCityId ? "Entregador vinculado à base" : "Entregador removido da base");
      qc.invalidateQueries({ queryKey: ["drivers"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Gerenciar Base: <span className="text-primary">{cityName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 mt-4">
          <Tabs defaultValue="empresas" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="empresas" className="font-bold">
                <Store className="w-4 h-4 mr-2" />
                Empresas ({linkedCompanies.length})
              </TabsTrigger>
              <TabsTrigger value="entregadores" className="font-bold">
                <UserPlus className="w-4 h-4 mr-2" />
                Entregadores ({linkedDrivers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="empresas" className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-foreground">Empresas Vinculadas</h3>
                {linkedCompanies.length === 0 ? (
                  <p className="text-sm text-muted-foreground bg-muted/20 p-4 rounded-xl text-center border border-dashed">
                    Nenhuma empresa vinculada a esta base.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {linkedCompanies.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 border rounded-xl bg-card">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {c.name.substring(0, 1).toUpperCase()}
                          </div>
                          <span className="font-medium text-sm">{c.name}</span>
                        </div>
                        <Button 
                          variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleUpdateCompany(c.id, null)} disabled={isUpdating}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg text-foreground">Adicionar Empresas à Base</h3>
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                  {availableCompanies.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-xl bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground font-bold">
                          {c.name.substring(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{c.name}</p>
                          {c.city_id && <p className="text-xs text-muted-foreground">Já em outra base</p>}
                        </div>
                      </div>
                      <Button 
                        size="sm" variant="secondary" 
                        onClick={() => handleUpdateCompany(c.id, cityId)} disabled={isUpdating}
                      >
                        <UserPlus className="w-4 h-4 mr-1" /> Vincular
                      </Button>
                    </div>
                  ))}
                  {availableCompanies.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center p-4">Não há outras empresas disponíveis.</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="entregadores" className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-foreground">Entregadores Vinculados</h3>
                {linkedDrivers.length === 0 ? (
                  <p className="text-sm text-muted-foreground bg-muted/20 p-4 rounded-xl text-center border border-dashed">
                    Nenhum entregador vinculado a esta base.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {linkedDrivers.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-3 border rounded-xl bg-card">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {d.full_name.substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{d.full_name}</p>
                            <p className="text-xs text-muted-foreground">{d.phone || "Sem número"}</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleUpdateDriver(d.id, null)} disabled={isUpdating}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg text-foreground">Adicionar Entregadores à Base</h3>
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                  {availableDrivers.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 border rounded-xl bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">
                          {d.full_name.substring(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{d.full_name}</p>
                          {d.city_id && <p className="text-xs text-muted-foreground">Já em outra base</p>}
                        </div>
                      </div>
                      <Button 
                        size="sm" variant="secondary" 
                        onClick={() => handleUpdateDriver(d.id, cityId)} disabled={isUpdating}
                      >
                        <UserPlus className="w-4 h-4 mr-1" /> Vincular
                      </Button>
                    </div>
                  ))}
                  {availableDrivers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center p-4">Não há outros entregadores disponíveis.</p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
