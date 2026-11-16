/**
 * Inversores NO residentes en España.
 *
 * 1) Impuestos en ESPAÑA — IRNR (TRLIRNR, RDLeg 5/2004), sin establecimiento permanente:
 *    - Alquiler: 19 % sobre el rendimiento NETO (gastos y amortización deducibles) para residentes
 *      en la UE/EEE con intercambio de información; 24 % sobre el ingreso ÍNTEGRO, sin gastos, para el
 *      resto (incluido Reino Unido tras el Brexit). Sin reducción por alquiler de vivienda habitual.
 *    - Periodos sin alquilar: renta imputada del 2 % del valor catastral (1,1 % si se revisó en los
 *      10 años anteriores) × tipo (19/24 %), en proporción a los días vacíos.
 *    - Venta: ganancia patrimonial al 19 % para todos. El comprador retiene el 3 % del precio
 *      (modelo 211) a cuenta; si supera la cuota se devuelve.
 *    - Sin exenciones de vivienda habitual del IRPF (mayor de 65 / reinversión).
 *    - Modelo 210 (alquiler: declaración anual; venta: en los 3 meses siguientes al mes de la retención).
 *
 * 2) Impuestos en el PAÍS DE RESIDENCIA — estimación orientativa según el convenio con España:
 *    - EXENCIÓN (con progresividad): el país no grava la renta española; solo la usa para el tipo.
 *    - CRÉDITO: el país grava la renta y descuenta lo pagado en España (hasta su propia cuota):
 *      impuesto adicional ≈ max(0, tipo del país × renta − impuesto español).
 *    Los tipos por defecto son aproximados y el usuario puede cambiarlos (dependen de su renta total).
 *
 * ⚠️ ACTUALIZAR al cambiar la normativa. Revisado: noviembre 2026.
 */

export const IRNR = {
  RATE_EU_EEA: 0.19,
  RATE_GENERAL: 0.24,
  RATE_CAPITAL_GAIN: 0.19,
  SALE_WITHHOLDING: 0.03,
  IMPUTED_PCT_REVISED: 0.011,
  IMPUTED_PCT_DEFAULT: 0.02,
} as const;

/** UE + EEE con intercambio de información (Islandia, Noruega, Liechtenstein). */
export const EU_EEA = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV",
  "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK", "IS", "NO", "LI",
]);

export type DoubleTaxMethod = "CREDITO" | "EXENCION";

export interface CountryProfile {
  code: string;
  name: string;
  euEea: boolean;
  method: DoubleTaxMethod;
  /** Tipo marginal orientativo del país sobre rentas de alquiler */
  rentalRate: number;
  /** Tipo orientativo del país sobre la ganancia de la venta */
  gainRate: number;
  /** Italia: la ganancia solo tributa si se vende antes de 5 años */
  gainOnlyIfHeldUnderYears?: number;
  /** Italia: IVIE 1,06 % del valor catastral menos el IBI pagado en España */
  wealthTaxOnValue?: number;
  note: string;
}

export const COUNTRIES: CountryProfile[] = [
  { code: "GB", name: "Reino Unido", euEea: false, method: "CREDITO", rentalRate: 0.40, gainRate: 0.24,
    note: "Reino Unido grava el alquiler al 20/40/45 % y la ganancia de una vivienda al 18/24 %, descontando lo pagado en España." },
  { code: "US", name: "Estados Unidos", euEea: false, method: "CREDITO", rentalRate: 0.24, gainRate: 0.15,
    note: "EE. UU. grava la renta mundial (10–37 %; ganancia a largo plazo 0/15/20 %) con crédito por el impuesto español. Puede añadirse el NIIT del 3,8 % y el impuesto de tu estado." },
  { code: "FR", name: "Francia", euEea: true, method: "EXENCION", rentalRate: 0, gainRate: 0,
    note: "Francia concede un crédito igual al impuesto francés: en la práctica no pagas más, pero la renta cuenta para tu tipo medio." },
  { code: "DE", name: "Alemania", euEea: true, method: "EXENCION", rentalRate: 0, gainRate: 0,
    note: "Alemania exime la renta del inmueble español con progresividad: no pagas allí, pero sube el tipo del resto de tus rentas." },
  { code: "IT", name: "Italia", euEea: true, method: "CREDITO", rentalRate: 0.33, gainRate: 0.26, gainOnlyIfHeldUnderYears: 5, wealthTaxOnValue: 0.0106,
    note: "Italia grava el alquiler neto en el IRPEF con crédito por el IRNR, y cobra el IVIE (1,06 % del valor) descontando el IBI. La venta solo tributa si es antes de 5 años." },
  { code: "PT", name: "Portugal", euEea: true, method: "CREDITO", rentalRate: 0.28, gainRate: 0.14,
    note: "Portugal grava el alquiler al 28 % (o tipo progresivo) y el 50 % de la ganancia, con crédito por el impuesto español." },
  { code: "NL", name: "Países Bajos", euEea: true, method: "EXENCION", rentalRate: 0, gainRate: 0,
    note: "Países Bajos incluye el inmueble en el box 3 y aplica una reducción por doble imposición proporcional al inmueble español." },
  { code: "BE", name: "Bélgica", euEea: true, method: "EXENCION", rentalRate: 0, gainRate: 0,
    note: "Bélgica exime la renta del inmueble español con reserva de progresividad." },
  { code: "CH", name: "Suiza", euEea: false, method: "EXENCION", rentalRate: 0, gainRate: 0,
    note: "Suiza exime los inmuebles en el extranjero y su renta, pero los tiene en cuenta para el tipo." },
  { code: "MX", name: "México", euEea: false, method: "CREDITO", rentalRate: 0.30, gainRate: 0.30,
    note: "México grava la renta mundial (ISR hasta 35 %) con acreditamiento del impuesto pagado en España." },
  { code: "CO", name: "Colombia", euEea: false, method: "CREDITO", rentalRate: 0.33, gainRate: 0.15,
    note: "Colombia grava el alquiler en la renta (hasta 39 %) y la venta como ganancia ocasional (15 %), con descuento por el impuesto español." },
  { code: "AR", name: "Argentina", euEea: false, method: "CREDITO", rentalRate: 0.27, gainRate: 0.15,
    note: "Argentina grava las rentas de fuente extranjera (alquiler a tipo progresivo; venta de inmuebles al 15 %) con crédito por el impuesto español. Además, Bienes Personales." },
  { code: "OTRO_UE", name: "Otro país de la UE/EEE", euEea: true, method: "CREDITO", rentalRate: 0, gainRate: 0,
    note: "Indica el tipo de tu país si grava esta renta; si no lo sabes, deja 0 y consulta a un asesor de tu país." },
  { code: "OTRO", name: "Otro país fuera de la UE", euEea: false, method: "CREDITO", rentalRate: 0, gainRate: 0,
    note: "Indica el tipo de tu país si grava esta renta; si no lo sabes, deja 0 y consulta a un asesor de tu país." },
];

export function getCountry(code: string | undefined): CountryProfile | null {
  if (!code || code === "ES") return null;
  return COUNTRIES.find((c) => c.code === code) ?? null;
}
