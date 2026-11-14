import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "InversionQ — Análisis de inversión inmobiliaria",
  description:
    "Rentabilidad, cashflow, IRPF y plusvalías de un inmueble en España, calculados con la normativa de cada comunidad autónoma.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">
        <header className="no-print border-b border-linea bg-papel">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="grid h-6 w-6 grid-cols-2 gap-px rounded-sm bg-tinta p-[3px]">
                <span className="bg-papel" /><span className="bg-parcela" />
                <span className="bg-parcela" /><span className="bg-papel" />
              </span>
              InversionQ
            </Link>
            <Link href="/analisis/nuevo" className="text-sm font-medium text-tinta-2 hover:text-tinta">
              Nuevo análisis
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="no-print border-t border-linea py-6 text-center text-xs text-tinta-3">
          Cálculo orientativo con la normativa fiscal vigente. No sustituye el asesoramiento de un profesional.
        </footer>
      </body>
    </html>
  );
}
