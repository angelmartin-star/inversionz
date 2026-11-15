/** Logo de InversionZ: lince + palabra "Inversion" con la "Z" en verde. Sirve en servidor y cliente. */
import { BRAND, LYNX, LYNX_VIEWBOX } from "./lynx";

interface Props {
  /** Altura del símbolo en px */
  size?: number;
  /** Fondo sobre el que va: claro (por defecto) u oscuro */
  on?: "light" | "dark";
  /** Fondo real para recortar ojos y orejas */
  background?: string;
  showWordmark?: boolean;
  className?: string;
}

export function LynxMark({ size = 28, on = "light", background }: { size?: number; on?: "light" | "dark"; background?: string }) {
  const fg = on === "dark" ? "#FFFFFF" : BRAND.primary;
  const bg = background ?? (on === "dark" ? BRAND.primary : "#FFFFFF");
  const eye = on === "dark" ? BRAND.light : BRAND.accent;
  return (
    <svg width={(size * 140) / 196} height={size} viewBox={LYNX_VIEWBOX} aria-hidden="true">
      <path d={LYNX.tufts} stroke={fg} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d={LYNX.head} fill={fg} stroke={fg} strokeWidth={2} strokeLinejoin="round" />
      <path d={LYNX.cutouts} fill={bg} />
      <path d={LYNX.eye} fill={eye} />
      <path d={LYNX.brow} stroke={bg} strokeWidth={3} strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ size = 30, on = "light", background, showWordmark = true, className }: Props) {
  const z = on === "dark" ? BRAND.light : BRAND.accent;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: size * 0.28 }}>
      <LynxMark size={size} on={on} background={background} />
      {showWordmark && (
        <span style={{ fontFamily: "'Plus Jakarta Sans', var(--font-sans)", fontWeight: 800, fontSize: size * 0.62, letterSpacing: "-0.03em", lineHeight: 1,
          color: on === "dark" ? "#FFFFFF" : BRAND.primary }}>
          Inversion<span style={{ color: z }}>Z</span>
        </span>
      )}
      <span className="sr-only">InversionZ</span>
    </span>
  );
}
