"""Art bible for BURNLANDS. Every generated image is declared here.

Run `python tools/generate_art.py` to (re)generate missing images into tools/raw/,
then `python tools/process_art.py` to produce the optimized game assets.
"""
from __future__ import annotations

STYLE = (
    "Gritty painterly digital oil painting with visible brush texture, post-apocalyptic, "
    "muted rust, ash-grey and bone palette with ember-orange highlights, dramatic cinematic lighting, "
    "grounded realism, highly detailed. Absolutely no text, no letters, no numbers, no logos, "
    "no watermark, no signature, no brand names."
)

PORTRAIT = (
    "Head-and-shoulders character portrait for a post-apocalyptic RPG, subject centered and facing the viewer "
    "at a slight three-quarter angle, face fully visible in the upper-middle of the frame, dark smoky blurred "
    "background with faint embers. "
)

SCENE = "Wide cinematic establishing shot, 16:9 composition. "

TOPDOWN = (
    "Top-down orthographic view looking straight down at the ground, an aerial photograph-like painting of terrain. "
    "Even diffuse overcast lighting, no characters, no creatures, no vehicles, no tall objects casting long shadows, "
    "mostly open ground. Absolutely no grid lines, no squares, no overlay, no frame, no border. "
)

PROP = (
    "viewed from directly above (top-down orthographic view), a single isolated game sprite asset centered with generous "
    "margin, on a flat solid pure magenta #FF00FF background, no ground, no shadow on the background, no other objects. "
    "Painterly gritty post-apocalyptic style. No text."
)

ICON = (
    "Game inventory icon: a single {} centered on a plain flat very dark charcoal background, painterly gritty "
    "post-apocalyptic style, dramatic rim light, crisp readable silhouette, fills most of the frame, no text, no border."
)

ABILITY = (
    "Square game ability icon, bold symbolic painted emblem of {}, rendered like an engraved rusted metal badge with "
    "glowing ember-orange accents, centered on a dark background, strong readable silhouette, no text, no letters."
)

# (id, prompt, aspect, size) ; size None = default 1K, "2K" for full-screen art
ASSETS: dict[str, list[tuple[str, str, str, str | None]]] = {}


def add(cat: str, id_: str, prompt: str, aspect: str = "1:1", size: str | None = None) -> None:
    ASSETS.setdefault(cat, []).append((id_, prompt, aspect, size))


# ---------------------------------------------------------------- key art
add("key", "title", SCENE + "Epic title key art: a lone wanderer in a tattered duster coat stands on a rise, seen from behind, "
    "looking across a burning wasteland toward a colossal ruined nuclear power plant whose cooling towers belch fire and smoke; "
    "an army of torch-bearing raiders and spiked war-rigs marches across the plain below; a violet psychic storm swirls in the "
    "clouds above the towers. The top third of the image is darker sky with space for a title. " + STYLE, "16:9", "2K")
add("key", "logo", "Game title logo that reads exactly 'BURNLANDS' in huge distressed, rusted, riveted steel block capital "
    "letters with glowing ember cracks and scorch marks, centered, on a pure black background. Nothing else, no other words.", "21:9")
add("key", "map", "A top-down painted overworld map of a post-apocalyptic wasteland basin for a strategy game, seen straight "
    "from above like a satellite image painted in oil. " + STYLE, "16:9", "2K")  # replaced by curated test map

# ---------------------------------------------------------------- intro / endings
add("story", "intro1", SCENE + "The world burning: a vast city skyline at dusk engulfed by firestorms and mushroom-shaped smoke, "
    "highways jammed with abandoned cars, ash falling like snow, silhouettes of people fleeing. " + STYLE, "16:9", "2K")
add("story", "intro2", SCENE + "Fifty years later: a wasteland of dunes and rusted ruins under a bruised violet sky where a faint "
    "psychic storm of swirling light and ghostly faces churns in the clouds, a small caravan of scavengers crossing below. " + STYLE, "16:9", "2K")
add("story", "intro3", SCENE + "Seven wasteland warlords' war banners planted on a ridge, rival war-bands of bikers, cultists, "
    "soldiers and raiders glaring at each other across a scorched valley, smoke rising. " + STYLE, "16:9", "2K")
add("story", "intro4", SCENE + "The Burnt King on a throne of fused turbine blades inside a colossal ruined reactor hall, half his "
    "face burned, ember eyes glowing, his black-armored soldiers kneeling, furnaces roaring behind him. " + STYLE, "16:9", "2K")
add("story", "intro5", SCENE + "A lone drifter with a bandana and a rifle walking toward a small fortified farming settlement "
    "at sunrise, scrap walls, a windmill, green crops, smoke from cooking fires, long shadows. " + STYLE, "16:9", "2K")
add("story", "victory", SCENE + "Triumph: the colossal power plant citadel falling silent, its fires dying, dawn breaking golden "
    "through clearing smoke, a crowd of ragged survivors raising scrap banners on the rubble. " + STYLE, "16:9", "2K")
add("story", "defeat", SCENE + "Doom: the entire wasteland engulfed in a violet-and-orange firestorm spreading from a giant "
    "cooling tower, endless ranks of black-armored soldiers marching, a burnt king silhouetted on a tower. " + STYLE, "16:9", "2K")
add("story", "death", SCENE + "A lonely grave in the wasteland: a rifle stuck barrel-down in a sand mound with a hat and goggles "
    "hanging on it, a tattered scarf blowing in the wind, dust and a dim red sunset. " + STYLE, "16:9", "2K")
add("story", "warlord_end", SCENE + "A new warlord's coronation: a scarred wanderer standing on the walls of a wasteland fortress "
    "before a cheering crowd with raised torches and scrap banners, fireworks of flares in the night sky. " + STYLE, "16:9", "2K")

# ---------------------------------------------------------------- playbook portraits (4 each)
PLAYBOOKS = {
    "gunhand": [
        "a massive bald man with a braided beard and tattooed scalp, tire-rubber shoulder armor, belts of shotgun shells across his chest",
        "a broad-shouldered woman with a shaved undercut and burn scars on her neck, heavy machine-gun sling across her chest, welding goggles pushed up",
        "a grizzled older Black man with grey stubble, scavenged riot-police armor plates, ammunition belts, a cigar stub",
        "a young East Asian woman with a hard stare, military surplus jacket, bandolier, black face-paint stripes under her eyes",
    ],
    "sawbones": [
        "a gaunt middle-aged woman medic with a bloodstained leather apron, surgical loupe goggles, stitched scar on her cheek",
        "a young man with round cracked spectacles, medical satchel strap, red cross painted on a scavenged armband, tired eyes",
        "an elderly South Asian man with a white beard, a tool roll of scalpels on his chest, calm wise expression",
        "a tough Latina woman with a hand-tattooed red cross on her neck, headscarf, a syringe tucked behind her ear",
    ],
    "duelist": [
        "a lithe woman with a sharp asymmetric haircut, twin knife handles over her shoulders, long leather duster, confident smirk",
        "a lean androgynous fighter with silver-dyed hair, a scarf mask pulled down to the chin, a machete handle over the shoulder",
        "a handsome Black man with a scarred eyebrow, long weathered coat, a revolver and a sabre hilt visible",
        "a wiry Indigenous woman with long braided hair and bone beads, a hatchet on her shoulder, focused predatory gaze",
    ],
    "mindbender": [
        "a pale hairless man with unsettling pale eyes, crude electrodes and wires attached to his skull, high-collared coat",
        "a thin woman with dark circles under her eyes, a rusted metal cage-like headpiece around her skull, a trickle of blood from her nose",
        "a gaunt young man with glassy unfocused eyes and a stitched patchwork hood, lips moving as if whispering",
        "an older woman with faintly glowing violet veins on her temples, one clouded eye, a shawl woven from old cables",
    ],
    "prophet": [
        "a charismatic bearded preacher with an ash-smeared face and sackcloth robes, holding a smoking rusty censer",
        "a woman prophet wearing a halo of bent rebar with melted candles, eyes ringed with white ash, intense gaze",
        "a young firebrand with a shaved head covered in tattoos of eyes, mouth open mid-chant, prayer beads of bolts",
        "a blind old seer with bandaged eyes and a headdress of twisted copper wire like antlers, serene smile",
    ],
    "roadboss": [
        "a burly biker warlord with a tall mohawk, spiked leather vest, a heavy chain wrapped around his fist",
        "a lean hard-faced woman gang leader with road goggles on her forehead, spiked shoulder pad, grease-stained face",
        "a scarred man with a metal jaw brace and skull face paint, holding a battered motorcycle helmet",
        "a stocky Polynesian woman with facial tattoos, fur-trimmed road leathers, a confident grin",
    ],
    "wrencher": [
        "a grease-smeared young woman with a magnifying goggle monocle, tool belt straps, small soldering burns on her cheeks",
        "a tall bearded man with a mechanical prosthetic arm made of scrap metal and pistons, welding mask pushed up",
        "an older woman with wild grey hair, wire spools and circuit boards stuffed in her vest pockets, clever eyes",
        "a young Arab man with a headlamp, an old radio headset, spark-burned gloves, a wrench over his shoulder",
    ],
    "siren": [
        "a striking woman with smoky eye makeup, a ragged glamorous dress over leather armor, a jeweled knife at her collar",
        "a pretty-faced young man with painted lips and glitter on his cheekbones, patchwork fur coat, a dangerous smile",
        "an enigmatic woman wearing a veil made of fine chains, dark violet lips, piercing eyes",
        "a charming older gentleman with a scarred face, a threadbare velvet coat, pencil moustache, a knowing look",
    ],
}
for pb, descs in PLAYBOOKS.items():
    for i, d in enumerate(descs, 1):
        add("portraits", f"{pb}_{i}", PORTRAIT + f"The subject: {d}. " + STYLE)

# ---------------------------------------------------------------- warlords
WARLORDS = {
    "ozmyr": "Ozmyr the Burnt King: a towering gaunt man, half of his face and scalp horribly burned and cracked like cooling lava with ember light glowing in the cracks, a crown of welded turbine blades, black scorched plate armor, glowing orange eyes, terrifying regal presence",
    "dremmer": "Dremmer Gasface, the oil baron: a huge corpulent man whose face is covered by an old gas mask fused to his skin, rubber apron, brass pipes and valves on his shoulders, oil-stained, fuel canisters behind him",
    "carrion": "Mother Carrion, the cult matriarch: a gaunt tall priestess in black crow-feather robes with shards of violet glass embedded in her skin like jewels, pale face, eyes glowing faint violet",
    "kesh": "Baron Kesh, the iron commander: a stern older man with a close-cropped grey beard and an eyepatch, a battered officer's greatcoat decorated with medals made from washers and gears, disciplined posture",
    "ruthie": "Ruthie Two-Guns, queen of the road raiders: a wild-haired grinning woman with red war paint, spiked leather jacket, two revolvers crossed on her chest, motorcycle goggles",
    "isolde": "Isolde Vane, the Salt Widow: an elegant cold woman in flowing white robes crusted with salt crystals, a lace veil, turquoise and silver jewelry, calculating eyes",
    "gnaw": "Gnaw the Rat King: a hunched pale mutant man with patchy fur-like hair, a crown made from rat skulls, a cloak of stitched rat pelts, yellow teeth, sickly glowing green eyes, sewer darkness behind",
}
for k, d in WARLORDS.items():
    add("warlords", k, PORTRAIT + f"The subject: {d}. " + STYLE)

# ---------------------------------------------------------------- NPCs
NPCS = {
    "nell": "Old Nell, elder of a farming settlement: a weathered kind old woman with a straw hat, deep wrinkles, a shotgun over her shoulder",
    "trader": "a shrewd wasteland merchant with a gold tooth, layered scarves, dangling trinkets and scales",
    "barkeep": "a one-eyed bartender with a thick mustache, stained apron, polishing a dented glass",
    "doc": "a weary clinic doctor with a headlamp and blood on his gloves, stubble, thin tired face",
    "voice": "the Voice of the Tower, a mysterious radio broadcaster: an old woman with headphones, cataract-white eyes, candles and glowing radio tubes around her",
    "fixer": "a sly information broker with slicked hair, a patch of stitched leather over one ear, holding a folded paper",
}
for k, d in NPCS.items():
    add("npcs", k, PORTRAIT + f"The subject: {d}. " + STYLE)

# ---------------------------------------------------------------- enemies (used as tokens + portraits)
ENEMIES = {
    "burnlad": "a Burnlad soldier of the Burnt King: young fanatic warrior with soot-blackened face, an ember brand burned on his forehead, scorched black leather armor, flame-shaped scarification",
    "kilnguard": "an elite Kiln Guard: a hulking soldier in heavy black welded plate armor with a slitted visor glowing orange from inside, like a walking furnace",
    "raider": "a road raider: grinning scavenger with a spiked mohawk, tire armor, goggles, crude tattoos",
    "cultist": "an ash cultist of the Choir: hooded figure in grey ash-covered robes, face painted white with black eye sockets, glass shards hanging from the hood",
    "psyker": "a Choir psychic zealot: a wild-eyed woman with violet light leaking from her eyes and mouth, floating hair, bleeding from the nose",
    "militia": "an Iron Hundred rifleman: disciplined soldier in patched olive fatigues and a dented steel helmet, stern face",
    "pumpthug": "a Pumpworks thug: burly man in an oil-stained rubber suit and a gas mask, holding a wrench",
    "ratman": "a Rat King mutant: a hunched pale mutated man with enlarged incisors, sparse hair, milky eyes, rags",
    "saltguard": "a Saltmarch caravan guard: mercenary in white desert wraps crusted with salt, mirrored goggles, face covered",
    "scav": "a desperate scavenger bandit: gaunt hungry man with a dirty bandana over his mouth, mismatched scrap armor",
    "hound": "an ash hound: a mangy mutated wasteland dog with patchy grey hide, exposed ribs, too many teeth, glowing eyes, snarling, close-up head portrait",
    "crawler": "a sump crawler: a grotesque mutated giant river crustacean-insect creature, slimy green-black carapace, mandibles, close-up",
    "hollow": "a Hollow: a Maelstrom-touched husk of a man, empty eye sockets leaking violet light, grey cracked skin, mouth open in a silent scream",
    "glowbug": "a glowbug: a mutated insect the size of a dog with a bioluminescent sickly green abdomen, compound eyes, close-up",
    "warboss": "a raider warboss: a huge scarred brute with a skull mask pushed up, massive shoulder armor made of a car hood, holding a cleaver",
}
for k, d in ENEMIES.items():
    add("enemies", k, PORTRAIT + f"The subject: {d}. " + STYLE)

# ---------------------------------------------------------------- settlements (backgrounds)
TOWNS = {
    "kiln": "a colossal ruined nuclear power plant turned into a fortified citadel, cooling towers belching smoke and fire, black banners, furnace-lit walls, spiked gates",
    "pumpworks": "a sprawling oil refinery settlement with burning flare stacks, pipes and tanks turned into shacks, pools of black tar, workers in gas masks",
    "crater": "a cult chapel built on the rim of a glass-fused crater that glints violet, ash-robed pilgrims, strange spires of melted glass, eerie violet light in the sky",
    "dam": "a massive concrete dam turned into a military fortress, watchtowers, gun emplacements, disciplined sentries, a murky reservoir behind it",
    "wreckyard": "a raider town built from stacked car wrecks and school buses in a vast junkyard, bonfires, motorcycles, spiked war-rigs, graffiti-free rusted metal",
    "brinetown": "a white salt-crusted caravan bazaar on cracked salt flats, colorful tattered awnings, camel-like mutant beasts of burden, windcatchers",
    "undergrid": "a dim sewer warren beneath a drowned city, collapsed subway tunnels, shanty platforms over dark water, green glowing lamps, rat totems",
    "hopesrest": "a small fortified farming settlement with scrap walls, a creaky windmill, irrigated green crop fields, a water tower, children and farmers",
    "knot": "a crossroads market town built under and on top of a collapsed highway interchange, stalls under concrete overpasses, crowds, cargo trucks",
    "outpost": "a small wasteland outpost of shacks and a watchtower around a well, with a scrap wall and a gate, dusty road",
    "ruins": "the entrance to a haunted pre-war ruin, a collapsed concrete building half-buried in sand, dark doorway, warning signs without text, bones",
}
for k, d in TOWNS.items():
    add("towns", k, SCENE + f"A post-apocalyptic settlement: {d}. Daylight or dusk, atmospheric haze. " + STYLE, "16:9", "2K")

INTERIORS = {
    "bar": "the smoky interior of a wasteland saloon built in a rusted shipping container hall, a bar made of car doors, hanging bulbs, rough patrons at tables",
    "market": "a crowded wasteland market interior, stalls piled with scavenged weapons, gas cans, ammunition, water jugs and tools, hanging tarps",
    "clinic": "a grimy makeshift clinic interior, patched operating table, jars of herbs and pills, blood bags, a dentist's lamp",
    "hall": "a warlord's throne hall inside a ruined industrial building, a throne of scrap on a raised platform, war banners, braziers, armed guards",
    "garage": "a wasteland mercenary camp and recruiting yard, bonfire, armed toughs sparring, weapon racks, tents",
}
for k, d in INTERIORS.items():
    add("interiors", k, SCENE + f"{d}. Warm firelight and cold shadows, no people in the immediate foreground. " + STYLE, "16:9", "2K")

# ---------------------------------------------------------------- events
EVENTS = {
    "ambush": "raiders on motorcycles ambushing a small caravan on a desert road, dust clouds, gunfire flashes",
    "wreck": "an abandoned armored truck lying on its side on a dead highway, cargo spilled, eerily quiet",
    "campfire": "a mysterious hooded stranger sitting alone at a campfire in the night desert, inviting gesture",
    "duststorm": "a colossal wall of dust storm rolling over a wasteland plain, travelers bracing against the wind",
    "maelstrom": "a psychic storm: the sky tearing open into violet and black swirling vortices full of ghostly faces, lightning, a lone figure below clutching their head",
    "wounded": "a wounded traveler slumped against a rusted road sign, bleeding, pleading, vultures circling",
    "burntvillage": "a small village burned to the ground, smoking ruins, the ember brand of the Burnt King painted on a wall",
    "tollgate": "a raider toll-gate made of wrecked cars blocking a canyon road, armed guards on top, skulls on spikes",
    "nest": "a mutant nest in a collapsed tunnel, egg sacs, bones, glowing green eyes in the dark",
    "cache": "a hidden pre-war supply bunker hatch half-buried in sand, rusted crates visible inside, flashlight beam",
    "pillar": "a ragged prophet preaching from atop a tall broken concrete pillar to a small crowd in the desert",
    "army": "a massive wasteland army marching across the plains with war-rigs, banners, and hundreds of soldiers, seen from a hill",
    "convoy": "a slave convoy of chained prisoners guarded by black-armored soldiers walking along a scorched road",
    "tower": "a tall rusted radio tower on a hill at night, antennas crackling with violet electricity, a lit shack at its base",
    "oasis": "a rare desert oasis with a working well and a stunted green tree, tents of travelers resting, dusk",
    "traders": "a friendly caravan of traders with pack beasts and a rusted truck, displaying their wares at a roadside",
    "duel": "two wasteland champions facing each other in a ring of cheering raiders and burning barrels, before a duel",
    "battlefield": "the aftermath of a great wasteland battle, smoking wrecks, fallen banners, crows, survivors looting",
}
for k, d in EVENTS.items():
    add("events", k, SCENE + f"{d}. " + STYLE, "16:9", "2K")

# ---------------------------------------------------------------- delve rooms
DELVE = {
    "corridor": "a dark flooded concrete corridor inside a pre-war bunker, flickering emergency light, debris",
    "lab": "an abandoned pre-war laboratory with shattered glass tanks, strange green fluids, overturned equipment",
    "vault": "a massive round steel vault door slightly ajar, light spilling from inside, bones on the floor",
    "subway": "a collapsed subway station with a derailed train car, rubble, water dripping, darkness",
    "ward": "a ruined hospital ward with rusted beds and hanging curtains, graffiti-free walls, eerie light",
    "reactor": "a deep reactor chamber with a glowing core behind cracked glass, catwalks, steam",
    "hangar": "a derelict aircraft hangar with a skeletal plane, sunlight shafts through holes in the roof",
    "shrine": "an underground chamber turned into a Maelstrom shrine, candles, violet glowing sigils, piles of offerings",
    "stairs": "a crumbling stairwell descending into darkness inside a ruined tower, a lantern on the steps",
    "archive": "a pre-war server room archive, rows of dead computer cabinets, cables hanging like vines, a single blinking light",
}
for k, d in DELVE.items():
    add("delve", k, SCENE + f"{d}. " + STYLE, "16:9", "2K")

# ---------------------------------------------------------------- battle maps (top-down)
BATTLEMAPS = {
    "waste": "cracked dry dirt, gravel, dead grass tufts, tire tracks, oil stains",
    "road": "a broken asphalt highway crossing the map with faded lane paint, cracks with weeds, sand drifts, shattered glass",
    "salt": "white cracked salt flat crust with hexagonal cracks, a few dark mud patches, scattered bleached bones",
    "industrial": "an oil-stained concrete refinery yard, metal grates, painted-over markings, puddles of black oil, rusted pipes on the ground",
    "glass": "glossy fused violet-black glass ground from a crater with cracks glowing faintly, ash drifts",
    "sewer": "wet stone floor of a huge underground sewer chamber, shallow green water channels, grates, moss",
    "farm": "dusty farmland with rows of withered crops, an irrigation ditch, a dirt path, straw",
    "street": "a ruined city street with cracked pavement, rubble piles, a manhole cover, sidewalk edges",
    "kiln": "the scorched metal floor of a vast reactor hall, grated floor panels, glowing orange cracks, soot and ash",
    "sand": "rippled desert sand dunes with a few scrubby dry bushes and rocks",
}
for k, d in BATTLEMAPS.items():
    add("battlemaps", k, TOPDOWN + f"Ground: {d}. " + STYLE, "16:9", "2K")

# ---------------------------------------------------------------- props (chroma)
PROPS = {
    "car": "a burnt-out rusted car wreck",
    "barrels": "a cluster of three rusted oil drums",
    "barrier": "a cracked concrete jersey barrier block",
    "scrap": "a pile of scrap metal, tires and junk",
    "rocks": "a cluster of jagged desert boulders",
    "tree": "a dead leafless blackened tree",
    "sandbags": "a curved wall of sandbags",
    "crates": "a stack of battered wooden supply crates",
    "tires": "a stack of old rubber tires",
    "pillar": "a broken concrete pillar with rebar",
    "pipes": "a tangle of large rusted industrial pipes",
    "glass": "a jagged spire of fused violet volcanic glass",
    "bus": "a rusted wrecked school bus without paint markings",
    "fire": "a burning oil barrel with flames",
}
for k, d in PROPS.items():
    add("props", k, f"{d}, " + PROP)

# ---------------------------------------------------------------- item icons
ITEMS = {
    "knife": "rusty combat knife with taped handle",
    "machete": "notched machete",
    "crowbar": "bent crowbar",
    "pipe": "spiked lead pipe club",
    "sledge": "heavy sledgehammer",
    "chainsaw": "rusty chainsaw",
    "spear": "scrap-metal spear",
    "pistol": "worn semi-automatic pistol",
    "revolver": "long-barreled revolver",
    "shotgun": "sawn-off double-barrel shotgun",
    "rifle": "bolt-action hunting rifle with scope",
    "smg": "compact submachine gun",
    "assault": "battered assault rifle with taped magazine",
    "crossbow": "improvised crossbow made of car springs",
    "flamer": "homemade flamethrower with fuel tank",
    "laser": "sleek pre-war energy pistol glowing blue",
    "leathers": "patched leather jacket armor",
    "scrapplate": "scrap-metal plate armor vest",
    "tirearmor": "armor made of cut tires and straps",
    "kevlar": "old military kevlar vest",
    "riot": "riot police armor with helmet",
    "powerharness": "pre-war powered exoskeleton harness",
    "stim": "glass syringe stimpack with red fluid",
    "bandage": "roll of dirty bandages and a tin of salve",
    "molotov": "molotov cocktail bottle with burning rag",
    "grenade": "old pineapple frag grenade",
    "rations": "bundle of canned food and water canteen",
    "antirad": "bottle of anti-radiation pills",
    "dampener": "vial of blue psychic dampening liquid",
    "barter": "pile of wasteland barter: bullets, bottle of fuel, batteries and scrap coins",
    "keycard": "pre-war security keycard with a cracked hologram",
    "relic": "strange pre-war artifact glowing faintly",
    "goggles": "brass-rimmed goggles",
    "charm": "lucky charm necklace of bones and a bullet",
    "scope": "rifle scope",
    "medkit": "battered first aid kit",
    "ammo": "box of scavenged ammunition",
    "water": "plastic jug of clean water",
    "map": "folded hand-drawn map with a compass",
    "tome": "burned pre-war book with violet glowing symbols",
}
for k, d in ITEMS.items():
    add("items", k, ICON.format(d))

# ---------------------------------------------------------------- ability icons
ABILITIES = {
    "shoot": "a crosshair over a bullet",
    "melee": "crossed machete and fist",
    "suppress": "a spray of bullets in an arc",
    "patch": "a stitched heart with a needle",
    "revive": "a hand reaching up out of darkness toward light",
    "doublestrike": "two crossing knife slashes",
    "riposte": "a blade parrying a blade",
    "mindlash": "a cracked skull with violet lightning",
    "puppet": "a hand with puppet strings attached to a head",
    "sermon": "an open mouth breathing fire",
    "maelstrom": "a violet vortex eye",
    "rally": "a raised fist holding a torn banner",
    "pack": "three howling wolf heads",
    "turret": "an improvised auto-turret made of scrap",
    "pipebomb": "an exploding pipe bomb",
    "captivate": "a hypnotic eye with a spiral",
    "kiss": "a dagger hidden behind a rose",
    "overwatch": "an eye inside a rifle scope",
    "defend": "a battered shield of a car door",
    "charge": "a charging bull skull",
    "sprint": "a running boot kicking up dust",
    "fireball": "a roaring flame burst",
    "heal_all": "a circle of bandaged hands",
    "execute": "a guillotine blade",
    "warcry": "a screaming skull",
    "trick": "a pair of dice mid-roll",
}
for k, d in ABILITIES.items():
    add("abilities", k, ABILITY.format(d))

# ---------------------------------------------------------------- UI textures
add("ui", "metal", "Seamless tileable texture of dark rusted riveted steel plate, weathered, scratches, subtle, top-down flat lighting, no text", "1:1")
add("ui", "paper", "Seamless tileable texture of old stained yellowed paper parchment with burn marks, flat lighting, no text", "1:1")
add("ui", "leather", "Seamless tileable texture of dark worn cracked leather, flat lighting, no text", "1:1")
add("ui", "concrete", "Seamless tileable texture of dark stained cracked concrete, flat lighting, no text", "1:1")

# ---------------------------------------------------------------- v1.1 additions: faction halls, sigils, more recruits
HALLS = {
    "hall_cinder": "the Burnt King's throne room inside a colossal ruined reactor hall: a throne of welded turbine blades on a dais, roaring furnaces, black banners with an ember sigil, kneeling black-armored guards",
    "hall_choir": "the Choir of Ash's chapel carved into violet glass on a crater rim: an altar of fused glass shards, hundreds of candles, ash-robed worshippers, eerie violet light through cracks",
    "hall_iron": "the Iron Hundred's war room inside a concrete dam: a big table with a painted map, rifles on racks, old military radios, disciplined officers, harsh electric lamps",
    "hall_pump": "the Oil Baron's office inside a refinery: brass pipes and valves everywhere, barrels of fuel, a huge chair made from a truck seat, gas lamps, oily haze",
    "hall_rats": "the Rat King's court in a flooded subway station: a throne built from old turnstiles and rat skulls, green fungus lamps, dark water, hunched mutant courtiers",
    "hall_dust": "the road queen's court inside a giant garage made of car wrecks: a throne welded from motorcycle parts, bonfires in oil drums, raiders with bikes, chains hanging",
    "hall_salt": "the Salt Widow's audience chamber: white salt-crystal walls, silk awnings, ledgers and scales, turquoise ornaments, cool elegant light, guards in white wraps",
}
for k, d in HALLS.items():
    add("interiors", k, SCENE + f"{d}. No people in the immediate foreground. " + STYLE, "16:9", "2K")

SIGILS = {
    "cinder": "a burning crown of turbine blades inside a flame, ember-orange and black",
    "choir": "a violet eye weeping glass shards inside a circle of ash",
    "iron": "a steel-blue fist gripping a water droplet on a riveted shield",
    "pump": "an orange flare stack flame over crossed wrenches and an oil drop",
    "rats": "a toxic-green rat skull wearing a crown over a sewer grate",
    "dust": "a yellow winged motorcycle wheel with two crossed revolvers",
    "salt": "a teal crystal set in silver scales with a caravan wheel",
    "player": "a bone-white skull with a rising sun and crossed rifles",
}
for k, d in SIGILS.items():
    add("sigils", k, f"Heraldic war-banner emblem for a post-apocalyptic faction: {d}, bold painted metal badge, strong silhouette, centered, isolated on a flat solid pure magenta #FF00FF background, no text, no letters.")

MORE_RECRUITS = {
    "gunhand": ["a lanky redheaded man with freckles and a scoped rifle, patched camo poncho", "a stern Maori woman with a chin tattoo and a belt-fed gun strap"],
    "sawbones": ["a soft-spoken young Black woman with a nurse's headscarf and a bone saw on her belt", "a gruff old veteran medic with a gas mask hanging at his neck and bloodied bandages"],
    "duelist": ["a grinning scarred young man with a braided topknot and a katana made from a leaf spring", "a cold-eyed older woman with a white streak in her hair and a rapier, long coat"],
    "mindbender": ["a bald child-faced woman with a third eye tattooed on her forehead, glowing faintly", "a trembling thin man wearing a helmet of copper coils and wires"],
    "prophet": ["a towering preacher with a long white beard and a burning book held aloft", "a young woman in white robes with ash handprints on her face and a staff of rebar"],
    "roadboss": ["a grizzled biker with a silver beard and a leather jacket covered in patches", "a young fierce woman with a buzzcut, flame decals on her shoulder armor, a chain"],
    "wrencher": ["a heavyset man with welding goggles and a hand made of servos", "a teenage girl with a toolbag and a homemade drone perched on her shoulder"],
    "siren": ["an androgynous performer with silver face paint and a feathered collar, knowing smile", "a sultry older woman with a jeweled eyepatch and a cigarette holder"],
}
for pb, descs in MORE_RECRUITS.items():
    for i, d in enumerate(descs, 5):
        add("portraits", f"{pb}_{i}", PORTRAIT + f"The subject: {d}. " + STYLE)
