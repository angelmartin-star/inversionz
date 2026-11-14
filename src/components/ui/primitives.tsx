"use client";
/**
 * Primitivas de interfaz (estilo shadcn/ui, sin dependencias de Radix).
 * Mantener aquí botones, campos y controles comunes.
 */
import { type VariantProps } from "class-variance-authority";
import { useEffect, useId, useState } from "react";
import { formatInputNumber, parseNumberEs } from "@/lib/format";
import { buttonVariants, cn } from "@/lib/ui";

export { buttonVariants, cn };

export function Button({ className, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

interface FieldShellProps { label: string; hint?: string; error?: string; id: string; children: React.ReactNode; className?: string }
export function FieldShell({ label, hint, error, id, children, className }: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-tinta">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="text-xs text-sello">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-tinta-3">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "h-10 w-full rounded-md border border-linea bg-white px-3 text-[15px] text-tinta placeholder:text-tinta-3/70 focus:border-plano focus:outline-none focus:ring-2 focus:ring-plano/20 aria-[invalid=true]:border-sello";

interface NumberFieldProps {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void;
  unit?: "€" | "%" | "m²" | "años" | "€/mes" | "€/año"; hint?: string; error?: string;
  /** Para porcentajes: el usuario escribe 80 y se guarda 0.8 */
  percent?: boolean; decimals?: number; className?: string; placeholder?: string;
}

/** Campo numérico con formato español y sufijo de unidad. */
export function NumberField({ label, value, onChange, unit, hint, error, percent, decimals = 2, className, placeholder }: NumberFieldProps) {
  const id = useId();
  const display = (v: number | undefined) => formatInputNumber(v === undefined ? undefined : percent ? v * 100 : v, decimals);
  const [text, setText] = useState(display(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(display(value)); }, [value, focused]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FieldShell label={label} hint={hint} error={error} id={id} className={className}>
      <div className="relative">
        <input
          id={id} inputMode="decimal" autoComplete="off" value={text} placeholder={placeholder}
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={cn(inputBase, unit && (unit.length > 2 ? "pr-[4.75rem]" : "pr-10"), "text-right")}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setText(display(value)); }}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseNumberEs(e.target.value);
            onChange(n === null ? undefined : percent ? n / 100 : n);
          }}
        />
        {unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-tinta-3">{unit}</span>}
      </div>
    </FieldShell>
  );
}

export function TextField({ label, value, onChange, hint, error, className, placeholder, maxLength, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; error?: string; className?: string;
  placeholder?: string; maxLength?: number; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} id={id} className={className}>
      <input id={id} value={value} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode}
        aria-invalid={!!error} className={inputBase} onChange={(e) => onChange(e.target.value)} />
    </FieldShell>
  );
}

/** Selector segmentado (radio group accesible) */
export function Segmented<T extends string>({ label, value, options, onChange, hint }: {
  label: string; value: T; options: { value: T; label: string; description?: string }[]; onChange: (v: T) => void; hint?: string;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-describedby={hint ? `${id}-hint` : undefined} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button key={o.value} type="button" role="radio" aria-checked={active} onClick={() => onChange(o.value)}
              className={cn("rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                active ? "border-tinta bg-tinta text-papel" : "border-linea bg-white hover:border-tinta/40")}>
              <span className="block font-medium">{o.label}</span>
              {o.description && <span className={cn("mt-0.5 block text-xs", active ? "text-papel/75" : "text-tinta-3")}>{o.description}</span>}
            </button>
          );
        })}
      </div>
      {hint && <p id={`${id}-hint`} className="text-xs text-tinta-3">{hint}</p>}
    </fieldset>
  );
}

export function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-parcela" : "bg-linea")}>
        <span className={cn("absolute top-0.5 left-0 h-4 w-4 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </button>
      <label htmlFor={id} className="cursor-pointer text-sm">
        <span className="font-medium">{label}</span>
        {description && <span className="block text-xs text-tinta-3">{description}</span>}
      </label>
    </div>
  );
}
