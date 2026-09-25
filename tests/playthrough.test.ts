/**
 * A crude bot that plays BURNLANDS headlessly through the same game-logic APIs the UI uses,
 * making semi-random choices. It exists to shake out runtime errors across many code paths.
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { roll2d6 } from '../src/engine/dice';
import { newGame } from '../src/game/state';
import {
  advanceDay, buyRations, canPledge, hire, hireTroops, pledge, recruitCost, startTravel, warbandCap,
} from '../src/game/actions';
import { encounterScene, patrolScene } from '../src/data/encounters';
import { storyScene, tapeScene } from '../src/data/story';
import { FACTIONS } from '../src/data/factions';
import { REGION_BY_ID, REGIONS, NEIGHBORS } from '../src/data/regions';
import { activeJobs, acceptJob, jobsAt, jobScene } from '../src/game/jobs';
import { delveFight, delveReward, delveRoomScene, startDelve } from '../src/game/delve';
import { createSkirmish } from '../src/combat/setup';
import { autoPlay } from '../src/combat/turn';
import { applyBattle } from '../src/game/outcome';
import { buildArmyBattle, joinArmy, kilnAssaultPlan, planForArmy, seizePlan, type ArmyBattlePlan } from '../src/game/war';
import { resolveAutoBattle } from '../src/game/sim';
import type { Scene, FightSpec } from '../src/game/scenes';
import { moveBonus } from '../src/game/scenes';
import type { GameState } from '../src/game/types';
import { STATS } from '../src/engine/dice';
import { MAX_STAT } from '../src/game/characters';

function fight(s: GameState, f: FightSpec, r: Rng) {
  const b = createSkirmish({ crew: s.crew, enemies: f.enemies, battlemap: f.battlemap, context: f.context, seed: r.int(1, 1e9) });
  autoPlay(b, 30);
  if (!b.result) b.result = 'fled';
  return applyBattle(s, b, { ...s.stash });
}

function army(s: GameState, plan: ArmyBattlePlan, r: Rng) {
  const b = buildArmyBattle(s, plan);
  void r;
  autoPlay(b, 30);
  if (!b.result) b.result = 'fled';
  return applyBattle(s, b, { ...s.stash });
}

function playScene(s: GameState, sc: Scene, r: Rng, depth = 0): void {
  if (depth > 5) return;
  const choices = sc.choices.filter((c) => !c.disabled && !(c.cost?.barter && s.barter < c.cost.barter) && !(c.cost?.rations && s.rations < c.cost.rations));
  if (!choices.length) return;
  const c = r.pick(choices);
  const roll = c.stat ? roll2d6(r, moveBonus(s, c.stat) + (c.bonus ?? 0)) : null;
  const res = c.resolve(s, roll);
  if (res.fight) {
    const sum = fight(s, res.fight, r);
    if (sum.next === 'afterRaid') playScene(s, storyScene(s, 'after_raid')!, r, depth + 1);
    if (sum.next === 'final') playScene(s, storyScene(s, 'final')!, r, depth + 1);
  }
  if (res.army) {
    const sum = army(s, res.army, r);
    if (sum.next === 'final') playScene(s, storyScene(s, 'final')!, r, depth + 1);
  }
  if (res.next) playScene(s, res.next, r, depth + 1);
}

function processPending(s: GameState, r: Rng): void {
  let guard = 0;
  while (s.pending.length && !s.ended && guard++ < 20) {
    const p = s.pending.shift()!;
    if (p.kind === 'story') { const sc = storyScene(s, p.id); if (sc) playScene(s, sc, r); }
    else if (p.kind === 'encounter') playScene(s, encounterScene(s, p.eventId, p.region), r);
    else if (p.kind === 'patrol') playScene(s, patrolScene(s, p.faction, p.region), r);
    else if (p.kind === 'callToArms') { const a = s.armies.find((x) => x.id === p.armyId); if (a && r.chance(0.5)) joinArmy(s, a); }
    else if (p.kind === 'defend') {
      const a = s.armies.find((x) => x.id === p.armyId);
      if (a) { if (r.chance(0.6)) army(s, planForArmy(s, a, false), r); else resolveAutoBattle(s, a, r); }
    } else if (p.kind === 'assault') {
      const a = s.armies.find((x) => x.id === p.armyId);
      if (a) { s.location = a.from; const sum = army(s, planForArmy(s, a, true), r); if (sum.next === 'final') playScene(s, storyScene(s, 'final')!, r); }
    }
  }
}

function runDelve(s: GameState, id: string, r: Rng) {
  startDelve(s, id);
  let guard = 0;
  while (s.delve && !s.ended && guard++ < 20) {
    const d = s.delve;
    const room = d.rooms[d.room];
    if (room.type === 'fight' || room.type === 'boss') {
      if (room.type === 'boss' && d.id === 'kiln') { playScene(s, storyScene(s, 'final')!, r); break; }
      const sum = fight(s, delveFight(s, room.type === 'boss'), r);
      if (sum.result !== 'win') { s.delve = null; break; }
      room.done = true;
      if (room.type === 'boss') { delveReward(s); s.delve = null; break; }
    } else playScene(s, delveRoomScene(s), r);
    room.done = true;
    if (s.delve) s.delve.room++;
  }
  s.delve = null;
}

function botTurn(s: GameState, r: Rng) {
  const here = s.location;
  const reg = REGION_BY_ID[here];
  // level ups
  for (const c of s.crew) while (c.statPoints > 0) {
    const st = r.pick(STATS.filter((x) => c.stats[x] < MAX_STAT));
    if (!st) { c.statPoints = 0; break; }
    c.stats[st]++;
    c.statPoints--;
  }
  if (reg.market && s.rations < 25) buyRations(s, here, 30);
  if (reg.bar) {
    for (const rc of [...(s.recruits[here] ?? [])]) if (s.barter > recruitCost(s, rc.id, here) + 40) hire(s, here, rc.id);
    if (s.barter > 150 && s.warband < warbandCap(s)) hireTroops(s, 10);
  }
  for (const j of jobsAt(s, here)) if (activeJobs(s).length < 3 && r.chance(0.6)) acceptJob(s, j.id);
  for (const j of activeJobs(s)) if (j.target === here && j.kind !== 'delve') playScene(s, jobScene(s, j), r);
  const fid = s.regions[here].owner;
  if (FACTIONS[fid]?.capital === here) {
    if (!s.pledged && !canPledge(s, fid) && r.chance(0.3)) pledge(s, fid);
    if (s.quest.tape && !s.factions[fid].coalition && fid !== 'cinder' && !(s.day - ((s.flags[`tape:${fid}`] as number) ?? -99) < 30)) playScene(s, tapeScene(s, fid), r);
  }
  if (reg.delve && !s.regions[here].delveCleared && reg.delve !== 'kiln' && r.chance(0.5)) runDelve(s, reg.delve, r);
  if (here === 'emberroad' && s.quest.stage === 1) playScene(s, storyScene(s, 'tower')!, r);
  if ((here === 'kiln' || NEIGHBORS[here].includes('kiln')) && s.quest.burnRevealed) {
    if (s.crew[0].level < 5) { /* not ready */ } else if (s.quest.keycard && r.chance(0.5)) runDelve(s, 'kiln', r);
    else if (s.warband + kilnAssaultPlan(s).allied >= 30 && r.chance(0.3)) {
      const sum = army(s, kilnAssaultPlan(s), r);
      if (sum.next === 'final') playScene(s, storyScene(s, 'final')!, r);
    }
  }
  if (!s.pledged && s.warband >= 20 && r.chance(0.1) && here !== 'kiln' && s.regions[here].owner !== 'player') army(s, seizePlan(s, here), r);
  if (s.ended) return;
  // travel somewhere
  const jobTargets = activeJobs(s).map((j) => j.target);
  let dest = r.chance(0.6) && jobTargets.length ? r.pick(jobTargets) : r.pick(REGIONS).id;
  if (s.quest.stage === 1) dest = 'emberroad';
  if (dest === here) return void advanceDay(s, true);
  if (!startTravel(s, dest)) return;
  let guard = 0;
  while (s.travel && !s.ended && guard++ < 60) {
    advanceDay(s);
    if (s.pending.length) processPending(s, r);
  }
}

describe('bot playthrough', () => {
  it('plays many campaigns without throwing', () => {
    const summary: string[] = [];
    for (let seed = 1; seed <= 16; seed++) {
      const r = Rng.fromSeed(seed * 7919);
      const pbs = ['gunhand', 'sawbones', 'duelist', 'mindbender', 'prophet', 'roadboss', 'wrencher', 'siren'];
      const pb = pbs[seed % pbs.length];
      const s = newGame({ name: 'Bot', playbook: pb, portrait: `portraits/${pb}_1`, difficulty: seed % 3 === 0 ? 'hard' : 'normal', seed });
      s.pending.push({ kind: 'story', id: 'arrival' });
      let steps = 0;
      while (!s.ended && steps++ < 900 && s.day < 2400) {
        processPending(s, r);
        if (s.ended) break;
        botTurn(s, r);
      }
      expect(s.crew.length).toBeGreaterThan(0);
      summary.push(`${String(seed).padStart(2)} ${pb.padEnd(10)} day ${String(s.day).padStart(4)} end=${s.ended ?? '-'} ${s.flags.defeatReason ?? ''}${s.flags.deathCause ?? ''} lvl=${s.crew[0].level} crew=${s.crew.length} barter=${s.barter} stage=${s.quest.stage} coal=${s.quest.coalition} key=${s.quest.keycard} pledged=${s.pledged ?? '-'} own=${s.playerFaction ? 'Y' : '-'} wins=${s.stats.wins}/${s.stats.battles} delves=${s.stats.delves}`);
    }
    console.log(summary.join('\n'));
  }, 240000);
});
