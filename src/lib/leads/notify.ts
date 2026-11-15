"use client";
/**
 * Avisa a BM Inversiones (POST /api/lead) cuando el usuario completa un formulario.
 * - Envía cada combinación de datos una sola vez por sesión (evita duplicados al recargar).
 * - Solo incluye nombre, email y teléfono si el usuario ha dado su consentimiento.
 */
import type { LeadContact, LeadTool } from "@/lib/leads/sendLead";

export const CONTACT_KEY = "inversionz:contacto";

export interface StoredContact extends LeadContact { consent?: boolean }

export function loadContact(): StoredContact {
  try { return JSON.parse(localStorage.getItem(CONTACT_KEY) ?? "{}"); } catch { return {}; }
}

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function notifyLead(tool: LeadTool, data: object, summary?: Record<string, string | number | null>) {
  try {
    const c = loadContact();
    const contact = c.consent && (c.name || c.email || c.phone)
      ? { name: c.name, email: c.email, phone: c.phone, message: c.message }
      : undefined;
    const body = JSON.stringify({ tool, data, summary, contact, page: location.pathname });
    const key = `inversionz:lead:${tool}:${hash(body.replace(/"page":"[^"]*"/, ""))}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    // keepalive: el envío sigue aunque la página navegue a resultados
    void fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* sin almacenamiento o sin red: no bloquear al usuario */ }
}
