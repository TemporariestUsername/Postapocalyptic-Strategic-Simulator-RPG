/** Map image is 2752 × 1536; region anchors are in that pixel space. */
export const MAP_W = 2752;
export const MAP_H = 1536;

export interface RegionDef {
  id: string;
  name: string;
  x: number;
  y: number;
  owner: string; // faction id or 'free'
  garrison: number;
  wealth: number; // barter per month to the owner
  fort: number; // defensive multiplier
  town: string; // settlement background
  battlemap: string;
  market: number; // 0 = none, 1..4 shop tier
  bar: boolean;
  clinic: boolean;
  delve?: string;
  danger: number; // chance of a road encounter per travel day (0..1)
  desc: string;
  kind: 'hold' | 'capital' | 'outpost' | 'ruins';
}

const r = (d: RegionDef) => d;

export const REGIONS: RegionDef[] = [
  r({ id: 'kiln', name: 'The Kiln', x: 1400, y: 380, owner: 'cinder', garrison: 140, wealth: 40, fort: 2.2, town: 'kiln', battlemap: 'kiln', market: 3, bar: true, clinic: true, danger: 0.25, kind: 'capital',
    desc: 'A dead reactor turned into a furnace-citadel. The cooling towers breathe smoke day and night, and the Burnt King sits on his throne of turbine blades at the heart of it.' }),
  r({ id: 'ashfall', name: 'Ashfall', x: 1280, y: 690, owner: 'cinder', garrison: 45, wealth: 16, fort: 1.1, town: 'outpost', battlemap: 'waste', market: 1, bar: true, clinic: false, danger: 0.3, kind: 'hold',
    desc: 'Scorched plains where the ground still smoulders. Burnlad work-camps dig through the ash for anything that did not melt.' }),
  r({ id: 'northstack', name: 'Northstack', x: 1760, y: 140, owner: 'cinder', garrison: 35, wealth: 12, fort: 1.2, town: 'ruins', battlemap: 'industrial', market: 0, bar: false, clinic: false, delve: 'northstack', danger: 0.35, kind: 'ruins',
    desc: 'The reactor\'s outer annex: turbine halls and switching yards. Burnlads guard the road; something else guards the deep rooms.' }),
  r({ id: 'howling', name: 'Howling Waste', x: 940, y: 140, owner: 'choir', garrison: 35, wealth: 10, fort: 1.2, town: 'outpost', battlemap: 'sand', market: 1, bar: true, clinic: false, danger: 0.45, kind: 'outpost',
    desc: 'Wind-scoured badlands where the Maelstrom howls loudest. Choir hermits live in holes in the rock and listen.' }),
  r({ id: 'crater', name: 'The Glass Crater', x: 520, y: 340, owner: 'choir', garrison: 100, wealth: 22, fort: 1.8, town: 'crater', battlemap: 'glass', market: 2, bar: true, clinic: true, danger: 0.2, kind: 'capital',
    desc: 'A mile-wide bowl of fused violet glass. The Choir\'s chapel clings to the rim, and on still nights the glass hums.' }),
  r({ id: 'blackglass', name: 'Blackglass Rise', x: 880, y: 500, owner: 'choir', garrison: 30, wealth: 12, fort: 1.2, town: 'ruins', battlemap: 'glass', market: 0, bar: false, clinic: false, delve: 'blackglass', danger: 0.35, kind: 'ruins',
    desc: 'A ridge of glassed bunkers between the crater and the Kiln, contested by prophets and Burnlads alike. The old command bunker was never opened.' }),
  r({ id: 'holdfast', name: 'Holdfast Dam', x: 2280, y: 340, owner: 'iron', garrison: 95, wealth: 26, fort: 2.0, town: 'dam', battlemap: 'road', market: 3, bar: true, clinic: true, danger: 0.1, kind: 'capital',
    desc: 'The great dam: gun-towers along its crest and the only clean water in the basin behind it. The Iron Hundred have never lost it.' }),
  r({ id: 'stillwater', name: 'Stillwater', x: 2540, y: 120, owner: 'iron', garrison: 30, wealth: 16, fort: 1.1, town: 'outpost', battlemap: 'farm', market: 1, bar: true, clinic: false, danger: 0.15, kind: 'hold',
    desc: 'Fishing shacks on the reservoir shore. The fish have too many eyes but they fill a belly.' }),
  r({ id: 'gorge', name: 'Gorge Road', x: 1980, y: 540, owner: 'iron', garrison: 40, wealth: 12, fort: 1.4, town: 'outpost', battlemap: 'road', market: 1, bar: true, clinic: false, danger: 0.25, kind: 'hold',
    desc: 'A switchback road down the canyon below the dam. Whoever holds the gorge holds the gate to the east.' }),
  r({ id: 'pumpworks', name: 'The Pumpworks', x: 2460, y: 700, owner: 'pump', garrison: 70, wealth: 34, fort: 1.5, town: 'pumpworks', battlemap: 'industrial', market: 4, bar: true, clinic: true, danger: 0.15, kind: 'capital',
    desc: 'The last working refinery. Flare stacks burn day and night and the air tastes of benzene and money.' }),
  r({ id: 'tarpits', name: 'The Tarpits', x: 2560, y: 900, owner: 'pump', garrison: 25, wealth: 14, fort: 1.0, town: 'outpost', battlemap: 'industrial', market: 1, bar: false, clinic: false, danger: 0.3, kind: 'hold',
    desc: 'Black lakes of crude oil where Dremmer\'s crews skim the slick. Things live in the tar. Big things.' }),
  r({ id: 'greenwater', name: 'Greenwater Crossing', x: 1860, y: 820, owner: 'pump', garrison: 30, wealth: 18, fort: 1.3, town: 'outpost', battlemap: 'road', market: 2, bar: true, clinic: false, danger: 0.2, kind: 'hold',
    desc: 'A toll bridge over the poisoned river. Everyone crossing east pays Dremmer, in barter or in blood.' }),
  r({ id: 'undergrid', name: 'The Undergrid', x: 2200, y: 1300, owner: 'rats', garrison: 75, wealth: 20, fort: 1.8, town: 'undergrid', battlemap: 'sewer', market: 2, bar: true, clinic: true, danger: 0.3, kind: 'capital',
    desc: 'Subway tunnels and sewer vaults beneath the drowned city, lit green by fungus lamps. Gnaw holds court on a throne of old turnstiles.' }),
  r({ id: 'spirefall', name: 'Spirefall', x: 2580, y: 1280, owner: 'rats', garrison: 20, wealth: 10, fort: 1.0, town: 'ruins', battlemap: 'street', market: 0, bar: false, clinic: false, delve: 'spirefall', danger: 0.4, kind: 'ruins',
    desc: 'Drowned skyscrapers leaning like broken teeth. The upper floors are dry and full of pre-Burn treasure, and full of the dead.' }),
  r({ id: 'whiteout', name: 'Whiteout', x: 180, y: 660, owner: 'salt', garrison: 20, wealth: 12, fort: 1.0, town: 'outpost', battlemap: 'salt', market: 1, bar: true, clinic: false, danger: 0.25, kind: 'hold',
    desc: 'Salt-miners\' camps on the northern flats. The glare blinds and the crust cracks underfoot.' }),
  r({ id: 'brinetown', name: 'Brinetown', x: 240, y: 940, owner: 'salt', garrison: 55, wealth: 30, fort: 1.4, town: 'brinetown', battlemap: 'salt', market: 4, bar: true, clinic: true, danger: 0.1, kind: 'capital',
    desc: 'The white bazaar of the Saltmarch: every caravan route in the Burnlands ends here eventually. The Salt Widow counts every coin.' }),
  r({ id: 'whisperdunes', name: 'Whisperdunes', x: 240, y: 1360, owner: 'salt', garrison: 20, wealth: 8, fort: 1.0, town: 'ruins', battlemap: 'sand', market: 0, bar: false, clinic: false, delve: 'airfield', danger: 0.4, kind: 'ruins',
    desc: 'Shifting dunes that swallowed an old airfield. When the wind turns you can hear the hangars groan beneath the sand.' }),
  r({ id: 'knot', name: 'The Knot', x: 1000, y: 1080, owner: 'salt', garrison: 35, wealth: 24, fort: 1.2, town: 'knot', battlemap: 'road', market: 3, bar: true, clinic: true, danger: 0.15, kind: 'hold',
    desc: 'A market town knotted into a collapsed highway interchange. Six roads meet here, and so does every rumor in the Burnlands.' }),
  r({ id: 'hopesrest', name: 'Hope\'s Rest', x: 1520, y: 1080, owner: 'free', garrison: 15, wealth: 14, fort: 1.1, town: 'hopesrest', battlemap: 'farm', market: 1, bar: true, clinic: true, danger: 0.1, kind: 'hold',
    desc: 'A stubborn farming hold with green fields and a creaking windmill. Old Nell runs it, and nobody owns it. Yet.' }),
  r({ id: 'wreckyard', name: 'The Wreckyard', x: 1240, y: 1380, owner: 'dust', garrison: 85, wealth: 24, fort: 1.5, town: 'wreckyard', battlemap: 'waste', market: 3, bar: true, clinic: true, danger: 0.2, kind: 'capital',
    desc: 'A city of stacked car wrecks and school buses. Ruthie\'s raiders race, brawl and drink here between raids.' }),
  r({ id: 'dustbowl', name: 'Dustbowl', x: 660, y: 1300, owner: 'dust', garrison: 25, wealth: 10, fort: 1.0, town: 'outpost', battlemap: 'sand', market: 1, bar: true, clinic: false, danger: 0.3, kind: 'hold',
    desc: 'A raider staging camp in the dunes. Engines, bonfires and bad ideas.' }),
  r({ id: 'emberroad', name: 'Ember Road', x: 680, y: 840, owner: 'free', garrison: 12, wealth: 10, fort: 1.0, town: 'outpost', battlemap: 'waste', market: 1, bar: true, clinic: false, danger: 0.3, kind: 'outpost',
    desc: 'A lonely road through burnt orange scrub. The old Radio Tower on the hill still broadcasts, though nobody knows who is talking.' }),
  r({ id: 'deadspan', name: 'Deadspan', x: 1600, y: 840, owner: 'dust', garrison: 25, wealth: 12, fort: 1.2, town: 'outpost', battlemap: 'road', market: 1, bar: true, clinic: false, danger: 0.3, kind: 'hold',
    desc: 'A broken highway bridge that Ruthie\'s riders use as a toll-gate and a lookout over the whole basin.' }),
];

export const REGION_BY_ID: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

/** Hand-reviewed adjacency (derived from the Voronoi layout). */
export const ADJACENCY: [string, string][] = [
  ['kiln', 'ashfall'], ['kiln', 'blackglass'], ['kiln', 'northstack'], ['kiln', 'howling'], ['kiln', 'gorge'], ['kiln', 'deadspan'],
  ['northstack', 'howling'], ['northstack', 'stillwater'], ['northstack', 'holdfast'], ['northstack', 'gorge'],
  ['howling', 'crater'], ['howling', 'blackglass'],
  ['crater', 'blackglass'], ['crater', 'whiteout'], ['crater', 'emberroad'],
  ['blackglass', 'ashfall'], ['blackglass', 'emberroad'], ['blackglass', 'knot'],
  ['ashfall', 'deadspan'], ['ashfall', 'knot'], ['ashfall', 'emberroad'], ['ashfall', 'hopesrest'],
  ['holdfast', 'stillwater'], ['holdfast', 'gorge'], ['holdfast', 'pumpworks'],
  ['gorge', 'greenwater'], ['gorge', 'pumpworks'], ['gorge', 'deadspan'],
  ['pumpworks', 'tarpits'], ['pumpworks', 'greenwater'],
  ['tarpits', 'undergrid'], ['tarpits', 'spirefall'],
  ['greenwater', 'deadspan'], ['greenwater', 'undergrid'], ['greenwater', 'hopesrest'],
  ['undergrid', 'spirefall'], ['undergrid', 'hopesrest'], ['undergrid', 'wreckyard'],
  ['whiteout', 'brinetown'], ['whiteout', 'emberroad'],
  ['brinetown', 'emberroad'], ['brinetown', 'dustbowl'], ['brinetown', 'whisperdunes'],
  ['whisperdunes', 'dustbowl'],
  ['knot', 'emberroad'], ['knot', 'dustbowl'], ['knot', 'wreckyard'], ['knot', 'hopesrest'],
  ['dustbowl', 'wreckyard'], ['dustbowl', 'emberroad'],
  ['hopesrest', 'wreckyard'], ['hopesrest', 'deadspan'],
];

export const NEIGHBORS: Record<string, string[]> = {};
for (const reg of REGIONS) NEIGHBORS[reg.id] = [];
for (const [a, b] of ADJACENCY) {
  NEIGHBORS[a].push(b);
  NEIGHBORS[b].push(a);
}

export function travelDays(a: string, b: string): number {
  const ra = REGION_BY_ID[a], rb = REGION_BY_ID[b];
  const d = Math.hypot(ra.x - rb.x, ra.y - rb.y);
  return Math.max(2, Math.round(d / 170));
}
