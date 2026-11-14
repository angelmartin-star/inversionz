/**
 * "La cuenta del primer año": cascada en forma de libro de cuentas.
 * Cada fila es un movimiento con su barra flotante; la última es el cashflow neto.
 * Identidad no depende solo del color: signo +/− y etiqueta en cada fila.
 */
import type { InvestmentAnalysisResult, InvestmentInput } from "@/types/investment";
import { eur, signedEur } from "@/lib/format";
import { cn } from "@/lib/ui";

interface Row { label: string; detail?: string; value: number; kind: "in" | "out" | "total" }

export function buildLedgerRows(input: InvestmentInput, r: InvestmentAnalysisResult): Row[] {
  const y1 = r.projection[0];
  const potential = input.rental.monthlyRent * 12;
  const rows: Row[] = [{ label: "Renta anual", detail: `${eur(input.rental.monthlyRent)} × 12 meses`, value: potential, kind: "in" }];
  const vacancy = potential - y1.effectiveRent;
  if (vacancy > 0.5) rows.push({ label: "Meses sin alquilar", value: -vacancy, kind: "out" });
  rows.push({ label: "Gastos del inmueble", detail: "IBI, comunidad, basuras, seguros, mantenimiento", value: -y1.operatingExpenses, kind: "out" });
  if (y1.interest > 0) rows.push({ label: "Intereses de la hipoteca", value: -y1.interest, kind: "out" });
  if (y1.principalRepaid > 0) rows.push({ label: "Devolución de capital", detail: "No es gasto: es patrimonio que recuperas", value: -y1.principalRepaid, kind: "out" });
  rows.push({ label: "IRPF del alquiler", detail: r.irpfYear1.reductionRate > 0 ? `Con reducción del ${Math.round(r.irpfYear1.reductionRate * 100)} %` : "Sin reducción", value: -y1.irpf, kind: y1.irpf >= 0 ? "out" : "in" });
  rows.push({ label: "Te queda en el bolsillo", value: y1.cashflowAfterTax, kind: "total" });
  return rows;
}

export function Ledger({ input, result }: { input: InvestmentInput; result: InvestmentAnalysisResult }) {
  const rows = buildLedgerRows(input, result);
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  let running = 0;
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Cuenta del primer año, de la renta al cashflow neto</caption>
      <tbody>
        {rows.map((row, i) => {
          const start = row.kind === "total" ? 0 : running;
          const end = row.kind === "total" ? row.value : running + row.value;
          if (row.kind !== "total") running = end;
          const left = (Math.min(start, end) / max) * 100;
          const width = Math.max((Math.abs(end - start) / max) * 100, 0.6);
          const negativeTotal = row.kind === "total" && row.value < 0;
          return (
            <tr key={i} className={cn(row.kind === "total" ? "border-t-2 border-tinta" : "border-t border-linea")}>
              <th scope="row" className="w-[40%] py-3 pr-4 text-left align-top font-normal">
                <span className={cn("block", row.kind === "total" ? "font-semibold" : "font-medium")}>{row.label}</span>
                {row.detail && <span className="block text-xs text-tinta-3">{row.detail}</span>}
              </th>
              <td className="hidden w-[38%] py-3 align-middle sm:table-cell">
                <div className="relative h-5" aria-hidden>
                  <div
                    className={cn("absolute top-0 h-5 rounded-[4px]",
                      row.kind === "in" && "bg-parcela", row.kind === "out" && "bg-sello",
                      row.kind === "total" && (negativeTotal ? "bg-sello" : "bg-tinta"))}
                    style={{ left: `${Math.max(left, 0)}%`, width: `${Math.min(width, 100)}%` }}
                  />
                </div>
              </td>
              <td className={cn("py-3 pl-4 text-right align-top whitespace-nowrap",
                row.kind === "total" ? "text-lg font-semibold" : "", row.kind === "out" ? "text-sello" : row.kind === "in" ? "text-parcela" : "")}>
                {row.kind === "total" ? eur(row.value) : signedEur(row.value)}
                {row.kind === "total" && <span className="block text-xs font-normal text-tinta-3">{eur(row.value / 12)} al mes</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
