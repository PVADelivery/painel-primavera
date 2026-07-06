export function getDeliveryValue(d: any): number {
  return Number(d?.value ?? 0);
}

export function formatDeliveryValue(d: any): string {
  const v = getDeliveryValue(d);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
