import assert from "node:assert/strict";
import { buildLeadEmail, flatten } from "../src/lib/leads/sendLead";
import { districtFromPostalCode, idealistaApproximation } from "../src/lib/valuation/idealistaReference";

{ // aplana datos anidados con etiquetas legibles
    const rows = flatten({ property: { postalCode: "28001", purchasePrice: 350000 }, financing: { enabled: false } });
    assert.ok(rows.some((r) => JSON.stringify(r) === JSON.stringify(["Inmueble › Código postal", "28001"])));
    assert.ok(rows.some((r) => JSON.stringify(r) === JSON.stringify(["Financiación › Activa", "No"])));
}
{ // asunto con herramienta, CP y contacto; escapa HTML
    const m = buildLeadEmail({ tool: "rentabilidad", data: { postalCode: "28010", purchasePrice: 300000 }, contact: { name: "<Ana>", email: "ana@x.es" } });
    assert.equal(m.subject, "InversionZ · Rentabilidad rápida · CP 28010 · <Ana>");
    assert.ok(m.html.includes("&lt;Ana&gt;"));
    assert.equal(m.replyTo, "ana@x.es");
}

{ // CP → distrito
    assert.equal(districtFromPostalCode("28001"), "Barrio de Salamanca");
    assert.equal(districtFromPostalCode("08001"), null);
}
{ // 70 m² en Chamberí, buen estado, −10 %
    const a = idealistaApproximation(70, "Chamberí", "BUEN_ESTADO", 0.1)!;
    assert.equal(a.priceM2, Math.round(9081 * 0.9));
    assert.equal(a.value, Math.round((70 * 9081 * 0.9) / 1000) * 1000);
}
{ // a reformar resta un 15 %
    assert.equal(idealistaApproximation(100, "Centro", "A_REFORMAR", 0)!.priceM2, Math.round(7867 * 0.85));
}

console.log("✅ Leads e idealista: tests OK");
