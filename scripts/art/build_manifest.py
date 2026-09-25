"""Builds game/art/manifest.json: every AI-generated image the game uses.

Each entry: id, out (path under game/public/art), aspect, prompt, kind.
kind: portrait | scene | event | key | map | texture | prop | ui
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]

STYLE = ("Gritty post-apocalyptic graphic-novel illustration. Bold confident ink linework with rough "
         "painterly brush textures, subtle halftone grain. Desaturated palette of rust, ochre, ash grey, "
         "bruised violet shadows and bone white, with sparing hot ember-orange accents. Dramatic "
         "chiaroscuro lighting, dust and drifting embers in the air. Mad Max meets a 1980s tabletop "
         "RPG rulebook. Absolutely no text, no letters, no numbers, no logos, no watermark, no border, no frame.")

PORTRAIT = ("Bust portrait, head and shoulders, three-quarter view facing the viewer, character centered and "
            "filling the frame, dark smoky background with a faint warm rust glow behind the head. "
            "Square composition.")

SCENE = "Wide cinematic establishing shot, 16:9 composition, strong silhouette, sense of scale, no people in the foreground."

entries = []
def add(kind, id, out, aspect, subject, extra=""):
    if kind == "portrait":
        p = f"{PORTRAIT} Subject: {subject} {extra} {STYLE}"
    elif kind in ("scene", "event", "key"):
        p = f"{SCENE if kind=='scene' else 'Cinematic illustration, 16:9 composition.'} Subject: {subject} {extra} {STYLE}"
    else:
        p = f"{subject} {extra}"
    entries.append({"id": id, "kind": kind, "out": out, "aspect": aspect, "prompt": " ".join(p.split())})

# ---------------------------------------------------------------- warlords
WARLORDS = {
 "tallyman": "The Tallyman, gaunt pale slaver-emperor in his sixties, hollow cheeks, shaved head, long black oilcloth coat hung with brass tally-chains and counting beads, a crown made of rusted iron shackles, cold calculating grey eyes, ink-stained fingers holding a ledger.",
 "tally_heir": "Iola Vane, the Tallyman's daughter and heir, sharp severe woman in her thirties, slicked black hair, high collar of chain mail, a brass monocle, faint cruel smile, bone-white face paint lines counting down her cheek.",
 "jackabone": "Jackabone, hulking scarred biker warlord of the Bone Wolves, wearing a helmet made from a giant wolf skull, spiked leather and chain, tattooed neck, grinning with filed teeth, motorcycle headlight glow behind him.",
 "wolves_heir": "Snarl, young feral biker woman, shaved head with a single red braid, facial scars, goggles on forehead, wolf-fang necklace, snarling.",
 "harrow": "Mama Harrow, weathered old woman warlord of a fuel refinery, soot-black face, welding goggles pushed up on grey braids, oil-stained leather apron over armor, gas flare fire reflected in her eyes, pipe in her mouth.",
 "gas_heir": "Pike Harrow, Mama Harrow's grandson, lean young man in a fireproof coat, burn scars on one side of his face, wrench on his shoulder, ambitious eyes.",
 "kingfisher": "Kingfisher, tall charismatic pirate king of the salt coast, weathered dark skin, crown made from rusted ship rivets and seashells, long salt-crusted coat, harpoon over his shoulder, gold teeth.",
 "salt_heir": "Brine Maud, broad-shouldered sea-raider woman, sun-bleached hair in knots, tattooed arms with anchor chains, rusted boarding hook, squinting against the salt wind.",
 "lamplighter": "The Lamplighter, masked prophet of a psychic cult, face hidden behind a mask of fused glowing crater-glass shards, violet light leaking from the eye holes, hooded tattered robes covered in wires and tiny lamps.",
 "glass_heir": "Choir, androgynous young cultist with glass shards embedded in their shaved scalp like a crown, pale skin, faintly glowing violet veins, serene unsettling expression.",
 "ruddick": "Colonel Ruddick, grizzled militarist warlord in his fifties, square jaw, grey stubble, patched olive military greatcoat covered in scavenged medals, gas mask hanging on his chest, iron-wreath insignia, stern disciplined glare.",
 "wreath_heir": "Major Sallow, lean severe officer woman in her forties, close-cropped hair, olive fatigues with barbed-wire armband, binoculars round her neck, a thin scar across her lip.",
 "granny_oat": "Granny Oat, tough old farmer matriarch of a farming commune, deeply wrinkled sun-browned face, wide straw sunhat with a bullet hole, double-barrel shotgun on her shoulder, kind but steely eyes, windmill in the dusk behind her.",
 "free_heir": "Wheaton, big gentle farmer man in his thirties, beard, patched overalls over improvised plate armor, pitchfork, anxious determined expression.",
 "solace": "Director Solace, bunker technocrat leader, clean white hazmat suit with blue trim, transparent visor pushed back, perfectly neat silver hair, faint cold smile, glowing cyan data-tablet light on the face.",
 "concord_heir": "Adjunct Six, young bunker-born technician with pallid skin who has never seen the sun, cyan-lensed goggles, cables braided into their hair, sterile white jumpsuit.",
}
for k, v in WARLORDS.items():
    add("portrait", f"warlord_{k}", f"portraits/warlord_{k}.webp", "1:1", v)

# ---------------------------------------------------------------- playbooks (player)
PLAYBOOKS = {
 "gunlugger": ("a massive heavily-armed gunlugger, bandolier of shells, a heavy machine gun over the shoulder, scrap-plate armor", ),
 "battlebabe": ("a dangerous, effortlessly cool battlebabe duelist, twin revolvers or a long knife, long dark coat, calm deadly half-smile", ),
 "brainer": ("an eerie brainer psychic with a strange pale stare, skull-fitted scavenged electronics, a faint violet aura, unnervingly still", ),
 "angel": ("a wasteland angel field-medic, stained medical apron over leather armor, red-cross armband made of tape, stethoscope, tired compassionate eyes", ),
 "driver": ("a wasteland driver, road-goggles, cracked leather driving jacket, grease smears, car keys on a chain, restless grin", ),
 "savvyhead": ("a savvyhead tinkerer, magnifying lenses on a head-rig, tool belt, burned fingers, a strange half-built device crackling in hand", ),
 "hocus": ("a hocus cult prophet, ragged robes with ash-painted sigils, burning eyes, a staff hung with bones and bells, followers' candles behind", ),
 "skinner": ("a skinner, beautiful wasteland performer, painted face, jewelry made from salvaged circuitry, a battered guitar, magnetic smoldering gaze", ),
}
for k, (d,) in PLAYBOOKS.items():
    add("portrait", f"pc_{k}_m", f"portraits/pc_{k}_m.webp", "1:1", f"A man, {d}.")
    add("portrait", f"pc_{k}_f", f"portraits/pc_{k}_f.webp", "1:1", f"A woman, {d}.")

# ---------------------------------------------------------------- companions
COMPANIONS = {
 "mako": "Mako Grist, gunlugger, bald black man built like a door, scrap-plate pauldron, belt-fed gun, calm heavy eyes",
 "hessa": "Big Hessa, gunlugger woman, huge and scarred, blonde buzzcut, riot armor and a sawn-off auto-shotgun, laughing",
 "rook": "Rook Tallow, old gunlugger veteran, grey beard, one eye patched, rusted helmet, bolt-action rifle",
 "vesper": "Vesper Lark, battlebabe, lithe woman with a sharp black bob, long red scarf, two revolvers, bored lethal look",
 "sable": "Sable Knox, battlebabe, elegant man with a pencil moustache and duster coat, a machete behind his back",
 "jinx": "Jinx Maribel, battlebabe, young freckled woman with wild copper curls and knives strapped everywhere, mischievous grin",
 "tem": "Hollow Tem, brainer, pale bald young man with ash-grey lips and dark-ringed empty eyes, wires stapled to his temples",
 "pim": "Oracle Pim, brainer, tiny old woman with milky blind eyes and a knitted shawl, uncanny knowing smile",
 "quill": "Mister Quill, brainer, thin man in a moth-eaten suit and bowler hat, violet-tinted spectacles, needle-like fingers",
 "rennet": "Doc Rennet, angel, middle-aged woman with a surgical mask around her neck, bloodied apron, round glasses, exhausted",
 "stitch": "Stitch Amadou, angel, broad kind-faced man with suture scars on his own arms, medical satchel, dreadlocks",
 "liss": "Saint Liss, angel, young serene woman with shaved head and white face paint, bone rosary, bandages",
 "juna": "Hotwire Juna, driver, grinning young woman in aviator goggles and flight jacket, grease on cheek, spark plug earrings",
 "okafor": "Gears Okafor, driver, big-bearded man in a mechanic's jumpsuit, welding scars, steering wheel medallion",
 "kettle": "Dash Kettle, driver, wiry androgynous youth with a shaved undercut, racing leathers, nervous energy",
 "vole": "Tinker Vole, savvyhead, hunched rat-faced little man with a jeweler's loupe, a crackling tesla glove",
 "nan": "Solder Nan, savvyhead, grandmotherly woman with circuit-board jewelry and a soldering iron tucked behind one ear",
 "wensley": "Arc Wensley, savvyhead, young man with burned eyebrows, static-frizzed hair, a backpack battery sparking",
 "cinder": "Mother Cinder, hocus, tall gaunt woman with soot-blackened hands and ember-glowing eyes, crown of burnt twigs",
 "lantern": "Brother Lantern, hocus, portly bearded preacher carrying a lit oil lantern, rags painted with eyes",
 "moss": "Prophet Moss, hocus, wild old hermit with lichen-green beard, bones braided into his hair, feverish stare",
 "rue": "Velvet Rue, skinner, glamorous woman with a shaved side and silver-painted lips, feather boa made of scrap wire",
 "lyre": "Lyre Castellan, skinner, beautiful long-haired man with kohl eyes, a cracked violin, scarves",
 "honey": "Honey Dusk, skinner, sultry older woman with a scarred smile, cigarette holder, sequined jacket patched with leather",
}
for k, v in COMPANIONS.items():
    add("portrait", f"npc_{k}", f"portraits/npc_{k}.webp", "1:1", v + ".")

# ---------------------------------------------------------------- lieutenants (generic officers)
OFFICERS = [
 "a one-armed gang lieutenant with a hook and a mohawk",
 "a stern woman enforcer with a gas mask pushed up and a rifle",
 "a sly old quartermaster with gold teeth and a ledger",
 "a young scarred war-boy with white face paint and a spear",
 "a broad bald brute with a welded iron jaw plate",
 "a hooded scout woman with a crossbow and dust scarf",
 "a tattooed biker lieutenant with a chain and aviators",
 "a grizzled militia sergeant with a bushy moustache",
 "a cold-eyed assassin woman with a razor-wire garrote",
 "a fat cunning fixer in a patched pinstripe suit",
 "a nervous young officer with too-big armor and a pistol",
 "a sun-scarred desert raider with a keffiyeh and goggles",
]
for i, v in enumerate(OFFICERS):
    add("portrait", f"officer_{i+1:02d}", f"portraits/officer_{i+1:02d}.webp", "1:1", v + ".")

# ---------------------------------------------------------------- enemies
ENEMIES = {
 "raider": "a road raider in spiked scrap armor and a skull-painted face, machete raised",
 "raider_f": "a female road raider with a mohawk, tire-rubber armor, sawed-off shotgun",
 "raider_boss": "a raider warchief with a car-grille chestplate and a massive sledgehammer, feathers and bones",
 "slaver": "a Tally slaver overseer in a black coat with brass chains, whip coiled, cruel ledger-keeper face",
 "slaver_gunner": "a Tally slaver soldier in a bone-white mask stamped with tally marks, long rifle, chain bandolier",
 "biker": "a Bone Wolves biker with a wolf pelt cloak, goggles and a revving chain, blood on his teeth",
 "cultist": "a Glassed cultist in rags, face covered by a mask of crater glass, violet light leaking out",
 "horror": "a maelstrom-warped human horror, twisted limbs, skin cracked with glowing violet fissures, too many teeth, screaming",
 "hound": "a mutant rust hound, hairless scabbed wasteland dog with too many eyes and exposed ribs, snarling",
 "boar": "a huge mutant bristleback boar with rusted rebar grown into its hide, tusks, glowing eyes",
 "pirate": "a Salt Kings pirate with salt-crusted leathers, rusty cutlass and a harpoon gun",
 "trooper": "an Iron Wreath militia trooper in olive fatigues, gas mask and helmet, bolt rifle with bayonet",
 "drone": "a Concord security drone robot, battered white armored shell, single cyan camera eye, weapon arms",
 "gasguard": "a Gasworks guard in a fireproof suit with a flamethrower and welding mask",
 "militia": "a Free Holds farmer militia man with a pitchfork, straw hat and scavenged hockey pads as armor",
 "scav": "a starving wasteland scavenger in layered rags with a crowbar and a desperate stare",
 "hollowed": "a hollowed one, maelstrom-emptied person with blank white eyes, grey skin, mouth sewn shut, shambling",
 "burnlad": "a young burnlad gang soldier, teenage, war paint of soot and ash, scrap spear and a molotov, fanatical grin",
}
for k, v in ENEMIES.items():
    add("portrait", f"enemy_{k}", f"portraits/enemy_{k}.webp", "1:1", v + ".")

# ---------------------------------------------------------------- holding scenes
SCENES = {
 "dam": "a colossal cracked concrete dam turned into a slaver fortress, black banners with white tally marks, cages hanging from cranes, searchlights, river below",
 "junkyard": "a biker gang stronghold built from a mountain of wrecked cars and motorcycles, bonfires, wolf skulls on poles, dust at sunset",
 "refinery": "a working oil refinery fortress, gas flare towers burning, pipes and storage tanks, walkways, smog-orange sky at dusk",
 "tanker": "a gigantic rusted oil tanker beached on a salt shore turned into a pirate castle, shanty towers on deck, lanterns, grey sea",
 "crater": "a vast glass-floored crater with a cathedral built of fused glass and scrap spires in the center, violet glowing cracks, pilgrims' torches",
 "bunker": "a fortified military hill fort, concrete bunkers, razor wire, sandbags, watchtowers with an iron wreath emblem, drab olive tents",
 "farm": "a fortified farming commune, windmills and water towers, fenced green fields in a brown wasteland, palisade wall, golden hour",
 "vault": "the entrance to a pre-collapse bunker vault in a mountainside, huge round steel door, clean floodlights, radio antennas and satellite dishes",
 "city": "a ruined metropolis of broken skyscrapers half-swallowed by sand, a sprawling night market in the shadow of a collapsed overpass, strings of lights",
 "crossroads": "a dusty crossroads trading post, a rusted gas station turned saloon, painted signs with no words, a hanging tree, caravans parked",
 "canyon": "a watch outpost built into red canyon walls, rope bridges, cliff dwellings, a signal fire on top",
 "marsh": "a salt-marsh shanty town on stilts over brackish water, rusted boats, fishing nets, fog",
}
for k, v in SCENES.items():
    add("scene", f"scene_{k}", f"scenes/scene_{k}.webp", "16:9", v)

INTERIORS = {
 "saloon": "the smoky interior of a wasteland saloon built inside an old bus depot, bar made of car doors, hanging bulbs, rough patrons in shadow",
 "market": "a crowded wasteland bazaar stall piled with scavenged guns, canned food, tools and tires under patched tarps",
 "clinic": "a makeshift wasteland infirmary, blood-stained operating table, jars and scavenged medical gear, a single bright lamp",
 "hall": "a warlord's throne hall inside a gutted factory, a throne welded from car parts on a platform, banners, braziers, armed guards in silhouette",
 "wall": "a wall covered in pinned notes, wanted posters, photos and bounty tokens next to a flickering lamp, no readable writing",
 "camp": "a small campfire in the ruins of a gas station at night, bedrolls, a battered car, stars and a violet psychic aurora in the sky",
}
for k, v in INTERIORS.items():
    add("scene", f"interior_{k}", f"scenes/interior_{k}.webp", "16:9", v)

# ---------------------------------------------------------------- travel events
EVENTS = {
 "ambush": "raiders leaping out of an overturned bus onto a desert road, ambush, dust and gunfire",
 "hounds": "a pack of mutant rust hounds emerging from the dusk haze on a ridge",
 "maelstrom": "a psychic maelstrom storm over the wasteland: a vast violet-black swirling vortex in the sky, lightning, whispering shapes in the clouds",
 "convoy": "an abandoned convoy of burnt trucks on a highway, doors open, cargo scattered, crows",
 "caravan": "a trader caravan of armored trucks and pack animals resting at an oasis, lanterns",
 "slavers": "a column of chained captives driven by masked slavers along a dusty road, black banners",
 "crash": "a crashed pre-collapse aircraft half-buried in dunes, fuselage broken open",
 "subway": "a flooded collapsed subway station, dark water, flickering emergency light, something moving",
 "tower": "a lone rusted radio tower on a hill with a blinking red light, cables, a shack at its foot",
 "prophet": "a wandering prophet in rags preaching to nobody from atop a burnt car",
 "duststorm": "a colossal dust storm wall rolling across the plains toward the viewer",
 "oasis": "a hidden spring under a rock overhang, green plants, clear water, animal skulls",
 "burned": "a burned village, smoke rising, charred houses, a lone survivor sitting in the ashes",
 "bridge": "a toll gang holding a rusted bridge over a dry riverbed, barricades and a spiked gate",
 "children": "feral scavenger children with slingshots watching from the girders of a ruined building",
 "bunkerdoor": "a sealed rusted bunker hatch in the sand with a faintly glowing keypad, a strange signal",
 "aftermath": "a battlefield aftermath at dawn, wrecked war-rigs, smoke, crows, abandoned banners",
 "wanderer": "a lone wanderer sitting on a milestone by the road, rifle across the knees, waiting",
 "glassfield": "a field of green glowing glass shards shimmering under a sick sky, bones",
 "hangingtree": "a crossroads dead tree with a warning of hanged mannequins and bells, crows, dusk",
 "ruins": "the inside of a collapsed shopping mall, sand dunes across the floor, light shafts, dangling signs with no letters",
 "warband": "a warband of burnlads on war-rigs roaring past in a cloud of dust, flags and flames",
}
for k, v in EVENTS.items():
    add("event", f"event_{k}", f"events/event_{k}.webp", "16:9", v)

# ---------------------------------------------------------------- key art
KEY = {
 "title": "a lone wanderer in a long coat standing on a ridge overlooking a vast burning wasteland basin where warlord armies clash; columns of smoke, a ruined city on the horizon, and a colossal violet psychic storm swirling in the sky above. Leave calm empty sky in the upper third for a title.",
 "creation": "a figure silhouetted in the doorway of a ruined church at dawn, choosing weapons laid out on a table, dust in the light shafts",
 "victory": "the slaver dam fortress burning at dawn, broken chains in the foreground, freed captives walking toward the light",
 "defeat": "black slaver banners with white tally marks raised over a conquered basin, lines of chained people, grey sky",
 "death": "a lonely grave marked by rebar, a cracked helmet and goggles, on a windswept hill, embers drifting",
 "war": "two warlord armies of war-rigs and burnlads charging at each other across a desert plain, dust and fire, dramatic",
}
for k, v in KEY.items():
    add("key", f"key_{k}", f"key/key_{k}.webp", "16:9", v)

# ---------------------------------------------------------------- world map
add("map", "worldmap", "map/worldmap.webp", "16:10",
    "Using the attached layout sketch as an exact guide for geography, paint a finished top-down illustrated fantasy-style "
    "campaign map of a post-apocalyptic wasteland basin. Keep every region, the coastline, the river and each settlement dot "
    "in exactly the same position as in the sketch. Blue in the sketch = a dead grey-green sea to the east with rusted wrecks; "
    "brown triangles = jagged western mountains; the purple circle = a huge glowing glass crater; the grey blob = a ruined city of "
    "broken skyscrapers; green = patchy farmland in the south; red-brown = cracked badlands in the south-east; the thin blue line = a "
    "dry-ish river; black dots = settlements, each drawn as a tiny illustrated landmark (walls, towers, tanks, windmills). "
    "Ochre dust plains between. Hand-painted, aged vellum and ink with rust stains and burn marks at the edges, subtle. "
    "Top-down view. Absolutely no text, no labels, no letters, no compass words, no legend, no border frame.")

# ---------------------------------------------------------------- textures
TEX = {
 "ground_dust": "cracked dry desert earth with small pebbles",
 "ground_ash": "burnt ashen ground with charcoal, cinders and grey ash",
 "ground_salt": "white salt flat crust with cracks and brackish stains",
 "ground_rubble": "broken concrete and asphalt rubble with weeds in the cracks",
 "ground_glass": "fused green-violet glass sand, faintly glowing cracks",
 "ground_mud": "wet dark marsh mud with puddles and dead reeds",
}
for k, v in TEX.items():
    add("texture", f"tex_{k}", f"textures/{k}.webp", "1:1",
        f"Seamless tileable top-down texture, flat even lighting, orthographic view straight down, of {v}. "
        "Painterly game art texture, desaturated, no objects casting long shadows, no text.")
add("texture", "tex_paper", "textures/paper.webp", "1:1",
    "Seamless tileable texture of old stained yellowed paper with coffee rings, creases and faint rust spots, flat lighting, no text.")
add("texture", "tex_metal", "textures/metal.webp", "1:1",
    "Seamless tileable texture of dark rusted scratched sheet metal with rivets, flat lighting, no text.")

# ---------------------------------------------------------------- props (chroma key)
PROPS = {
 "car": "a rusted burnt-out car wreck", "barrels": "a cluster of three rusty oil barrels",
 "barrier": "a cracked concrete jersey barrier", "scrap": "a pile of scrap metal and tires",
 "tree": "a dead leafless tree with twisted branches", "bus": "a burnt-out school bus wreck",
 "sandbags": "a curved wall of sandbags", "tires": "a stack of old tires",
 "crates": "a pile of wooden crates and ammo boxes", "rocks": "a cluster of jagged boulders",
 "wall": "a broken section of brick wall", "glass": "a cluster of glowing violet crystal glass spikes",
}
for k, v in PROPS.items():
    add("prop", f"prop_{k}", f"props/{k}.png", "1:1",
        f"Game sprite, top-down view seen from directly above (orthographic, slightly angled), of {v}, painterly post-apocalyptic "
        "game art, centered, the object fills about 80% of the frame, on a perfectly flat solid pure magenta (#FF00FF) background, "
        "no shadow on the background, no text.")

out = ROOT / "game/art/manifest.json"
out.write_text(json.dumps({"style": STYLE, "entries": entries}, indent=1))
print(len(entries), "entries ->", out)
