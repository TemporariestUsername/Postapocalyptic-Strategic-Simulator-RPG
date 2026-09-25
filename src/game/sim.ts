/**
 * The living world: every warlord pursues its own ambitions whether the player acts or not.
 * Monthly: income, recruitment, diplomacy, war decisions. Daily: armies march and battles resolve.
 */
import { FACTIONS, FACTION_IDS, PLAYER_FACTION_ID } from '../data/factions';
import { NEIGHBORS, REGION_BY_ID, travelDays } from '../data/regions';
import type { Rng } from '../engine/rng';
import type { Army, GameState } from './types';
import { clamp, factionName, news, nextId, regionName, regionsOf, rngOf, troopName, troopsOf } from './util';

export const HOSTILE = -10;
const MAX_GARRISON = 260;

const DIFF = {
  easy: { cinderLevy: 0.7, cinderAggro: 0.85 },
  normal: { cinderLevy: 1.0, cinderAggro: 1.0 },
  hard: { cinderLevy: 1.3, cinderAggro: 1.15 },
};

export function relation(s: GameState, a: string, b: string): number {
  if (a === b) return 100;
  if (a === 'free' || b === 'free') return -20;
  if (a === PLAYER_FACTION_ID) return s.factions[b] ? s.factions[b].rep : 0;
  if (b === PLAYER_FACTION_ID) return s.factions[a] ? s.factions[a].rep : 0;
  return s.factions[a]?.relations[b] ?? 0;
}

export function adjustRelation(s: GameState, a: string, b: string, delta: number): void {
  if (a === PLAYER_FACTION_ID && s.factions[b]) return void (s.factions[b].rep = clamp(s.factions[b].rep + delta, -100, 100));
  if (b === PLAYER_FACTION_ID && s.factions[a]) return void (s.factions[a].rep = clamp(s.factions[a].rep + delta, -100, 100));
  const fa = s.factions[a], fb = s.factions[b];
  if (!fa || !fb) return;
  fa.relations[b] = clamp((fa.relations[b] ?? 0) + delta, -100, 100);
  fb.relations[a] = clamp((fb.relations[a] ?? 0) + delta, -100, 100);
}

export function atWar(s: GameState, a: string, b: string): boolean {
  if (a === b) return false;
  if (a === 'free' || b === 'free') return true;
  const fa = s.factions[a], fb = s.factions[b];
  if (fa?.coalition && fb?.coalition) return false;
  if ((a === 'cinder' && fb?.coalition) || (b === 'cinder' && fa?.coalition)) return true;
  return relation(s, a, b) < HOSTILE;
}

export function yearsElapsed(s: GameState): number {
  return s.day / 360;
}

function capitalOf(s: GameState, f: string): string | null {
  if (f === PLAYER_FACTION_ID) return s.playerFaction?.capital ?? null;
  const def = FACTIONS[f];
  if (s.regions[def.capital]?.owner === f) return def.capital;
  const own = regionsOf(s, f);
  if (!own.length) return null;
  return own.sort((a, b) => REGION_BY_ID[b].wealth - REGION_BY_ID[a].wealth)[0];
}

function isBorder(s: GameState, rid: string): boolean {
  const owner = s.regions[rid].owner;
  return NEIGHBORS[rid].some((n) => s.regions[n].owner !== owner);
}

function threatTo(s: GameState, rid: string): number {
  const owner = s.regions[rid].owner;
  let t = 0;
  for (const n of NEIGHBORS[rid]) {
    const o = s.regions[n].owner;
    if (o !== owner && atWar(s, owner, o)) t += s.regions[n].garrison;
  }
  for (const a of s.armies) if (a.to === rid) t += a.troops * 2;
  return t;
}

export function defensePower(s: GameState, rid: string): number {
  const r = s.regions[rid];
  const def = REGION_BY_ID[rid];
  const disc = r.owner === 'free' || r.owner === PLAYER_FACTION_ID ? 1.0 : FACTIONS[r.owner].discipline;
  return (r.garrison + 4) * def.fort * disc;
}

// ---------------------------------------------------------------------------------------- monthly

export function monthlyTick(s: GameState): void {
  const rng = rngOf(s);
  const diff = DIFF[s.difficulty];
  for (const r of Object.values(s.regions)) if (r.sacked > 0) r.sacked--;

  for (const fid of FACTION_IDS) {
    const f = s.factions[fid];
    if (!f.alive) continue;
    const def = FACTIONS[fid];
    const own = regionsOf(s, fid);
    let income = 0;
    for (const rid of own) income += REGION_BY_ID[rid].wealth * (s.regions[rid].sacked ? 0.5 : 1);
    const troops = troopsOf(s, fid);
    const upkeep = troops * 0.12;
    f.treasury += income * (0.6 + def.greed * 0.4) - upkeep;
    // recruitment
    let spend = Math.max(0, f.treasury * (0.35 + (1 - def.greed) * 0.3));
    const cost = fid === 'cinder' ? 2.2 : 3;
    let recruits = Math.floor(spend / cost);
    f.treasury -= recruits * cost;
    if (fid === 'cinder') recruits += Math.round((3 + yearsElapsed(s) * 4.5) * diff.cinderLevy);
    distributeTroops(s, fid, recruits, rng);
    f.treasury = Math.max(0, f.treasury);
  }
  // free holds grow militia slowly
  for (const r of Object.values(s.regions)) if (r.owner === 'free') r.garrison = Math.min(40, r.garrison + 2);

  // player-founded faction income goes to the player's purse
  if (s.playerFaction) {
    let income = 0;
    for (const rid of regionsOf(s, PLAYER_FACTION_ID)) income += REGION_BY_ID[rid].wealth * (s.regions[rid].sacked ? 0.5 : 1);
    const upkeep = Math.round(troopsOf(s, PLAYER_FACTION_ID) * 0.06);
    s.lastIncome = Math.round(income - upkeep);
    s.barter = Math.max(0, s.barter + s.lastIncome);
  }

  diplomacy(s, rng);
  for (const fid of FACTION_IDS) if (s.factions[fid].alive) planWar(s, fid, rng);
}

function distributeTroops(s: GameState, fid: string, n: number, rng: Rng): void {
  if (n <= 0) return;
  const own = regionsOf(s, fid);
  if (!own.length) return;
  const cap = capitalOf(s, fid);
  const weights = own.map((rid) => ({ rid, w: 1 + threatTo(s, rid) / 20 + (rid === cap ? 3 : 0) + (isBorder(s, rid) ? 1 : 0) }));
  for (let i = 0; i < n; i += 5) {
    const t = rng.weighted(weights, (x) => x.w);
    const r = s.regions[t.rid];
    r.garrison = Math.min(MAX_GARRISON, r.garrison + Math.min(5, n - i));
  }
}

function diplomacy(s: GameState, rng: Rng): void {
  const total = Object.keys(s.regions).length;
  const cinderShare = regionsOf(s, 'cinder').length / total;
  for (const a of FACTION_IDS) {
    const fa = s.factions[a];
    if (!fa.alive) continue;
    for (const b of FACTION_IDS) {
      if (b <= a || !s.factions[b].alive) continue;
      let rel = fa.relations[b] ?? 0;
      // drift toward peace very slowly
      rel += rel < 0 ? 1 : rel > 0 ? -1 : 0;
      // everyone hates a rising Cinder Throne
      if ((a === 'cinder' || b === 'cinder') && cinderShare > 0.28) rel -= 4;
      if (a !== 'cinder' && b !== 'cinder' && cinderShare > 0.35) rel += 2;
      if (fa.coalition && s.factions[b].coalition) rel = Math.max(rel, 30);
      fa.relations[b] = clamp(rel, -100, 100);
      s.factions[b].relations[a] = fa.relations[b];
    }
  }
  // border incidents keep things lively
  if (rng.chance(0.35)) {
    const alive = FACTION_IDS.filter((f) => s.factions[f].alive && f !== 'cinder');
    if (alive.length >= 2) {
      const a = rng.pick(alive);
      const neighbors = new Set<string>();
      for (const rid of regionsOf(s, a)) for (const n of NEIGHBORS[rid]) {
        const o = s.regions[n].owner;
        if (o !== a && o !== 'free' && o !== PLAYER_FACTION_ID && o !== 'cinder') neighbors.add(o);
      }
      const list = [...neighbors].filter((b) => !(s.factions[a].coalition && s.factions[b].coalition));
      if (list.length) {
        const b = rng.pick(list);
        const before = relation(s, a, b);
        adjustRelation(s, a, b, -rng.int(12, 28));
        if (before >= HOSTILE && relation(s, a, b) < HOSTILE) {
          news(s, `${factionName(s, a)} and ${factionName(s, b)} trade blood on the border. It is war.`, 'diplo', { faction: a });
        }
      }
    }
  }
  if (rng.chance(0.2)) {
    const alive = FACTION_IDS.filter((f) => s.factions[f].alive && f !== 'cinder');
    const a = rng.pick(alive), b = rng.pick(alive);
    if (a !== b && relation(s, a, b) < HOSTILE) {
      adjustRelation(s, a, b, rng.int(20, 35));
      if (relation(s, a, b) >= HOSTILE) news(s, `${factionName(s, a)} and ${factionName(s, b)} agree to a truce.`, 'diplo', { faction: a });
    }
  }
}

function planWar(s: GameState, fid: string, rng: Rng): void {
  const def = FACTIONS[fid];
  const diff = DIFF[s.difficulty];
  let aggression = def.aggression;
  if (fid === 'cinder') aggression = Math.min(1, (aggression + yearsElapsed(s) * 0.04) * diff.cinderAggro);
  const f = s.factions[fid];
  if (s.day - f.lastAttackDay < (fid === 'cinder' && yearsElapsed(s) < 1 ? 45 : 25)) return;
  const maxAttacks = fid === 'cinder' ? 1 + Math.floor(yearsElapsed(s) / 1.5) : 1;
  const cap = capitalOf(s, fid);
  const options: { from: string; to: string; send: number; score: number }[] = [];
  for (const rid of regionsOf(s, fid)) {
    const r = s.regions[rid];
    const minKeep = rid === cap ? 30 : isBorder(s, rid) ? 12 : 5;
    const avail = r.garrison - minKeep;
    if (avail < 12) continue;
    for (const t of NEIGHBORS[rid]) {
      const tr = s.regions[t];
      if (tr.owner === fid || !atWar(s, fid, tr.owner)) continue;
      if (s.armies.some((a) => a.faction === fid && a.to === t)) continue;
      const defense = defensePower(s, t);
      const send = Math.min(avail, Math.ceil(defense * 1.7 + 8));
      const ratio = send * (def.discipline) / defense;
      if (ratio < 1.25) continue;
      let score = ratio * (REGION_BY_ID[t].wealth / 15) * (0.6 + rng.next() * 0.8);
      if (s.factions[fid].coalition && tr.owner === 'cinder') score *= 1.8;
      if (tr.owner === 'free') {
        // the free holds are left alone at first; Hope's Rest is the player's cradle
        if (s.day < 180 || (t === 'hopesrest' && s.day < 330)) continue;
        score *= 0.7;
      }
      if (t === 'kiln') score *= 0.5;
      options.push({ from: rid, to: t, send, score });
    }
  }
  options.sort((a, b) => b.score - a.score);
  let launched = 0;
  for (const o of options) {
    if (launched >= maxAttacks) break;
    if (!rng.chance(aggression)) continue;
    if (s.regions[o.from].garrison - o.send < 5) continue;
    launchArmy(s, fid, o.from, o.to, o.send, rng.int(0, 12));
    launched++;
  }
  if (launched) f.lastAttackDay = s.day;
}

export function launchArmy(s: GameState, fid: string, from: string, to: string, troops: number, muster = 0, withPlayer = false): Army {
  s.regions[from].garrison -= Math.min(s.regions[from].garrison, troops);
  const days = travelDays(from, to) + muster;
  const army: Army = { id: nextId(s, 'army'), faction: fid, from, to, troops, daysLeft: days, totalDays: days, withPlayer };
  s.armies.push(army);
  const target = s.regions[to].owner;
  if (target !== 'free') adjustRelation(s, fid, target, -15);
  news(s, `${factionName(s, fid)} marches on ${regionName(to)} with ${troops} ${troopName(fid)}.`, 'war', { faction: fid, region: to });
  return army;
}

// ---------------------------------------------------------------------------------------- daily

/** Advance armies one day. Returns armies that arrived and need the player's involvement. */
export function dailyTick(s: GameState): Army[] {
  const needPlayer: Army[] = [];
  const rng = rngOf(s);
  for (const a of [...s.armies]) {
    a.daysLeft--;
    if (a.daysLeft > 0) continue;
    const target = s.regions[a.to];
    if (target.owner === a.faction) {
      // reinforcement arriving at a friendly region
      target.garrison = Math.min(MAX_GARRISON, target.garrison + a.troops);
      removeArmy(s, a);
      continue;
    }
    if (a.withPlayer || playerDefends(s, a)) {
      needPlayer.push(a);
      continue;
    }
    resolveAutoBattle(s, a, rng);
  }
  return needPlayer;
}

/** Whether the player is standing in the attacked region and would be asked to defend it. */
export function playerDefends(s: GameState, a: Army): boolean {
  if (s.travel || s.location !== a.to) return false;
  const owner = s.regions[a.to].owner;
  if (owner === PLAYER_FACTION_ID) return true;
  if (s.pledged && owner === s.pledged) return true;
  if (owner === 'free' && a.to === 'hopesrest') return true;
  return false;
}

export function removeArmy(s: GameState, a: Army): void {
  s.armies = s.armies.filter((x) => x.id !== a.id);
}

export function resolveAutoBattle(s: GameState, a: Army, rng: Rng): void {
  const rid = a.to;
  const r = s.regions[rid];
  const defender = r.owner;
  const atkDisc = a.faction === PLAYER_FACTION_ID ? 1.1 : FACTIONS[a.faction].discipline;
  const atk = a.troops * atkDisc * (0.8 + rng.next() * 0.4);
  const dfn = defensePower(s, rid) * (0.8 + rng.next() * 0.4);
  removeArmy(s, a);
  if (atk > dfn) {
    const survivors = Math.max(3, Math.round(a.troops * (1 - 0.6 * (dfn / atk))));
    if (rid === 'kiln' && s.factions.cinder.leaderAlive) {
      // The Kiln's gates cannot be breached without the player; the assault bleeds the garrison instead.
      r.garrison = Math.max(20, Math.round(r.garrison * 0.55));
      retreat(s, a.faction, a.from, Math.round(survivors * 0.6));
      news(s, `${factionName(s, a.faction)} storms the Kiln and breaks against its gates. The Burnt King's garrison is bloodied.`, 'war', { faction: a.faction, region: rid });
      return;
    }
    const fled = Math.round(r.garrison * 0.15);
    captureRegion(s, rid, a.faction, survivors);
    if (defender !== 'free' && fled > 0) retreatToNearest(s, defender, rid, fled);
  } else {
    const defLoss = atk / dfn;
    r.garrison = Math.max(3, Math.round(r.garrison * (1 - 0.5 * defLoss)));
    retreat(s, a.faction, a.from, Math.round(a.troops * 0.3));
    news(s, `${regionName(rid)} holds! ${factionName(s, a.faction)}'s assault is thrown back.`, 'war', { faction: defender, region: rid });
  }
}

function retreat(s: GameState, fid: string, to: string, troops: number): void {
  if (s.regions[to].owner === fid) s.regions[to].garrison = Math.min(MAX_GARRISON, s.regions[to].garrison + troops);
  else retreatToNearest(s, fid, to, troops);
}

function retreatToNearest(s: GameState, fid: string, from: string, troops: number): void {
  const n = NEIGHBORS[from].find((x) => s.regions[x].owner === fid);
  if (n) s.regions[n].garrison = Math.min(MAX_GARRISON, s.regions[n].garrison + troops);
}

export function captureRegion(s: GameState, rid: string, newOwner: string, garrison: number): void {
  const r = s.regions[rid];
  const old = r.owner;
  r.owner = newOwner;
  r.garrison = garrison;
  r.sacked = 2;
  // armies marching on a region now owned by their own faction become reinforcements; others continue
  const verb = newOwner === 'cinder' ? 'burns and takes' : 'seizes';
  news(s, `${factionName(s, newOwner)} ${verb} ${regionName(rid)} from ${factionName(s, old)}.`, newOwner === 'cinder' ? 'burn' : 'capture', { faction: newOwner, region: rid });
  if (old !== 'free' && old !== PLAYER_FACTION_ID) checkElimination(s, old);
  if (old === PLAYER_FACTION_ID && regionsOf(s, PLAYER_FACTION_ID).length === 0) {
    news(s, `Your hold has fallen. You are a drifter once more.`, 'fall');
    s.playerFaction = null;
  } else if (old === PLAYER_FACTION_ID && s.playerFaction && s.playerFaction.capital === rid) {
    s.playerFaction.capital = regionsOf(s, PLAYER_FACTION_ID)[0];
  }
}

export function checkElimination(s: GameState, fid: string): void {
  const f = s.factions[fid];
  if (!f.alive) return;
  if (regionsOf(s, fid).length === 0) {
    f.alive = false;
    f.leaderAlive = false;
    s.armies = s.armies.filter((a) => a.faction !== fid);
    news(s, `${FACTIONS[fid].leader} is dead. ${FACTIONS[fid].name} is no more.`, 'fall', { faction: fid });
    if (s.pledged === fid) {
      s.pledged = null;
      s.merit = 0;
      s.pending.push({ kind: 'message', title: 'Your Warlord Has Fallen', text: `${FACTIONS[fid].leader} is dead and ${FACTIONS[fid].name} is scattered to the wind. Your oath dies with them. You are free, and alone.`, image: 'events/battlefield' });
    }
  }
}

/** Count of regions controlled by the Cinder Throne. */
export function cinderShare(s: GameState): number {
  return regionsOf(s, 'cinder').length / Object.keys(s.regions).length;
}
