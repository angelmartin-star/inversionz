"use client";
/**
 * Búsqueda en el Catastro desde el paso 1 del formulario.
 * Por dirección (calle + número, luego piso/puerta) o por referencia catastral.
 * Rellena superficie construida y guarda referencia, uso y año de construcción.
 */
import { useState } from "react";
import type { CatastroLookupResult, CatastroUnit, StreetCandidate } from "@/lib/catastro/catastroClient";
import type { PropertyData } from "@/types/investment";
import { Button, TextField, cn } from "@/components/ui/primitives";
import { num } from "@/lib/format";

interface Props {
  property: PropertyData;
  provinceCode?: string;
  onApply: (u: CatastroUnit) => void;
}

const floorLabel = (f: string) => (/^\d+$/.test(f) ? (Number(f) === 0 ? "Bajo" : `${Number(f)}º`) : f || "—");

export function CatastroLookup({ property, provinceCode, onApply }: Props) {
  const [refCat, setRefCat] = useState(property.cadastre?.refCat ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CatastroLookupResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const a = property.address;
  const canSearchAddress = !!(provinceCode && a?.street && a?.number);

  async function search(body: Record<string, unknown>) {
    setLoading(true); setError(null); setResult(null); setSelected(null);
    try {
      const res = await fetch("/api/catastro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? "El Catastro no responde ahora mismo.");
      setResult(json as CatastroLookupResult);
      setSelected((json as CatastroLookupResult).matchIndex);
    } catch (e) {
      setError(e instanceof TypeError ? "No se pudo contactar con el servicio del Catastro desde esta versión." : (e as Error).message);
    } finally { setLoading(false); }
  }

  const byAddress = (street?: StreetCandidate) => search({
    provinceCode, municipality: property.municipality ?? "", street: a?.street ?? "", number: a?.number ?? "",
    staircase: a?.staircase, floor: a?.floor, door: a?.door, streetType: street?.type, streetName: street?.name,
  });

  return (
    <section aria-labelledby="catastro-t" className="sm:col-span-2 rounded-md border border-linea bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[56ch]">
          <h2 id="catastro-t" className="text-sm font-semibold">Datos del Catastro</h2>
          <p className="mt-1 text-xs text-tinta-3">
            Rellena la superficie y obtén la referencia catastral, el uso y el año de construcción. El valor catastral no es público:
            cópialo del recibo del IBI.
          </p>
        </div>
        <Button type="button" variant="secondary" disabled={!canSearchAddress || loading} onClick={() => byAddress()}>
          {loading ? "Buscando…" : "Buscar por dirección"}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <TextField label="O por referencia catastral" className="min-w-[16rem] flex-1" placeholder="20 caracteres, en el recibo del IBI" value={refCat} maxLength={25}
          onChange={(v) => setRefCat(v.toUpperCase())} />
        <Button type="button" variant="secondary" disabled={refCat.replace(/\s/g, "").length < 14 || loading} onClick={() => search({ refCat })}>Buscar</Button>
      </div>

      {!canSearchAddress && !result && <p className="mt-3 text-xs text-tinta-3">Para buscar por dirección indica calle, número y código postal.</p>}
      {error && <p role="alert" className="mt-4 text-sm text-sello">{error}</p>}

      {result?.streetCandidates && (
        <div className="mt-4">
          <p className="text-sm">Hay varias vías con ese nombre en {result.municipality}. Elige la tuya:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.streetCandidates.map((c) => (
              <Button key={`${c.type}-${c.code}`} type="button" size="sm" variant="secondary" onClick={() => byAddress(c)}>{c.type} {c.name}</Button>
            ))}
          </div>
        </div>
      )}

      {result && result.units.length > 0 && (
        <div className="mt-5">
          <p className="text-sm">
            {result.units.length === 1 ? "Inmueble encontrado:" : `${result.units.length} inmuebles en el portal. ${selected !== null ? "Hemos marcado el que coincide con tu piso y puerta." : "Elige el tuyo:"}`}
          </p>
          <div role="radiogroup" className="mt-2 max-h-72 overflow-y-auto rounded-md border border-linea">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-papel-2 text-left text-xs text-tinta-2">
                <tr><th className="px-3 py-2 font-medium">Planta y puerta</th><th className="px-3 py-2 font-medium">Uso</th>
                  <th className="px-3 py-2 text-right font-medium">m²</th><th className="px-3 py-2 text-right font-medium">Año</th><th className="hidden px-3 py-2 font-medium sm:table-cell">Referencia</th></tr>
              </thead>
              <tbody>
                {result.units.map((u, i) => (
                  <tr key={u.refCat} role="radio" aria-checked={selected === i} tabIndex={0}
                    onClick={() => setSelected(i)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(i)}
                    className={cn("cursor-pointer border-t border-linea", selected === i ? "bg-parcela-claro" : "hover:bg-papel")}>
                    <td className="px-3 py-2">{u.staircase && u.staircase !== "1" ? `Esc. ${u.staircase}, ` : ""}{floorLabel(u.floor)} {u.door}</td>
                    <td className="px-3 py-2">{u.use || "—"}</td>
                    <td className="px-3 py-2 text-right">{u.builtArea ? num(u.builtArea) : "—"}</td>
                    <td className="px-3 py-2 text-right">{u.yearBuilt ?? "—"}</td>
                    <td className="hidden px-3 py-2 text-xs text-tinta-3 sm:table-cell">{u.refCat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected !== null && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="button" variant="bmAzul" onClick={() => onApply(result.units[selected])}>Usar estos datos</Button>
              <a href={result.units[selected].mapUrl} target="_blank" rel="noreferrer" className="text-sm text-plano underline-offset-2 hover:underline">Ver la parcela en la Sede del Catastro</a>
            </div>
          )}
        </div>
      )}

      {property.cadastre?.refCat && (
        <p className="mt-4 border-t border-linea pt-3 text-sm" aria-live="polite">
          Aplicado: referencia <strong>{property.cadastre.refCat}</strong>
          {property.cadastre.use ? `, uso ${property.cadastre.use.toLowerCase()}` : ""}
          {property.cadastre.yearBuilt ? `, construido en ${property.cadastre.yearBuilt}` : ""}.
        </p>
      )}
    </section>
  );
}
