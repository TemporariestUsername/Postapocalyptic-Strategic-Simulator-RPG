/**
 * Narrative scenes: an illustrated card with text and choices. Choices may roll a move
 * (2d6 + the best crew member's stat) and resolve into effects and/or a fight.
 */
import { roll2d6, type Roll, type Stat } from '../engine/dice';
import type { BattleContext } from '../combat/types';
import { ITEMS } from '../data/items';
import { PLAYBOOKS } from '../data/playbooks';
import { adjustRelation } from './sim';
import { effStat, grantXp, maxHp } from './characters';
import type { Character, GameState } from './types';
import { factionShort, rngOf } from './util';

export interface FightSpec {
  enemies: { id: string; tier: number }[];
  battlemap: string;
  context: BattleContext;
}

export interface SceneResult {
  text: string;
  effects?: string[];
  fight?: FightSpec;
  next?: Scene;
  image?: string;
}

export interface SceneChoice {
  label: string;
  stat?: Stat;
  bonus?: number;
  hint?: string;
  cost?: { barter?: number; rations?: number };
  disabled?: string | false;
  resolve: (s: GameState, roll: Roll | null) => SceneResult;
}

export interface Scene {
  id: string;
  title: string;
  image: string;
  portrait?: string;
  speaker?: string;
  text: string;
  choices: SceneChoice[];
  music?: string;
}

/** The crew member best suited to a move (Apocalypse World "help": the best one leads). */
export function bestFor(s: GameState, stat: Stat): Character {
  const alive = s.crew.filter((c) => c.hp > 0);
  return alive.reduce((a, c) => (effStat(c, stat) > effStat(a, stat) ? c : a), alive[0] ?? s.crew[0]);
}

export function moveBonus(s: GameState, stat: Stat): number {
  const c = bestFor(s, stat);
  let b = effStat(c, stat);
  if (stat === 'weird' && c.playbook === 'mindbender') b += 1;
  return b;
}

export function rollMove(s: GameState, stat: Stat, bonus = 0): Roll {
  return roll2d6(rngOf(s), moveBonus(s, stat) + bonus, stat);
}

// ------------------------------------------------------------------------------ effect helpers
// Each helper mutates state and returns a short human-readable summary line.

export function fxBarter(s: GameState, n: number): string {
  if (n > 0 && s.crew.some((c) => c.playbook === 'wrencher' && c.hp > 0)) n = Math.round(n * 1.5);
  s.barter = Math.max(0, s.barter + n);
  return `${n >= 0 ? '+' : ''}${n} barter`;
}

export function fxRations(s: GameState, n: number): string {
  s.rations = Math.max(0, s.rations + n);
  return `${n >= 0 ? '+' : ''}${n} rations`;
}

export function fxHarmAll(s: GameState, n: number): string {
  for (const c of s.crew) if (c.hp > 0) c.hp = Math.max(1, c.hp - n);
  return `${n} harm to every crew member`;
}

export function fxHarmOne(s: GameState, n: number): string {
  const alive = s.crew.filter((c) => c.hp > 0);
  const c = rngOf(s).pick(alive);
  c.hp = Math.max(1, c.hp - n);
  return `${c.name} takes ${n} harm`;
}

export function fxHealAll(s: GameState, n: number): string {
  for (const c of s.crew) c.hp = Math.min(maxHp(c), c.hp + n);
  return `Crew heals ${n}`;
}

export function fxXp(s: GameState, n: number): string {
  for (const c of s.crew) if (c.hp > 0) grantXp(c, n);
  return `+${n} XP`;
}

export function fxItem(s: GameState, id: string, n = 1): string {
  s.stash[id] = (s.stash[id] ?? 0) + n;
  return `Found: ${ITEMS[id].name}${n > 1 ? ` ×${n}` : ''}`;
}

export function fxRep(s: GameState, faction: string, n: number): string {
  if (!s.factions[faction]) return '';
  adjustRelation(s, 'player', faction, n);
  return `${factionShort(s, faction)} reputation ${n >= 0 ? '+' : ''}${n}`;
}

export function fxWarband(s: GameState, n: number): string {
  s.warband = Math.max(0, s.warband + n);
  return `${n >= 0 ? '+' : ''}${n} warband troops`;
}

export function tierFor(s: GameState, bump = 0): number {
  return Math.max(0, Math.min(4, Math.floor(s.day / 220) + bump));
}

export function pickLoot(s: GameState, maxTier: number): string {
  const rng = rngOf(s);
  const pool = Object.values(ITEMS).filter((i) => i.tier > 0 && i.tier <= maxTier && i.kind !== 'quest');
  return rng.pick(pool).id;
}

export function crewHas(s: GameState, playbook: string): boolean {
  return s.crew.some((c) => c.playbook === playbook && c.hp > 0);
}

export function statLabel(s: GameState, stat: Stat): string {
  const c = bestFor(s, stat);
  return `${c.name} (${PLAYBOOKS[c.playbook].name})`;
}
