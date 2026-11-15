# InversionZ

Análisis de inversión inmobiliaria en España: ITP/IVA por provincia, IRPF del alquiler año a año, plusvalía municipal y ganancia patrimonial en la venta, con informe ejecutivo en PDF.

## Puesta en marcha en local

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests del motor fiscal
npm run build      # build de producción
```

Requiere Node 20 o superior.

## Despliegue en Vercel (5 minutos)

1. Sube este proyecto a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New… → Project** → importa el repositorio.
3. Deja la configuración por defecto (Framework: Next.js). No hace falta ninguna variable de entorno.
4. **Deploy**. Cada `git push` a `main` vuelve a desplegar.
5. Opcional: en **Settings → Domains** añade tu dominio (p. ej. `app.inversionq.es`).

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Tipos de ITP, AJD, IRPF, coeficientes de plusvalía | `src/lib/tax/taxTables.ts` (único fichero a actualizar cuando cambie la normativa) |
| Provincias y Hacienda receptora del ITP | `src/lib/tax/provinces.ts` |
| Motor de cálculo | `src/lib/engine/calculationEngine.ts` |
| Formulario | `src/components/form/Wizard.tsx` |
| Dashboard | `src/components/dashboard/` |
| Informe PDF | `src/components/report/ReportDocument.tsx` y `src/app/api/report/route.tsx` |
| Valoración de mercado (mock) | `src/lib/avm/avmService.ts` |

Arquitectura y decisiones: `ARQUITECTURA.md`.

## API

- `POST /api/analyze` — cuerpo `InvestmentInput` (JSON) → `InvestmentAnalysisResult`.
- `POST /api/report` — cuerpo `InvestmentInput` (JSON) → PDF.

## Aviso

Cálculo orientativo con la normativa vigente en la versión de tablas indicada en cada informe. No sustituye el asesoramiento fiscal profesional.
