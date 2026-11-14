# InversionQ — Arquitectura (MVP: fases 1, 2 y 3)

## Decisiones de stack
- **Todo en Next.js + TypeScript** (sin FastAPI): el motor es puro TS, se reutiliza en cliente (recálculo en vivo) y en servidor (API + PDF). Un único lenguaje y un único despliegue (Vercel).
- **PDF: React-PDF (`@react-pdf/renderer`) en servidor.** Se descartó Puppeteer: en Vercel exige empaquetar Chromium (arranques lentos, límites de memoria y tamaño). React-PDF genera un PDF vectorial en ~1 s sin navegador; los gráficos se dibujan con primitivas SVG.
- **Sin base de datos en el MVP**: el análisis vive en el navegador (localStorage) y el PDF se genera enviando los datos a `/api/report`. Añadir Supabase/Postgres cuando haya cuentas de usuario y pago.
- **Validación**: Zod en el borde (formulario y API). El motor también valida (`validateInput`).

## Estructura de carpetas
```
inversionq/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── (marketing)/page.tsx          # landing
│   │   ├── page.tsx                      # ✅ portada con ejemplo calculado en vivo
│   │   ├── analisis/
│   │   │   ├── nuevo/page.tsx            # ✅ formulario en 5 pasos
│   │   │   └── resultado/page.tsx        # ✅ dashboard de resultados
│   │   └── api/
│   │       ├── analyze/route.ts          # ✅ POST InvestmentInput -> InvestmentAnalysisResult (JSON)
│   │       └── report/route.tsx          # ✅ POST InvestmentInput -> PDF
│   ├── assets/fonts/                     # ✅ IBM Plex Sans para el PDF
│   ├── components/
│   │   ├── ui/primitives.tsx             # ✅ botones, campos numéricos es-ES, toggles
│   │   ├── form/Wizard.tsx               # ✅ formulario multipaso con vistas previas en vivo
│   │   ├── dashboard/                    # ✅ Ledger (cuenta del año 1), CashflowChart, ResultsView
│   │   └── report/ReportDocument.tsx     # ✅ plantilla del informe PDF (3 páginas A4)
│   ├── lib/
│   │   ├── engine/calculationEngine.ts   # ✅ MOTOR (funciones puras)
│   │   ├── tax/taxTables.ts              # ✅ PARÁMETROS FISCALES (único sitio a actualizar)
│   │   ├── tax/provinces.ts              # ✅ 52 provincias, CCAA y Hacienda receptora
│   │   ├── avm/avmService.ts             # ✅ AVM (mock + interfaz para Idealista/Tinsa/Catastro)
│   │   ├── validation/schemas.ts         # ✅ Zod (formulario y API)
│   │   ├── format.ts                     # ✅ €, %, parseo de números en formato español
│   │   ├── defaults.ts                   # ✅ caso de ejemplo
│   │   └── ui.ts                         # ✅ cn() y variantes de botón
│   └── types/investment.ts               # ✅ ESQUEMA DE DATOS
├── tests/engine.test.ts                  # ✅ tests del motor
└── ARQUITECTURA.md
```

## Flujo de cálculo
CP → provincia/CCAA → impuestos de compra (ITP | IVA/IGIC + AJD) → inversión total → hipoteca (francés) → proyección anual con IRPF (límite de gastos y arrastre a 4 años, amortización 3 % + mobiliario 10 %, reducción del 50–90 %) → venta (IIVTNU por el método más favorable + ganancia en la base del ahorro) → KPIs (rentabilidades, cashflow, ROCE, TIR) → calendario de pagos a Hacienda.

## Mantenimiento fiscal
- Todo está en `taxTables.ts`, con `verified` y `source` por tabla. Lo que no está verificado genera un aviso en `result.warnings`.
- Hay que revisarlo cada 1 de enero y con cada Real Decreto-ley sobre plusvalía municipal.
- Pendiente: escalas autonómicas de IRPF distintas de Madrid, tipos reducidos de ITP, régimen foral de IRPF e IPSI.
