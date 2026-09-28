"""Candidatos adicionales desde Wikimedia Commons (con licencia CC)."""
import json, os, sys, time, urllib.request, urllib.parse, re
BASE = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "PescaArgentinaApp/1.0 (eliasirace@gmail.com)"}
BUSQ = {
 "surubi": ["Pseudoplatystoma corruscans", "Pseudoplatystoma", "surubí"],
 "armado": ["Pterodoras granulosus", "Oxydoras kneri", "armado pez"],
 "mero": ["Acanthistius patachonicus", "Acanthistius brasilianus"],
 "carpa": ["Cyprinus carpio fish", "common carp"],
 "bagre": ["Pimelodus maculatus", "Pimelodus"],
}
def get(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r: return r.read()
        except Exception as e: time.sleep(12 * (i + 1)); err = e
    raise err
meta = {}
for esp in sys.argv[1:] or list(BUSQ):
    fotos = {}
    for q in BUSQ[esp]:
        params = {"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": 1400,
                  "generator": "search", "gsrsearch": q, "gsrnamespace": 6, "gsrlimit": 30}
        j = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))
        for p in j.get("query", {}).get("pages", {}).values():
            ii = p["imageinfo"][0]; em = ii.get("extmetadata", {})
            lic = em.get("LicenseShortName", {}).get("value", "")
            if not re.search(r"CC|Public domain|CC0", lic, re.I) or "ND" in lic.upper(): continue
            if ii["width"] < 500 or not ii["url"].split("?")[0].lower().endswith((".jpg", ".jpeg", ".png")): continue
            autor = re.sub("<[^>]+>", "", em.get("Artist", {}).get("value", "")).strip()[:60]
            fotos[p["pageid"]] = {"id": "wm%d" % p["pageid"], "url": ii.get("thumburl") or ii["url"], "lic": lic, "autor": autor or "Wikimedia Commons",
                                  "pagina": ii["descriptionurl"], "titulo": p["title"], "w": ii["width"], "h": ii["height"]}
        time.sleep(4)
    lista = list(fotos.values())[:30]
    d = os.path.join(BASE, "cand", esp); os.makedirs(d, exist_ok=True)
    for f in lista:
        dest = os.path.join(d, f["id"] + ".jpg")
        if not os.path.exists(dest):
            try: open(dest, "wb").write(get(f["url"])); time.sleep(0.7)
            except Exception as e: print("fallo", f["url"], e); continue
        f["archivo"] = dest
    meta[esp] = lista
    print(esp, len(lista))
json.dump(meta, open(os.path.join(BASE, "cand_meta_commons.json"), "w"), indent=1, ensure_ascii=False)
