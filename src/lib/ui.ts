/** Utilidades de estilo usables en servidor y cliente (no marcar como "use client"). */
import { cva } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-tinta text-papel hover:bg-[#1a3a5c]",
        secondary: "border border-tinta/25 bg-white text-tinta hover:border-tinta/50",
        ghost: "text-tinta-2 hover:text-tinta hover:bg-papel-2",
        // Colores de los cuadrados de BM. En los claros el texto va en azul marino por contraste.
        bmAzul: "bg-bm-azul text-white hover:brightness-110",
        bmCeleste: "bg-bm-celeste text-tinta hover:brightness-105",
        bmVerde: "bg-bm-verde text-tinta hover:brightness-105",
      },
      size: { md: "h-10 px-4", lg: "h-12 px-6 text-base", sm: "h-8 px-3" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
