// @ts-nocheck
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { reportErrorToTelegram } from "@/services/logger";
import { useQueryClient } from "@tanstack/react-query";

interface EditDriverDialogProps {
  driver: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SERVICE_OPTIONS = [
  { value: "delivery_moto", label: "Entregas (Moto)" },
  { value: "delivery_car", label: "Entregas (Carro)" },
  { value: "delivery_carro_aberto", label: "Frete (Carro Aberto)" },
  { value: "taxi", label: "Táxi (Passageiros)" },
  { value: "mototaxi", label: "Moto Táxi (Passageiros)" },
];

export function EditDriverDialog({ driver, open, onOpenChange }: EditDriverDialogProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    document: "",
    vehicleType: "motorcycle",
    vehiclePlate: "",
    commission: "10.00",
    serviceTypes: [] as string[],
  });

  useEffect(() => {
    if (driver && open) {
      let currentServices: string[] = [];
      if (Array.isArray(driver.service_types)) {
        currentServices = driver.service_types;
      }

      setForm({
        fullName: driver.full_name || "",
        phone: driver.phone || "",
        document: driver.document || "",
        vehicleType: driver.vehicle_type || driver.vehicle || "moto",
        vehiclePlate: driver.vehicle_plate || driver.license_plate || "",
        commission: (driver.commission_rate ?? driver.commission ?? 15).toString(),
        serviceTypes: currentServices,
      });

      // Busca dados complementares em todas as tabelas possíveis caso algum campo esteja vazio
      const fetchExtra = async () => {
        const uid = driver.user_id || driver.id;
        if (!uid) return;
        try {
          const [profRes, drvRes, custRes] = await Promise.all([
            supabase.from("profiles").select("*").or(`id.eq.${uid},user_id.eq.${uid}`).maybeSingle(),
            supabase.from("delivery_drivers").select("*").or(`id.eq.${uid},user_id.eq.${uid}`).maybeSingle(),
            supabase.from("customers").select("*").or(`user_id.eq.${uid},id.eq.${uid}`).maybeSingle(),
          ]);

          const prof = profRes.data as any;
          const drv = drvRes.data as any;
          const cust = custRes.data as any;

          const finalPhone = driver.phone || drv?.phone || drv?.whatsapp || prof?.phone || prof?.whatsapp || prof?.celular || cust?.phone || "";
          const finalDoc = driver.document || drv?.cpf || drv?.document || prof?.document || prof?.cpf || prof?.cnpj || cust?.cpf || cust?.document || "";
          const finalPlate = driver.vehicle_plate || driver.license_plate || drv?.license_plate || drv?.vehicle_plate || drv?.plate || prof?.license_plate || prof?.vehicle_plate || prof?.plate || "";
          const finalVehicle = driver.vehicle_type || driver.vehicle || drv?.vehicle || drv?.vehicle_type || prof?.vehicle || "moto";
          const finalName = driver.full_name || drv?.full_name || prof?.full_name || cust?.name || "";

          setForm(prev => ({
            ...prev,
            fullName: prev.fullName || finalName,
            phone: prev.phone || finalPhone,
            document: prev.document || finalDoc,
            vehiclePlate: prev.vehiclePlate || finalPlate,
            vehicleType: prev.vehicleType || finalVehicle,
          }));
        } catch (e) {
          console.warn("[EditDriverDialog] fetchExtra aviso:", e);
        }
      };

      fetchExtra();
    }
  }, [driver, open]);

  const set = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));

  const toggleService = (val: string) => {
    setForm(p => ({
      ...p,
      serviceTypes: p.serviceTypes.includes(val) 
        ? p.serviceTypes.filter((t: string) => t !== val)
        : [...p.serviceTypes, val]
    }));
  };

  const handleSubmit = async () => {
    if (!form.fullName || !form.fullName.trim()) {
      toast.error("O nome do entregador é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const targetUserId = driver.user_id || driver.id;

      // 1. Atualiza Profiles
      await supabase
        .from("profiles")
        .update({
          full_name: form.fullName,
          phone: form.phone,
          document: form.document,
          cpf: form.document,
        })
        .or(`id.eq.${targetUserId},user_id.eq.${targetUserId}`);

      // 2. Localiza ou cria registro na tabela delivery_drivers
      const { data: existingDrivers } = await supabase
        .from("delivery_drivers")
        .select("id")
        .or(`id.eq.${driver.id},user_id.eq.${targetUserId}`);

      const targetDriverRow = existingDrivers?.[0];

      if (targetDriverRow) {
        const { error: dError } = await supabase
          .from("delivery_drivers")
          .update({
            full_name: form.fullName,
            phone: form.phone,
            cpf: form.document,
            vehicle: form.vehicleType,
            license_plate: form.vehiclePlate ? form.vehiclePlate.toUpperCase() : null,
            commission_rate: parseFloat(form.commission) || 0,
            service_types: form.serviceTypes,
          })
          .eq("id", targetDriverRow.id);

        if (dError) throw dError;
      } else {
        const { error: dInsertError } = await supabase
          .from("delivery_drivers")
          .insert({
            user_id: targetUserId,
            full_name: form.fullName,
            phone: form.phone,
            cpf: form.document,
            vehicle: form.vehicleType,
            license_plate: form.vehiclePlate ? form.vehiclePlate.toUpperCase() : null,
            commission_rate: parseFloat(form.commission) || 0,
            service_types: form.serviceTypes,
            is_active: true,
          });

        if (dInsertError) throw dInsertError;
      }

      toast.success("Dados do entregador atualizados com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      onOpenChange(false);
    } catch (err: any) {
      reportErrorToTelegram({
        error_message: `[Admin EditDriverDialog] ${err.message || "Erro ao atualizar entregador"}`,
        stack_trace: err.stack || "",
        url: typeof window !== "undefined" ? window.location.href : "",
      }, "Painel Administrador");
      toast.error(err.message || "Erro ao atualizar entregador");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Entregador: {driver?.full_name}</DialogTitle>
          <DialogDescription>Atualize os serviços autorizados, placa e comissão do profissional.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>Nome completo</Label>
              <Input value={form.fullName} onChange={e => set("fullName", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
              </div>
              <div>
                <Label>Documento (CPF/CNPJ)</Label>
                <Input value={form.document} onChange={e => set("document", e.target.value)} />
              </div>
            </div>
            
            <div className="pt-2 border-t">
              <Label className="text-base font-bold mb-3 block">Serviços Autorizados</Label>
              <div className="grid grid-cols-2 gap-3">
                {SERVICE_OPTIONS.map(opt => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`srv-${opt.value}`} 
                      checked={form.serviceTypes.includes(opt.value)}
                      onCheckedChange={() => toggleService(opt.value)}
                    />
                    <label 
                      htmlFor={`srv-${opt.value}`} 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t mt-2">
              <div>
                <Label>Veículo Principal</Label>
                <Select value={form.vehicleType} onValueChange={v => set("vehicleType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorcycle">🏍️ Moto</SelectItem>
                    <SelectItem value="bicycle">🚲 Bicicleta</SelectItem>
                    <SelectItem value="car">🚗 Carro</SelectItem>
                    <SelectItem value="van">🚐 Van</SelectItem>
                    <SelectItem value="truck">🚛 Caminhão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Placa Principal</Label>
                <Input value={form.vehiclePlate} onChange={e => set("vehiclePlate", e.target.value.toUpperCase())} />
              </div>
            </div>
            <div>
              <Label>Comissão por Corrida (R$)</Label>
              <CurrencyInput value={form.commission} onChangeValue={v => set("commission", v)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}