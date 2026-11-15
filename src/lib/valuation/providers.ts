/**
 * ============================================================================
 *  InversionZ — Conectores de testigos por portal
 * ============================================================================
 *  Idealista, Fotocasa y pisos.com prohíben extraer anuncios de forma automática
 *  (scraping) en sus condiciones de uso. Por eso:
 *   - HOY: los testigos los introduce el usuario (ManualProvider).
 *   - DESPUÉS: conectores oficiales con credenciales, todos con la misma interfaz:
 *       · Idealista: API oficial (alta en el programa de desarrolladores de Idealista;
 *         OAuth2 "client credentials"). Plantilla abajo, desactivada hasta tener claves.
 *       · Fotocasa y pisos.com: no ofrecen API pública; vía proveedor de datos con
 *         licencia (contrato) o acuerdo directo con el portal.
 *  Las claves van SOLO en variables de entorno del servidor (Vercel → Settings → Environment Variables).
 * ============================================================================
 */
import type { Comparable, Portal, ValuationSubject } from "@/types/valuation";

export interface ComparablesProvider {
  readonly portal: Portal;
  readonly automatic: boolean;
  /** Devuelve testigos para el inmueble. El manual no busca: los aporta el usuario. */
  search(subject: ValuationSubject, opts?: { radiusM?: number; maxItems?: number }): Promise<Comparable[]>;
}

export class ManualProvider implements ComparablesProvider {
  readonly automatic = false;
  constructor(readonly portal: Portal) {}
  async search(): Promise<Comparable[]> { return []; }
}

/**
 * Plantilla del conector de la API oficial de Idealista (no activa).
 * Variables: IDEALISTA_API_KEY, IDEALISTA_API_SECRET.
 * Flujo previsto (confirmar con la documentación que entregue Idealista al dar de alta la cuenta):
 *   1. POST https://api.idealista.com/oauth/token  (Basic base64(key:secret), grant_type=client_credentials)
 *   2. POST https://api.idealista.com/3.5/es/search  (center=lat,lon, distance, propertyType=homes, operation=sale)
 * Requiere coordenadas del inmueble (p. ej. del Catastro, servicio de coordenadas).
 */
export class IdealistaApiProvider implements ComparablesProvider {
  readonly portal = "IDEALISTA" as const;
  readonly automatic = true;
  static isConfigured() { return !!(process.env.IDEALISTA_API_KEY && process.env.IDEALISTA_API_SECRET); }
  async search(): Promise<Comparable[]> {
    if (!IdealistaApiProvider.isConfigured())
      throw new Error("Conector de Idealista sin credenciales: solicita acceso a la API oficial y añade IDEALISTA_API_KEY e IDEALISTA_API_SECRET.");
    throw new Error("Conector de Idealista pendiente de implementar con la documentación oficial.");
  }
}

/** Selección de proveedor por portal: automático si está configurado, si no manual. */
export function getProvider(portal: Portal): ComparablesProvider {
  if (portal === "IDEALISTA" && IdealistaApiProvider.isConfigured()) return new IdealistaApiProvider();
  return new ManualProvider(portal);
}
