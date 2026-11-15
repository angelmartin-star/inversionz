/**
 * Envío por correo de los datos que el usuario introduce en las herramientas.
 * Usa la API REST de Resend (https://resend.com), sin dependencias.
 *
 * Variables de entorno (Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY  obligatoria. Sin ella no se envía nada (se registra en el log).
 *   LEAD_TO         destinatario. Por defecto contacto@bminversiones.es
 *   LEAD_FROM       remitente. Por defecto "InversionZ <onboarding@resend.dev>"
 *                   (solo entrega a la dirección con la que se creó la cuenta de Resend;
 *                   con el dominio bminversiones.es verificado, usar p. ej. avisos@bminversiones.es)
 */

export type LeadTool = "analisis" | "valoracion" | "rentabilidad";

export interface LeadContact { name?: string; email?: string; phone?: string; message?: string }

export interface LeadPayload {
  tool: LeadTool;
  data: Record<string, unknown>;
  summary?: Record<string, string | number | null>;
  contact?: LeadContact;
  page?: string;
}

const TOOL_LABEL: Record<LeadTool, string> = {
  analisis: "Análisis de inversión",
  valoracion: "Valoración de inmueble",
  rentabilidad: "Rentabilidad rápida",
};

/** Etiquetas legibles para las claves más habituales. */
const LABELS: Record<string, string> = {
  property: "Inmueble", acquisition: "Compra", financing: "Financiación", rental: "Alquiler", sale: "Venta",
  subject: "Inmueble", comparables: "Testigos", demand: "Demanda", settings: "Ajustes",
  address: "Dirección", street: "Calle", number: "Número", staircase: "Escalera", floor: "Planta", door: "Puerta",
  postalCode: "Código postal", municipality: "Municipio", cadastralReference: "Referencia catastral",
  surfaceM2: "Superficie (m²)", areaM2: "Superficie (m²)", condition: "Estado", purchasePrice: "Precio de compra",
  monthlyRent: "Alquiler mensual", annualExpenses: "Gastos anuales", ibi: "IBI", community: "Comunidad",
  wasteTax: "Basuras", parkingVado: "Vado", insurance: "Seguro", nonPaymentInsurance: "Seguro de impago",
  maintenance: "Mantenimiento", rentalType: "Tipo de alquiler", loanToValue: "% financiado", termYears: "Plazo (años)",
  annualInterestRate: "Tipo de interés", enabled: "Activa", yearsUntilSale: "Años hasta la venta",
  estimatedSalePrice: "Precio de venta estimado", sellerHabitualResidence: "Vivienda habitual del vendedor",
  sellerAged65Plus: "Vendedor con 65 años o más", reinvestmentAmount: "Reinversión",
  renovationCost: "Reforma", furnitureCost: "Mobiliario", notaryCost: "Notaría", registryCost: "Registro", agencyCost: "Gestoría",
  cadastralValueTotal: "Valor catastral total", cadastralValueLand: "Valor catastral del suelo",
  investorGeneralTaxBase: "Base imponible general del inversor",
};

const MAX_ROWS = 200;

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString("es-ES", { maximumFractionDigits: 4 }) : "—";
  return String(v);
}

/** Aplana un objeto anidado en filas [ruta legible, valor]. */
export function flatten(obj: unknown, prefix: string[] = [], out: [string, string][] = []): [string, string][] {
  if (out.length >= MAX_ROWS) return out;
  if (obj !== null && typeof obj === "object") {
    const entries = Array.isArray(obj) ? obj.map((v, i) => [String(i + 1), v] as const) : Object.entries(obj as Record<string, unknown>);
    for (const [k, v] of entries) flatten(v, [...prefix, LABELS[k] ?? k], out);
  } else if (prefix.length) {
    out.push([prefix.join(" › "), fmt(obj)]);
  }
  return out;
}

function table(rows: [string, string][]) {
  return `<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font:14px Arial,sans-serif;width:100%;max-width:640px">${rows
    .map(([k, v]) => `<tr><td style="border-bottom:1px solid #e5e7eb;color:#555;width:45%">${esc(k)}</td><td style="border-bottom:1px solid #e5e7eb;color:#111">${esc(v)}</td></tr>`)
    .join("")}</table>`;
}

export function buildLeadEmail(p: LeadPayload) {
  const c = p.contact ?? {};
  const hasContact = !!(c.name || c.email || c.phone);
  const where = [
    (p.data as { property?: { postalCode?: string }; subject?: { postalCode?: string }; postalCode?: string }).property?.postalCode,
    (p.data as { subject?: { postalCode?: string } }).subject?.postalCode,
    (p.data as { postalCode?: string }).postalCode,
  ].find(Boolean);
  const subject = `InversionZ · ${TOOL_LABEL[p.tool]}${where ? ` · CP ${where}` : ""}${hasContact ? ` · ${c.name || c.email || c.phone}` : ""}`;

  const contactRows: [string, string][] = hasContact
    ? [["Nombre", fmt(c.name)], ["Email", fmt(c.email)], ["Teléfono", fmt(c.phone)], ["Mensaje", fmt(c.message)]]
    : [["Contacto", "El usuario no ha dejado datos de contacto"]];

  const html = `<div style="font:14px Arial,sans-serif;color:#111">
<h2 style="margin:0 0 4px;color:#323E90">${esc(TOOL_LABEL[p.tool])}</h2>
<p style="margin:0 0 16px;color:#555">Formulario completado en InversionZ${p.page ? ` (${esc(p.page)})` : ""} · ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</p>
<h3 style="margin:16px 0 6px">Contacto</h3>${table(contactRows)}
${p.summary && Object.keys(p.summary).length ? `<h3 style="margin:16px 0 6px">Resultado</h3>${table(Object.entries(p.summary).map(([k, v]) => [k, fmt(v)]))}` : ""}
<h3 style="margin:16px 0 6px">Datos introducidos</h3>${table(flatten(p.data))}
</div>`;

  const text = [
    `${TOOL_LABEL[p.tool]} — InversionZ`,
    "", "CONTACTO", ...contactRows.map(([k, v]) => `${k}: ${v}`),
    ...(p.summary ? ["", "RESULTADO", ...Object.entries(p.summary).map(([k, v]) => `${k}: ${fmt(v)}`)] : []),
    "", "DATOS", ...flatten(p.data).map(([k, v]) => `${k}: ${v}`),
  ].join("\n");

  return { subject, html, text, replyTo: c.email && /\S+@\S+\.\S+/.test(c.email) ? c.email : undefined };
}

export async function sendLead(p: LeadPayload): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO || "contacto@bminversiones.es";
  const from = process.env.LEAD_FROM || "InversionZ <onboarding@resend.dev>";
  const mail = buildLeadEmail(p);
  if (!key) {
    console.warn("[lead] RESEND_API_KEY no configurada; correo no enviado:", mail.subject);
    return { sent: false, reason: "no_api_key" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text, ...(mail.replyTo ? { reply_to: mail.replyTo } : {}) }),
  });
  if (!res.ok) {
    console.error("[lead] Resend respondió", res.status, await res.text().catch(() => ""));
    return { sent: false, reason: `resend_${res.status}` };
  }
  return { sent: true };
}
