"""Recorta el pez de cada foto candidata (rembg), evalúa la máscara y arma una hoja de contactos."""
import json, os, sys, numpy as np
from PIL import Image, ImageDraw
from rembg import remove, new_session
BASE = os.path.dirname(os.path.abspath(__file__))
sess = new_session("isnet-general-use")
def puntaje(mask):
    """Heurística: pez de costado = componente grande, alargada, sin tocar mucho el borde."""
    import cv2
    m = (mask > 127).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n < 2: return 0, None
    k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    x, y, w, h, a = st[k]
    H, W = m.shape
    frac = a / (W * H); rel = w / max(1, h)
    borde = (x <= 2) + (y <= 2) + (x + w >= W - 2) + (y + h >= H - 2)
    lleno = a / (w * h)
    s = 1.0
    if not (0.12 < frac < 0.85): s *= 0.4
    if rel < 1.6: s *= 0.3
    elif rel > 5: s *= 0.6
    s *= max(0.2, 1 - 0.3 * borde)
    if lleno < 0.35: s *= 0.5
    return s, (x, y, w, h, lab == k)
esp_list = sys.argv[1:]
for esp in esp_list:
    d = os.path.join(BASE, "cand", esp); res = []
    for f in sorted(os.listdir(d)):
        if not f.endswith(".jpg"): continue
        p = os.path.join(d, f)
        try:
            im = Image.open(p).convert("RGB")
        except Exception: continue
        if im.width > 1400: im = im.resize((1400, int(im.height * 1400 / im.width)), Image.LANCZOS)
        out = remove(im, session=sess, alpha_matting=False)
        a = np.array(out)[:, :, 3]
        s, info = puntaje(a)
        if info is None: continue
        x, y, w, h, comp = info
        arr = np.array(out); arr[:, :, 3] = np.where(comp, arr[:, :, 3], 0)
        rec = Image.fromarray(arr).crop((x, y, x + w, y + h))
        rec.save(p.replace(".jpg", ".png"))
        res.append((s, f, w / max(1, h)))
    res.sort(reverse=True)
    json.dump(res, open(os.path.join(d, "puntajes.json"), "w"))
    # hoja de contactos: 4 columnas
    cel, cols = 320, 4
    hoja = Image.new("RGB", (cel * cols, (cel // 2 + 30) * ((len(res) + cols - 1) // cols)), (40, 60, 70))
    dr = ImageDraw.Draw(hoja)
    for i, (s, f, rel) in enumerate(res):
        rec = Image.open(os.path.join(d, f.replace(".jpg", ".png")))
        rec.thumbnail((cel - 10, cel // 2 - 10))
        cx, cy = (i % cols) * cel, (i // cols) * (cel // 2 + 30)
        hoja.paste(rec, (cx + 5, cy + 5), rec)
        dr.text((cx + 5, cy + cel // 2 + 5), f"{i} {f[:-4]} s={s:.2f}", fill=(255, 255, 255))
    hoja.save(os.path.join(BASE, f"hoja_{esp}.jpg"), quality=80)
    print(esp, [(f, round(s, 2)) for s, f, _ in res[:5]])
