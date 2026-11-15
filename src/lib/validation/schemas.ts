/**
 * Validación de entrada (Zod v4). Se usa en el formulario (por pasos) y en las API routes.
 * Mensajes pensados para el usuario final.
 */
import { z } from "zod";

const money = (label: string) => z.number({ error: `Indica ${label}` }).min(0, `${label} no puede ser negativo`);
const positive = (label: string) => z.number({ error: `Indica ${label}` }).positive(`${label} debe ser mayor que 0`);
const ratio = (label: string, max = 1) => z.number({ error: `Indica ${label}` }).min(0).max(max, `${label} fuera de rango`);

export const addressSchema = z.object({
  street: z.string().trim().min(3, "Indica la calle"),
  number: z.string().trim().min(1, "Indica el número"),
  staircase: z.string().max(20).optional(),
  floor: z.string().max(20).optional(),
  door: z.string().max(20).optional(),
});

export const propertySchema = z.object({
  address: addressSchema,
  cadastre: z.object({
    refCat: z.string().max(25), use: z.string().optional(), yearBuilt: z.number().nullable().optional(),
    builtArea: z.number().nullable().optional(), participationPct: z.number().nullable().optional(),
  }).optional(),
  postalCode: z.string().regex(/^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/, "Código postal español de 5 dígitos"),
  provinceCode: z.string().optional(),
  municipality: z.string().max(80).optional(),
  surfaceM2: positive("la superficie"),
  condition: z.enum(["A_REFORMAR", "BUEN_ESTADO", "OBRA_NUEVA"]),
  purchasePrice: positive("el precio de compra"),
  cadastralValueTotal: positive("el valor catastral total"),
  cadastralValueLand: money("el valor catastral del suelo"),
  cadastralReferenceValue: z.number().min(0).optional(),
  isProtectedHousing: z.boolean().optional(),
}).refine((p) => p.cadastralValueLand < p.cadastralValueTotal, {
  path: ["cadastralValueLand"], message: "El valor del suelo debe ser menor que el valor catastral total",
});

export const acquisitionSchema = z.object({
  renovationCost: money("la reforma"),
  furnitureCost: money("el mobiliario"),
  notaryFees: money("la notaría"),
  registryFees: money("el registro"),
  agencyFees: money("la gestoría"),
  buyerAgencyCommission: z.number().min(0).optional(),
  renovationIsImprovement: z.boolean().optional(),
});

export const financingSchema = z.object({
  enabled: z.boolean(),
  loanToValue: ratio("el % de financiación"),
  termYears: z.number().int("Años enteros").min(1, "Mínimo 1 año").max(40, "Máximo 40 años"),
  annualInterestRate: ratio("el TIN", 0.2),
  openingFee: z.number().min(0).optional(),
});

export const rentalSchema = z.object({
  monthlyRent: money("la renta mensual"),
  rentalType: z.enum(["VIVIENDA_HABITUAL", "TEMPORADA", "TURISTICO"]),
  vacancyRate: z.number().min(0).max(0.9, "Desocupación máxima 90 %").optional(),
  annualRentGrowth: z.number().min(-0.2).max(0.2).optional(),
  annualExpenseGrowth: z.number().min(-0.2).max(0.2).optional(),
  annualExpenses: z.object({
    ibi: money("el IBI"),
    community: money("la comunidad"),
    homeInsurance: money("el seguro de hogar"),
    defaultInsurance: money("el seguro de impago"),
    maintenance: money("el mantenimiento"),
    wasteTax: z.number().min(0).optional(),
    parkingVado: z.number().min(0).optional(),
    managementFeePct: z.number().min(0).max(0.5).optional(),
    other: z.number().min(0).optional(),
  }),
  reduction: z.enum(["AUTO", "NINGUNA", "GENERAL_50", "REHABILITADA_60", "JOVEN_O_SOCIAL_TENSIONADA_70", "TENSIONADA_REBAJA_90", "CONTRATO_ANTERIOR_LEY_VIVIENDA_60"]).optional(),
  reductionFlags: z.object({
    contractSignedBefore26May2023: z.boolean().optional(),
    stressedArea: z.boolean().optional(),
    rentReducedAtLeast5Pct: z.boolean().optional(),
    tenantAged18to35: z.boolean().optional(),
    leasedToPublicAdministration: z.boolean().optional(),
    rehabilitatedLast2Years: z.boolean().optional(),
  }).optional(),
  investorGeneralTaxBase: money("tu base imponible general"),
  investorSavingsTaxBaseInSaleYear: z.number().min(0).optional(),
});

export const saleSchema = z.object({
  yearsUntilSale: z.number().int("Años enteros").min(1, "Mínimo 1 año").max(40, "Máximo 40 años"),
  estimatedSalePrice: positive("el precio de venta"),
  saleCommissionPct: z.number().min(0).max(0.2).optional(),
  otherSaleCosts: z.number().min(0).optional(),
  municipalCapitalGainRate: z.number().min(0).max(0.3, "El tipo máximo legal es 30 %").optional(),
  cadastralLandValueAnnualUpdate: z.number().min(-0.2).max(0.2).optional(),
  sellerHabitualResidence: z.boolean().optional(),
  sellerAged65Plus: z.boolean().optional(),
  reinvestmentAmount: z.number().min(0).optional(),
});

export const investmentInputSchema = z.object({
  property: propertySchema,
  acquisition: acquisitionSchema,
  financing: financingSchema.optional(),
  rental: rentalSchema,
  sale: saleSchema,
});

/** Esquema de cada paso del formulario (clave = sección del InvestmentInput). */
export const STEP_SCHEMAS = {
  property: propertySchema,
  acquisition: acquisitionSchema,
  financing: financingSchema,
  rental: rentalSchema,
  sale: saleSchema,
} as const;

export type FieldErrors = Record<string, string>;

/** Devuelve errores indexados por ruta "seccion.campo" */
export function validateSection(section: keyof typeof STEP_SCHEMAS, value: unknown): FieldErrors {
  const res = STEP_SCHEMAS[section].safeParse(value);
  if (res.success) return {};
  const out: FieldErrors = {};
  for (const issue of res.error.issues) {
    const key = [section, ...issue.path].join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
