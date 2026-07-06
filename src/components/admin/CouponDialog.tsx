import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AdminCoupon,
  CouponInput,
  useCompanyOptions,
  useCreateCoupon,
  useUpdateCoupon,
} from "@/services/coupons";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  coupon?: AdminCoupon | null;
}

const emptyInput: CouponInput = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: 10,
  min_order_value: null,
  max_discount_value: null,
  expires_at: null,
  usage_limit: null,
  active: true,
  company_ids: [],
};

function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function CouponDialog({ open, onOpenChange, coupon }: Props) {
  const [form, setForm] = useState<CouponInput>(emptyInput);
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [companySearch, setCompanySearch] = useState("");
  const { data: companies = [] } = useCompanyOptions();
  const createMut = useCreateCoupon();
  const updateMut = useUpdateCoupon();

  useEffect(() => {
    if (!open) return;
    if (coupon) {
      setForm({
        code: coupon.code,
        description: coupon.description ?? "",
        discount_type: coupon.discount_type,
        discount_value: Number(coupon.discount_value),
        min_order_value: coupon.min_order_value,
        max_discount_value: coupon.max_discount_value,
        expires_at: coupon.expires_at,
        usage_limit: coupon.usage_limit,
        active: coupon.active,
        company_ids: coupon.company_ids,
      });
      setScope(coupon.company_ids.length > 0 ? "selected" : "all");
    } else {
      setForm(emptyInput);
      setScope("all");
    }
    setCompanySearch("");
  }, [open, coupon]);

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase()),
  );

  const toggleCompany = (id: string) => {
    setForm((f) => ({
      ...f,
      company_ids: f.company_ids.includes(id)
        ? f.company_ids.filter((c) => c !== id)
        : [...f.company_ids, id],
    }));
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast.error("Informe o código do cupom");
      return;
    }
    if (!form.discount_value || form.discount_value <= 0) {
      toast.error("Valor do desconto inválido");
      return;
    }
    const payload: CouponInput = {
      ...form,
      company_ids: scope === "all" ? [] : form.company_ids,
    };
    if (scope === "selected" && payload.company_ids.length === 0) {
      toast.error("Selecione pelo menos uma loja ou escolha 'Todas as lojas'");
      return;
    }
    try {
      if (coupon) {
        await updateMut.mutateAsync({ id: coupon.id, input: payload });
        toast.success("Cupom atualizado");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Cupom criado");
      }
      onOpenChange(false);
    } catch (err: any) {
      if (err?.message?.includes("coupons_code_key") || err?.message?.includes("duplicate key")) {
        toast.error("Este código de cupom já existe!");
      } else {
        toast.error(err?.message ?? "Erro ao salvar");
      }
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{coupon ? "Editar Cupom" : "Novo Cupom Global"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-2 md:col-span-1">
            <Label>Código *</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="EX: BEMVINDO10"
            />
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>Status</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <span className="text-sm text-muted-foreground">
                {form.active ? "Ativo" : "Inativo"}
              </span>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Descrição</Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalhes que o cliente verá"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de desconto</Label>
            <Select
              value={form.discount_type}
              onValueChange={(v) =>
                setForm({ ...form, discount_type: v as "percentage" | "fixed" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor do desconto *</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.discount_value}
              onChange={(e) =>
                setForm({ ...form, discount_value: Number(e.target.value) })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Pedido mínimo (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.min_order_value ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  min_order_value: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Desconto máximo (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.max_discount_value ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  max_discount_value:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              disabled={form.discount_type !== "percentage"}
            />
          </div>

          <div className="space-y-2">
            <Label>Validade</Label>
            <Input
              type="date"
              value={toDateInput(form.expires_at)}
              onChange={(e) =>
                setForm({
                  ...form,
                  expires_at: e.target.value
                    ? new Date(e.target.value + "T23:59:59").toISOString()
                    : null,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Limite total de usos</Label>
            <Input
              type="number"
              min={0}
              value={form.usage_limit ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  usage_limit: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>

          <div className="space-y-3 md:col-span-2 border-t pt-4">
            <Label className="text-base">Lojas participantes</Label>
            <RadioGroup
              value={scope}
              onValueChange={(v) => setScope(v as "all" | "selected")}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="scope-all" value="all" />
                <Label htmlFor="scope-all" className="font-normal cursor-pointer">
                  Todas as lojas (cupom global)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="scope-sel" value="selected" />
                <Label htmlFor="scope-sel" className="font-normal cursor-pointer">
                  Lojas selecionadas
                </Label>
              </div>
            </RadioGroup>

            {scope === "selected" && (
              <div className="space-y-2">
                <Input
                  placeholder="Buscar loja..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                />
                <ScrollArea className="h-56 rounded-md border p-2">
                  <div className="space-y-1">
                    {filteredCompanies.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={form.company_ids.includes(c.id)}
                          onCheckedChange={() => toggleCompany(c.id)}
                        />
                        <span className="text-sm">{c.name}</span>
                      </label>
                    ))}
                    {filteredCompanies.length === 0 && (
                      <p className="text-sm text-muted-foreground px-2 py-4 text-center">
                        Nenhuma loja encontrada
                      </p>
                    )}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  {form.company_ids.length} loja(s) selecionada(s)
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
