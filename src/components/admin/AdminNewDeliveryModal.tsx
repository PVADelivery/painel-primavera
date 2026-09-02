import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/services/companies";
import { useDrivers } from "@/services/drivers";
import { useRegions } from "@/services/regions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveRegionDeliveryFee } from "@/lib/pricingResolver";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Package, MapPin, Store, User, Phone, CreditCard, DollarSign,
  Loader2, Sparkles, Shirt, FileText
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AdminNewDeliveryModal({ open, onOpenChange, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const { data: companies } = useCompanies();
  const { data: drivers } = useDrivers();
  const { data: regions } = useRegions();

  const [loading, setLoading] = useState(false);

  const [deliveryType, setDeliveryType] = useState<"NORMAL" | "BUSCA_CONDICIONAL">("NORMAL");
  const [condicionalDestination, setCondicionalDestination] = useState<"STORE" | "CUSTOM">("STORE");
  const [condicionalCustomAddress, setCondicionalCustomAddress] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [complement, setComplement] = useState("");
  const [regionId, setRegionId] = useState("");
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cartao");
  const [orderValue, setOrderValue] = useState("");
  const [changeFor, setChangeFor] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [driverId, setDriverId] = useState("");
  const [notes, setNotes] = useState("");

  const selectedCompany = (companies ?? []).find((c) => c.id === companyId);

  // Carrega regras de preço personalizadas da empresa selecionada
  useEffect(() => {
    let isMounted = true;
    async function loadCompanyPricing() {
      if (!companyId) {
        setPricingRules([]);
        return;
      }
      try {
        let loadedRules: any[] = [];
        // 1. Tentar via RPC get_company_pricing_rules
        const { data: rpcRules, error: rpcErr } = await supabase.rpc("get_company_pricing_rules", {
          p_company_id: companyId,
        });
        if (!rpcErr && rpcRules && rpcRules.length > 0) {
          loadedRules = rpcRules;
        } else if (selectedCompany?.pricing_table_id) {
          // 2. Fallback direto para pricing_rules caso RPC não retorne
          const { data: rulesData } = await supabase
            .from("pricing_rules")
            .select("*")
            .eq("pricing_table_id", selectedCompany.pricing_table_id);
          if (rulesData) {
            loadedRules = rulesData;
          }
        }
        if (isMounted) {
          setPricingRules(loadedRules);
        }
      } catch (err) {
        console.warn("[AdminNewDeliveryModal] Erro ao carregar regras da empresa:", err);
      }
    }
    loadCompanyPricing();
    return () => {
      isMounted = false;
    };
  }, [companyId, selectedCompany?.pricing_table_id]);

  // Atualiza taxa de entrega sempre que a região, empresa ou regras mudarem
  useEffect(() => {
    if (regionId && regions) {
      const r = regions.find((reg) => reg.id === regionId);
      if (r) {
        const calculatedFee = resolveRegionDeliveryFee({
          region: r,
          vehicleType: "moto",
          companySettings: selectedCompany,
          pricingRules,
        });
        setDeliveryFee(Number(calculatedFee).toFixed(2));
      }
    }
  }, [regionId, pricingRules, selectedCompany, regions]);

  const handleRegionChange = (rId: string) => {
    setRegionId(rId);
    if (!rId) return;
    const r = (regions ?? []).find((reg) => reg.id === rId);
    if (r) {
      const calculatedFee = resolveRegionDeliveryFee({
        region: r,
        vehicleType: "moto",
        companySettings: selectedCompany,
        pricingRules,
      });
      setDeliveryFee(Number(calculatedFee).toFixed(2));
      if (r.name && !neighborhood) {
        setNeighborhood(r.name);
      }
    }
  };

  const resetForm = () => {
    setDeliveryType("NORMAL");
    setCompanyId("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerCpf("");
    setAddress("");
    setAddressNumber("");
    setNeighborhood("");
    setComplement("");
    setRegionId("");
    setPricingRules([]);
    setPaymentMethod("cartao");
    setOrderValue("");
    setChangeFor("");
    setDeliveryFee("");
    setDriverId("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyId) {
      toast.error("Por favor, selecione a Empresa/Loja solicitante.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Por favor, informe o nome do cliente.");
      return;
    }
    if (!address.trim()) {
      toast.error("Por favor, informe o endereço de entrega.");
      return;
    }

    setLoading(true);

    try {
      const shortId = `ADM-${Math.floor(1000 + Math.random() * 9000)}`;
      const fullAddr = addressNumber
        ? `${address.trim()}, ${addressNumber.trim()}${neighborhood ? ` - ${neighborhood.trim()}` : ""}`
        : `${address.trim()}${neighborhood ? ` - ${neighborhood.trim()}` : ""}`;

      const numFee = Number(deliveryFee.replace(",", ".")) || 10.0;
      const numOrderVal = Number(orderValue.replace(",", ".")) || 0;
      const numChangeFor = Number(changeFor.replace(",", ".")) || 0;

      const pickupAddr = (deliveryType === "BUSCA_CONDICIONAL" && condicionalDestination === "CUSTOM")
        ? (condicionalCustomAddress.trim() || selectedCompany?.address || selectedCompany?.name || "Endereço Solicitado")
        : (selectedCompany?.address || selectedCompany?.name || "Loja");

      const payload = {
        delivery_type: deliveryType,
        company_id: companyId,
        company_name: selectedCompany?.name || "Loja Parceira",
        pickup_address: pickupAddr,
        short_id: shortId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_cpf: customerCpf.replace(/\D/g, "") || null,
        address: fullAddr,
        customer_address_number: addressNumber.trim() || "S/N",
        customer_neighborhood: neighborhood.trim() || null,
        customer_address_complement: complement.trim() || null,
        payment_method: paymentMethod,
        order_value: paymentMethod === "pago" ? 0 : numOrderVal,
        change_for: paymentMethod === "pago" ? 0 : numChangeFor,
        vehicle_type: "moto",
        region_id: regionId || null,
        value: numFee,
        delivery_fee: numFee,
        notes: notes.trim() || null,
        status: driverId ? "accepted" : "pending",
        driver_id: driverId || null,
      };

      // 1. Try create_delivery_with_credits RPC
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("create_delivery_with_credits", {
        p_payload: payload,
      });

      let createdDeliveryId: string | null = null;

      if (!rpcErr && (rpcRes as any)?.success) {
        createdDeliveryId = (rpcRes as any).delivery_id;
      } else {
        // Fallback: Direct insert in deliveries
        const { data: insData, error: insErr } = await supabase
          .from("deliveries")
          .insert({
            company_id: companyId,
            company_name: selectedCompany?.name || "Loja Parceira",
            pickup_address: pickupAddr,
            short_id: shortId,
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim() || null,
            customer_cpf: customerCpf.replace(/\D/g, "") || null,
            address: fullAddr,
            customer_address_number: addressNumber.trim() || "S/N",
            customer_neighborhood: neighborhood.trim() || null,
            customer_address_complement: complement.trim() || null,
            payment_method: paymentMethod,
            order_value: paymentMethod === "pago" ? 0 : numOrderVal,
            change_for: paymentMethod === "pago" ? 0 : numChangeFor,
            vehicle_type: "moto",
            region_id: regionId || null,
            value: numFee,
            delivery_fee: numFee,
            notes: notes.trim() || null,
            status: driverId ? "accepted" : "pending",
            driver_id: driverId || null,
            delivery_type: deliveryType,
          } as any)
          .select("id")
          .single();

        if (insErr) throw insErr;
        createdDeliveryId = insData.id;
      }

      // If specific driver was selected, ensure driver_id is attached
      if (createdDeliveryId && driverId) {
        await supabase
          .from("deliveries")
          .update({ driver_id: driverId, status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", createdDeliveryId);
      }

      toast.success(`Entrega Avulsa #${shortId} criada com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-counts"] });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("[AdminNewDeliveryModal] Erro ao criar entrega:", err);
      toast.error(`Erro ao criar entrega: ${err?.message || "Ocorreu uma falha no servidor."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-xl font-extrabold text-foreground">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Package className="h-6 w-6" />
            </div>
            Nova Entrega Avulsa (Admin)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Preencha os dados da solicitação para criar uma nova entrega diretamente pelo Painel Administrador.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-3">
          {/* 1. Seleção da Empresa */}
          <div className="space-y-1.5 bg-muted/30 p-4 rounded-2xl border border-border/60">
            <Label className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" /> Empresa / Loja Solicitante *
            </Label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              required
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm font-semibold text-foreground outline-none focus:border-primary transition-all"
            >
              <option value="">-- Selecione a Loja --</option>
              {(companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.address ? `(${c.address})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Tipo de Solicitação */}
          <div className="space-y-3 bg-secondary/30 p-4 rounded-2xl border border-border/60">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Tipo de Solicitação
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeliveryType("NORMAL")}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all border ${
                  deliveryType === "NORMAL"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                <span>Entrega Normal</span>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryType("BUSCA_CONDICIONAL")}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all border ${
                  deliveryType === "BUSCA_CONDICIONAL"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-purple-500/40"
                }`}
              >
                <span>Busca de Condicional</span>
              </button>
            </div>

            {deliveryType === "BUSCA_CONDICIONAL" ? (
              <div className="mt-3 pt-3 border-t border-border/40 space-y-3">
                <Label className="text-xs font-semibold text-foreground">
                  Destino das Peças Recolhidas:
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    condicionalDestination !== "CUSTOM"
                      ? "bg-purple-500/15 border-purple-500/50 text-purple-700 dark:text-purple-300"
                      : "bg-background border-border text-muted-foreground"
                  }`}>
                    <input
                      type="radio"
                      name="admin_condicional_dest"
                      checked={condicionalDestination !== "CUSTOM"}
                      onChange={() => setCondicionalDestination("STORE")}
                      className="accent-purple-600"
                    />
                    <span>Trazer na Loja ({selectedCompany?.name || "Loja"})</span>
                  </label>

                  <label className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    condicionalDestination === "CUSTOM"
                      ? "bg-purple-500/15 border-purple-500/50 text-purple-700 dark:text-purple-300"
                      : "bg-background border-border text-muted-foreground"
                  }`}>
                    <input
                      type="radio"
                      name="admin_condicional_dest"
                      checked={condicionalDestination === "CUSTOM"}
                      onChange={() => setCondicionalDestination("CUSTOM")}
                      className="accent-purple-600"
                    />
                    <span>Entregar em Outro Cliente / Endereço</span>
                  </label>
                </div>

                {condicionalDestination === "CUSTOM" ? (
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-medium text-foreground">
                      Endereço de Destino (Novo Cliente / Local):
                    </Label>
                    <Input
                      value={condicionalCustomAddress}
                      onChange={(e) => setCondicionalCustomAddress(e.target.value)}
                      placeholder="Informe a rua, número, bairro ou nome do novo cliente..."
                      className="rounded-xl h-10 bg-background text-xs"
                      required
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    O entregador buscará as peças no cliente informado e entregará no endereço da loja selecionada.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground mt-1 font-medium">
                Origem: {selectedCompany?.name || "Loja"} → Destino: Cliente
              </div>
            )}
          </div>

          {/* 3. Dados do Cliente */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="h-4 w-4 text-primary" /> Dados do Cliente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Cliente *</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  required
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(66) 99999-9999"
                  className="rounded-xl h-10"
                />
              </div>
            </div>
          </div>

          {/* 4. Endereço */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" /> Endereço do Cliente
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Rua / Endereço *</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Av. Cuiabá"
                  required
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Número</Label>
                <Input
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  placeholder="123 ou S/N"
                  className="rounded-xl h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Ex: Centro"
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Região (Taxa de Entrega)</Label>
                <select
                  value={regionId}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-semibold outline-none"
                >
                  <option value="">-- Selecionar Região --</option>
                  {(regions ?? []).map((r) => {
                    const price = resolveRegionDeliveryFee({
                      region: r,
                      vehicleType: "moto",
                      companySettings: selectedCompany,
                      pricingRules,
                    });
                    return (
                      <option key={r.id} value={r.id}>
                        {r.name} {price ? `(R$ ${Number(price).toFixed(2)})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Complemento / Ponto de Referência</Label>
              <Input
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                placeholder="Ex: Ap 201, perto da farmácia"
                className="rounded-xl h-10"
              />
            </div>
          </div>

          {/* 5. Pagamento e Valores */}
          <div className="space-y-3 bg-muted/30 p-4 rounded-2xl border border-border/60">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-primary" /> Pagamento e Valores
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Forma de Pagamento</Label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-semibold outline-none"
                >
                  <option value="cartao">Cartão na Entrega</option>
                  <option value="dinheiro">Dinheiro na Entrega</option>
                  <option value="pix">PIX na Entrega</option>
                  <option value="pago">Já Pago (Cobrar da Loja)</option>
                  <option value="convenio">Convênio</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Taxa de Entrega (R$)</Label>
                <Input
                  type="number"
                  step="0.50"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  placeholder="10.00"
                  className="rounded-xl h-10 font-bold"
                />
              </div>
            </div>

            {paymentMethod !== "pago" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Valor do Pedido / Produto (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={orderValue}
                    onChange={(e) => setOrderValue(e.target.value)}
                    placeholder="0.00"
                    className="rounded-xl h-10 font-semibold"
                  />
                </div>
                {paymentMethod === "dinheiro" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Troco para quanto? (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={changeFor}
                      onChange={(e) => setChangeFor(e.target.value)}
                      placeholder="Ex: 50.00"
                      className="rounded-xl h-10 font-semibold"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 6. Entregador e Observações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Direcionar para Entregador (Opcional)</Label>
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-semibold outline-none"
              >
                <option value="">-- Na Fila (Broadcast para todos) --</option>
                {(drivers ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name || "—"} {d.is_online ? "● Online" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações do Lojista/Admin</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instruções para o motoboy..."
                className="rounded-xl h-10"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-11 flex-1 font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl h-11 flex-1 font-black bg-primary text-primary-foreground shadow-md hover:scale-[1.01] transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Solicitando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" /> Criar Entrega Avulsa
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
