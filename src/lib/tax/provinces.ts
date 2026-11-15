/**
 * ============================================================================
 *  InversionZ — Provincias, CCAA y administración receptora del ITP/AJD
 * ============================================================================
 *  El ITP/AJD es un tributo CEDIDO: el tipo lo fija la CCAA donde radica el
 *  inmueble y se ingresa en su Hacienda autonómica. Excepciones por provincia:
 *   - Álava, Bizkaia y Gipuzkoa: cada Diputación Foral (normativa y pago propios).
 *   - Navarra: Hacienda Foral de Navarra.
 *   - Ceuta y Melilla: no cedido -> AEAT (Delegación de la AEAT).
 *
 *  Código de provincia = 2 primeros dígitos del código postal (código INE).
 *
 *  ⚠️ PLAZOS: el régimen general es 30 días hábiles desde la escritura
 *  (art. 102 RD 828/1995). Varias CCAA lo han fijado en 1 mes en su normativa:
 *  ajustar `deadline` aquí tras verificarlo con cada Hacienda autonómica.
 * ============================================================================
 */

import type { CCAACode, ProvinceInfo } from '../../types/investment';

const DEFAULT_DEADLINE = '30 días hábiles desde la firma de la escritura (art. 102 RD 828/1995) — verificar plazo autonómico';

export const CCAA: Record<CCAACode, { name: string; authority: string; foral: boolean }> = {
  AND: { name: 'Andalucía', authority: 'Agencia Tributaria de Andalucía', foral: false },
  ARA: { name: 'Aragón', authority: 'Dirección General de Tributos del Gobierno de Aragón', foral: false },
  AST: { name: 'Principado de Asturias', authority: 'Ente Tributario del Principado de Asturias (ETPA)', foral: false },
  BAL: { name: 'Illes Balears', authority: 'Agència Tributària de les Illes Balears (ATIB)', foral: false },
  CAN: { name: 'Canarias', authority: 'Agencia Tributaria Canaria', foral: false },
  CANT: { name: 'Cantabria', authority: 'Agencia Cántabra de Administración Tributaria (ACAT)', foral: false },
  CLM: { name: 'Castilla-La Mancha', authority: 'Consejería de Hacienda de Castilla-La Mancha (Tributos)', foral: false },
  CYL: { name: 'Castilla y León', authority: 'Consejería de Economía y Hacienda de la Junta de Castilla y León (Tributos)', foral: false },
  CAT: { name: 'Cataluña', authority: 'Agència Tributària de Catalunya (ATC)', foral: false },
  VAL: { name: 'Comunitat Valenciana', authority: 'Agència Tributària Valenciana (ATV)', foral: false },
  EXT: { name: 'Extremadura', authority: 'Junta de Extremadura — Dirección General de Tributos', foral: false },
  GAL: { name: 'Galicia', authority: 'Axencia Tributaria de Galicia (ATRIGA)', foral: false },
  MAD: { name: 'Comunidad de Madrid', authority: 'Comunidad de Madrid — Dirección General de Tributos', foral: false },
  MUR: { name: 'Región de Murcia', authority: 'Agencia Tributaria de la Región de Murcia (ATRM)', foral: false },
  NAV: { name: 'Comunidad Foral de Navarra', authority: 'Hacienda Foral de Navarra', foral: true },
  PV: { name: 'País Vasco', authority: 'Diputación Foral del territorio histórico', foral: true },
  RIO: { name: 'La Rioja', authority: 'Gobierno de La Rioja — Dirección General de Tributos', foral: false },
  CEU: { name: 'Ceuta', authority: 'Agencia Estatal de Administración Tributaria (AEAT) — Delegación de Ceuta', foral: false },
  MEL: { name: 'Melilla', authority: 'Agencia Estatal de Administración Tributaria (AEAT) — Delegación de Melilla', foral: false },
};

interface ProvinceRow { code: string; name: string; ccaa: CCAACode; authority?: string; deadline?: string }

/** 52 provincias (código INE). `authority` solo si difiere de la de su CCAA. */
const PROVINCE_ROWS: ProvinceRow[] = [
  { code: '01', name: 'Álava / Araba', ccaa: 'PV', authority: 'Diputación Foral de Álava (Hacienda Foral)' },
  { code: '02', name: 'Albacete', ccaa: 'CLM' },
  { code: '03', name: 'Alicante / Alacant', ccaa: 'VAL' },
  { code: '04', name: 'Almería', ccaa: 'AND' },
  { code: '05', name: 'Ávila', ccaa: 'CYL' },
  { code: '06', name: 'Badajoz', ccaa: 'EXT' },
  { code: '07', name: 'Illes Balears', ccaa: 'BAL' },
  { code: '08', name: 'Barcelona', ccaa: 'CAT' },
  { code: '09', name: 'Burgos', ccaa: 'CYL' },
  { code: '10', name: 'Cáceres', ccaa: 'EXT' },
  { code: '11', name: 'Cádiz', ccaa: 'AND' },
  { code: '12', name: 'Castellón / Castelló', ccaa: 'VAL' },
  { code: '13', name: 'Ciudad Real', ccaa: 'CLM' },
  { code: '14', name: 'Córdoba', ccaa: 'AND' },
  { code: '15', name: 'A Coruña', ccaa: 'GAL' },
  { code: '16', name: 'Cuenca', ccaa: 'CLM' },
  { code: '17', name: 'Girona', ccaa: 'CAT' },
  { code: '18', name: 'Granada', ccaa: 'AND' },
  { code: '19', name: 'Guadalajara', ccaa: 'CLM' },
  { code: '20', name: 'Gipuzkoa', ccaa: 'PV', authority: 'Diputación Foral de Gipuzkoa (Hacienda Foral)' },
  { code: '21', name: 'Huelva', ccaa: 'AND' },
  { code: '22', name: 'Huesca', ccaa: 'ARA' },
  { code: '23', name: 'Jaén', ccaa: 'AND' },
  { code: '24', name: 'León', ccaa: 'CYL' },
  { code: '25', name: 'Lleida', ccaa: 'CAT' },
  { code: '26', name: 'La Rioja', ccaa: 'RIO' },
  { code: '27', name: 'Lugo', ccaa: 'GAL' },
  { code: '28', name: 'Madrid', ccaa: 'MAD' },
  { code: '29', name: 'Málaga', ccaa: 'AND' },
  { code: '30', name: 'Murcia', ccaa: 'MUR' },
  { code: '31', name: 'Navarra', ccaa: 'NAV' },
  { code: '32', name: 'Ourense', ccaa: 'GAL' },
  { code: '33', name: 'Asturias', ccaa: 'AST' },
  { code: '34', name: 'Palencia', ccaa: 'CYL' },
  { code: '35', name: 'Las Palmas', ccaa: 'CAN' },
  { code: '36', name: 'Pontevedra', ccaa: 'GAL' },
  { code: '37', name: 'Salamanca', ccaa: 'CYL' },
  { code: '38', name: 'Santa Cruz de Tenerife', ccaa: 'CAN' },
  { code: '39', name: 'Cantabria', ccaa: 'CANT' },
  { code: '40', name: 'Segovia', ccaa: 'CYL' },
  { code: '41', name: 'Sevilla', ccaa: 'AND' },
  { code: '42', name: 'Soria', ccaa: 'CYL' },
  { code: '43', name: 'Tarragona', ccaa: 'CAT' },
  { code: '44', name: 'Teruel', ccaa: 'ARA' },
  { code: '45', name: 'Toledo', ccaa: 'CLM' },
  { code: '46', name: 'Valencia / València', ccaa: 'VAL' },
  { code: '47', name: 'Valladolid', ccaa: 'CYL' },
  { code: '48', name: 'Bizkaia', ccaa: 'PV', authority: 'Diputación Foral de Bizkaia (Hacienda Foral)' },
  { code: '49', name: 'Zamora', ccaa: 'CYL' },
  { code: '50', name: 'Zaragoza', ccaa: 'ARA' },
  { code: '51', name: 'Ceuta', ccaa: 'CEU' },
  { code: '52', name: 'Melilla', ccaa: 'MEL' },
];

export const PROVINCES: ProvinceInfo[] = PROVINCE_ROWS.map((p) => ({
  code: p.code,
  name: p.name,
  ccaa: p.ccaa,
  ccaaName: CCAA[p.ccaa].name,
  transferTaxAuthority: p.authority ?? CCAA[p.ccaa].authority,
  transferTaxForm: 'Modelo 600 (autoliquidación ITP-AJD)',
  transferTaxDeadline: p.deadline ?? DEFAULT_DEADLINE,
  isForalTerritory: CCAA[p.ccaa].foral,
}));

export function getProvinceByCode(code: string): ProvinceInfo | undefined {
  return PROVINCES.find((p) => p.code === code.padStart(2, '0'));
}

/** Provincia a partir del código postal (2 primeros dígitos = código INE de provincia). */
export function getProvinceFromPostalCode(postalCode: string): ProvinceInfo | undefined {
  const cp = postalCode.trim();
  if (!/^\d{5}$/.test(cp)) return undefined;
  const prefix = cp.slice(0, 2);
  if (Number(prefix) < 1 || Number(prefix) > 52) return undefined;
  return getProvinceByCode(prefix);
}
