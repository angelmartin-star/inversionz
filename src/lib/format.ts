/** Formateo es-ES. Importes sin decimales salvo que se pida. */
const eur0 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" });
const eur2 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" });
const num0 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" });

export const eur = (n: number, decimals = false) => (decimals ? eur2 : eur0).format(Number.isFinite(n) ? n : 0).replace("-", "−");
export const num = (n: number) => num0.format(n);
export const pct = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? "—"
    : new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
export const signedEur = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + eur(Math.abs(n));

/**
 * Convierte texto introducido por el usuario a número, aceptando formato español.
 *  "250.000" -> 250000 · "2,75" -> 2.75 · "1.250,5" -> 1250.5 · "2.75" -> 2.75
 */
export function parseNumberEs(raw: string): number | null {
  const s = raw.trim().replace(/\s|€|%/g, "");
  if (s === "") return null;
  let normalized: string;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, "");
  else normalized = s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export const formatInputNumber = (n: number | undefined | null, maxDecimals = 2) =>
  n === undefined || n === null || !Number.isFinite(n)
    ? ""
    : new Intl.NumberFormat("es-ES", { maximumFractionDigits: maxDecimals, useGrouping: "always" }).format(n);

/** "Calle de Alcalá 120, esc. 2, 3º B" */
export function formatAddress(a?: { street: string; number: string; staircase?: string; floor?: string; door?: string }): string {
  if (!a || !a.street) return "";
  const parts = [`${a.street.trim()} ${a.number?.trim() ?? ""}`.trim()];
  if (a.staircase?.trim()) parts.push(`esc. ${a.staircase.trim()}`);
  const floor = a.floor?.trim();
  const door = a.door?.trim();
  if (floor || door) parts.push([floor ? (/^\d+$/.test(floor) ? `${floor}º` : floor) : "", door ?? ""].filter(Boolean).join(" "));
  return parts.join(", ");
}

/** "Madrid, Madrid" -> "Madrid" */
export const placeLabel = (municipality: string | undefined, province: string) =>
  municipality && municipality.trim().toLowerCase() !== province.toLowerCase() ? `${municipality.trim()}, ${province}` : province;
