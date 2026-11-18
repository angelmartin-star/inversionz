/**
 * InversionZ — Rentabilidad rápida (función pura).
 *  Bruta = renta anual / precio
 *  Neta  = (renta anual − IBI − comunidad − basuras) / precio
 *  Inversión total = precio + ITP de la provincia (si hay código postal) + notaría y registro + honorarios de gestión
 *  Neta sobre la inversión = mismo numerador / inversión total
 *  Años para recuperar la inversión (PER) = inversión total / renta neta anual
 */
import { computeItp } from "./calculationEngine";
import { getProvinceFromPostalCode } from "../tax/provinces";

export interface QuickYieldInput {
  purchasePrice: number;
  monthlyRent: number;
  ibi: number;
  community: number;     // anual
  wasteTax: number;      // anual
  /** Gastos de notaría y registro de la compra (pago único) */
  notaryFees?: number;
  /** Honorarios de gestión: agencia, personal shopper o gestoría (pago único) */
  managementFees?: number;
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
  notaryFees: number;
  managementFees: number;
  /** Precio + ITP + notaría + honorarios */
  totalInvestment: number;
  /** Ingreso neto / inversión total */
  netYieldOnInvestment: number;
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
  const notaryFees = Math.max(i.notaryFees || 0, 0);
  const managementFees = Math.max(i.managementFees || 0, 0);
  const base = i.purchasePrice + (transferTax ?? 0) + notaryFees + managementFees;
  return {
    annualRent, annualExpenses, netAnnualIncome,
    grossYield: annualRent / i.purchasePrice,
    netYield: netAnnualIncome / i.purchasePrice,
    transferTax, provinceName: province?.name ?? null,
    netYieldWithTax: transferTax !== null ? netAnnualIncome / (i.purchasePrice + transferTax) : null,
    notaryFees, managementFees, totalInvestment: base, netYieldOnInvestment: netAnnualIncome / base,
    paybackYears: netAnnualIncome > 0 ? base / netAnnualIncome : null,
    monthlyNet: netAnnualIncome / 12,
  };
}
