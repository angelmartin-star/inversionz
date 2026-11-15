import type { Metadata } from "next";
import { ValuationTool } from "@/components/valuation/ValuationTool";
export const metadata: Metadata = { title: "Valoración de un inmueble — InversionZ" };
export default function Page() { return <ValuationTool />; }
