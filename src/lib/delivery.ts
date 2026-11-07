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

/**
 * Extrai apenas o nome limpo do logradouro (rua, avenida), removendo números e bairros residuais.
 */
export function cleanStreetName(raw?: string | null): string {
  if (!raw) return "";
  let s = String(raw).trim();
  if (s.includes(" - ")) {
    s = s.split(/\s+-\s+/)[0].trim();
  }
  s = s.replace(/(?:,\s*(?:\d+[A-Za-z]?|S\/N|\d+))\s*$/i, "").trim();
  s = s.replace(/(?:,\s*(?:\d+[A-Za-z]?|S\/N|\d+))\s*$/i, "").trim();
  return s.replace(/[\s,-]+$/, "").trim();
}

/**
 * Monta o endereço de entrega completo de forma canônica e sem repetições.
 */
export function formatCleanDeliveryAddress(
  rawStreet?: string | null,
  rawNum?: string | null,
  rawNeigh?: string | null,
  rawComp?: string | null
): string {
  let street = cleanStreetName(rawStreet);
  let num = (rawNum || "").trim();
  let neigh = (rawNeigh || "").trim();
  let comp = (rawComp || "").trim();

  if (!street && rawStreet) street = String(rawStreet).trim();

  let res = street;
  if (num && num !== "S/N") {
    res += `, ${num}`;
  } else if (num === "S/N") {
    res += ", S/N";
  }

  if (neigh) {
    res += ` - ${neigh}`;
  }

  if (comp) {
    res += ` (${comp})`;
  }

  return res;
}

/**
 * Sanitiza e deduplica endereços corrompidos com múltiplos loops ou repetições para exibição em tela.
 */
export function formatDisplayAddress(raw?: string | null): string {
  if (!raw) return "—";
  const s = String(raw).trim();
  if (!s) return "—";

  const firstDash = s.indexOf(" - ");
  if (firstDash === -1) {
    const numMatch = s.match(/,\s*(\d+[A-Za-z]?|S\/N)/i);
    const street = s.replace(/,\s*(?:\d+[A-Za-z]?|S\/N).*$/i, "").replace(/[\s,]+$/, "").trim();
    return street + (numMatch ? `, ${numMatch[1]}` : "");
  }

  const streetPart = s.slice(0, firstDash);
  const afterDash = s.slice(firstDash + 3);
  const streetName = streetPart.replace(/,\s*(?:\d+[A-Za-z]?|S\/N).*$/i, "").replace(/[\s,]+$/, "").trim();
  const numMatch = streetPart.match(/,\s*(\d+[A-Za-z]?|S\/N)/i);
  const num = numMatch ? numMatch[1] : "";
  const neigh = afterDash.split(/\s*,\s*(?:\d+|S\/N)\s*-\s*(?=[*A-Za-z])/i)[0].trim();

  return streetName + (num ? `, ${num}` : "") + (neigh ? ` - ${neigh}` : "");
}
