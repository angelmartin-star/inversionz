/**
 * ============================================================================
 *  InversionZ — MOTOR DE CÁLCULO FINANCIERO Y FISCAL (España, régimen común)
 * ============================================================================
 *  Funciones PURAS y deterministas (sin I/O): se ejecutan igual en servidor
 *  (API Route / generación de PDF) y en cliente (recalcular en vivo).
 *
 *  Punto de entrada: runInvestmentAnalysis(input)
 *
 *  Flujo:
 *   1. Provincia/CCAA (código postal)        -> resolveProvince
 *   2. Impuestos de compra (ITP | IVA+AJD)    -> computeAcquisitionTaxes
 *   3. Inversión total y capital propio       -> computeInvestment
 *   4. Hipoteca (sistema francés)             -> buildMortgageSchedule
 *   5. Proyección anual + IRPF del alquiler   -> projectYears / computeRentalIrpfYear
 *   6. Venta: plusvalía municipal + IRPF      -> computeMunicipalCapitalGain / computeCapitalGain
 *   7. KPIs (rentabilidades, cashflow, ROCE, TIR) y calendario de pagos a Hacienda
 *
 *  Simplificaciones conocidas (se avisan en `warnings`):
 *   - Cuota IRPF = cuota INCREMENTAL (cuota con alquiler − cuota sin alquiler)
 *     sobre base liquidable, sin mínimos personales ni deducciones autonómicas.
 *   - País Vasco y Navarra: se aplica régimen común como aproximación.
 *   - No se modela la imputación de rentas por periodos vacíos (art. 85 LIRPF).
 * ============================================================================
 */

import type {
  AcquisitionTaxResult, CCAACode, CapitalGainResult, InvestmentAnalysisResult,
  InvestmentInput, IrpfRentalYear, KPIs, MortgageSchedule, MunicipalCapitalGainResult,
  NonResidentResult, ProvinceInfo, RentalData, RentalReductionCase, TaxPayment, YearProjection,
} from '../../types/investment';
import {
  AJD_NEW_BUILD, AMORTIZATION, Bracket, IIVTNU_COEFFICIENTS, IIVTNU_MAX_RATE,
  IIVTNU_MUNICIPAL_RATES, IRPF_REGIONAL_GENERAL, IRPF_SAVINGS, IRPF_STATE_GENERAL,
  ITP_GENERAL, LIMITED_EXPENSES_CARRYFORWARD_YEARS, MODEL_DEFAULTS, NEW_BUILD_INDIRECT_TAX,
  RENTAL_REDUCTIONS, TAX_TABLES_VERSION,
} from '../tax/taxTables';
import { getProvinceByCode, getProvinceFromPostalCode } from '../tax/provinces';
import { IRNR, getCountry, type CountryProfile } from '../tax/nonResident';

// ============================================================================
// Utilidades
// ============================================================================

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Escala progresiva marginal: cada tramo tributa a su tipo. */
export function applyProgressiveScale(base: number, brackets: Bracket[]): number {
  if (base <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of brackets) {
    const upper = upTo ?? Infinity;
    if (base <= lower) break;
    tax += (Math.min(base, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

/** Tipo marginal aplicable a una base. */
export function marginalRate(base: number, brackets: Bracket[]): number {
  for (const { upTo, rate } of brackets) if (upTo === null || base <= upTo) return rate;
  return brackets[brackets.length - 1].rate;
}

export class ValidationError extends Error {}

// ============================================================================
// 1. Provincia / CCAA
// ============================================================================

export function resolveProvince(input: InvestmentInput): ProvinceInfo {
  const p = input.property.provinceCode
    ? getProvinceByCode(input.property.provinceCode)
    : getProvinceFromPostalCode(input.property.postalCode);
  if (!p) throw new ValidationError(`Código postal/provincia no válido: ${input.property.postalCode}`);
  return p;
}

// ============================================================================
// 2. Impuestos de adquisición
// ============================================================================

/** Cuota de ITP según la escala de la CCAA (marginal o por valor total). */
export function computeItp(base: number, ccaa: CCAACode): number {
  const scale = ITP_GENERAL[ccaa];
  let quota: number;
  if (scale.mode === 'TOTAL_VALUE') {
    quota = base * marginalRate(base, scale.brackets);
  } else {
    quota = applyProgressiveScale(base, scale.brackets);
  }
  return quota * (1 - (scale.bonificacionCuota ?? 0));
}

export function computeAcquisitionTaxes(
  input: InvestmentInput, province: ProvinceInfo, warnings: string[],
): AcquisitionTaxResult {
  const { purchasePrice, condition, cadastralReferenceValue, isProtectedHousing } = input.property;
  const ccaa = province.ccaa;

  // --- Segunda mano: ITP sobre max(precio, valor de referencia) -------------
  if (condition !== 'OBRA_NUEVA') {
    const taxBase = Math.max(purchasePrice, cadastralReferenceValue ?? 0);
    if (cadastralReferenceValue && cadastralReferenceValue > purchasePrice) {
      warnings.push(`La base del ITP es el valor de referencia de Catastro (${round2(cadastralReferenceValue)} €), superior al precio.`);
    }
    const scale = ITP_GENERAL[ccaa];
    if (!scale.verified) warnings.push(`ITP ${province.ccaaName}: tipo pendiente de verificación (${scale.notes ?? scale.source}).`);
    const itp = computeItp(taxBase, ccaa);
    return {
      regime: 'ITP', taxBase, transferTax: itp, vat: 0, stampDuty: 0, total: itp,
      effectiveRate: itp / purchasePrice,
      breakdown: `ITP ${province.ccaaName}: ${(itp / taxBase * 100).toFixed(2)} % efectivo sobre ${round2(taxBase)} €`,
    };
  }

  // --- Obra nueva: IVA/IGIC/IPSI + AJD -------------------------------------
  let regime: AcquisitionTaxResult['regime'] = 'IVA_AJD';
  let vatRate = isProtectedHousing ? NEW_BUILD_INDIRECT_TAX.IVA_VPO_REGIMEN_ESPECIAL : NEW_BUILD_INDIRECT_TAX.IVA_GENERAL_VIVIENDA;
  if (ccaa === 'CAN') {
    regime = 'IGIC_AJD';
    vatRate = NEW_BUILD_INDIRECT_TAX.IGIC_VIVIENDA_CANARIAS;
  } else if (ccaa === 'CEU' || ccaa === 'MEL') {
    regime = 'IPSI_AJD';
    if (NEW_BUILD_INDIRECT_TAX.IPSI_CEUTA_MELILLA === null) {
      warnings.push('Ceuta/Melilla: IPSI no modelado; se estima con IVA 10 % (cifra conservadora).');
    } else vatRate = NEW_BUILD_INDIRECT_TAX.IPSI_CEUTA_MELILLA;
  }
  const ajd = AJD_NEW_BUILD[ccaa];
  if (!ajd.verified) warnings.push(`AJD ${province.ccaaName}: tipo pendiente de verificación (${ajd.notes ?? ''}).`);
  const vat = purchasePrice * vatRate;
  const stampDuty = purchasePrice * ajd.rate;
  return {
    regime, taxBase: purchasePrice, transferTax: 0, vat, stampDuty, total: vat + stampDuty,
    effectiveRate: (vat + stampDuty) / purchasePrice,
    breakdown: `${regime.split('_')[0]} ${(vatRate * 100).toFixed(1)} % + AJD ${(ajd.rate * 100).toFixed(2)} %`,
  };
}

// ============================================================================
// 3. Inversión total
// ============================================================================

export function computeInvestment(input: InvestmentInput, acqTaxes: AcquisitionTaxResult) {
  const a = input.acquisition;
  const price = input.property.purchasePrice;
  const closingCosts = a.notaryFees + a.registryFees + a.agencyFees + (a.buyerAgencyCommission ?? 0);
  const fin = input.financing?.enabled ? input.financing : undefined;
  const loanAmount = fin ? price * fin.loanToValue : 0;
  const openingFee = fin?.openingFee ?? 0;

  const totalInvestment = price + acqTaxes.total + closingCosts + a.renovationCost + a.furnitureCost + openingFee;
  return {
    breakdown: {
      precioCompra: price,
      impuestosCompra: acqTaxes.total,
      gastosCierre: closingCosts,
      reforma: a.renovationCost,
      mobiliario: a.furnitureCost,
      comisionApertura: openingFee,
      inversionTotal: totalInvestment,
      prestamo: loanAmount,
      capitalPropio: totalInvestment - loanAmount,
    } as Record<string, number>,
    totalInvestment, loanAmount, equity: totalInvestment - loanAmount, closingCosts, openingFee,
  };
}

// ============================================================================
// 4. Hipoteca — sistema francés (cuota constante mensual)
// ============================================================================

export function buildMortgageSchedule(principal: number, annualRate: number, termYears: number): MortgageSchedule {
  const n = Math.round(termYears * 12);
  const r = annualRate / 12;
  const monthlyPayment = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  const years: MortgageSchedule['years'] = [];
  let balance = principal;
  for (let y = 1; y <= Math.ceil(termYears); y++) {
    let interest = 0, princ = 0, payment = 0;
    for (let m = 0; m < 12 && balance > 1e-6; m++) {
      const i = balance * r;
      const p = Math.min(monthlyPayment - i, balance);
      interest += i; princ += p; payment += i + p; balance -= p;
    }
    years.push({ year: y, payment, interest, principal: princ, endingBalance: Math.max(balance, 0) });
  }
  return { principal, monthlyPayment, years };
}

// ============================================================================
// 5. IRPF — Rendimientos del capital inmobiliario
// ============================================================================

/** Determina el % de reducción del art. 23.2 LIRPF. */
export function resolveRentalReduction(rental: RentalData): { case: RentalReductionCase; rate: number } {
  if (rental.rentalType !== 'VIVIENDA_HABITUAL') return { case: 'NINGUNA', rate: 0 };
  const chosen = rental.reduction ?? 'AUTO';
  if (chosen !== 'AUTO') return { case: chosen, rate: RENTAL_REDUCTIONS[chosen] };
  const f = rental.reductionFlags ?? {};
  // Jerarquía excluyente: 90 → 70 → 60 → 50 (contratos desde 26/05/2023)
  if (f.contractSignedBefore26May2023) return { case: 'CONTRATO_ANTERIOR_LEY_VIVIENDA_60', rate: 0.6 };
  if (f.stressedArea && f.rentReducedAtLeast5Pct) return { case: 'TENSIONADA_REBAJA_90', rate: 0.9 };
  if ((f.stressedArea && f.tenantAged18to35) || f.leasedToPublicAdministration)
    return { case: 'JOVEN_O_SOCIAL_TENSIONADA_70', rate: 0.7 };
  if (f.rehabilitatedLast2Years) return { case: 'REHABILITADA_60', rate: 0.6 };
  return { case: 'GENERAL_50', rate: 0.5 };
}

/** Cuota íntegra general (estatal + autonómica) sobre base liquidable. */
export function generalQuota(base: number, ccaa: CCAACode): number {
  const regional = IRPF_REGIONAL_GENERAL[ccaa]?.brackets ?? IRPF_STATE_GENERAL; // espejo si no hay escala
  return applyProgressiveScale(Math.max(base, 0), IRPF_STATE_GENERAL)
       + applyProgressiveScale(Math.max(base, 0), regional);
}

export function generalMarginalRate(base: number, ccaa: CCAACode): number {
  const regional = IRPF_REGIONAL_GENERAL[ccaa]?.brackets ?? IRPF_STATE_GENERAL;
  if (base <= 0) return 0;
  return marginalRate(base, IRPF_STATE_GENERAL) + marginalRate(base, regional);
}

/**
 * Bases de amortización (art. 14.2.a RIRPF):
 *  coste adquisición construcción = (precio + impuestos + gastos) × (VC construcción / VC total)
 *  base = MAX(coste adquisición construcción, VC construcción) + mejoras (100 %)
 */
export function computeAmortizationBases(input: InvestmentInput, acqTaxes: AcquisitionTaxResult, closingCosts: number) {
  const { cadastralValueTotal: vct, cadastralValueLand: vcs, purchasePrice } = input.property;
  const constructionRatio = vct > 0 ? (vct - vcs) / vct : 0;
  const acquisitionCostTotal = purchasePrice + acqTaxes.total + closingCosts;
  const acquisitionCostBuilding = acquisitionCostTotal * constructionRatio;
  const cadastralBuilding = vct - vcs;
  const improvements = (input.acquisition.renovationIsImprovement ?? true) ? input.acquisition.renovationCost : 0;
  const buildingBase = Math.max(acquisitionCostBuilding, cadastralBuilding) + improvements;
  return {
    constructionRatio, acquisitionCostTotal, improvements, buildingBase,
    annualBuilding: buildingBase * AMORTIZATION.BUILDING_RATE,
    annualFurniture: input.acquisition.furnitureCost * AMORTIZATION.FURNITURE_RATE,
  };
}

interface CarryItem { amount: number; yearsLeft: number }

/**
 * IRPF de un ejercicio. `carry` (exceso de intereses+reparación) se muta.
 * Límite: intereses + reparación/conservación ≤ ingresos íntegros; exceso a 4 años (FIFO).
 */
export function computeRentalIrpfYear(params: {
  year: number; grossIncome: number; unlimitedExpenses: number; limitedExpensesCurrent: number;
  amortizationBuilding: number; amortizationFurniture: number; reductionRate: number;
  investorBase: number; ccaa: CCAACode; carry: CarryItem[];
}): IrpfRentalYear {
  const { grossIncome, carry } = params;
  // Consumir primero los excesos más antiguos
  let room = Math.max(grossIncome, 0);
  let deducted = 0;
  for (const item of carry) {
    const use = Math.min(item.amount, room);
    item.amount -= use; room -= use; deducted += use;
  }
  const useCurrent = Math.min(params.limitedExpensesCurrent, room);
  deducted += useCurrent;
  const newExcess = params.limitedExpensesCurrent - useCurrent;
  // Envejecer y purgar
  for (const item of carry) item.yearsLeft -= 1;
  for (let i = carry.length - 1; i >= 0; i--) if (carry[i].amount <= 1e-9 || carry[i].yearsLeft <= 0) carry.splice(i, 1);
  if (newExcess > 1e-9) carry.push({ amount: newExcess, yearsLeft: LIMITED_EXPENSES_CARRYFORWARD_YEARS });

  const netIncome = grossIncome - params.unlimitedExpenses - deducted - params.amortizationBuilding - params.amortizationFurniture;
  const reductionRate = netIncome > 0 ? params.reductionRate : 0; // solo sobre rendimiento POSITIVO
  const reducedNetIncome = netIncome * (1 - reductionRate);
  const taxDue = generalQuota(params.investorBase + reducedNetIncome, params.ccaa) - generalQuota(params.investorBase, params.ccaa);

  return {
    year: params.year,
    grossIncome,
    deductibleExpensesUnlimited: params.unlimitedExpenses,
    limitedExpensesDeducted: deducted,
    limitedExpensesCarriedForward: carry.reduce((s, c) => s + c.amount, 0),
    amortizationBuilding: params.amortizationBuilding,
    amortizationFurniture: params.amortizationFurniture,
    netIncome, reductionRate, reducedNetIncome,
    marginalTaxRate: generalMarginalRate(params.investorBase + reducedNetIncome, params.ccaa),
    taxDue,
  };
}

// ============================================================================
// No residentes: IRNR en España + estimación del impuesto en el país de residencia
// ============================================================================

export interface NonResidentSetup {
  profile: CountryProfile;
  rateSpain: number;
  homeRentalRate: number;
  homeGainRate: number;
  imputedPct: number;
}

export function resolveNonResident(input: InvestmentInput): NonResidentSetup | null {
  const profile = getCountry(input.investor?.residenceCountry);
  if (!profile) return null;
  return {
    profile,
    rateSpain: profile.euEea ? IRNR.RATE_EU_EEA : IRNR.RATE_GENERAL,
    homeRentalRate: input.investor?.homeRentalRate ?? profile.rentalRate,
    homeGainRate: input.investor?.homeGainRate ?? profile.gainRate,
    imputedPct: input.investor?.cadastralRevisedRecently ? IRNR.IMPUTED_PCT_REVISED : IRNR.IMPUTED_PCT_DEFAULT,
  };
}

/** Sustituye el IRPF del año por IRNR + impuesto del país de residencia (muta y devuelve el año). */
export function applyNonResidentYear(y: IrpfRentalYear, nr: NonResidentSetup, input: InvestmentInput, ibi: number): IrpfRentalYear {
  const net = y.netIncome;
  const irnrRental = nr.profile.euEea ? nr.rateSpain * Math.max(net, 0) : nr.rateSpain * Math.max(y.grossIncome, 0);
  const vacancy = input.rental.vacancyRate ?? 0;
  const irnrImputed = input.property.cadastralValueTotal * nr.imputedPct * vacancy * nr.rateSpain;
  const homeTax = nr.profile.method === 'CREDITO' ? Math.max(0, nr.homeRentalRate * Math.max(net, 0) - irnrRental) : 0;
  const homeWealthTax = nr.profile.wealthTaxOnValue ? Math.max(0, input.property.cadastralValueTotal * nr.profile.wealthTaxOnValue - ibi) : 0;
  y.reductionRate = 0;
  y.reducedNetIncome = net;
  y.marginalTaxRate = nr.rateSpain;
  y.taxDue = irnrRental + irnrImputed + homeTax + homeWealthTax;
  y.nonResident = { irnrRental, irnrImputed, homeTax, homeWealthTax };
  return y;
}

/** Proyección año a año. withFinancing=false -> escenario sin deuda (rentabilidad neta "pura"). */
export function projectYears(
  input: InvestmentInput, province: ProvinceInfo, mortgage: MortgageSchedule | null,
  amort: ReturnType<typeof computeAmortizationBases>, openingFee: number, withFinancing: boolean,
) {
  const r = input.rental;
  const e = r.annualExpenses;
  const N = input.sale.yearsUntilSale;
  const reduction = resolveRentalReduction(r);
  const nr = resolveNonResident(input);
  const carry: CarryItem[] = [];
  const irpf: IrpfRentalYear[] = [];
  const projection: YearProjection[] = [];
  let accumulatedBuildingAmortization = 0;

  for (let y = 1; y <= N; y++) {
    const gR = Math.pow(1 + (r.annualRentGrowth ?? 0), y - 1);
    const gE = Math.pow(1 + (r.annualExpenseGrowth ?? 0), y - 1);
    const effectiveRent = r.monthlyRent * 12 * (1 - (r.vacancyRate ?? 0)) * gR;
    const management = effectiveRent * (e.managementFeePct ?? 0);
    // Gastos deducibles sin límite: tributos locales (IBI, basuras, vado), comunidad, seguros, otros + gestión
    const unlimited = (e.ibi + (e.wasteTax ?? 0) + (e.parkingVado ?? 0) + e.community + e.homeInsurance + e.defaultInsurance + (e.other ?? 0)) * gE + management;
    const maintenance = e.maintenance * gE;
    const operatingExpenses = unlimited + maintenance;

    const my = withFinancing && mortgage ? mortgage.years[y - 1] : undefined;
    const interest = my?.interest ?? 0;
    const principalRepaid = my?.principal ?? 0;
    const debtService = my?.payment ?? 0;

    // Gasto fiscal con límite: intereses + reparación (+ reforma como reparación año 1, + gastos de formalización)
    let limitedCurrent = interest + maintenance;
    if (y === 1 && !(input.acquisition.renovationIsImprovement ?? true)) limitedCurrent += input.acquisition.renovationCost;
    if (y === 1 && withFinancing) limitedCurrent += openingFee;

    const furnitureAmort = y <= AMORTIZATION.FURNITURE_YEARS ? amort.annualFurniture : 0;
    const irpfYear = computeRentalIrpfYear({
      year: y, grossIncome: effectiveRent, unlimitedExpenses: unlimited, limitedExpensesCurrent: limitedCurrent,
      amortizationBuilding: amort.annualBuilding, amortizationFurniture: furnitureAmort,
      reductionRate: reduction.rate, investorBase: r.investorGeneralTaxBase ?? 0, ccaa: province.ccaa, carry,
    });
    if (nr) applyNonResidentYear(irpfYear, nr, input, e.ibi * gE);
    irpf.push(irpfYear);
    accumulatedBuildingAmortization += amort.annualBuilding;

    const noi = effectiveRent - operatingExpenses;
    const cashflowBeforeTax = noi - debtService;
    projection.push({
      year: y, effectiveRent, operatingExpenses, noi, debtService, interest, principalRepaid,
      irpf: irpfYear.taxDue, cashflowBeforeTax, cashflowAfterTax: cashflowBeforeTax - irpfYear.taxDue,
      mortgageBalance: my?.endingBalance ?? 0,
    });
  }
  return { irpf, projection, accumulatedBuildingAmortization, reduction };
}

// ============================================================================
// 6. Venta: plusvalía municipal (IIVTNU) y ganancia patrimonial (IRPF)
// ============================================================================

export function getIivtnuCoefficient(yearsHeld: number): number {
  const idx = Math.min(Math.max(Math.floor(yearsHeld), 0), IIVTNU_COEFFICIENTS.length - 1);
  return IIVTNU_COEFFICIENTS[idx];
}

/**
 * Art. 104.5 y 107 TRLRHL (tras STC 182/2021 y RDL 26/2021):
 *  - No sujeción si no hay incremento: precio venta ≤ precio compra (valores de escritura, sin gastos).
 *  - Método objetivo: VC suelo (en la venta) × coeficiente(años).
 *  - Método real: (precio venta − precio compra) × (VC suelo / VC total).
 *  - Se toma la base MENOR (más favorable al contribuyente).
 */
export function computeMunicipalCapitalGain(input: InvestmentInput, rateOverride?: number): MunicipalCapitalGainResult {
  const { cadastralValueLand: vcs, cadastralValueTotal: vct, purchasePrice, municipality } = input.property;
  const s = input.sale;
  const years = s.yearsUntilSale;
  const coefficient = getIivtnuCoefficient(years);
  const vcsAtSale = vcs * Math.pow(1 + (s.cadastralLandValueAnnualUpdate ?? 0), years);
  const objectiveBase = vcsAtSale * coefficient;
  const landRatio = vct > 0 ? vcs / vct : 0; // % del valor catastral que corresponde al suelo
  const realLandGain = (s.estimatedSalePrice - purchasePrice) * landRatio;

  const muniKey = (municipality ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const rate = rateOverride ?? s.municipalCapitalGainRate ?? IIVTNU_MUNICIPAL_RATES[muniKey] ?? IIVTNU_MAX_RATE;

  if (realLandGain <= 0) {
    return { yearsHeld: years, coefficient, objectiveBase, realLandGain, isTaxable: false, chosenMethod: 'NO_SUJETO', taxBase: 0, rate, tax: 0 };
  }
  const chosenMethod = realLandGain < objectiveBase ? 'REAL' : 'OBJETIVO';
  const taxBase = Math.min(realLandGain, objectiveBase);
  return { yearsHeld: years, coefficient, objectiveBase, realLandGain, isTaxable: true, chosenMethod, taxBase, rate, tax: taxBase * rate };
}

/**
 * Art. 35 LIRPF:
 *  Valor adquisición = precio + impuestos compra + gastos inherentes + mejoras − amortizaciones (deducidas o mínimo)
 *  Valor transmisión = precio venta − gastos venta − IIVTNU (lo paga el vendedor)
 *  Tributa en la base del AHORRO (19 %–30 %), de forma incremental sobre otras rentas del ahorro.
 */
export function computeCapitalGain(params: {
  purchasePrice: number; acquisitionTaxes: number; closingCosts: number; improvements: number;
  accumulatedAmortization: number; salePrice: number; saleCosts: number; municipalTax: number;
  otherSavingsBase: number;
  /** Vivienda habitual del vendedor al vender */
  habitualResidence?: boolean; aged65Plus?: boolean; reinvestmentAmount?: number;
  /** Principal del préstamo pendiente que se cancela con la venta (art. 41.2 RIRPF) */
  outstandingLoan?: number;
}): CapitalGainResult {
  const acquisitionValue = params.purchasePrice + params.acquisitionTaxes + params.closingCosts
    + params.improvements - params.accumulatedAmortization;
  const transmissionValue = params.salePrice - params.saleCosts - params.municipalTax;
  const gain = transmissionValue - acquisitionValue;

  // --- Exenciones por transmisión de vivienda habitual ----------------------
  //  a) Mayor de 65 años: exención total (art. 33.4.b LIRPF).
  //  b) Reinversión en nueva vivienda habitual en 2 años (art. 38.1 LIRPF): exenta la parte
  //     proporcional reinvertido / importe total obtenido. Con préstamo pendiente, el importe
  //     obtenido es el valor de transmisión menos el principal pendiente (art. 41.2 RIRPF).
  let exemption: CapitalGainResult['exemption'] = 'NINGUNA';
  let exemptGain = 0;
  if (gain > 0 && params.habitualResidence) {
    if (params.aged65Plus) {
      exemption = 'MAYOR_65_VIVIENDA_HABITUAL'; exemptGain = gain;
    } else if ((params.reinvestmentAmount ?? 0) > 0) {
      const obtained = Math.max(transmissionValue - (params.outstandingLoan ?? 0), 0);
      const ratio = obtained > 0 ? Math.min(params.reinvestmentAmount! / obtained, 1) : 1;
      exemption = 'REINVERSION_VIVIENDA_HABITUAL'; exemptGain = gain * ratio;
    }
  }
  const taxableGain = Math.max(gain - exemptGain, 0);
  const tax = taxableGain > 0
    ? applyProgressiveScale(params.otherSavingsBase + taxableGain, IRPF_SAVINGS) - applyProgressiveScale(params.otherSavingsBase, IRPF_SAVINGS)
    : 0;
  return {
    acquisitionValue, accumulatedAmortization: params.accumulatedAmortization, transmissionValue,
    gain, exemption, exemptGain, taxableGain, tax, effectiveRate: gain > 0 ? tax / gain : 0,
  };
}

// ============================================================================
// 7. TIR (bisección robusta)
// ============================================================================

export function computeIRR(flows: number[]): number | null {
  const npv = (r: number) => flows.reduce((s, f, t) => s + f / Math.pow(1 + r, t), 0);
  let lo = -0.99, hi = 10;
  let fLo = npv(lo), fHi = npv(hi);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
  }
  return (lo + hi) / 2;
}

// ============================================================================
// Validación de entrada
// ============================================================================

export function validateInput(input: InvestmentInput): void {
  const errs: string[] = [];
  const p = input.property;
  if (!(p.purchasePrice > 0)) errs.push('El precio de compra debe ser > 0');
  if (!(p.surfaceM2 > 0)) errs.push('La superficie debe ser > 0');
  if (!(p.cadastralValueTotal > 0)) errs.push('El valor catastral total debe ser > 0');
  if (p.cadastralValueLand < 0 || p.cadastralValueLand >= p.cadastralValueTotal) errs.push('El valor catastral del suelo debe estar entre 0 y el valor catastral total');
  if (input.financing?.enabled) {
    const f = input.financing;
    if (f.loanToValue <= 0 || f.loanToValue > 1) errs.push('El % de financiación debe estar entre 0 y 100 %');
    if (f.termYears <= 0) errs.push('El plazo de la hipoteca debe ser > 0');
    if (f.annualInterestRate < 0 || f.annualInterestRate > 0.2) errs.push('TIN fuera de rango (0–20 %)');
  }
  if (input.rental.monthlyRent < 0) errs.push('La renta no puede ser negativa');
  if ((input.rental.vacancyRate ?? 0) < 0 || (input.rental.vacancyRate ?? 0) >= 1) errs.push('Tasa de desocupación fuera de rango');
  if (!Number.isInteger(input.sale.yearsUntilSale) || input.sale.yearsUntilSale < 1) errs.push('Años hasta la venta: entero ≥ 1');
  if (errs.length) throw new ValidationError(errs.join(' | '));
}

// ============================================================================
// PUNTO DE ENTRADA
// ============================================================================

export function runInvestmentAnalysis(input: InvestmentInput): InvestmentAnalysisResult {
  validateInput(input);
  const warnings: string[] = [];

  // 1. Provincia
  const province = resolveProvince(input);
  const ccaa = province.ccaa;
  if (province.isForalTerritory) warnings.push(`${province.name}: territorio foral con IRPF propio; el IRPF se estima con régimen común.`);
  if (!IRPF_REGIONAL_GENERAL[ccaa] && !province.isForalTerritory)
    warnings.push(`Escala autonómica IRPF de ${province.ccaaName} no cargada: se usa la escala estatal como espejo (aproximación).`);
  if (ccaa === 'CEU' || ccaa === 'MEL') warnings.push('Ceuta/Melilla: deducción del 60 % de la cuota IRPF para residentes no aplicada.');

  // 2–3. Compra e inversión
  const acquisitionTaxes = computeAcquisitionTaxes(input, province, warnings);
  const inv = computeInvestment(input, acquisitionTaxes);

  // 4. Hipoteca
  const fin = input.financing?.enabled ? input.financing : undefined;
  const mortgage = fin ? buildMortgageSchedule(inv.loanAmount, fin.annualInterestRate, fin.termYears) : null;

  // 5. Proyección (con y sin deuda)
  const amort = computeAmortizationBases(input, acquisitionTaxes, inv.closingCosts);
  const levered = projectYears(input, province, mortgage, amort, inv.openingFee, true);
  const unlevered = projectYears(input, province, null, amort, 0, false);

  const rType = input.rental.rentalType;
  if (rType === 'TURISTICO') warnings.push('Alquiler turístico: sin reducción del art. 23.2. Si presta servicios propios de hostelería es actividad económica (IVA 21 %, otro régimen): revisar.');
  if (rType === 'TEMPORADA') warnings.push('Alquiler de temporada: no es vivienda habitual del inquilino, sin reducción del art. 23.2.');
  const nr = resolveNonResident(input);
  if (!nr && (input.rental.vacancyRate ?? 0) > 0) warnings.push('Periodos sin alquilar: no se calcula la imputación de rentas inmobiliarias (art. 85 LIRPF).');

  // 6. Venta
  const s = input.sale;
  const N = s.yearsUntilSale;
  const saleCosts = s.estimatedSalePrice * (s.saleCommissionPct ?? MODEL_DEFAULTS.SALE_COMMISSION_PCT) + (s.otherSaleCosts ?? 0);
  const municipalCapitalGain = computeMunicipalCapitalGain(input);
  if (s.municipalCapitalGainRate === undefined && municipalCapitalGain.rate === IIVTNU_MAX_RATE)
    warnings.push('Plusvalía municipal: tipo del ayuntamiento desconocido, se aplica el máximo legal (30 %).');
  const capitalGain = computeCapitalGain({
    purchasePrice: input.property.purchasePrice, acquisitionTaxes: acquisitionTaxes.total,
    closingCosts: inv.closingCosts, improvements: amort.improvements,
    accumulatedAmortization: levered.accumulatedBuildingAmortization,
    salePrice: s.estimatedSalePrice, saleCosts, municipalTax: municipalCapitalGain.tax,
    otherSavingsBase: input.rental.investorSavingsTaxBaseInSaleYear ?? 0,
    habitualResidence: nr ? false : s.sellerHabitualResidence, aged65Plus: nr ? false : s.sellerAged65Plus,
    reinvestmentAmount: s.reinvestmentAmount,
    outstandingLoan: mortgage ? (mortgage.years[N - 1]?.endingBalance ?? 0) : 0,
  });
  // No residente: IRNR 19 % sobre la ganancia (sin exenciones) + impuesto en su país; retención del 3 %
  let nonResident: NonResidentResult | undefined;
  if (nr) {
    const gainPos = Math.max(capitalGain.gain, 0);
    const irnr = IRNR.RATE_CAPITAL_GAIN * gainPos;
    const homeTaxable = !(nr.profile.gainOnlyIfHeldUnderYears && N >= nr.profile.gainOnlyIfHeldUnderYears);
    const homeSaleTax = nr.profile.method === 'CREDITO' && homeTaxable ? Math.max(0, nr.homeGainRate * gainPos - irnr) : 0;
    capitalGain.exemption = 'NINGUNA';
    capitalGain.exemptGain = 0;
    capitalGain.taxableGain = gainPos;
    capitalGain.tax = irnr + homeSaleTax;
    capitalGain.effectiveRate = gainPos > 0 ? capitalGain.tax / gainPos : 0;
    const withholding = IRNR.SALE_WITHHOLDING * s.estimatedSalePrice;
    const y1nr = levered.irpf[0].nonResident!;
    nonResident = {
      countryCode: nr.profile.code, countryName: nr.profile.name, euEea: nr.profile.euEea, method: nr.profile.method,
      rentalRateSpain: nr.rateSpain, rentalBaseSpain: nr.profile.euEea ? 'NETO' : 'INTEGRO',
      homeRentalRate: nr.homeRentalRate, homeGainRate: homeTaxable ? nr.homeGainRate : 0, imputedPct: nr.imputedPct,
      year1: { ...y1nr, total: levered.irpf[0].taxDue },
      sale: { irnr, withholding, withholdingBalance: irnr - withholding, homeTax: homeSaleTax, total: irnr + homeSaleTax },
      note: nr.profile.note,
    };
    if (!nr.profile.euEea)
      warnings.push(`Residente fuera de la UE/EEE: el IRNR del alquiler es el 24 % de la renta íntegra, sin descontar gastos (criterio de Hacienda; hay sentencias que admiten deducirlos y se puede reclamar).`);
    if ((input.rental.vacancyRate ?? 0) > 0)
      warnings.push(`Meses sin alquilar: renta imputada del ${(nr.imputedPct * 100).toLocaleString('es-ES')} % del valor catastral, proporcional al tiempo vacío.`);
    warnings.push(`Venta: el comprador retiene el 3 % del precio (${Math.round(withholding).toLocaleString('es-ES')} €) a cuenta del IRNR; ${irnr >= withholding ? 'la diferencia se paga con el modelo 210' : 'el exceso se recupera con el modelo 210'}.`);
    if (s.sellerHabitualResidence || s.sellerAged65Plus || (s.reinvestmentAmount ?? 0) > 0)
      warnings.push('No residente: no se aplican las exenciones del IRPF por vivienda habitual (65 años o reinversión).');
    warnings.push(`Impuesto en ${nr.profile.name}: estimación orientativa con un tipo del ${(nr.homeRentalRate * 100).toLocaleString('es-ES')} % sobre el alquiler. Depende de tu renta total y de las normas de tu país: confírmalo con un asesor allí.`);
  }

  if (!nr && s.sellerHabitualResidence) {
    warnings.push('Vivienda habitual al vender: exige haber vivido en ella al menos 3 años seguidos y venderla mientras lo es o en los 2 años siguientes a dejar de serlo. La proyección asume alquiler todo el periodo: ajusta los años de alquiler si vas a vivir en ella.');
    if (!s.sellerAged65Plus && !(s.reinvestmentAmount && s.reinvestmentAmount > 0))
      warnings.push('Ser vivienda habitual no exime por sí solo: la ganancia queda exenta si tienes 65 años o más, o en la parte que reinviertas en otra vivienda habitual en 2 años.');
  }
  if (!nr && capitalGain.gain < 0) warnings.push('La venta genera pérdida patrimonial: compensable con otras ganancias del ahorro (no modelado).');
  const outstandingMortgage = mortgage ? (mortgage.years[N - 1]?.endingBalance ?? 0) : 0;
  const netProceeds = s.estimatedSalePrice - saleCosts - municipalCapitalGain.tax - capitalGain.tax - outstandingMortgage;

  // 7. KPIs (año 1)
  const y1 = levered.projection[0];
  const u1 = unlevered.projection[0];
  const potentialRent = input.rental.monthlyRent * 12;
  const equity = inv.equity;
  const flows = [-equity, ...levered.projection.map((p) => p.cashflowAfterTax)];
  flows[flows.length - 1] += netProceeds;
  const totalReturned = flows.slice(1).reduce((a, b) => a + b, 0);
  if (equity <= 0) warnings.push('Capital propio ≤ 0 (financiación ≥ inversión): ROCE y TIR no son representativos.');

  const kpis: KPIs = {
    totalInvestment: inv.totalInvestment,
    equityRequired: equity,
    loanAmount: inv.loanAmount,
    grossYieldOnPrice: potentialRent / input.property.purchasePrice,
    grossYieldOnInvestment: potentialRent / inv.totalInvestment,
    netYieldBeforeTax: u1.noi / inv.totalInvestment,
    netYieldAfterTax: (u1.noi - u1.irpf) / inv.totalInvestment,
    cashflowAnnualBeforeTax: y1.cashflowBeforeTax,
    cashflowAnnualAfterTax: y1.cashflowAfterTax,
    cashflowMonthlyBeforeTax: y1.cashflowBeforeTax / 12,
    cashflowMonthlyAfterTax: y1.cashflowAfterTax / 12,
    roce: equity > 0 ? y1.cashflowAfterTax / equity : null,
    roceIncludingPrincipal: equity > 0 ? (y1.cashflowAfterTax + y1.principalRepaid) / equity : null,
    irr: equity > 0 ? computeIRR(flows) : null,
    equityMultiple: equity > 0 ? totalReturned / equity : null,
  };

  // Calendario de pagos a Hacienda
  const taxPayments = nonResident
    ? buildNonResidentTaxPayments(input, province, acquisitionTaxes, municipalCapitalGain, nonResident)
    : buildTaxPayments(input, province, acquisitionTaxes, levered.irpf[0].taxDue, municipalCapitalGain, capitalGain);

  return {
    meta: { taxTablesVersion: TAX_TABLES_VERSION, generatedAt: new Date().toISOString() },
    province, acquisitionTaxes, investmentBreakdown: inv.breakdown, mortgage, kpis,
    irpfYear1: levered.irpf[0], irpfByYear: levered.irpf, projection: levered.projection,
    sale: { salePrice: s.estimatedSalePrice, saleCosts, municipalCapitalGain, capitalGain, outstandingMortgage, netProceeds },
    taxPayments, nonResident, warnings,
  };
}

// ============================================================================
// Calendario de pagos a Hacienda (por provincia)
// ============================================================================

export function buildTaxPayments(
  input: InvestmentInput, province: ProvinceInfo, acq: AcquisitionTaxResult, irpfYear1: number,
  iivtnu: MunicipalCapitalGainResult, gain: CapitalGainResult,
): TaxPayment[] {
  const irpfAuthority = province.ccaa === 'NAV' ? 'Hacienda Foral de Navarra'
    : province.ccaa === 'PV' ? province.transferTaxAuthority
    : 'Agencia Estatal de Administración Tributaria (AEAT)';
  const city = input.property.municipality ? `Ayuntamiento de ${input.property.municipality}` : 'Ayuntamiento donde radica el inmueble';
  const out: TaxPayment[] = [];

  if (acq.regime === 'ITP') {
    out.push({ moment: 'COMPRA', concept: 'ITP — Transmisiones Patrimoniales Onerosas', amount: acq.transferTax,
      authority: province.transferTaxAuthority, form: province.transferTaxForm, deadline: province.transferTaxDeadline });
  } else {
    out.push({ moment: 'COMPRA', concept: `${acq.regime.split('_')[0]} (se paga al promotor en la factura; lo ingresa él)`, amount: acq.vat,
      authority: 'Promotor (repercusión en factura)', form: '—', deadline: 'En la entrega / firma' });
    out.push({ moment: 'COMPRA', concept: 'AJD — Actos Jurídicos Documentados (escritura de compraventa)', amount: acq.stampDuty,
      authority: province.transferTaxAuthority, form: province.transferTaxForm, deadline: province.transferTaxDeadline });
  }
  out.push({ moment: 'ANUAL', concept: 'IRPF — rendimientos del capital inmobiliario (estimación año 1)', amount: irpfYear1,
    authority: irpfAuthority, form: province.isForalTerritory ? 'Declaración foral de IRPF' : 'Modelo 100 (Renta)',
    deadline: 'Campaña de la Renta del año siguiente' });
  out.push({ moment: 'ANUAL', concept: 'IBI — Impuesto sobre Bienes Inmuebles', amount: input.rental.annualExpenses.ibi,
    authority: city, form: 'Recibo municipal', deadline: 'Según calendario fiscal municipal' });
  if ((input.rental.annualExpenses.wasteTax ?? 0) > 0)
    out.push({ moment: 'ANUAL', concept: 'Tasa de basuras / residuos', amount: input.rental.annualExpenses.wasteTax!,
      authority: city, form: 'Recibo municipal', deadline: 'Según calendario fiscal municipal' });
  if ((input.rental.annualExpenses.parkingVado ?? 0) > 0)
    out.push({ moment: 'ANUAL', concept: 'Tasa de vado (entrada de vehículos)', amount: input.rental.annualExpenses.parkingVado!,
      authority: city, form: 'Recibo municipal', deadline: 'Según calendario fiscal municipal' });
  out.push({ moment: 'VENTA', concept: `Plusvalía municipal (IIVTNU) — método ${iivtnu.chosenMethod.toLowerCase()}`, amount: iivtnu.tax,
    authority: city, form: 'Autoliquidación / declaración municipal', deadline: '30 días hábiles desde la transmisión (art. 110 TRLRHL)' });
  out.push({ moment: 'VENTA', concept: gain.exemption === 'NINGUNA' ? 'IRPF — ganancia patrimonial (base del ahorro)'
      : `IRPF — ganancia patrimonial, con exención por vivienda habitual (${gain.exemption === 'MAYOR_65_VIVIENDA_HABITUAL' ? 'mayor de 65 años' : 'reinversión'})`,
    amount: gain.tax,
    authority: irpfAuthority, form: province.isForalTerritory ? 'Declaración foral de IRPF' : 'Modelo 100 (Renta)',
    deadline: 'Campaña de la Renta del año siguiente a la venta' });
  return out;
}

/** Calendario de pagos de un inversor no residente: IRNR (modelo 210/211) + estimación en su país. */
export function buildNonResidentTaxPayments(
  input: InvestmentInput, province: ProvinceInfo, acq: AcquisitionTaxResult,
  iivtnu: MunicipalCapitalGainResult, nr: NonResidentResult,
): TaxPayment[] {
  // Compra, IBI, basuras, vado y plusvalía municipal: igual que un residente
  const base = buildTaxPayments(input, province, acq, 0, iivtnu, {
    acquisitionValue: 0, accumulatedAmortization: 0, transmissionValue: 0, gain: 0,
    exemption: 'NINGUNA', exemptGain: 0, taxableGain: 0, tax: 0, effectiveRate: 0,
  }).filter((p) => !p.concept.startsWith('IRPF'));
  const aeat = 'Agencia Estatal de Administración Tributaria (AEAT)';
  const home = `Administración tributaria de ${nr.countryName}`;
  const out: TaxPayment[] = base.filter((p) => p.moment === 'COMPRA');
  out.push({ moment: 'ANUAL', concept: `IRNR — alquiler (${(nr.rentalRateSpain * 100).toFixed(0)} % sobre el rendimiento ${nr.rentalBaseSpain === 'NETO' ? 'neto' : 'íntegro'}), estimación año 1`,
    amount: nr.year1.irnrRental, authority: aeat, form: 'Modelo 210', deadline: 'Declaración anual del año siguiente (consulta el plazo vigente en la AEAT)' });
  if (nr.year1.irnrImputed > 0)
    out.push({ moment: 'ANUAL', concept: 'IRNR — renta imputada por los meses sin alquilar', amount: nr.year1.irnrImputed,
      authority: aeat, form: 'Modelo 210', deadline: 'Declaración anual del año siguiente' });
  if (nr.year1.homeTax > 0)
    out.push({ moment: 'ANUAL', concept: `Impuesto en ${nr.countryName} sobre el alquiler (estimación, tras descontar el IRNR)`, amount: nr.year1.homeTax,
      authority: home, form: 'Declaración de la renta de tu país', deadline: 'Según el calendario de tu país' });
  if (nr.year1.homeWealthTax > 0)
    out.push({ moment: 'ANUAL', concept: `IVIE en ${nr.countryName} (1,06 % del valor, descontado el IBI)`, amount: nr.year1.homeWealthTax,
      authority: home, form: 'Declaración de la renta de tu país', deadline: 'Según el calendario de tu país' });
  out.push(...base.filter((p) => p.moment === 'ANUAL'));
  out.push(...base.filter((p) => p.moment === 'VENTA'));
  out.push({ moment: 'VENTA', concept: 'Retención del 3 % del precio que practica el comprador (a cuenta del IRNR)', amount: nr.sale.withholding,
    authority: aeat, form: 'Modelo 211 (lo presenta el comprador)', deadline: 'Un mes desde la firma de la venta' });
  out.push({ moment: 'VENTA', concept: nr.sale.withholdingBalance >= 0 ? 'IRNR — ganancia de la venta (19 %): diferencia a pagar tras la retención' : 'IRNR — ganancia de la venta (19 %): devolución del exceso retenido',
    amount: nr.sale.withholdingBalance, authority: aeat, form: 'Modelo 210', deadline: 'En los 3 meses siguientes al plazo de la retención' });
  if (nr.sale.homeTax > 0)
    out.push({ moment: 'VENTA', concept: `Impuesto en ${nr.countryName} sobre la ganancia (estimación, tras descontar el IRNR)`, amount: nr.sale.homeTax,
      authority: home, form: 'Declaración de la renta de tu país', deadline: 'Según el calendario de tu país' });
  return out;
}
