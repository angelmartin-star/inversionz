/**
 * Aproximación de valor con los precios medios publicados por idealista (precio de oferta €/m²).
 *
 * Fuente: idealista, "Informes de precios de la vivienda en venta", Madrid municipio.
 *   https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/venta/madrid-comunidad/madrid-provincia/madrid/
 * Datos de octubre de 2026 (Puente de Vallecas y Villa de Vallecas: septiembre de 2026).
 *
 * ⚠️ ACTUALIZAR cada mes copiando la tabla del informe. Cuando haya acceso a la API oficial
 *    de idealista/data, sustituir esta tabla por IdealistaApiProvider (ver providers.ts).
 */
import type { PropertyCondition } from "@/types/investment";

export const IDEALISTA_REFERENCE_MONTH = "octubre 2026";
export const IDEALISTA_REFERENCE_URL =
  "https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/venta/madrid-comunidad/madrid-provincia/madrid/";

export interface DistrictPrice { district: string; priceM2: number; yoy: number; month: string }

export const MADRID_DISTRICTS: DistrictPrice[] = [
  { district: "Barrio de Salamanca", priceM2: 10876, yoy: -0.019, month: "oct 2026" },
  { district: "Chamberí", priceM2: 9081, yoy: 0.003, month: "oct 2026" },
  { district: "Retiro", priceM2: 8274, yoy: -0.022, month: "oct 2026" },
  { district: "Chamartín", priceM2: 8142, yoy: 0.032, month: "oct 2026" },
  { district: "Centro", priceM2: 7867, yoy: 0.048, month: "oct 2026" },
  { district: "Arganzuela", priceM2: 6393, yoy: 0.061, month: "oct 2026" },
  { district: "Moncloa-Aravaca", priceM2: 6384, yoy: 0.014, month: "oct 2026" },
  { district: "Tetuán", priceM2: 6169, yoy: 0.048, month: "oct 2026" },
  { district: "Fuencarral-El Pardo", priceM2: 5625, yoy: 0.053, month: "oct 2026" },
  { district: "Hortaleza", priceM2: 5469, yoy: 0.067, month: "oct 2026" },
  { district: "Ciudad Lineal", priceM2: 5257, yoy: 0.068, month: "oct 2026" },
  { district: "Barajas", priceM2: 5107, yoy: 0.105, month: "oct 2026" },
  { district: "Moratalaz", priceM2: 4515, yoy: 0.113, month: "oct 2026" },
  { district: "San Blas-Canillejas", priceM2: 4183, yoy: 0.055, month: "oct 2026" },
  { district: "Vicálvaro", priceM2: 4091, yoy: 0.089, month: "oct 2026" },
  { district: "Latina", priceM2: 4023, yoy: 0.06, month: "oct 2026" },
  { district: "Carabanchel", priceM2: 3894, yoy: 0.097, month: "oct 2026" },
  { district: "Villa de Vallecas", priceM2: 3852, yoy: 0.12, month: "sep 2026" },
  { district: "Usera", priceM2: 3652, yoy: 0.145, month: "oct 2026" },
  { district: "Puente de Vallecas", priceM2: 3535, yoy: 0.179, month: "sep 2026" },
  { district: "Villaverde", priceM2: 3389, yoy: 0.231, month: "oct 2026" },
];

export const MADRID_CITY = { priceM2: 6427, yoy: 0.013, month: "oct 2026" };

/**
 * Código postal → distrito principal. Algunos códigos postales cruzan dos distritos:
 * el usuario puede corregir el distrito en la pantalla.
 */
const CP_DISTRICT: Record<string, string> = {
  "28001": "Barrio de Salamanca", "28002": "Chamartín", "28003": "Chamberí", "28004": "Centro", "28005": "Centro",
  "28006": "Barrio de Salamanca", "28007": "Retiro", "28008": "Moncloa-Aravaca", "28009": "Retiro", "28010": "Chamberí",
  "28011": "Latina", "28012": "Centro", "28013": "Centro", "28014": "Retiro", "28015": "Chamberí", "28016": "Chamartín",
  "28017": "Ciudad Lineal", "28018": "Puente de Vallecas", "28019": "Carabanchel", "28020": "Tetuán", "28021": "Villaverde",
  "28022": "San Blas-Canillejas", "28023": "Moncloa-Aravaca", "28024": "Latina", "28025": "Carabanchel", "28026": "Usera",
  "28027": "Ciudad Lineal", "28028": "Barrio de Salamanca", "28029": "Fuencarral-El Pardo", "28030": "Moratalaz",
  "28031": "Villa de Vallecas", "28032": "Vicálvaro", "28033": "Hortaleza", "28034": "Fuencarral-El Pardo",
  "28035": "Fuencarral-El Pardo", "28036": "Chamartín", "28037": "San Blas-Canillejas", "28038": "Puente de Vallecas",
  "28039": "Tetuán", "28040": "Moncloa-Aravaca", "28041": "Usera", "28042": "Barajas", "28043": "Hortaleza",
  "28044": "Latina", "28045": "Arganzuela", "28046": "Chamartín", "28047": "Latina", "28048": "Fuencarral-El Pardo",
  "28049": "Fuencarral-El Pardo", "28050": "Hortaleza", "28051": "Villa de Vallecas", "28052": "Vicálvaro",
  "28053": "Puente de Vallecas", "28054": "Carabanchel", "28055": "Hortaleza",
};

export function districtFromPostalCode(cp: string | undefined): string | null {
  return (cp && CP_DISTRICT[cp.trim()]) || null;
}

/** Ajuste orientativo por estado sobre el precio medio de la zona. */
export const CONDITION_FACTOR: Record<PropertyCondition, number> = {
  A_REFORMAR: -0.15,
  BUEN_ESTADO: 0,
  OBRA_NUEVA: 0.1,
};

export interface IdealistaApprox {
  district: string;
  zonePriceM2: number;
  month: string;
  yoy: number;
  conditionAdj: number;
  listingDiscount: number;
  priceM2: number;
  low: number;
  value: number;
  high: number;
}

/**
 * Valor ≈ m² × precio medio idealista de la zona × (1 + ajuste por estado) × (1 − corrección de publicación).
 * Horquilla ±8 % por la dispersión dentro de cada distrito.
 */
export function idealistaApproximation(
  areaM2: number, district: string | null, condition: PropertyCondition = "BUEN_ESTADO", listingDiscount = 0.1,
): IdealistaApprox | null {
  if (!(areaM2 > 0)) return null;
  const ref = MADRID_DISTRICTS.find((d) => d.district === district);
  if (!ref) return null;
  const conditionAdj = CONDITION_FACTOR[condition] ?? 0;
  const priceM2 = ref.priceM2 * (1 + conditionAdj) * (1 - listingDiscount);
  const value = areaM2 * priceM2;
  return {
    district: ref.district, zonePriceM2: ref.priceM2, month: ref.month, yoy: ref.yoy,
    conditionAdj, listingDiscount, priceM2: Math.round(priceM2),
    low: Math.round((value * 0.92) / 1000) * 1000, value: Math.round(value / 1000) * 1000, high: Math.round((value * 1.08) / 1000) * 1000,
  };
}
