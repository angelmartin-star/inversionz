import assert from "node:assert/strict";
import { runInvestmentAnalysis } from "../src/lib/engine/calculationEngine";
import { EXAMPLE_INPUT } from "../src/lib/defaults";
import type { InvestmentInput } from "../src/types/investment";

const near = (a: number, b: number, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);
const base: InvestmentInput = JSON.parse(JSON.stringify(EXAMPLE_INPUT));

// Residente: sin bloque nonResident
const es = runInvestmentAnalysis(base);
assert.equal(es.nonResident, undefined);

// Reino Unido: 24 % sobre el íntegro + crédito al 40 % sobre el neto
const gb = runInvestmentAnalysis({ ...base, investor: { residenceCountry: "GB" } });
const y = gb.irpfYear1;
near(gb.nonResident!.year1.irnrRental, 0.24 * y.grossIncome);
near(gb.nonResident!.year1.homeTax, Math.max(0, 0.40 * Math.max(y.netIncome, 0) - 0.24 * y.grossIncome));
near(y.taxDue, gb.nonResident!.year1.total);
assert.equal(gb.nonResident!.rentalBaseSpain, "INTEGRO");
// Venta: 19 % y retención del 3 %
const g = Math.max(gb.sale.capitalGain.gain, 0);
near(gb.nonResident!.sale.irnr, 0.19 * g);
near(gb.nonResident!.sale.withholding, 0.03 * base.sale.estimatedSalePrice);
near(gb.nonResident!.sale.homeTax, Math.max(0, 0.24 * g - 0.19 * g));
assert.ok(gb.taxPayments.some((p) => p.form.startsWith("Modelo 211")));
assert.ok(!gb.taxPayments.some((p) => p.concept.startsWith("IRPF")));

// Francia: 19 % sobre el neto, exención en Francia; renta imputada por meses vacíos (2 %)
const fr = runInvestmentAnalysis({ ...base, investor: { residenceCountry: "FR" } });
near(fr.nonResident!.year1.irnrRental, 0.19 * Math.max(fr.irpfYear1.netIncome, 0));
near(fr.nonResident!.year1.irnrImputed, base.property.cadastralValueTotal * 0.02 * (base.rental.vacancyRate ?? 0) * 0.19);
assert.equal(fr.nonResident!.year1.homeTax, 0);
assert.equal(fr.nonResident!.sale.homeTax, 0);
assert.equal(fr.irpfYear1.reductionRate, 0);

// Italia: IVIE 1,06 % del valor catastral menos el IBI; venta tras 5 años sin impuesto italiano
const it = runInvestmentAnalysis({ ...base, investor: { residenceCountry: "IT", cadastralRevisedRecently: true }, sale: { ...base.sale, yearsUntilSale: 10 } });
near(it.nonResident!.year1.homeWealthTax, Math.max(0, base.property.cadastralValueTotal * 0.0106 - base.rental.annualExpenses.ibi));
assert.equal(it.nonResident!.sale.homeTax, 0);
assert.equal(it.nonResident!.imputedPct, 0.011);

// Exenciones de vivienda habitual no aplican a no residentes
const gb65 = runInvestmentAnalysis({ ...base, investor: { residenceCountry: "GB" }, sale: { ...base.sale, sellerHabitualResidence: true, sellerAged65Plus: true } });
assert.equal(gb65.sale.capitalGain.exemption, "NINGUNA");

console.log("✅ No residentes: tests OK");
