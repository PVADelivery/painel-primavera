export function getDeliveryValue(d: any): number {
  if (!d) return 0;
  const isCar = ["carro", "car", "carro_aberto", "frete"].includes(String(d.vehicle_type || "").toLowerCase());

  // 1. Se possuir região vinculada (regions.price) e o valor for atípico (> R$ 80.00) ou 0
  if (d.regions && d.regions.price !== null && d.regions.price !== undefined && Number(d.regions.price) > 0) {
    const val = Number(d.delivery_fee ?? d.value ?? 0);
    if (val <= 0 || val > 80) {
      if (isCar) {
        return Number(d.regions.delivery_fee && Number(d.regions.delivery_fee) > 0 ? d.regions.delivery_fee : Number(d.regions.price) * 1.5);
      }
      return Number(d.regions.price);
    }
  }

  // 2. Se delivery_fee for uma taxa válida (<= R$ 80.00), usa ela
  if (d.delivery_fee !== null && d.delivery_fee !== undefined && Number(d.delivery_fee) > 0 && Number(d.delivery_fee) <= 80) {
    return Number(d.delivery_fee);
  }

  // 3. Se value for uma taxa válida (<= R$ 80.00), usa value
  const val = Number(d.value ?? 0);
  if (val > 0 && val <= 80) {
    return val;
  }

  // 4. Se regiões tiver preço cadastrado
  if (d.regions && Number(d.regions.price) > 0) {
    if (isCar) {
      return Number(d.regions.delivery_fee && Number(d.regions.delivery_fee) > 0 ? d.regions.delivery_fee : Number(d.regions.price) * 1.5);
    }
    return Number(d.regions.price);
  }

  // 5. Fallback final
  return Number(d.delivery_fee || d.value || 0);
}

export function formatDeliveryValue(d: any): string {
  const v = getDeliveryValue(d);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
