import type { Metadata } from "next";
import { ResultsView } from "@/components/dashboard/ResultsView";
export const metadata: Metadata = { title: "Resultado del análisis — InversionZ" };
export default function Page() { return <ResultsView />; }
