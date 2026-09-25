import { ABILITIES } from '../data/playbooks';
import {
  abilityReady, attackPreview, canAttackFrom, doAttack, doMove, isMelee, useAbility, validAbilityTargets, weaponRange,
} from './battle';
import type { Battle, Unit } from './types';
import { active, cheb, coverAgainst, distanceField, effTeam, enemiesOf, reachable, tilesInRadius, unitAt } from './grid';

interface Plan {
  score: number;
  x: number;
  y: number;
  kind: 'attack' | 'ability' | 'move';
  target?: Unit;
  ability?: string;
  tx?: number;
  ty?: number;
}

function targetsFor(b: Battle, u: Unit): Unit[] {
  if (u.status.puppet) {
    // Puppeted units turn on their own side.
    const own = active(b).filter((o) => o.team === u.team && o.id !== u.id);
    return own.length ? own : enemiesOf(b, u);
  }
  return enemiesOf(b, u);
}

function expected(b: Battle, u: Unit, t: Unit, fx: number, fy: number): number {
  const pv = attackPreview(b, u, t, { hit: 0, harm: 0 }, fx, fy);
  const pWeak = pv.pHit - pv.pStrong;
  let ev = pWeak * pv.dmgWeak + pv.pStrong * pv.dmgStrong;
  const hp = t.gang ? (t.troops ?? 1) : t.hp;
  if (pv.dmgStrong >= hp) ev += 4 * pv.pStrong;
  if (pv.dmgWeak >= hp) ev += 3 * pWeak;
  if (t.charId) ev *= 1.1; // prefer heroes over summons
  if (t.boss) ev *= 0.9;
  return ev;
}

function tileSafety(b: Battle, u: Unit, x: number, y: number, foes: Unit[]): number {
  let s = 0;
  for (const f of foes) {
    const c = coverAgainst(b, x, y, f.x, f.y);
    s += c * 0.6;
    const d = cheb(x, y, f.x, f.y);
    if (!isMelee(u) && d <= 1) s -= 1.2;
  }
  return s / Math.max(1, foes.length);
}

export function aiAct(b: Battle, u: Unit): void {
  if (u.dead || u.downed || b.result) return;
  if (u.acted && u.moved) return;
  const foes = targetsFor(b, u);
  if (!foes.length) return;

  const reach = u.moved || u.move === 0 ? new Map([[`${u.x},${u.y}`, { cost: 0, prev: null }]]) : reachable(b, u, u.move);
  const plans: Plan[] = [];
  const melee = isMelee(u);

  for (const key of reach.keys()) {
    const [x, y] = key.split(',').map(Number);
    const moveCost = reach.get(key)!.cost * 0.03;
    const safety = u.ai === 'beast' || melee ? 0 : tileSafety(b, u, x, y, foes);
    if (!u.acted) {
      for (const t of foes) {
        if (!canAttackFrom(b, u, x, y, t)) continue;
        plans.push({ score: expected(b, u, t, x, y) + safety - moveCost, x, y, kind: 'attack', target: t });
      }
      // abilities (evaluated from the current tile only, to keep the AI cheap and readable)
      if (x === u.x && y === u.y && !u.gang) {
        for (const id of u.abilities) {
          if (!abilityReady(u, id)) continue;
          const a = ABILITIES[id];
          const { units } = validAbilityTargets(b, u, id);
          if (id === 'mindlash') for (const t of units) plans.push({ score: 3.2 + (t.hp <= 4 ? 3 : 0), x, y, kind: 'ability', ability: id, target: t });
          if (id === 'maelstrom' || id === 'brainburn') {
            for (const f of foes) {
              if (cheb(u.x, u.y, f.x, f.y) > a.range) continue;
              let hits = 0, friendly = 0;
              for (const [tx, ty] of tilesInRadius(b, f.x, f.y, 1)) {
                const o = unitAt(b, tx, ty);
                if (!o || o.dead) continue;
                if (effTeam(o) === effTeam(u)) friendly++; else hits++;
              }
              if (id === 'brainburn') friendly = 0;
              if (cheb(u.x, u.y, f.x, f.y) <= 1 && id === 'maelstrom') friendly++;
              plans.push({ score: hits * 3 - friendly * 4, x, y, kind: 'ability', ability: id, tx: f.x, ty: f.y });
            }
          }
          if (id === 'warcry') {
            const n = foes.filter((f) => cheb(u.x, u.y, f.x, f.y) <= 3).length;
            if (n >= 2) plans.push({ score: n * 1.6, x, y, kind: 'ability', ability: id });
          }
        }
      }
    }
  }

  plans.sort((a, b2) => b2.score - a.score);
  const best = plans[0];
  if (best && best.score > 0.3) {
    if (best.x !== u.x || best.y !== u.y) doMove(b, u, best.x, best.y);
    if (u.dead || u.downed || b.result) return;
    if (best.kind === 'attack' && best.target && !best.target.dead && canAttackFrom(b, u, u.x, u.y, best.target)) {
      doAttack(b, u, best.target);
    } else if (best.kind === 'ability' && best.ability) {
      useAbility(b, u, best.ability, { unit: best.target, x: best.tx, y: best.ty });
    }
    return;
  }

  // No attack possible: advance toward the nearest foe (ranged units look for firing positions).
  if (!u.moved && u.move > 0) {
    let bestTile: [number, number] | null = null;
    let bestScore = Infinity;
    const fields = foes.slice(0, 4).map((f) => distanceField(b, f.x, f.y));
    const range = weaponRange(u);
    for (const key of reach.keys()) {
      const [x, y] = key.split(',').map(Number);
      let d = Infinity;
      for (const fld of fields) d = Math.min(d, fld[y * b.w + x]);
      let score = d;
      if (!melee && range > 2) score = Math.abs(d - Math.min(range - 1, 5)) - tileSafety(b, u, x, y, foes);
      if (score < bestScore) {
        bestScore = score;
        bestTile = [x, y];
      }
    }
    if (bestTile && (bestTile[0] !== u.x || bestTile[1] !== u.y)) doMove(b, u, bestTile[0], bestTile[1]);
  }
  if (u.dead || u.downed || b.result) return;
  // after moving, try once more to attack from the new tile
  if (!u.acted) {
    let tgt: Unit | undefined;
    let ev = 0;
    for (const t of targetsFor(b, u)) {
      if (!canAttackFrom(b, u, u.x, u.y, t)) continue;
      const e = expected(b, u, t, u.x, u.y);
      if (e > ev) { ev = e; tgt = t; }
    }
    if (tgt) doAttack(b, u, tgt);
    else if (!u.gang && u.abilities.includes('defend')) {
      useAbility(b, u, 'defend', {});
    }
  }
  // puppet status only lasts for one action
  if (u.status.puppet) u.status.puppet = 0;
}

/** All AI-driven units of a team act in sequence (closest to the enemy first). */
export function runAi(b: Battle, team: 0 | 1, controlled: boolean | null): void {
  const units = b.units.filter((u) => !u.dead && !u.downed && u.team === team && (controlled === null || u.controlled === controlled));
  const foesAll = units.length ? enemiesOf(b, units[0]) : [];
  const nearest = (u: Unit) => Math.min(...foesAll.map((f) => cheb(u.x, u.y, f.x, f.y)), 99);
  units.sort((a, c) => nearest(a) - nearest(c));
  for (const u of units) {
    if (b.result) break;
    aiAct(b, u);
  }
}
