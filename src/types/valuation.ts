/**
 * InversionZ — Esquema de datos del módulo de VALORACIÓN por testigos de portales.
 * Porcentajes en tanto por uno.
 */
import type { PropertyAddress, PropertyCondition } from "./investment";

export type Portal = "IDEALISTA" | "FOTOCASA" | "PISOSCOM";
export const PORTALS: Portal[] = ["IDEALISTA", "FOTOCASA", "PISOSCOM"];
export const PORTAL_LABEL: Record<Portal, string> = { IDEALISTA: "Idealista", FOTOCASA: "Fotocasa", PISOSCOM: "pisos.com" };

export type DemandLevel = "ALTA" | "MEDIA" | "BAJA";

/** Testigo: un anuncio comparable publicado en un portal */
export interface Comparable {
  id: string;
  portal: Portal;
  askingPrice: number;        // precio publicado (€)
  areaM2: number;             // superficie construida anunciada
  url?: string;
  note?: string;              // planta, estado, garaje…
}

export interface ValuationSubject {
  address?: PropertyAddress;
  postalCode: string;
  municipality?: string;
  areaM2: number;
  rooms?: number;
  bathrooms?: number;
  condition?: PropertyCondition;
}

export interface ValuationSettings {
  /** Corrección del precio de publicación al de cierre. Defecto 0.10 */
  listingDiscount: number;
  /** Ajuste por nivel de demanda de cada portal. Defecto +5 % / 0 / −5 % */
  demandAdjustment: Record<DemandLevel, number>;
}

export interface ValuationInput {
  subject: ValuationSubject;
  comparables: Comparable[];
  demand: Record<Portal, DemandLevel>;
  settings: ValuationSettings;
}

export interface PortalValuation {
  portal: Portal;
  count: number;
  meanAskingPriceM2: number | null;      // media €/m² publicada
  minPriceM2: number | null;
  maxPriceM2: number | null;
  demand: DemandLevel;
  demandAdjustment: number;
  adjustedPriceM2: number | null;        // tras demanda y corrección de publicación
  value: number | null;                  // adjustedPriceM2 × m² del inmueble
  outliers: string[];                    // ids de testigos que se desvían > 25 % de la media
}

export interface ValuationResult {
  byPortal: PortalValuation[];
  portalsUsed: number;
  averagePriceM2: number | null;         // media de los portales con testigos
  estimatedValue: number | null;
  range: { low: number; high: number } | null;
  warnings: string[];
}
