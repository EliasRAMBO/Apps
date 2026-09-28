/*
 * Modelos 3D ilustrativos de las especies, generados por código (sin archivos
 * de modelos): cuerpo paramétrico + aletas + textura pintada en un canvas.
 * No son reproducciones exactas: muestran forma, aletas y patrón de color típicos.
 */
import * as THREE from "../vendor/three/three.min.js";

// ---------------- Formas por especie ----------------
// Cuerpo: h = media altura máx., pos = posición de la altura máx. (0 cola, 1 hocico),
// ped = media altura del pedúnculo, b = afinamiento del hocico (<1 romo),
// ancho / anchoCabeza = relación ancho/alto en el cuerpo y en la cabeza,
// arriba / abajo = factor de la mitad dorsal y ventral.
const BASE = {
  h: 0.26, pos: 0.55, ped: 0.07, a: 1, b: 0.8, ancho: 0.5, anchoCabeza: 0.55, arriba: 1, abajo: 1,
  cola: { tipo: "horquillada", largo: 0.42, alto: 0.34 },
  dorsal: [{ u0: 0.45, u1: 0.62, alto: 0.2 }],
  adiposa: null,
  anal: [{ u0: 0.18, u1: 0.3, alto: 0.12 }],
  pectoral: 0.16, pelvica: 0.1,
  bigotes: null,
  ojo: { u: 0.86, s: 0.35, r: 0.042 },
  colores: { lomo: "#556b2f", flanco: "#b9b9a0", vientre: "#f0f0e8", aletas: "#8a8a70" },
  patrones: []
};

const FORMAS = {
  dorado: {
    h: 0.27, ancho: 0.45, colores: { lomo: "#8a6a18", flanco: "#e0a52a", vientre: "#f6e7a6", aletas: "#e8922a" },
    adiposa: { u0: 0.2, u1: 0.26, alto: 0.05 },
    patrones: [{ tipo: "filas", color: "#3a2a0a", filas: [0.62, 0.4, 0.18, -0.04, -0.26], paso: 0.028, r: 0.012 }]
  },
  surubi: {
    h: 0.15, pos: 0.7, b: 0.55, ancho: 0.9, anchoCabeza: 1.4, abajo: 0.8,
    colores: { lomo: "#4a4a45", flanco: "#8a8a80", vientre: "#f2f2ee", aletas: "#5e5e58" },
    dorsal: [{ u0: 0.55, u1: 0.65, alto: 0.18 }], adiposa: { u0: 0.18, u1: 0.34, alto: 0.05 },
    bigotes: { n: 6, largo: 0.45 },
    patrones: [{ tipo: "barras", color: "#1d1d1b", frec: 24, ancho: 0.22, sMin: -0.25 },
      { tipo: "puntos", color: "#1d1d1b", celda: 0.035, r: 0.28, sMin: -0.1 }]
  },
  pacu: {
    h: 0.45, pos: 0.5, b: 0.7, ancho: 0.35, anchoCabeza: 0.4,
    colores: { lomo: "#35352f", flanco: "#6f6d66", vientre: "#d9b36a", aletas: "#44443e" },
    dorsal: [{ u0: 0.42, u1: 0.58, alto: 0.2 }], adiposa: { u0: 0.2, u1: 0.25, alto: 0.05 },
    anal: [{ u0: 0.12, u1: 0.34, alto: 0.12 }], cola: { tipo: "horquillada", largo: 0.34, alto: 0.4 }
  },
  palometa: {
    h: 0.45, pos: 0.5, b: 0.65, ancho: 0.35, anchoCabeza: 0.45,
    colores: { lomo: "#5f6a70", flanco: "#b9c2c6", vientre: "#d9542a", aletas: "#6a6a64" },
    dorsal: [{ u0: 0.42, u1: 0.56, alto: 0.18 }], adiposa: { u0: 0.2, u1: 0.25, alto: 0.04 },
    anal: [{ u0: 0.12, u1: 0.36, alto: 0.12 }], cola: { tipo: "truncada", largo: 0.3, alto: 0.36 },
    patrones: [{ tipo: "puntos", color: "#4a5358", celda: 0.03, r: 0.18, sMin: -0.2 }]
  },
  boga: {
    h: 0.21, ancho: 0.5, colores: { lomo: "#5e6b4a", flanco: "#c9c9b0", vientre: "#f4f2e6", aletas: "#b8a878" },
    adiposa: { u0: 0.2, u1: 0.25, alto: 0.04 },
    patrones: [{ tipo: "manchas", color: "#3a3a30", lugares: [[0.22, 0.02], [0.44, 0.04], [0.66, 0.06]], r: 0.028 }]
  },
  pejerrey: {
    h: 0.15, ancho: 0.6, colores: { lomo: "#6f8b8a", flanco: "#dfe8e6", vientre: "#f7fafa", aletas: "#c8d4d2" },
    dorsal: [{ u0: 0.55, u1: 0.62, alto: 0.08 }, { u0: 0.32, u1: 0.42, alto: 0.1 }],
    anal: [{ u0: 0.14, u1: 0.4, alto: 0.08 }],
    patrones: [{ tipo: "banda", s: 0.05, ancho: 0.08, color: "#f4fbfb", borde: "#7f9c9d" }]
  },
  truchaMarron: {
    h: 0.22, ancho: 0.5, colores: { lomo: "#5a4a2a", flanco: "#b08a4a", vientre: "#efe2c0", aletas: "#8a6a3a" },
    adiposa: { u0: 0.2, u1: 0.25, alto: 0.05 }, cola: { tipo: "truncada", largo: 0.36, alto: 0.3 },
    patrones: [{ tipo: "puntos", color: "#1e1e1e", celda: 0.032, r: 0.22, sMin: -0.15 },
      { tipo: "puntos", color: "#c0392b", celda: 0.05, r: 0.16, sMin: -0.3, semilla: 7 }]
  },
  trucha: {
    h: 0.22, ancho: 0.5, colores: { lomo: "#4d6a4a", flanco: "#c9cdb8", vientre: "#f3f1ea", aletas: "#8a8a6a" },
    adiposa: { u0: 0.2, u1: 0.25, alto: 0.05 }, cola: { tipo: "truncada", largo: 0.36, alto: 0.3 },
    patrones: [{ tipo: "banda", s: 0.02, ancho: 0.13, color: "#d9707a" },
      { tipo: "puntos", color: "#1e1e1e", celda: 0.03, r: 0.14, sMin: -0.1 }]
  },
  perca: {
    h: 0.3, ancho: 0.45, colores: { lomo: "#4f4a2e", flanco: "#a0925a", vientre: "#e8e0c8", aletas: "#8a7a4a" },
    dorsal: [{ u0: 0.5, u1: 0.66, alto: 0.2, espinosa: true }, { u0: 0.34, u1: 0.49, alto: 0.15 }],
    cola: { tipo: "truncada", largo: 0.34, alto: 0.3 },
    patrones: [{ tipo: "moteado", color: "#3a3620", escala: 9, umbral: 0.6 }]
  },
  salmonEncerrado: {
    h: 0.22, ancho: 0.5, colores: { lomo: "#4a5c6a", flanco: "#d6dde2", vientre: "#f6f8f8", aletas: "#8a98a2" },
    adiposa: { u0: 0.2, u1: 0.25, alto: 0.05 }, cola: { tipo: "truncada", largo: 0.38, alto: 0.32 },
    patrones: [{ tipo: "puntos", color: "#1e2226", celda: 0.03, r: 0.16, sMin: 0.1 }]
  },
  corvinaRubia: {
    h: 0.26, ancho: 0.5, colores: { lomo: "#8a7a4a", flanco: "#d8bf7a", vientre: "#f1e8cc", aletas: "#c8a860" },
    dorsal: [{ u0: 0.5, u1: 0.63, alto: 0.18, espinosa: true }, { u0: 0.24, u1: 0.49, alto: 0.11 }],
    cola: { tipo: "truncada", largo: 0.32, alto: 0.28 },
    patrones: [{ tipo: "oblicuas", color: "#6a5a30", frec: 38, ancho: 0.2, sMin: 0.0 }]
  },
  corvinaNegra: {
    h: 0.32, ancho: 0.5, b: 0.7, colores: { lomo: "#2e2e2a", flanco: "#5a5a52", vientre: "#bdb8a8", aletas: "#3a3a36" },
    dorsal: [{ u0: 0.5, u1: 0.64, alto: 0.2, espinosa: true }, { u0: 0.26, u1: 0.49, alto: 0.12 }],
    cola: { tipo: "truncada", largo: 0.32, alto: 0.3 }, bigotes: { n: 8, largo: 0.08, menton: true },
    patrones: [{ tipo: "barras", color: "#1a1a18", frec: 9, ancho: 0.3, sMin: -0.5 }]
  },
  pescadilla: {
    h: 0.19, ancho: 0.5, colores: { lomo: "#6f7f7a", flanco: "#d7dcd6", vientre: "#f5f6f2", aletas: "#b8bfb2" },
    dorsal: [{ u0: 0.52, u1: 0.62, alto: 0.14, espinosa: true }, { u0: 0.24, u1: 0.5, alto: 0.08 }],
    cola: { tipo: "truncada", largo: 0.34, alto: 0.26 }
  },
  anchoa: {
    h: 0.22, ancho: 0.5, colores: { lomo: "#3f6a86", flanco: "#b8c8cc", vientre: "#f1f4f3", aletas: "#7f97a2" },
    dorsal: [{ u0: 0.52, u1: 0.6, alto: 0.1 }, { u0: 0.26, u1: 0.48, alto: 0.12 }],
    cola: { tipo: "horquillada", largo: 0.5, alto: 0.4 }
  },
  brotola: {
    h: 0.2, pos: 0.6, ancho: 0.5, colores: { lomo: "#6a5540", flanco: "#a88a64", vientre: "#e7dcc6", aletas: "#8a7050" },
    dorsal: [{ u0: 0.63, u1: 0.7, alto: 0.12 }, { u0: 0.1, u1: 0.61, alto: 0.07 }],
    anal: [{ u0: 0.1, u1: 0.46, alto: 0.07 }], cola: { tipo: "redondeada", largo: 0.3, alto: 0.2 },
    bigotes: { n: 1, largo: 0.1, menton: true }
  },
  lenguado: {
    h: 0.42, pos: 0.5, b: 0.7, ancho: 0.12, anchoCabeza: 0.15, plano: true,
    colores: { lomo: "#6b5a44", flanco: "#8f7a5e", vientre: "#8f7a5e", aletas: "#7a6850" },
    dorsal: [{ u0: 0.1, u1: 0.93, alto: 0.08 }], anal: [{ u0: 0.1, u1: 0.72, alto: 0.08 }],
    cola: { tipo: "redondeada", largo: 0.3, alto: 0.24 }, pectoral: 0.08, pelvica: 0.05,
    ojo: { u: 0.84, s: 0.3, r: 0.04, unLado: true },
    patrones: [{ tipo: "moteado", color: "#4a3c2c", escala: 12, umbral: 0.55 },
      { tipo: "puntos", color: "#e6dcc6", celda: 0.06, r: 0.14, sMin: -1 }]
  },
  tiburones: {
    h: 0.15, pos: 0.55, b: 0.5, ancho: 0.75, anchoCabeza: 0.8,
    colores: { lomo: "#6b6f6a", flanco: "#9a9e98", vientre: "#eceeea", aletas: "#6b6f6a" },
    dorsal: [{ u0: 0.48, u1: 0.62, alto: 0.24 }, { u0: 0.2, u1: 0.28, alto: 0.14 }],
    anal: [{ u0: 0.16, u1: 0.24, alto: 0.1 }], cola: { tipo: "heterocerca", largo: 0.6, alto: 0.34 },
    pectoral: 0.3, pelvica: 0.12, ojo: { u: 0.88, s: 0.3, r: 0.028 },
    patrones: [{ tipo: "puntos", color: "#4e524d", celda: 0.05, r: 0.16, sMin: 0.1 }]
  },
  gatuzo: {
    h: 0.13, pos: 0.55, b: 0.55, ancho: 0.75, anchoCabeza: 0.8,
    colores: { lomo: "#7a7f86", flanco: "#a4a9ae", vientre: "#eceeef", aletas: "#7a7f86" },
    dorsal: [{ u0: 0.48, u1: 0.6, alto: 0.16 }, { u0: 0.22, u1: 0.32, alto: 0.12 }],
    anal: [{ u0: 0.18, u1: 0.25, alto: 0.07 }], cola: { tipo: "heterocerca", largo: 0.5, alto: 0.24 },
    pectoral: 0.22, ojo: { u: 0.88, s: 0.3, r: 0.03 },
    patrones: [{ tipo: "puntos", color: "#e8ecef", celda: 0.05, r: 0.14, sMin: 0.2 }]
  },
  lisa: {
    h: 0.19, ancho: 0.75, b: 0.7, colores: { lomo: "#4a5a5e", flanco: "#aab4b4", vientre: "#eef0ee", aletas: "#8a9696" },
    dorsal: [{ u0: 0.55, u1: 0.62, alto: 0.1, espinosa: true }, { u0: 0.3, u1: 0.4, alto: 0.1 }],
    patrones: [{ tipo: "rayas", color: "#5a666a", filas: [0.22, 0.42, 0.62], ancho: 0.035 }]
  },
  salmonMar: {
    h: 0.24, ancho: 0.6, colores: { lomo: "#6a5040", flanco: "#b89a78", vientre: "#efe4d2", aletas: "#8a6a50" },
    dorsal: [{ u0: 0.2, u1: 0.7, alto: 0.1 }], anal: [{ u0: 0.14, u1: 0.46, alto: 0.08 }],
    cola: { tipo: "truncada", largo: 0.32, alto: 0.28 },
    patrones: [{ tipo: "barras", color: "#5a4030", frec: 7, ancho: 0.32, sMin: -0.4 },
      { tipo: "puntos", color: "#f2ead8", celda: 0.05, r: 0.1, sMin: 0 }]
  },
  mero: {
    h: 0.3, b: 0.7, ancho: 0.5, colores: { lomo: "#7a4a30", flanco: "#b0704a", vientre: "#e8c9a8", aletas: "#8a5a3a" },
    dorsal: [{ u0: 0.42, u1: 0.66, alto: 0.18, espinosa: true }, { u0: 0.24, u1: 0.41, alto: 0.14 }],
    cola: { tipo: "truncada", largo: 0.3, alto: 0.28 },
    patrones: [{ tipo: "moteado", color: "#5a3420", escala: 8, umbral: 0.6 }]
  },
  robalo: {
    h: 0.2, ancho: 0.6, colores: { lomo: "#4a5548", flanco: "#9aa08c", vientre: "#e8e8de", aletas: "#7a806c" },
    dorsal: [{ u0: 0.52, u1: 0.63, alto: 0.12, espinosa: true }, { u0: 0.24, u1: 0.5, alto: 0.1 }],
    cola: { tipo: "truncada", largo: 0.34, alto: 0.28 }
  },
  pezPalo: {
    h: 0.1, pos: 0.6, b: 0.5, ancho: 0.7, anchoCabeza: 1.25,
    colores: { lomo: "#8a7a60", flanco: "#c4b494", vientre: "#f1ece0", aletas: "#a08a68" },
    dorsal: [{ u0: 0.7, u1: 0.76, alto: 0.08, espinosa: true }, { u0: 0.14, u1: 0.62, alto: 0.06 }],
    anal: [{ u0: 0.12, u1: 0.55, alto: 0.05 }], cola: { tipo: "truncada", largo: 0.26, alto: 0.16 },
    ojo: { u: 0.9, s: 0.55, r: 0.03 },
    patrones: [{ tipo: "puntos", color: "#6a5a40", celda: 0.04, r: 0.2, sMin: -0.2 }]
  },
  tararira: {
    h: 0.2, b: 0.6, ancho: 0.7, anchoCabeza: 0.8, colores: { lomo: "#3f4a2c", flanco: "#7c7a4a", vientre: "#e2dcc0", aletas: "#5a5a38" },
    dorsal: [{ u0: 0.45, u1: 0.62, alto: 0.14 }], cola: { tipo: "redondeada", largo: 0.34, alto: 0.26 },
    ojo: { u: 0.86, s: 0.4, r: 0.04 },
    patrones: [{ tipo: "moteado", color: "#2a2a1a", escala: 10, umbral: 0.52 }]
  },
  bagre: {
    h: 0.18, pos: 0.65, ancho: 0.8, anchoCabeza: 1.2, abajo: 0.8,
    colores: { lomo: "#6b5a3a", flanco: "#b39a5a", vientre: "#efe6c8", aletas: "#8a7648" },
    dorsal: [{ u0: 0.55, u1: 0.64, alto: 0.2, espinosa: true }], adiposa: { u0: 0.15, u1: 0.32, alto: 0.05 },
    bigotes: { n: 6, largo: 0.5 },
    patrones: [{ tipo: "puntos", color: "#3a2e1c", celda: 0.05, r: 0.25, sMin: -0.1 }]
  },
  pati: {
    h: 0.17, pos: 0.65, ancho: 0.8, anchoCabeza: 1.2, abajo: 0.8,
    colores: { lomo: "#6f7478", flanco: "#aeb3b6", vientre: "#f0f1f1", aletas: "#7f8488" },
    dorsal: [{ u0: 0.55, u1: 0.64, alto: 0.2, espinosa: true }], adiposa: { u0: 0.15, u1: 0.32, alto: 0.05 },
    bigotes: { n: 6, largo: 0.4 }
  },
  armado: {
    h: 0.22, pos: 0.65, ancho: 0.85, anchoCabeza: 1.1,
    colores: { lomo: "#3b3b36", flanco: "#6a6a60", vientre: "#c9c4b0", aletas: "#4a4a44" },
    dorsal: [{ u0: 0.55, u1: 0.63, alto: 0.22, espinosa: true }], adiposa: { u0: 0.18, u1: 0.3, alto: 0.05 },
    bigotes: { n: 6, largo: 0.22 },
    patrones: [{ tipo: "filas", color: "#d8d2bd", filas: [0.0], paso: 0.035, r: 0.018 }]
  },
  carpa: {
    h: 0.3, ancho: 0.5, colores: { lomo: "#6b5a2a", flanco: "#b8913a", vientre: "#e9d9a8", aletas: "#9a7a3a" },
    dorsal: [{ u0: 0.3, u1: 0.62, alto: 0.12 }], bigotes: { n: 4, largo: 0.1 },
    patrones: [{ tipo: "escamas", color: "#5a4520", tam: 0.022 }]
  }
};
FORMAS.pejerreyPatagonico = { ...FORMAS.pejerrey, colores: { lomo: "#6c7b5a", flanco: "#dfe6da", vientre: "#f7f9f5", aletas: "#c4ccb8" } };
FORMAS.pejerreyMar = { ...FORMAS.pejerrey, colores: { lomo: "#5f7f9a", flanco: "#dde7ee", vientre: "#f7fafb", aletas: "#c2d0da" } };

function forma(id) {
  const f = FORMAS[id] || {};
  return { ...BASE, ...f, colores: { ...BASE.colores, ...(f.colores || {}) }, ojo: { ...BASE.ojo, ...(f.ojo || {}) } };
}

// ---------------- Geometría ----------------
function perfil(F) {
  // Media altura a lo largo del cuerpo (u: 0 = pedúnculo, 1 = hocico).
  return u => {
    if (u < F.pos) return F.ped + (F.h - F.ped) * Math.pow(Math.sin(Math.PI / 2 * u / F.pos), F.a);
    return F.h * Math.pow(Math.max(0, Math.cos(Math.PI / 2 * (u - F.pos) / (1 - F.pos))), F.b);
  };
}
const anchoRel = (F, u) => F.ancho + (F.anchoCabeza - F.ancho) * u * u;
const xDe = u => -1 + 2 * u;

function geometriaCuerpo(F, H) {
  const NU = 72, NV = 48, pos = [], uv = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, h = H(u), w = h * anchoRel(F, u);
    for (let j = 0; j <= NV; j++) {
      const t = (j / NV) * Math.PI * 2, s = Math.sin(t);
      pos.push(xDe(u), s * h * (s > 0 ? F.arriba : F.abajo), Math.cos(t) * w);
      uv.push(u, j / NV);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = i * (NV + 1) + j, b = a + NV + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function aletaCola(F, H) {
  const { tipo, largo: L, alto: A } = F.cola, p = H(0) * 0.9, s = new THREE.Shape();
  s.moveTo(0, p);
  if (tipo === "horquillada") { s.lineTo(-L, A); s.lineTo(-L * 0.55, 0); s.lineTo(-L, -A); }
  else if (tipo === "heterocerca") { s.lineTo(-L, A * 1.2); s.lineTo(-L * 0.75, A * 0.2); s.lineTo(-L * 0.45, -A * 0.55); s.lineTo(-L * 0.3, -A * 0.1); }
  else if (tipo === "redondeada") { s.bezierCurveTo(-L * 0.6, A * 1.1, -L * 1.25, A * 0.4, -L, 0); s.bezierCurveTo(-L * 1.25, -A * 0.4, -L * 0.6, -A * 1.1, 0, -p); }
  else { s.lineTo(-L, A); s.lineTo(-L * 0.93, 0); s.lineTo(-L, -A); } // truncada
  s.lineTo(0, -p);
  const g = new THREE.ShapeGeometry(s, 12);
  g.translate(-1 + 0.02, 0, 0);
  return g;
}

/** Aleta sobre el lomo (lado = 1) o el vientre (lado = -1) entre u0 y u1. */
function aletaLinea(F, H, { u0, u1, alto, espinosa }, lado) {
  const s = new THREE.Shape(), n = 10, borde = u => lado * H(u) * (lado > 0 ? F.arriba : F.abajo) * 0.94;
  s.moveTo(xDe(u0), borde(u0));
  if (espinosa) {
    const picos = Math.max(4, Math.round((u1 - u0) * 60));
    for (let k = 0; k <= picos; k++) {
      const u = u1 - (u1 - u0) * k / picos, f = 1 - 0.55 * k / picos;
      s.lineTo(xDe(u), borde(u) + lado * alto * f);
      if (k < picos) { const um = u - (u1 - u0) / picos / 2; s.lineTo(xDe(um), borde(um) + lado * alto * f * 0.6); }
    }
  } else {
    // Perfil triangular redondeado: pico cerca del frente.
    s.lineTo(xDe(u0 + (u1 - u0) * 0.15), borde(u0) + lado * alto * 0.35);
    s.quadraticCurveTo(xDe(u1), borde(u1) + lado * alto * 1.15, xDe(u1 - (u1 - u0) * 0.02), borde(u1) + lado * alto * 0.2);
  }
  for (let k = 0; k <= n; k++) { const u = u1 - (u1 - u0) * k / n; s.lineTo(xDe(u), borde(u)); }
  return new THREE.ShapeGeometry(s, 8);
}

function aletaPar(tam) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.quadraticCurveTo(-tam * 0.4, tam * 0.5, -tam, tam * 0.15); s.quadraticCurveTo(-tam * 0.6, -tam * 0.1, 0, -tam * 0.12);
  return new THREE.ShapeGeometry(s, 8);
}

// ---------------- Textura ----------------
function hash(x, y, sem) {
  const v = Math.sin(x * 127.1 + y * 311.7 + sem * 74.7) * 43758.5453;
  return v - Math.floor(v);
}
function ruido(x, y, sem) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const f = t => t * t * (3 - 2 * t);
  const a = hash(xi, yi, sem), b = hash(xi + 1, yi, sem), c = hash(xi, yi + 1, sem), d = hash(xi + 1, yi + 1, sem);
  return a + (b - a) * f(xf) + (c - a) * f(yf) + (a - b - c + d) * f(xf) * f(yf);
}
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mezcla = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function textura(F) {
  const W = 512, Hc = 256, cv = document.createElement("canvas");
  cv.width = W; cv.height = Hc;
  const ctx = cv.getContext("2d"), img = ctx.createImageData(W, Hc), d = img.data;
  const lomo = rgb(F.colores.lomo), flanco = rgb(F.colores.flanco), vientre = rgb(F.colores.vientre);
  // Coordenadas "físicas" sobre el cuerpo (largo 2, alto 2h) para que los
  // puntos y manchas salgan redondos y no estirados.
  for (let j = 0; j < Hc; j++) {
    const t = (j / Hc) * Math.PI * 2, s = Math.sin(t), c = Math.cos(t);
    for (let i = 0; i < W; i++) {
      const u = i / W;
      // Sombreado: vientre claro, flancos, lomo oscuro.
      let col = s < 0 ? mezcla(flanco, vientre, Math.min(1, -s * 1.6)) : mezcla(flanco, lomo, Math.min(1, Math.pow(s, 0.8) * 1.2));
      const ex = u * 2, ey = s * F.h;
      for (const p of F.patrones) {
        let m = 0;
        if (p.tipo === "banda") {
          const dd = Math.abs(s - p.s);
          if (dd < p.ancho) m = 1 - Math.pow(dd / p.ancho, 3);
          if (p.borde && dd >= p.ancho && dd < p.ancho * 1.35) { col = mezcla(col, rgb(p.borde), 0.6); continue; }
        } else if (p.tipo === "puntos" && s >= (p.sMin ?? -1)) {
          const gx = ex / (2 * p.celda), gy = (ey + (c < 0 ? 5 : 0)) / (2 * p.celda);
          const cx = Math.floor(gx), cy = Math.floor(gy), sem = p.semilla || 1;
          const ox = hash(cx, cy, sem), oy = hash(cy, cx, sem + 3);
          const dd = Math.hypot(gx - cx - 0.2 - ox * 0.6, gy - cy - 0.2 - oy * 0.6);
          if (dd < p.r * 2) m = hash(cx, cy, sem + 9) > 0.35 ? 1 : 0;
        } else if (p.tipo === "filas") {
          for (const fs of p.filas) {
            const dy = (s - fs) * F.h, dx = (((u + fs * 0.013) % p.paso) - p.paso / 2) * 2;
            if (Math.hypot(dx, dy) < p.r && u > 0.05 && u < 0.84) m = 1;
          }
        } else if (p.tipo === "barras" && s >= (p.sMin ?? -1)) {
          const v = (Math.sin(u * p.frec * Math.PI * 2 + ruido(u * 8, s * 3, 2) * 1.5) + 1) / 2;
          if (v > 1 - p.ancho) m = 0.85;
        } else if (p.tipo === "oblicuas" && s >= (p.sMin ?? -1)) {
          const v = ((u * p.frec + s * 4) % 1 + 1) % 1;
          if (v < p.ancho) m = 0.7;
        } else if (p.tipo === "rayas") {
          for (const fs of p.filas) if (Math.abs(s - fs) < p.ancho) m = 0.8;
        } else if (p.tipo === "manchas") {
          for (const [mu, ms] of p.lugares) if (Math.hypot((u - mu) * 2, (s - ms) * F.h) < p.r * 2) m = 1;
        } else if (p.tipo === "moteado") {
          const v = ruido(u * p.escala * 2, (s + (c < 0 ? 3 : 0)) * p.escala * 0.6, 5);
          if (v > p.umbral) m = Math.min(1, (v - p.umbral) * 4) * (s > -0.5 ? 1 : 0.3);
        } else if (p.tipo === "escamas") {
          const gx = ex / (2 * p.tam), gy = ey / p.tam + (Math.floor(gx) % 2) * 0.5;
          const dd = Math.hypot(gx - Math.floor(gx) - 0.5, gy - Math.floor(gy));
          if (Math.abs(dd - 0.5) < 0.07) m = 0.45;
        }
        if (m > 0) col = mezcla(col, rgb(p.color), m);
      }
      // Brillo leve para aspecto húmedo.
      col = col.map(v => Math.min(255, v * (0.94 + 0.08 * ruido(u * 60, s * 20, 11))));
      const k = (j * W + i) * 4;
      d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.flipY = false; // la fila j del canvas corresponde a v = j / alto (sin invertir)
  tx.anisotropy = 4;
  return tx;
}

// Ondulación de nado aplicada en el shader (más fuerte hacia la cola).
function ondular(mat, reloj) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTiempo = reloj;
    sh.vertexShader = "uniform float uTiempo;\n" + sh.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\nfloat colaF = pow(clamp((1.0 - transformed.x) / 2.4, 0.0, 1.0), 2.0);\n" +
      "transformed.z += sin(uTiempo * 3.2 - transformed.x * 2.6) * 0.16 * colaF;");
  };
  return mat;
}

// ---------------- Modelo ----------------
function crearPez(id, reloj) {
  const F = forma(id), H = perfil(F), grupo = new THREE.Group();
  const cuerpo = new THREE.Mesh(geometriaCuerpo(F, H),
    ondular(new THREE.MeshStandardMaterial({ map: textura(F), roughness: 0.42, metalness: 0.18 }), reloj));
  grupo.add(cuerpo);

  const matAleta = ondular(new THREE.MeshStandardMaterial({
    color: F.colores.aletas, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide, transparent: true, opacity: 0.85
  }), reloj);
  grupo.add(new THREE.Mesh(aletaCola(F, H), matAleta));
  F.dorsal.forEach(a => grupo.add(new THREE.Mesh(aletaLinea(F, H, a, 1), matAleta)));
  if (F.adiposa) grupo.add(new THREE.Mesh(aletaLinea(F, H, F.adiposa, 1), matAleta));
  F.anal.forEach(a => grupo.add(new THREE.Mesh(aletaLinea(F, H, a, -1), matAleta)));

  // Pectorales y pélvicas (pares).
  const up = 0.74, hp = H(up), wp = hp * anchoRel(F, up);
  [1, -1].forEach(lado => {
    const pec = new THREE.Mesh(aletaPar(F.pectoral), matAleta);
    pec.position.set(xDe(up), -hp * 0.35, lado * wp * 0.92);
    pec.rotation.set(lado * 0.5, lado * 0.55, -0.35);
    grupo.add(pec);
    const upl = 0.5, hpl = H(upl);
    const pel = new THREE.Mesh(aletaPar(F.pelvica), matAleta);
    pel.position.set(xDe(upl), -hpl * F.abajo * 0.85, lado * hpl * anchoRel(F, upl) * 0.4);
    pel.rotation.set(lado * 1.1, lado * 0.3, -0.5);
    grupo.add(pel);
  });

  // Ojos.
  const hO = H(F.ojo.u), wO = hO * anchoRel(F, F.ojo.u);
  const cz = Math.sqrt(Math.max(0, 1 - F.ojo.s * F.ojo.s));
  const matIris = new THREE.MeshStandardMaterial({ color: "#d9c27a", roughness: 0.3, metalness: 0.4 });
  const matPupila = new THREE.MeshStandardMaterial({ color: "#050505", roughness: 0.05, metalness: 0.2 });
  (F.ojo.unLado ? [1] : [1, -1]).forEach(lado => {
    const base = new THREE.Vector3(xDe(F.ojo.u), F.ojo.s * hO * F.arriba, lado * cz * wO);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(F.ojo.r, 20, 14), matIris);
    iris.position.copy(base); grupo.add(iris);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(F.ojo.r * 0.62, 16, 12), matPupila);
    pup.position.copy(base).add(new THREE.Vector3(0.004, 0, lado * F.ojo.r * 0.5)); grupo.add(pup);
    if (F.ojo.unLado) { // lenguado: segundo ojo del mismo lado
      const b2 = base.clone().add(new THREE.Vector3(-0.1, F.ojo.r * 2.2, 0));
      const i2 = iris.clone(); i2.position.copy(b2); grupo.add(i2);
      const p2 = pup.clone(); p2.position.copy(b2).add(new THREE.Vector3(0.004, 0, F.ojo.r * 0.5)); grupo.add(p2);
    }
  });

  // Barbillas.
  if (F.bigotes) {
    const matB = new THREE.MeshStandardMaterial({ color: F.colores.lomo, roughness: 0.7 });
    const { n, largo, menton } = F.bigotes;
    for (let k = 0; k < n; k++) {
      const lado = k % 2 ? -1 : 1, fila = Math.floor(k / 2);
      const u0 = menton ? 0.93 - fila * 0.015 : 0.97 - fila * 0.03, h0 = H(u0);
      const inicio = new THREE.Vector3(xDe(u0), menton ? -h0 * 0.8 : (fila === 0 ? 0 : -h0 * 0.6), lado * h0 * anchoRel(F, u0) * (menton ? 0.4 : 0.8));
      const dir = new THREE.Vector3(menton ? 0.1 : -0.3 - fila * 0.2, -0.5 - fila * 0.2, lado * (0.8 - fila * 0.2)).normalize();
      const curva = new THREE.CatmullRomCurve3([inicio,
        inicio.clone().addScaledVector(dir, largo * 0.5).add(new THREE.Vector3(0, -largo * 0.1, 0)),
        inicio.clone().addScaledVector(dir, largo).add(new THREE.Vector3(-largo * 0.3, -largo * 0.25, 0))]);
      grupo.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 12, 0.007, 5, false), matB));
    }
  }
  if (F.plano) grupo.rotation.x = -Math.PI / 2 + 0.35;
  return grupo;
}

// ---------------- Visor ----------------
let visor = null;

export function abrirVisor(contenedor, id) {
  cerrarVisor();
  const reloj = { value: 0 };
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue("--fondo-3d").trim() || "#0e2a33");
  const camara = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
  camara.position.set(0, 0.15, 3.1);
  const render = new THREE.WebGLRenderer({ antialias: true });
  render.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  render.outputColorSpace = THREE.SRGBColorSpace;
  contenedor.innerHTML = "";
  contenedor.appendChild(render.domElement);

  escena.add(new THREE.HemisphereLight("#dfefff", "#3a3020", 1.4));
  const sol = new THREE.DirectionalLight("#ffffff", 2.2); sol.position.set(2, 3, 4); escena.add(sol);
  const contra = new THREE.DirectionalLight("#9fd3ff", 1.0); contra.position.set(-3, 1, -3); escena.add(contra);

  const pez = crearPez(id, reloj);
  const pivote = new THREE.Group(); pivote.add(pez); escena.add(pivote);
  pivote.rotation.y = -0.5;

  // Controles: arrastrar para girar, rueda o pellizco para acercar.
  let rotY = -0.5, rotX = 0.25, dist = 3.1, auto = true;
  const punteros = new Map(); let distPellizco = 0;
  const cv = render.domElement;
  cv.style.touchAction = "none";
  cv.addEventListener("pointerdown", e => { punteros.set(e.pointerId, e); cv.setPointerCapture(e.pointerId); auto = false; });
  cv.addEventListener("pointermove", e => {
    if (!punteros.has(e.pointerId)) return;
    const prev = punteros.get(e.pointerId); punteros.set(e.pointerId, e);
    if (punteros.size === 1) {
      rotY += (e.clientX - prev.clientX) * 0.01;
      rotX = Math.max(-1.2, Math.min(1.2, rotX + (e.clientY - prev.clientY) * 0.01));
    } else if (punteros.size === 2) {
      const [a, b] = [...punteros.values()], dd = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (distPellizco) dist = Math.max(2, Math.min(8, dist * distPellizco / dd));
      distPellizco = dd;
    }
  });
  const soltar = e => { punteros.delete(e.pointerId); if (punteros.size < 2) distPellizco = 0; };
  cv.addEventListener("pointerup", soltar); cv.addEventListener("pointercancel", soltar);
  cv.addEventListener("wheel", e => { e.preventDefault(); dist = Math.max(2, Math.min(8, dist * (1 + e.deltaY * 0.001))); }, { passive: false });

  const ajustar = () => {
    const w = contenedor.clientWidth, h = contenedor.clientHeight || w * 0.6;
    render.setSize(w, h, false); cv.style.width = "100%"; cv.style.height = "100%";
    camara.aspect = w / h; camara.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(ajustar); ro.observe(contenedor); ajustar();

  let activo = true, t0 = performance.now();
  const cuadro = ahora => {
    if (!activo) return;
    reloj.value = (ahora - t0) / 1000;
    if (auto) rotY += 0.004;
    pivote.rotation.set(rotX, rotY, 0);
    camara.position.set(0, 0.15, dist); camara.lookAt(0, 0, 0);
    render.render(escena, camara);
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);

  visor = {
    cerrar() {
      activo = false; ro.disconnect();
      escena.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      render.dispose(); cv.remove();
    }
  };
}

export function cerrarVisor() {
  if (visor) { visor.cerrar(); visor = null; }
}

export const especiesConModelo = Object.keys(FORMAS);
