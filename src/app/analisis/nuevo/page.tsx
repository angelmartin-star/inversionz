import type { Metadata } from "next";
import { Wizard } from "@/components/form/Wizard";
export const metadata: Metadata = { title: "Nuevo análisis — InversionQ" };
export default function Page() { return <Wizard />; }
