/*
 * Cálculos de pesca: luna, períodos solunares, distancia a zonas e índice de
 * actividad por especie. Funciones puras (sin DOM) para poder testearlas.
 * Requiere SunCalc (global) y ESPECIES / ZONAS (data.js).
 */
(function (root) {
  "use strict";

  const SC = root.SunCalc || (typeof require === "function" ? require("../vendor/suncalc.js") : null);

  // ---------------- Geografía ----------------
  function distanciaKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /** Zonas ordenadas por distancia. Marca "dentro" si el punto cae en su radio. */
  function zonasCercanas(zonas, lat, lng, max = 5) {
    return zonas
      .map(z => {
        const d = distanciaKm(lat, lng, z.lat, z.lng);
        return { zona: z, distancia: d, dentro: d <= z.radioKm };
      })
      .sort((a, b) => (a.distancia - a.zona.radioKm) - (b.distancia - b.zona.radioKm))
      .slice(0, max);
  }

  /** Especies probables en un punto: unión de las zonas cercanas (≤ 1,5 radios o 60 km). */
  function especiesEnPunto(zonas, lat, lng) {
    const cercanas = zonasCercanas(zonas, lat, lng, 8)
      .filter(c => c.distancia <= Math.max(c.zona.radioKm * 1.5, 60));
    const ids = new Map();
    cercanas.forEach(c => c.zona.especies.forEach(id => {
      if (!ids.has(id) || ids.get(id).distancia > c.distancia) ids.set(id, c);
    }));
    return { cercanas, especies: [...ids.entries()].map(([id, c]) => ({ id, zona: c.zona, distancia: c.distancia })) };
  }

  // ---------------- Luna ----------------
  const FASES = [
    { hasta: 0.0339, nombre: "Luna nueva", icono: "🌑" },
    { hasta: 0.2161, nombre: "Creciente", icono: "🌒" },
    { hasta: 0.2839, nombre: "Cuarto creciente", icono: "🌓" },
    { hasta: 0.4661, nombre: "Gibosa creciente", icono: "🌔" },
    { hasta: 0.5339, nombre: "Luna llena", icono: "🌕" },
    { hasta: 0.7161, nombre: "Gibosa menguante", icono: "🌖" },
    { hasta: 0.7839, nombre: "Cuarto menguante", icono: "🌗" },
    { hasta: 0.9661, nombre: "Menguante", icono: "🌘" },
    { hasta: 1.0001, nombre: "Luna nueva", icono: "🌑" }
  ];
  // Nota: en el hemisferio sur el dibujo de la luna se ve invertido
  // respecto de los emojis (pensados para el hemisferio norte).

  function faseLunar(fecha) {
    const ill = SC.getMoonIllumination(fecha);
    const f = FASES.find(x => ill.phase < x.hasta) || FASES[0];
    return { fase: ill.phase, iluminacion: ill.fraction, nombre: f.nombre, icono: f.icono };
  }

  /** 1 en luna nueva/llena, 0,4 en cuartos (teoría solunar clásica). */
  function puntajeLuna(fase) {
    const d = Math.min(fase, Math.abs(fase - 0.5), 1 - fase); // 0..0,25
    return 1 - (d / 0.25) * 0.6;
  }

  /** Tránsitos superior e inferior de la luna (máx./mín. altitud) en el día local. */
  function transitosLuna(dia, lat, lng) {
    const inicio = new Date(dia); inicio.setHours(0, 0, 0, 0);
    const paso = 10 * 60 * 1000;
    let max = { alt: -Infinity, t: null }, min = { alt: Infinity, t: null };
    for (let t = inicio.getTime(); t < inicio.getTime() + 86400000; t += paso) {
      const alt = SC.getMoonPosition(new Date(t), lat, lng).altitude;
      if (alt > max.alt) max = { alt, t };
      if (alt < min.alt) min = { alt, t };
    }
    return { superior: new Date(max.t), inferior: new Date(min.t) };
  }

  /** Períodos solunares: mayores (tránsitos ±1 h) y menores (salida/puesta ±30 min). */
  function periodosSolunares(dia, lat, lng) {
    const tr = transitosLuna(dia, lat, lng);
    const inicio = new Date(dia); inicio.setHours(0, 0, 0, 0);
    const mt = SC.getMoonTimes(inicio, lat, lng);
    const rango = (c, min) => ({ desde: new Date(c.getTime() - min * 60000), hasta: new Date(c.getTime() + min * 60000), centro: c });
    const mayores = [tr.superior, tr.inferior].map(c => rango(c, 60));
    const menores = [mt.rise, mt.set].filter(Boolean).map(c => rango(c, 30));
    const sol = SC.getTimes(new Date(inicio.getTime() + 12 * 3600000), lat, lng);
    return {
      mayores: mayores.sort((a, b) => a.centro - b.centro),
      menores: menores.sort((a, b) => a.centro - b.centro),
      salidaLuna: mt.rise || null,
      puestaLuna: mt.set || null,
      amanecer: sol.sunrise,
      atardecer: sol.sunset
    };
  }

  // ---------------- Índices ----------------
  function puntajeTemporada(esp, mes) {
    if (esp.meses.includes(mes)) return 1;
    if ((esp.posibles || []).includes(mes)) return 0.55;
    return 0.1;
  }

  /** Ajuste de temperatura del agua al rango preferido de la especie. */
  function puntajeTemperatura(esp, tempAgua) {
    if (tempAgua == null || !esp.tempAgua) return null;
    const [min, max] = esp.tempAgua;
    if (tempAgua >= min && tempAgua <= max) return 1;
    const fuera = tempAgua < min ? min - tempAgua : tempAgua - max;
    return Math.max(0.1, 1 - fuera / 8);
  }

  /**
   * Clima de un día: dPresion = variación de presión en 24 h (hPa),
   * viento = máximo km/h, lluvia = mm del día.
   */
  function puntajeClima({ dPresion, viento, lluvia }) {
    const partes = [];
    if (dPresion != null) {
      let p;
      if (dPresion <= -6) p = 0.6;          // caída brusca: frente encima
      else if (dPresion <= -1) p = 1;       // baja lenta: prefrontal, suele activar
      else if (dPresion < 1) p = 0.8;       // estable
      else if (dPresion < 3) p = 0.65;      // subiendo
      else p = 0.45;                        // suba fuerte: posfrontal, pique flojo
      partes.push(p);
    }
    if (viento != null) partes.push(viento < 15 ? 1 : viento < 25 ? 0.85 : viento < 35 ? 0.6 : 0.3);
    if (lluvia != null) partes.push(lluvia < 2 ? 1 : lluvia < 10 ? 0.85 : 0.6);
    if (!partes.length) return null;
    return partes.reduce((a, b) => a + b, 0) / partes.length;
  }

  /** Índice 0–100 combinando temporada, clima, luna y temperatura. */
  function indiceActividad({ especie, mes, fase, clima, tempAgua }) {
    const comp = [
      { k: "temporada", peso: 0.4, v: puntajeTemporada(especie, mes) },
      { k: "clima", peso: 0.3, v: clima ? puntajeClima(clima) : null },
      { k: "luna", peso: 0.15, v: fase != null ? puntajeLuna(fase) : null },
      { k: "temperatura", peso: 0.15, v: puntajeTemperatura(especie, tempAgua) }
    ].filter(c => c.v != null);
    const pesoTotal = comp.reduce((a, c) => a + c.peso, 0);
    let total = comp.reduce((a, c) => a + c.v * c.peso, 0) / pesoTotal;
    // Fuera de temporada el resto de los factores no debería compensar.
    if (puntajeTemporada(especie, mes) <= 0.1) total = Math.min(total, 0.3);
    return { valor: Math.round(total * 100), componentes: comp };
  }

  function etiquetaIndice(v) {
    if (v >= 75) return { texto: "Muy bueno", clase: "muy-bueno" };
    if (v >= 60) return { texto: "Bueno", clase: "bueno" };
    if (v >= 40) return { texto: "Regular", clase: "regular" };
    return { texto: "Bajo", clase: "bajo" };
  }

  const api = {
    distanciaKm, zonasCercanas, especiesEnPunto,
    faseLunar, puntajeLuna, transitosLuna, periodosSolunares,
    puntajeTemporada, puntajeTemperatura, puntajeClima, indiceActividad, etiquetaIndice
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Pesca = api;
})(typeof window !== "undefined" ? window : globalThis);
