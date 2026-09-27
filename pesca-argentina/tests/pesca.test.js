// Pruebas de la lógica (node --test tests/)
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

global.SunCalc = require("../vendor/suncalc.js");
const Pesca = require("../js/pesca.js");
const Clima = require("../js/clima.js");
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/data.js"), "utf8") + ";this.ESPECIES=ESPECIES;this.ZONAS=ZONAS;", ctx);
const { ESPECIES, ZONAS } = ctx;

test("todas las zonas referencian especies existentes y coordenadas en Argentina", () => {
  for (const z of ZONAS) {
    for (const id of z.especies) assert.ok(ESPECIES[id], `${z.id}: especie ${id} inexistente`);
    assert.ok(z.lat < -21 && z.lat > -56 && z.lng < -53 && z.lng > -74, `${z.id} fuera de Argentina`);
  }
  assert.strictEqual(new Set(ZONAS.map(z => z.id)).size, ZONAS.length, "ids de zona duplicados");
});

test("todas las especies tienen datos completos y meses válidos", () => {
  for (const [id, e] of Object.entries(ESPECIES)) {
    for (const k of ["nombre", "ambiente", "horario", "equipo", "notas"]) assert.ok(e[k], `${id}.${k}`);
    assert.ok(e.meses.length > 0 && e.meses.every(m => m >= 1 && m <= 12), `${id}.meses`);
    assert.ok(!e.meses.some(m => (e.posibles || []).includes(m)), `${id}: mes repetido en meses y posibles`);
    assert.ok(e.metodos.length && e.carnadas.length, `${id} sin métodos o carnadas`);
    assert.ok(ZONAS.some(z => z.especies.includes(id)), `${id} no aparece en ninguna zona`);
  }
});

test("distancia Buenos Aires - Mar del Plata ≈ 380 km", () => {
  const d = Pesca.distanciaKm(-34.6, -58.38, -38.0, -57.55);
  assert.ok(d > 370 && d < 390, d);
});

test("en Chascomús aparece el pejerrey y la zona más cercana es la laguna", () => {
  const r = Pesca.especiesEnPunto(ZONAS, -35.58, -58.02);
  assert.strictEqual(r.cercanas[0].zona.id, "chascomus");
  assert.ok(r.especies.some(e => e.id === "pejerrey"));
  assert.ok(!r.especies.some(e => e.id === "trucha"));
});

test("en medio de la meseta no hay especies", () => {
  const r = Pesca.especiesEnPunto(ZONAS, -44.0, -69.5);
  assert.strictEqual(r.especies.length, 0);
});

test("fase lunar: luna llena conocida (2026-01-03) y nueva (2026-01-18)", () => {
  assert.strictEqual(Pesca.faseLunar(new Date("2026-01-03T12:00:00Z")).nombre, "Luna llena");
  assert.strictEqual(Pesca.faseLunar(new Date("2026-01-18T20:00:00Z")).nombre, "Luna nueva");
  assert.ok(Pesca.puntajeLuna(0.5) > 0.99 && Pesca.puntajeLuna(0.25) < 0.45);
});

test("períodos solunares: dos mayores de 2 h", () => {
  const p = Pesca.periodosSolunares(new Date(2026, 8, 27, 12), -34.6, -58.4);
  assert.strictEqual(p.mayores.length, 2);
  p.mayores.forEach(m => assert.strictEqual(m.hasta - m.desde, 2 * 3600000));
  assert.ok(p.amanecer < p.atardecer);
});

test("índice: fuera de temporada queda bajo aunque el clima sea ideal", () => {
  const clima = { dPresion: -2, viento: 5, lluvia: 0 };
  const inv = Pesca.indiceActividad({ especie: ESPECIES.surubi, mes: 7, fase: 0.5, clima, tempAgua: 24 });
  const ver = Pesca.indiceActividad({ especie: ESPECIES.surubi, mes: 1, fase: 0.5, clima, tempAgua: 24 });
  assert.ok(inv.valor <= 30, inv.valor);
  assert.ok(ver.valor >= 90, ver.valor);
});

test("índice: viento fuerte y suba de presión bajan el puntaje", () => {
  const bueno = Pesca.puntajeClima({ dPresion: -2, viento: 10, lluvia: 0 });
  const malo = Pesca.puntajeClima({ dPresion: 5, viento: 45, lluvia: 20 });
  assert.ok(bueno > 0.95 && malo < 0.5);
});

test("mareas: detecta pleamar y bajamar", () => {
  const horas = ["a", "b", "c", "d", "e", "f"];
  const m = Clima.mareas(horas, [0, 1, 0.5, -1, -0.5, 0]);
  assert.deepStrictEqual(m.map(x => x.tipo), ["Pleamar", "Bajamar"]);
});
