// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState } from "react";
import { BikeIcon } from "@/components/icons/BikeIcon";
import { useDrivers, useToggleDriverOnline } from "@/services/drivers";
import { Star, Phone, Loader2, MoreHorizontal, Plus, Camera, Power, Trash2, Edit2, Search, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/drivers")({
  component: DriversPage,
});

function DriversPage() {
  const { data: drivers, isLoading } = useDrivers();
  const toggleOnline = useToggleDriverOnline();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDrivers = (drivers ?? []).filter((d) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const qDigits = q.replace(/\D/g, "");
      const matchName = (d.full_name || "").toLowerCase().includes(q);
      const matchPlate = (d.vehicle_plate || d.license_plate || "").toLowerCase().includes(q);
      
      const phoneDigits = (d.phone || "").replace(/\D/g, "");
      const matchPhone = (d.phone || "").toLowerCase().includes(q) || (qDigits.length > 0 && phoneDigits.includes(qDigits));
      
      const docDigits = (d.document || d.cpf || "").replace(/\D/g, "");
      const matchDoc = (d.document || d.cpf || "").toLowerCase().includes(q) || (qDigits.length > 0 && docDigits.includes(qDigits));

      if (!matchName && !matchPhone && !matchPlate && !matchDoc) return false;
    }

    if (activeTab === "all") return true;
    const services = Array.isArray(d.service_types) ? d.service_types : [];
    
    if (activeTab === "encomendas") {
      return (
        services.includes("delivery_moto") || 
        d.vehicle_type === "moto" || 
        d.vehicle_type === "motorcycle" || 
        !d.vehicle_type || 
        services.length === 0
      );
    }
    if (activeTab === "carro") {
      return (
        services.includes("delivery_car") || 
        services.includes("delivery_carro_aberto") || 
        d.vehicle_type === "carro" || 
        d.vehicle_type === "car" || 
        d.vehicle_type === "carro_aberto" || 
        d.vehicle_type === "van" || 
        d.vehicle_type === "truck"
      );
    }
    if (activeTab === "taxi") {
      return services.includes("taxi") || d.vehicle_type === "taxi";
    }
    if (activeTab === "mototaxi") {
      return services.includes("mototaxi") || d.vehicle_type === "mototaxi" || d.vehicle_type === "moto_taxi";
    }
    return true;
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);

  const handleEdit = (driver: any) => {
    setSelectedDriver(driver);
    setEditOpen(true);
  };

  const handleDelete = async (driver: any) => {
    const driverId = driver.id;
    const userId = driver.user_id;
    if (!confirm(`Tem certeza que deseja excluir o entregador "${driver.full_name || 'selecionado'}"?`)) return;

    try {
      // 1. Tentar deletar da tabela delivery_drivers por id e user_id
      let delError: any = null;
      if (driverId) {
        const { error } = await supabase.from("delivery_drivers").delete().eq("id", driverId);
        delError = error;
      }
      if (delError && userId) {
        const { error: err2 } = await supabase.from("delivery_drivers").delete().eq("user_id", userId);
        delError = err2;
      }
      
      // Se falhou por Foreign Key constraint (ex: vinculado a entregas/corridas), marcar como desativado / inativo
      if (delError) {
        console.warn("[handleDelete] Falha ao deletar diretamente, tentando desativar:", delError.message);
        if (driverId) {
          await supabase.from("delivery_drivers").update({ is_online: false, status: "inactive" } as any).eq("id", driverId);
        }
        if (userId) {
          await supabase.from("delivery_drivers").update({ is_online: false, status: "inactive" } as any).eq("user_id", userId);
        }
      }

      // 2. Limpar a role de motorista da tabela profiles ou user_roles para desvincular do painel
      if (userId) {
        await supabase.from("profiles").update({ role: "customer" }).eq("user_id", userId);
        await supabase.from("profiles").update({ role: "customer" }).eq("id", userId);
      }

      toast.success("Entregador excluído com sucesso");
      qc.invalidateQueries({ queryKey: ["drivers"] });
    } catch (err: any) {
      console.error("[handleDelete] Erro ao excluir entregador:", err);
      toast.error(err.message || "Erro ao excluir entregador");
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
    motorcycle: "Moto",
    moto: "Moto",
    bicycle: "Bicicleta",
    car: "Carro",
    carro: "Carro",
    carro_aberto: "Frete (Carro)",
    van: "Van",
    truck: "Caminhão",
    taxi: "Táxi",
    mototaxi: "Moto Táxi",
  };

  return (
    <AdminLayout>
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-6 bg-card shadow-card p-5 rounded-2xl border border-border/50">
        <div className="space-y-1 min-w-0">
          <h2 className="text-xl font-black text-foreground tracking-tight">Entregadores e Motoristas</h2>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">Gerencie sua frota de entregadores de lojas, fretes e motoristas de táxi/moto-táxi</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto shrink-0">
          <GenerateInviteDialog fixedRole="driver" triggerLabel="Convidar Entregador / Motorista" />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <button className="whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all shrink-0">
                <Plus className="h-4 w-4" /> Cadastrar Entregador / Motorista
              </button>
            </DialogTrigger>
            <DialogContent 
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl"
            >
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">Cadastrar Entregador / Motorista</DialogTitle>
              </DialogHeader>
              <CreateDriverForm onSuccess={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {[
            { id: "all", label: "Todos" },
            { id: "encomendas", label: "Moto (Encomendas)" },
            { id: "carro", label: "Carro (Encomendas)" },
            { id: "taxi", label: "Táxi" },
            { id: "mototaxi", label: "Moto Táxi" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "bg-card text-muted-foreground hover:bg-muted border border-border/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px] sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, placa, fone..."
            className="pl-9 pr-8 h-9 rounded-xl bg-card border-border shadow-sm text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-card shadow-card border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Entregador</th>
                <th className="px-2.5 py-2.5 text-left font-semibold text-muted-foreground">Veículo</th>
                <th className="px-2.5 py-2.5 text-left font-semibold text-muted-foreground">Placa</th>
                <th className="px-2.5 py-2.5 text-left font-semibold text-muted-foreground">Telefone</th>
                <th className="px-2.5 py-2.5 text-left font-semibold text-muted-foreground">Comissão (%)</th>
                <th className="px-2.5 py-2.5 text-left font-semibold text-muted-foreground">Avaliação</th>
                <th className="px-2.5 py-2.5 text-left font-semibold text-muted-foreground">Status</th>
                <th className="px-2.5 py-2.5 text-left font-semibold text-muted-foreground">Online</th>
                <th className="px-2.5 py-2.5 text-right font-semibold text-muted-foreground w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filteredDrivers.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Nenhum entregador encontrado</td></tr>
              ) : (
                filteredDrivers.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 max-w-[180px] sm:max-w-[220px]">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                          {d.avatar_url ? <img src={d.avatar_url} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary">{(d.full_name || "?")[0]}</span>}
                        </div>
                        <span className="font-semibold text-foreground truncate" title={d.full_name}>{d.full_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap text-muted-foreground">{vehicleLabel[d.vehicle_type || "motorcycle"] || d.vehicle_type}</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap font-mono text-xs text-muted-foreground">{d.vehicle_plate || "—"}</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{d.phone || "—"}</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap font-bold text-primary">
                      {d.commission_rate !== null && d.commission_rate !== undefined && Number(d.commission_rate) > 0
                        ? `${Number(d.commission_rate > 1 ? d.commission_rate : d.commission_rate * 100).toFixed(0)}%`
                        : "25%"}
                    </td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap text-xs">⭐ {Number(d.rating || 0).toFixed(1)}</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.status === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                        {d.status === "active" ? "Ativo" : d.status === "suspended" ? "Suspenso" : d.status}
                      </span>
                    </td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.is_online ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${d.is_online ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
                        {d.is_online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-2.5 py-2.5 text-right whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(d)}>
                            <Edit2 className="h-4 w-4 mr-2" />Editar Informações
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleOnline(d.id, !!d.is_online)}>
                            <Power className="h-4 w-4 mr-2" />{d.is_online ? "Colocar Offline" : "Colocar Online"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(d)}>
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
      <div className="mt-12 pb-6 text-center opacity-40 select-none pointer-events-none">
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
    vehicle: "motorcycle", licensePlate: "", commissionRate: "25",
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
          commissionRate: parseFloat(form.commissionRate) || 25,
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
              <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
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
            <div className="grid grid-cols-2 gap-4 mt-3">
              <FieldInput label="Placa" value={form.licensePlate} onChange={(v) => set("licensePlate", v.toUpperCase())} placeholder="ABC1234" />
              <FieldInput label="Comissão do Sistema (%)" type="number" value={form.commissionRate} onChange={(v) => set("commissionRate", v)} placeholder="25" />
            </div>
          </div>
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