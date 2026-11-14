/** POST /api/analyze — InvestmentInput (JSON) -> InvestmentAnalysisResult */
import { NextResponse } from "next/server";
import { investmentInputSchema } from "@/lib/validation/schemas";
import { runInvestmentAnalysis, ValidationError } from "@/lib/engine/calculationEngine";
import type { InvestmentInput } from "@/types/investment";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = investmentInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos", issues: parsed.error.issues }, { status: 400 });
  try {
    return NextResponse.json(runInvestmentAnalysis(parsed.data as InvestmentInput));
  } catch (e) {
    const status = e instanceof ValidationError ? 400 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
