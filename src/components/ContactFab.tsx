"use client";
/** Botón flotante de contacto con BM Inversiones (WhatsApp, llamada y email), visible en todas las páginas. */
import { useEffect, useRef, useState } from "react";

const PHONE = "+34638102519";
const PHONE_LABEL = "638 10 25 19";
const WHATSAPP = "https://wa.me/34638102519?text=" + encodeURIComponent("Hola, vengo de InversionZ y quiero hablar con un asesor.");
const EMAIL = "contacto@bminversiones.es";

export function ContactFab() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]);

  return (
    <div ref={ref} className="no-print fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {open && (
        <div id="contacto-bm" role="dialog" aria-label="Contactar con BM Inversiones"
          className="w-72 rounded-lg border border-linea bg-white p-4 shadow-lg">
          <p className="text-sm font-semibold">¿Hablamos?</p>
          <p className="mt-1 text-xs text-tinta-2">Un asesor de BM Inversiones revisa tu caso sin compromiso.</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href={WHATSAPP} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-[#25D366]/10">
                <WhatsAppIcon /> <span>WhatsApp</span>
              </a>
            </li>
            <li>
              <a href={`tel:${PHONE}`} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-bm-celeste/10">
                <PhoneIcon /> <span>Llamar al {PHONE_LABEL}</span>
              </a>
            </li>
            <li>
              <a href={`mailto:${EMAIL}?subject=${encodeURIComponent("Consulta desde InversionZ")}`} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-bm-azul/10">
                <MailIcon /> <span>{EMAIL}</span>
              </a>
            </li>
          </ul>
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="contacto-bm"
        className="flex h-14 items-center gap-2 rounded-full bg-bm-azul px-5 text-sm font-medium text-white shadow-lg transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bm-celeste">
        {open ? <CloseIcon /> : <ChatIcon />}
        <span>{open ? "Cerrar" : "Contactar"}</span>
      </button>
    </div>
  );
}

const svg = { width: 20, height: 20, viewBox: "0 0 24 24", "aria-hidden": true } as const;
function ChatIcon() { return <svg {...svg} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>; }
function CloseIcon() { return <svg {...svg} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>; }
function PhoneIcon() { return <svg {...svg} fill="none" stroke="#41B5E5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>; }
function MailIcon() { return <svg {...svg} fill="none" stroke="#323E90" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" /></svg>; }
function WhatsAppIcon() { return <svg {...svg} fill="#25D366"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>; }
