import type { Battle } from '../combat/types';
import { grantXp, maxHp } from './characters';
import { fxBarter, fxItem, fxRep, fxWarband, pickLoot, tierFor } from './scenes';
import { completeJob } from './jobs';
import { applyArmyBattle, killOzmyr } from './war';
import type { GameState } from './types';
import { news, rngOf } from './util';

export interface BattleSummary {
  result: 'win' | 'lose' | 'fled';
  lines: string[];
  xp: number;
  levelUps: string[];
  deaths: string[];
  /** what should happen next */
  next: 'world' | 'delve' | 'final' | 'victory' | 'death' | 'afterRaid' | 'founded';
}

export function applyBattle(s: GameState, b: Battle, items: Record<string, number>): BattleSummary {
  const result = (b.result ?? 'fled') as 'win' | 'lose' | 'fled';
  const ctx = b.context;
  const lines: string[] = [];
  const levelUps: string[] = [];
  const deaths: string[] = [];
  // consumables used in battle
  for (const [k, v] of Object.entries(items)) {
    if (v > 0) s.stash[k] = v;
    else delete s.stash[k];
  }

  if (b.mode === 'army') {
    const out = applyArmyBattle(s, b);
    lines.push(...out.lines);
    const xp = result === 'win' ? 45 : 15;
    for (const c of s.crew) if (grantXp(c, xp) > 0) levelUps.push(c.name);
    if (result === 'win') lines.push(fxBarter(s, 40 + tierFor(s) * 20));
    let next: BattleSummary['next'] = 'world';
    if (out.finalBoss) next = 'final';
    else if (out.founded) next = 'founded';
    return { result, lines, xp, levelUps, deaths, next };
  }

  s.stats.battles++;
  // sync crew state from units
  for (const u of b.units) {
    if (!u.charId || u.summon) continue;
    const c = s.crew.find((x) => x.id === u.charId);
    if (!c) continue;
    c.kills += u.kills ?? 0;
    s.stats.kills += u.kills ?? 0;
    if (u.dead) {
      deaths.push(c.name);
    } else if (u.downed) {
      c.hp = 1;
      lines.push(`${c.name} was dragged off the field, barely alive.`);
    } else c.hp = Math.min(maxHp(c), Math.max(1, u.hp));
  }
  const pcDied = deaths.includes(s.crew[0].name);
  if (pcDied) {
    s.ended = 'death';
    return { result, lines, xp: 0, levelUps, deaths, next: 'death' };
  }
  s.crew = s.crew.filter((c) => !deaths.includes(c.name));
  for (const d of deaths) news(s, `${d} fell in battle and was buried by the road.`, 'player');

  if (result === 'lose') {
    // the crew is beaten but survives, robbed and battered
    for (const c of s.crew) c.hp = Math.max(1, Math.round(maxHp(c) * 0.25));
    const lost = Math.round(s.barter * 0.3);
    s.barter -= lost;
    lines.push(`Beaten and left for dead, you crawl away. You lost ${lost} barter.`);
    if (ctx.type === 'boss') {
      s.ended = 'death';
      return { result, lines, xp: 0, levelUps, deaths, next: 'death' };
    }
    if (ctx.type === 'delve') s.delve = null;
    return { result, lines, xp: 0, levelUps, deaths, next: 'world' };
  }
  if (result === 'fled') {
    lines.push('You escape with your lives.');
    if (ctx.type === 'delve') s.delve = null;
    return { result, lines, xp: 0, levelUps, deaths, next: 'world' };
  }

  // victory
  s.stats.wins++;
  const enemies = b.units.filter((u) => u.team === 1);
  const xp = Math.round(enemies.reduce((a, u) => a + u.xp, 0) / Math.max(1, Math.sqrt(s.crew.length)));
  for (const c of s.crew) if (grantXp(c, xp) > 0) levelUps.push(c.name);
  const loot = enemies.reduce((a, u) => a + u.loot, 0);
  if (loot) lines.push(fxBarter(s, loot));
  const rng = rngOf(s);
  if (rng.chance(0.35 + enemies.length * 0.05)) lines.push(fxItem(s, pickLoot(s, Math.min(4, 1 + tierFor(s)))));
  if (rng.chance(0.3)) lines.push(fxItem(s, rng.pick(['bandage', 'stim', 'molotov', 'bandage'])));

  let next: BattleSummary['next'] = 'world';
  switch (ctx.type) {
    case 'tutorial':
      next = 'afterRaid';
      break;
    case 'job': {
      const j = s.jobs.find((x) => x.id === ctx.ref);
      if (j && j.state === 'active') {
        lines.push(`Job complete: ${j.title}`);
        lines.push(...completeJob(s, j));
      }
      break;
    }
    case 'delve':
      next = 'delve';
      break;
    case 'boss':
      killOzmyr(s);
      s.ended = 'victory';
      next = 'victory';
      break;
    case 'encounter':
      if (ctx.ref === 'convoy') {
        lines.push(fxWarband(s, 8), fxRep(s, 'cinder', -15));
        for (const f of ['choir', 'iron', 'salt', 'dust']) fxRep(s, f, 4);
        lines.push('Freed prisoners join your warband');
      }
      if (ctx.ref === 'robcaravan') lines.push(fxRep(s, 'salt', -20), fxBarter(s, 60));
      break;
    case 'patrol':
      break;
  }
  return { result, lines, xp, levelUps, deaths, next };
}
