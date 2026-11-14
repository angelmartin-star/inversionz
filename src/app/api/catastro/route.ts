/**
 * POST /api/catastro
 *  { refCat } -> busca por referencia catastral
 *  { provinceCode, municipality, street, number, staircase?, floor?, door?, streetType?, streetName? } -> por dirección
 */
import { z } from "zod";
import { CatastroError, lookupByAddress, lookupByRefCat } from "@/lib/catastro/catastroClient";

export const runtime = "nodejs";

const bodySchema = z.union([
  z.object({ refCat: z.string().min(14).max(25) }),
  z.object({
    provinceCode: z.string().regex(/^\d{2}$/), municipality: z.string().max(80), street: z.string().min(2).max(120),
    number: z.string().min(1).max(10), staircase: z.string().max(20).optional(), floor: z.string().max(20).optional(),
    door: z.string().max(20).optional(), streetType: z.string().max(4).optional(), streetName: z.string().max(120).optional(),
  }),
]);

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Faltan datos de la dirección o la referencia catastral." }, { status: 400 });
  try {
    const result = "refCat" in parsed.data ? await lookupByRefCat(parsed.data.refCat) : await lookupByAddress(parsed.data);
    return Response.json(result);
  } catch (e) {
    if (e instanceof CatastroError) {
      const status = e.code === "NO_DISPONIBLE" ? 503 : e.code === "NO_ENCONTRADO" ? 404 : 422;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    return Response.json({ error: "Error inesperado consultando el Catastro." }, { status: 500 });
  }
}
