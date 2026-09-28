/* Interfaz: mapa, panel lateral, clima, luna y reportes. */
(function () {
  "use strict";

  const CLAVE_REPORTES = "pesca-ar-reportes";
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hora = d => d ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "–";
  const horaISO = s => s ? s.slice(11, 16) : "–";
  const num = (v, dec = 0) => v == null || isNaN(v) ? "–" : Number(v).toFixed(dec);
  const hoyISO = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const fechaDesdeISO = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d, 12); };
  const nombreDia = iso => fechaDesdeISO(iso).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });

  const estado = {
    punto: null,          // { lat, lng, nombre }
    fecha: hoyISO(),
    clima: null,          // resumen diario
    climaError: null,
    pedido: 0,
    filtro: ""
  };

  // ---------------- Mapa ----------------
  const mapa = L.map("mapa", { zoomControl: true, worldCopyJump: true }).setView([-38.5, -63.5], 4);

  const capas = {
    "Mapa (OpenStreetMap)": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "© OpenStreetMap"
    }),
    "Satélite (Esri)": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, attribution: "Imágenes © Esri"
    }),
    "Relieve (OpenTopoMap)": L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17, attribution: "© OpenTopoMap (CC-BY-SA)"
    })
  };
  capas["Mapa (OpenStreetMap)"].addTo(mapa);

  const capaZonas = L.layerGroup().addTo(mapa);
  const capaReportes = L.layerGroup().addTo(mapa);
  const control = L.control.layers(capas, { "Zonas de pesca": capaZonas, "Mis reportes": capaReportes }, { collapsed: true }).addTo(mapa);
  L.control.scale({ imperial: false }).addTo(mapa);

  cargarGoogleMaps();

  /** Agrega capas de Google Maps si hay clave configurada (config.js). */
  function cargarGoogleMaps() {
    const clave = window.CONFIG && window.CONFIG.GOOGLE_MAPS_API_KEY;
    if (!clave) return;
    window.__iniciarGoogle = () => {
      const s = document.createElement("script");
      s.src = "vendor/Leaflet.GoogleMutant.js";
      s.onload = () => {
        [["Google Mapa", "roadmap"], ["Google Satélite", "satellite"], ["Google Híbrido", "hybrid"], ["Google Relieve", "terrain"]]
          .forEach(([n, t]) => control.addBaseLayer(L.gridLayer.googleMutant({ type: t, maxZoom: 21 }), n));
      };
      document.head.appendChild(s);
    };
    const g = document.createElement("script");
    g.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(clave) + "&callback=__iniciarGoogle&loading=async";
    g.async = true;
    g.onerror = () => aviso("No se pudo cargar Google Maps. Revise la clave en js/config.js.");
    document.head.appendChild(g);
  }

  let marcador = null;

  function dibujarZonas() {
    capaZonas.clearLayers();
    ZONAS.forEach(z => {
      const resaltada = !estado.filtro || z.especies.includes(estado.filtro);
      const color = z.ambiente === "mar" ? "#0f9d8a" : "#1f6fd1";
      const c = L.circle([z.lat, z.lng], {
        radius: z.radioKm * 1000,
        color, weight: resaltada ? 2 : 1,
        fillOpacity: resaltada ? 0.18 : 0.03,
        opacity: resaltada ? 0.9 : 0.25
      });
      const lista = z.especies.map(id => ESPECIES[id].nombre).join(", ");
      c.bindTooltip(esc(z.nombre), { sticky: true });
      c.on("click", e => {
        L.DomEvent.stopPropagation(e);
        seleccionar(e.latlng.lat, e.latlng.lng, z.nombre);
      });
      c.bindPopup(`<strong>${esc(z.nombre)}</strong><br><small>${esc(z.provincia)} · ${esc(z.tipo)}</small><br>${esc(lista)}`);
      capaZonas.addLayer(c);
    });
  }

  mapa.on("click", e => seleccionar(e.latlng.lat, e.latlng.lng));

  // ---------------- Selección de punto ----------------
  async function seleccionar(lat, lng, nombre, zoom) {
    estado.punto = { lat, lng, nombre: nombre || null };
    estado.clima = null;
    estado.climaError = null;
    estado.agua = null;       // null = consultando, false = no es agua, objeto = cuerpo de agua
    estado.enMar = false;
    estado.hayMar = false;
    const pedido = ++estado.pedido;

    if (marcador) marcador.setLatLng([lat, lng]);
    else marcador = L.marker([lat, lng]).addTo(mapa);
    $("#reporte-ubicacion").textContent = `Ubicación: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    abrirPestana("lugar");
    mostrarEnMapa(lat, lng, zoom);
    render();

    nombrarLugar(lat, lng, pedido, !nombre);
    consultarAgua(lat, lng, pedido);

    try {
      const marP = Clima.marino(lat, lng); // nunca falla: devuelve null sin datos
      marP.then(m => { if (pedido === estado.pedido) { estado.hayMar = !!m; render(); } });
      const [fc, mar] = await Promise.all([Clima.pronostico(lat, lng), marP]);
      if (pedido !== estado.pedido) return;
      estado.clima = Clima.resumenDiario(fc, mar);
      estado.clima.actual = fc.current;
    } catch (e) {
      if (pedido !== estado.pedido) return;
      estado.climaError = "No se pudo obtener el pronóstico (" + e.message + "). Se muestran índices sólo con temporada y luna.";
    }
    render();
  }

  async function nombrarLugar(lat, lng, pedido, ponerNombre) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&accept-language=es&lat=${lat}&lon=${lng}`);
      const j = await r.json();
      if (pedido !== estado.pedido) return;
      // Sin dirección: el punto suele estar en el mar, lejos de la costa.
      if (!j.address) { estado.enMar = true; render(); return; }
      const a = j.address;
      estado.punto.provincia = a.state || "";
      if (ponerNombre) estado.punto.nombre = [a.village || a.town || a.city || a.municipality || a.county || a.water, a.state].filter(Boolean).join(", ") || j.display_name;
      render();
    } catch (e) { /* sin nombre: se muestran coordenadas */ }
  }

  const TIPOS_AGUA = { lake: "lago / laguna", reservoir: "embalse", river: "río", lagoon: "laguna costera", pond: "laguna", oxbow: "madrejón", canal: "canal", stream_pool: "pozón" };

  /** Consulta a OpenStreetMap (Overpass) si el punto está sobre un cuerpo de agua. */
  async function consultarAgua(lat, lng, pedido) {
    const q = `[out:json][timeout:8];is_in(${lat.toFixed(5)},${lng.toFixed(5)})->.a;(area.a["natural"="water"];area.a["landuse"="reservoir"];area.a["natural"="wetland"];);out tags;`;
    try {
      const r = await fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q));
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      if (pedido !== estado.pedido) return;
      const els = (j.elements || []).map(e => e.tags || {});
      // Preferir agua abierta con nombre sobre humedales.
      const t = els.find(x => x.natural === "water" && x.name) || els.find(x => x.natural === "water" || x.landuse === "reservoir") || els[0];
      estado.agua = t ? {
        nombre: t["name:es"] || t.name || "",
        tipo: t.natural === "wetland" ? "bañado / humedal" : (TIPOS_AGUA[t.water] || (t.landuse === "reservoir" ? "embalse" : "cuerpo de agua"))
      } : false;
    } catch (e) {
      if (pedido !== estado.pedido) return;
      estado.agua = undefined; // no se pudo consultar
    }
    render();
  }

  // ---------------- Cálculo de especies para el punto ----------------
  function diaSeleccionado() {
    if (!estado.clima) return null;
    return estado.clima.dias.find(d => d.fecha === estado.fecha) || null;
  }

  function especiesDelPunto() {
    const p = estado.punto;
    let { cercanas, especies, region } = Pesca.especiesEnPunto(ZONAS, p.lat, p.lng, REGIONES);
    // Mar abierto sin zona registrada: especies costeras según la latitud.
    if (!especies.some(e => e.fuente === "zona") && estado.enMar && estado.hayMar) {
      const sector = p.lat > -41 ? "Mar argentino (costa bonaerense)" : "Mar argentino (costa patagónica)";
      const zonaMar = { id: null, nombre: sector, provincia: "", tipo: "Estimación regional", regional: true };
      region = { nombre: sector };
      especies = (p.lat > -41 ? MAR_NORTE : MAR_SUR).map(id => ({ id, zona: zonaMar, distancia: 0, fuente: "region" }));
    }
    const fecha = fechaDesdeISO(estado.fecha);
    const mes = fecha.getMonth() + 1;
    const fase = Pesca.faseLunar(fecha).fase;
    const dia = diaSeleccionado();
    const lista = especies.map(e => {
      const esp = ESPECIES[e.id];
      const ind = Pesca.indiceActividad({
        especie: esp, mes, fase,
        clima: dia ? { dPresion: dia.dPresion, viento: dia.viento, lluvia: dia.lluvia } : null,
        tempAgua: dia ? dia.tempAgua : null
      });
      return { ...e, esp, ind };
    }).sort((a, b) => b.ind.valor - a.ind.valor);
    return { cercanas, lista, dia, region };
  }

  // ---------------- Render ----------------
  function render() {
    if (!estado.punto) return;
    $("#lugar-vacio").hidden = true;
    renderLugar();
    renderClima();
  }

  function enlaces(esp, zona) {
    const q = s => encodeURIComponent(s);
    const nombre = esp.nombre.replace(/\s*\(.*\)/, "");
    let lugar = zona ? zona.nombre.split("/")[0].trim() : "";
    let prov = zona ? zona.provincia.split("/")[0].trim() : "Argentina";
    if (zona && zona.regional && estado.punto) {
      lugar = (estado.agua && estado.agua.nombre) || (estado.punto.nombre || "").split(",")[0];
      prov = estado.punto.provincia || "Argentina";
    }
    const anio = new Date().getFullYear();
    return `
      <div class="enlaces">
        <a target="_blank" rel="noopener" href="https://www.google.com/search?q=${q(`parte de pesca ${nombre} ${lugar}`)}">Partes de pesca</a>
        <a target="_blank" rel="noopener" href="https://www.google.com/search?q=${q(`foro pesca ${nombre} ${lugar} carnada`)}">Foros</a>
        <a target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${q(`pesca de ${nombre} ${lugar}`)}">Videos</a>
        <a target="_blank" rel="noopener" href="https://www.google.com/search?q=${q(`reglamento pesca deportiva ${prov} ${anio} veda ${nombre}`)}">Reglamento ${esc(prov)}</a>
      </div>`;
  }

  function lista(titulo, items) {
    if (!items || !items.length) return "";
    return `<h4>${titulo}</h4><ul>${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`;
  }

  function tarjetaEspecie(item, reportes) {
    const { esp, ind, zona, distancia } = item;
    const et = Pesca.etiquetaIndice(ind.valor);
    const comps = ind.componentes.map(c => `${c.k} ${Math.round(c.v * 100)}`).join(" · ");
    const mejores = esp.meses.slice().sort((a, b) => a - b).map(m => MESES[m - 1].slice(0, 3)).join(", ");
    const propios = reportes.filter(r => r.especie === item.id && r.carnada);
    const carnadasLocales = contarCarnadas(propios);
    return `
      <details class="especie">
        <summary>
          <span class="indice ${et.clase}" title="${esc(comps)}">${ind.valor}</span>
          <span class="titulo">
            <strong>${esc(esp.nombre)}</strong>
            <small>${et.texto} · ${esp.ambiente === "mar" ? "Mar" : "Agua dulce"} · ${esc(zona.nombre)} ${distancia > 1 ? `(${num(distancia)} km)` : ""}</small>
          </span>
        </summary>
        <div class="detalle">
          <p class="cientifico">${esc(esp.cientifico)}</p>
          <p><strong>Mejores meses:</strong> ${mejores}</p>
          <p><strong>Cuándo y dónde:</strong> ${esc(esp.horario)}</p>
          ${carnadasLocales.length ? `<h4>Carnadas que funcionaron (sus reportes)</h4><ul>${carnadasLocales.map(([c, n]) => `<li>${esc(c)} <small>(${n})</small></li>`).join("")}</ul>` : ""}
          ${lista("Carnadas", esp.carnadas)}
          ${lista("Señuelos", esp.senuelos)}
          ${lista("Métodos", esp.metodos)}
          <h4>Equipo sugerido</h4><p>${esc(esp.equipo)}</p>
          <p class="nota">${esc(esp.notas)}</p>
          <p class="nota">Índice: ${esc(comps)}</p>
          <button type="button" class="ver-3d" data-especie="${item.id}">🐟 Ver en 3D y foto</button>
          ${enlaces(esp, zona)}
        </div>
      </details>`;
  }

  function renderLugar() {
    const p = estado.punto;
    const { cercanas, lista: especies, dia, region } = especiesDelPunto();
    const enZona = cercanas.some(c => c.dentro);
    const reportes = reportesCerca(p.lat, p.lng, 30);
    const gmaps = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
    const luna = Pesca.faseLunar(fechaDesdeISO(estado.fecha));

    let html = `
      <div class="encabezado">
        <h2>${esc(p.nombre || "Punto seleccionado")}</h2>
        <p class="nota">${p.lat.toFixed(4)}, ${p.lng.toFixed(4)} · <a href="${gmaps}" target="_blank" rel="noopener">Abrir en Google Maps</a></p>
        <p class="resumen-dia">
          ${nombreDia(estado.fecha)} · ${luna.icono} ${luna.nombre} (${Math.round(luna.iluminacion * 100)}%)
          ${dia ? ` · ${esc(dia.descripcion)}, ${num(dia.tMin)}–${num(dia.tMax)} °C, viento ${num(dia.viento)} km/h ${dia.dirViento}` : ""}
        </p>
        ${estado.agua ? `<p class="agua">💧 ${esc(estado.agua.nombre || "Cuerpo de agua sin nombre")} <small>(${esc(estado.agua.tipo)})</small></p>` : ""}
        ${estado.agua === false && !enZona ? `<p class="nota">Según OpenStreetMap este punto no está sobre agua: las especies corresponden a los ambientes cercanos. Toque sobre el agua para mayor precisión.</p>` : ""}
        ${estado.climaError ? `<p class="error">${esc(estado.climaError)}</p>` : ""}
        ${!estado.clima && !estado.climaError ? `<p class="nota">Cargando pronóstico…</p>` : ""}
        ${estado.clima && !dia ? `<p class="nota">Sin pronóstico para la fecha elegida (sólo hay 7 días). El índice usa temporada y luna.</p>` : ""}
      </div>`;

    if (!especies.length) {
      const z = cercanas[0];
      html += `<div class="vacio"><p>No hay zonas de pesca registradas cerca de este punto.</p>
        ${z ? `<p>La más cercana es <a href="#" data-ir="${z.zona.id}">${esc(z.zona.nombre)}</a> (${num(z.distancia)} km).</p>` : ""}
        <p class="nota">Puede registrar un reporte propio en la pestaña Reportes para este lugar.</p></div>`;
    } else {
      if (region) {
        html += `<div class="regional"><strong>Estimación regional · ${esc(region.nombre)}</strong>
          <p>Este lugar no está en la base de zonas de pesca. Se muestran las especies típicas de la región; puede que no estén todas presentes en este ambiente. Confirme con partes de pesca o pescadores locales, y registre su salida en Reportes para mejorar la información.</p></div>`;
      }
      const notasZona = cercanas.filter(c => c.dentro && c.zona.notas);
      notasZona.forEach(c => { html += `<p class="regional"><strong>${esc(c.zona.nombre)}:</strong> ${esc(c.zona.notas)}</p>`; });
      html += `<h3>Especies probables (${especies.length})</h3>
        <p class="nota">Ordenadas por índice de actividad (0–100) para la fecha elegida. Toque una especie para ver carnadas, señuelos y métodos.</p>
        ${especies.map(e => tarjetaEspecie(e, reportes)).join("")}`;
      html += `<h3>Zonas cercanas</h3><ul class="zonas">${cercanas.slice(0, 4).map(c => `
        <li><a href="#" data-ir="${c.zona.id}">${esc(c.zona.nombre)}</a>
        <small>${esc(c.zona.provincia)} · ${esc(c.zona.tipo)} · ${c.dentro ? "dentro de la zona" : num(c.distancia) + " km"}</small>
        ${c.zona.notas ? `<small class="nota">${esc(c.zona.notas)}</small>` : ""}</li>`).join("")}</ul>`;
    }

    if (reportes.length) {
      html += `<h3>Reportes cercanos (${reportes.length})</h3>${reportes.slice(0, 5).map(filaReporte).join("")}`;
    }
    $("#lugar").innerHTML = html;
  }

  function renderClima() {
    const p = estado.punto;
    const fecha = fechaDesdeISO(estado.fecha);
    const luna = Pesca.faseLunar(fecha);
    const sol = Pesca.periodosSolunares(fecha, p.lat, p.lng);
    const rango = r => `${hora(r.desde)}–${hora(r.hasta)}`;

    let html = `<h3>Luna · ${nombreDia(estado.fecha)}</h3>
      <div class="luna">
        <span class="luna-icono" aria-hidden="true">${luna.icono}</span>
        <div>
          <strong>${luna.nombre}</strong> · iluminación ${Math.round(luna.iluminacion * 100)}%<br>
          <small>Sale ${hora(sol.salidaLuna)} · se pone ${hora(sol.puestaLuna)} · Sol: ${hora(sol.amanecer)}–${hora(sol.atardecer)}</small><br>
          <small>Influencia lunar (teoría solunar): ${Math.round(Pesca.puntajeLuna(luna.fase) * 100)}/100</small>
        </div>
      </div>
      <h4>Períodos solunares</h4>
      <p><strong>Mayores:</strong> ${sol.mayores.map(rango).join(" y ")}<br>
         <strong>Menores:</strong> ${sol.menores.map(rango).join(" y ") || "–"}</p>
      <p class="nota">Los períodos mayores corresponden al paso de la luna por el meridiano del lugar; los menores a su salida y puesta. Coincidir con amanecer o atardecer los potencia. La evidencia científica sobre el efecto lunar es limitada: úselo como referencia secundaria frente al clima y la temporada.</p>`;

    if (estado.climaError) html += `<p class="error">${esc(estado.climaError)}</p>`;
    else if (!estado.clima) html += `<p class="nota">Cargando pronóstico…</p>`;
    else {
      const a = estado.clima.actual;
      if (a) {
        html += `<h3>Ahora</h3>
          <div class="grilla-actual">
            <div><small>Temperatura</small><strong>${num(a.temperature_2m, 1)} °C</strong></div>
            <div><small>Viento</small><strong>${num(a.wind_speed_10m)} km/h ${Clima.rumbo(a.wind_direction_10m)}</strong></div>
            <div><small>Ráfagas</small><strong>${num(a.wind_gusts_10m)} km/h</strong></div>
            <div><small>Presión</small><strong>${num(a.pressure_msl)} hPa</strong></div>
            <div><small>Humedad</small><strong>${num(a.relative_humidity_2m)} %</strong></div>
            <div><small>Cielo</small><strong>${esc(Clima.CODIGOS[a.weather_code] || "–")}</strong></div>
            ${estado.clima.olas != null ? `<div><small>Olas (máx. hoy)</small><strong>${num(estado.clima.olas, 1)} m</strong></div>` : ""}
          </div>`;
      }
      const especies = especiesDelPunto().lista;
      html += `<h3>Pronóstico de pesca (7 días)</h3>
        <div class="tabla-scroll"><table class="pronostico">
        <thead><tr><th>Día</th><th>Cielo</th><th>°C</th><th>Viento</th><th>Lluvia</th><th>Presión</th><th>Agua</th><th>Luna</th><th>Mejor especie</th></tr></thead><tbody>
        ${estado.clima.dias.map(d => {
          const f = fechaDesdeISO(d.fecha);
          const l = Pesca.faseLunar(f);
          const mejor = especies.map(e => ({ e, ind: Pesca.indiceActividad({
            especie: e.esp, mes: f.getMonth() + 1, fase: l.fase,
            clima: { dPresion: d.dPresion, viento: d.viento, lluvia: d.lluvia }, tempAgua: d.tempAgua
          }) })).sort((x, y) => y.ind.valor - x.ind.valor)[0];
          const flecha = d.dPresion == null ? "" : d.dPresion <= -1 ? "↘" : d.dPresion >= 1 ? "↗" : "→";
          const et = mejor ? Pesca.etiquetaIndice(mejor.ind.valor) : null;
          return `<tr class="${d.fecha === estado.fecha ? "sel" : ""}" data-fecha="${d.fecha}">
            <td>${nombreDia(d.fecha)}</td><td>${esc(d.descripcion)}</td>
            <td>${num(d.tMin)}/${num(d.tMax)}</td><td>${num(d.viento)} ${d.dirViento}</td>
            <td>${num(d.lluvia, 1)} mm</td><td>${num(d.presion)} ${flecha}</td>
            <td title="${esc(d.fuenteAgua)}">${num(d.tempAgua)}°</td><td>${l.icono}</td>
            <td>${mejor ? `<span class="indice chico ${et.clase}">${mejor.ind.valor}</span> ${esc(mejor.e.esp.nombre.replace(/\s*\(.*\)/, ""))}` : "–"}</td></tr>`;
        }).join("")}
        </tbody></table></div>
        <p class="nota">Toque un día para usarlo como fecha. Presión: ↘ en baja (suele activar el pique antes de un frente), ↗ en suba (pique más lento tras el frente). Temperatura del agua: en mar es la del modelo marino; en agua dulce es una estimación a partir del aire.</p>`;

      if (estado.clima.mareas.length) {
        const porDia = estado.clima.mareas.filter(m => m.hora.startsWith(estado.fecha));
        html += `<h3>Mareas estimadas · ${nombreDia(estado.fecha)}</h3>
          ${porDia.length ? `<ul class="mareas">${porDia.map(m => `<li>${m.tipo === "Pleamar" ? "▲" : "▼"} ${m.tipo} ${horaISO(m.hora)} <small>(${num(m.nivel, 2)} m)</small></li>`).join("")}</ul>` : "<p>Sin datos para la fecha.</p>"}
          <p class="nota">Estimación de modelo global con resolución baja: en bahías y estuarios puede diferir en más de una hora. Para horarios precisos consulte las tablas del Servicio de Hidrografía Naval (SHN).</p>`;
      }
    }
    $("#clima").innerHTML = html;
  }

  // ---------------- Catálogo de especies ----------------
  function renderCatalogo() {
    const mes = fechaDesdeISO(estado.fecha).getMonth() + 1;
    const ids = Object.keys(ESPECIES).sort((a, b) => ESPECIES[a].nombre.localeCompare(ESPECIES[b].nombre));
    const grupo = amb => ids.filter(id => ESPECIES[id].ambiente === amb).map(id => {
      const e = ESPECIES[id];
      const temp = Pesca.puntajeTemporada(e, mes);
      const zonas = ZONAS.filter(z => z.especies.includes(id)).map(z => z.nombre.split("(")[0].trim());
      const barra = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1, c = e.meses.includes(m) ? "alta" : (e.posibles || []).includes(m) ? "media" : "";
        return `<span class="${c}${m === mes ? " actual" : ""}" title="${MESES[i]}">${MESES[i][0].toUpperCase()}</span>`;
      }).join("");
      return `<details class="especie">
        <summary>
          <span class="indice ${temp === 1 ? "muy-bueno" : temp > 0.5 ? "regular" : "bajo"}">${temp === 1 ? "✓" : temp > 0.5 ? "~" : "✗"}</span>
          <span class="titulo"><strong>${esc(e.nombre)}</strong><small>${temp === 1 ? "En temporada" : temp > 0.5 ? "Temporada baja" : "Fuera de temporada"} en ${MESES[mes - 1]}</small></span>
        </summary>
        <div class="detalle">
          <p class="cientifico">${esc(e.cientifico)}</p>
          <div class="meses">${barra}</div>
          <p><strong>Zonas:</strong> ${esc(zonas.join(" · "))}</p>
          <p><strong>Cuándo y dónde:</strong> ${esc(e.horario)}</p>
          ${lista("Carnadas", e.carnadas)}${lista("Señuelos", e.senuelos)}${lista("Métodos", e.metodos)}
          <h4>Equipo sugerido</h4><p>${esc(e.equipo)}</p>
          <p class="nota">${esc(e.notas)}</p>
          <button type="button" class="ver-3d" data-especie="${id}">🐟 Ver en 3D y foto</button>
          <button type="button" class="ver-zonas" data-especie="${id}">Ver zonas en el mapa</button>
          ${enlaces(e, null)}
        </div>
      </details>`;
    }).join("");
    $("#catalogo").innerHTML = `<h3>Agua dulce</h3>${grupo("dulce")}<h3>Mar</h3>${grupo("mar")}`;
  }

  function llenarSelects() {
    const opciones = Object.keys(ESPECIES)
      .sort((a, b) => ESPECIES[a].nombre.localeCompare(ESPECIES[b].nombre))
      .map(id => `<option value="${id}">${esc(ESPECIES[id].nombre)}</option>`).join("");
    $("#filtro-especie").insertAdjacentHTML("beforeend", opciones);
    $("#form-reporte [name=especie]").innerHTML = opciones + `<option value="otra">Otra</option>`;
  }

  function filtrarEspecie(id) {
    estado.filtro = id;
    $("#filtro-especie").value = id;
    dibujarZonas();
    const zonas = ZONAS.filter(z => !id || z.especies.includes(id));
    if (id && zonas.length) mapa.fitBounds(L.latLngBounds(zonas.map(z => [z.lat, z.lng])).pad(0.3));
  }

  // ---------------- Reportes (almacenamiento local) ----------------
  function leerReportes() {
    try { return JSON.parse(localStorage.getItem(CLAVE_REPORTES)) || []; } catch (e) { return []; }
  }
  function guardarReportes(lista) {
    try { localStorage.setItem(CLAVE_REPORTES, JSON.stringify(lista)); }
    catch (e) { aviso("No se pudo guardar en este dispositivo."); }
  }
  function reportesCerca(lat, lng, km) {
    return leerReportes()
      .filter(r => Pesca.distanciaKm(lat, lng, r.lat, r.lng) <= km)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  function contarCarnadas(reps) {
    const m = new Map();
    reps.filter(r => Number(r.resultado) >= 2).forEach(r => {
      const k = r.carnada.trim().toLowerCase();
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }
  const RESULTADOS = ["Sin pique", "Pocas piezas", "Normal", "Muy bueno"];
  const nombreEspecie = id => ESPECIES[id] ? ESPECIES[id].nombre : "Otra";

  function filaReporte(r) {
    return `<div class="reporte">
      <strong>${esc(nombreEspecie(r.especie))}</strong> · ${esc(r.fecha.slice(0, 10))} · ${RESULTADOS[r.resultado] || ""}
      <br><small>${r.carnada ? "Carnada: " + esc(r.carnada) : ""} ${r.metodo ? "· Método: " + esc(r.metodo) : ""}</small>
      ${r.notas ? `<br><small>${esc(r.notas)}</small>` : ""}
    </div>`;
  }

  function dibujarReportes() {
    capaReportes.clearLayers();
    const reps = leerReportes();
    reps.forEach(r => {
      L.circleMarker([r.lat, r.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#e8793a", fillOpacity: 0.95 })
        .bindPopup(filaReporte(r)).addTo(capaReportes);
    });
    $("#lista-reportes").innerHTML = reps.length
      ? `<h3>Mis reportes (${reps.length})</h3>` + reps.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map(r =>
        filaReporte(r).replace("</div>", `<button type="button" class="borrar" data-id="${esc(r.id)}">Eliminar</button></div>`)).join("")
      : `<p class="nota">Todavía no hay reportes.</p>`;
  }

  $("#form-reporte").addEventListener("submit", e => {
    e.preventDefault();
    if (!estado.punto) { aviso("Primero seleccione un punto en el mapa."); return; }
    const f = new FormData(e.target);
    const lista = leerReportes();
    lista.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      lat: +estado.punto.lat.toFixed(5), lng: +estado.punto.lng.toFixed(5),
      fecha: estado.fecha + new Date().toISOString().slice(10, 16),
      especie: f.get("especie"), resultado: Number(f.get("resultado")),
      carnada: String(f.get("carnada") || "").trim(), metodo: String(f.get("metodo") || "").trim(),
      notas: String(f.get("notas") || "").trim()
    });
    guardarReportes(lista);
    e.target.reset();
    dibujarReportes();
    render();
    aviso("Reporte guardado.");
  });

  $("#lista-reportes").addEventListener("click", e => {
    const id = e.target.dataset && e.target.dataset.id;
    if (!id || !confirm("¿Eliminar este reporte?")) return;
    guardarReportes(leerReportes().filter(r => r.id !== id));
    dibujarReportes();
    render();
  });

  $("#exportar").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(leerReportes(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reportes-pesca-${hoyISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("#importar").addEventListener("change", async e => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
      const datos = JSON.parse(await archivo.text());
      if (!Array.isArray(datos)) throw new Error("formato");
      const validos = datos.filter(r => r && typeof r.lat === "number" && typeof r.lng === "number" &&
        typeof r.fecha === "string" && typeof r.especie === "string")
        .map(r => ({
          id: String(r.id || Math.random().toString(36).slice(2)), lat: r.lat, lng: r.lng, fecha: r.fecha.slice(0, 16),
          especie: r.especie, resultado: Math.max(0, Math.min(3, Number(r.resultado) || 0)),
          carnada: String(r.carnada || "").slice(0, 80), metodo: String(r.metodo || "").slice(0, 80), notas: String(r.notas || "").slice(0, 400)
        }));
      const actuales = leerReportes();
      const ids = new Set(actuales.map(r => r.id));
      const nuevos = validos.filter(r => !ids.has(r.id));
      guardarReportes(actuales.concat(nuevos));
      dibujarReportes();
      if (estado.punto) render();
      aviso(`Se importaron ${nuevos.length} reportes.`);
    } catch (err) {
      aviso("El archivo no es un JSON de reportes válido.");
    }
    e.target.value = "";
  });

  // ---------------- Búsqueda y ubicación ----------------
  $("#buscador").addEventListener("submit", async e => {
    e.preventDefault();
    const q = $("#busqueda").value.trim();
    if (!q) return;
    const zona = ZONAS.find(z => z.nombre.toLowerCase().includes(q.toLowerCase()));
    if (zona) { irAZona(zona); return; }
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&accept-language=es&q=${encodeURIComponent(q)}`);
      const j = await r.json();
      if (!j.length) { aviso("No se encontró el lugar."); return; }
      const lat = +j[0].lat, lng = +j[0].lon;
      seleccionar(lat, lng, j[0].display_name.split(",").slice(0, 2).join(","), 11);
    } catch (err) {
      aviso("Error de conexión al buscar.");
    }
  });

  $("#btn-ubicacion").addEventListener("click", () => {
    if (!navigator.geolocation) { aviso("Este navegador no permite obtener la ubicación."); return; }
    aviso("Obteniendo ubicación…");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        seleccionar(lat, lng, null, 11);
        aviso("Ubicación obtenida.");
      },
      err => aviso(err.code === 1 ? "Permiso de ubicación denegado." : "No se pudo obtener la ubicación (requiere HTTPS)."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });

  function irAZona(z) {
    seleccionar(z.lat, z.lng, z.nombre, 10);
  }

  // ---------------- Panel, pestañas y fecha ----------------
  function abrirPestana(t) {
    document.querySelectorAll(".pestanas button").forEach(b => b.classList.toggle("activa", b.dataset.tab === t));
    document.querySelectorAll(".tab").forEach(s => s.classList.toggle("activa", s.id === "tab-" + t));
    if (panelEstado === "min") fijarPanel("medio");
  }

  // Panel inferior en celular: "min" deja el mapa casi completo a la vista,
  // "medio" muestra mapa y detalle, "max" prioriza el detalle.
  const esMovil = () => window.matchMedia("(max-width: 820px)").matches;
  const ALTO_MIN = 60;
  let panelEstado = "min";

  function altoPanel(est) {
    const total = $(".contenido").clientHeight;
    if (est === "max") return Math.round(total * 0.88);
    if (est === "medio") return Math.round(total * 0.5);
    return ALTO_MIN;
  }

  function aplicarAlto(px) {
    const panel = $("#panel");
    if (!esMovil()) { panel.style.height = ""; $(".contenido").style.removeProperty("--alto-panel"); return; }
    panel.style.height = px + "px";
    $(".contenido").style.setProperty("--alto-panel", px + "px");
  }

  function fijarPanel(est) {
    panelEstado = est;
    $("#panel").dataset.estado = est;
    aplicarAlto(altoPanel(est));
  }

  /** Centra el punto en la parte del mapa que no tapa el panel. */
  function mostrarEnMapa(lat, lng, zoom) {
    if (zoom != null) mapa.setView([lat, lng], zoom, { animate: false });
    if (!esMovil()) return;
    const visible = $(".contenido").clientHeight - altoPanel(panelEstado);
    const y = mapa.latLngToContainerPoint([lat, lng]).y;
    if (zoom != null || y > visible - 40 || y < 40) mapa.panBy([0, y - visible / 2]);
  }

  document.querySelector(".pestanas").addEventListener("click", e => {
    if (e.target.dataset.tab) abrirPestana(e.target.dataset.tab);
  });

  // Arrastre de la hoja: la asa y la barra de pestañas se pueden deslizar.
  (function () {
    const panel = $("#panel");
    let inicioY = null, altoInicial = 0, movido = false;
    const empezar = e => {
      if (!esMovil()) return;
      inicioY = e.clientY; altoInicial = panel.getBoundingClientRect().height; movido = false;
    };
    const mover = e => {
      if (inicioY == null) return;
      const d = inicioY - e.clientY;
      if (!movido && Math.abs(d) < 8) return;
      movido = true;
      panel.classList.add("arrastrando");
      const total = $(".contenido").clientHeight;
      aplicarAlto(Math.max(ALTO_MIN, Math.min(total * 0.92, altoInicial + d)));
    };
    const terminar = () => {
      if (inicioY == null) return;
      inicioY = null;
      panel.classList.remove("arrastrando");
      if (!movido) return;
      const alto = panel.getBoundingClientRect().height;
      const opciones = ["min", "medio", "max"].map(k => [k, Math.abs(altoPanel(k) - alto)]);
      fijarPanel(opciones.sort((a, b) => a[1] - b[1])[0][0]);
    };
    [$("#asa"), document.querySelector(".pestanas")].forEach(el => {
      el.addEventListener("pointerdown", empezar);
      el.addEventListener("click", e => { if (movido) { e.stopImmediatePropagation(); e.preventDefault(); movido = false; } }, true);
    });
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", terminar);
    window.addEventListener("pointercancel", terminar);
  })();

  $("#asa").addEventListener("click", () => {
    fijarPanel({ min: "medio", medio: "max", max: "min" }[panelEstado]);
  });

  window.addEventListener("resize", () => { aplicarAlto(altoPanel(panelEstado)); mapa.invalidateSize(); });
  fijarPanel("min");
  // Vista inicial: Argentina completa en el área que no tapa el panel.
  mapa.fitBounds([[-55.1, -73.6], [-21.8, -53.6]], { paddingBottomRight: [0, esMovil() ? ALTO_MIN : 0] });

  $("#panel").addEventListener("click", e => {
    const ir = e.target.closest("[data-ir]");
    if (ir) { e.preventDefault(); irAZona(ZONAS.find(z => z.id === ir.dataset.ir)); return; }
    const v3 = e.target.closest(".ver-3d");
    if (v3) { abrir3D(v3.dataset.especie); return; }
    const ver = e.target.closest(".ver-zonas");
    if (ver) { filtrarEspecie(ver.dataset.especie); return; }
    const fila = e.target.closest("tr[data-fecha]");
    if (fila) { cambiarFecha(fila.dataset.fecha); }
  });

  $("#filtro-especie").addEventListener("change", e => filtrarEspecie(e.target.value));

  function cambiarFecha(iso) {
    estado.fecha = iso;
    $("#fecha").value = iso;
    renderCatalogo();
    render();
  }
  $("#fecha").value = estado.fecha;
  $("#fecha").addEventListener("change", e => { if (e.target.value) cambiarFecha(e.target.value); });

  // ---------------- Visor 3D y foto ----------------
  // Artículos de Wikipedia para la foto (se prueba en español y luego en inglés).
  const WIKI = {
    dorado: ["Salminus brasiliensis"], surubi: ["Pseudoplatystoma corruscans"], pacu: ["Piaractus mesopotamicus"],
    boga: ["Megaleporinus obtusidens", "Leporinus obtusidens"], pejerrey: ["Odontesthes bonariensis"],
    tararira: ["Hoplias malabaricus"], bagre: ["Pimelodus maculatus"], armado: ["Pterodoras granulosus"],
    pati: ["Luciopimelodus pati"], palometa: ["Pygocentrus nattereri"], carpa: ["Cyprinus carpio"],
    trucha: ["Oncorhynchus mykiss"], truchaMarron: ["Salmo trutta"], perca: ["Percichthys trucha"],
    pejerreyPatagonico: ["Odontesthes hatcheri"], salmonEncerrado: ["Salmo salar"],
    corvinaRubia: ["Micropogonias furnieri"], corvinaNegra: ["Pogonias courbina", "Pogonias cromis"],
    pescadilla: ["Cynoscion guatucupa"], anchoa: ["Pomatomus saltatrix"], brotola: ["Urophycis brasiliensis"],
    lenguado: ["Paralichthys patagonicus", "Paralichthys orbignyanus"], pejerreyMar: ["Odontesthes argentinensis"],
    tiburones: ["Carcharias taurus"], gatuzo: ["Mustelus schmitti"], lisa: ["Mugil liza"],
    salmonMar: ["Pseudopercis semifasciata"], mero: ["Acanthistius patachonicus"],
    robalo: ["Eleginops maclovinus"], pezPalo: ["Percophis brasiliensis"]
  };
  let visor3d = null;

  async function abrir3D(id) {
    const esp = ESPECIES[id];
    if (!esp) return;
    $("#visor-titulo").textContent = esp.nombre;
    $("#visor-lienzo").innerHTML = "<span>Cargando modelo 3D…</span>";
    $("#visor-foto").innerHTML = "";
    $("#visor3d").hidden = false;
    cargarFoto(id);
    try {
      visor3d = visor3d || await import(new URL("js/peces3d.js", document.baseURI).href);
      if ($("#visor3d").hidden) return;
      visor3d.abrirVisor($("#visor-lienzo"), id);
    } catch (e) {
      $("#visor-lienzo").innerHTML = "<span>No se pudo mostrar el modelo 3D en este dispositivo.</span>";
    }
  }

  function cerrar3D() {
    $("#visor3d").hidden = true;
    if (visor3d) visor3d.cerrarVisor();
  }
  $("#visor-cerrar").addEventListener("click", cerrar3D);
  $("#visor3d").addEventListener("click", e => { if (e.target.id === "visor3d") cerrar3D(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#visor3d").hidden) cerrar3D(); });

  async function cargarFoto(id) {
    const destino = $("#visor-foto");
    for (const idioma of ["es", "en"]) {
      for (const titulo of WIKI[id] || []) {
        try {
          const r = await fetch(`https://${idioma}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo.replace(/ /g, "_"))}`);
          if (!r.ok) continue;
          const j = await r.json();
          const img = j.originalimage || j.thumbnail;
          if (!img || !img.source || j.type === "disambiguation") continue;
          if ($("#visor-titulo").textContent !== ESPECIES[id].nombre) return; // se abrió otra especie
          const src = j.thumbnail && j.thumbnail.width >= 600 ? j.thumbnail.source : img.source;
          const enlace = j.content_urls && j.content_urls.desktop ? j.content_urls.desktop.page : `https://${idioma}.wikipedia.org/wiki/${encodeURIComponent(titulo)}`;
          destino.innerHTML = `<figure><img src="${esc(src)}" alt="Foto de ${esc(ESPECIES[id].nombre)}" loading="lazy">
            <figcaption>Foto real: <a href="${esc(enlace)}" target="_blank" rel="noopener">${esc(j.title)} en Wikipedia</a> (Wikimedia Commons; ver licencia en el artículo).</figcaption></figure>`;
          return;
        } catch (e) { /* probar el siguiente */ }
      }
    }
    destino.innerHTML = `<p class="nota">No se encontró una foto para esta especie.</p>`;
  }

  let temporizador;
  function aviso(txt) {
    const t = $("#toast");
    t.textContent = txt;
    t.classList.add("visible");
    clearTimeout(temporizador);
    temporizador = setTimeout(() => t.classList.remove("visible"), 3500);
  }

  // ---------------- Inicio ----------------
  llenarSelects();
  dibujarZonas();
  dibujarReportes();
  renderCatalogo();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  window.__app = { seleccionar, estado, cambiarFecha };
})();
