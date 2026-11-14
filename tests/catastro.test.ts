import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDnp, parseStreet, matchUnit, floorKey, throwIfError, CatastroError } from "../src/lib/catastro/catastroClient";
const fx = (f: string) => JSON.parse(readFileSync(`tests/fixtures/${f}`, "utf8"));

// Respuesta real de Consulta_DNPRC (ejemplo oficial de la DGC)
const one = parseDnp(fx("dnprc.json"));
assert.equal(one.length, 1);
assert.equal(one[0].refCat, "2749704YJ0624N0001DI");
assert.equal(one[0].builtArea, 94);
assert.equal(one[0].yearBuilt, 1976);
assert.equal(one[0].use, "Residencial");
assert.equal(one[0].participationPct, 100);

// Portal en Madrid con varias unidades (estructura de Consulta_DNPLOC)
const list = parseDnp(fx("dnploc-madrid.json"));
assert.equal(list.length, 4);
assert.equal(list[2].floor, "03");
assert.equal(matchUnit(list, { floor: "3", door: "b" }), 3);
assert.equal(matchUnit(list, { floor: "3º", door: "A" }), 2);
assert.equal(matchUnit(list, { floor: "Bajo", door: "A" }), 0);
assert.equal(matchUnit(list, { floor: "3" }), null); // ambiguo: dos puertas
assert.equal(floorKey("03"), "3");

// Tipos de vía
assert.deepEqual(parseStreet("Calle de Embajadores"), { type: "CL", name: "EMBAJADORES" });
assert.deepEqual(parseStreet("Avda. de la Albufera"), { type: "AV", name: "ALBUFERA" });
assert.deepEqual(parseStreet("Paseo de la Castellana"), { type: "PS", name: "CASTELLANA" });
assert.deepEqual(parseStreet("Alcalá"), { type: null, name: "ALCALA" });

// Errores del servicio
assert.throws(() => throwIfError(fx("err.json")), (e: unknown) => e instanceof CatastroError && e.code === "NO_ENCONTRADO");
console.log("✅ Catastro: tests OK");
