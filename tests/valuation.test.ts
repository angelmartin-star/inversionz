import assert from "node:assert/strict";
import { runValuation, DEFAULT_VALUATION_SETTINGS } from "../src/lib/valuation/valuationEngine";
import type { Comparable } from "../src/types/valuation";

const near = (a: number, b: number, tol = 0.01, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
let n = 0;
const c = (portal: Comparable["portal"], price: number, m2: number): Comparable => ({ id: `t${n++}`, portal, askingPrice: price, areaM2: m2 });

const comparables = [
  c("IDEALISTA", 300_000, 75), c("IDEALISTA", 280_000, 70), c("IDEALISTA", 320_000, 80),      // 4.000 €/m²
  c("FOTOCASA", 270_000, 75), c("FOTOCASA", 252_000, 70), c("FOTOCASA", 288_000, 80),          // 3.600 €/m²
  c("PISOSCOM", 285_000, 75), c("PISOSCOM", 266_000, 70), c("PISOSCOM", 304_000, 80),          // 3.800 €/m²
];
const r = runValuation({
  subject: { postalCode: "28045", areaM2: 70 }, comparables,
  demand: { IDEALISTA: "ALTA", FOTOCASA: "MEDIA", PISOSCOM: "BAJA" }, settings: DEFAULT_VALUATION_SETTINGS,
});
near(r.byPortal[0].meanAskingPriceM2!, 4000, 0.01, "media idealista");
near(r.byPortal[0].adjustedPriceM2!, 4000 * 1.05 * 0.9, 0.01, "idealista ajustado");
near(r.byPortal[1].adjustedPriceM2!, 3600 * 1.00 * 0.9, 0.01, "fotocasa ajustado");
near(r.byPortal[2].adjustedPriceM2!, 3800 * 0.95 * 0.9, 0.01, "pisos ajustado");
const avg = (4000 * 1.05 * 0.9 + 3600 * 0.9 + 3800 * 0.95 * 0.9) / 3;
near(r.averagePriceM2!, avg, 0.01, "media 3 portales");
near(r.estimatedValue!, avg * 70, 0.01, "valor");
assert.equal(r.portalsUsed, 3);
assert.equal(r.warnings.length, 0);

// Portal sin testigos y outlier
const r2 = runValuation({
  subject: { postalCode: "28045", areaM2: 70 },
  comparables: [c("IDEALISTA", 300_000, 75), c("IDEALISTA", 600_000, 75), c("FOTOCASA", 270_000, 75)],
  demand: { IDEALISTA: "MEDIA", FOTOCASA: "MEDIA", PISOSCOM: "MEDIA" }, settings: DEFAULT_VALUATION_SETTINGS,
});
assert.equal(r2.portalsUsed, 2);
assert.ok(r2.warnings.some((w) => w.includes("faltan testigos de pisos.com")));
assert.ok(r2.warnings.some((w) => w.includes("25 %")));
console.log("✅ Valoración: tests OK");

// --- Rentabilidad rápida ---
import { quickYield } from "../src/lib/engine/quickYield";
const q = quickYield({ purchasePrice: 200_000, monthlyRent: 1_000, ibi: 400, community: 1_200, wasteTax: 100, postalCode: "28045" })!;
near(q.grossYield, 0.06, 1e-9, "bruta");
near(q.netYield, (12_000 - 1_700) / 200_000, 1e-9, "neta");
near(q.transferTax!, 12_000, 0.01, "ITP Madrid");
near(q.netYieldWithTax!, 10_300 / 212_000, 1e-9, "neta con ITP");
assert.equal(quickYield({ purchasePrice: 0, monthlyRent: 1, ibi: 0, community: 0, wasteTax: 0 }), null);
console.log("✅ Rentabilidad rápida: tests OK");
