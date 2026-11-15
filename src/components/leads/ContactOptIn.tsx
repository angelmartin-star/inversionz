"use client";
/** Bloque opcional: el usuario deja sus datos para que BM Inversiones le contacte. */
import { useEffect, useId, useState } from "react";
import { CONTACT_KEY, loadContact, type StoredContact } from "@/lib/leads/notify";
import { TextField } from "@/components/ui/primitives";

type SendState = "idle" | "sending" | "sent" | "error";

/** onSend: envía en el momento los datos de la herramienta junto con el contacto. */
export function ContactOptIn({ className, onSend }: { className?: string; onSend?: () => Promise<boolean> }) {
  const [state, setState] = useState<SendState>("idle");
  const [c, setC] = useState<StoredContact>({});
  const [loaded, setLoaded] = useState(false);
  const id = useId();
  useEffect(() => { setC(loadContact()); setLoaded(true); }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(CONTACT_KEY, JSON.stringify(c)); } catch { /* */ } }, [c, loaded]);
  const set = (p: Partial<StoredContact>) => { setC((x) => ({ ...x, ...p })); if (state !== "sending") setState("idle"); };
  const emailOk = !c.email || /^\S+@\S+\.\S+$/.test(c.email);
  const canSend = !!onSend && !!c.consent && !!c.name?.trim() && (!!c.email?.trim() || (c.phone ?? "").replace(/\D/g, "").length >= 9) && emailOk;
  async function send() {
    if (!onSend || !canSend) return;
    setState("sending");
    try { localStorage.setItem(CONTACT_KEY, JSON.stringify(c)); } catch { /* */ }
    setState((await onSend()) ? "sent" : "error");
  }

  return (
    <fieldset className={`rounded-md border border-linea bg-white p-5 ${className ?? ""}`}>
      <legend className="px-1 text-sm font-medium">¿Quieres que te llamemos? (opcional)</legend>
      <p className="text-xs text-tinta-3">Un asesor de BM Inversiones revisará tu caso sin compromiso.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <TextField label="Nombre" value={c.name ?? ""} onChange={(v) => set({ name: v })} maxLength={120} />
        <TextField label="Email" value={c.email ?? ""} onChange={(v) => set({ email: v.trim() })} maxLength={160} inputMode="email" />
        <TextField label="Teléfono" value={c.phone ?? ""} onChange={(v) => set({ phone: v })} maxLength={40} inputMode="tel" />
      </div>
      <label htmlFor={id} className="mt-4 flex cursor-pointer items-start gap-2 text-xs text-tinta-2">
        <input id={id} type="checkbox" className="mt-0.5" checked={!!c.consent} onChange={(e) => set({ consent: e.target.checked })} />
        <span>
          Acepto que BM Inversiones trate mis datos para contactarme sobre esta consulta, según su{" "}
          <a className="underline" href="https://www.bminversiones.es/privacy_policy/" target="_blank" rel="noopener">política de privacidad</a>.
        </span>
      </label>
      {onSend && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={send} disabled={!canSend || state === "sending"}
            className="rounded-md bg-bm-azul px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            {state === "sending" ? "Enviando…" : "Enviar"}
          </button>
          <p role="status" className="text-xs text-tinta-2">
            {state === "sent" && "¡Recibido! Te contactaremos en breve."}
            {state === "error" && "No se ha podido enviar. Inténtalo de nuevo."}
            {state === "idle" && !canSend && "Indica tu nombre, un email o teléfono y acepta la política de privacidad."}
            {state === "idle" && !emailOk && " Revisa el email."}
          </p>
        </div>
      )}
    </fieldset>
  );
}
