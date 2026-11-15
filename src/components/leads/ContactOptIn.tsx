"use client";
/** Bloque opcional: el usuario deja sus datos para que BM Inversiones le contacte. */
import { useEffect, useId, useState } from "react";
import { CONTACT_KEY, loadContact, type StoredContact } from "@/lib/leads/notify";
import { TextField } from "@/components/ui/primitives";

export function ContactOptIn({ className }: { className?: string }) {
  const [c, setC] = useState<StoredContact>({});
  const [loaded, setLoaded] = useState(false);
  const id = useId();
  useEffect(() => { setC(loadContact()); setLoaded(true); }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(CONTACT_KEY, JSON.stringify(c)); } catch { /* */ } }, [c, loaded]);
  const set = (p: Partial<StoredContact>) => setC((x) => ({ ...x, ...p }));

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
    </fieldset>
  );
}
