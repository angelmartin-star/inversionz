"use client";
/** Rentabilidad rápida: precio, renta, IBI, comunidad y basuras en una sola pantalla. */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { quickYield, type QuickYieldInput } from "@/lib/engine/quickYield";
import { eur, num, pct } from "@/lib/format";
import { Button, NumberField, TextField } from "@/components/ui/primitives";
import { ContactOptIn } from "@/components/leads/ContactOptIn";
import { notifyLead } from "@/lib/leads/notify";

const KEY = "inversionz:rapida";
const DRAFT_KEY = "inversionq:borrador";
const EMPTY: QuickYieldInput = { purchasePrice: undefined as unknown as number, monthlyRent: undefined as unknown as number, ibi: 0, community: 0, wasteTax: 0, postalCode: "" };

export function QuickYield() {
  const router = useRouter();
  const [q, setQ] = useState<QuickYieldInput>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { try { const r = localStorage.getItem(KEY); if (r) setQ({ ...EMPTY, ...JSON.parse(r) }); } catch { /* */ } setLoaded(true); }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* */ } }, [q, loaded]);
  const set = (p: Partial<QuickYieldInput>) => setQ((x) => ({ ...x, ...p }));
  const r = useMemo(() => quickYield(q), [q]);
  const summary = r ? { "Rentabilidad bruta": pct(r.grossYield), "Rentabilidad neta": pct(r.netYield), "Ingreso neto anual": eur(r.netAnnualIncome) } : undefined;

  // Aviso a BM cuando el usuario deja de tocar el formulario 20 s con un resultado válido
  useEffect(() => {
    if (!loaded || !r) return;
    const t = setTimeout(() => notifyLead("rentabilidad", q, summary), 20_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, loaded, r]);

  function fullAnalysis() {
    if (r) notifyLead("rentabilidad", q, summary);
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      const d = raw ? JSON.parse(raw) : {};
      d.property = { ...(d.property ?? {}), purchasePrice: q.purchasePrice, postalCode: q.postalCode || d.property?.postalCode || "" };
      d.rental = { ...(d.rental ?? {}), monthlyRent: q.monthlyRent,
        annualExpenses: { ...(d.rental?.annualExpenses ?? {}), ibi: q.ibi, community: q.community, wasteTax: q.wasteTax } };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch { /* */ }
    router.push("/analisis/nuevo");
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Rentabilidad rápida</h1>
      <p className="mt-2 max-w-[60ch] text-tinta-2">Cinco datos y tienes la rentabilidad bruta y neta de un piso en alquiler. Para hipoteca, IRPF y venta, usa el análisis completo.</p>

      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <NumberField label="Precio de compra" unit="€" decimals={0} value={q.purchasePrice} onChange={(v) => set({ purchasePrice: v as number })} />
          <NumberField label="Alquiler mensual" unit="€/mes" decimals={0} value={q.monthlyRent} onChange={(v) => set({ monthlyRent: v as number })} hint="Lo que pagará el inquilino cada mes" />
          <NumberField label="IBI" unit="€/año" decimals={0} value={q.ibi} onChange={(v) => set({ ibi: v ?? 0 })} />
          <NumberField label="Comunidad de vecinos" unit="€/año" decimals={0} value={q.community} onChange={(v) => set({ community: v ?? 0 })} hint="Cuota mensual × 12" />
          <NumberField label="Tasa de basuras" unit="€/año" decimals={0} value={q.wasteTax} onChange={(v) => set({ wasteTax: v ?? 0 })} />
          <TextField label="Código postal (opcional)" inputMode="numeric" maxLength={5} value={q.postalCode ?? ""} onChange={(v) => set({ postalCode: v.replace(/\D/g, "") })}
            hint={r?.provinceName ? `Sumamos el ITP de ${r.provinceName}` : "Para sumar el ITP de la provincia a la inversión"} />
          <ContactOptIn onSend={() => notifyLead("rentabilidad", q, summary, { force: true })} />
        </div>

        <section aria-live="polite" aria-labelledby="qr-t" className="md:sticky md:top-6 md:self-start">
          <h2 id="qr-t" className="sr-only">Resultado</h2>
          {r ? (
            <div className="rounded-md border border-tinta bg-white p-6">
              <dl>
                <div><dt className="text-sm text-tinta-2">Rentabilidad neta</dt><dd className="text-5xl font-semibold tracking-tight">{pct(r.netYield)}</dd></div>
                <div className="mt-2 text-sm text-tinta-2">Bruta {pct(r.grossYield)}</div>
              </dl>
              <table className="mt-6 w-full text-sm">
                <tbody>
                  <Row label="Alquiler anual" value={eur(r.annualRent)} />
                  <Row label="IBI, comunidad y basuras" value={`−${eur(r.annualExpenses)}`} />
                  <Row label="Ingreso neto anual" value={eur(r.netAnnualIncome)} strong />
                  <Row label="Al mes" value={eur(r.monthlyNet)} />
                  {r.transferTax !== null && <>
                    <Row label={`ITP en ${r.provinceName}`} value={eur(r.transferTax)} />
                    <Row label="Rentabilidad neta con el ITP" value={pct(r.netYieldWithTax)} strong />
                  </>}
                  {r.paybackYears && <Row label="Años para recuperar la compra" value={`${num(r.paybackYears)} años`} />}
                </tbody>
              </table>
              <Button className="mt-6 w-full" variant="bmVerde" onClick={fullAnalysis}>Hacer el análisis completo</Button>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-linea p-6 text-sm text-tinta-2">Indica el precio de compra y el alquiler mensual para ver la rentabilidad.</div>
          )}
          <p className="mt-3 text-xs text-tinta-3">No incluye seguros, mantenimiento, meses vacíos, hipoteca ni IRPF.</p>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className={strong ? "border-t border-tinta/40" : "border-t border-linea"}>
      <th scope="row" className={`py-2 text-left ${strong ? "font-semibold" : "font-normal"}`}>{label}</th>
      <td className={`py-2 text-right whitespace-nowrap ${strong ? "font-semibold" : ""}`}>{value}</td>
    </tr>
  );
}
