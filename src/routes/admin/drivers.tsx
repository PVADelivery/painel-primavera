// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState } from "react";
import { BikeIcon } from "@/components/icons/BikeIcon";
import { useDrivers, useToggleDriverOnline } from "@/services/drivers";
import { Star, Phone, Loader2, MoreHorizontal, Plus, Camera, Power, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EditDriverDialog } from "@/components/admin/EditDriverDialog";
import { GenerateInviteDialog } from "@/components/admin/GenerateInviteDialog";

export const Route = createFileRoute("/admin/drivers")({
  component: DriversPage,
});

function DriversPage() {
  const { data: drivers, isLoading } = useDrivers();
  const toggleOnline = useToggleDriverOnline();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);

  const handleEdit = (driver: any) => {
    setSelectedDriver(driver);
    setEditOpen(true);
  };

  const handleDelete = async (driverId: string) => {
    if (!confirm("Tem certeza que deseja excluir este entregador?")) return;
    const { error } = await supabase.from("delivery_drivers").delete().eq("id", driverId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Entregador excluído");
      qc.invalidateQueries({ queryKey: ["drivers"] });
    }
  };

  const handleToggleOnline = async (driverId: string, isOnline: boolean) => {
    try {
      await toggleOnline.mutateAsync({ driverId, isOnline: !isOnline });
      toast.success(isOnline ? "Entregador ficou offline" : "Entregador ficou online");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const vehicleLabel: Record<string, string> = {
    motorcycle: "🏍️ Moto", bicycle: "🚲 Bicicleta", car: "🚗 Carro", van: "🚐 Van", truck: "🚛 Caminhão",
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 bg-card shadow-card p-6 rounded-2xl border border-border/50">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-foreground tracking-tight">Entregadores</h2>
          <p className="text-sm text-muted-foreground font-medium">Gerencie sua frota de entregadores</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <GenerateInviteDialog fixedRole="driver" triggerLabel="Convidar Entregador" />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all">
                <Plus className="h-5 w-5" /> Cadastrar Entregador
              </button>
            </DialogTrigger>
            <DialogContent 
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl"
            >
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">Cadastrar Entregador</DialogTitle>
              </DialogHeader>
              <CreateDriverForm onSuccess={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-2xl bg-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entregador</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Veículo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Placa</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Telefone</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Comissão</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rating</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Online</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : (drivers ?? []).length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Nenhum entregador encontrado</td></tr>
              ) : (
                (drivers ?? []).map((d) => (
                  <tr key={d.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                          {d.avatar_url ? <img src={d.avatar_url} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary">{(d.full_name || "?")[0]}</span>}
                        </div>
                        <span className="font-medium">{d.full_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{vehicleLabel[d.vehicle_type || "motorcycle"] || d.vehicle_type}</td>
                    <td className="px-4 py-3 font-mono text-xs">{d.vehicle_plate || "—"}</td>
                    <td className="px-4 py-3">{d.phone || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-primary">R$ {Number(d.commission_rate ?? 0.40).toFixed(2).replace('.', ',')}</td>
                    <td className="px-4 py-3">⭐ {Number(d.rating || 0).toFixed(1)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${d.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {d.status === "active" ? "Ativo" : d.status === "suspended" ? "Suspenso" : d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${d.is_online ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        <span className={`w-2 h-2 rounded-full ${d.is_online ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                        {d.is_online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(d)}>
                            <Edit2 className="h-4 w-4 mr-2" />Editar Informações
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleOnline(d.id, !!d.is_online)}>
                            <Power className="h-4 w-4 mr-2" />{d.is_online ? "Colocar Offline" : "Colocar Online"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(d.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedDriver && (
        <EditDriverDialog
          driver={selectedDriver}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {/* ── BONASOFT Watermark ── */}
      <div className="mt-16 pb-8 text-center opacity-40 select-none pointer-events-none">
        <p className="text-[11px] font-black uppercase tracking-[0.6em] text-muted-foreground ml-2">BONASOFT</p>
      </div>
    </AdminLayout>
  );
}

function CreateDriverForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: "", email: "", password: "", phone: "", document: "",
    vehicle: "motorcycle", licensePlate: "", commissionRate: "15",
  });

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const canNext = () => {
    if (step === 0) return form.fullName && form.email && form.password;
    if (step === 1) return form.phone && form.document;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("create-admin", {
        body: {
          email: form.email, password: form.password, fullName: form.fullName,
          phone: form.phone, document: form.document, role: "driver",
          vehicle: form.vehicle, licensePlate: form.licensePlate,
          commissionRate: parseFloat(form.commissionRate) || 15,
        },
      });
      if (res.error) throw new Error(res.error.message);
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);

      if (avatarFile && data?.userId) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${data.userId}/avatar.${ext}`;
        await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", data.userId);
      }

      toast.success("Entregador cadastrado com sucesso!");
      qc.invalidateQueries({ queryKey: ["drivers"] });
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Erro");
    }
    setLoading(false);
  };

  const steps = ["Dados de Acesso", "Dados Pessoais", "Veículo e Comissão"];

  return (
    <div className="space-y-5 mt-2">
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
            <span className={`text-xs truncate ${i <= step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < step ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border group-hover:border-primary transition-colors">
                {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover" /> : <Camera className="h-6 w-6 text-muted-foreground" />}
              </div>
              <input type="file"  accept="image/*" onChange={handleAvatar} className="hidden" />
            </label>
          </div>
          <FieldInput label="Nome completo *" value={form.fullName} onChange={(v) => set("fullName", v)} placeholder="João da Silva" />
          <FieldInput label="Email *" type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="joao@email.com" />
          <FieldInput label="Senha *" type="password" value={form.password} onChange={(v) => set("password", v)} placeholder="Mínimo 8 caracteres" />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <FieldInput label="Telefone *" value={form.phone} onChange={(v) => set("phone", v)} placeholder="(65) 99999-0000" />
          <FieldInput label="CPF *" value={form.document} onChange={(v) => set("document", v)} placeholder="000.000.000-00" />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block text-foreground">Tipo de veículo</label>
            <div className="flex gap-2">
              {[{ value: "motorcycle", label: "Moto" }, { value: "bicycle", label: "Bicicleta" }, { value: "car", label: "Carro" }].map((v) => (
                <button key={v.value} type="button" onClick={() => set("vehicle", v.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${form.vehicle === v.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <FieldInput label="Placa" value={form.licensePlate} onChange={(v) => set("licensePlate", v)} placeholder="ABC-1234" />
          <FieldInput label="Comissão (%)" type="number" value={form.commissionRate} onChange={(v) => set("commissionRate", v)} placeholder="15" />
        </div>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Voltar</button>
        )}
        {step < 2 ? (
          <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">Próximo</button>
        ) : (
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Cadastrar Entregador
          </button>
        )}
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-1.5 block text-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition-colors" />
    </div>
  );
}