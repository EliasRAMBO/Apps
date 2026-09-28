"""Exporta las fotos elegidas (seleccion.json) a pesca-argentina/fotos/*.webp + fotos.json."""
import json, os, sys, glob, math, numpy as np, cv2
from PIL import Image
BASE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(BASE, "..", "fotos")
os.makedirs(DEST, exist_ok=True)
sel = json.load(open(os.path.join(BASE, "seleccion.json")))
meta = {}
for f in glob.glob(os.path.join(BASE, "cand_meta_*.json")):
    for esp, fotos in json.load(open(f)).items():
        for ft in fotos: meta[(esp, str(ft["id"]))] = ft
LIC = {"cc0": "CC0", "cc-by": "CC BY", "cc-by-sa": "CC BY-SA", "cc-by-nc": "CC BY-NC", "cc-by-nc-sa": "CC BY-NC-SA", "cc-by-nd": "CC BY-ND", "cc-by-nc-nd": "CC BY-NC-ND"}
salida = {}
solo = sys.argv[1:] or list(sel)
if os.path.exists(os.path.join(DEST, "fotos.json")): salida = json.load(open(os.path.join(DEST, "fotos.json")))
for esp in solo:
    s = sel[esp]
    im = Image.open(os.path.join(BASE, "cand", esp, f"{s['foto']}.png")).convert("RGBA")
    arr = np.array(im)
    a = arr[:, :, 3]
    # Nivelar: eje principal de la silueta horizontal.
    m = cv2.moments((a > 127).astype(np.uint8), binaryImage=True)
    ang = 0.5 * math.degrees(math.atan2(2 * m["mu11"], m["mu20"] - m["mu02"]))
    if "angulo" in s: ang = s["angulo"]
    if abs(ang) > 35: ang = 0
    if abs(ang) > 0.3: im = im.rotate(ang, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
    if s.get("voltear"): im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if s.get("invertir"): im = im.transpose(Image.FLIP_TOP_BOTTOM)
    arr = np.array(im); a = arr[:, :, 3]
    a[a < 12] = 0
    # Conservar solo la componente mayor.
    n, lab, st, _ = cv2.connectedComponentsWithStats((a > 127).astype(np.uint8))
    if n > 2:
        k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); a[(lab != k) & (a > 127)] = 0
    arr[:, :, 3] = a
    ys, xs = np.where(a > 0)
    x0, x1, y0, y1 = max(0, xs.min() - 2), min(a.shape[1], xs.max() + 3), max(0, ys.min() - 2), min(a.shape[0], ys.max() + 3)
    im = Image.fromarray(arr).crop((x0, y0, x1, y1))
    if im.width > 1024: im = im.resize((1024, round(im.height * 1024 / im.width)), Image.LANCZOS)
    # Rellenar lo transparente con el color opaco más cercano para que el
    # filtrado de la textura no oscurezca los bordes.
    from scipy import ndimage
    arr = np.array(im); a = arr[:, :, 3]
    _, (iy, ix) = ndimage.distance_transform_edt(a < 200, return_indices=True)
    rgb = arr[:, :, :3][iy, ix]
    arr[:, :, :3] = np.where((a < 200)[:, :, None], rgb, arr[:, :, :3])
    im = Image.fromarray(arr)
    im.save(os.path.join(DEST, f"{esp}.webp"), "WEBP", quality=88, method=6, exact=True)
    ft = meta[(esp, str(s["foto"]))]
    if "pagina" in ft:  # Wikimedia Commons
        cred = {"autor": __import__("html").unescape(ft["autor"]), "licencia": ft["lic"], "url": ft["pagina"], "fuente": "Wikimedia Commons", "foto": ft["id"]}
    else:
        cred = {"autor": ft["autor"], "licencia": LIC.get(ft["lic"], ft["lic"]), "url": f"https://www.inaturalist.org/observations/{ft['obs']}", "fuente": "iNaturalist", "foto": ft["id"], "taxon": ft["taxon"]}
    if "tipo" in s: cred["tipo"] = s["tipo"]
    ent = {"archivo": f"{esp}.webp", "credito": cred}
    for k in ("ancho", "anchoCabeza", "aletas", "plano", "resolucion"):
        if k in s: ent[k] = s[k]
    salida[esp] = ent
    print(esp, im.size, round(ang, 1), ft["lic"], ft["autor"])
json.dump(salida, open(os.path.join(DEST, "fotos.json"), "w"), indent=1, ensure_ascii=False)
