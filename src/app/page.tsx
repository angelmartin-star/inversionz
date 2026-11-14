import Link from "next/link";
import { runInvestmentAnalysis } from "@/lib/engine/calculationEngine";
import { EXAMPLE_INPUT } from "@/lib/defaults";
import { Ledger } from "@/components/dashboard/Ledger";
import { buttonVariants } from "@/lib/ui";
import { eur, pct } from "@/lib/format";

export default function Home() {
  const example = runInvestmentAnalysis(EXAMPLE_INPUT);
  return (
    <>
      <section className="reticula border-b border-linea">
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-5 py-16 lg:grid-cols-[1fr_1.1fr] lg:py-24">
          <div className="lg:pt-6">
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
              Lo que de verdad te deja un piso, con los impuestos de su provincia.
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg text-tinta-2">
              Introduce precio, gastos, hipoteca y alquiler. InversionQ calcula el ITP o el IVA de la compra, el IRPF de cada año
              y la plusvalía al vender, y te da un informe en PDF para tu banco o tus socios.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/analisis/nuevo" className={buttonVariants({ size: "lg" })}>Analizar un inmueble</Link>
            </div>
          </div>
          <figure className="rounded-md border border-linea bg-white p-6 shadow-[0_1px_0_#d3d9d4]">
            <figcaption className="mb-4">
              <span className="block font-semibold">Ejemplo: piso a reformar en Madrid por {eur(EXAMPLE_INPUT.property.purchasePrice)}</span>
              <span className="text-sm text-tinta-3">Hipoteca del 80 %, alquiler de {eur(EXAMPLE_INPUT.rental.monthlyRent)} al mes. Primer año.</span>
            </figcaption>
            <Ledger input={EXAMPLE_INPUT} result={example} />
            <p className="mt-4 text-sm text-tinta-2">
              Rentabilidad neta tras impuestos {pct(example.kpis.netYieldAfterTax)}. TIR a 10 años con la venta {pct(example.kpis.irr)}.
            </p>
          </figure>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Lo que una hoja de cálculo suele hacer mal</h2>
        <dl className="mt-8 grid gap-10 md:grid-cols-3">
          <div>
            <dt className="font-semibold">El impuesto de compra de cada provincia</dt>
            <dd className="mt-2 text-tinta-2">ITP por tramos de cada comunidad, IVA y AJD en obra nueva, valor de referencia de Catastro y la Hacienda donde se paga, incluidas las diputaciones forales.</dd>
          </div>
          <div>
            <dt className="font-semibold">El IRPF del alquiler, año a año</dt>
            <dd className="mt-2 text-tinta-2">Amortización del 3 % sin el suelo, límite de intereses y reparaciones con arrastre a cuatro años y reducción del 50 al 90 % según la Ley de Vivienda.</dd>
          </div>
          <div>
            <dt className="font-semibold">La venta, con sus dos plusvalías</dt>
            <dd className="mt-2 text-tinta-2">Plusvalía municipal por el método más barato y ganancia patrimonial en la base del ahorro, restando las amortizaciones que hayas aplicado.</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
