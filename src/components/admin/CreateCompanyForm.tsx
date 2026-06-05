import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRegions } from "@/services/regions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function CreateCompanyForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const { data: regions } = useRegions();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    companyName: "", responsibleName: "", email: "", password: "",
    phone: "", document: "", address: "", regionId: "",
    latitude: "", longitude: "",
  });

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const canNext = () => {
    if (step === 0) return form.companyName && form.email && form.password;
    if (step === 1) return form.responsibleName && form.phone;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("create-admin", {
        body: {
          email: form.email, password: form.password, fullName: form.responsibleName,
          phone: form.phone, document: form.document, role: "company",
          companyName: form.companyName, address: form.address, regionId: form.regionId || null,
          latitude: form.latitude ? parseFloat(form.latitude) : null,
          longitude: form.longitude ? parseFloat(form.longitude) : null,
        },
      });
      if (res.error) throw new Error(res.error.message);
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);

      toast.success("Empresa cadastrada com sucesso!");
      qc.invalidateQueries({ queryKey: ["companies"] });
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar empresa");
    }
    setLoading(false);
  };

  const steps = ["Dados de Acesso", "Responsável", "Endereço e Região"];

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
          <FieldInput label="Nome da empresa *" value={form.companyName} onChange={(v) => set("companyName", v)} placeholder="Lanchonete do João" />
          <FieldInput label="Email de acesso *" type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="empresa@email.com" />
          <FieldInput label="Senha *" type="password" value={form.password} onChange={(v) => set("password", v)} placeholder="Mínimo 8 caracteres" />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <FieldInput label="Nome do responsável *" value={form.responsibleName} onChange={(v) => set("responsibleName", v)} placeholder="João da Silva" />
          <FieldInput label="Telefone *" value={form.phone} onChange={(v) => set("phone", v)} placeholder="(65) 99999-0000" />
          <FieldInput label="CNPJ ou CPF" value={form.document} onChange={(v) => set("document", v)} placeholder="00.000.000/0001-00" />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <FieldInput label="Endereço completo" value={form.address} onChange={(v) => set("address", v)} placeholder="Rua X, 123 - Bairro" />
          <div>
            <label className="text-sm font-medium mb-1.5 block text-foreground">Região padrão</label>
            <select value={form.regionId} onChange={(e) => set("regionId", e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition-colors">
              <option value="">Sem região</option>
              {(regions ?? []).map((r: any) => (
                <option key={r.id} value={r.id}>{r.name} — R$ {Number(r.price).toFixed(2)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldInput label="Latitude" value={form.latitude} onChange={(v) => set("latitude", v)} placeholder="-15.5989" />
            <FieldInput label="Longitude" value={form.longitude} onChange={(v) => set("longitude", v)} placeholder="-56.0974" />
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Voltar</button>
        )}
        {step < 2 ? (
          <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">Próximo</button>
        ) : (
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Cadastrar Empresa
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
