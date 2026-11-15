/** POST /api/lead — envía a angel.martin@bminversiones.es los datos de un formulario completado. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendLead } from "@/lib/leads/sendLead";

const schema = z.object({
  tool: z.enum(["analisis", "valoracion", "rentabilidad"]),
  data: z.record(z.string(), z.unknown()),
  summary: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
  contact: z.object({
    name: z.string().max(120).optional(),
    email: z.string().max(160).optional(),
    phone: z.string().max(40).optional(),
    message: z.string().max(1000).optional(),
  }).optional(),
  page: z.string().max(200).optional(),
  website: z.string().optional(), // trampa anti-bots: debe llegar vacío
});

// Límite sencillo por IP (memoria de la instancia): 20 envíos cada 10 minutos
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 60_000) return NextResponse.json({ error: "Demasiado grande" }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON no válido" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ ok: true }); // bot

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });

  const { website: _ignored, ...lead } = parsed.data;
  void _ignored;
  const result = await sendLead(lead);
  return NextResponse.json({ ok: true, ...result }, { status: result.sent ? 200 : 202 });
}
