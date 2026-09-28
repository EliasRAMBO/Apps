# Pesca Argentina

Aplicación web (instalable en el celular como PWA) que muestra en un mapa qué peces
pueden encontrarse en cada zona de Argentina, con qué carnadas, señuelos y métodos se
pescan, y un **índice de actividad (0–100)** que combina temporada, clima, luna y
temperatura del agua.

## Funciones

- **Mapa** con zoom, capas (IGN Argentina con toponimia oficial, OpenStreetMap, satélite
  Esri, relieve y, opcionalmente, Google Maps), búsqueda de lugares y **ubicación actual**.
- **79 zonas de pesca** (Litoral, Delta, Río de la Plata, lagunas pampeanas, embalses,
  costa atlántica, Patagonia y Tierra del Fuego) con **30 especies o grupos de especies**.
- **Cualquier otro lugar**: si el punto no está en una zona registrada, se consulta
  OpenStreetMap para saber si es un lago, embalse, río o bañado, y se muestra una
  **estimación regional** (Pampa, Litoral, Centro, NOA, Cuyo, Patagonia, Tierra del
  Fuego o mar) claramente señalada como tal.
- **Foto real de cada especie** con licencia libre (iNaturalist o Wikimedia Commons),
  con el fondo recortado y el crédito del autor; debajo se muestra además una foto de
  Wikipedia con enlace al artículo.
- Por especie: mejores meses, horario y lugar, carnadas, señuelos, métodos, equipo
  sugerido y notas de normativa.
- **Clima** (Open-Meteo): condiciones actuales y pronóstico de 7 días con tendencia de
  presión, viento, lluvia, olas y temperatura del mar.
- **Luna**: fase, iluminación, salida/puesta y **períodos solunares** mayores y menores.
- **Mareas estimadas** en la costa (modelo global).
- **Reportes propios**: se guardan en el dispositivo, aparecen en el mapa, alimentan las
  "carnadas que funcionaron" de la zona y se pueden exportar/importar en JSON para
  compartir.
- Enlaces por especie y zona a búsquedas de **partes de pesca, foros, videos y
  reglamento provincial**.

## Uso

Debe servirse por HTTP (no abrir el archivo directamente). Desde esta carpeta:

```bash
python3 -m http.server 8080
# abrir http://localhost:8080
```

La ubicación actual y la instalación como app requieren **HTTPS** (o `localhost`).
Para usarla en el celular conviene publicarla, por ejemplo con GitHub Pages.

### Google Maps (opcional)

Completar `GOOGLE_MAPS_API_KEY` en `js/config.js` con una clave de Google Cloud que
tenga habilitada *Maps JavaScript API* (requiere cuenta con facturación). Sin clave, la
app funciona con OpenStreetMap y satélite de Esri; el botón "Abrir en Google Maps"
funciona siempre.

## Pruebas

```bash
npm test
```

## Fotos de las especies

Las fotos de `fotos/` se obtuvieron con los scripts de `herramientas/`:

1. `bajar.py` baja candidatas de iNaturalist (observaciones con grado de investigación
   y licencia CC); `bajar_commons.py` hace lo mismo en Wikimedia Commons.
2. `recortar.py` quita el fondo con [rembg](https://github.com/danielgatis/rembg) y arma
   una hoja de contactos para elegir la mejor foto de costado.
3. `seleccion.json` guarda la foto elegida por especie y si hay que voltearla (la cabeza
   va a la derecha).
4. `exportar.py` nivela, recorta y guarda cada foto como `.webp` con transparencia y
   escribe `fotos.json` con el crédito (autor, licencia y enlace).

Requiere `pip install "rembg[cpu]" pillow numpy opencv-python-headless scipy`.

El armado usa una lámina científica de Johann Natterer (dominio público) por falta de
fotos laterales libres. Licencias: la mayoría de las fotos son CC0, CC BY o CC BY-SA;
algunas son CC BY-NC (uso no comercial). Los créditos están en `fotos/fotos.json` y se
muestran junto a la foto.

## Limitaciones

- **Foros**: la app no descarga ni analiza contenido de foros automáticamente (los
  navegadores lo bloquean por CORS y muchos sitios lo prohíben en sus condiciones). En
  su lugar ofrece búsquedas directas y el sistema de reportes propios.
- **Normativa**: vedas, cupos, tallas y licencias cambian por provincia y año. Los datos
  son orientativos; verifique siempre la normativa oficial.
- **Índice de actividad**: es una heurística. La temporada y el clima pesan más que la
  luna, cuyo efecto tiene evidencia científica limitada.
- **Temperatura del agua dulce**: se estima con la temperatura del aire de la última
  semana.
- **Mareas**: estimación de un modelo global; en bahías y estuarios puede diferir más de
  una hora. Para horarios precisos: tablas del Servicio de Hidrografía Naval.

## Estructura

```
index.html            Interfaz
css/styles.css        Estilos (claro/oscuro, escritorio y móvil)
js/data.js            Especies y zonas
js/pesca.js           Luna, solunar, distancias e índice de actividad
js/clima.js           Open-Meteo (pronóstico y datos marinos)
js/app.js             Mapa, panel, reportes
js/config.js          Clave opcional de Google Maps
sw.js                 Service worker (uso sin conexión de la interfaz)
fotos/                Fotos recortadas (.webp) y fotos.json con los créditos
herramientas/         Scripts (Python) para bajar, recortar y exportar las fotos
vendor/               Leaflet 1.9.4, SunCalc 1.9.0, GoogleMutant 0.14.1
```
