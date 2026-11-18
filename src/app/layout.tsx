import type { Metadata } from "next";
import { ContactFab } from "@/components/ContactFab";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "./globals.css";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = {
  title: "InversionZ — Análisis, valoración y rentabilidad de inmuebles",
  description:
    "Rentabilidad, impuestos y valoración de un inmueble en España: ITP por provincia, IRPF del alquiler, plusvalías y comparables de los portales.",
};

const NAV = [
  { href: "/analisis/nuevo", label: "Análisis de inversión" },
  { href: "/valoracion", label: "Valoración" },
  { href: "/rentabilidad", label: "Rentabilidad rápida" },
];

/** Páginas legales de BM Real Estate Inversiones */
const LEGAL = [
  { label: "Política de privacidad", href: "https://www.bminversiones.es/privacy_policy/" },
  { label: "Aviso legal", href: "https://www.bminversiones.es/terms_of_use/" },
  { label: "Política de cookies", href: "https://www.bminversiones.es/cookie_policy/" },
  { label: "Preferencias de cookies", href: "https://www.bminversiones.es/cookie_policy/#" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">
        <header className="no-print border-b border-linea bg-papel">
          <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-2">
            <Link href="/" aria-label="InversionZ, inicio" className="py-1">
              <Logo size={40} />
            </Link>
            <nav aria-label="Herramientas" className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-tinta-2">
              {NAV.map((n) => <Link key={n.href} href={n.href} className="hover:text-tinta">{n.label}</Link>)}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <ContactFab />
        <footer className="no-print border-t border-linea py-6 text-center text-xs text-tinta-3">
          <nav aria-label="Información legal" className="mb-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-tinta-2">
            {LEGAL.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener" className="underline-offset-2 hover:text-tinta hover:underline">{l.label}</a>
            ))}
          </nav>
          Cálculo orientativo con la normativa fiscal vigente. No sustituye el asesoramiento de un profesional.
        </footer>
      </body>
    </html>
  );
}
