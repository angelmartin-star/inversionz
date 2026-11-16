/**
 * ============================================================================
 *  InversionZ — Esquema de datos (interfaces TypeScript)
 * ============================================================================
 *  Convenciones:
 *   - Importes en EUROS (number, sin redondear en entrada).
 *   - Porcentajes SIEMPRE en tanto por uno (0.035 = 3,5 %).
 *   - Los campos opcionales tienen valor por defecto documentado.
 * ============================================================================
 */

/** Comunidades / Ciudades Autónomas */
export type CCAACode =
  | 'AND' | 'ARA' | 'AST' | 'BAL' | 'CAN' | 'CANT' | 'CLM' | 'CYL' | 'CAT'
  | 'VAL' | 'EXT' | 'GAL' | 'MAD' | 'MUR' | 'NAV' | 'PV' | 'RIO' | 'CEU' | 'MEL';

/** Código INE de provincia (2 dígitos = 2 primeros dígitos del código postal) */
export type ProvinceCode = string;

export type PropertyCondition = 'A_REFORMAR' | 'BUEN_ESTADO' | 'OBRA_NUEVA';

export type RentalType = 'VIVIENDA_HABITUAL' | 'TEMPORADA' | 'TURISTICO';

/**
 * Reducción art. 23.2 LIRPF (redacción Ley 12/2023).
 *  AUTO -> el motor la deduce de los flags de `RentalReductionFlags`.
 */
export type RentalReductionCase =
  | 'AUTO'
  | 'NINGUNA'
  | 'GENERAL_50'
  | 'REHABILITADA_60'
  | 'JOVEN_O_SOCIAL_TENSIONADA_70'
  | 'TENSIONADA_REBAJA_90'
  | 'CONTRATO_ANTERIOR_LEY_VIVIENDA_60';

// ---------------------------------------------------------------------------
// ENTRADA (formulario multipaso)
// ---------------------------------------------------------------------------

/** Dirección exacta del inmueble */
export interface PropertyAddress {
  street: string;                     // tipo de vía y nombre: "Calle de Alcalá"
  number: string;                     // número de portal
  staircase?: string;                 // escalera
  floor?: string;                     // planta / piso: "3", "Bajo", "Ático"
  door?: string;                      // puerta / letra: "B", "Izda."
}

/** Paso 1 — Datos del inmueble */
/** Datos no protegidos obtenidos del Catastro */
export interface CadastreData {
  refCat: string;
  use?: string;
  yearBuilt?: number | null;
  builtArea?: number | null;
  participationPct?: number | null;
}

export interface PropertyData {
  address?: PropertyAddress;
  cadastre?: CadastreData;
  postalCode: string;                 // 5 dígitos; determina provincia y CCAA
  provinceCode?: ProvinceCode;        // opcional: si se informa, prevalece sobre el CP
  municipality?: string;
  surfaceM2: number;
  condition: PropertyCondition;
  purchasePrice: number;
  cadastralValueTotal: number;        // valor catastral total (recibo IBI)
  cadastralValueLand: number;         // valor catastral del suelo
  /** Valor de referencia de Catastro (Ley 11/2021). Base mínima del ITP. */
  cadastralReferenceValue?: number;
  /** VPO / vivienda protegida en obra nueva (IVA 4 %) */
  isProtectedHousing?: boolean;
}

/** Paso 2 — Gastos e inversión inicial (los impuestos de compra se calculan solos) */
export interface AcquisitionCosts {
  renovationCost: number;
  furnitureCost: number;
  notaryFees: number;
  registryFees: number;
  agencyFees: number;                 // gestoría (y tasación si la hay)
  buyerAgencyCommission?: number;     // honorarios personal shopper / agencia compradora
  /**
   * true (defecto): la reforma es MEJORA -> mayor valor de adquisición,
   * se amortiza al 3 % y reduce la ganancia patrimonial.
   * false: se trata como reparación/conservación del año 1 (gasto con límite).
   */
  renovationIsImprovement?: boolean;
}

/** Paso 3 — Financiación (opcional) */
export interface FinancingData {
  enabled: boolean;
  loanToValue: number;                // % sobre precio de compra (0.8 = 80 %)
  termYears: number;
  annualInterestRate: number;         // TIN anual (0.0275 = 2,75 %)
  openingFee?: number;                // comisión de apertura (€)
}

export interface RentalReductionFlags {
  contractSignedBefore26May2023?: boolean;   // contrato previo Ley 12/2023 -> 60 %
  stressedArea?: boolean;                    // zona de mercado residencial tensionado
  rentReducedAtLeast5Pct?: boolean;          // nuevo contrato con rebaja >5 % (90 %)
  tenantAged18to35?: boolean;                // primer alquiler en zona tensionada (70 %)
  leasedToPublicAdministration?: boolean;    // cesión a AAPP con fines sociales (70 %)
  rehabilitatedLast2Years?: boolean;         // rehabilitación art. 41 RIRPF (60 %)
}

/** Paso 4 — Explotación */
export interface RentalData {
  monthlyRent: number;
  rentalType: RentalType;
  vacancyRate?: number;               // defecto 0 (tanto por uno del año sin alquilar)
  annualRentGrowth?: number;          // defecto 0
  annualExpenseGrowth?: number;       // defecto 0
  annualExpenses: {
    ibi: number;
    community: number;
    homeInsurance: number;
    defaultInsurance: number;         // seguro de impago
    maintenance: number;              // reparación y conservación (gasto CON límite)
    wasteTax?: number;                // tasa de basuras / residuos (municipal)
    parkingVado?: number;             // tasa de vado (entrada de vehículos), si la hay
    managementFeePct?: number;        // gestión del alquiler en % de la renta cobrada
    other?: number;                   // suministros a cargo del propietario, tasas…
  };
  reduction?: RentalReductionCase;    // defecto 'AUTO'
  reductionFlags?: RentalReductionFlags;
  /** Base liquidable general del inversor SIN este inmueble (nómina, otros alquileres…) */
  investorGeneralTaxBase: number;
  /** Base del ahorro del inversor en el año de la venta (sin esta venta). Defecto 0 */
  investorSavingsTaxBaseInSaleYear?: number;
}

/** Paso 5 — Venta futura */
export interface SaleData {
  yearsUntilSale: number;             // entero ≥ 1
  estimatedSalePrice: number;
  saleCommissionPct?: number;         // defecto 0.03
  otherSaleCosts?: number;            // certificado energético, cancelación registral…
  /** Tipo de gravamen IIVTNU del municipio. Defecto: el de la tabla o 30 % (máximo legal). */
  municipalCapitalGainRate?: number;
  /** Actualización anual estimada del valor catastral del suelo. Defecto 0 */
  cadastralLandValueAnnualUpdate?: number;
  /** ¿Será la vivienda habitual del vendedor en el momento de la venta? (≥3 años residiendo) */
  sellerHabitualResidence?: boolean;
  /** Vendedor con 65 años o más al vender (exención total, art. 33.4.b LIRPF) */
  sellerAged65Plus?: boolean;
  /** Importe que reinvertirá en nueva vivienda habitual en 2 años (art. 38.1 LIRPF) */
  reinvestmentAmount?: number;
}

/** Residencia fiscal del inversor. Sin este bloque (o con 'ES') se calcula como residente (IRPF). */
export interface InvestorData {
  /** Código del país de residencia ('ES', 'GB', 'FR'… ver src/lib/tax/nonResident.ts) */
  residenceCountry: string;
  /** Tipo del país de residencia sobre el alquiler (si no, el de la tabla) */
  homeRentalRate?: number;
  /** Tipo del país de residencia sobre la ganancia de la venta (si no, el de la tabla) */
  homeGainRate?: number;
  /** Valor catastral revisado en los 10 últimos años (renta imputada 1,1 % en vez de 2 %) */
  cadastralRevisedRecently?: boolean;
}

export interface InvestmentInput {
  investor?: InvestorData;
  property: PropertyData;
  acquisition: AcquisitionCosts;
  financing?: FinancingData;
  rental: RentalData;
  sale: SaleData;
}

// ---------------------------------------------------------------------------
// SALIDA
// ---------------------------------------------------------------------------

export interface ProvinceInfo {
  code: ProvinceCode;
  name: string;
  ccaa: CCAACode;
  ccaaName: string;
  /** Administración a la que se ingresa el ITP/AJD de un inmueble en esta provincia */
  transferTaxAuthority: string;
  transferTaxForm: string;            // modelo de autoliquidación
  transferTaxDeadline: string;
  isForalTerritory: boolean;          // País Vasco / Navarra: IRPF propio
}

export interface AcquisitionTaxResult {
  regime: 'ITP' | 'IVA_AJD' | 'IGIC_AJD' | 'IPSI_AJD';
  taxBase: number;
  transferTax: number;                // ITP (TPO)
  vat: number;                        // IVA / IGIC / IPSI
  stampDuty: number;                  // AJD (cuota gradual)
  total: number;
  effectiveRate: number;              // total / precio
  breakdown: string;
}

export interface MortgageYear {
  year: number;
  payment: number;
  interest: number;
  principal: number;
  endingBalance: number;
}

export interface MortgageSchedule {
  principal: number;
  monthlyPayment: number;
  years: MortgageYear[];
}

export interface IrpfRentalYear {
  year: number;
  grossIncome: number;
  deductibleExpensesUnlimited: number;
  limitedExpensesDeducted: number;    // intereses + reparación (con límite)
  limitedExpensesCarriedForward: number;
  amortizationBuilding: number;
  amortizationFurniture: number;
  netIncome: number;                  // rendimiento neto
  reductionRate: number;
  reducedNetIncome: number;           // rendimiento neto reducido
  marginalTaxRate: number;            // tipo marginal del inversor tras integrar el alquiler
  taxDue: number;                     // cuota incremental IRPF (negativa = ahorro). No residente: total impuestos del año
  /** Solo no residentes: desglose */
  nonResident?: { irnrRental: number; irnrImputed: number; homeTax: number; homeWealthTax: number };
}

export interface YearProjection {
  year: number;
  effectiveRent: number;
  operatingExpenses: number;
  noi: number;                        // net operating income
  debtService: number;
  interest: number;
  principalRepaid: number;
  irpf: number;
  cashflowBeforeTax: number;
  cashflowAfterTax: number;
  mortgageBalance: number;
}

export interface MunicipalCapitalGainResult {
  yearsHeld: number;
  coefficient: number;
  objectiveBase: number;
  realLandGain: number;
  isTaxable: boolean;                 // false si no hay incremento real (art. 104.5 TRLRHL)
  chosenMethod: 'OBJETIVO' | 'REAL' | 'NO_SUJETO';
  taxBase: number;
  rate: number;
  tax: number;
}

export type CapitalGainExemption = 'NINGUNA' | 'MAYOR_65_VIVIENDA_HABITUAL' | 'REINVERSION_VIVIENDA_HABITUAL';

export interface CapitalGainResult {
  acquisitionValue: number;
  accumulatedAmortization: number;
  transmissionValue: number;
  gain: number;
  exemption: CapitalGainExemption;
  exemptGain: number;                 // parte de la ganancia exenta
  taxableGain: number;                // parte que tributa en la base del ahorro
  tax: number;
  effectiveRate: number;
}

export interface NonResidentResult {
  countryCode: string;
  countryName: string;
  euEea: boolean;
  method: 'CREDITO' | 'EXENCION';
  rentalRateSpain: number;            // 19 % o 24 %
  rentalBaseSpain: 'NETO' | 'INTEGRO';
  homeRentalRate: number;
  homeGainRate: number;
  imputedPct: number;
  year1: { irnrRental: number; irnrImputed: number; homeTax: number; homeWealthTax: number; total: number };
  sale: { irnr: number; withholding: number; withholdingBalance: number; homeTax: number; total: number };
  note: string;
}

export interface TaxPayment {
  moment: 'COMPRA' | 'ANUAL' | 'VENTA';
  concept: string;
  amount: number;
  authority: string;
  form: string;
  deadline: string;
}

export interface AVMResult {
  provider: string;
  isMock: boolean;
  pricePerM2: number;
  estimatedValue: number;
  purchasePricePerM2: number;
  deviationPct: number;               // (precio compra − valor estimado) / valor estimado
  confidence: 'BAJA' | 'MEDIA' | 'ALTA';
  comparablesCount?: number;
}

export interface KPIs {
  totalInvestment: number;
  equityRequired: number;
  loanAmount: number;
  grossYieldOnPrice: number;
  grossYieldOnInvestment: number;
  netYieldBeforeTax: number;
  netYieldAfterTax: number;
  cashflowMonthlyBeforeTax: number;
  cashflowMonthlyAfterTax: number;
  cashflowAnnualBeforeTax: number;
  cashflowAnnualAfterTax: number;
  roce: number | null;                // cashflow neto / capital propio
  roceIncludingPrincipal: number | null;
  irr: number | null;                 // TIR del capital propio con venta
  equityMultiple: number | null;
}

export interface InvestmentAnalysisResult {
  meta: { taxTablesVersion: string; generatedAt: string };
  province: ProvinceInfo;
  acquisitionTaxes: AcquisitionTaxResult;
  investmentBreakdown: Record<string, number>;
  mortgage: MortgageSchedule | null;
  kpis: KPIs;
  irpfYear1: IrpfRentalYear;
  irpfByYear: IrpfRentalYear[];
  projection: YearProjection[];
  sale: {
    salePrice: number;
    saleCosts: number;
    municipalCapitalGain: MunicipalCapitalGainResult;
    capitalGain: CapitalGainResult;
    outstandingMortgage: number;
    netProceeds: number;
  };
  taxPayments: TaxPayment[];
  /** Solo si el inversor no reside en España */
  nonResident?: NonResidentResult;
  warnings: string[];
}
