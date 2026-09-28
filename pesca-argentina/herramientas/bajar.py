import json, os, sys, time, urllib.request, urllib.parse
BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "cand")
ESPECIES = {
 "dorado": ["Salminus brasiliensis"], "surubi": ["Pseudoplatystoma corruscans", "Pseudoplatystoma reticulatum"],
 "pacu": ["Piaractus mesopotamicus"], "boga": ["Megaleporinus obtusidens"], "pejerrey": ["Odontesthes bonariensis"],
 "tararira": ["Hoplias malabaricus", "Hoplias argentinensis"], "bagre": ["Pimelodus maculatus"], "armado": ["Pterodoras granulosus"],
 "pati": ["Luciopimelodus pati"], "palometa": ["Pygocentrus nattereri", "Serrasalmus maculatus"], "carpa": ["Cyprinus carpio"],
 "trucha": ["Oncorhynchus mykiss"], "truchaMarron": ["Salmo trutta"], "perca": ["Percichthys trucha"],
 "pejerreyPatagonico": ["Odontesthes hatcheri"], "salmonEncerrado": ["Salmo salar", "Oncorhynchus tshawytscha"],
 "corvinaRubia": ["Micropogonias furnieri"], "corvinaNegra": ["Pogonias courbina", "Pogonias cromis"],
 "pescadilla": ["Cynoscion guatucupa"], "anchoa": ["Pomatomus saltatrix"], "brotola": ["Urophycis brasiliensis"],
 "lenguado": ["Paralichthys orbignyanus", "Paralichthys patagonicus"], "pejerreyMar": ["Odontesthes argentinensis"],
 "tiburones": ["Carcharias taurus"], "gatuzo": ["Mustelus schmitti"], "lisa": ["Mugil liza"],
 "salmonMar": ["Pseudopercis semifasciata"], "mero": ["Acanthistius patachonicus"],
 "robalo": ["Eleginops maclovinus"], "pezPalo": ["Percophis brasiliensis"]
}
UA = {"User-Agent": "PescaArgentinaApp/1.0 (eliasirace@gmail.com)"}
def get(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return r.read()
        except Exception as e:
            time.sleep(2 * (i + 1)); err = e
    raise err
def taxon_id(nombre):
    j = json.loads(get("https://api.inaturalist.org/v1/taxa?" + urllib.parse.urlencode({"q": nombre, "rank": "species", "per_page": 5})))
    for t in j["results"]:
        if t["name"].lower() == nombre.lower(): return t["id"]
    return None
meta = {}
LIM = 60 if os.environ.get("MAS") else 14
solo = sys.argv[1:] or list(ESPECIES)
for esp in solo:
    fotos = []
    for nombre in ESPECIES[esp]:
        tid = taxon_id(nombre)
        if not tid: print("sin taxón", nombre); continue
        for lic in ["cc0,cc-by,cc-by-sa", "cc-by-nc,cc-by-nc-sa"]:
            paginas = range(2, 6) if os.environ.get("MAS") else [1]
            res = []
            for pg in paginas:
                q = {"taxon_id": tid, "quality_grade": "research", "photo_license": lic, "per_page": 40, "order_by": "votes", "photos": "true", "page": pg}
                res += json.loads(get("https://api.inaturalist.org/v1/observations?" + urllib.parse.urlencode(q)))["results"]
                time.sleep(0.4)
            for o in res:
                for p in o.get("photos", [])[:2]:
                    if not p.get("license_code"): continue
                    fotos.append({"id": p["id"], "url": p["url"].replace("square", "large"), "lic": p["license_code"],
                                  "autor": (o["user"].get("name") or o["user"]["login"]), "obs": o["id"], "taxon": nombre, "w": p.get("original_dimensions", {}).get("width", 0), "h": p.get("original_dimensions", {}).get("height", 0)})
            if len(fotos) >= LIM: break
            time.sleep(0.5)
        if len(fotos) >= LIM: break
    # preferir fotos apaisadas (pez de costado)
    fotos.sort(key=lambda f: (0 if f["lic"] in ("cc0", "cc-by", "cc-by-sa") else 1, -(f["w"] / max(1, f["h"]))))
    fotos = fotos[:LIM]
    d = os.path.join(OUT, esp); os.makedirs(d, exist_ok=True)
    for f in fotos:
        dest = os.path.join(d, f"{f['id']}.jpg")
        if not os.path.exists(dest):
            try: open(dest, "wb").write(get(f["url"]))
            except Exception as e: print("fallo", f["url"], e); continue
        f["archivo"] = dest
    meta[esp] = fotos
    print(esp, len(fotos), "fotos", [f["lic"] for f in fotos].count("cc-by-nc"), "nc")
    json.dump(meta, open(os.path.join(BASE, "cand_meta_%s%s.json" % ("mas_" if os.environ.get("MAS") else "", "_".join(solo) if len(solo) < 5 else "todo")), "w"), indent=1, ensure_ascii=False)
