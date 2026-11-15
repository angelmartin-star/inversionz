"use client";
/**
 * Valoración por testigos de Idealista, Fotocasa y pisos.com.
 * El usuario copia 3-5 anuncios comparables de cada portal; el resultado se recalcula al momento.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Comparable, DemandLevel, Portal, ValuationInput } from "@/types/valuation";
import { PORTALS, PORTAL_LABEL } from "@/types/valuation";
import type { PropertyCondition } from "@/types/investment";
import { DEFAULT_VALUATION_SETTINGS, runValuation } from "@/lib/valuation/valuationEngine";
import { getProvinceFromPostalCode } from "@/lib/tax/provinces";
import { eur, formatInputNumber, num, parseNumberEs, pct, placeLabel } from "@/lib/format";
import { Button, NumberField, Segmented, TextField, cn } from "@/components/ui/primitives";

const KEY = "inversionz:valoracion";
const DRAFT_KEY = "inversionq:borrador";
let seq = 0;
const newId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;
const emptyRow = (portal: Portal): Comparable => ({ id: newId(), portal, askingPrice: 0, areaM2: 0, url: "" });

const PORTAL_HOME: Record<Portal, string> = {
  IDEALISTA: "https://www.idealista.com",
  FOTOCASA: "https://www.fotocasa.es",
  PISOSCOM: "https://www.pisos.com",
};

function initial(): ValuationInput {
  return {
    subject: { address: { street: "", number: "", floor: "", door: "" }, postalCode: "", municipality: "", areaM2: undefined as unknown as number, rooms: undefined, bathrooms: undefined, condition: "BUEN_ESTADO" },
    comparables: PORTALS.flatMap((p) => [emptyRow(p), emptyRow(p), emptyRow(p)]),
    demand: { IDEALISTA: "MEDIA", FOTOCASA: "MEDIA", PISOSCOM: "MEDIA" },
    settings: DEFAULT_VALUATION_SETTINGS,
  };
}

/** Ejemplo con testigos ficticios para ver cómo funciona */
function example(): ValuationInput {
  const rows: [Portal, number, number][] = [
    ["IDEALISTA", 289_000, 72], ["IDEALISTA", 315_000, 78], ["IDEALISTA", 268_000, 66], ["IDEALISTA", 299_000, 70],
    ["FOTOCASA", 275_000, 71], ["FOTOCASA", 259_000, 68], ["FOTOCASA", 305_000, 80],
    ["PISOSCOM", 282_000, 74], ["PISOSCOM", 265_000, 69], ["PISOSCOM", 296_000, 76],
  ];
  return {
    subject: { address: { street: "Calle de Embajadores", number: "120", floor: "3", door: "B" }, postalCode: "28045", municipality: "Madrid", areaM2: 70, rooms: 2, bathrooms: 1, condition: "BUEN_ESTADO" },
    comparables: rows.map(([portal, askingPrice, areaM2]) => ({ id: newId(), portal, askingPrice, areaM2, url: "" })),
    demand: { IDEALISTA: "ALTA", FOTOCASA: "MEDIA", PISOSCOM: "MEDIA" },
    settings: DEFAULT_VALUATION_SETTINGS,
  };
}

export function ValuationTool() {
  const router = useRouter();
  const [v, setV] = useState<ValuationInput>(initial);
  const [loaded, setLoaded] = useState(false);
  const [isExample, setIsExample] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setV({ ...initial(), ...JSON.parse(raw) }); } catch { /* */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* */ } }, [v, loaded]);

  const s = v.subject;
  const province = getProvinceFromPostalCode(s.postalCode ?? "");
  const result = useMemo(() => {
    if (!(s.areaM2 > 0)) return null;
    try { return runValuation(v); } catch { return null; }
  }, [v, s.areaM2]);

  const setSubject = (patch: Partial<ValuationInput["subject"]>) => { setIsExample(false); setV((x) => ({ ...x, subject: { ...x.subject, ...patch } })); };
  const setAddr = (patch: Partial<NonNullable<ValuationInput["subject"]["address"]>>) =>
    setSubject({ address: { street: "", number: "", ...s.address, ...patch } });
  const setRow = (id: string, patch: Partial<Comparable>) => { setIsExample(false); setV((x) => ({ ...x, comparables: x.comparables.map((c) => (c.id === id ? { ...c, ...patch } : c)) })); };
  const addRow = (portal: Portal) => setV((x) => ({ ...x, comparables: [...x.comparables, emptyRow(portal)] }));
  const removeRow = (id: string) => setV((x) => ({ ...x, comparables: x.comparables.filter((c) => c.id !== id) }));
  const setDemand = (portal: Portal, level: DemandLevel) => setV((x) => ({ ...x, demand: { ...x.demand, [portal]: level } }));
  const setSettings = (patch: Partial<ValuationInput["settings"]>) => setV((x) => ({ ...x, settings: { ...x.settings, ...patch } }));

  function analyzeInvestment() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      const d = raw ? JSON.parse(raw) : {};
      d.property = { ...(d.property ?? {}), address: s.address, postalCode: s.postalCode, municipality: s.municipality,
        surfaceM2: s.areaM2, condition: s.condition ?? "BUEN_ESTADO",
        purchasePrice: d.property?.purchasePrice ?? (result?.estimatedValue ? Math.round(result.estimatedValue / 1000) * 1000 : undefined) };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch { /* */ }
    router.push("/analisis/nuevo");
  }

  const minArea = s.areaM2 > 0 ? Math.round(s.areaM2 * 0.8) : null;
  const maxArea = s.areaM2 > 0 ? Math.round(s.areaM2 * 1.2) : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Valoración de un inmueble</h1>
          <p className="mt-2 max-w-[64ch] text-tinta-2">
            Con anuncios comparables de Idealista, Fotocasa y pisos.com. Ajustamos cada portal por la demanda de la zona,
            restamos un {pct(v.settings.listingDiscount, 0)} de margen de negociación sobre el precio publicado y hacemos la media de los tres.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setV(example()); setIsExample(true); }}>Rellenar con un ejemplo</Button>
          <Button variant="ghost" size="sm" onClick={() => { setV(initial()); setIsExample(false); }}>Vaciar</Button>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {/* Inmueble */}
          <section aria-labelledby="inm-t">
            <h2 id="inm-t" className="text-lg font-semibold">El inmueble</h2>
            <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <TextField label="Calle" className="sm:col-span-2" placeholder="Calle de Embajadores" value={s.address?.street ?? ""} onChange={(x) => setAddr({ street: x })} />
              <div className="grid grid-cols-3 gap-4 sm:col-span-2">
                <TextField label="Número" value={s.address?.number ?? ""} maxLength={10} onChange={(x) => setAddr({ number: x })} />
                <TextField label="Piso" value={s.address?.floor ?? ""} maxLength={20} onChange={(x) => setAddr({ floor: x })} />
                <TextField label="Puerta" value={s.address?.door ?? ""} maxLength={20} onChange={(x) => setAddr({ door: x })} />
              </div>
              <TextField label="Código postal" inputMode="numeric" maxLength={5} value={s.postalCode} onChange={(x) => setSubject({ postalCode: x.replace(/\D/g, "") })}
                hint={province ? `${province.name}, ${province.ccaaName}` : undefined} />
              <TextField label="Municipio" value={s.municipality ?? ""} onChange={(x) => setSubject({ municipality: x })} />
              <NumberField label="Superficie construida" unit="m²" decimals={0} value={s.areaM2} onChange={(x) => setSubject({ areaM2: x as number })} />
              <div className="grid grid-cols-2 gap-4">
                <NumberField label="Habitaciones" decimals={0} value={s.rooms} onChange={(x) => setSubject({ rooms: x })} />
                <NumberField label="Baños" decimals={0} value={s.bathrooms} onChange={(x) => setSubject({ bathrooms: x })} />
              </div>
              <div className="sm:col-span-2">
                <Segmented<PropertyCondition> label="Estado" value={s.condition ?? "BUEN_ESTADO"} onChange={(x) => setSubject({ condition: x })}
                  options={[{ value: "A_REFORMAR", label: "A reformar" }, { value: "BUEN_ESTADO", label: "Buen estado" }, { value: "OBRA_NUEVA", label: "Obra nueva" }]} />
              </div>
            </div>
          </section>

          {/* Cómo buscar testigos */}
          <aside className="mt-8 rounded-md border-l-4 border-plano bg-plano-claro/60 px-5 py-4 text-sm">
            <p className="font-semibold">Cómo elegir los testigos</p>
            <p className="mt-1 text-tinta-2">
              En cada portal, busca viviendas en venta {s.postalCode ? `en el ${s.postalCode}` : "en la misma zona"}
              {minArea ? ` de ${minArea} a ${maxArea} m²` : ""}, en estado parecido y, si puede ser, con la misma planta y ascensor.
              Copia aquí el precio y los metros de 3 a 5 anuncios por portal.
            </p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {PORTALS.map((p) => <a key={p} href={PORTAL_HOME[p]} target="_blank" rel="noreferrer" className="font-medium text-plano underline-offset-2 hover:underline">Abrir {PORTAL_LABEL[p]}</a>)}
            </p>
          </aside>

          {/* Testigos por portal */}
          {PORTALS.map((portal) => {
            const rows = v.comparables.filter((c) => c.portal === portal);
            const pv = result?.byPortal.find((x) => x.portal === portal);
            return (
              <section key={portal} aria-labelledby={`p-${portal}`} className="mt-10 border-t border-linea pt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 id={`p-${portal}`} className="text-lg font-semibold">{PORTAL_LABEL[portal]}</h2>
                  <p className="text-sm text-tinta-2">
                    {pv?.meanAskingPriceM2 ? <>Media publicada <strong className="text-tinta">{eur(pv.meanAskingPriceM2)}/m²</strong> con {pv.count} testigo{pv.count === 1 ? "" : "s"}</> : "Sin testigos todavía"}
                  </p>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead><tr className="text-left text-xs text-tinta-2">
                      <th className="w-[28%] pb-2 font-medium">Precio publicado</th><th className="w-[16%] pb-2 font-medium">m²</th>
                      <th className="pb-2 font-medium">Enlace al anuncio (opcional)</th><th className="w-[14%] pb-2 text-right font-medium">€/m²</th><th className="w-10 pb-2" />
                    </tr></thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const pm2 = r.askingPrice > 0 && r.areaM2 > 0 ? r.askingPrice / r.areaM2 : null;
                        const outlier = pv?.outliers.includes(r.id);
                        return (
                          <tr key={r.id} className="align-middle">
                            <td className="py-1 pr-2"><CellNumber label={`${PORTAL_LABEL[portal]}, testigo ${i + 1}: precio`} unit="€" value={r.askingPrice} onChange={(x) => setRow(r.id, { askingPrice: x })} /></td>
                            <td className="py-1 pr-2"><CellNumber label={`${PORTAL_LABEL[portal]}, testigo ${i + 1}: metros`} unit="m²" value={r.areaM2} onChange={(x) => setRow(r.id, { areaM2: x })} /></td>
                            <td className="py-1 pr-2">
                              <input aria-label={`${PORTAL_LABEL[portal]}, testigo ${i + 1}: enlace`} value={r.url ?? ""} placeholder="https://…" onChange={(e) => setRow(r.id, { url: e.target.value })}
                                className="h-9 w-full rounded-md border border-linea bg-white px-2 text-sm focus:border-plano focus:outline-none" />
                            </td>
                            <td className={cn("py-1 text-right whitespace-nowrap", outlier ? "text-sello" : "text-tinta-2")} title={outlier ? "Se desvía más de un 25 % de la media" : undefined}>
                              {pm2 ? `${num(pm2)} €` : "—"}{outlier ? " *" : ""}
                            </td>
                            <td className="py-1 text-right">
                              <button type="button" onClick={() => removeRow(r.id)} aria-label={`Quitar testigo ${i + 1} de ${PORTAL_LABEL[portal]}`}
                                className="grid h-8 w-8 place-items-center rounded-md text-tinta-3 hover:bg-papel-2 hover:text-sello">×</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                  <Button type="button" variant="secondary" size="sm" onClick={() => addRow(portal)}>Añadir testigo</Button>
                  <div className="min-w-[18rem]">
                    <Segmented<DemandLevel> label={`Demanda en ${PORTAL_LABEL[portal]}`} value={v.demand[portal]} onChange={(x) => setDemand(portal, x)}
                      options={[
                        { value: "BAJA", label: `Baja ${signedPct(v.settings.demandAdjustment.BAJA)}` },
                        { value: "MEDIA", label: "Media" },
                        { value: "ALTA", label: `Alta ${signedPct(v.settings.demandAdjustment.ALTA)}` },
                      ]} />
                  </div>
                </div>
              </section>
            );
          })}

          <details className="mt-10 border-t border-linea pt-6">
            <summary className="cursor-pointer text-sm font-medium">Ajustes del cálculo</summary>
            <div className="mt-4 grid gap-5 sm:grid-cols-3">
              <NumberField label="Corrección precio publicado" unit="%" percent decimals={1} value={v.settings.listingDiscount}
                onChange={(x) => setSettings({ listingDiscount: x ?? 0 })} hint="Diferencia típica entre oferta y cierre" />
              <NumberField label="Ajuste demanda alta" unit="%" percent decimals={1} value={v.settings.demandAdjustment.ALTA}
                onChange={(x) => setSettings({ demandAdjustment: { ...v.settings.demandAdjustment, ALTA: x ?? 0 } })} />
              <NumberField label="Ajuste demanda baja" unit="%" percent decimals={1} value={Math.abs(v.settings.demandAdjustment.BAJA)}
                onChange={(x) => setSettings({ demandAdjustment: { ...v.settings.demandAdjustment, BAJA: -(x ?? 0) } })} hint="Se resta" />
            </div>
          </details>
        </div>

        {/* Resultado */}
        <aside aria-live="polite" className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-md border border-tinta bg-white p-6">
            <h2 className="text-sm font-semibold text-tinta-2">Valor estimado</h2>
            {result?.estimatedValue ? (<>
              <p className="mt-1 text-4xl font-semibold tracking-tight">{eur(Math.round(result.estimatedValue / 1000) * 1000)}</p>
              <p className="mt-1 text-sm text-tinta-2">
                {eur(result.averagePriceM2!)}/m² × {num(s.areaM2)} m²{s.address?.street ? `, ${placeLabel(s.municipality, province?.name ?? "")}` : ""}
              </p>
              {result.range && result.portalsUsed > 1 && (
                <p className="mt-3 text-sm">Horquilla entre portales: <strong>{eur(result.range.low)}</strong> a <strong>{eur(result.range.high)}</strong></p>
              )}
              <table className="mt-5 w-full text-sm">
                <caption className="sr-only">Cálculo por portal</caption>
                <thead><tr className="border-b border-tinta text-left text-xs text-tinta-2">
                  <th className="pb-1.5 font-medium">Portal</th><th className="pb-1.5 text-right font-medium">Publicado</th><th className="pb-1.5 text-right font-medium">Ajustado</th>
                </tr></thead>
                <tbody>
                  {result.byPortal.map((p) => (
                    <tr key={p.portal} className="border-b border-linea">
                      <th scope="row" className="py-2 text-left font-normal">
                        {PORTAL_LABEL[p.portal]}
                        <span className="block text-xs text-tinta-3">{p.count ? `Demanda ${p.demand.toLowerCase()}${p.demandAdjustment ? ` ${signedPct(p.demandAdjustment)}` : ""}, −${pct(v.settings.listingDiscount, 0)}` : "Sin testigos"}</span>
                      </th>
                      <td className="py-2 text-right text-tinta-2">{p.meanAskingPriceM2 ? `${num(p.meanAskingPriceM2)} €/m²` : "—"}</td>
                      <td className="py-2 text-right font-medium">{p.adjustedPriceM2 ? `${num(p.adjustedPriceM2)} €/m²` : "—"}</td>
                    </tr>
                  ))}
                  <tr><th scope="row" className="pt-2 text-left font-semibold">Media de {result.portalsUsed} portal{result.portalsUsed === 1 ? "" : "es"}</th><td />
                    <td className="pt-2 text-right font-semibold">{num(result.averagePriceM2!)} €/m²</td></tr>
                </tbody>
              </table>
            </>) : (
              <p className="mt-2 text-sm text-tinta-2">Indica la superficie del inmueble y al menos un testigo para ver el valor.</p>
            )}
            {isExample && <p className="mt-4 text-xs text-tinta-3">Ejemplo con testigos ficticios.</p>}
            {result && result.warnings.length > 0 && (
              <ul className="mt-4 grid gap-1.5 text-xs text-tinta-2">{result.warnings.map((w, i) => <li key={i} className="border-l-2 border-linea pl-2">{w}</li>)}</ul>
            )}
            <Button className="mt-6 w-full" variant={result?.estimatedValue ? "primary" : "secondary"} disabled={!(s.areaM2 > 0)} onClick={analyzeInvestment}>
              Analizar la inversión de este inmueble
            </Button>
          </div>
          <p className="mt-3 text-xs text-tinta-3">Estimación orientativa a partir de precios de oferta. No es una tasación oficial.</p>
        </aside>
      </div>
    </div>
  );
}

const signedPct = (x: number) => (x > 0 ? "+" : x < 0 ? "−" : "") + pct(Math.abs(x), 0);

function CellNumber({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(value ? formatInputNumber(value, 0) : "");
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(value ? formatInputNumber(value, 0) : ""); }, [value, focused]);
  return (
    <div className="relative">
      <input aria-label={label} inputMode="decimal" value={text}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onChange={(e) => { setText(e.target.value); onChange(parseNumberEs(e.target.value) ?? 0); }}
        className="h-9 w-full rounded-md border border-linea bg-white pr-9 pl-2 text-right text-sm focus:border-plano focus:outline-none" />
      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-tinta-3">{unit}</span>
    </div>
  );
}
