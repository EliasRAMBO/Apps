/* Service worker: guarda la interfaz para abrirla sin conexión.
   Clima, mapas y búsquedas siempre se piden a la red. */
const CACHE = "pesca-ar-v1";
const ARCHIVOS = [
  "./", "index.html", "css/styles.css", "manifest.webmanifest",
  "js/config.js", "js/data.js", "js/pesca.js", "js/clima.js", "js/app.js",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/suncalc.js",
  "vendor/leaflet/images/marker-icon.png", "vendor/leaflet/images/marker-icon-2x.png",
  "vendor/leaflet/images/marker-shadow.png", "vendor/leaflet/images/layers.png",
  "icons/icon.svg", "icons/icon-192.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Red primero para tener siempre la última versión; caché si no hay conexión.
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
