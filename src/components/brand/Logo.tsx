/** Logo de InversionZ (versión final). Archivos en /public/brand. Sirve en servidor y cliente. */
/* eslint-disable @next/next/no-img-element */

interface Props {
  /** Altura aproximada del símbolo en px */
  size?: number;
  /** Fondo sobre el que va: claro (por defecto) u oscuro */
  on?: "light" | "dark";
  /** Se mantiene por compatibilidad; ya no se usa */
  background?: string;
  showWordmark?: boolean;
  className?: string;
}

/** Solo el lince. */
export function LynxMark({ size = 28, on = "light" }: { size?: number; on?: "light" | "dark"; background?: string }) {
  const src = on === "dark" ? "/brand/simbolo-fondo-oscuro.svg" : "/brand/simbolo-color.svg";
  return <img src={src} alt="" aria-hidden="true" width={Math.round((size * 425) / 460)} height={size} style={{ display: "block" }} />;
}

/** Lince + palabra InversionZ. El SVG horizontal lleva un margen de 30/300 alrededor. */
export function Logo({ size = 30, on = "light", showWordmark = true, className }: Props) {
  if (!showWordmark) return <span className={className}><LynxMark size={size} on={on} /><span className="sr-only">InversionZ</span></span>;
  const src = on === "dark" ? "/brand/logo-horizontal-fondo-oscuro.svg" : "/brand/logo-horizontal-color.svg";
  const h = Math.round(size * 1.25);
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", margin: `-${Math.round(h * 0.1)}px 0` }}>
      <img src={src} alt="InversionZ" width={h * 3} height={h} style={{ display: "block", marginLeft: -Math.round(h * 0.1) }} />
    </span>
  );
}
