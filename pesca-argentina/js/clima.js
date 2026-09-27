/*
 * Datos meteorológicos y marinos de Open-Meteo (gratuito, sin clave).
 * https://open-meteo.com — modelos globales (GFS/ECMWF) y regionales.
 */
(function (root) {
  "use strict";

  const TZ = "America/Argentina/Buenos_Aires";

  const CODIGOS = {
    0: "Despejado", 1: "Mayormente despejado", 2: "Parcialmente nublado", 3: "Nublado",
    45: "Niebla", 48: "Niebla con escarcha",
    51: "Llovizna débil", 53: "Llovizna", 55: "Llovizna intensa",
    61: "Lluvia débil", 63: "Lluvia", 65: "Lluvia intensa",
    66: "Lluvia helada", 67: "Lluvia helada intensa",
    71: "Nevada débil", 73: "Nevada", 75: "Nevada intensa", 77: "Granizo fino",
    80: "Chaparrones", 81: "Chaparrones fuertes", 82: "Chaparrones violentos",
    85: "Chaparrones de nieve", 86: "Nevadas fuertes",
    95: "Tormenta", 96: "Tormenta con granizo", 99: "Tormenta fuerte con granizo"
  };

  const PUNTOS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const rumbo = g => g == null ? "–" : PUNTOS[Math.round(((g % 360) / 22.5)) % 16];

  async function obtenerJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.reason || "Error de la API");
    return j;
  }

  async function pronostico(lat, lng) {
    const p = new URLSearchParams({
      latitude: lat.toFixed(4), longitude: lng.toFixed(4), timezone: TZ,
      past_days: 7, forecast_days: 7,
      current: "temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,cloud_cover",
      hourly: "temperature_2m,pressure_msl,wind_speed_10m,precipitation",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset"
    });
    return obtenerJSON("https://api.open-meteo.com/v1/forecast?" + p);
  }

  /** Datos marinos: devuelve null si el punto no tiene datos (tierra adentro). */
  async function marino(lat, lng) {
    const p = new URLSearchParams({
      latitude: lat.toFixed(4), longitude: lng.toFixed(4), timezone: TZ, forecast_days: 7,
      hourly: "wave_height,sea_surface_temperature,sea_level_height_msl"
    });
    try {
      const j = await obtenerJSON("https://marine-api.open-meteo.com/v1/marine?" + p);
      const h = j.hourly || {};
      const hayDatos = (h.wave_height || []).some(v => v != null) || (h.sea_surface_temperature || []).some(v => v != null);
      return hayDatos ? j : null;
    } catch (e) {
      return null;
    }
  }

  const media = arr => {
    const v = arr.filter(x => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  /** Pleamares y bajamares estimadas a partir del nivel del mar horario del modelo. */
  function mareas(horas, niveles) {
    const res = [];
    for (let i = 1; i < niveles.length - 1; i++) {
      const a = niveles[i - 1], b = niveles[i], c = niveles[i + 1];
      if (a == null || b == null || c == null) continue;
      if (b > a && b >= c) res.push({ hora: horas[i], tipo: "Pleamar", nivel: b });
      else if (b < a && b <= c) res.push({ hora: horas[i], tipo: "Bajamar", nivel: b });
    }
    return res;
  }

  /**
   * Resume el pronóstico por día: variación de presión, viento, lluvia y
   * temperatura estimada del agua.
   */
  function resumenDiario(fc, mar) {
    const d = fc.daily, h = fc.hourly;
    const presion12 = fecha => {
      const i = h.time.indexOf(fecha + "T12:00");
      return i >= 0 ? h.pressure_msl[i] : null;
    };
    const sstPorDia = {};
    if (mar && mar.hourly && mar.hourly.sea_surface_temperature) {
      mar.hourly.time.forEach((t, i) => {
        const f = t.slice(0, 10);
        (sstPorDia[f] = sstPorDia[f] || []).push(mar.hourly.sea_surface_temperature[i]);
      });
    }
    const hoy = fc.current ? fc.current.time.slice(0, 10) : d.time[7];
    const dias = [];
    d.time.forEach((fecha, i) => {
      if (fecha < hoy) return;
      const pHoy = presion12(fecha);
      const pAyer = i > 0 ? presion12(d.time[i - 1]) : null;
      // Temperatura del agua: SST marina si existe; si no, promedio del aire de
      // los 7 días previos (aproximación grosera: el agua sigue al aire con retraso).
      let tempAgua = media(sstPorDia[fecha] || []);
      let fuenteAgua = "temperatura superficial del mar (modelo)";
      if (tempAgua == null) {
        tempAgua = media(d.temperature_2m_mean.slice(Math.max(0, i - 7), i + 1));
        fuenteAgua = "estimada por la temperatura del aire de la última semana";
      }
      dias.push({
        fecha,
        codigo: d.weather_code[i],
        descripcion: CODIGOS[d.weather_code[i]] || "–",
        tMax: d.temperature_2m_max[i],
        tMin: d.temperature_2m_min[i],
        lluvia: d.precipitation_sum[i],
        viento: d.wind_speed_10m_max[i],
        rafagas: d.wind_gusts_10m_max[i],
        dirViento: rumbo(d.wind_direction_10m_dominant[i]),
        presion: pHoy,
        dPresion: pHoy != null && pAyer != null ? pHoy - pAyer : null,
        tempAgua,
        fuenteAgua,
        amanecer: d.sunrise[i],
        atardecer: d.sunset[i]
      });
    });
    let listaMareas = [], olas = null;
    if (mar && mar.hourly) {
      if (mar.hourly.sea_level_height_msl) listaMareas = mareas(mar.hourly.time, mar.hourly.sea_level_height_msl);
      const hoyOlas = mar.hourly.time.map((t, i) => t.startsWith(hoy) ? mar.hourly.wave_height[i] : null);
      const max = Math.max(...hoyOlas.filter(v => v != null));
      olas = isFinite(max) ? max : null;
    }
    return { dias, mareas: listaMareas, olas };
  }

  const api = { pronostico, marino, resumenDiario, mareas, rumbo, CODIGOS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Clima = api;
})(typeof window !== "undefined" ? window : globalThis);
