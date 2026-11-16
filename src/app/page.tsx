import Link from "next/link";
import { runInvestmentAnalysis } from "@/lib/engine/calculationEngine";
import { EXAMPLE_INPUT } from "@/lib/defaults";
import { Ledger } from "@/components/dashboard/Ledger";
import { LynxMark } from "@/components/brand/Logo";
import { buttonVariants } from "@/lib/ui";
import { eur, pct } from "@/lib/format";

const TOOLS = [
  {
    href: "/analisis/nuevo", title: "Análisis de inversión", cta: "Hacer un análisis", color: "bmAzul" as const,
    text: "El estudio completo: impuestos de compra de la provincia, hipoteca, gastos, IRPF del alquiler año a año, venta con plusvalías e informe en PDF.",
    asks: "inmueble, compra, hipoteca, alquiler y venta",
  },
  {
    href: "/valoracion", title: "Valoración", cta: "Valorar un inmueble", color: "bmCeleste" as const,
    text: "Cuánto vale con anuncios comparables de Idealista, Fotocasa y pisos.com, ajustados por la demanda de cada portal y un 10 % de negociación.",
    asks: "superficie y de 3 a 5 testigos por portal",
  },
  {
    href: "/rentabilidad", title: "Rentabilidad rápida", cta: "Calcular en un minuto", color: "bmVerde" as const,
    text: "La rentabilidad bruta y neta de un piso en alquiler, con el ITP de la provincia si indicas el código postal.",
    asks: "precio, alquiler, IBI, comunidad y basuras",
  },
];

export default function Home() {
  const example = runInvestmentAnalysis(EXAMPLE_INPUT);
  return (
    <>
      <section className="reticula border-b border-linea">
        <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 lg:pt-20">
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h1 className="max-w-[22ch] text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
                Lo que vale un piso y lo que te deja, con los impuestos de su provincia.
              </h1>
              <p className="mt-5 max-w-[56ch] text-lg text-tinta-2">Tres herramientas para invertir en vivienda en España. Empieza por la que necesites.</p>
            </div>
            <div className="hidden justify-self-center md:block md:pr-8 lg:pr-16">
              <LynxMark size={300} />
            </div>
          </div>

          <ol className="mt-10 grid gap-px overflow-hidden rounded-md border border-linea bg-linea md:grid-cols-3">
            {TOOLS.map((t) => (
              <li key={t.href} className="flex flex-col bg-white p-6">
                <h2 className="text-xl font-semibold">{t.title}</h2>
                <p className="mt-2 text-[15px] text-tinta-2">{t.text}</p>
                <p className="mt-4 text-sm text-tinta-3">Necesitas: {t.asks}.</p>
                <div className="mt-auto pt-6">
                  <Link href={t.href} className={buttonVariants({ variant: t.color, size: "lg" })}>{t.cta}</Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-start gap-12 px-5 py-16 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Lo que una hoja de cálculo suele hacer mal</h2>
          <dl className="mt-6 grid gap-6">
            <div>
              <dt className="font-semibold">El impuesto de compra de cada provincia</dt>
              <dd className="mt-1 text-tinta-2">ITP por tramos de cada comunidad, IVA y AJD en obra nueva, valor de referencia de Catastro y la Hacienda donde se paga, incluidas las diputaciones forales.</dd>
            </div>
            <div>
              <dt className="font-semibold">El IRPF del alquiler, año a año</dt>
              <dd className="mt-1 text-tinta-2">Amortización del 3 % sin el suelo, límite de intereses y reparaciones con arrastre a cuatro años y reducción del 50 al 90 % según la Ley de Vivienda.</dd>
            </div>
            <div>
              <dt className="font-semibold">La venta, con sus dos plusvalías</dt>
              <dd className="mt-1 text-tinta-2">Plusvalía municipal por el método más barato y ganancia patrimonial, con las exenciones por vivienda habitual.</dd>
            </div>
          </dl>
        </div>
        <figure className="rounded-md border border-linea bg-white p-6">
          <figcaption className="mb-4">
            <span className="block font-semibold">Ejemplo del análisis: piso a reformar en Madrid por {eur(EXAMPLE_INPUT.property.purchasePrice)}</span>
            <span className="text-sm text-tinta-3">Hipoteca del 80 %, alquiler de {eur(EXAMPLE_INPUT.rental.monthlyRent)} al mes. Primer año.</span>
          </figcaption>
          <Ledger input={EXAMPLE_INPUT} result={example} />
          <p className="mt-4 text-sm text-tinta-2">
            Rentabilidad neta tras impuestos {pct(example.kpis.netYieldAfterTax)}. TIR a 10 años con la venta {pct(example.kpis.irr)}.
          </p>
        </figure>
      </section>
    </>
  );
}
