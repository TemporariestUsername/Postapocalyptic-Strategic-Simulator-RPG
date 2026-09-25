/** Army battles: the bridge between the strategic simulation and the tactical battlefield. */
import { FACTIONS, PLAYER_FACTION_ID } from '../data/factions';
import { NEIGHBORS, REGION_BY_ID } from '../data/regions';
import { createArmyBattle, type GangSpec } from '../combat/setup';
import type { Battle, BattleContext } from '../combat/types';
import { captureRegion, launchArmy, removeArmy, adjustRelation, checkElimination } from './sim';
import type { Army, GameState } from './types';
import { factionColor, factionName, news, playerSide, regionName, rngOf, troopName } from './util';
import { rankOf } from './actions';

const MAX_GANGS = 6;
const MAX_BATTLE_TROOPS = 200;

const TROOP_PORTRAIT: Record<string, string> = {
  cinder: 'enemies/burnlad', choir: 'enemies/cultist', iron: 'enemies/militia', pump: 'enemies/pumpthug', rats: 'enemies/ratman',
  dust: 'enemies/raider', salt: 'enemies/saltguard', free: 'enemies/scav', player: 'enemies/scav',
};
const RANGED_FACTIONS = new Set(['iron', 'salt', 'cinder']);

function quality(fid: string, region?: string): number {
  if (fid === PLAYER_FACTION_ID || fid === 'free') return 0;
  let q = FACTIONS[fid].discipline >= 1.4 ? 1 : 0;
  if (region === 'kiln') q += 1;
  return q;
}

function splitGangs(total: number, count: number): number[] {
  const out: number[] = [];
  let left = total;
  for (let i = 0; i < count; i++) {
    const n = Math.round(left / (count - i));
    out.push(n);
    left -= n;
  }
  return out;
}

export interface ArmyBattlePlan {
  region: string;
  attacker: string;
  defender: string;
  playerAttacking: boolean;
  /** friendly troops (not counting the warband) and the enemy's */
  allied: number;
  enemy: number;
  armyId?: string;
}

/**
 * Build the battle. All gangs on the player's side are player-controlled; crew members each lead one.
 * Large armies are scaled down to at most MAX_BATTLE_TROOPS per side and scaled back afterwards.
 */
export function buildArmyBattle(s: GameState, plan: ArmyBattlePlan): Battle {
  const rng = rngOf(s);
  const ourFaction = plan.playerAttacking ? plan.attacker : plan.defender;
  const enemyFaction = plan.playerAttacking ? plan.defender : plan.attacker;
  const ours = s.warband + plan.allied;
  const scale0 = Math.max(1, ours / MAX_BATTLE_TROOPS);
  const scale1 = Math.max(1, plan.enemy / MAX_BATTLE_TROOPS);
  const t0 = Math.max(4, Math.round(ours / scale0));
  const t1 = Math.max(4, Math.round(plan.enemy / scale1));
  const leaders = s.crew.filter((c) => c.hp > 0);
  const n0 = Math.min(MAX_GANGS, Math.max(Math.min(leaders.length, Math.ceil(t0 / 6)), Math.ceil(t0 / 30), 1));
  const n1 = Math.min(MAX_GANGS, Math.max(2, Math.ceil(t1 / 25)));
  const gangs: GangSpec[] = [];
  splitGangs(t0, n0).forEach((troops, i) => {
    const lead = leaders[i];
    gangs.push({
      name: lead ? `${lead.name}'s ${i === 0 && s.warband ? 'Warband' : troopName(ourFaction === PLAYER_FACTION_ID ? 'player' : ourFaction)}` : `${troopName(ourFaction)} ${['I', 'II', 'III', 'IV', 'V', 'VI'][i]}`,
      troops, quality: quality(ourFaction), ranged: !lead ? i % 2 === 1 : lead.playbook === 'gunhand' || lead.playbook === 'wrencher',
      faction: ourFaction, portrait: TROOP_PORTRAIT[ourFaction] ?? 'enemies/scav', leader: lead, controlled: true, team: 0, leaderStat: 1,
    });
  });
  splitGangs(t1, n1).forEach((troops, i) => {
    gangs.push({
      name: `${troopName(enemyFaction)} ${['I', 'II', 'III', 'IV', 'V', 'VI'][i]}`,
      troops, quality: quality(enemyFaction, plan.region), ranged: RANGED_FACTIONS.has(enemyFaction) && i % 3 === 2,
      faction: enemyFaction, portrait: TROOP_PORTRAIT[enemyFaction] ?? 'enemies/scav', controlled: false, team: 1, leaderStat: enemyFaction === 'free' ? 0 : 1,
    });
  });
  const context: BattleContext = {
    type: 'army', armyId: plan.armyId, region: plan.region, attacker: plan.attacker, defender: plan.defender, playerAttacking: plan.playerAttacking,
    canFlee: true, title: `Battle of ${regionName(plan.region)}`, music: 'army',
  };
  const b = createArmyBattle({ gangs, battlemap: REGION_BY_ID[plan.region].battlemap, context, seed: rng.int(1, 1e9), fortified: !plan.playerAttacking ? false : REGION_BY_ID[plan.region].fort >= 1.3 });
  b.scale = [scale0, scale1];
  b.warbandShare = ours ? s.warband / ours : 0;
  return b;
}

export interface ArmyOutcome {
  lines: string[];
  won: boolean;
  finalBoss?: boolean;
  founded?: boolean;
}

/** Apply a finished army battle back onto the strategic map. */
export function applyArmyBattle(s: GameState, b: Battle): ArmyOutcome {
  const ctx = b.context;
  const rid = ctx.region!;
  const [sc0, sc1] = b.scale ?? [1, 1];
  const share = b.warbandShare ?? 1;
  const survivors = (team: 0 | 1) => b.units.filter((u) => u.gang && u.team === team).reduce((a, u) => a + (u.dead ? Math.floor((u.troops ?? 0) * 0.5) : (u.troops ?? 0)), 0);
  const ours = Math.round(survivors(0) * sc0);
  const theirs = Math.round(survivors(1) * sc1);
  const won = b.result === 'win';
  const lines: string[] = [];
  const army = ctx.armyId ? s.armies.find((a) => a.id === ctx.armyId) : undefined;
  if (army) removeArmy(s, army);
  s.flags.marching = false;
  s.warband = Math.max(0, Math.round(ours * share));
  const alliedLeft = Math.max(0, ours - s.warband);
  // heroes whose gang broke are wounded
  for (const u of b.units) if (u.gang && u.team === 0 && u.dead && u.leaderName) {
    const c = s.crew.find((x) => x.name === u.leaderName);
    if (c) { c.hp = 1; lines.push(`${c.name} was wounded when their gang broke.`); }
  }
  const side = playerSide(s) ?? PLAYER_FACTION_ID;
  s.stats.battles++;
  if (won) s.stats.wins++;

  if (ctx.playerAttacking) {
    if (won) {
      const newOwner = side;
      if (rid === 'kiln' && s.factions.cinder.leaderAlive) {
        s.regions.kiln.garrison = Math.max(0, theirs);
        lines.push('The gates of the Kiln are breached! The Burnt King waits within.');
        return { lines, won, finalBoss: true };
      }
      const founding = newOwner === PLAYER_FACTION_ID && !s.playerFaction;
      if (founding) {
        s.playerFaction = { name: (s.flags.holdName as string) || `${s.crew[0].name}'s Hold`, color: '#f2e6cf', capital: rid };
      }
      const old = s.regions[rid].owner;
      captureRegion(s, rid, newOwner, Math.max(5, alliedLeft + (newOwner === PLAYER_FACTION_ID ? Math.round(s.warband * 0.4) : 0)));
      if (newOwner === PLAYER_FACTION_ID) s.warband = Math.round(s.warband * 0.6);
      s.stats.regionsTaken++;
      if (old !== 'free' && s.factions[old]) adjustRelation(s, 'player', old, -25);
      if (s.pledged && newOwner === s.pledged) {
        s.merit += 30;
        lines.push('+30 merit');
      }
      lines.push(`${regionName(rid)} is taken for ${factionName(s, newOwner)}.`);
      return { lines, won, founded: founding };
    }
    lines.push(`The assault on ${regionName(rid)} fails. The survivors fall back.`);
    s.regions[rid].garrison = Math.max(3, theirs);
    if (army && s.regions[army.from].owner === army.faction) s.regions[army.from].garrison += alliedLeft;
    s.location = army ? army.from : s.location;
    return { lines, won };
  }
  // defending
  if (won) {
    s.regions[rid].garrison = Math.max(5, alliedLeft);
    lines.push(`${regionName(rid)} holds! The ${factionName(s, ctx.attacker!)} host is broken.`);
    news(s, `With your help, ${regionName(rid)} throws back ${factionName(s, ctx.attacker!)}.`, 'war', { region: rid });
    if (s.pledged && s.regions[rid].owner === s.pledged) { s.merit += 20; lines.push('+20 merit'); }
    if (s.factions[ctx.attacker!]) adjustRelation(s, 'player', ctx.attacker!, -10);
    return { lines, won };
  }
  captureRegion(s, rid, ctx.attacker!, Math.max(5, theirs));
  const flee = NEIGHBORS[rid].find((n) => s.regions[n].owner !== ctx.attacker) ?? NEIGHBORS[rid][0];
  s.location = flee;
  lines.push(`${regionName(rid)} falls. You escape to ${regionName(flee)}.`);
  return { lines, won };
}

// ------------------------------------------------------------------------------ player-initiated war

/** Troops a friendly faction contributes from the region the player stands in. */
export function availableGarrison(s: GameState, rid: string): number {
  const r = s.regions[rid];
  return Math.max(0, r.garrison - 10);
}

export function canCommand(s: GameState): boolean {
  if (s.playerFaction) return true;
  return !!s.pledged && rankOf(s).id === 'warboss';
}

/** Targets the player may attack from their location. */
export function attackTargets(s: GameState): string[] {
  const here = s.location;
  const side = playerSide(s);
  return NEIGHBORS[here].filter((n) => {
    const o = s.regions[n].owner;
    return o !== side && !(s.factions[o]?.coalition && s.pledged && s.factions[s.pledged]?.coalition);
  });
}

/** Warboss / warlord: order a march from the current region with the warband. */
export function orderAttack(s: GameState, target: string, troops: number): Army {
  const side = playerSide(s)!;
  const from = s.location;
  const a = launchArmy(s, side, from, target, troops, 0, true);
  s.flags.marching = a.id;
  s.travel = { path: [target], dayInLeg: 0, legDays: a.daysLeft, from };
  return a;
}

/** Seize the region the player stands in (independent drifters found their own hold this way). */
export function seizePlan(s: GameState, rid: string): ArmyBattlePlan {
  const side = playerSide(s) ?? PLAYER_FACTION_ID;
  return { region: rid, attacker: side, defender: s.regions[rid].owner, playerAttacking: true, allied: 0, enemy: s.regions[rid].garrison };
}

export function joinArmy(s: GameState, a: Army): void {
  a.withPlayer = true;
  s.flags.marching = a.id;
  s.travel = { path: [a.to], dayInLeg: 0, legDays: a.daysLeft, from: s.location };
}

export function planForArmy(s: GameState, a: Army, playerAttacking: boolean): ArmyBattlePlan {
  if (playerAttacking) {
    return { region: a.to, attacker: a.faction, defender: s.regions[a.to].owner, playerAttacking: true, allied: a.troops, enemy: s.regions[a.to].garrison, armyId: a.id };
  }
  return { region: a.to, attacker: a.faction, defender: s.regions[a.to].owner, playerAttacking: false, allied: s.regions[a.to].garrison, enemy: a.troops, armyId: a.id };
}

/** The final assault on the Kiln: coalition warlords send fighters to join you. */
export function kilnAssaultPlan(s: GameState): ArmyBattlePlan {
  let allied = 0;
  for (const f of Object.values(s.factions)) if (f.coalition && f.alive) allied += 25;
  const side = playerSide(s) ?? PLAYER_FACTION_ID;
  return { region: 'kiln', attacker: side, defender: 'cinder', playerAttacking: true, allied, enemy: s.regions.kiln.garrison };
}

export function muster(s: GameState, rid: string, n: number): boolean {
  const cost = n * 4;
  if (s.barter < cost || s.regions[rid].owner !== PLAYER_FACTION_ID) return false;
  s.barter -= cost;
  s.regions[rid].garrison += n;
  return true;
}

export function garrisonTransfer(s: GameState, rid: string, toGarrison: number): void {
  const r = s.regions[rid];
  if (r.owner !== PLAYER_FACTION_ID) return;
  if (toGarrison > 0) {
    const n = Math.min(toGarrison, s.warband);
    s.warband -= n;
    r.garrison += n;
  } else {
    const n = Math.min(-toGarrison, Math.max(0, r.garrison - 5));
    r.garrison -= n;
    s.warband += n;
  }
}

export function killOzmyr(s: GameState): void {
  const f = s.factions.cinder;
  f.leaderAlive = false;
  news(s, 'The Burnt King is dead. The fires of the Kiln are going out.', 'fall', { faction: 'cinder' });
  // his empire shatters: holdings revert to free holds or neighbors
  for (const r of Object.values(s.regions)) if (r.owner === 'cinder') {
    r.owner = r.id === 'kiln' ? (playerSide(s) ?? 'free') : 'free';
    r.garrison = Math.round(r.garrison * 0.3);
  }
  checkElimination(s, 'cinder');
}

export { factionColor };
