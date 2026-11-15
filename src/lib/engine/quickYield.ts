/**
 * InversionZ — Rentabilidad rápida (función pura).
 *  Bruta = renta anual / precio
 *  Neta  = (renta anual − IBI − comunidad − basuras) / precio
 *  Neta con impuesto de compra = mismo numerador / (precio + ITP de la provincia), si se indica el código postal
 *  Años para recuperar la inversión (PER) = (precio [+ ITP]) / renta neta anual
 */
import { computeItp } from "./calculationEngine";
import { getProvinceFromPostalCode } from "../tax/provinces";

export interface QuickYieldInput {
  purchasePrice: number;
  monthlyRent: number;
  ibi: number;
  community: number;     // anual
  wasteTax: number;      // anual
  postalCode?: string;
}

export interface QuickYieldResult {
  annualRent: number;
  annualExpenses: number;
  netAnnualIncome: number;
  grossYield: number;
  netYield: number;
  transferTax: number | null;
  provinceName: string | null;
  netYieldWithTax: number | null;
  paybackYears: number | null;
  monthlyNet: number;
}

export function quickYield(i: QuickYieldInput): QuickYieldResult | null {
  if (!(i.purchasePrice > 0) || !(i.monthlyRent > 0)) return null;
  const annualRent = i.monthlyRent * 12;
  const annualExpenses = (i.ibi || 0) + (i.community || 0) + (i.wasteTax || 0);
  const netAnnualIncome = annualRent - annualExpenses;
  const province = i.postalCode ? getProvinceFromPostalCode(i.postalCode) : undefined;
  const transferTax = province ? computeItp(i.purchasePrice, province.ccaa) : null;
  const base = i.purchasePrice + (transferTax ?? 0);
  return {
    annualRent, annualExpenses, netAnnualIncome,
    grossYield: annualRent / i.purchasePrice,
    netYield: netAnnualIncome / i.purchasePrice,
    transferTax, provinceName: province?.name ?? null,
    netYieldWithTax: transferTax !== null ? netAnnualIncome / base : null,
    paybackYears: netAnnualIncome > 0 ? base / netAnnualIncome : null,
    monthlyNet: netAnnualIncome / 12,
  };
}
