/** Everything the player can do outside of combat, plus the day-by-day loop. */
import { FACTIONS, PLAYER_FACTION_ID } from '../data/factions';
import { ITEMS } from '../data/items';
import { NEIGHBORS, REGION_BY_ID, travelDays } from '../data/regions';
import { ENCOUNTERS } from '../data/encounters';
import { hireCost, maxHp } from './characters';
import { expireJobs, generateJobs } from './jobs';
import { cinderShare, dailyTick, monthlyTick, relation } from './sim';
import { refreshRecruits } from './state';
import type { GameState } from './types';
import { RANKS } from './types';
import { news, regionName, rngOf, DAYS_PER_MONTH } from './util';

export const MAX_CREW = 4;

// ------------------------------------------------------------------------------ travel

export function findPath(s: GameState, from: string, to: string): string[] | null {
  if (from === to) return [];
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const open = new Set([from]);
  while (open.size) {
    let cur = '';
    let best = Infinity;
    for (const r of open) if (dist[r] < best) { best = dist[r]; cur = r; }
    open.delete(cur);
    if (cur === to) break;
    for (const n of NEIGHBORS[cur]) {
      const d = dist[cur] + legDays(s, cur, n);
      if (d < (dist[n] ?? Infinity)) {
        dist[n] = d;
        prev[n] = cur;
        open.add(n);
      }
    }
  }
  if (dist[to] === undefined) return null;
  const path: string[] = [];
  let c = to;
  while (c !== from) {
    path.unshift(c);
    c = prev[c];
  }
  return path;
}

export function legDays(s: GameState, a: string, b: string): number {
  const bonus = s.crew.some((c) => c.gear && ITEMS[c.gear].gear?.travel) ? 1 : 0;
  return Math.max(1, travelDays(a, b) - bonus);
}

export function pathDays(s: GameState, path: string[]): number {
  let d = 0;
  let cur = s.location;
  for (const p of path) {
    d += legDays(s, cur, p);
    cur = p;
  }
  return d;
}

export function rationsPerDay(s: GameState): number {
  return Math.max(1, Math.ceil(s.crew.length / 2) + (s.warband > 0 ? Math.ceil(s.warband / 20) : 0));
}

export function startTravel(s: GameState, dest: string): boolean {
  const path = findPath(s, s.location, dest);
  if (!path || !path.length) return false;
  s.travel = { path, dayInLeg: 0, legDays: legDays(s, s.location, path[0]), from: s.location };
  return true;
}

export interface DayResult {
  arrived: boolean;
  stop: boolean;
  newMonth: boolean;
}

/** Advance the world one day. The UI calls this repeatedly while traveling or resting. */
export function advanceDay(s: GameState, resting = false): DayResult {
  const rng = rngOf(s);
  s.day++;
  const res: DayResult = { arrived: false, stop: false, newMonth: false };

  // supplies
  const need = rationsPerDay(s);
  if (s.rations >= need) s.rations -= need;
  else {
    s.rations = 0;
    for (const c of s.crew) c.hp = Math.max(1, c.hp - 1);
    if (!s.flags.starvingWarned) {
      s.flags.starvingWarned = true;
      s.pending.push({ kind: 'message', title: 'Out of Rations', text: 'Your packs are empty. The crew is starving and weakening every day. Buy rations at any market.', image: 'events/duststorm' });
      res.stop = true;
    }
    if (s.warband > 0) s.warband = Math.max(0, s.warband - Math.ceil(s.warband * 0.05));
  }
  if (s.rations > 0) s.flags.starvingWarned = false;

  // natural healing
  const healer = s.crew.some((c) => c.playbook === 'sawbones' && c.hp > 0);
  const heal = resting ? (healer ? 3 : 2) : (s.day % 2 === 0 ? 1 : 0);
  for (const c of s.crew) if (c.hp > 0) c.hp = Math.min(maxHp(c), c.hp + heal);

  // the world moves
  const arrivals = dailyTick(s);
  for (const a of arrivals) {
    if (a.withPlayer) s.pending.push({ kind: 'assault', armyId: a.id });
    else s.pending.push({ kind: 'defend', armyId: a.id });
    res.stop = true;
  }
  if (s.day % DAYS_PER_MONTH === 0) {
    res.newMonth = true;
    const before = new Set(s.armies.map((a) => a.id));
    monthlyTick(s);
    generateJobs(s);
    if (Math.floor(s.day / DAYS_PER_MONTH) % 2 === 0) refreshRecruits(s, rng);
    expireJobs(s);
    monthlyPlayer(s);
    // call to arms: your warlord marches from where you stand
    if (s.pledged && !s.travel) {
      for (const a of s.armies) {
        if (before.has(a.id) || a.faction !== s.pledged || a.from !== s.location) continue;
        s.pending.push({ kind: 'callToArms', armyId: a.id });
        res.stop = true;
        break;
      }
    }
  }
  checkEndConditions(s);
  if (s.ended) {
    res.stop = true;
    return res;
  }

  // travel progress and road encounters
  if (s.travel && !resting) {
    const t = s.travel;
    t.dayInLeg++;
    const dest = t.path[0];
    const marching = !!s.flags.marching;
    if (!marching && t.dayInLeg < t.legDays) {
      const danger = Math.max(REGION_BY_ID[dest].danger, REGION_BY_ID[t.from].danger);
      const owner = s.regions[dest].owner;
      if (owner !== 'free' && owner !== PLAYER_FACTION_ID && s.factions[owner] && s.factions[owner].rep <= -40 && rng.chance(0.3)) {
        s.pending.push({ kind: 'patrol', faction: owner, region: dest });
        res.stop = true;
      } else if (rng.chance(danger * 0.45) && s.day > 3) {
        const pool = ENCOUNTERS.filter((e) => !e.when || e.when(s, dest));
        const e = rng.weighted(pool, (x) => x.weight);
        s.pending.push({ kind: 'encounter', eventId: e.id, region: dest });
        res.stop = true;
      }
    }
    if (t.dayInLeg >= t.legDays) {
      s.location = t.path.shift()!;
      t.from = s.location;
      t.dayInLeg = 0;
      if (t.path.length) t.legDays = legDays(s, s.location, t.path[0]);
      else {
        s.travel = null;
        res.arrived = true;
        res.stop = true;
      }
    }
  }
  return res;
}

function monthlyPlayer(s: GameState): void {
  if (s.pledged) {
    const r = rankOf(s);
    s.barter += r.stipend;
    const prev = (s.flags.rankIdx as number) ?? 0;
    const idx = RANKS.findIndex((x) => x.id === r.id);
    if (idx > prev) {
      s.flags.rankIdx = idx;
      s.pending.push({ kind: 'message', title: 'Promotion', text: `${FACTIONS[s.pledged].leader} names you ${r.name} of ${FACTIONS[s.pledged].name}. Your stipend rises to ${r.stipend} barter a month and more fighters will follow you.${r.id === 'warboss' ? ' As Warboss you may now order attacks from any of your warlord\'s holds.' : ''}`, portrait: FACTIONS[s.pledged].portrait });
    }
  }
  const left = s.burnDay - s.day;
  if (s.quest.burnRevealed) {
    for (const [days, text] of [[360, 'One year remains before the Burnt King wakes the Kiln.'], [180, 'Six months remain. The ground near the Kiln has begun to tremble.'], [60, 'Two months. The sky over the Kiln glows violet at night.'], [30, 'One month. The Maelstrom howls without pause. It is almost time.']] as const) {
      if (left <= days && left > days - 30) {
        news(s, text, 'burn');
        s.pending.push({ kind: 'message', title: 'The Great Burn Draws Near', text, image: 'events/maelstrom' });
      }
    }
  }
}

export function checkEndConditions(s: GameState): void {
  if (s.ended) return;
  if (s.day >= s.burnDay && s.factions.cinder.leaderAlive) {
    s.ended = 'defeat';
    s.flags.defeatReason = 'burn';
  } else if (cinderShare(s) >= 0.7) {
    s.ended = 'defeat';
    s.flags.defeatReason = 'conquest';
  }
}

// ------------------------------------------------------------------------------ economy

export function priceMod(s: GameState, region: string): number {
  let m = 1;
  const owner = s.regions[region].owner;
  const rep = owner === PLAYER_FACTION_ID ? 50 : owner === 'free' ? 10 : s.factions[owner]?.rep ?? 0;
  if (rep >= 40) m -= 0.12;
  else if (rep >= 15) m -= 0.05;
  else if (rep <= -20) m += 0.25;
  if (s.crew.some((c) => c.playbook === 'siren' && c.hp > 0)) m -= 0.15;
  return m;
}

export function buyPrice(s: GameState, region: string, itemId: string): number {
  return Math.max(1, Math.round(ITEMS[itemId].price * priceMod(s, region)));
}

export function sellPrice(itemId: string): number {
  const it = ITEMS[itemId];
  const base = it.price || (it.kind === 'weapon' ? 220 : it.kind === 'armor' ? 250 : 150);
  return Math.max(1, Math.round(base * 0.4));
}

export function rationPrice(s: GameState, region: string): number {
  return Math.max(1, Math.round(1 * priceMod(s, region) * 10)) / 10;
}

export function buy(s: GameState, region: string, itemId: string): boolean {
  const p = buyPrice(s, region, itemId);
  if (s.barter < p) return false;
  s.barter -= p;
  s.stash[itemId] = (s.stash[itemId] ?? 0) + 1;
  return true;
}

export function sell(s: GameState, itemId: string): boolean {
  if (!s.stash[itemId] || ITEMS[itemId].kind === 'quest') return false;
  s.stash[itemId]--;
  if (!s.stash[itemId]) delete s.stash[itemId];
  s.barter += sellPrice(itemId);
  return true;
}

export function buyRations(s: GameState, region: string, n: number): boolean {
  const cost = Math.ceil(n * rationPrice(s, region));
  if (s.barter < cost) return false;
  s.barter -= cost;
  s.rations += n;
  return true;
}

export function equip(s: GameState, charId: string, itemId: string): boolean {
  const c = s.crew.find((x) => x.id === charId);
  const it = ITEMS[itemId];
  if (!c || !s.stash[itemId]) return false;
  const slot = it.kind === 'weapon' ? 'weapon' : it.kind === 'armor' ? 'armor' : it.kind === 'gear' ? 'gear' : null;
  if (!slot) return false;
  const old = c[slot];
  s.stash[itemId]--;
  if (!s.stash[itemId]) delete s.stash[itemId];
  if (old && old !== 'fists') s.stash[old] = (s.stash[old] ?? 0) + 1;
  (c as unknown as Record<string, string | null>)[slot] = itemId;
  c.hp = Math.min(c.hp, maxHp(c));
  return true;
}

export function unequip(s: GameState, charId: string, slot: 'weapon' | 'armor' | 'gear'): void {
  const c = s.crew.find((x) => x.id === charId);
  if (!c) return;
  const old = c[slot];
  if (!old || old === 'fists') return;
  s.stash[old] = (s.stash[old] ?? 0) + 1;
  if (slot === 'weapon') c.weapon = 'fists';
  else c[slot] = null;
  c.hp = Math.min(c.hp, maxHp(c));
}

export function useOutOfCombat(s: GameState, itemId: string, charId: string): boolean {
  const it = ITEMS[itemId];
  if (!s.stash[itemId] || !it.use) return false;
  if (it.use.effect === 'medkit') {
    for (const c of s.crew) c.hp = Math.min(maxHp(c), c.hp + 5);
  } else if (it.use.effect === 'heal') {
    const c = s.crew.find((x) => x.id === charId);
    if (!c) return false;
    c.hp = Math.min(maxHp(c), c.hp + it.use.amount);
  } else return false;
  s.stash[itemId]--;
  if (!s.stash[itemId]) delete s.stash[itemId];
  return true;
}

export function clinicCost(s: GameState): number {
  let missing = 0;
  for (const c of s.crew) missing += maxHp(c) - c.hp;
  const healer = s.crew.some((c) => c.playbook === 'sawbones');
  return Math.ceil(missing * (healer ? 0.75 : 1.5));
}

export function clinicHeal(s: GameState): boolean {
  const cost = clinicCost(s);
  if (cost <= 0 || s.barter < cost) return false;
  s.barter -= cost;
  for (const c of s.crew) c.hp = maxHp(c);
  return true;
}

export function recruitCost(s: GameState, charId: string, region: string): number {
  const c = s.recruits[region]?.find((x) => x.id === charId);
  if (!c) return 0;
  const siren = s.crew.some((x) => x.playbook === 'siren');
  return Math.round(hireCost(c) * (siren ? 0.8 : 1));
}

export function hire(s: GameState, region: string, charId: string): boolean {
  const list = s.recruits[region];
  const c = list?.find((x) => x.id === charId);
  if (!c || s.crew.length >= MAX_CREW) return false;
  const cost = recruitCost(s, charId, region);
  if (s.barter < cost) return false;
  s.barter -= cost;
  s.recruits[region] = list.filter((x) => x.id !== charId);
  s.crew.push(c);
  return true;
}

export function dismiss(s: GameState, charId: string): void {
  const c = s.crew.find((x) => x.id === charId);
  if (!c || c.isPlayer) return;
  s.crew = s.crew.filter((x) => x.id !== charId);
}

// ------------------------------------------------------------------------------ warband & allegiance

export function rankOf(s: GameState) {
  let r: (typeof RANKS)[number] = RANKS[0];
  for (const x of RANKS) if (s.merit >= x.merit) r = x;
  return r;
}

export function warbandCap(s: GameState): number {
  const pc = s.crew[0];
  let cap = 12 + pc.level * 4 + Math.max(0, pc.stats.hot) * 8;
  if (s.pledged) cap += rankOf(s).warband;
  if (s.playerFaction) cap += 40;
  if (s.crew.some((c) => c.playbook === 'roadboss')) cap = Math.round(cap * 1.5);
  return cap;
}

export function troopCost(s: GameState): number {
  return s.crew.some((c) => c.playbook === 'prophet') ? 3 : 4;
}

export function hireTroops(s: GameState, n: number): boolean {
  n = Math.min(n, warbandCap(s) - s.warband);
  const cost = n * troopCost(s);
  if (n <= 0 || s.barter < cost) return false;
  s.barter -= cost;
  s.warband += n;
  return true;
}

export function canPledge(s: GameState, fid: string): string | null {
  if (s.playerFaction) return 'You rule your own hold now.';
  if (s.pledged === fid) return 'Already sworn.';
  if (fid === 'cinder' && s.quest.burnRevealed) return 'You know what the Burnt King intends.';
  if (s.factions[fid].rep < 15) return `Requires reputation 15 (you have ${s.factions[fid].rep}).`;
  return null;
}

export function pledge(s: GameState, fid: string): void {
  if (s.pledged && s.pledged !== fid) s.factions[s.pledged].rep = Math.max(-100, s.factions[s.pledged].rep - 30);
  s.pledged = fid;
  s.merit = 0;
  s.flags.rankIdx = 0;
  s.factions[fid].rep = Math.min(100, s.factions[fid].rep + 10);
  news(s, `You swear your blade to ${FACTIONS[fid].leader} of ${FACTIONS[fid].name}.`, 'player', { faction: fid });
}

export function renounce(s: GameState): void {
  if (!s.pledged) return;
  s.factions[s.pledged].rep = Math.max(-100, s.factions[s.pledged].rep - 30);
  news(s, `You renounce your oath to ${FACTIONS[s.pledged].leader}.`, 'player', { faction: s.pledged });
  s.pledged = null;
  s.merit = 0;
}

export function isHostileTo(s: GameState, fid: string): boolean {
  return relation(s, 'player', fid) <= -40;
}

export function regionLabel(id: string): string {
  return regionName(id);
}
