"use client";
/**
 * Formulario multipaso de InversionZ.
 *  - Un único estado `draft` con la forma de InvestmentInput.
 *  - Cada paso valida SOLO su sección con Zod antes de avanzar.
 *  - El borrador se guarda en localStorage en cada cambio.
 *  - Vistas previas en vivo con el propio motor (impuestos de compra, cuota hipoteca, reducción IRPF).
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { InvestmentInput, RentalType, PropertyCondition } from "@/types/investment";
import { EXAMPLE_INPUT, STORAGE_KEY } from "@/lib/defaults";
import { getProvinceFromPostalCode } from "@/lib/tax/provinces";
import { buildMortgageSchedule, computeAcquisitionTaxes, resolveRentalReduction } from "@/lib/engine/calculationEngine";
import { STEP_SCHEMAS, investmentInputSchema, validateSection, type FieldErrors } from "@/lib/validation/schemas";
import { eur, pct } from "@/lib/format";
import { Button, NumberField, Segmented, TextField, Toggle, cn } from "@/components/ui/primitives";
import { CatastroLookup } from "./CatastroLookup";

const DRAFT_KEY = "inversionq:borrador";

const EMPTY: InvestmentInput = {
  property: { address: { street: "", number: "", staircase: "", floor: "", door: "" }, postalCode: "", municipality: "", surfaceM2: undefined as unknown as number, condition: "BUEN_ESTADO",
    purchasePrice: undefined as unknown as number, cadastralValueTotal: undefined as unknown as number, cadastralValueLand: undefined as unknown as number },
  acquisition: { renovationCost: 0, furnitureCost: 0, notaryFees: 900, registryFees: 600, agencyFees: 400, buyerAgencyCommission: 0, renovationIsImprovement: true },
  financing: { enabled: false, loanToValue: 0.8, termYears: 30, annualInterestRate: 0.0275, openingFee: 0 },
  rental: { monthlyRent: undefined as unknown as number, rentalType: "VIVIENDA_HABITUAL", vacancyRate: 0.04, annualRentGrowth: 0.02, annualExpenseGrowth: 0.02,
    annualExpenses: { ibi: 0, wasteTax: 0, parkingVado: 0, community: 0, homeInsurance: 0, defaultInsurance: 0, maintenance: 0, managementFeePct: 0, other: 0 },
    reduction: "AUTO", reductionFlags: {}, investorGeneralTaxBase: undefined as unknown as number, investorSavingsTaxBaseInSaleYear: 0 },
  sale: { yearsUntilSale: 10, estimatedSalePrice: undefined as unknown as number, saleCommissionPct: 0.03, otherSaleCosts: 0 },
};

const STEPS = [
  { key: "property", title: "Inmueble", intro: "Dirección exacta, estado y valores del inmueble. Los valores catastrales están en el recibo del IBI." },
  { key: "acquisition", title: "Compra", intro: "Gastos de la compra. El impuesto (ITP o IVA + AJD) se calcula solo según la provincia y el estado." },
  { key: "financing", title: "Hipoteca", intro: "Déjalo desactivado si compras al contado." },
  { key: "rental", title: "Alquiler y gastos", intro: "Renta, gastos fijos del inmueble y el resto de gastos anuales. Tu base imponible sirve para saber a qué tipo tributará el alquiler." },
  { key: "sale", title: "Venta", intro: "Cuándo y por cuánto venderías. Con esto calculamos la plusvalía municipal y el IRPF de la venta." },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

export function Wizard() {
  const router = useRouter();
  const [draft, setDraft] = useState<InvestmentInput>(EMPTY);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loaded, setLoaded] = useState(false);

  // Recuperar borrador
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        setDraft({
          ...EMPTY, ...d,
          property: { ...EMPTY.property, ...d.property, address: { ...EMPTY.property.address!, ...d.property?.address } },
          acquisition: { ...EMPTY.acquisition, ...d.acquisition },
          financing: { ...EMPTY.financing!, ...d.financing },
          rental: { ...EMPTY.rental, ...d.rental, annualExpenses: { ...EMPTY.rental.annualExpenses, ...d.rental?.annualExpenses } },
          sale: { ...EMPTY.sale, ...d.sale },
        });
      }
    } catch { /* almacenamiento no disponible */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* sin almacenamiento */ }
  }, [draft, loaded]);

  // Setters por sección
  const set = <S extends keyof InvestmentInput>(section: S, patch: Partial<NonNullable<InvestmentInput[S]>>) =>
    setDraft((d) => ({ ...d, [section]: { ...(d[section] as object), ...patch } }));
  const setExp = (patch: Partial<InvestmentInput["rental"]["annualExpenses"]>) =>
    setDraft((d) => ({ ...d, rental: { ...d.rental, annualExpenses: { ...d.rental.annualExpenses, ...patch } } }));
  const setAddr = (patch: Partial<NonNullable<InvestmentInput["property"]["address"]>>) =>
    setDraft((d) => ({ ...d, property: { ...d.property, address: { street: "", number: "", ...d.property.address, ...patch } } }));
  const setFlags = (patch: NonNullable<InvestmentInput["rental"]["reductionFlags"]>) =>
    setDraft((d) => ({ ...d, rental: { ...d.rental, reductionFlags: { ...d.rental.reductionFlags, ...patch } } }));
  const err = (path: string) => errors[path];

  const current = STEPS[step];
  const province = useMemo(() => getProvinceFromPostalCode(draft.property.postalCode ?? ""), [draft.property.postalCode]);

  // Vista previa de impuestos de compra
  const acqPreview = useMemo(() => {
    if (!province || !(draft.property.purchasePrice > 0)) return null;
    try { return computeAcquisitionTaxes(draft, province, []); } catch { return null; }
  }, [draft, province]);

  const mortgagePreview = useMemo(() => {
    const f = draft.financing;
    if (!f?.enabled || !(draft.property.purchasePrice > 0) || !(f.termYears > 0)) return null;
    return buildMortgageSchedule(draft.property.purchasePrice * f.loanToValue, f.annualInterestRate ?? 0, f.termYears);
  }, [draft.financing, draft.property.purchasePrice]);

  const reduction = useMemo(() => resolveRentalReduction(draft.rental), [draft.rental]);
  const e0 = draft.rental.annualExpenses;
  const fixedTotal = (e0.ibi ?? 0) + (e0.community ?? 0) + (e0.wasteTax ?? 0) + (e0.parkingVado ?? 0);

  function validateStep(key: StepKey): boolean {
    if (key === "financing" && !draft.financing?.enabled) { setErrors({}); return true; }
    const e = validateSection(key, draft[key]);
    if (key === "property" && !province) e["property.postalCode"] = "Código postal no reconocido";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep(current.key)) return;
    if (step < STEPS.length - 1) { setStep(step + 1); window.scrollTo({ top: 0 }); return; }
    // Último paso: validación completa y navegación a resultados
    const payload: InvestmentInput = { ...draft, financing: draft.financing?.enabled ? draft.financing : { ...draft.financing!, enabled: false } };
    const res = investmentInputSchema.safeParse(payload);
    if (!res.success) {
      const firstSection = String(res.error.issues[0].path[0]);
      const idx = STEPS.findIndex((s) => s.key === firstSection);
      if (idx >= 0) { setStep(idx); validateStep(STEPS[idx].key); }
      return;
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch { /* sin almacenamiento */ }
    router.push("/analisis/resultado");
  }

  function goTo(i: number) {
    // Solo se puede saltar hacia atrás o a pasos ya válidos
    if (i < step) { setErrors({}); setStep(i); return; }
    for (let k = step; k < i; k++) if (!validateStep(STEPS[k].key)) { setStep(k); return; }
    setStep(i);
  }

  const isNew = draft.property.condition === "OBRA_NUEVA";

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[220px_1fr]">
      {/* Pasos: es una secuencia real, por eso van numerados */}
      <nav aria-label="Pasos del análisis" className="lg:sticky lg:top-8 lg:self-start">
        <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <button type="button" onClick={() => goTo(i)} aria-current={i === step ? "step" : undefined}
                className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap",
                  i === step ? "bg-tinta text-papel" : "text-tinta-2 hover:bg-papel-2")}>
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-sm border text-xs font-semibold",
                  i === step ? "border-papel/40" : i < step ? "border-parcela bg-parcela text-white" : "border-linea")}>{i + 1}</span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="no-print mt-6 hidden text-xs text-tinta-3 underline-offset-2 hover:underline lg:block"
          onClick={() => { setDraft(EXAMPLE_INPUT); setErrors({}); }}>
          Rellenar con un ejemplo
        </button>
      </nav>

      <section aria-labelledby="step-title" className="min-w-0">
        <p className="text-sm text-tinta-3">Paso {step + 1} de {STEPS.length}</p>
        <h1 id="step-title" className="mt-1 text-3xl font-semibold tracking-tight">{current.title}</h1>
        <p className="mt-2 max-w-[60ch] text-tinta-2">{current.intro}</p>

        <div className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {current.key === "property" && (<>
            <TextField label="Calle" className="sm:col-span-2" placeholder="Calle de Embajadores" value={draft.property.address?.street ?? ""}
              onChange={(v) => setAddr({ street: v })} error={err("property.address.street")} hint="Tipo de vía y nombre, tal como aparece en la escritura o el recibo del IBI" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:col-span-2 sm:grid-cols-4">
              <TextField label="Número" value={draft.property.address?.number ?? ""} maxLength={10} onChange={(v) => setAddr({ number: v })} error={err("property.address.number")} />
              <TextField label="Escalera" value={draft.property.address?.staircase ?? ""} maxLength={20} onChange={(v) => setAddr({ staircase: v })} hint="Si la hay" />
              <TextField label="Piso" placeholder="3, Bajo, Ático" value={draft.property.address?.floor ?? ""} maxLength={20} onChange={(v) => setAddr({ floor: v })} />
              <TextField label="Puerta" placeholder="B, Izda." value={draft.property.address?.door ?? ""} maxLength={20} onChange={(v) => setAddr({ door: v })} />
            </div>
            <TextField label="Código postal" value={draft.property.postalCode} inputMode="numeric" maxLength={5}
              onChange={(v) => set("property", { postalCode: v.replace(/\D/g, "") })} error={err("property.postalCode")}
              hint={province ? `${province.name}, ${province.ccaaName}` : "Detectamos la provincia y la comunidad automáticamente"} />
            <TextField label="Municipio" value={draft.property.municipality ?? ""} onChange={(v) => set("property", { municipality: v })}
              hint="Sirve para aplicar el tipo de plusvalía municipal" />
            <CatastroLookup property={draft.property} provinceCode={province?.code}
              onApply={(u) => setDraft((d) => ({ ...d, property: {
                ...d.property,
                surfaceM2: u.builtArea ?? d.property.surfaceM2,
                cadastre: { refCat: u.refCat, use: u.use, yearBuilt: u.yearBuilt, builtArea: u.builtArea, participationPct: u.participationPct },
                address: { street: "", number: "", ...d.property.address,
                  floor: d.property.address?.floor || (u.floor ? String(/^\d+$/.test(u.floor) ? Number(u.floor) : u.floor) : ""),
                  door: d.property.address?.door || u.door },
              } }))} />
            <div className="sm:col-span-2">
              <Segmented<PropertyCondition> label="Estado del inmueble" value={draft.property.condition}
                onChange={(v) => set("property", { condition: v })}
                options={[
                  { value: "A_REFORMAR", label: "A reformar", description: "Segunda mano, paga ITP" },
                  { value: "BUEN_ESTADO", label: "Buen estado", description: "Segunda mano, paga ITP" },
                  { value: "OBRA_NUEVA", label: "Obra nueva", description: "De promotor, paga IVA y AJD" },
                ]} />
            </div>
            <NumberField label="Precio de compra" unit="€" decimals={0} value={draft.property.purchasePrice} onChange={(v) => set("property", { purchasePrice: v as number })} error={err("property.purchasePrice")} />
            <NumberField label="Superficie construida" unit="m²" decimals={0} value={draft.property.surfaceM2} onChange={(v) => set("property", { surfaceM2: v as number })} error={err("property.surfaceM2")}
              hint={draft.property.cadastre?.builtArea ? "Según el Catastro (incluye la parte proporcional de zonas comunes)" : undefined} />
            <NumberField label="Valor catastral total" unit="€" hint="En el recibo del IBI" decimals={0} value={draft.property.cadastralValueTotal} onChange={(v) => set("property", { cadastralValueTotal: v as number })} error={err("property.cadastralValueTotal")} />
            <NumberField label="Valor catastral del suelo" unit="€" decimals={0} value={draft.property.cadastralValueLand} onChange={(v) => set("property", { cadastralValueLand: v as number })} error={err("property.cadastralValueLand")} />
            <NumberField label="Valor de referencia de Catastro" unit="€" decimals={0} value={draft.property.cadastralReferenceValue} onChange={(v) => set("property", { cadastralReferenceValue: v })}
              hint="Opcional. Si supera el precio, el ITP se calcula sobre este valor" />
            {isNew && <div className="self-end pb-2"><Toggle label="Vivienda de protección oficial" description="IVA del 4 % en lugar del 10 %" checked={!!draft.property.isProtectedHousing} onChange={(v) => set("property", { isProtectedHousing: v })} /></div>}
          </>)}

          {current.key === "acquisition" && (<>
            <NumberField label="Reforma" unit="€" decimals={0} value={draft.acquisition.renovationCost} onChange={(v) => set("acquisition", { renovationCost: v ?? 0 })} error={err("acquisition.renovationCost")} />
            <NumberField label="Mobiliario y electrodomésticos" unit="€" decimals={0} value={draft.acquisition.furnitureCost} onChange={(v) => set("acquisition", { furnitureCost: v ?? 0 })} />
            <NumberField label="Notaría" unit="€" decimals={0} value={draft.acquisition.notaryFees} onChange={(v) => set("acquisition", { notaryFees: v ?? 0 })} />
            <NumberField label="Registro de la Propiedad" unit="€" decimals={0} value={draft.acquisition.registryFees} onChange={(v) => set("acquisition", { registryFees: v ?? 0 })} />
            <NumberField label="Gestoría y tasación" unit="€" decimals={0} value={draft.acquisition.agencyFees} onChange={(v) => set("acquisition", { agencyFees: v ?? 0 })} />
            <NumberField label="Honorarios de búsqueda o agencia" unit="€" decimals={0} value={draft.acquisition.buyerAgencyCommission} onChange={(v) => set("acquisition", { buyerAgencyCommission: v ?? 0 })} hint="Personal shopper o agencia que te cobra a ti" />
            <div className="sm:col-span-2">
              <Toggle label="La reforma es una mejora" checked={draft.acquisition.renovationIsImprovement ?? true} onChange={(v) => set("acquisition", { renovationIsImprovement: v })}
                description="Actívalo si la reforma aumenta el valor de la vivienda (cocina, baños, instalaciones). Se amortiza al 3 % y reduce el IRPF de la venta. Si solo es reparación, se deduce el primer año." />
            </div>
            <Preview title="Impuesto de compra">
              {acqPreview && province ? (<>
                <PreviewRow label={acqPreview.regime === "ITP" ? "ITP (Transmisiones Patrimoniales)" : acqPreview.breakdown} value={eur(acqPreview.total)} strong />
                <PreviewRow label="Tipo efectivo sobre el precio" value={pct(acqPreview.effectiveRate)} />
                <PreviewRow label="Se paga en" value={province.transferTaxAuthority} />
              </>) : <p className="text-sm text-tinta-3">Completa el código postal y el precio en el paso 1.</p>}
            </Preview>
          </>)}

          {current.key === "financing" && (<>
            <div className="sm:col-span-2">
              <Toggle label="Compro con hipoteca" checked={!!draft.financing?.enabled} onChange={(v) => set("financing", { enabled: v })} />
            </div>
            {draft.financing?.enabled && (<>
              <NumberField label="Financiación sobre el precio" unit="%" percent decimals={1} value={draft.financing.loanToValue} onChange={(v) => set("financing", { loanToValue: v as number })} error={err("financing.loanToValue")} hint="Para inversión, los bancos suelen dar hasta el 70–80 %" />
              <NumberField label="Plazo" unit="años" decimals={0} value={draft.financing.termYears} onChange={(v) => set("financing", { termYears: v as number })} error={err("financing.termYears")} />
              <NumberField label="Tipo de interés (TIN)" unit="%" percent decimals={2} value={draft.financing.annualInterestRate} onChange={(v) => set("financing", { annualInterestRate: v as number })} error={err("financing.annualInterestRate")} />
              <NumberField label="Comisión de apertura" unit="€" decimals={0} value={draft.financing.openingFee} onChange={(v) => set("financing", { openingFee: v ?? 0 })} />
              {mortgagePreview && (
                <Preview title="Tu hipoteca">
                  <PreviewRow label="Importe del préstamo" value={eur(mortgagePreview.principal)} />
                  <PreviewRow label="Cuota mensual" value={eur(mortgagePreview.monthlyPayment, true)} strong />
                  <PreviewRow label="Intereses el primer año" value={eur(mortgagePreview.years[0].interest)} />
                </Preview>
              )}
            </>)}
          </>)}

          {current.key === "rental" && (<>
            <div className="sm:col-span-2">
              <Segmented<RentalType> label="Tipo de alquiler" value={draft.rental.rentalType} onChange={(v) => set("rental", { rentalType: v })}
                options={[
                  { value: "VIVIENDA_HABITUAL", label: "Vivienda habitual", description: "Larga duración, con reducción" },
                  { value: "TEMPORADA", label: "Temporada", description: "Estudiantes, trabajo" },
                  { value: "TURISTICO", label: "Turístico", description: "Por días o semanas" },
                ]} />
            </div>
            <NumberField label="Renta mensual" unit="€/mes" decimals={0} value={draft.rental.monthlyRent} onChange={(v) => set("rental", { monthlyRent: v as number })} error={err("rental.monthlyRent")} />
            <NumberField label="Tiempo sin alquilar" unit="%" percent decimals={1} value={draft.rental.vacancyRate} onChange={(v) => set("rental", { vacancyRate: v ?? 0 })} hint="4 % ≈ dos semanas al año" error={err("rental.vacancyRate")} />
            <fieldset className="sm:col-span-2 rounded-md border border-linea bg-white p-5">
              <legend className="px-1 text-sm font-medium">Gastos fijos del inmueble</legend>
              <p className="mb-4 text-xs text-tinta-3">Importes anuales. Los encontrarás en los recibos del ayuntamiento y en las cuotas de la comunidad.</p>
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <NumberField label="IBI" unit="€/año" decimals={0} value={draft.rental.annualExpenses.ibi} onChange={(v) => setExp({ ibi: v ?? 0 })} error={err("rental.annualExpenses.ibi")} />
                <NumberField label="Comunidad de propietarios" unit="€/año" decimals={0} value={draft.rental.annualExpenses.community} onChange={(v) => setExp({ community: v ?? 0 })} hint="Cuota mensual × 12, más derramas previstas" />
                <NumberField label="Tasa de basuras" unit="€/año" decimals={0} value={draft.rental.annualExpenses.wasteTax} onChange={(v) => setExp({ wasteTax: v ?? 0 })} hint="Tasa municipal de residuos, si tu ayuntamiento la cobra aparte" />
                <NumberField label="Vado de aparcamiento" unit="€/año" decimals={0} value={draft.rental.annualExpenses.parkingVado} onChange={(v) => setExp({ parkingVado: v ?? 0 })} hint="Solo si el inmueble tiene garaje con vado a tu nombre" />
              </div>
              {fixedTotal > 0 && (
                <p className="mt-4 text-sm" aria-live="polite">
                  Total gastos fijos: <strong>{eur(fixedTotal)} al año</strong> ({eur(fixedTotal / 12)} al mes)
                  {draft.rental.monthlyRent > 0 && <>, el {pct(fixedTotal / (draft.rental.monthlyRent * 12), 1)} de la renta anual</>}.
                </p>
              )}
            </fieldset>
            <NumberField label="Seguro de hogar" unit="€/año" decimals={0} value={draft.rental.annualExpenses.homeInsurance} onChange={(v) => setExp({ homeInsurance: v ?? 0 })} />
            <NumberField label="Seguro de impago" unit="€/año" decimals={0} value={draft.rental.annualExpenses.defaultInsurance} onChange={(v) => setExp({ defaultInsurance: v ?? 0 })} />
            <NumberField label="Mantenimiento y reparaciones" unit="€/año" decimals={0} value={draft.rental.annualExpenses.maintenance} onChange={(v) => setExp({ maintenance: v ?? 0 })} />
            <NumberField label="Gestión del alquiler" unit="%" percent decimals={1} value={draft.rental.annualExpenses.managementFeePct} onChange={(v) => setExp({ managementFeePct: v ?? 0 })} hint="Sobre la renta cobrada, si lo gestiona una agencia" />
            <NumberField label="Otros gastos" unit="€/año" decimals={0} value={draft.rental.annualExpenses.other} onChange={(v) => setExp({ other: v ?? 0 })} hint="Suministros a tu cargo u otros" />
            <NumberField label="Subida anual de la renta" unit="%" percent decimals={1} value={draft.rental.annualRentGrowth} onChange={(v) => set("rental", { annualRentGrowth: v ?? 0 })} />
            <NumberField label="Tu base imponible general" unit="€/año" decimals={0} value={draft.rental.investorGeneralTaxBase} onChange={(v) => set("rental", { investorGeneralTaxBase: v as number })} error={err("rental.investorGeneralTaxBase")}
              hint="Aproximadamente tu sueldo bruto menos Seguridad Social, sin este piso" className="sm:col-span-2" />

            {draft.rental.rentalType === "VIVIENDA_HABITUAL" && (
              <fieldset className="sm:col-span-2 rounded-md border border-linea bg-white p-5">
                <legend className="px-1 text-sm font-medium">Reducción del IRPF por alquiler de vivienda</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Toggle label="Contrato firmado antes del 26/05/2023" checked={!!draft.rental.reductionFlags?.contractSignedBefore26May2023} onChange={(v) => setFlags({ contractSignedBefore26May2023: v })} />
                  <Toggle label="Zona de mercado tensionado" checked={!!draft.rental.reductionFlags?.stressedArea} onChange={(v) => setFlags({ stressedArea: v })} />
                  {draft.rental.reductionFlags?.stressedArea && (<>
                    <Toggle label="La renta baja más de un 5 % respecto al contrato anterior" checked={!!draft.rental.reductionFlags?.rentReducedAtLeast5Pct} onChange={(v) => setFlags({ rentReducedAtLeast5Pct: v })} />
                    <Toggle label="Inquilino de 18 a 35 años (primer alquiler en zona tensionada)" checked={!!draft.rental.reductionFlags?.tenantAged18to35} onChange={(v) => setFlags({ tenantAged18to35: v })} />
                  </>)}
                  <Toggle label="Vivienda rehabilitada en los últimos 2 años" checked={!!draft.rental.reductionFlags?.rehabilitatedLast2Years} onChange={(v) => setFlags({ rehabilitatedLast2Years: v })} />
                </div>
                <p className="mt-4 text-sm">Reducción aplicable sobre el rendimiento neto: <strong>{pct(reduction.rate, 0)}</strong></p>
              </fieldset>
            )}
          </>)}

          {current.key === "sale" && (<>
            <NumberField label="Años hasta la venta" unit="años" decimals={0} value={draft.sale.yearsUntilSale} onChange={(v) => set("sale", { yearsUntilSale: v as number })} error={err("sale.yearsUntilSale")} />
            <NumberField label="Precio de venta estimado" unit="€" decimals={0} value={draft.sale.estimatedSalePrice} onChange={(v) => set("sale", { estimatedSalePrice: v as number })} error={err("sale.estimatedSalePrice")} />
            <NumberField label="Comisión de la agencia en la venta" unit="%" percent decimals={1} value={draft.sale.saleCommissionPct} onChange={(v) => set("sale", { saleCommissionPct: v ?? 0 })} />
            <NumberField label="Tipo de la plusvalía municipal" unit="%" percent decimals={2} value={draft.sale.municipalCapitalGainRate} onChange={(v) => set("sale", { municipalCapitalGainRate: v })} error={err("sale.municipalCapitalGainRate")}
              hint="Opcional. Si lo dejas vacío usamos el de tu ayuntamiento si lo conocemos, o el máximo legal (30 %)" />
            <NumberField label="Otras ganancias o rentas del ahorro ese año" unit="€" decimals={0} value={draft.rental.investorSavingsTaxBaseInSaleYear}
              onChange={(v) => set("rental", { investorSavingsTaxBaseInSaleYear: v ?? 0 })} hint="Dividendos, intereses, otras ventas. Afecta al tramo del IRPF de la venta" />

            <fieldset className="sm:col-span-2 rounded-md border border-linea bg-white p-5">
              <legend className="px-1 text-sm font-medium">IRPF del vendedor: ¿es su vivienda habitual?</legend>
              <div className="mt-1">
                <Segmented<"NO" | "SI"> label="Cuando la vendas, ¿será tu vivienda habitual?" value={draft.sale.sellerHabitualResidence ? "SI" : "NO"}
                  onChange={(v) => set("sale", { sellerHabitualResidence: v === "SI" })}
                  hint="Vivienda habitual: has vivido en ella al menos 3 años seguidos. Si la tienes alquilada, no lo es."
                  options={[
                    { value: "NO", label: "Vivienda no habitual", description: "Inversión o segunda residencia" },
                    { value: "SI", label: "Vivienda habitual", description: "Vives en ella" },
                  ]} />
              </div>
              {draft.sale.sellerHabitualResidence && (
                <div className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <div className="self-center">
                    <Toggle label="Tendré 65 años o más al vender" checked={!!draft.sale.sellerAged65Plus} onChange={(v) => set("sale", { sellerAged65Plus: v })}
                      description="La ganancia queda exenta por completo" />
                  </div>
                  {!draft.sale.sellerAged65Plus && (
                    <NumberField label="Reinvertiré en otra vivienda habitual" unit="€" decimals={0} value={draft.sale.reinvestmentAmount}
                      onChange={(v) => set("sale", { reinvestmentAmount: v })}
                      hint="Importe que destinarás a comprar tu nueva vivienda habitual en los 2 años siguientes. Queda exenta la parte proporcional" />
                  )}
                </div>
              )}
            </fieldset>
          </>)}
        </div>

        <div className="mt-10 flex items-center justify-between border-t border-linea pt-6">
          <Button variant="ghost" onClick={() => { setErrors({}); setStep(Math.max(0, step - 1)); }} disabled={step === 0}>Atrás</Button>
          <div className="flex items-center gap-4">
            {Object.keys(errors).length > 0 && <p role="alert" className="text-sm text-sello">Revisa los campos marcados</p>}
            <Button size="lg" onClick={next}>{step === STEPS.length - 1 ? "Ver el análisis" : "Siguiente"}</Button>
          </div>
        </div>
        <button type="button" className="mt-6 text-xs text-tinta-3 hover:underline lg:hidden" onClick={() => { setDraft(EXAMPLE_INPUT); setErrors({}); }}>
          Rellenar con un ejemplo
        </button>
      </section>
    </div>
  );
}

function Preview({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="sm:col-span-2 rounded-md border-l-4 border-plano bg-plano-claro/60 px-5 py-4" aria-live="polite">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <dl className="grid gap-1.5">{children}</dl>
    </aside>
  );
}
function PreviewRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-tinta-2">{label}</dt>
      <dd className={cn("text-right", strong && "text-base font-semibold")}>{value}</dd>
    </div>
  );
}

// Exportado para tests de esquema
export { STEP_SCHEMAS };
