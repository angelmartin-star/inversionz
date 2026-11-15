/**
 * ============================================================================
 *  InversionZ — MOTOR DE VALORACIÓN POR TESTIGOS (funciones puras)
 * ============================================================================
 *  Método (por portal: Idealista, Fotocasa, pisos.com):
 *   1. €/m² de cada testigo = precio publicado / m².
 *   2. Media de €/m² del portal (los testigos que se desvían más de un 25 % se señalan).
 *   3. Ajuste por demanda del portal en la zona: alta +5 %, media 0 %, baja −5 % (editable).
 *   4. Corrección de publicación: −10 % (precio de oferta -> precio de cierre, editable).
 *   5. Valor del portal = €/m² ajustado × m² del inmueble.
 *  Resultado: MEDIA de los portales que tienen testigos. Horquilla = mínimo y máximo de los portales.
 * ============================================================================
 */
import type { PortalValuation, ValuationInput, ValuationResult, ValuationSettings } from "@/types/valuation";
import { PORTALS, PORTAL_LABEL } from "@/types/valuation";

export const DEFAULT_VALUATION_SETTINGS: ValuationSettings = {
  listingDiscount: 0.10,
  demandAdjustment: { ALTA: 0.05, MEDIA: 0, BAJA: -0.05 },
};

const OUTLIER_THRESHOLD = 0.25;
export const MIN_COMPARABLES_PER_PORTAL = 3;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function runValuation(input: ValuationInput): ValuationResult {
  const { subject, comparables, demand, settings } = input;
  const warnings: string[] = [];
  if (!(subject.areaM2 > 0)) throw new Error("Indica la superficie del inmueble a valorar");

  const byPortal: PortalValuation[] = PORTALS.map((portal) => {
    const valid = comparables.filter((c) => c.portal === portal && c.askingPrice > 0 && c.areaM2 > 0);
    const level = demand[portal] ?? "MEDIA";
    const demandAdjustment = settings.demandAdjustment[level] ?? 0;
    if (!valid.length) {
      return { portal, count: 0, meanAskingPriceM2: null, minPriceM2: null, maxPriceM2: null, demand: level,
        demandAdjustment, adjustedPriceM2: null, value: null, outliers: [] };
    }
    const pm2 = valid.map((c) => c.askingPrice / c.areaM2);
    const m = mean(pm2);
    const outliers = valid.filter((_, i) => Math.abs(pm2[i] / m - 1) > OUTLIER_THRESHOLD).map((c) => c.id);
    const adjusted = m * (1 + demandAdjustment) * (1 - settings.listingDiscount);
    if (valid.length < MIN_COMPARABLES_PER_PORTAL)
      warnings.push(`${PORTAL_LABEL[portal]}: solo ${valid.length} testigo${valid.length === 1 ? "" : "s"}. Recomendamos al menos ${MIN_COMPARABLES_PER_PORTAL}.`);
    if (outliers.length)
      warnings.push(`${PORTAL_LABEL[portal]}: ${outliers.length} testigo${outliers.length === 1 ? " se desvía" : "s se desvían"} más de un 25 % de la media del portal. Revisa si son comparables.`);
    return {
      portal, count: valid.length, meanAskingPriceM2: m, minPriceM2: Math.min(...pm2), maxPriceM2: Math.max(...pm2),
      demand: level, demandAdjustment, adjustedPriceM2: adjusted, value: adjusted * subject.areaM2, outliers,
    };
  });

  const used = byPortal.filter((p) => p.adjustedPriceM2 !== null);
  if (used.length && used.length < PORTALS.length)
    warnings.push(`La media se calcula con ${used.length} de 3 portales: faltan testigos de ${byPortal.filter((p) => p.count === 0).map((p) => PORTAL_LABEL[p.portal]).join(" y ")}.`);
  if (!used.length) return { byPortal, portalsUsed: 0, averagePriceM2: null, estimatedValue: null, range: null, warnings };

  const averagePriceM2 = mean(used.map((p) => p.adjustedPriceM2!));
  const values = used.map((p) => p.value!);
  return {
    byPortal, portalsUsed: used.length, averagePriceM2,
    estimatedValue: averagePriceM2 * subject.areaM2,
    range: { low: Math.min(...values), high: Math.max(...values) },
    warnings,
  };
}
