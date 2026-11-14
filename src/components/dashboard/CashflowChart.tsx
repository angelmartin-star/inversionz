"use client";
/** Cashflow neto (después de impuestos) por año. Una sola serie, un solo eje, tooltip por barra. */
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { YearProjection } from "@/types/investment";
import { eur } from "@/lib/format";

export function CashflowChart({ data }: { data: YearProjection[] }) {
  const rows = data.map((d) => ({ year: `Año ${d.year}`, cashflow: Math.round(d.cashflowAfterTax), noi: Math.round(d.noi), irpf: Math.round(d.irpf), debt: Math.round(d.debtService) }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#e4e8e5" />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "#6e7889", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} width={70} tick={{ fill: "#6e7889", fontSize: 12 }} tickFormatter={(v: number) => eur(v)} />
          <ReferenceLine y={0} stroke="#15233f" />
          <Tooltip cursor={{ fill: "rgba(21,35,63,0.05)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as (typeof rows)[number];
            return (
              <div className="rounded-md border border-linea bg-white px-3 py-2 text-xs shadow-sm">
                <p className="mb-1 font-semibold">{p.year}</p>
                <p>Ingresos menos gastos: {eur(p.noi)}</p>
                <p>Cuota hipoteca: {eur(p.debt)}</p>
                <p>IRPF: {eur(p.irpf)}</p>
                <p className="mt-1 font-semibold">Cashflow neto: {eur(p.cashflow)}</p>
              </div>
            );
          }} />
          <Bar dataKey="cashflow" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
            {rows.map((r, i) => <Cell key={i} fill={r.cashflow >= 0 ? "#3a6ea5" : "#b3261e"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
