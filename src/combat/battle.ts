import { chanceAtLeast, roll2d6, type Roll, type Stat } from '../engine/dice';
import { Rng } from '../engine/rng';
import { ITEMS, type WeaponStats } from '../data/items';
import { ABILITIES } from '../data/playbooks';
import type { Battle, BattleEvent, Unit } from './types';
import {
  active, alliesOf, cheb, coverAgainst, dist, effTeam, enemiesOf, hasLos, inBounds, passable, pathTo, reachable, tileAt,
  tilesInRadius, unitAt,
} from './grid';

export function rngOf(b: Battle): Rng {
  return new Rng(b.rng);
}

export function emit(b: Battle, e: BattleEvent): void {
  b.events.push(e);
  if (e.t === 'log') {
    b.log.push(e.text);
    if (b.log.length > 80) b.log.shift();
  }
}

export function log(b: Battle, text: string): void {
  emit(b, { t: 'log', text });
}

export function unitById(b: Battle, id: string): Unit | undefined {
  return b.units.find((u) => u.id === id);
}

export function weaponOf(u: Unit): WeaponStats {
  return ITEMS[u.weapon]?.weapon ?? ITEMS.fists.weapon!;
}

export function weaponRange(u: Unit): number {
  if (u.gang) return u.ranged ? 3 : 1;
  const w = weaponOf(u);
  return w.range;
}

export function isMelee(u: Unit): boolean {
  return weaponRange(u) <= 2 && (u.gang ? !u.ranged : weaponOf(u).range <= 2 && !['pistol', 'rifle', 'shotgun', 'auto', 'bow', 'laser', 'flame'].includes(weaponOf(u).sfx));
}

// ------------------------------------------------------------------------------------ targeting

export function canAttackFrom(b: Battle, u: Unit, x: number, y: number, t: Unit): boolean {
  const r = weaponRange(u);
  if (r <= 1) return cheb(x, y, t.x, t.y) <= 1;
  if (u.gang) return dist(x, y, t.x, t.y) <= r && hasLos(b, x, y, t.x, t.y);
  const w = weaponOf(u);
  if (w.tags.includes('reach')) return cheb(x, y, t.x, t.y) <= 2 && hasLos(b, x, y, t.x, t.y);
  return dist(x, y, t.x, t.y) <= r && hasLos(b, x, y, t.x, t.y);
}

export function canAttack(b: Battle, u: Unit, t: Unit): boolean {
  return canAttackFrom(b, u, u.x, u.y, t);
}

export interface AttackMods {
  hit: number;
  harm: number;
  ap?: boolean;
  label?: string;
  noCounter?: boolean;
}

export interface Preview {
  mods: [string, number][];
  total: number;
  pStrong: number;
  pHit: number;
  dmgWeak: number;
  dmgStrong: number;
  stat: Stat;
}

function statusMod(u: Unit): number {
  let m = 0;
  if (u.status.sermon) m += 1;
  if (u.status.zeal) m += 1;
  if (u.status.warcry) m -= 1;
  return m;
}

export function attackPreview(b: Battle, u: Unit, t: Unit, extra: AttackMods = { hit: 0, harm: 0 }, fromX = u.x, fromY = u.y): Preview {
  const mods: [string, number][] = [];
  if (u.gang) return gangPreview(b, u, t, extra);
  const w = weaponOf(u);
  const stat = w.stat;
  mods.push([stat.toUpperCase(), u.stats[stat]]);
  const d = dist(fromX, fromY, t.x, t.y);
  const melee = w.range <= 2;
  if (w.tags.includes('quick')) mods.push(['Quick', 1]);
  if (w.tags.includes('heavy')) mods.push(['Heavy', -1]);
  if (!melee && u.hitBonus) mods.push(['Scope', u.hitBonus]);
  if (!melee) {
    const cov = coverAgainst(b, t.x, t.y, fromX, fromY);
    if (cov) mods.push([cov === 2 ? 'Full cover' : 'Cover', -cov]);
    if (w.tags.includes('far') && d <= 1) mods.push(['Too close', -1]);
    if (!w.tags.includes('far') && d > Math.ceil(w.range * 0.6)) mods.push(['Long range', -1]);
  }
  if (t.status.defend) mods.push(['Dug in', -1]);
  if (t.evasive) mods.push(['Evasive', -1]);
  const sm = statusMod(u);
  if (sm) mods.push([sm > 0 ? 'Inspired' : 'Shaken', sm]);
  if (extra.hit) mods.push([extra.label ?? 'Bonus', extra.hit]);
  const total = mods.reduce((a, [, v]) => a + v, 0);
  const { weak, strong } = harmFor(u, t, extra, fromX, fromY);
  return { mods, total, pStrong: chanceAtLeast(total, 10), pHit: chanceAtLeast(total, 7), dmgWeak: weak, dmgStrong: strong, stat };
}

function harmFor(u: Unit, t: Unit, extra: AttackMods, fromX: number, fromY: number): { weak: number; strong: number } {
  const w = weaponOf(u);
  let harm = w.harm + extra.harm;
  if (w.stat === 'hard') harm += u.hardHarm;
  if (w.tags.includes('close') && dist(fromX, fromY, t.x, t.y) <= 2) harm += 1;
  const ap = extra.ap || w.tags.includes('ap');
  const armor = ap ? 0 : t.armor + (t.status.defend ? 1 : 0) + (t.status.rally ? 1 : 0);
  const weak = Math.max(1, harm - armor);
  const strong = Math.max(1, harm + 1 + (w.tags.includes('messy') ? 1 : 0) - armor);
  return { weak, strong };
}

// ------------------------------------------------------------------------------------ damage

export function applyDamage(b: Battle, t: Unit, amount: number, kind: 'burn' | 'psychic' | 'blast' | 'normal' = 'normal', killer?: Unit): void {
  if (t.dead || amount <= 0) return;
  if (t.gang) {
    applyCasualties(b, t, amount, killer);
    return;
  }
  if (t.downed) {
    // hitting a downed crew member finishes them
    t.bleedout = Math.max(0, (t.bleedout ?? 1) - 1);
    emit(b, { t: 'damage', unit: t.id, amount, kind });
    if (t.bleedout <= 0) kill(b, t);
    return;
  }
  t.hp = Math.max(0, t.hp - amount);
  emit(b, { t: 'damage', unit: t.id, amount, kind });
  if (t.hp <= 0) {
    if (killer) killer.kills = (killer.kills ?? 0) + 1;
    if (t.charId && !t.summon) {
      t.downed = true;
      t.bleedout = 3;
      t.status = {};
      emit(b, { t: 'downed', unit: t.id });
      log(b, `${t.name} goes down, bleeding out!`);
    } else kill(b, t);
  }
}

function kill(b: Battle, t: Unit): void {
  t.dead = true;
  t.downed = false;
  emit(b, { t: 'death', unit: t.id });
  log(b, t.charId && !t.summon ? `${t.name} has bled out. Dead.` : `${t.name} is down for good.`);
}

export function heal(b: Battle, t: Unit, amount: number): void {
  if (t.dead) return;
  if (t.downed) {
    t.downed = false;
    t.bleedout = undefined;
    t.hp = Math.max(1, Math.min(t.maxHp, amount));
    emit(b, { t: 'revive', unit: t.id });
    log(b, `${t.name} is back on their feet!`);
    return;
  }
  const before = t.hp;
  t.hp = Math.min(t.maxHp, t.hp + amount);
  emit(b, { t: 'heal', unit: t.id, amount: t.hp - before });
}

// ------------------------------------------------------------------------------------ attack

export function doAttack(b: Battle, u: Unit, t: Unit, extra: AttackMods = { hit: 0, harm: 0 }, consumeAction = true): void {
  if (u.gang) return gangAttack(b, u, t, extra, consumeAction);
  const rng = rngOf(b);
  const w = weaponOf(u);
  const shots = w.tags.includes('burst') ? 2 : 1;
  for (let i = 0; i < shots && !t.dead && !(t.downed && !t.charId); i++) {
    if (t.downed && i > 0) break;
    const pv = attackPreview(b, u, t, extra);
    const roll = roll2d6(rng, pv.total, extra.label ?? 'Attack');
    let dmg = 0;
    if (roll.outcome !== 'miss') dmg = roll.outcome === 'strong' ? pv.dmgStrong : pv.dmgWeak;
    if (roll.crit) dmg *= 2;
    const ranged = w.range > 2;
    emit(b, { t: 'attack', from: u.id, to: t.id, sfx: w.sfx, ranged, hit: dmg > 0, dmg, crit: roll.crit, roll });
    const verb = roll.outcome === 'miss' ? 'misses' : roll.crit ? 'CRITS' : roll.outcome === 'strong' ? 'hits hard' : 'hits';
    log(b, `${u.name} ${verb} ${t.name}${dmg ? ` for ${dmg}` : ''} (${roll.dice[0]}+${roll.dice[1]}${roll.mod >= 0 ? '+' : ''}${roll.mod}=${roll.total})`);
    if (dmg > 0) {
      applyDamage(b, t, dmg, 'normal', u);
      if (w.tags.includes('burn') && !t.dead) t.status.burning = 2;
    }
    if (w.tags.includes('area') && roll.outcome !== 'miss') {
      emit(b, { t: 'blast', x: t.x, y: t.y, r: 1, kind: w.sfx === 'flame' ? 'fire' : 'frag' });
      for (const [x, y] of tilesInRadius(b, t.x, t.y, 1)) {
        const o = unitAt(b, x, y);
        if (o && o !== t && o !== u && !o.dead) {
          applyDamage(b, o, Math.max(1, dmg - 1), 'blast', u);
          if (w.tags.includes('burn') && !o.dead) o.status.burning = 2;
        }
      }
    }
    // riposte
    if (t.status.riposte && !t.dead && !t.downed && cheb(u.x, u.y, t.x, t.y) <= 1 && !extra.noCounter) {
      log(b, `${t.name} ripostes!`);
      doAttack(b, t, u, { hit: 0, harm: 0, noCounter: true, label: 'Riposte' }, false);
    }
  }
  if (consumeAction) u.acted = true;
  checkEnd(b);
}

// ------------------------------------------------------------------------------------ movement

export function doMove(b: Battle, u: Unit, x: number, y: number): boolean {
  if (u.moved || u.status.pinned) return false;
  const reach = reachable(b, u, u.move);
  if (!reach.has(`${x},${y}`)) return false;
  const path = pathTo(reach, x, y);
  // overwatch: interrupt movement if an enemy is watching
  let stopAt = path.length - 1;
  let watcher: Unit | undefined;
  for (let i = 1; i < path.length && !watcher; i++) {
    const [px, py] = path[i];
    for (const e of enemiesOf(b, u)) {
      if (!e.status.overwatch) continue;
      const tmp = { ...u, x: px, y: py };
      if (canAttackFrom(b, e, e.x, e.y, tmp as Unit)) {
        watcher = e;
        stopAt = i;
        break;
      }
    }
  }
  const walked = path.slice(0, stopAt + 1);
  u.x = walked[walked.length - 1][0];
  u.y = walked[walked.length - 1][1];
  u.moved = true;
  emit(b, { t: 'move', unit: u.id, path: walked });
  if (watcher) {
    watcher.status.overwatch = false;
    log(b, `${watcher.name} fires from overwatch!`);
    doAttack(b, watcher, u, { hit: 0, harm: 0, label: 'Overwatch' }, false);
  }
  const tile = tileAt(b, u.x, u.y);
  if (tile.fire && !u.dead) {
    u.status.burning = 2;
    emit(b, { t: 'text', unit: u.id, text: 'Burning!', color: '#ff8a3d' });
  }
  return true;
}

// ------------------------------------------------------------------------------------ abilities

export interface AbilityTarget {
  unit?: Unit;
  x?: number;
  y?: number;
}

export function abilityReady(u: Unit, id: string): boolean {
  if (u.used?.[id]) return false;
  return !(u.cooldowns[id] > 0);
}

export function validAbilityTargets(b: Battle, u: Unit, id: string): { units: Unit[]; tiles: [number, number][] } {
  const a = ABILITIES[id];
  const units: Unit[] = [];
  const tiles: [number, number][] = [];
  if (a.target === 'self') return { units: [u], tiles };
  if (a.target === 'enemy') {
    for (const e of enemiesOf(b, u)) {
      if (a.range >= 99) {
        if (canAttack(b, u, e)) units.push(e);
      } else if (a.range === 1 ? cheb(u.x, u.y, e.x, e.y) <= 1 : dist(u.x, u.y, e.x, e.y) <= a.range && hasLos(b, u.x, u.y, e.x, e.y)) {
        if (id === 'execute' && e.hp > e.maxHp / 2 && !e.gang) continue;
        if ((id === 'heartbreak' || id === 'puppet') && e.boss) continue;
        units.push(e);
      }
    }
  }
  if (a.target === 'ally') {
    for (const o of [u, ...alliesOf(b, u)]) {
      if (cheb(u.x, u.y, o.x, o.y) <= a.range) {
        if (id === 'overclock' && (o === u || !o.acted)) continue;
        if (u.gang && !o.gang) continue;
        units.push(o);
      }
    }
  }
  if (a.target === 'downed') {
    for (const o of b.units) if (o.downed && !o.dead && effTeam(o) === effTeam(u) && cheb(u.x, u.y, o.x, o.y) <= a.range) units.push(o);
  }
  if (a.target === 'tile') {
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      if (dist(u.x, u.y, x, y) > a.range) continue;
      if (id === 'turret') {
        if (!passable(b, x, y) || unitAt(b, x, y)) continue;
      } else if (!hasLos(b, u.x, u.y, x, y)) continue;
      tiles.push([x, y]);
    }
  }
  return { units, tiles };
}

function weirdCost(b: Battle, u: Unit, roll: Roll, weakCost: number, missCost: number): void {
  const cost = roll.outcome === 'miss' ? missCost : roll.outcome === 'weak' ? weakCost : 0;
  if (cost > 0) {
    emit(b, { t: 'text', unit: u.id, text: `Bleed ${cost}`, color: '#b07cff' });
    log(b, `The Maelstrom bites back: ${u.name} bleeds ${cost}.`);
    applyDamage(b, u, cost, 'psychic');
  }
}

function statRoll(b: Battle, u: Unit, stat: Stat, label: string, bonus = 0): Roll {
  const roll = roll2d6(rngOf(b), u.stats[stat] + statusMod(u) + bonus, label);
  emit(b, { t: 'roll', unit: u.id, roll, label });
  return roll;
}

export function useAbility(b: Battle, u: Unit, id: string, tgt: AbilityTarget): void {
  const a = ABILITIES[id];
  const t = tgt.unit;
  u.cooldowns[id] = a.cooldown + 1;
  if (a.cooldown >= 99) (u.used ??= {})[id] = true;
  emit(b, { t: 'text', unit: u.id, text: a.name, color: '#ffcf7a' });
  switch (id) {
    case 'defend':
      u.status.defend = true;
      emit(b, { t: 'buff', unit: u.id, kind: 'defend' });
      log(b, `${u.name} digs in.`);
      break;
    case 'suppress': {
      const roll = statRoll(b, u, 'hard', a.name);
      const w = weaponOf(u);
      emit(b, { t: 'blast', x: tgt.x!, y: tgt.y!, r: 1, kind: 'frag' });
      for (const [x, y] of tilesInRadius(b, tgt.x!, tgt.y!, 1)) {
        const o = unitAt(b, x, y);
        if (!o || o.dead || effTeam(o) === effTeam(u)) continue;
        emit(b, { t: 'attack', from: u.id, to: o.id, sfx: w.sfx, ranged: true, hit: roll.outcome !== 'miss', dmg: 0 });
        if (roll.outcome !== 'miss') {
          applyDamage(b, o, Math.max(1, w.harm - 1 + (roll.outcome === 'strong' ? 1 : 0) - o.armor), 'normal', u);
          if (!o.dead) { o.status.pinned = 1; emit(b, { t: 'text', unit: o.id, text: 'Pinned', color: '#e0c060' }); }
        }
      }
      log(b, `${u.name} lays down suppressing fire.`);
      break;
    }
    case 'overwatch':
      u.status.overwatch = true;
      emit(b, { t: 'buff', unit: u.id, kind: 'overwatch' });
      log(b, `${u.name} watches the killing ground.`);
      break;
    case 'bloodbath':
      doAttack(b, u, t!, { hit: 1, harm: 2, label: a.name }, false);
      break;
    case 'patch': {
      const roll = statRoll(b, u, 'sharp', a.name);
      const amt = (roll.outcome === 'strong' ? 6 : roll.outcome === 'weak' ? 4 : 2) + u.healBonus;
      heal(b, t!, amt);
      log(b, `${u.name} patches up ${t!.name} (+${amt}).`);
      break;
    }
    case 'revive':
      heal(b, t!, Math.ceil(t!.maxHp / 2) + u.healBonus);
      break;
    case 'triage':
      for (const o of [u, ...alliesOf(b, u)]) if (cheb(u.x, u.y, o.x, o.y) <= 2) {
        heal(b, o, 4 + u.healBonus);
        o.status.burning = 0;
        o.status.pinned = 0;
      }
      log(b, `${u.name} performs field surgery.`);
      break;
    case 'flurry':
      doAttack(b, u, t!, { hit: 0, harm: 0, label: 'Flurry' }, false);
      if (!t!.dead && !t!.downed) doAttack(b, u, t!, { hit: 0, harm: 0, label: 'Flurry' }, false);
      break;
    case 'riposte':
      u.status.riposte = true;
      emit(b, { t: 'buff', unit: u.id, kind: 'riposte' });
      break;
    case 'execute':
      doAttack(b, u, t!, { hit: 0, harm: 3, ap: true, label: a.name }, false);
      break;
    case 'mindlash': {
      const roll = statRoll(b, u, 'weird', a.name);
      emit(b, { t: 'psychic', from: u.id, to: t!.id });
      if (roll.outcome !== 'miss') applyDamage(b, t!, roll.outcome === 'strong' ? 4 : 3, 'psychic', u);
      else emit(b, { t: 'text', unit: t!.id, text: 'Resisted', color: '#b07cff' });
      weirdCost(b, u, roll, 1, 2);
      break;
    }
    case 'puppet': {
      const roll = statRoll(b, u, 'weird', a.name);
      emit(b, { t: 'psychic', from: u.id, to: t!.id });
      if (roll.outcome !== 'miss') { t!.status.puppet = 1; emit(b, { t: 'text', unit: t!.id, text: 'Puppeted', color: '#b07cff' }); }
      weirdCost(b, u, roll, 1, 2);
      break;
    }
    case 'brainburn':
    case 'maelstrom': {
      const roll = statRoll(b, u, 'weird', a.name);
      emit(b, { t: 'blast', x: tgt.x!, y: tgt.y!, r: 1, kind: 'psychic' });
      const dmg = roll.outcome === 'strong' ? 3 : roll.outcome === 'weak' ? 3 : 1;
      for (const [x, y] of tilesInRadius(b, tgt.x!, tgt.y!, 1)) {
        const o = unitAt(b, x, y);
        if (!o || o.dead) continue;
        if (id === 'brainburn' && effTeam(o) === effTeam(u)) continue;
        applyDamage(b, o, dmg, 'psychic', u);
      }
      weirdCost(b, u, roll, id === 'maelstrom' ? 1 : 0, 2);
      break;
    }
    case 'sermon':
      for (const o of [u, ...alliesOf(b, u)]) if (cheb(u.x, u.y, o.x, o.y) <= 3) { o.status.sermon = 2; emit(b, { t: 'buff', unit: o.id, kind: 'sermon' }); }
      log(b, `${u.name} preaches fire. Allies are inspired.`);
      break;
    case 'grace':
      for (const o of b.units) if (!o.dead && effTeam(o) === effTeam(u) && o !== u) heal(b, o, 5);
      applyDamage(b, u, 2, 'psychic');
      break;
    case 'pack':
      spawnSummons(b, u);
      break;
    case 'rally':
      for (const o of [u, ...alliesOf(b, u)]) if (cheb(u.x, u.y, o.x, o.y) <= 3) {
        o.status.rally = 2;
        o.status.pinned = 0;
        emit(b, { t: 'buff', unit: o.id, kind: 'rally' });
      }
      break;
    case 'warcry': {
      const roll = statRoll(b, u, 'hot', a.name);
      if (roll.outcome !== 'miss') for (const e of enemiesOf(b, u)) if (cheb(u.x, u.y, e.x, e.y) <= 3) {
        e.status.warcry = 2;
        if (roll.outcome === 'strong') e.status.pinned = 1;
        emit(b, { t: 'text', unit: e.id, text: 'Shaken', color: '#e0c060' });
      }
      break;
    }
    case 'turret':
      spawnTurret(b, u, tgt.x!, tgt.y!);
      break;
    case 'pipebomb': {
      const roll = statRoll(b, u, 'sharp', a.name);
      let cx = tgt.x!, cy = tgt.y!;
      if (roll.outcome === 'miss') {
        const rng = rngOf(b);
        cx = Math.max(0, Math.min(b.w - 1, cx + rng.int(-1, 1)));
        cy = Math.max(0, Math.min(b.h - 1, cy + rng.int(-1, 1)));
        log(b, 'The pipe bomb bounces wide!');
      }
      blast(b, u, cx, cy, roll.outcome === 'strong' ? 5 : 4, 'frag');
      break;
    }
    case 'overclock':
      t!.acted = false;
      t!.moved = false;
      emit(b, { t: 'buff', unit: t!.id, kind: 'overclock' });
      log(b, `${t!.name} is jolted back into action!`);
      break;
    case 'captivate': {
      const roll = statRoll(b, u, 'hot', a.name);
      if (roll.outcome !== 'miss') {
        t!.status.captivated = roll.outcome === 'strong' ? 2 : 1;
        emit(b, { t: 'text', unit: t!.id, text: 'Captivated', color: '#ff7ac8' });
      } else emit(b, { t: 'text', unit: t!.id, text: 'Unmoved', color: '#aaa' });
      break;
    }
    case 'kiss':
      doAttack(b, u, t!, { hit: 0, harm: 2, ap: true, label: a.name }, false);
      break;
    case 'heartbreak': {
      const roll = statRoll(b, u, 'hot', a.name);
      if (roll.outcome !== 'miss') {
        t!.status.charmed = 2;
        emit(b, { t: 'text', unit: t!.id, text: 'Turned!', color: '#ff7ac8' });
      }
      break;
    }
    // ------------------------------------ army orders
    case 'o_volley':
      gangAttack(b, u, t!, { hit: 1, harm: 0, label: 'Volley', noCounter: true }, false, true);
      break;
    case 'o_charge':
      gangAttack(b, u, t!, { hit: 1, harm: 1, label: 'Charge' }, false);
      break;
    case 'o_zeal':
      for (const o of alliesOf(b, u)) if (o.gang && cheb(u.x, u.y, o.x, o.y) <= 1) { o.status.zeal = 2; emit(b, { t: 'buff', unit: o.id, kind: 'sermon' }); }
      u.status.zeal = 2;
      break;
    case 'o_triage': {
      const g = t!;
      const lost = (g.maxTroops ?? 0) - (g.troops ?? 0);
      const back = Math.ceil(lost * 0.25);
      g.troops = (g.troops ?? 0) + back;
      g.hp = g.troops;
      emit(b, { t: 'troops', unit: g.id, delta: back });
      break;
    }
    case 'o_terror': {
      const roll = statRoll(b, u, 'weird', a.name);
      emit(b, { t: 'psychic', from: u.id, to: t!.id });
      if (roll.outcome !== 'miss') applyCasualties(b, t!, Math.ceil((t!.troops ?? 0) * (roll.outcome === 'strong' ? 0.2 : 0.12)), u);
      weirdCost(b, u, roll, 0, 0);
      break;
    }
    case 'o_parley': {
      const roll = statRoll(b, u, 'hot', a.name);
      if (roll.outcome !== 'miss') { t!.status.parley = 1; emit(b, { t: 'text', unit: t!.id, text: 'Stands down', color: '#ff7ac8' }); }
      break;
    }
    case 'o_bomb': {
      const roll = statRoll(b, u, 'sharp', a.name);
      emit(b, { t: 'blast', x: tgt.x!, y: tgt.y!, r: 1, kind: 'frag' });
      for (const [x, y] of tilesInRadius(b, tgt.x!, tgt.y!, 1)) {
        const o = unitAt(b, x, y);
        if (!o || o.dead || !o.gang) continue;
        const pct = roll.outcome === 'strong' ? 0.2 : roll.outcome === 'weak' ? 0.12 : 0.05;
        applyCasualties(b, o, Math.ceil((o.troops ?? 0) * pct) + 1, u);
      }
      break;
    }
    case 'o_challenge': {
      const roll = statRoll(b, u, 'cool', a.name);
      if (roll.outcome === 'strong') applyCasualties(b, t!, Math.ceil((t!.troops ?? 0) * 0.3), u);
      else if (roll.outcome === 'weak') { applyCasualties(b, t!, Math.ceil((t!.troops ?? 0) * 0.15), u); applyCasualties(b, u, 2); }
      else applyCasualties(b, u, Math.ceil((u.troops ?? 0) * 0.1) + 1);
      break;
    }
  }
  u.acted = true;
  checkEnd(b);
}

export function blast(b: Battle, src: Unit | null, cx: number, cy: number, dmg: number, kind: 'fire' | 'frag', burn = false): void {
  emit(b, { t: 'blast', x: cx, y: cy, r: 1, kind });
  for (const [x, y] of tilesInRadius(b, cx, cy, 1)) {
    const o = unitAt(b, x, y);
    if (burn) tileAt(b, x, y).fire = 2;
    if (!o || o.dead) continue;
    if (o.gang) applyCasualties(b, o, Math.ceil((o.troops ?? 0) * 0.1) + dmg, src ?? undefined);
    else applyDamage(b, o, Math.max(1, dmg - Math.floor(o.armor / 2)), 'blast', src ?? undefined);
    if (burn && !o.dead) o.status.burning = 2;
  }
}

function freeAdjacent(b: Battle, u: Unit): [number, number][] {
  const out: [number, number][] = [];
  for (const [x, y] of tilesInRadius(b, u.x, u.y, 1)) if (passable(b, x, y) && !unitAt(b, x, y)) out.push([x, y]);
  return out;
}

function spawnSummons(b: Battle, u: Unit): void {
  const spots = freeAdjacent(b, u).slice(0, 2);
  for (const [x, y] of spots) {
    b.idc++;
    const s: Unit = {
      id: `s${b.idc}`, name: 'Gang Tough', team: u.team, controlled: false, portrait: 'enemies/raider', x, y,
      hp: 8, maxHp: 8, armor: 1, move: 4, stats: { cool: 0, hard: 1, hot: 0, sharp: 0, weird: -1 }, weapon: 'pipe', abilities: [],
      cooldowns: {}, status: {}, ai: 'melee', moved: true, acted: true, hitBonus: 0, healBonus: 0, hardHarm: 0, evasive: false, xp: 0, loot: 0, summon: true,
    };
    b.units.push(s);
    emit(b, { t: 'spawn', unit: s.id });
  }
  log(b, `${u.name} whistles. The pack arrives.`);
}

function spawnTurret(b: Battle, u: Unit, x: number, y: number): void {
  b.idc++;
  const s: Unit = {
    id: `t${b.idc}`, name: 'Scrap Turret', team: u.team, controlled: false, portrait: 'abilities/turret', x, y,
    hp: 8 + u.stats.sharp * 2, maxHp: 8 + u.stats.sharp * 2, armor: 1, move: 0, stats: { cool: 0, hard: 0, hot: 0, sharp: u.stats.sharp, weird: 0 },
    weapon: 'pistol', abilities: [], cooldowns: {}, status: {}, ai: 'turret', moved: true, acted: true, hitBonus: 1, healBonus: 0, hardHarm: 0,
    evasive: false, xp: 0, loot: 0, summon: true,
  };
  s.stats.cool = u.stats.sharp;
  b.units.push(s);
  emit(b, { t: 'spawn', unit: s.id });
  log(b, `${u.name} bolts together a turret.`);
}

// ------------------------------------------------------------------------------------ items

export function itemTargets(b: Battle, u: Unit, itemId: string): { units: Unit[]; tiles: [number, number][] } {
  const it = ITEMS[itemId];
  const use = it.use!;
  if (use.effect === 'heal' || use.effect === 'medkit') {
    const units = b.units.filter((o) => !o.dead && !o.gang && effTeam(o) === effTeam(u) && cheb(u.x, u.y, o.x, o.y) <= 1 && (o.downed || o.hp < o.maxHp));
    return { units, tiles: [] };
  }
  if (use.effect === 'dampener') {
    return { units: b.units.filter((o) => !o.dead && !o.downed && effTeam(o) === effTeam(u) && cheb(u.x, u.y, o.x, o.y) <= 1), tiles: [] };
  }
  const tiles: [number, number][] = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (dist(u.x, u.y, x, y) <= (use.range ?? 5) && hasLos(b, u.x, u.y, x, y)) tiles.push([x, y]);
  return { units: [], tiles };
}

export function useItem(b: Battle, u: Unit, itemId: string, tgt: AbilityTarget, items: Record<string, number>): void {
  const it = ITEMS[itemId];
  const use = it.use!;
  items[itemId] = (items[itemId] ?? 0) - 1;
  emit(b, { t: 'text', unit: u.id, text: it.name, color: '#ffcf7a' });
  switch (use.effect) {
    case 'heal':
    case 'medkit':
      heal(b, tgt.unit!, use.amount + (u.healBonus > 0 ? 1 : 0));
      break;
    case 'dampener': {
      const t = tgt.unit!;
      t.status = { ...t.status, burning: 0, pinned: 0, captivated: 0, puppet: 0, warcry: 0 };
      t.cooldowns = {};
      emit(b, { t: 'buff', unit: t.id, kind: 'sermon' });
      break;
    }
    case 'molotov':
      blast(b, u, tgt.x!, tgt.y!, use.amount, 'fire', true);
      break;
    case 'grenade':
      blast(b, u, tgt.x!, tgt.y!, use.amount, 'frag');
      break;
  }
  u.acted = true;
  checkEnd(b);
}

// ------------------------------------------------------------------------------------ gangs

function sizeMod(att: Unit, def: Unit): number {
  const r = (att.troops ?? 1) / Math.max(1, def.troops ?? 1);
  if (r >= 3) return 2;
  if (r >= 1.6) return 1;
  if (r <= 0.33) return -2;
  if (r <= 0.62) return -1;
  return 0;
}

function gangPreview(b: Battle, u: Unit, t: Unit, extra: AttackMods): Preview {
  const mods: [string, number][] = [];
  mods.push(['Leader', u.stats.hard]);
  if (u.quality) mods.push(['Quality', u.quality]);
  const sm = sizeMod(u, t);
  if (sm) mods.push(['Numbers', sm]);
  if (u.ranged && dist(u.x, u.y, t.x, t.y) > 1) {
    const cov = coverAgainst(b, t.x, t.y, u.x, u.y);
    if (cov) mods.push(['Cover', -cov]);
  }
  if (t.status.defend) mods.push(['Dug in', -1]);
  const st = statusMod(u);
  if (st) mods.push([st > 0 ? 'Zeal' : 'Shaken', st]);
  if (extra.hit) mods.push([extra.label ?? 'Order', extra.hit]);
  const total = mods.reduce((a, [, v]) => a + v, 0);
  const troops = u.troops ?? 0;
  const weak = Math.ceil(troops * 0.15) + 1;
  const strong = Math.ceil(troops * 0.25) + 2;
  return { mods, total, pStrong: chanceAtLeast(total, 10), pHit: chanceAtLeast(total, 7), dmgWeak: weak, dmgStrong: strong, stat: 'hard' };
}

export function applyCasualties(b: Battle, g: Unit, n: number, killer?: Unit): void {
  if (!g.gang) return applyDamage(b, g, n, 'normal', killer);
  n = Math.max(1, Math.round(n));
  g.troops = Math.max(0, (g.troops ?? 0) - n);
  g.hp = g.troops;
  emit(b, { t: 'troops', unit: g.id, delta: -n });
  const breakPoint = Math.ceil((g.maxTroops ?? 1) * 0.25);
  if (g.troops <= breakPoint) {
    g.dead = true;
    emit(b, { t: 'death', unit: g.id });
    log(b, g.troops > 0 ? `${g.name} breaks and flees! (${g.troops} run)` : `${g.name} is wiped out!`);
  }
}

function gangAttack(b: Battle, u: Unit, t: Unit, extra: AttackMods, consume = true, ranged = false): void {
  const rng = rngOf(b);
  const pv = gangPreview(b, u, t, extra);
  const roll = roll2d6(rng, pv.total, extra.label ?? 'Clash');
  const isRanged = ranged || (!!u.ranged && cheb(u.x, u.y, t.x, t.y) > 1);
  const uT = u.troops ?? 0, tT = t.troops ?? 0;
  let dealt = 0, taken = 0;
  const bonus = extra.harm ? 1.25 : 1;
  if (roll.outcome === 'strong') dealt = (Math.ceil(uT * 0.25) + 2) * bonus;
  else if (roll.outcome === 'weak') { dealt = (Math.ceil(uT * 0.15) + 1) * bonus; taken = isRanged || extra.noCounter ? 0 : Math.ceil(tT * 0.08) + 1; }
  else taken = isRanged ? 0 : Math.ceil(tT * 0.12) + 1;
  if (roll.crit) dealt *= 1.5;
  emit(b, { t: 'attack', from: u.id, to: t.id, sfx: isRanged ? 'rifle' : 'blade', ranged: isRanged, hit: dealt > 0, dmg: Math.round(dealt), crit: roll.crit, roll });
  log(b, `${u.name} ${isRanged ? 'fires on' : 'clashes with'} ${t.name}: ${roll.outcome === 'miss' ? 'repulsed' : `${Math.round(dealt)} fall`}${taken ? `, ${taken} lost` : ''} (${roll.total})`);
  if (dealt) applyCasualties(b, t, dealt, u);
  if (taken) applyCasualties(b, u, taken, t);
  if (consume) u.acted = true;
  checkEnd(b);
}

// ------------------------------------------------------------------------------------ turn flow

export function checkEnd(b: Battle): void {
  if (b.result) return;
  const team0 = b.units.filter((u) => !u.dead && !u.downed && u.team === 0 && !u.summon);
  const team1 = b.units.filter((u) => !u.dead && !u.downed && u.team === 1);
  const team1Real = team1;
  if (b.mode === 'army' && b.startTroops) {
    const t0 = b.units.filter((u) => u.team === 0 && !u.dead && u.gang).reduce((a, u) => a + (u.troops ?? 0), 0);
    const t1 = b.units.filter((u) => u.team === 1 && !u.dead && u.gang).reduce((a, u) => a + (u.troops ?? 0), 0);
    if (t1 < b.startTroops[1] * 0.3 || team1Real.length === 0) {
      b.result = 'win';
      log(b, 'The enemy host breaks and runs!');
      return;
    }
    if (t0 < b.startTroops[0] * 0.3 || team0.length === 0) {
      b.result = 'lose';
      log(b, 'Your lines collapse!');
      return;
    }
    return;
  }
  if (team1Real.length === 0) {
    b.result = 'win';
    log(b, 'Victory.');
  } else if (team0.length === 0) {
    b.result = 'lose';
    log(b, 'Your crew has fallen.');
  }
}

/** Start-of-phase upkeep for a team: statuses tick, burning hurts, cooldowns drop. */
export function beginPhase(b: Battle, team: 0 | 1, controlledOnly: boolean | null): void {
  for (const u of b.units) {
    if (u.dead || u.team !== team) continue;
    if (controlledOnly !== null && u.controlled !== controlledOnly) continue;
    u.moved = false;
    u.acted = false;
    for (const k of Object.keys(u.cooldowns)) if (u.cooldowns[k] > 0) u.cooldowns[k]--;
    const s = u.status;
    s.defend = false;
    s.riposte = false;
    if (u.downed) {
      u.bleedout = (u.bleedout ?? 1) - 1;
      emit(b, { t: 'text', unit: u.id, text: `Bleeding out (${Math.max(0, u.bleedout)})`, color: '#ff4a4a' });
      if (u.bleedout <= 0) kill(b, u);
      continue;
    }
    if (s.burning) {
      applyDamage(b, u, 1, 'burn');
      s.burning--;
    }
    const tile = tileAt(b, u.x, u.y);
    if (tile.fire && !u.dead && !s.burning) s.burning = 1;
    if (s.pinned) { s.pinned--; u.moved = true; }
    for (const k of ['sermon', 'rally', 'warcry', 'zeal'] as const) if (s[k]) s[k]!--;
    if (s.charmed) s.charmed--;
    if (s.captivated) {
      s.captivated--;
      u.moved = true;
      u.acted = true;
      emit(b, { t: 'text', unit: u.id, text: 'Captivated', color: '#ff7ac8' });
    }
    if (s.parley) {
      s.parley--;
      u.moved = true;
      u.acted = true;
    }
  }
  for (const t of b.tiles) if (t.fire) t.fire--;
  checkEnd(b);
}

export function flee(b: Battle): void {
  b.result = 'fled';
  log(b, 'You break off and run.');
}

export { inBounds, active };
