/** Desglose de gastos anuales del inmueble (año 1), compartido por dashboard y PDF. */
import type { InvestmentAnalysisResult, InvestmentInput } from "@/types/investment";

export interface ExpenseRow { label: string; annual: number; group: "fijo" | "otro" }

export function buildExpenseRows(input: InvestmentInput, result: InvestmentAnalysisResult): ExpenseRow[] {
  const e = input.rental.annualExpenses;
  const rent1 = result.projection[0]?.effectiveRent ?? 0;
  const rows: ExpenseRow[] = [
    { label: "IBI", annual: e.ibi, group: "fijo" },
    { label: "Comunidad de propietarios", annual: e.community, group: "fijo" },
    { label: "Tasa de basuras", annual: e.wasteTax ?? 0, group: "fijo" },
    { label: "Vado de aparcamiento", annual: e.parkingVado ?? 0, group: "fijo" },
    { label: "Seguro de hogar", annual: e.homeInsurance, group: "otro" },
    { label: "Seguro de impago", annual: e.defaultInsurance, group: "otro" },
    { label: "Mantenimiento y reparaciones", annual: e.maintenance, group: "otro" },
    { label: "Gestión del alquiler", annual: rent1 * (e.managementFeePct ?? 0), group: "otro" },
    { label: "Otros gastos", annual: e.other ?? 0, group: "otro" },
  ];
  return rows.filter((r) => r.annual > 0 || r.group === "fijo");
}

export const sumRows = (rows: ExpenseRow[], group?: ExpenseRow["group"]) =>
  rows.filter((r) => !group || r.group === group).reduce((s, r) => s + r.annual, 0);
