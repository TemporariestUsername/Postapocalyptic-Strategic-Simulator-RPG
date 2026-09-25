import { STATS, type Stat } from '../engine/dice';
import type { Rng } from '../engine/rng';
import { ITEMS } from '../data/items';
import { BIOS, EPITHETS, FIRST_NAMES } from '../data/names';
import { PLAYBOOKS, PLAYBOOK_IDS } from '../data/playbooks';
import type { Character } from './types';

export const MAX_LEVEL = 8;
export const MAX_STAT = 3;

export function xpForLevel(level: number): number {
  // xp needed to go from `level` to `level + 1`
  return 60 + (level - 1) * 45;
}

export function makeCharacter(
  id: string, name: string, playbook: string, portrait: string, isPlayer: boolean, level = 1, rng?: Rng,
): Character {
  const pb = PLAYBOOKS[playbook];
  const c: Character = {
    id, name, playbook, portrait, level: 1, xp: 0, stats: { ...pb.stats }, hp: 1,
    weapon: pb.weapon, armor: pb.armor, gear: pb.gear ?? null, isPlayer, statPoints: 0,
    bio: rng ? rng.pick(BIOS[playbook]) : BIOS[playbook][0], kills: 0,
  };
  for (let l = 1; l < level; l++) {
    c.level++;
    // NPCs auto-assign: raise the best stats first
    const order = [...STATS].sort((a, b) => c.stats[b] - c.stats[a]);
    const s = order.find((st) => c.stats[st] < MAX_STAT);
    if (s) c.stats[s]++;
  }
  c.hp = maxHp(c);
  return c;
}

export function gearBonus(c: Character, stat: Stat): number {
  let b = 0;
  for (const slot of [c.armor, c.gear]) {
    if (!slot) continue;
    const it = ITEMS[slot];
    b += it.armor?.bonus?.[stat] ?? 0;
    b += it.gear?.bonus?.[stat] ?? 0;
  }
  return b;
}

export function effStat(c: Character, stat: Stat): number {
  return c.stats[stat] + gearBonus(c, stat);
}

export function maxHp(c: Character): number {
  const pb = PLAYBOOKS[c.playbook];
  const armorHp = c.armor ? ITEMS[c.armor].armor?.hp ?? 0 : 0;
  return pb.hp + (c.level - 1) * 3 + Math.max(0, c.stats.hard) * 2 + armorHp;
}

export function armorOf(c: Character): number {
  let a = c.armor ? ITEMS[c.armor].armor?.armor ?? 0 : 0;
  if (c.gear) a += ITEMS[c.gear].gear?.armor ?? 0;
  return a;
}

export function moveOf(c: Character): number {
  const pb = PLAYBOOKS[c.playbook];
  const m = c.armor ? ITEMS[c.armor].armor?.move ?? 0 : 0;
  return Math.max(2, pb.move + m);
}

export function abilitiesOf(c: Character): string[] {
  const pb = PLAYBOOKS[c.playbook];
  const out = [pb.abilities[0]];
  if (c.level >= 3) out.push(pb.abilities[1]);
  if (c.level >= 5) out.push(pb.abilities[2]);
  return out;
}

/** Returns number of levels gained. */
export function grantXp(c: Character, xp: number): number {
  if (c.level >= MAX_LEVEL) return 0;
  c.xp += xp;
  let gained = 0;
  while (c.level < MAX_LEVEL && c.xp >= xpForLevel(c.level)) {
    c.xp -= xpForLevel(c.level);
    c.level++;
    gained++;
    c.statPoints++;
    c.hp = Math.min(maxHp(c), c.hp + 3);
  }
  if (c.level >= MAX_LEVEL) c.xp = 0;
  return gained;
}

export function hireCost(c: Character): number {
  const pb = PLAYBOOKS[c.playbook];
  return Math.round(pb.hireBase * (1 + (c.level - 1) * 0.55));
}

export function portraitsFor(playbook: string): string[] {
  return [1, 2, 3, 4].map((i) => `portraits/${playbook}_${i}`);
}

export function randomName(rng: Rng): string {
  return rng.chance(0.55) ? `${rng.pick(FIRST_NAMES)} ${rng.pick(EPITHETS)}` : rng.pick(FIRST_NAMES);
}

/** Generate a recruit that does not duplicate portraits already in use. */
export function randomRecruit(rng: Rng, id: string, level: number, usedPortraits: Set<string>, playbook?: string): Character {
  const pbs = playbook ? [playbook] : rng.shuffle([...PLAYBOOK_IDS]);
  for (const pb of pbs) {
    const free = portraitsFor(pb).filter((p) => !usedPortraits.has(p));
    if (!free.length) continue;
    const portrait = rng.pick(free);
    usedPortraits.add(portrait);
    return makeCharacter(id, randomName(rng), pb, portrait, false, level, rng);
  }
  const pb = rng.pick(PLAYBOOK_IDS);
  return makeCharacter(id, randomName(rng), pb, rng.pick(portraitsFor(pb)), false, level, rng);
}
