/**
 * ============================================================================
 *  InversionQ — Módulo de Valoración Automática (AVM)
 * ============================================================================
 *  Patrón "proveedor intercambiable": la app solo conoce la interfaz
 *  `AVMProvider`. Hoy se usa `MockAVMProvider`; mañana se añade
 *  `IdealistaAVMProvider`, `TinsaAVMProvider` o `CatastroAVMProvider`
 *  implementando la misma interfaz y se cambia en `getAVMProvider()`.
 *
 *  ⚠️ Los precios €/m² del mock son VALORES DE RELLENO para desarrollo.
 *  No son datos de mercado y no deben mostrarse como tales al usuario.
 * ============================================================================
 */

import type { AVMResult, PropertyCondition } from '../../types/investment';

export interface AVMRequest {
  postalCode: string;
  provinceCode: string;
  surfaceM2: number;
  condition: PropertyCondition;
  purchasePrice: number;
}

export interface AVMProvider {
  readonly name: string;
  estimate(req: AVMRequest): Promise<AVMResult>;
}

/** Ajuste por estado de conservación sobre el €/m² medio de la zona */
const CONDITION_FACTOR: Record<PropertyCondition, number> = {
  A_REFORMAR: 0.85,
  BUEN_ESTADO: 1.0,
  OBRA_NUEVA: 1.15,
};

/** Placeholder €/m² por provincia (solo desarrollo). */
const MOCK_PRICE_M2_BY_PROVINCE: Record<string, number> = {
  '28': 4200, '08': 3800, '07': 4000, '46': 2100, '29': 3100, '41': 1900,
  '48': 3000, '20': 3700, '01': 2500, '31': 2000, '03': 2300, '35': 2400, '38': 2300,
};
const MOCK_DEFAULT_PRICE_M2 = 1600;

export class MockAVMProvider implements AVMProvider {
  readonly name = 'MOCK';

  async estimate(req: AVMRequest): Promise<AVMResult> {
    const base = MOCK_PRICE_M2_BY_PROVINCE[req.provinceCode] ?? MOCK_DEFAULT_PRICE_M2;
    const pricePerM2 = Math.round(base * CONDITION_FACTOR[req.condition]);
    const estimatedValue = pricePerM2 * req.surfaceM2;
    return buildAVMResult(this.name, true, pricePerM2, estimatedValue, req, 'BAJA');
  }
}

/**
 * Plantilla para el proveedor real. Ejemplo de integración (no activo):
 *   const res = await fetch(`${process.env.AVM_API_URL}/valuation`, {
 *     method: 'POST', headers: { Authorization: `Bearer ${process.env.AVM_API_KEY}` },
 *     body: JSON.stringify({ postalCode, surface: surfaceM2, condition }),
 *   });
 * Mapear la respuesta con `buildAVMResult`. Las claves van SOLO en servidor.
 */
export class ExternalAVMProvider implements AVMProvider {
  readonly name: string;
  constructor(name: string) { this.name = name; }
  async estimate(_req: AVMRequest): Promise<AVMResult> {
    throw new Error(`Proveedor AVM "${this.name}" no implementado todavía`);
  }
}

export function buildAVMResult(
  provider: string, isMock: boolean, pricePerM2: number, estimatedValue: number,
  req: AVMRequest, confidence: AVMResult['confidence'], comparablesCount?: number,
): AVMResult {
  return {
    provider,
    isMock,
    pricePerM2,
    estimatedValue,
    purchasePricePerM2: Math.round(req.purchasePrice / req.surfaceM2),
    deviationPct: estimatedValue > 0 ? (req.purchasePrice - estimatedValue) / estimatedValue : 0,
    confidence,
    comparablesCount,
  };
}

/** Punto único de selección del proveedor (por variable de entorno en el futuro). */
export function getAVMProvider(): AVMProvider {
  return new MockAVMProvider();
}
