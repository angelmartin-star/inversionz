/**
 * ============================================================================
 *  InversionQ — PARÁMETROS FISCALES (España)
 * ============================================================================
 *  ⚠️  ÚNICO FICHERO QUE HAY QUE TOCAR CUANDO CAMBIE LA NORMATIVA.
 *
 *  Versión de tablas: TAX_TABLES_VERSION. Revisar como mínimo:
 *   - 1 de enero (leyes de presupuestos / acompañamiento autonómicas).
 *   - Cualquier Real Decreto-ley sobre coeficientes de plusvalía.
 *
 *  Cada tabla lleva `verified` (contrastado con fuente oficial o 2+ fuentes
 *  profesionales coincidentes a la fecha de versión) y `source`.
 *  Si `verified: false`, el motor añade un aviso al resultado.
 *
 *  Todos los tipos en tanto por uno.
 * ============================================================================
 */

import type { CCAACode } from '../../types/investment';

export const TAX_TABLES_VERSION = '2026-11-14';

export interface Bracket {
  /** Límite superior del tramo (incluido). null = sin límite */
  upTo: number | null;
  rate: number;
}

// ============================================================================
// 1. ITP — Transmisiones Patrimoniales Onerosas (vivienda de segunda mano)
// ============================================================================
/**
 *  mode:
 *   - 'MARGINAL'    -> cada tramo tributa a su tipo (como el IRPF).
 *   - 'TOTAL_VALUE' -> el tipo del tramo en que cae el valor TOTAL grava toda la base.
 *  bonificacionCuota: bonificación sobre la cuota (Ceuta/Melilla 50 %).
 *
 *  Base imponible: mayor entre precio escriturado y valor de referencia
 *  catastral (art. 10 TRLITPAJD, redacción Ley 11/2021).
 *
 *  NO se incluyen tipos reducidos por colectivo (jóvenes, familia numerosa,
 *  discapacidad, VPO): exigen vivienda HABITUAL del comprador y no aplican a
 *  una compra para alquilar. Ampliable en `ITP_REDUCED_RATES` en Fase 2+.
 */
export interface ItpScale {
  mode: 'MARGINAL' | 'TOTAL_VALUE';
  brackets: Bracket[];
  bonificacionCuota?: number;
  verified: boolean;
  source: string;
  notes?: string;
}

export const ITP_GENERAL: Record<CCAACode, ItpScale> = {
  AND: { mode: 'MARGINAL', brackets: [{ upTo: null, rate: 0.07 }], verified: true,
    source: 'DLeg 1/2018 Andalucía; Hacienda "Tributación Autonómica. Medidas 2026"' },
  ARA: { mode: 'MARGINAL', brackets: [
      { upTo: 400_000, rate: 0.08 }, { upTo: 450_000, rate: 0.085 },
      { upTo: 500_000, rate: 0.09 }, { upTo: 750_000, rate: 0.095 }, { upTo: null, rate: 0.10 }],
    verified: true, source: 'DLeg 1/2005 Aragón (tramos 400k/450k/500k/750k)' },
  AST: { mode: 'TOTAL_VALUE', brackets: [
      { upTo: 300_000, rate: 0.08 }, { upTo: 500_000, rate: 0.09 }, { upTo: null, rate: 0.10 }],
    verified: true, source: 'DLeg 2/2014 Asturias', notes: 'El tipo del valor total grava toda la base' },
  BAL: { mode: 'MARGINAL', brackets: [
      { upTo: 400_000, rate: 0.08 }, { upTo: 600_000, rate: 0.09 },
      { upTo: 1_000_000, rate: 0.10 }, { upTo: 2_000_000, rate: 0.12 }, { upTo: null, rate: 0.13 }],
    verified: true, source: 'DLeg 1/2014 Illes Balears' },
  CAN: { mode: 'MARGINAL', brackets: [{ upTo: null, rate: 0.065 }], verified: true,
    source: 'DLeg 1/2009 Canarias' },
  CANT: { mode: 'MARGINAL', brackets: [{ upTo: null, rate: 0.09 }], verified: false,
    source: 'DLeg 62/2008 Cantabria', notes: 'Fuentes 2026 discrepan sobre tramo inferior al 9 %: VERIFICAR' },
  CLM: { mode: 'MARGINAL', brackets: [{ upTo: null, rate: 0.09 }], verified: true,
    source: 'Ley 8/2013 Castilla-La Mancha' },
  CYL: { mode: 'MARGINAL', brackets: [{ upTo: 250_000, rate: 0.08 }, { upTo: null, rate: 0.10 }],
    verified: true, source: 'DLeg 1/2013 Castilla y León' },
  CAT: { mode: 'MARGINAL', brackets: [
      { upTo: 600_000, rate: 0.10 }, { upTo: 900_000, rate: 0.11 },
      { upTo: 1_500_000, rate: 0.12 }, { upTo: null, rate: 0.13 }],
    verified: true, source: 'Decreto-ley 5/2025 Catalunya (vigente desde 27/06/2025)',
    notes: 'Grandes tenedores: 20 % (no modelado)' },
  VAL: { mode: 'TOTAL_VALUE', brackets: [{ upTo: 1_000_000, rate: 0.09 }, { upTo: null, rate: 0.11 }],
    verified: true, source: 'Generalitat Valenciana — 9 % general desde 01/06/2026; 11 % si valor > 1 M€' },
  EXT: { mode: 'MARGINAL', brackets: [
      { upTo: 360_000, rate: 0.08 }, { upTo: 600_000, rate: 0.10 }, { upTo: null, rate: 0.11 }],
    verified: false, source: 'DLeg 1/2018 Extremadura', notes: 'Cortes de tramo a VERIFICAR' },
  GAL: { mode: 'MARGINAL', brackets: [{ upTo: null, rate: 0.08 }], verified: true,
    source: 'DLeg 1/2011 Galicia' },
  MAD: { mode: 'MARGINAL', brackets: [{ upTo: null, rate: 0.06 }], verified: true,
    source: 'DLeg 1/2010 Comunidad de Madrid' },
  MUR: { mode: 'MARGINAL', brackets: [{ upTo: null, rate: 0.0775 }], verified: false,
    source: 'DLeg 1/2010 Región de Murcia', notes: 'Algunas fuentes aún publican 8 %: VERIFICAR' },
  NAV: { mode: 'MARGINAL', brackets: [{ upTo: null, rate: 0.06 }], verified: true,
    source: 'DF Leg 129/1999 Navarra (régimen foral)' },
  PV: { mode: 'MARGINAL', brackets: [{ upTo: null, rate: 0.04 }], verified: true,
    source: 'Normas Forales ITP Álava/Bizkaia/Gipuzkoa — 4 % viviendas (7 % resto inmuebles)' },
  RIO: { mode: 'MARGINAL', brackets: [{ upTo: null, rate: 0.07 }], verified: true,
    source: 'Ley 10/2017 La Rioja' },
  CEU: { mode: 'MARGINAL', brackets: [{ upTo: null, rate: 0.06 }], bonificacionCuota: 0.5,
    verified: true, source: 'TRLITPAJD art. 11 + bonificación 50 % art. 57 bis (gestión AEAT)' },
  MEL: { mode: 'MARGINAL', brackets: [{ upTo: null, rate: 0.06 }], bonificacionCuota: 0.5,
    verified: true, source: 'TRLITPAJD art. 11 + bonificación 50 % art. 57 bis (gestión AEAT)' },
};

// ============================================================================
// 2. AJD — Actos Jurídicos Documentados, cuota gradual (compra de OBRA NUEVA)
// ============================================================================
/** Desde RDL 17/2018 el AJD de la escritura de HIPOTECA lo paga el banco: no se imputa al comprador. */
export const AJD_NEW_BUILD: Record<CCAACode, { rate: number; verified: boolean; notes?: string }> = {
  AND: { rate: 0.012, verified: true },
  ARA: { rate: 0.015, verified: true },
  AST: { rate: 0.012, verified: true },
  BAL: { rate: 0.015, verified: true },
  CAN: { rate: 0.01, verified: false, notes: 'Tipo incrementado 1 % en operaciones sujetas a IGIC; general 0,75 %' },
  CANT: { rate: 0.015, verified: true },
  CLM: { rate: 0.015, verified: true },
  CYL: { rate: 0.015, verified: true },
  CAT: { rate: 0.015, verified: true },
  VAL: { rate: 0.014, verified: false, notes: 'Fuentes 2026 indican 1,4 %; verificar' },
  EXT: { rate: 0.015, verified: true },
  GAL: { rate: 0.015, verified: true },
  MAD: { rate: 0.0075, verified: true },
  MUR: { rate: 0.015, verified: true },
  NAV: { rate: 0.005, verified: true },
  PV: { rate: 0.005, verified: false, notes: 'Hay fuentes que indican 0 % en vivienda; verificar por territorio' },
  RIO: { rate: 0.01, verified: true },
  CEU: { rate: 0.005, verified: true, notes: 'Tipo estatal supletorio; bonificación 50 % no modelada' },
  MEL: { rate: 0.005, verified: true, notes: 'Tipo estatal supletorio; bonificación 50 % no modelada' },
};

// ============================================================================
// 3. Impuesto indirecto en primera entrega (OBRA NUEVA)
// ============================================================================
export const NEW_BUILD_INDIRECT_TAX = {
  IVA_GENERAL_VIVIENDA: 0.10,    // art. 91.Uno.1.7º LIVA (incluye hasta 2 plazas de garaje + trastero)
  IVA_VPO_REGIMEN_ESPECIAL: 0.04,
  IGIC_VIVIENDA_CANARIAS: 0.07,  // Ley 4/2012 Canarias; puede ser 0 % en primera vivienda habitual (no aplica a inversión)
  /** Ceuta y Melilla: IPSI (tipo municipal). null = no modelado -> se usa IVA 10 % como estimación conservadora */
  IPSI_CEUTA_MELILLA: null as number | null,
};

// ============================================================================
// 4. IRPF — Escala GENERAL (rendimientos del capital inmobiliario)
// ============================================================================
/** Escala ESTATAL art. 63.1 LIRPF (sin cambios para 2026). */
export const IRPF_STATE_GENERAL: Bracket[] = [
  { upTo: 12_450, rate: 0.095 },
  { upTo: 20_200, rate: 0.12 },
  { upTo: 35_200, rate: 0.15 },
  { upTo: 60_000, rate: 0.185 },
  { upTo: 300_000, rate: 0.225 },
  { upTo: null, rate: 0.245 },
];

/**
 * Escalas AUTONÓMICAS (art. 74 LIRPF). Rellenar por CCAA.
 * Las que no estén informadas usan la escala "espejo" de la estatal
 * (resultado = escala supletoria 19 %–47 %) y el motor emite aviso.
 * PV y NAV: régimen foral con IRPF propio — el motor aplica régimen común como aproximación y avisa.
 */
export const IRPF_REGIONAL_GENERAL: Partial<Record<CCAACode, { brackets: Bracket[]; source: string }>> = {
  MAD: {
    source: 'DLeg 1/2010 Madrid, mod. Ley 13/2023 (deflactación) — sin cambios 2025/2026',
    brackets: [
      { upTo: 13_362.22, rate: 0.085 },
      { upTo: 19_004.63, rate: 0.107 },
      { upTo: 35_425.68, rate: 0.128 },
      { upTo: 57_320.40, rate: 0.174 },
      { upTo: null, rate: 0.205 },
    ],
  },
  // TODO Fase 2+: CAT, AND, VAL, GAL, CYL… (copiar de la escala autonómica publicada por la AEAT)
};

/** Ceuta y Melilla: deducción del 60 % de la cuota íntegra para residentes (art. 68.4 LIRPF) — no modelada. */

// ============================================================================
// 5. IRPF — Escala del AHORRO (ganancia patrimonial en la venta)
// ============================================================================
/** Estatal + autonómica (idénticas). Tramo 30 % > 300.000 € desde 01/01/2025 (Ley 7/2024). */
export const IRPF_SAVINGS: Bracket[] = [
  { upTo: 6_000, rate: 0.19 },
  { upTo: 50_000, rate: 0.21 },
  { upTo: 200_000, rate: 0.23 },
  { upTo: 300_000, rate: 0.27 },
  { upTo: null, rate: 0.30 },
];

// ============================================================================
// 6. IRPF — Amortización y reducciones por alquiler
// ============================================================================
export const AMORTIZATION = {
  /** Art. 14.2.a RIRPF: 3 % sobre el MAYOR entre coste de adquisición de la construcción
   *  (sin suelo) y valor catastral de la construcción. */
  BUILDING_RATE: 0.03,
  /** Mobiliario y enseres: coeficiente máximo tabla simplificada 10 % (≈10 años). */
  FURNITURE_RATE: 0.10,
  /** Años máximos que se amortiza el mobiliario con el coeficiente anterior. */
  FURNITURE_YEARS: 10,
};

/** Art. 23.2 LIRPF (Ley 12/2023). Solo arrendamiento de VIVIENDA (habitual del inquilino) y sobre rendimiento neto POSITIVO. */
export const RENTAL_REDUCTIONS = {
  TENSIONADA_REBAJA_90: 0.90,
  JOVEN_O_SOCIAL_TENSIONADA_70: 0.70,
  REHABILITADA_60: 0.60,
  GENERAL_50: 0.50,
  CONTRATO_ANTERIOR_LEY_VIVIENDA_60: 0.60, // contratos firmados hasta el 25/05/2023
  NINGUNA: 0,
} as const;

/** Art. 16 RIRPF: intereses + reparación/conservación no pueden superar los ingresos; exceso deducible en los 4 años siguientes. */
export const LIMITED_EXPENSES_CARRYFORWARD_YEARS = 4;

// ============================================================================
// 7. PLUSVALÍA MUNICIPAL (IIVTNU) — art. 107 TRLRHL
// ============================================================================
/**
 * Coeficientes MÁXIMOS del método objetivo por años de tenencia.
 * Vigentes en 2026: los de 2024 (RDL 8/2023), al no convalidarse ni el
 * RDL 9/2024 (coef. 2025) ni el RDL 16/2025 (coef. 2026, derogado 27/01/2026).
 * Índice = años completos de tenencia (0 = menos de un año). ≥20 años -> índice 20.
 * Cada ayuntamiento puede fijar coeficientes inferiores en su ordenanza.
 */
export const IIVTNU_COEFFICIENTS: number[] = [
  /* <1 */ 0.15, /* 1 */ 0.15, /* 2 */ 0.14, /* 3 */ 0.14, /* 4 */ 0.16,
  /* 5 */ 0.18, /* 6 */ 0.19, /* 7 */ 0.20, /* 8 */ 0.19, /* 9 */ 0.15,
  /* 10 */ 0.12, /* 11 */ 0.10, /* 12 */ 0.09, /* 13 */ 0.09, /* 14 */ 0.09,
  /* 15 */ 0.09, /* 16 */ 0.10, /* 17 */ 0.13, /* 18 */ 0.17, /* 19 */ 0.23,
  /* ≥20 */ 0.40,
];
export const IIVTNU_COEFFICIENTS_SOURCE = 'RDL 8/2023 (art. 107.4 TRLRHL) — vigentes 2026';

/** Tipo máximo legal (art. 108.1 TRLRHL). Usado si no se conoce el del municipio. */
export const IIVTNU_MAX_RATE = 0.30;

/** Tipos de capitales principales (ordenanza fiscal). Clave: nombre de municipio normalizado. */
export const IIVTNU_MUNICIPAL_RATES: Record<string, number> = {
  madrid: 0.29,
  barcelona: 0.30,
  valencia: 0.297,
  murcia: 0.26,
  valladolid: 0.2176,
};

// ============================================================================
// 8. Valores por defecto del modelo (no son normativa)
// ============================================================================
export const MODEL_DEFAULTS = {
  SALE_COMMISSION_PCT: 0.03,
};
