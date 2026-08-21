export function getDeliveryValue(d: any): number {
  if (!d) return 0;

  // 1. Se possuir delivery_fee válido, usa ele diretamente
  if (d.delivery_fee !== null && d.delivery_fee !== undefined && Number(d.delivery_fee) > 0) {
    return Number(d.delivery_fee);
  }

  // 2. Se possuir value válido, usa ele diretamente
  if (d.value !== null && d.value !== undefined && Number(d.value) > 0) {
    return Number(d.value);
  }

  // 3. Fallback: Se regiões tiver preço cadastrado
  if (d.regions && Number(d.regions.price) > 0) {
    const isCar = ["carro", "car", "carro_aberto", "frete"].includes(String(d.vehicle_type || "").toLowerCase());
    if (isCar) {
      return Number(d.regions.delivery_fee && Number(d.regions.delivery_fee) > 0 ? d.regions.delivery_fee : Number(d.regions.price) * 1.5);
    }
    return Number(d.regions.price);
  }

  return Number(d.delivery_fee || d.value || 0);
}

export function formatDeliveryValue(d: any): string {
  const v = getDeliveryValue(d);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
