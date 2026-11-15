import type { Metadata } from "next";
import { Wizard } from "@/components/form/Wizard";
export const metadata: Metadata = { title: "Nuevo análisis — InversionZ" };
export default function Page() { return <Wizard />; }
