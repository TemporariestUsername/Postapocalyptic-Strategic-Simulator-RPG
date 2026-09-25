import { Rng } from '../engine/rng';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { PLAYBOOKS } from '../data/playbooks';
import { abilitiesOf, armorOf, effStat, maxHp, moveOf } from '../game/characters';
import type { Character } from '../game/types';
import { STATS, type Stat } from '../engine/dice';
import { beginPhase, emit } from './battle';
import type { Battle, BattleContext, Tile, Unit } from './types';
import { DIRS, passable } from './grid';

export const SKIRMISH_W = 14;
export const SKIRMISH_H = 8;
export const ARMY_W = 16;
export const ARMY_H = 8;

interface PropDef { cover: 1 | 2; scale: number; }
export const PROPS: Record<string, PropDef> = {
  car: { cover: 2, scale: 1.25 },
  rocks: { cover: 2, scale: 1.05 },
  pillar: { cover: 2, scale: 1.0 },
  pipes: { cover: 2, scale: 1.1 },
  glass: { cover: 2, scale: 1.05 },
  barrels: { cover: 1, scale: 0.9 },
  barrier: { cover: 1, scale: 0.95 },
  sandbags: { cover: 1, scale: 1.0 },
  crates: { cover: 1, scale: 0.9 },
  tires: { cover: 1, scale: 0.85 },
  scrap: { cover: 1, scale: 1.0 },
  tree: { cover: 1, scale: 1.15 },
  fire: { cover: 1, scale: 0.8 },
};

const THEME_PROPS: Record<string, string[]> = {
  waste: ['rocks', 'car', 'barrels', 'scrap', 'tires', 'tree', 'fire', 'rocks'],
  road: ['car', 'barrier', 'tires', 'barrels', 'scrap', 'car', 'barrier'],
  salt: ['rocks', 'crates', 'barrels', 'scrap', 'tires'],
  industrial: ['pipes', 'barrels', 'crates', 'barrier', 'fire', 'pipes'],
  glass: ['glass', 'rocks', 'pillar', 'glass', 'scrap'],
  sewer: ['pipes', 'barrels', 'crates', 'pillar', 'scrap'],
  farm: ['tree', 'crates', 'sandbags', 'barrels', 'scrap', 'tires'],
  street: ['pillar', 'car', 'barrier', 'scrap', 'crates', 'car'],
  kiln: ['pipes', 'pillar', 'fire', 'barrels', 'barrier', 'fire'],
  sand: ['rocks', 'tree', 'scrap', 'crates', 'rocks'],
};

export function unitFromCharacter(c: Character, team: 0 | 1 = 0): Unit {
  const pb = PLAYBOOKS[c.playbook];
  const stats = {} as Record<Stat, number>;
  for (const s of STATS) stats[s] = effStat(c, s);
  const gear = c.gear ? ITEMS[c.gear].gear : undefined;
  return {
    id: c.id, name: c.name, team, controlled: team === 0, portrait: c.portrait, x: 0, y: 0,
    hp: Math.max(1, c.hp), maxHp: maxHp(c), armor: armorOf(c), move: moveOf(c), stats, weapon: c.weapon,
    abilities: [...abilitiesOf(c), 'defend'], cooldowns: {}, status: {}, ai: 'melee', charId: c.id, moved: false, acted: false,
    hitBonus: gear?.hit ?? 0, healBonus: gear?.heal ?? 0, hardHarm: pb.id === 'gunhand' ? 1 : 0, evasive: pb.id === 'duelist',
    xp: 0, loot: 0, kills: 0,
  };
}

/** Enemy tier 0..4 scales with game progress. */
export function unitFromEnemy(defId: string, tier: number, id: string): Unit {
  const d = ENEMIES[defId];
  const stats = { ...d.stats };
  if (tier >= 2) { stats.hard++; stats.cool++; }
  if (tier >= 4) { stats.hard++; stats.cool++; stats.weird++; }
  const hp = d.hp + tier * 2 + (d.boss ? tier * 4 : 0);
  return {
    id, name: d.name, team: 1, controlled: false, portrait: d.portrait, x: 0, y: 0, hp, maxHp: hp,
    armor: d.armor + (tier >= 3 ? 1 : 0), move: d.move, stats, weapon: d.weapon, abilities: [...(d.abilities ?? [])],
    cooldowns: {}, status: {}, ai: d.ai, enemyId: defId, boss: d.boss, moved: false, acted: false,
    hitBonus: 0, healBonus: 0, hardHarm: 0, evasive: false, xp: Math.round(d.xp * (1 + tier * 0.25)), loot: Math.round(d.loot * (1 + tier * 0.3)),
  };
}

function makeTiles(w: number, h: number): Tile[] {
  return Array.from({ length: w * h }, () => ({ blocked: false, cover: 0 as const }));
}

function connected(b: Battle, zones: [number, number][]): boolean {
  if (!zones.length) return true;
  const seen = new Set<string>();
  const [sx, sy] = zones[0];
  const q: [number, number][] = [[sx, sy]];
  seen.add(`${sx},${sy}`);
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of DIRS.slice(0, 4)) {
      const nx = x + dx, ny = y + dy;
      if (!passable(b, nx, ny) || seen.has(`${nx},${ny}`)) continue;
      seen.add(`${nx},${ny}`);
      q.push([nx, ny]);
    }
  }
  return zones.every(([x, y]) => seen.has(`${x},${y}`));
}

function placeProps(b: Battle, rng: Rng, density: number, reserved: (x: number, y: number) => boolean, extraSandbags = 0): void {
  const theme = THEME_PROPS[b.battlemap] ?? THEME_PROPS.waste;
  const count = Math.round(b.w * b.h * density);
  const all: [number, number][] = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) all.push([x, y]);
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < 400) {
    const [x, y] = rng.pick(all);
    if (reserved(x, y)) continue;
    const t = b.tiles[y * b.w + x];
    if (t.blocked) continue;
    // keep props from forming solid walls: no more than 1 blocked neighbor orthogonally
    let n = 0;
    for (const [dx, dy] of DIRS.slice(0, 4)) if (!passable(b, x + dx, y + dy) && x + dx >= 0 && y + dy >= 0 && x + dx < b.w && y + dy < b.h) n++;
    if (n > 1) continue;
    const prop = rng.pick(theme);
    const def = PROPS[prop];
    t.blocked = true;
    t.cover = def.cover;
    t.prop = prop;
    t.rot = prop === 'car' || prop === 'barrier' || prop === 'sandbags' ? rng.pick([0, 90, 180, 270]) + rng.int(-12, 12) : rng.int(0, 359);
    t.scale = def.scale * (0.92 + rng.next() * 0.16);
    placed++;
  }
  // defensive sandbag line for sieges
  for (let i = 0; i < extraSandbags; i++) {
    const x = b.w - 4 - (i % 2);
    const y = 1 + Math.floor((i * (b.h - 2)) / Math.max(1, extraSandbags));
    const t = b.tiles[y * b.w + x];
    if (t.blocked) continue;
    t.blocked = true;
    t.cover = 1;
    t.prop = i % 3 === 0 ? 'barrier' : 'sandbags';
    t.rot = 90 + rng.int(-8, 8);
    t.scale = 1;
  }
}

function spawnSpots(b: Battle, side: 0 | 1, n: number, rng: Rng): [number, number][] {
  const cols = side === 0 ? [0, 1, 2] : [b.w - 1, b.w - 2, b.w - 3];
  const spots: [number, number][] = [];
  const mid = Math.floor(b.h / 2);
  const rows = Array.from({ length: b.h }, (_, i) => i).sort((a, c) => Math.abs(a - mid) - Math.abs(c - mid) + (rng.next() - 0.5) * 0.5);
  for (const c of cols) for (const r of rows) {
    if (spots.length >= n) break;
    if (!b.tiles[r * b.w + c].blocked) spots.push([c, r]);
  }
  return spots;
}

export interface SkirmishSetup {
  crew: Character[];
  enemies: { id: string; tier: number }[];
  battlemap: string;
  context: BattleContext;
  seed: number;
  density?: number;
  allies?: Unit[];
}

export function createSkirmish(o: SkirmishSetup): Battle {
  const rng = Rng.fromSeed(o.seed);
  const b: Battle = {
    w: SKIRMISH_W, h: SKIRMISH_H, tiles: makeTiles(SKIRMISH_W, SKIRMISH_H), units: [], turn: 1, phase: 'player', mode: 'skirmish',
    battlemap: o.battlemap, log: [], result: null, context: o.context, rng: rng.state, events: [], idc: 0,
  };
  const reserved = (x: number, _y: number) => x <= 2 || x >= b.w - 3;
  let tries = 0;
  do {
    b.tiles = makeTiles(b.w, b.h);
    placeProps(b, rng, o.density ?? 0.13, reserved);
    tries++;
  } while (!connected(b, [[1, Math.floor(b.h / 2)], [b.w - 2, Math.floor(b.h / 2)]]) && tries < 10);

  const crew = o.crew.filter((c) => c.hp > 0);
  const ps = spawnSpots(b, 0, crew.length + (o.allies?.length ?? 0), rng);
  crew.forEach((c, i) => {
    const u = unitFromCharacter(c);
    [u.x, u.y] = ps[i];
    b.units.push(u);
  });
  o.allies?.forEach((u, i) => {
    [u.x, u.y] = ps[crew.length + i];
    b.units.push(u);
  });
  const es = spawnSpots(b, 1, o.enemies.length, rng);
  o.enemies.forEach((e, i) => {
    b.idc++;
    const u = unitFromEnemy(e.id, e.tier, `e${b.idc}`);
    if (!es[i]) return;
    [u.x, u.y] = es[i];
    b.units.push(u);
  });
  // name duplicates: "Burnlad", "Burnlad II"...
  const counts: Record<string, number> = {};
  for (const u of b.units.filter((x) => x.team === 1)) {
    counts[u.name] = (counts[u.name] ?? 0) + 1;
    if (counts[u.name] > 1) u.name = `${u.name} ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][counts[u.name]] ?? counts[u.name]}`;
  }
  beginPhase(b, 0, true);
  emit(b, { t: 'phase', phase: 'player', turn: 1 });
  return b;
}

export interface GangSpec {
  name: string;
  troops: number;
  quality: number;
  ranged: boolean;
  faction: string;
  portrait: string;
  leader?: Character;
  controlled: boolean;
  team: 0 | 1;
  leaderStat?: number;
}

export interface ArmySetup {
  gangs: GangSpec[];
  battlemap: string;
  context: BattleContext;
  seed: number;
  fortified?: boolean;
}

export function createArmyBattle(o: ArmySetup): Battle {
  const rng = Rng.fromSeed(o.seed);
  const b: Battle = {
    w: ARMY_W, h: ARMY_H, tiles: makeTiles(ARMY_W, ARMY_H), units: [], turn: 1, phase: 'player', mode: 'army',
    battlemap: o.battlemap, log: [], result: null, context: o.context, rng: rng.state, events: [], idc: 0,
  };
  const reserved = (x: number, _y: number) => x <= 2 || x >= b.w - 3;
  let tries = 0;
  do {
    b.tiles = makeTiles(b.w, b.h);
    placeProps(b, rng, 0.07, reserved, o.fortified ? 5 : 0);
    tries++;
  } while (!connected(b, [[1, Math.floor(b.h / 2)], [b.w - 2, Math.floor(b.h / 2)]]) && tries < 10);
  for (const team of [0, 1] as const) {
    const gs = o.gangs.filter((g) => g.team === team);
    const spots = spawnSpots(b, team, gs.length, rng);
    gs.forEach((g, i) => {
      if (!spots[i]) return;
      b.idc++;
      const lead = g.leader;
      const hardStat = lead ? effStat(lead, 'hard') : g.leaderStat ?? 0;
      const u: Unit = {
        id: lead ? lead.id : `g${b.idc}`, name: g.name, team, controlled: g.controlled, portrait: lead ? lead.portrait : g.portrait,
        x: spots[i][0], y: spots[i][1], hp: g.troops, maxHp: g.troops, armor: 0, move: g.ranged ? 3 : 4,
        stats: lead ? { cool: effStat(lead, 'cool'), hard: hardStat, hot: effStat(lead, 'hot'), sharp: effStat(lead, 'sharp'), weird: effStat(lead, 'weird') }
          : { cool: 0, hard: hardStat, hot: 0, sharp: 0, weird: 0 },
        weapon: 'fists', abilities: lead ? [PLAYBOOKS[lead.playbook].order, 'defend'] : ['defend'], cooldowns: {}, status: {},
        ai: g.ranged ? 'ranged' : 'melee', charId: undefined, moved: false, acted: false, hitBonus: 0, healBonus: 0, hardHarm: 0,
        evasive: false, xp: 0, loot: 0, gang: true, troops: g.troops, maxTroops: g.troops, quality: g.quality, ranged: g.ranged,
        faction: g.faction, leaderName: lead?.name,
      };
      if (lead && lead.playbook === 'roadboss') u.quality = (u.quality ?? 0) + 1;
      b.units.push(u);
    });
  }
  const t0 = b.units.filter((u) => u.team === 0).reduce((a, u) => a + (u.troops ?? 0), 0);
  const t1 = b.units.filter((u) => u.team === 1).reduce((a, u) => a + (u.troops ?? 0), 0);
  b.startTroops = [t0, t1];
  beginPhase(b, 0, true);
  emit(b, { t: 'phase', phase: 'player', turn: 1 });
  return b;
}
