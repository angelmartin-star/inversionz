/** POST /api/report — InvestmentInput (JSON) -> PDF (application/pdf) */
import { renderToBuffer } from "@react-pdf/renderer";
import { investmentInputSchema } from "@/lib/validation/schemas";
import { runInvestmentAnalysis, ValidationError } from "@/lib/engine/calculationEngine";
import { ReportDocument } from "@/components/report/ReportDocument";
import type { InvestmentInput } from "@/types/investment";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = investmentInputSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Datos no válidos" }, { status: 400 });
  try {
    const input = parsed.data as InvestmentInput;
    const result = runInvestmentAnalysis(input);
    const pdf = await renderToBuffer(<ReportDocument input={input} result={result} />);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="InversionZ-${input.property.postalCode}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const status = e instanceof ValidationError ? 400 : 500;
    return Response.json({ error: (e as Error).message }, { status });
  }
}
