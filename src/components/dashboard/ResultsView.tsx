"use client";
/**
 * Dashboard de resultados. Recalcula en el cliente con el mismo motor que usa el servidor
 * (funciones puras), así el PDF y la pantalla siempre coinciden.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AVMResult, InvestmentAnalysisResult, InvestmentInput, TaxPayment } from "@/types/investment";
import { runInvestmentAnalysis } from "@/lib/engine/calculationEngine";
import { getAVMProvider } from "@/lib/avm/avmService";
import { STORAGE_KEY } from "@/lib/defaults";
import { eur, formatAddress, num, pct, placeLabel } from "@/lib/format";
import { buildExpenseRows, sumRows } from "@/lib/expenses";
import { Button, buttonVariants, cn } from "@/components/ui/primitives";
import { Ledger } from "./Ledger";
import { CashflowChart } from "./CashflowChart";

const CONDITION_LABEL = { A_REFORMAR: "a reformar", BUEN_ESTADO: "en buen estado", OBRA_NUEVA: "obra nueva" } as const;
const RENTAL_LABEL = { VIVIENDA_HABITUAL: "vivienda habitual", TEMPORADA: "temporada", TURISTICO: "turístico" } as const;
const MOMENT_LABEL: Record<TaxPayment["moment"], string> = { COMPRA: "Al comprar", ANUAL: "Cada año", VENTA: "Al vender" };

export function ResultsView() {
  const [input, setInput] = useState<InvestmentInput | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [avm, setAvm] = useState<AVMResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setInput(JSON.parse(raw)); } catch { /* */ }
    setLoaded(true);
  }, []);

  const { result, error } = useMemo(() => {
    if (!input) return { result: null, error: null };
    try { return { result: runInvestmentAnalysis(input), error: null }; }
    catch (e) { return { result: null, error: (e as Error).message }; }
  }, [input]);

  useEffect(() => {
    if (!input || !result) return;
    getAVMProvider().estimate({ postalCode: input.property.postalCode, provinceCode: result.province.code,
      surfaceM2: input.property.surfaceM2, condition: input.property.condition, purchasePrice: input.property.purchasePrice }).then(setAvm).catch(() => setAvm(null));
  }, [input, result]);

  async function downloadPdf() {
    if (!input) return;
    setDownloading(true); setPdfError(null);
    try {
      const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `InversionQ-${input.property.postalCode}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { setPdfError(`No se pudo generar el PDF: ${(e as Error).message}`); }
    finally { setDownloading(false); }
  }

  if (!loaded) return null;
  if (!input || error || !result) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="text-2xl font-semibold">{error ? "Hay datos que no cuadran" : "Todavía no hay ningún análisis"}</h1>
        <p className="mt-3 text-tinta-2">{error ?? "Introduce los datos del inmueble para ver su rentabilidad, impuestos y plusvalías."}</p>
        <Link href="/analisis/nuevo" className={cn(buttonVariants({ size: "lg" }), "mt-8")}>{error ? "Revisar los datos" : "Empezar un análisis"}</Link>
      </div>
    );
  }

  const k = result.kpis;
  const p = input.property;
  const N = input.sale.yearsUntilSale;
  const totalCashflows = result.projection.reduce((s, y) => s + y.cashflowAfterTax, 0);
  const expenseRows = buildExpenseRows(input, result);
  const totalExpenses = sumRows(expenseRows);
  const rentYear1 = result.projection[0].effectiveRent || 1;

  return (
    <div className="pb-20">
      {/* Cabecera */}
      <div className="reticula border-b border-linea">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm text-tinta-2">{[formatAddress(p.address), `${p.postalCode} ${placeLabel(p.municipality, result.province.name)}`].filter(Boolean).join(". ")}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                Piso de {num(p.surfaceM2)} m² {CONDITION_LABEL[p.condition]} por {eur(p.purchasePrice)}
              </h1>
              {p.cadastre?.refCat && (
                <p className="mt-1 text-sm text-tinta-3">
                  Referencia catastral {p.cadastre.refCat}{p.cadastre.use ? `. Uso ${p.cadastre.use.toLowerCase()}` : ""}{p.cadastre.yearBuilt ? `, construido en ${p.cadastre.yearBuilt}` : ""}.
                </p>
              )}
              <p className="mt-2 text-tinta-2">Alquiler {RENTAL_LABEL[input.rental.rentalType]} a {eur(input.rental.monthlyRent)} al mes, venta prevista en {N} {N === 1 ? "año" : "años"}.</p>
            </div>
            <div className="no-print flex gap-3">
              <Link href="/analisis/nuevo" className={buttonVariants({ variant: "secondary" })}>Editar datos</Link>
              <Button onClick={downloadPdf} disabled={downloading}>{downloading ? "Generando informe…" : "Descargar informe PDF"}</Button>
            </div>
          </div>
          {pdfError && <p role="alert" className="mt-3 text-sm text-sello">{pdfError}</p>}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5">
        {/* Bloque principal: la cuenta del primer año + indicadores */}
        <section className="grid gap-10 py-10 lg:grid-cols-[1.5fr_1fr]" aria-labelledby="cuenta">
          <div>
            <h2 id="cuenta" className="text-xl font-semibold">La cuenta del primer año</h2>
            <p className="mt-1 mb-4 text-sm text-tinta-2">De lo que paga el inquilino a lo que te queda tras gastos, hipoteca e impuestos.</p>
            <Ledger input={input} result={result} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Indicadores</h2>
            <dl className="mt-4 divide-y divide-linea border-y border-linea">
              <Kpi label="Rentabilidad bruta" value={pct(k.grossYieldOnPrice)} note="Renta anual sobre el precio de compra" />
              <Kpi label="Rentabilidad neta antes de impuestos" value={pct(k.netYieldBeforeTax)} note="Sobre la inversión total, sin hipoteca" />
              <Kpi label="Rentabilidad neta después de impuestos" value={pct(k.netYieldAfterTax)} note="Incluye el IRPF del alquiler" />
              <Kpi label="Rentabilidad sobre tu dinero (ROCE)" value={pct(k.roce)} note={`Cashflow neto sobre ${eur(k.equityRequired)} aportados. Con el capital amortizado: ${pct(k.roceIncludingPrincipal)}`} />
              <Kpi label={`TIR a ${N} ${N === 1 ? "año" : "años"} con la venta`} value={pct(k.irr)} note={k.equityMultiple ? `Recuperas ${k.equityMultiple.toLocaleString("es-ES", { maximumFractionDigits: 2 })} veces lo aportado` : undefined} strong />
            </dl>
          </div>
        </section>

        {/* Inversión */}
        <Section id="inversion" title="Inversión inicial" intro={`Necesitas aportar ${eur(k.equityRequired)}${k.loanAmount > 0 ? ` y el banco financia ${eur(k.loanAmount)}` : ""}.`}>
          <BreakdownTable rows={[
            ["Precio de compra", result.investmentBreakdown.precioCompra],
            [result.acquisitionTaxes.regime === "ITP" ? "ITP" : result.acquisitionTaxes.breakdown, result.investmentBreakdown.impuestosCompra],
            ["Notaría, registro, gestoría y honorarios", result.investmentBreakdown.gastosCierre],
            ["Reforma", result.investmentBreakdown.reforma],
            ["Mobiliario", result.investmentBreakdown.mobiliario],
            ["Comisión de apertura", result.investmentBreakdown.comisionApertura],
          ]} total={k.totalInvestment} />
        </Section>

        {/* Rentabilidad del inmueble: gastos fijos y resto de gastos */}
        <Section id="rentabilidad" title="Rentabilidad del inmueble" intro={`Los gastos del inmueble suman ${eur(totalExpenses)} al año, el ${pct(totalExpenses / rentYear1, 1)} de la renta cobrada. Por eso la rentabilidad baja del ${pct(k.grossYieldOnPrice)} bruta al ${pct(k.netYieldBeforeTax)} neta antes de impuestos.`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-tinta text-left text-tinta-2">
                <th className="py-2 font-medium">Gasto</th><Th>Al mes</Th><Th>Al año</Th><Th>% de la renta</Th>
              </tr></thead>
              <tbody>
                <tr><td colSpan={4} className="pt-4 pb-1 text-xs font-semibold text-tinta-2">Gastos fijos del inmueble</td></tr>
                {expenseRows.filter((r) => r.group === "fijo").map((r) => <ExpenseLine key={r.label} label={r.label} annual={r.annual} rent={rentYear1} />)}
                <ExpenseLine label="Total gastos fijos" annual={sumRows(expenseRows, "fijo")} rent={rentYear1} strong />
                {expenseRows.some((r) => r.group === "otro") && <tr><td colSpan={4} className="pt-5 pb-1 text-xs font-semibold text-tinta-2">Seguros, mantenimiento y gestión</td></tr>}
                {expenseRows.filter((r) => r.group === "otro").map((r) => <ExpenseLine key={r.label} label={r.label} annual={r.annual} rent={rentYear1} />)}
                <tr className="border-t-2 border-tinta">
                  <th scope="row" className="py-3 text-left font-semibold">Total gastos del inmueble</th>
                  <Td className="py-3 font-semibold">{eur(totalExpenses / 12)}</Td><Td className="py-3 text-base font-semibold">{eur(totalExpenses)}</Td><Td className="py-3 font-semibold">{pct(totalExpenses / rentYear1, 1)}</Td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-tinta-3">El IBI, la tasa de basuras, el vado, la comunidad y los seguros son deducibles en el IRPF del alquiler.</p>
        </Section>

        {/* Proyección */}
        <Section id="proyeccion" title="Cashflow neto año a año" intro={`Suma del periodo: ${eur(totalCashflows)}, sin contar la venta.`}>
          <CashflowChart data={result.projection} />
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-tinta-2">Ver la tabla</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-tinta text-left text-tinta-2">
                  <th className="py-2 font-medium">Año</th><Th>Renta cobrada</Th><Th>Gastos</Th><Th>Cuota hipoteca</Th><Th>IRPF</Th><Th>Cashflow neto</Th><Th>Deuda pendiente</Th>
                </tr></thead>
                <tbody>{result.projection.map((y) => (
                  <tr key={y.year} className="border-b border-linea">
                    <td className="py-2">{y.year}</td><Td>{eur(y.effectiveRent)}</Td><Td>{eur(y.operatingExpenses)}</Td><Td>{eur(y.debtService)}</Td>
                    <Td>{eur(y.irpf)}</Td><Td className={y.cashflowAfterTax < 0 ? "text-sello" : ""}>{eur(y.cashflowAfterTax)}</Td><Td>{eur(y.mortgageBalance)}</Td>
                  </tr>))}</tbody>
              </table>
            </div>
          </details>
        </Section>

        {/* IRPF */}
        <Section id="irpf" title="IRPF del alquiler, primer año" intro={`El alquiler tributa a tu tipo marginal, que con este piso queda en ${pct(result.irpfYear1.marginalTaxRate, 1)}.`}>
          <LineTable rows={[
            ["Ingresos íntegros", result.irpfYear1.grossIncome],
            ["IBI, comunidad, seguros y otros gastos", -result.irpfYear1.deductibleExpensesUnlimited],
            ["Intereses y reparaciones (hasta el límite de los ingresos)", -result.irpfYear1.limitedExpensesDeducted],
            ["Amortización del inmueble (3 %)", -result.irpfYear1.amortizationBuilding],
            ["Amortización del mobiliario (10 %)", -result.irpfYear1.amortizationFurniture],
            ["Rendimiento neto", result.irpfYear1.netIncome, "sub"],
            [`Reducción por alquiler de vivienda (${pct(result.irpfYear1.reductionRate, 0)})`, -(result.irpfYear1.netIncome - result.irpfYear1.reducedNetIncome)],
            ["Rendimiento neto reducido", result.irpfYear1.reducedNetIncome, "sub"],
            [result.irpfYear1.taxDue >= 0 ? "IRPF a pagar por el alquiler" : "Ahorro de IRPF (el alquiler da pérdidas fiscales)", result.irpfYear1.taxDue, "total"],
          ]} />
          {result.irpfYear1.limitedExpensesCarriedForward > 0 && (
            <p className="mt-3 text-sm text-tinta-2">Quedan {eur(result.irpfYear1.limitedExpensesCarriedForward)} de intereses y reparaciones para deducir en los 4 años siguientes.</p>
          )}
        </Section>

        {/* Venta */}
        <Section id="venta" title={`Venta en el año ${N}`} intro={`Vendiendo por ${eur(result.sale.salePrice)}, recibirías ${eur(result.sale.netProceeds)} limpios tras impuestos, gastos y cancelar la hipoteca.`}>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold">Plusvalía municipal</h3>
              <p className="mt-1 mb-3 text-sm text-tinta-2">Se calculan los dos métodos y se aplica el que te sale más barato.</p>
              <div className="grid grid-cols-2 gap-3">
                <MethodBox title="Método objetivo" detail={`Valor del suelo × ${result.sale.municipalCapitalGain.coefficient.toLocaleString("es-ES")}`} base={result.sale.municipalCapitalGain.objectiveBase}
                  chosen={result.sale.municipalCapitalGain.chosenMethod === "OBJETIVO"} />
                <MethodBox title="Método real" detail="Ganancia × % de suelo" base={Math.max(result.sale.municipalCapitalGain.realLandGain, 0)}
                  chosen={result.sale.municipalCapitalGain.chosenMethod === "REAL"} />
              </div>
              <p className="mt-3 text-sm">
                {result.sale.municipalCapitalGain.isTaxable
                  ? <>Cuota: <strong>{eur(result.sale.municipalCapitalGain.tax)}</strong> al tipo del {pct(result.sale.municipalCapitalGain.rate)}.</>
                  : <>No hay incremento de valor: <strong>no se paga plusvalía municipal</strong>.</>}
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Ganancia patrimonial en el IRPF</h3>
              <LineTable rows={[
                ["Valor de venta menos gastos y plusvalía", result.sale.capitalGain.transmissionValue],
                ["Coste de compra, impuestos, gastos y mejoras", -(result.sale.capitalGain.acquisitionValue + result.sale.capitalGain.accumulatedAmortization)],
                ["Amortizaciones aplicadas (aumentan la ganancia)", result.sale.capitalGain.accumulatedAmortization],
                ["Ganancia patrimonial", result.sale.capitalGain.gain, "sub"],
                [`IRPF del ahorro (tipo medio ${pct(result.sale.capitalGain.effectiveRate, 1)})`, result.sale.capitalGain.tax, "total"],
              ]} />
            </div>
          </div>
        </Section>

        {/* Pagos a Hacienda */}
        <Section id="hacienda" title="Pagos a Hacienda" intro={`Qué impuestos pagas, a quién y cuándo. En ${result.province.name} el impuesto de la compra se ingresa en ${result.province.transferTaxAuthority}.`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-tinta text-left text-tinta-2">
                <th className="py-2 pr-3 font-medium">Cuándo</th><th className="py-2 pr-3 font-medium">Impuesto</th><Th>Importe</Th>
                <th className="py-2 pl-4 font-medium">A quién</th><th className="py-2 pl-3 font-medium">Modelo y plazo</th>
              </tr></thead>
              <tbody>{result.taxPayments.map((t, i) => (
                <tr key={i} className="border-b border-linea align-top">
                  <td className="py-3 pr-3 whitespace-nowrap text-tinta-2">{MOMENT_LABEL[t.moment]}</td>
                  <td className="py-3 pr-3">{t.concept}</td>
                  <Td className="py-3 font-medium">{eur(t.amount)}</Td>
                  <td className="py-3 pl-4">{t.authority}</td>
                  <td className="py-3 pl-3 text-tinta-2">{t.form}<span className="block text-xs text-tinta-3">{t.deadline}</span></td>
                </tr>))}</tbody>
            </table>
          </div>
        </Section>

        {/* Valoración */}
        {avm && (
          <Section id="valoracion" title="Precio frente al mercado" intro="Comparativa del precio de compra con el valor estimado de la zona.">
            {avm.isMock && <p className="mb-4 rounded-md border border-linea bg-papel-2 px-4 py-2 text-sm text-tinta-2">Valoración de prueba: todavía no está conectada a una fuente de datos de mercado. No la uses para decidir.</p>}
            <dl className="grid gap-6 sm:grid-cols-3">
              <Figure label="Precio de compra por m²" value={`${eur(avm.purchasePricePerM2)}/m²`} />
              <Figure label="Valor estimado por m²" value={`${eur(avm.pricePerM2)}/m²`} />
              <Figure label={avm.deviationPct <= 0 ? "Compras por debajo del valor estimado" : "Compras por encima del valor estimado"} value={pct(Math.abs(avm.deviationPct), 1)} />
            </dl>
          </Section>
        )}

        {/* Avisos */}
        {result.warnings.length > 0 && (
          <Section id="avisos" title="Antes de decidir, ten en cuenta" intro="Simplificaciones y datos que conviene confirmar con tu asesor.">
            <ul className="grid gap-2 text-sm text-tinta-2">
              {result.warnings.map((w, i) => <li key={i} className="border-l-2 border-linea pl-3">{w}</li>)}
            </ul>
            <p className="mt-4 text-xs text-tinta-3">Tablas fiscales versión {result.meta.taxTablesVersion}.</p>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="border-t border-linea py-10">
      <h2 id={`${id}-t`} className="text-xl font-semibold">{title}</h2>
      {intro && <p className="mt-1 mb-6 max-w-[70ch] text-sm text-tinta-2">{intro}</p>}
      {children}
    </section>
  );
}
function Kpi({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3.5">
      <dt className="text-sm"><span className="font-medium">{label}</span>{note && <span className="block text-xs text-tinta-3">{note}</span>}</dt>
      <dd className={cn("text-right font-semibold whitespace-nowrap", strong ? "text-2xl" : "text-lg")}>{value}</dd>
    </div>
  );
}
function Figure({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-sm text-tinta-2">{label}</dt><dd className="mt-1 text-2xl font-semibold">{value}</dd></div>;
}
const Th = ({ children }: { children: React.ReactNode }) => <th className="py-2 pl-3 text-right font-medium">{children}</th>;
const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={cn("py-2 pl-3 text-right whitespace-nowrap", className)}>{children}</td>;

function BreakdownTable({ rows, total }: { rows: [string, number][]; total: number }) {
  const visible = rows.filter(([, v]) => v > 0);
  return (
    <table className="w-full text-sm">
      <tbody>
        {visible.map(([label, v]) => (
          <tr key={label} className="border-b border-linea">
            <th scope="row" className="w-[45%] py-2.5 pr-4 text-left font-normal">{label}</th>
            <td className="hidden py-2.5 sm:table-cell" aria-hidden>
              <div className="h-2 rounded-[4px] bg-plano" style={{ width: `${Math.max((v / total) * 100, 0.8)}%` }} />
            </td>
            <td className="w-24 py-2.5 pl-3 text-right text-tinta-3">{pct(v / total, 1)}</td>
            <td className="w-32 py-2.5 pl-3 text-right font-medium">{eur(v)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-tinta">
          <th scope="row" className="py-3 text-left font-semibold">Inversión total</th><td className="hidden sm:table-cell" /><td />
          <td className="py-3 pl-3 text-right text-lg font-semibold">{eur(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function LineTable({ rows }: { rows: [string, number, ("sub" | "total")?][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>{rows.map(([label, v, kind], i) => (
        <tr key={i} className={cn(kind === "total" ? "border-t-2 border-tinta" : kind === "sub" ? "border-t border-tinta/40" : "border-t border-linea")}>
          <th scope="row" className={cn("py-2.5 pr-4 text-left", kind ? "font-semibold" : "font-normal")}>{label}</th>
          <td className={cn("py-2.5 text-right whitespace-nowrap", kind === "total" && "text-base font-semibold")}>{eur(v)}</td>
        </tr>))}</tbody>
    </table>
  );
}

function ExpenseLine({ label, annual, rent, strong }: { label: string; annual: number; rent: number; strong?: boolean }) {
  return (
    <tr className={cn(strong ? "border-t border-tinta/40" : "border-b border-linea")}>
      <th scope="row" className={cn("py-2 text-left", strong ? "font-semibold" : "font-normal")}>{label}</th>
      <Td className={strong ? "font-semibold" : ""}>{eur(annual / 12)}</Td>
      <Td className={strong ? "font-semibold" : ""}>{eur(annual)}</Td>
      <Td className={cn("text-tinta-3", strong && "font-semibold text-tinta")}>{pct(annual / rent, 1)}</Td>
    </tr>
  );
}

function MethodBox({ title, detail, base, chosen }: { title: string; detail: string; base: number; chosen: boolean }) {
  return (
    <div className={cn("rounded-md border p-4", chosen ? "border-parcela bg-parcela-claro" : "border-linea bg-white")}>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-tinta-3">{detail}</p>
      <p className="mt-2 text-lg font-semibold">{eur(base)}</p>
      <p className="text-xs">{chosen ? "Se aplica este" : "Base imponible"}</p>
    </div>
  );
}
