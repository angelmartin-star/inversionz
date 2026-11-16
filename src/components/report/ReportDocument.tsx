/**
 * Informe ejecutivo en PDF (React-PDF, se renderiza en servidor sin navegador).
 * Mismos datos que el dashboard: recibe InvestmentAnalysisResult del motor.
 * Gráficos dibujados con primitivas (View/Svg) para que el PDF sea vectorial y ligero.
 */
import path from "node:path";
import { Document, Font, Image, Page, Path, Rect, StyleSheet, Svg, Text, View, Line } from "@react-pdf/renderer";
import { BRAND } from "@/components/brand/lynx";
import type { InvestmentAnalysisResult, InvestmentInput, TaxPayment } from "@/types/investment";
import { buildLedgerRows } from "@/components/dashboard/Ledger";
import { eur, formatAddress, num, pct, placeLabel, signedEur } from "@/lib/format";
import { buildExpenseRows, sumRows } from "@/lib/expenses";

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");
const LOGO_DARK = path.join(process.cwd(), "src", "assets", "brand", "logo-horizontal-fondo-oscuro.png");
Font.register({
  family: "Plex",
  fonts: [
    { src: path.join(FONT_DIR, "ibm-plex-sans-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "ibm-plex-sans-latin-500-normal.woff"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "ibm-plex-sans-latin-600-normal.woff"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "ibm-plex-sans-latin-700-normal.woff"), fontWeight: 700 },
  ],
});
Font.register({ family: "Jakarta", src: path.join(FONT_DIR, "plus-jakarta-sans-latin-800-normal.woff"), fontWeight: 800 });
Font.registerHyphenationCallback((w) => [w]);

const C = { papel: "#f6f7f4", tinta: BRAND.primary, tinta2: "#4a566b", tinta3: "#6e7889", linea: "#d3d9d4", parcela: BRAND.accent, sello: "#b3261e", plano: "#3a6ea5", parcelaClaro: "#e3efe7" };

const s = StyleSheet.create({
  page: { fontFamily: "Plex", fontSize: 9, color: C.tinta, paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, lineHeight: 1.35 },
  band: { backgroundColor: C.tinta, color: "#fff", marginHorizontal: -40, marginTop: -36, paddingHorizontal: 40, paddingTop: 28, paddingBottom: 22, marginBottom: 20 },
  brand: { fontSize: 9, fontWeight: 600, color: "#c9d1de" },
  title: { fontSize: 19, fontWeight: 600, marginTop: 8, lineHeight: 1.2 },
  subtitle: { fontSize: 10, color: "#c9d1de", marginTop: 4 },
  h2: { fontSize: 12, fontWeight: 600, marginBottom: 3, marginTop: 4 },
  intro: { fontSize: 9, color: C.tinta2, marginBottom: 8 },
  section: { marginBottom: 16 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.linea, paddingVertical: 4.5, alignItems: "center" },
  rowTotal: { flexDirection: "row", borderTopWidth: 1.2, borderTopColor: C.tinta, paddingVertical: 5, alignItems: "center" },
  label: { flex: 1, paddingRight: 8 },
  value: { width: 80, textAlign: "right" },
  bold: { fontWeight: 600 },
  muted: { color: C.tinta3, fontSize: 7.5 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1.2, borderTopColor: C.tinta, marginBottom: 16 },
  kpi: { width: "33.33%", paddingVertical: 8, paddingRight: 10, borderBottomWidth: 0.5, borderBottomColor: C.linea },
  kpiValue: { fontSize: 15, fontWeight: 600, marginTop: 2 },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: C.tinta3 },
  th: { fontWeight: 600, color: C.tinta2 },
  note: { borderLeftWidth: 2, borderLeftColor: C.linea, paddingLeft: 6, marginBottom: 4, color: C.tinta2, fontSize: 8 },
});

const MOMENT: Record<TaxPayment["moment"], string> = { COMPRA: "Al comprar", ANUAL: "Cada año", VENTA: "Al vender" };
const CONDITION = { A_REFORMAR: "a reformar", BUEN_ESTADO: "en buen estado", OBRA_NUEVA: "obra nueva" } as const;

function Footer({ date }: { date: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>InversionZ. Informe de inversión inmobiliaria, {date}</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

function LedgerPdf({ input, result }: { input: InvestmentInput; result: InvestmentAnalysisResult }) {
  const rows = buildLedgerRows(input, result);
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const W = 170;
  let running = 0;
  return (
    <View>
      {rows.map((row, i) => {
        const start = row.kind === "total" ? 0 : running;
        const end = row.kind === "total" ? row.value : running + row.value;
        if (row.kind !== "total") running = end;
        const x = (Math.max(Math.min(start, end), 0) / max) * W;
        const w = Math.max((Math.abs(end - start) / max) * W, 1);
        const color = row.kind === "in" ? C.parcela : row.kind === "out" ? C.sello : row.value < 0 ? C.sello : C.tinta;
        return (
          <View key={i} style={row.kind === "total" ? s.rowTotal : s.row} wrap={false}>
            <View style={s.label}>
              <Text style={row.kind === "total" ? s.bold : undefined}>{row.label}</Text>
              {row.detail ? <Text style={s.muted}>{row.detail}</Text> : null}
            </View>
            <Svg width={W} height={10}><Rect x={x} y={1} width={Math.min(w, W - x)} height={8} fill={color} rx={2} /></Svg>
            <Text style={[s.value, row.kind === "total" ? s.bold : {}, { color: row.kind === "out" ? C.sello : row.kind === "in" ? C.parcela : C.tinta }]}>
              {row.kind === "total" ? eur(row.value) : signedEur(row.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function CashflowBars({ result }: { result: InvestmentAnalysisResult }) {
  const data = result.projection.map((p) => p.cashflowAfterTax);
  const W = 515, H = 130, pad = 22;
  const maxAbs = Math.max(...data.map(Math.abs), 1);
  const hasNeg = data.some((d) => d < 0);
  const zeroY = hasNeg ? pad + (H - 2 * pad) / 2 : H - pad;
  const scale = (hasNeg ? (H - 2 * pad) / 2 : H - 2 * pad) / maxAbs;
  const slot = W / data.length;
  const bw = Math.min(slot * 0.6, 28);
  return (
    <Svg width={W} height={H + 12}>
      <Line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke={C.tinta} strokeWidth={0.8} />
      {data.map((d, i) => {
        const h = Math.abs(d) * scale;
        const x = i * slot + (slot - bw) / 2;
        return <Rect key={i} x={x} y={d >= 0 ? zeroY - h : zeroY} width={bw} height={Math.max(h, 0.5)} fill={d >= 0 ? C.plano : C.sello} />;
      })}
      {data.map((d, i) => {
        const h = Math.abs(d) * scale;
        return (
          <Text key={`v${i}`} x={i * slot + slot / 2} y={d >= 0 ? zeroY - h - 3 : zeroY + h + 8} style={{ fontSize: 6.5, fill: C.tinta2 } as never} textAnchor="middle">{eur(d)}</Text>
        );
      })}
      {data.map((d, i) => (
        <Text key={`t${i}`} x={i * slot + slot / 2} y={H + 10} style={{ fontSize: 6.5, fill: C.tinta3 } as never} textAnchor="middle">{`Año ${i + 1}`}</Text>
      ))}
    </Svg>
  );
}

function Lines({ rows }: { rows: [string, number, ("sub" | "total")?][] }) {
  return (
    <View>
      {rows.map(([l, v, k], i) => (
        <View key={i} style={k === "total" ? s.rowTotal : s.row} wrap={false}>
          <Text style={[s.label, k ? s.bold : {}]}>{l}</Text>
          <Text style={[s.value, k ? s.bold : {}]}>{eur(v)}</Text>
        </View>
      ))}
    </View>
  );
}

export function ReportDocument({ input, result }: { input: InvestmentInput; result: InvestmentAnalysisResult }) {
  const k = result.kpis;
  const p = input.property;
  const N = input.sale.yearsUntilSale;
  const date = new Date(result.meta.generatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const iiv = result.sale.municipalCapitalGain;
  const cg = result.sale.capitalGain;
  const inv = result.investmentBreakdown;
  const expRows = buildExpenseRows(input, result);
  const expTotal = sumRows(expRows);
  const expFixed = sumRows(expRows, "fijo");
  const rent1 = result.projection[0].effectiveRent || 1;

  return (
    <Document title={`Informe InversionZ — ${p.postalCode}`} author="InversionZ" language="es">
      {/* Página 1: resumen */}
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Image src={LOGO_DARK} style={{ width: 108, height: 36, marginLeft: -4 }} />
            <Text style={s.brand}>Informe de viabilidad, {date}</Text>
          </View>
          <Text style={s.title}>Piso de {num(p.surfaceM2)} m² {CONDITION[p.condition]} en {placeLabel(p.municipality, result.province.name)} por {eur(p.purchasePrice)}</Text>
          {p.address?.street ? <Text style={s.subtitle}>{formatAddress(p.address)}. {p.postalCode} {placeLabel(p.municipality, result.province.name)}</Text> : null}
          {p.cadastre?.refCat ? <Text style={s.subtitle}>Referencia catastral {p.cadastre.refCat}{p.cadastre.use ? `. Uso ${p.cadastre.use.toLowerCase()}` : ""}{p.cadastre.yearBuilt ? `, construido en ${p.cadastre.yearBuilt}` : ""}.</Text> : null}
          <Text style={s.subtitle}>Alquiler a {eur(input.rental.monthlyRent)} al mes. {k.loanAmount > 0 ? `Hipoteca de ${eur(k.loanAmount)}` : "Compra al contado"}. Venta prevista en {N} {N === 1 ? "año" : "años"}.</Text>
        </View>

        <View style={s.kpiGrid}>
          {([
            ["Inversión total", eur(k.totalInvestment)], ["Capital propio aportado", eur(k.equityRequired)], ["Cashflow neto mensual", eur(k.cashflowMonthlyAfterTax)],
            ["Rentabilidad bruta", pct(k.grossYieldOnPrice)], ["Rentabilidad neta tras impuestos", pct(k.netYieldAfterTax)], ["ROCE", pct(k.roce)],
            ["Rentabilidad neta antes de impuestos", pct(k.netYieldBeforeTax)], [`TIR a ${N} años con venta`, pct(k.irr)], ["Neto recibido en la venta", eur(result.sale.netProceeds)],
          ] as [string, string][]).map(([l, v]) => (
            <View key={l} style={s.kpi}><Text style={s.muted}>{l}</Text><Text style={s.kpiValue}>{v}</Text></View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.h2}>La cuenta del primer año</Text>
          <Text style={s.intro}>De lo que paga el inquilino a lo que queda tras gastos, hipoteca e impuestos.</Text>
          <LedgerPdf input={input} result={result} />
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.h2}>Inversión inicial</Text>
          <Lines rows={[
            ["Precio de compra", inv.precioCompra],
            [result.acquisitionTaxes.regime === "ITP" ? `ITP (${pct(result.acquisitionTaxes.effectiveRate)} efectivo)` : result.acquisitionTaxes.breakdown, inv.impuestosCompra],
            ["Notaría, registro, gestoría y honorarios", inv.gastosCierre],
            ["Reforma", inv.reforma], ["Mobiliario", inv.mobiliario],
            ...(inv.comisionApertura > 0 ? [["Comisión de apertura", inv.comisionApertura] as [string, number]] : []),
            ["Inversión total", k.totalInvestment, "total"],
          ]} />
        </View>
        <Footer date={date} />
      </Page>

      {/* Página 2: rentabilidad del inmueble, explotación y fiscalidad anual */}
      <Page size="A4" style={s.page}>
        <View style={s.section} wrap={false}>
          <Text style={s.h2}>Rentabilidad del inmueble</Text>
          <Text style={s.intro}>Gastos anuales del primer año: {eur(expTotal)}, el {pct(expTotal / rent1, 1)} de la renta cobrada. Rentabilidad bruta {pct(k.grossYieldOnPrice)}, neta antes de impuestos {pct(k.netYieldBeforeTax)}.</Text>
          <View style={[s.row, { borderBottomColor: C.tinta }]}>
            <Text style={[s.th, { flex: 1 }]}>Gasto</Text>
            <Text style={[s.th, { width: 70, textAlign: "right" }]}>Al mes</Text>
            <Text style={[s.th, { width: 80, textAlign: "right" }]}>Al año</Text>
            <Text style={[s.th, { width: 70, textAlign: "right" }]}>% renta</Text>
          </View>
          {expRows.map((r, i) => {
            const isSubtotal = r.group === "otro" && i > 0 && expRows[i - 1].group === "fijo";
            return (
              <View key={r.label}>
                {isSubtotal ? (
                  <View style={[s.row, { borderTopWidth: 0.8, borderTopColor: C.tinta2 }]}>
                    <Text style={[s.bold, { flex: 1 }]}>Total gastos fijos</Text>
                    <Text style={[s.bold, { width: 70, textAlign: "right" }]}>{eur(expFixed / 12)}</Text>
                    <Text style={[s.bold, { width: 80, textAlign: "right" }]}>{eur(expFixed)}</Text>
                    <Text style={[s.bold, { width: 70, textAlign: "right" }]}>{pct(expFixed / rent1, 1)}</Text>
                  </View>
                ) : null}
                <View style={s.row}>
                  <Text style={{ flex: 1 }}>{r.label}</Text>
                  <Text style={{ width: 70, textAlign: "right" }}>{eur(r.annual / 12)}</Text>
                  <Text style={{ width: 80, textAlign: "right" }}>{eur(r.annual)}</Text>
                  <Text style={{ width: 70, textAlign: "right", color: C.tinta3 }}>{pct(r.annual / rent1, 1)}</Text>
                </View>
              </View>
            );
          })}
          <View style={s.rowTotal}>
            <Text style={[s.bold, { flex: 1 }]}>Total gastos del inmueble</Text>
            <Text style={[s.bold, { width: 70, textAlign: "right" }]}>{eur(expTotal / 12)}</Text>
            <Text style={[s.bold, { width: 80, textAlign: "right" }]}>{eur(expTotal)}</Text>
            <Text style={[s.bold, { width: 70, textAlign: "right" }]}>{pct(expTotal / rent1, 1)}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Cashflow neto año a año</Text>
          <Text style={s.intro}>Después de gastos, cuota de la hipoteca e IRPF. Sin incluir la venta.</Text>
          <CashflowBars result={result} />
        </View>

        <View style={s.section}>
          <View style={[s.row, { borderBottomColor: C.tinta }]}>
            {["Año", "Renta cobrada", "Gastos", "Cuota hipoteca", "IRPF", "Cashflow neto", "Deuda pendiente"].map((h, i) => (
              <Text key={h} style={[s.th, i === 0 ? { width: 30 } : { flex: 1, textAlign: "right" }]}>{h}</Text>
            ))}
          </View>
          {result.projection.map((y) => (
            <View key={y.year} style={s.row} wrap={false}>
              <Text style={{ width: 30 }}>{y.year}</Text>
              {[y.effectiveRent, y.operatingExpenses, y.debtService, y.irpf, y.cashflowAfterTax, y.mortgageBalance].map((v, i) => (
                <Text key={i} style={{ flex: 1, textAlign: "right", color: i === 4 && v < 0 ? C.sello : C.tinta }}>{eur(v)}</Text>
              ))}
            </View>
          ))}
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.h2}>IRPF del alquiler, primer año</Text>
          <Text style={s.intro}>Rendimientos del capital inmobiliario. Tipo marginal resultante: {pct(result.irpfYear1.marginalTaxRate, 1)}.</Text>
          <Lines rows={[
            ["Ingresos íntegros", result.irpfYear1.grossIncome],
            ["IBI, comunidad, seguros y otros gastos", -result.irpfYear1.deductibleExpensesUnlimited],
            ["Intereses y reparaciones (límite: ingresos)", -result.irpfYear1.limitedExpensesDeducted],
            ["Amortización del inmueble (3 %)", -result.irpfYear1.amortizationBuilding],
            ["Amortización del mobiliario (10 %)", -result.irpfYear1.amortizationFurniture],
            ["Rendimiento neto", result.irpfYear1.netIncome, "sub"],
            [`Reducción por alquiler de vivienda (${pct(result.irpfYear1.reductionRate, 0)})`, -(result.irpfYear1.netIncome - result.irpfYear1.reducedNetIncome)],
            ["Rendimiento neto reducido", result.irpfYear1.reducedNetIncome, "sub"],
            ["Cuota IRPF atribuible al alquiler", result.irpfYear1.taxDue, "total"],
          ]} />
        </View>
        <Footer date={date} />
      </Page>

      {/* Página 3: venta y pagos a Hacienda */}
      <Page size="A4" style={s.page}>
        <View style={s.section} wrap={false}>
          <Text style={s.h2}>Venta en el año {N}</Text>
          <Text style={s.intro}>Precio de venta {eur(result.sale.salePrice)}. Gastos de venta {eur(result.sale.saleCosts)}. Hipoteca pendiente {eur(result.sale.outstandingMortgage)}.</Text>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.bold, { marginBottom: 4 }]}>Plusvalía municipal (IIVTNU)</Text>
              <View style={s.row}><Text style={s.label}>Método objetivo (suelo × {iiv.coefficient.toLocaleString("es-ES")}){iiv.chosenMethod === "OBJETIVO" ? " (aplicado)" : ""}</Text><Text style={s.value}>{eur(iiv.objectiveBase)}</Text></View>
              <View style={s.row}><Text style={s.label}>Método real (ganancia × % suelo){iiv.chosenMethod === "REAL" ? " (aplicado)" : ""}</Text><Text style={s.value}>{eur(Math.max(iiv.realLandGain, 0))}</Text></View>
              <View style={s.rowTotal}><Text style={[s.label, s.bold]}>{iiv.isTaxable ? `Cuota al ${pct(iiv.rate)}` : "No sujeto: no hay incremento de valor"}</Text><Text style={[s.value, s.bold]}>{eur(iiv.tax)}</Text></View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.bold, { marginBottom: 4 }]}>Ganancia patrimonial (IRPF del ahorro)</Text>
              <Text style={[s.muted, { marginBottom: 4 }]}>{input.sale.sellerHabitualResidence ? "Vivienda habitual del vendedor." : "Vivienda no habitual del vendedor."}</Text>
              <Lines rows={[
                ["Valor de transmisión", cg.transmissionValue],
                ["Valor de adquisición (con mejoras)", -(cg.acquisitionValue + cg.accumulatedAmortization)],
                ["Amortizaciones aplicadas", cg.accumulatedAmortization],
                ["Ganancia patrimonial", cg.gain, "sub"],
                ...(cg.exemption !== "NINGUNA" ? [
                  [cg.exemption === "MAYOR_65_VIVIENDA_HABITUAL" ? "Exención vivienda habitual (mayor de 65)" : "Exención por reinversión", -cg.exemptGain] as [string, number],
                  ["Ganancia que tributa", cg.taxableGain, "sub"] as [string, number, "sub"],
                ] : []),
                [`IRPF (tipo medio ${pct(cg.effectiveRate, 1)})`, cg.tax, "total"],
              ]} />
            </View>
          </View>
          <View style={[s.rowTotal, { marginTop: 10 }]}>
            <Text style={[s.label, s.bold]}>Neto recibido tras impuestos, gastos y cancelación de la hipoteca</Text>
            <Text style={[s.value, s.bold, { fontSize: 11 }]}>{eur(result.sale.netProceeds)}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Pagos a Hacienda</Text>
          <Text style={s.intro}>En {result.province.name} el impuesto de la compra se ingresa en {result.province.transferTaxAuthority}.</Text>
          <View style={[s.row, { borderBottomColor: C.tinta }]}>
            <Text style={[s.th, { width: 58 }]}>Cuándo</Text><Text style={[s.th, { flex: 1.6 }]}>Impuesto</Text>
            <Text style={[s.th, { width: 62, textAlign: "right" }]}>Importe</Text><Text style={[s.th, { flex: 1.4, paddingLeft: 10 }]}>A quién, modelo y plazo</Text>
          </View>
          {result.taxPayments.map((t, i) => (
            <View key={i} style={[s.row, { alignItems: "flex-start" }]} wrap={false}>
              <Text style={{ width: 58, color: C.tinta2 }}>{MOMENT[t.moment]}</Text>
              <Text style={{ flex: 1.6, paddingRight: 6 }}>{t.concept}</Text>
              <Text style={{ width: 62, textAlign: "right", fontWeight: 600 }}>{eur(t.amount)}</Text>
              <View style={{ flex: 1.4, paddingLeft: 10 }}>
                <Text>{t.authority}</Text>
                <Text style={s.muted}>{t.form}. {t.deadline}</Text>
              </View>
            </View>
          ))}
        </View>

        {result.warnings.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.h2}>Avisos y simplificaciones</Text>
            {result.warnings.map((w, i) => <Text key={i} style={s.note}>{w}</Text>)}
          </View>
        )}
        <Text style={[s.muted, { marginTop: 6 }]}>
          Cálculo orientativo elaborado con las tablas fiscales versión {result.meta.taxTablesVersion} (régimen común). No constituye asesoramiento fiscal ni financiero; contrasta las cifras con tu asesor antes de decidir.
        </Text>
        <Footer date={date} />
      </Page>
    </Document>
  );
}
