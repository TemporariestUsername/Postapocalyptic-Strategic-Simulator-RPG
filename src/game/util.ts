import { Rng } from '../engine/rng';
import { FACTIONS, INDEPENDENT, PLAYER_FACTION_ID } from '../data/factions';
import { REGION_BY_ID } from '../data/regions';
import type { GameState, NewsItem, NewsKind } from './types';

export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const START_YEAR = 57;
export const MONTH_NAMES = ['Frostgrit', 'Thaw', 'Mudmonth', 'Bloom', 'Dustwind', 'Burnmonth', 'Scorch', 'Swelter', 'Ember', 'Ashfall', 'Smog', 'Longdark'];

export function calendar(day: number) {
  const month = Math.floor(day / DAYS_PER_MONTH);
  return {
    year: START_YEAR + Math.floor(month / MONTHS_PER_YEAR),
    month: (month % MONTHS_PER_YEAR),
    monthName: MONTH_NAMES[month % MONTHS_PER_YEAR],
    dom: (day % DAYS_PER_MONTH) + 1,
  };
}

export function fmtDate(day: number): string {
  const c = calendar(day);
  return `${c.dom} ${c.monthName}, ${c.year} AB`;
}

export function fmtDuration(days: number): string {
  if (days <= 0) return 'now';
  const y = Math.floor(days / 360);
  const m = Math.floor((days % 360) / 30);
  const d = days % 30;
  const parts = [];
  if (y) parts.push(`${y}y`);
  if (m) parts.push(`${m}m`);
  if (!y && d) parts.push(`${d}d`);
  return parts.join(' ') || '0d';
}

export function rngOf(s: GameState): Rng {
  return new Rng(s.rng);
}

export function nextId(s: GameState, prefix: string): string {
  s.idCounter++;
  return `${prefix}${s.idCounter}`;
}

export function news(s: GameState, text: string, kind: NewsKind, extra: Partial<NewsItem> = {}): void {
  s.news.unshift({ day: s.day, text, kind, ...extra });
  if (s.news.length > 200) s.news.length = 200;
}

export function factionName(s: GameState, id: string): string {
  if (id === PLAYER_FACTION_ID) return s.playerFaction?.name ?? 'Your Hold';
  if (id === 'free') return INDEPENDENT.name;
  return FACTIONS[id]?.name ?? id;
}

/** Faction name without a leading article, for use mid-sentence ("the Cinder Throne"). */
export function bareName(s: GameState, id: string): string {
  return factionName(s, id).replace(/^The /, '');
}

export function factionShort(s: GameState, id: string): string {
  if (id === PLAYER_FACTION_ID) return s.playerFaction?.name ?? 'You';
  if (id === 'free') return INDEPENDENT.short;
  return FACTIONS[id]?.short ?? id;
}

export function factionColor(s: GameState, id: string): string {
  if (id === PLAYER_FACTION_ID) return s.playerFaction?.color ?? '#f2e6cf';
  if (id === 'free') return INDEPENDENT.color;
  return FACTIONS[id]?.color ?? '#888';
}

export function troopName(id: string): string {
  if (id === PLAYER_FACTION_ID) return 'Warband';
  if (id === 'free') return INDEPENDENT.troopName;
  return FACTIONS[id]?.troopName ?? 'Troops';
}

export function enemyTypesOf(id: string): string[] {
  if (id === 'free' || id === PLAYER_FACTION_ID) return INDEPENDENT.enemyTypes;
  return FACTIONS[id].enemyTypes;
}

export function regionName(id: string): string {
  return REGION_BY_ID[id]?.name ?? id;
}

export function regionsOf(s: GameState, faction: string): string[] {
  return Object.values(s.regions).filter((r) => r.owner === faction).map((r) => r.id);
}

export function troopsOf(s: GameState, faction: string): number {
  let t = 0;
  for (const r of Object.values(s.regions)) if (r.owner === faction) t += r.garrison;
  for (const a of s.armies) if (a.faction === faction) t += a.troops;
  return t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function player(s: GameState) {
  return s.crew[0];
}

/** The faction whose interests the player currently fights for (pledged or own). */
export function playerSide(s: GameState): string | null {
  if (s.playerFaction) return PLAYER_FACTION_ID;
  return s.pledged;
}
