/*
 * Modelos 3D a partir de fotos reales (modelos/<especie>.webp, con el fondo
 * recortado y la cabeza hacia la derecha).
 *
 * La silueta (canal alfa) se "infla": el grosor en cada punto sale de la
 * distancia al borde y del radio del mayor disco inscripto que lo cubre, así el
 * cuerpo queda grueso y las aletas finas. La foto se proyecta como piel en
 * los dos lados (espejada en el lado no fotografiado).
 */
import * as THREE from "../vendor/three/three.min.js";

const RUTA = new URL("../modelos/", import.meta.url);
let catalogo = null;

/** Catálogo modelos/modelos.json: parámetros y crédito de cada foto. */
export function catalogoFotos() {
  if (!catalogo) {
    catalogo = fetch(new URL("modelos.json", RUTA)).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  }
  return catalogo;
}

function cargarImagen(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("No se pudo cargar " + url));
    im.src = url;
  });
}

// ---------------- Silueta ----------------
/** Transformada de distancia euclídea exacta (Felzenszwalb y Huttenlocher). */
export function distanciaAlBorde(dentro, W, H) {
  const INF = 1e12, N = Math.max(W, H);
  const f = new Float64Array(N), out = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1);
  const d = new Float64Array(W * H);
  const edt1d = n => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; out[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  };
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = dentro[y * W + x] ? INF : 0;
    edt1d(H);
    for (let y = 0; y < H; y++) d[y * W + x] = out[y];
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = d[y * W + x];
    edt1d(W);
    for (let x = 0; x < W; x++) d[y * W + x] = Math.sqrt(out[x]);
  }
  return d;
}

/** Radio del mayor disco inscripto en la silueta que cubre cada punto. */
export function radioLocal(d, W, H) {
  const R = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = d[i];
    if (r <= 0) continue;
    const x0 = i % W, y0 = (i / W) | 0, ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) {
      const y = y0 + dy;
      if (y < 0 || y >= H) continue;
      const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      const xa = Math.max(0, x0 - dx), xb = Math.min(W - 1, x0 + dx), base = y * W;
      for (let x = xa; x <= xb; x++) if (R[base + x] < r) R[base + x] = r;
    }
  }
  return R;
}

/**
 * Lee la silueta de la imagen en una grilla de `ancho` columnas (más un borde
 * de 1 celda vacío). Devuelve alfa y máscara "dentro".
 */
function silueta(img, ancho) {
  const W = ancho + 2, H = Math.round(ancho * img.height / img.width) + 2;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 1, 1, W - 2, H - 2);
  const px = ctx.getImageData(0, 0, W, H).data, dentro = new Uint8Array(W * H), alfa = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { alfa[i] = px[i * 4 + 3] / 255; dentro[i] = alfa[i] >= 0.5 ? 1 : 0; }
  return { W, H, dentro, alfa };
}

// ---------------- Malla ----------------
/**
 * Construye la geometría inflada. P: { ancho, anchoCabeza, aletas } donde
 * ancho = grosor máximo del cuerpo relativo a su media altura; anchoCabeza lo
 * mismo en la cabeza; aletas = grosor mínimo relativo de las partes finas.
 */
export function geometriaInflada({ W, H, dentro, alfa }, P) {
  const d = distanciaAlBorde(dentro, W, H), R = radioLocal(d, W, H);
  let Rmax = 0;
  for (let i = 0; i < R.length; i++) if (R[i] > Rmax) Rmax = R[i];
  const esc = 2 / (W - 2); // 1 celda en unidades del modelo (largo total = 2)
  const alto = (H - 2) * esc;
  const activo = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (dentro[y * W + x]) { activo[y * W + x] = 1; continue; }
    // Nodos de borde: los exteriores con un vecino interior (se llevan luego a la silueta).
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < W && yy >= 0 && yy < H && dentro[yy * W + xx]) { activo[y * W + x] = 1; break; }
    }
  }
  const suave = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const pos = [], uv = [], idx = [], indice = new Int32Array(W * H * 2).fill(-1);
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!activo[i]) continue;
    let gx = x, gy = y;
    if (!dentro[i]) {
      // Nodo del faldón: se lleva al punto donde el alfa cruza 0,5 hacia los
      // vecinos interiores, así el borde de la malla coincide con la silueta.
      let sx = 0, sy = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (y + dy) * W + x + dx;
        if (x + dx < 0 || x + dx >= W || y + dy < 0 || y + dy >= H || !dentro[j]) continue;
        const t = (0.5 - alfa[i]) / Math.max(1e-3, alfa[j] - alfa[i]);
        sx += x + dx * t; sy += y + dy * t; n++;
      }
      if (n) { gx = sx / n; gy = sy / n; }
    }
    const u = (gx - 0.5) / (W - 2), v = (gy - 0.5) / (H - 2);
    const X = u * 2 - 1, Y = (0.5 - v) * alto;
    const k = P.ancho + (P.anchoCabeza - P.ancho) * suave((u - 0.55) / 0.3);
    const fino = P.aletas + (1 - P.aletas) * suave(R[i] / (0.55 * Rmax));
    const Z = k * fino * Math.sqrt(Math.max(0, d[i] * (2 * R[i] - d[i]))) * esc;
    for (const lado of [1, -1]) {
      indice[i * 2 + (lado > 0 ? 0 : 1)] = n++;
      pos.push(X, Y, lado * Z);
      uv.push(u, v);
    }
  }
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const a = y * W + x, b = a + 1, c = a + W, e = c + 1;
    for (const lado of [0, 1]) {
      const A = indice[a * 2 + lado], B = indice[b * 2 + lado], C = indice[c * 2 + lado], E = indice[e * 2 + lado];
      const tri = (p, q, r) => (lado === 0 ? idx.push(p, r, q) : idx.push(p, q, r));
      const act = [A, B, E, C].filter(k => k >= 0);
      if (act.length === 4) { tri(A, B, E); tri(A, E, C); }
      else if (act.length === 3) tri(act[0], act[1], act[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Ondulación de nado (misma que en los modelos ilustrativos).
function ondular(mat, reloj) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTiempo = reloj;
    sh.vertexShader = "uniform float uTiempo;\n" + sh.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\nfloat colaF = pow(clamp((1.0 - transformed.x) / 2.4, 0.0, 1.0), 2.0);\n" +
      "transformed.z += sin(uTiempo * 3.2 - transformed.x * 2.6) * 0.16 * colaF;");
  };
  return mat;
}

const PARAMS_BASE = { ancho: 0.5, anchoCabeza: 0.55, aletas: 0.3, resolucion: 240 };

/**
 * Crea el modelo fotográfico de la especie o devuelve null si no hay foto.
 * Resultado: { grupo, credito } con el crédito de la foto para mostrarlo.
 */
export async function crearPezFoto(id, reloj) {
  const cat = await catalogoFotos();
  const m = cat[id];
  if (!m) return null;
  const img = await cargarImagen(new URL(m.archivo, RUTA).href);
  const P = { ...PARAMS_BASE, ...m };
  const geo = geometriaInflada(silueta(img, P.resolucion), P);
  // Textura: la foto copiada a un canvas (el paquete de three.js incluido
  // solo trae CanvasTexture).
  const lienzo = document.createElement("canvas");
  lienzo.width = img.width; lienzo.height = img.height;
  lienzo.getContext("2d").drawImage(img, 0, 0);
  const tx = new THREE.CanvasTexture(lienzo);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.flipY = false;
  tx.anisotropy = 8;
  const mat = ondular(new THREE.MeshStandardMaterial({
    map: tx, roughness: 0.55, metalness: 0.08, side: THREE.DoubleSide
  }), reloj);
  const grupo = new THREE.Group();
  grupo.add(new THREE.Mesh(geo, mat));
  if (m.plano) grupo.rotation.x = -Math.PI / 2 + 0.35;
  return { grupo, credito: m.credito || null };
}
