import assert from 'node:assert/strict';
import { runInvestmentAnalysis, computeItp, applyProgressiveScale, generalQuota, buildMortgageSchedule, computeIRR } from '../src/lib/engine/calculationEngine';
import { IRPF_SAVINGS } from '../src/lib/tax/taxTables';
import { getProvinceFromPostalCode, PROVINCES } from '../src/lib/tax/provinces';
import type { InvestmentInput } from '../src/types/investment';

const near = (a: number, b: number, tol = 0.5, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);

// --- ITP por CCAA (casos publicados) ---
near(computeItp(800_000, 'CAT'), 82_000, 0.01, 'CAT 800k');
near(computeItp(1_200_000, 'CAT'), 129_000, 0.01, 'CAT 1,2M');
near(computeItp(200_000, 'MAD'), 12_000, 0.01, 'MAD');
near(computeItp(1_200_000, 'VAL'), 132_000, 0.01, 'VAL >1M tipo total');
near(computeItp(400_000, 'AST'), 36_000, 0.01, 'AST tipo total 9%');
near(computeItp(200_000, 'CEU'), 6_000, 0.01, 'Ceuta bonif 50%');
// --- Escalas ---
near(applyProgressiveScale(400_000, IRPF_SAVINGS), 6000*0.19+44000*0.21+150000*0.23+100000*0.27+100000*0.30, 0.01, 'ahorro');
// Madrid 60.000 € base: cuota íntegra antes de mínimos = 8423,50+527,25 + 8200,43 (guiafiscal)
near(generalQuota(60_000, 'MAD'), 8_950.75 + 8_200.43, 1, 'IRPF Madrid 60k');
// --- Hipoteca ---
const m = buildMortgageSchedule(200_000, 0.03, 30);
near(m.monthlyPayment, 843.21, 0.01, 'cuota francés');
near(m.years[29].endingBalance, 0, 0.01, 'amortizada');
// --- Provincias ---
assert.equal(PROVINCES.length, 52);
assert.equal(getProvinceFromPostalCode('28850')!.ccaa, 'MAD');
assert.equal(getProvinceFromPostalCode('48001')!.transferTaxAuthority, 'Diputación Foral de Bizkaia (Hacienda Foral)');
assert.equal(getProvinceFromPostalCode('51001')!.ccaa, 'CEU');
assert.equal(getProvinceFromPostalCode('99999'), undefined);
// --- TIR ---
near(computeIRR([-100, 110])!, 0.10, 1e-6, 'TIR');

// --- Caso completo: piso en Madrid capital ---
const input: InvestmentInput = {
  property: { postalCode: '28045', municipality: 'Madrid', surfaceM2: 70, condition: 'A_REFORMAR',
    purchasePrice: 250_000, cadastralValueTotal: 120_000, cadastralValueLand: 60_000 },
  acquisition: { renovationCost: 25_000, furnitureCost: 6_000, notaryFees: 900, registryFees: 600, agencyFees: 500 },
  financing: { enabled: true, loanToValue: 0.8, termYears: 30, annualInterestRate: 0.0275 },
  rental: { monthlyRent: 1_300, rentalType: 'VIVIENDA_HABITUAL', vacancyRate: 0.04,
    annualExpenses: { ibi: 450, community: 1_200, homeInsurance: 250, defaultInsurance: 500, maintenance: 600 },
    reductionFlags: { stressedArea: false }, investorGeneralTaxBase: 45_000 },
  sale: { yearsUntilSale: 10, estimatedSalePrice: 340_000 },
};
const r = runInvestmentAnalysis(input);
near(r.acquisitionTaxes.total, 15_000, 0.01, 'ITP Madrid');
near(r.kpis.totalInvestment, 250_000 + 15_000 + 2_000 + 25_000 + 6_000, 0.01, 'inversión');
assert.equal(r.irpfYear1.reductionRate, 0.5);
assert.ok(r.sale.municipalCapitalGain.rate === 0.29);
console.log(JSON.stringify({ kpis: r.kpis, irpfYear1: r.irpfYear1, sale: r.sale, taxPayments: r.taxPayments, warnings: r.warnings }, null, 2));
console.log('\n✅ Todos los tests OK');
