/**
 * ============================================================================
 *  InversionQ — Cliente del Catastro (Dirección General del Catastro, DGC)
 * ============================================================================
 *  Servicios web LIBRES (sin certificado) de la Sede Electrónica del Catastro,
 *  versión JSON de COVCCallejero:
 *    https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/help
 *
 *  Qué da:   referencia catastral, uso, superficie construida, año de construcción,
 *            coeficiente de participación y localización (escalera/planta/puerta).
 *  Qué NO da: valor catastral ni titular (datos PROTEGIDOS: requieren certificado
 *            del titular o convenio con la DGC). El usuario los toma del recibo del IBI.
 *
 *  Ámbito: todo el territorio común (48 provincias). País Vasco (Álava, Bizkaia,
 *  Gipuzkoa) y Navarra tienen catastros forales propios -> conectores aparte (pendiente).
 *
 *  SOLO SERVIDOR: el servicio no admite CORS; el navegador llama a /api/catastro.
 * ============================================================================
 */

const BASE = "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json";
const TIMEOUT_MS = 8000;

export class CatastroError extends Error {
  constructor(message: string, public code: "NO_DISPONIBLE" | "NO_ENCONTRADO" | "FORAL" | "ERROR_SERVICIO" | "DATOS") { super(message); }
}

// ---------------------------------------------------------------------------
// Tipos normalizados (lo que consume la app)
// ---------------------------------------------------------------------------
export interface CatastroUnit {
  refCat: string;             // 20 caracteres
  parcelRef: string;          // 14 primeros: identifica la finca
  use: string;                // "Residencial", "Comercial"…
  builtArea: number | null;   // m² construidos (incluye parte de zonas comunes)
  yearBuilt: number | null;
  participationPct: number | null;
  staircase: string; floor: string; door: string;
  addressLabel: string;       // "CL EMBAJADORES 120 Es:1 Pl:03 Pt:B"
  postalCode: string;
  mapUrl: string;
}

export interface StreetCandidate { type: string; name: string; code: string }

export interface CatastroLookupResult {
  province: string; municipality: string;
  street?: StreetCandidate;
  streetCandidates?: StreetCandidate[];   // si la calle es ambigua
  units: CatastroUnit[];
  matchIndex: number | null;              // unidad que coincide con piso/puerta indicados
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9Ñ ]/g, " ").replace(/\s+/g, " ").trim();

/** Busca la primera aparición de una clave a cualquier profundidad (el JSON del Catastro anida con envoltorios variables). */
export function deepFind(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  if (key in (obj as Record<string, unknown>)) return (obj as Record<string, unknown>)[key];
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const r = deepFind(v, key);
    if (r !== undefined) return r;
  }
  return undefined;
}
const asArray = <T,>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Lanza CatastroError si la respuesta trae lista de errores (lerr/err). */
export function throwIfError(json: unknown) {
  const errs = asArray(deepFind(json, "err") as { cod?: string; des?: string } | { cod?: string; des?: string }[]);
  if (errs.length) {
    const e = errs[0];
    const notFound = ["5", "9", "16", "17", "33", "43"].includes(String(e.cod ?? ""));
    throw new CatastroError(e.des ?? "Error del Catastro", notFound ? "NO_ENCONTRADO" : "ERROR_SERVICIO");
  }
}

async function get(op: string, params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams(params).toString();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${op}${qs ? `?${qs}` : ""}`, { signal: ctrl.signal, headers: { Accept: "application/json" }, next: { revalidate: 86400 } } as RequestInit);
    if (!res.ok) throw new CatastroError(`El Catastro respondió ${res.status}`, "NO_DISPONIBLE");
    const json = await res.json();
    throwIfError(json);
    return json;
  } catch (e) {
    if (e instanceof CatastroError) throw e;
    throw new CatastroError("No se pudo conectar con el Catastro. Inténtalo de nuevo en unos minutos.", "NO_DISPONIBLE");
  } finally { clearTimeout(t); }
}

// ---------------------------------------------------------------------------
// Tipos de vía: texto del usuario -> sigla del Catastro
// ---------------------------------------------------------------------------
/** Siglas habituales del callejero del Catastro. Ampliar si aparece alguna nueva. */
export const STREET_TYPES: Record<string, string> = {
  CALLE: "CL", C: "CL", CL: "CL", AVENIDA: "AV", AV: "AV", AVDA: "AV", PLAZA: "PZ", PZA: "PZ", PL: "PZ",
  PASEO: "PS", PS: "PS", GLORIETA: "GL", RONDA: "RD", TRAVESIA: "TR", CAMINO: "CM", CARRETERA: "CR",
  CALLEJON: "CJ", PASAJE: "PJ", URBANIZACION: "UR", COSTANILLA: "CT", CUESTA: "CU", BULEVAR: "BV",
  RAMBLA: "RB", PLAZUELA: "PQ", VIA: "VI", PARQUE: "PQ", POLIGONO: "PG", SECTOR: "SC", BARRIO: "BO",
};
const CONNECTORS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "EL", "D", "L"]);

/** "Calle de Embajadores" -> { type: "CL", name: "EMBAJADORES" } */
export function parseStreet(input: string): { type: string | null; name: string } {
  const words = normalize(input).split(" ").filter(Boolean);
  let type: string | null = null;
  if (words.length > 1 && STREET_TYPES[words[0]]) type = STREET_TYPES[words.shift()!];
  while (words.length > 1 && CONNECTORS.has(words[0])) words.shift();
  return { type, name: words.join(" ") };
}

/** Planta del usuario -> formato Catastro ("3" -> "03", "Bajo" -> "BJ"/"00") para comparar. */
export function floorKey(f: string): string {
  const n = normalize(f).replace(/[ºª°]/g, "").replace(/\s/g, "");
  if (/^-?\d+$/.test(n)) return String(parseInt(n, 10));
  if (["BAJO", "BJ", "B", "PB", "PLANTABAJA"].includes(n)) return "0";
  if (["ATICO", "AT", "A"].includes(n)) return "AT";
  if (["ENTRESUELO", "EN", "ENT"].includes(n)) return "EN";
  if (["PRINCIPAL", "PR", "PRAL"].includes(n)) return "PR";
  if (["SOTANO", "SS", "ST", "SM"].includes(n)) return "-1";
  return n;
}
export const doorKey = (d: string) => normalize(d).replace(/^0+(?=\w)/, "").replace(/\s|IZDA|IZQUIERDA|DCHA|DERECHA|CENTRO/g, (m) => ({ IZDA: "IZ", IZQUIERDA: "IZ", DCHA: "DR", DERECHA: "DR", CENTRO: "CE" } as Record<string, string>)[m] ?? "");

// ---------------------------------------------------------------------------
// Normalización de inmuebles
// ---------------------------------------------------------------------------
interface RawRc { pc1?: string; pc2?: string; car?: string; cc1?: string; cc2?: string }
const toNumber = (s?: string) => { if (!s) return null; const n = Number(String(s).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };

export function normalizeUnit(raw: Record<string, unknown>): CatastroUnit {
  const rc = (deepFind(raw, "rc") ?? {}) as RawRc;
  const parcelRef = `${rc.pc1 ?? ""}${rc.pc2 ?? ""}`;
  const refCat = `${parcelRef}${rc.car ?? ""}${rc.cc1 ?? ""}${rc.cc2 ?? ""}`;
  const debi = (deepFind(raw, "debi") ?? {}) as { luso?: string; sfc?: string; cpt?: string; ant?: string };
  const dir = (deepFind(raw, "dir") ?? {}) as { tv?: string; nv?: string; pnp?: string; plp?: string };
  const loint = (deepFind(raw, "loint") ?? {}) as { bq?: string; es?: string; pt?: string; pu?: string };
  const cp = String(deepFind(raw, "dp") ?? "");
  const ldt = deepFind(raw, "ldt");
  const label = typeof ldt === "string" ? ldt
    : [dir.tv, dir.nv, dir.pnp, loint.es && `Es:${loint.es}`, loint.pt && `Pl:${loint.pt}`, loint.pu && `Pt:${loint.pu}`].filter(Boolean).join(" ");
  return {
    refCat, parcelRef,
    use: debi.luso ?? "",
    builtArea: toNumber(debi.sfc),
    yearBuilt: toNumber(debi.ant),
    participationPct: toNumber(debi.cpt),
    staircase: loint.es ?? "", floor: loint.pt ?? "", door: loint.pu ?? "",
    addressLabel: label, postalCode: cp,
    mapUrl: `https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat=${parcelRef}`,
  };
}

/** Convierte la respuesta de Consulta_DNPLOC / DNPRC en lista de unidades. */
export function parseDnp(json: unknown): CatastroUnit[] {
  const list = asArray(deepFind(json, "rcdnp") as Record<string, unknown>[] | undefined);
  if (list.length) return list.map(normalizeUnit);
  const bico = deepFind(json, "bico") as Record<string, unknown> | undefined;
  if (bico) return [normalizeUnit(bico)];
  return [];
}

/** Índice de la unidad que coincide con escalera/planta/puerta indicadas (o null). */
export function matchUnit(units: CatastroUnit[], q: { staircase?: string; floor?: string; door?: string }): number | null {
  if (units.length === 1) return 0;
  const fk = q.floor ? floorKey(q.floor) : null;
  const dk = q.door ? doorKey(q.door) : null;
  const ek = q.staircase ? normalize(q.staircase) : null;
  const hits = units.map((u, i) => ({ u, i })).filter(({ u }) =>
    (!fk || floorKey(u.floor) === fk) && (!dk || doorKey(u.door) === dk) && (!ek || normalize(u.staircase) === ek));
  return (fk || dk) && hits.length === 1 ? hits[0].i : null;
}

// ---------------------------------------------------------------------------
// Resolución de provincia y municipio (nombres oficiales del Catastro)
// ---------------------------------------------------------------------------
let provinceCache: { code: string; name: string }[] | null = null;
export async function getProvinces() {
  if (provinceCache) return provinceCache;
  const json = await get("ObtenerProvincias", {});
  provinceCache = asArray(deepFind(json, "prov") as { cpine: string; np: string }[]).map((p) => ({ code: p.cpine.padStart(2, "0"), name: p.np }));
  return provinceCache;
}

export async function resolveProvince(provinceCode: string) {
  if (["01", "20", "48", "31"].includes(provinceCode))
    throw new CatastroError("Álava, Bizkaia, Gipuzkoa y Navarra tienen catastro foral propio: introduce los datos a mano por ahora.", "FORAL");
  const p = (await getProvinces()).find((x) => x.code === provinceCode);
  if (!p) throw new CatastroError("Provincia no disponible en el Catastro.", "DATOS");
  return p.name;
}

export async function resolveMunicipality(province: string, municipality: string) {
  const json = await get("ObtenerMunicipios", { Provincia: province, Municipio: normalize(municipality) });
  const list = asArray(deepFind(json, "muni") as { nm: string }[]).map((m) => m.nm);
  if (!list.length) throw new CatastroError(`No encontramos el municipio "${municipality}" en ${province}.`, "NO_ENCONTRADO");
  const target = normalize(municipality);
  return list.find((n) => normalize(n) === target) ?? list[0];
}

export async function findStreets(province: string, municipality: string, streetInput: string): Promise<StreetCandidate[]> {
  const { type, name } = parseStreet(streetInput);
  if (!name) throw new CatastroError("Indica el nombre de la calle.", "DATOS");
  const json = await get("ObtenerCallejero", { Provincia: province, Municipio: municipality, TipoVia: "", NomVia: name });
  const all = asArray(deepFind(json, "calle") as { dir: { cv: string; tv: string; nv: string } }[])
    .map((c) => ({ type: c.dir.tv, name: c.dir.nv, code: c.dir.cv }));
  const exact = all.filter((c) => normalize(c.name) === normalize(name));
  const pool = exact.length ? exact : all;
  const byType = type ? pool.filter((c) => c.type === type) : pool;
  return byType.length ? byType : pool;
}

// ---------------------------------------------------------------------------
// Operaciones públicas
// ---------------------------------------------------------------------------
export interface AddressQuery {
  provinceCode: string; municipality: string; street: string; number: string;
  staircase?: string; floor?: string; door?: string;
  /** Si el usuario eligió una vía entre varias candidatas */
  streetType?: string; streetName?: string;
}

export async function lookupByAddress(q: AddressQuery): Promise<CatastroLookupResult> {
  const province = await resolveProvince(q.provinceCode);
  const municipality = await resolveMunicipality(province, q.municipality || province);
  let street: StreetCandidate | undefined;
  if (q.streetType && q.streetName) street = { type: q.streetType, name: q.streetName, code: "" };
  else {
    const candidates = await findStreets(province, municipality, q.street);
    if (!candidates.length) throw new CatastroError(`No encontramos "${q.street}" en ${municipality}.`, "NO_ENCONTRADO");
    if (candidates.length > 1) return { province, municipality, streetCandidates: candidates, units: [], matchIndex: null };
    street = candidates[0];
  }
  // Consultamos el portal completo y filtramos piso/puerta aquí: el Catastro es estricto con el formato de planta.
  const json = await get("Consulta_DNPLOC", {
    Provincia: province, Municipio: municipality, Sigla: street.type, Calle: street.name,
    Numero: q.number.replace(/\D.*$/, "") || q.number, Bloque: "", Escalera: "", Planta: "", Puerta: "",
  });
  const units = parseDnp(json);
  if (!units.length) throw new CatastroError("No hay inmuebles en esa dirección.", "NO_ENCONTRADO");
  return { province, municipality, street, units, matchIndex: matchUnit(units, q) };
}

export async function lookupByRefCat(refCat: string): Promise<CatastroLookupResult> {
  const rc = refCat.replace(/\s/g, "").toUpperCase();
  if (![14, 18, 20].includes(rc.length)) throw new CatastroError("La referencia catastral tiene 14, 18 o 20 caracteres.", "DATOS");
  const json = await get("Consulta_DNPRC", { Provincia: "", Municipio: "", RefCat: rc });
  const units = parseDnp(json);
  if (!units.length) throw new CatastroError("La referencia catastral no existe.", "NO_ENCONTRADO");
  return {
    province: String(deepFind(json, "np") ?? ""), municipality: String(deepFind(json, "nm") ?? ""),
    units, matchIndex: units.length === 1 ? 0 : null,
  };
}
