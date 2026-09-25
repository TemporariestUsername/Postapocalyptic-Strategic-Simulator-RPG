"""Draws the layout sketch the world-map painting is generated from.
Node coordinates here are canonical: the game reads game/art/map_layout.json."""
import json, math, pathlib, random
from PIL import Image, ImageDraw, ImageFilter
ROOT = pathlib.Path(__file__).resolve().parents[2]
W, H = 1600, 1000
NODES = {
 "ledger": (1080, 170), "chainhold": (950, 300), "weepwater": (1220, 310), "tollgate": (1090, 430),
 "cathedral": (720, 170), "shimmer": (590, 290), "stillhollow": (820, 330),
 "vault": (290, 150), "antenna": (440, 250),
 "rampart": (170, 420), "barbwire": (320, 360), "muster": (230, 610),
 "gasworks": (430, 510), "sumpton": (570, 430), "flarestack": (410, 690),
 "cinder": (780, 530), "crosswind": (640, 650),
 "oatmeadow": (560, 860), "greenwell": (730, 790), "tanglefield": (370, 870),
 "howlpit": (1060, 840), "skullfork": (900, 710), "redmile": (1170, 650),
 "brinecastle": (1400, 560), "rustharbor": (1330, 790), "gullrock": (1285, 200),
}
EDGES = [
 ("ledger","chainhold"),("ledger","weepwater"),("chainhold","tollgate"),("weepwater","tollgate"),("weepwater","gullrock"),
 ("chainhold","stillhollow"),("cathedral","stillhollow"),("cathedral","shimmer"),("cathedral","ledger"),("shimmer","antenna"),
 ("shimmer","sumpton"),("stillhollow","cinder"),("vault","antenna"),("vault","barbwire"),("antenna","barbwire"),
 ("barbwire","rampart"),("rampart","muster"),("barbwire","gasworks"),("muster","gasworks"),("muster","flarestack"),
 ("gasworks","sumpton"),("gasworks","flarestack"),("sumpton","cinder"),("tollgate","cinder"),("cinder","crosswind"),
 ("crosswind","flarestack"),("crosswind","greenwell"),("crosswind","skullfork"),("flarestack","tanglefield"),
 ("tanglefield","oatmeadow"),("oatmeadow","greenwell"),("greenwell","skullfork"),("skullfork","howlpit"),
 ("howlpit","redmile"),("redmile","tollgate"),("redmile","rustharbor"),("howlpit","rustharbor"),
 ("rustharbor","brinecastle"),("brinecastle","gullrock"),("cinder","redmile"),("sumpton","crosswind"),("tollgate","brinecastle"),
]
RIVER = [(1060,120),(1075,200),(1060,300),(1040,400),(980,470),(870,520),(820,560),(900,600),(1030,610),(1150,560),(1260,590),(1340,640)]
random.seed(7)
img = Image.new("RGB", (W, H), (205, 175, 120))
d = ImageDraw.Draw(img)
# sea east, jagged coast
coast = []
for y in range(0, H+40, 40):
    x = 1300 + 40*math.sin(y/90) + random.randint(-20, 20)
    if 480 < y < 640: x += 60  # bay around brinecastle shallow
    coast.append((x, y))
d.polygon(coast + [(W, H), (W, 0)], fill=(70, 110, 150))
# badlands SE
d.ellipse((860, 640, 1300, 1000), fill=(165, 95, 70))
# farmland S
d.ellipse((300, 740, 820, 1000), fill=(120, 150, 80))
# mountains W
for i in range(70):
    x = random.randint(0, 330); y = random.randint(0, 1000)
    if abs(x - 170) < 40 and abs(y - 420) < 40: continue
    s = random.randint(20, 40)
    d.polygon([(x, y - s), (x - s, y + s), (x + s, y + s)], fill=(110, 80, 55))
# northern hills
for i in range(25):
    x = random.randint(850, 1300); y = random.randint(20, 150); s = random.randint(15, 30)
    d.polygon([(x, y - s), (x - s, y + s), (x + s, y + s)], fill=(125, 95, 65))
# crater
d.ellipse((600, 60, 840, 260), fill=(130, 90, 170)); d.ellipse((650, 100, 790, 230), fill=(160, 120, 200))
# ruined city
d.ellipse((660, 440, 910, 620), fill=(120, 120, 125))
# river
d.line(RIVER, fill=(60, 110, 170), width=10, joint="curve")
# roads faint
for a, b in EDGES:
    d.line([NODES[a], NODES[b]], fill=(150, 120, 80), width=3)
for k, (x, y) in NODES.items():
    d.ellipse((x - 11, y - 11, x + 11, y + 11), fill=(20, 15, 10))
img = img.filter(ImageFilter.GaussianBlur(1))
img.save(ROOT / "game/art/map_layout.png")
json.dump({"size": [W, H], "nodes": NODES, "edges": EDGES, "river": RIVER},
          open(ROOT / "game/art/map_layout.json", "w"), indent=1)
print("ok")
