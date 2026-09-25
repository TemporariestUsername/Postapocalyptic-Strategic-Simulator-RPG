import type { Battle, Unit } from './types';

export const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function inBounds(b: Battle, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < b.w && y < b.h;
}

export function tileAt(b: Battle, x: number, y: number) {
  return b.tiles[y * b.w + x];
}

export function unitAt(b: Battle, x: number, y: number): Unit | undefined {
  return b.units.find((u) => !u.dead && u.x === x && u.y === y);
}

export function alive(b: Battle): Unit[] {
  return b.units.filter((u) => !u.dead);
}

/** Units that can still fight (not dead, not downed). */
export function active(b: Battle): Unit[] {
  return b.units.filter((u) => !u.dead && !u.downed);
}

export function effTeam(u: Unit): 0 | 1 {
  return u.status.charmed ? ((1 - u.team) as 0 | 1) : u.team;
}

export function enemiesOf(b: Battle, u: Unit): Unit[] {
  const t = effTeam(u);
  return active(b).filter((o) => effTeam(o) !== t);
}

export function alliesOf(b: Battle, u: Unit): Unit[] {
  const t = effTeam(u);
  return active(b).filter((o) => effTeam(o) === t && o.id !== u.id);
}

export function cheb(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Weapon range distance: diagonal steps count as 1.5. */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);
}

export function passable(b: Battle, x: number, y: number): boolean {
  return inBounds(b, x, y) && !tileAt(b, x, y).blocked;
}

/**
 * Reachable tiles for a unit given its movement allowance. Allies can be passed through
 * but not ended on; enemies block. Returns map "x,y" -> {cost, prev}.
 */
export function reachable(b: Battle, u: Unit, move: number): Map<string, { cost: number; prev: string | null }> {
  const res = new Map<string, { cost: number; prev: string | null }>();
  const start = `${u.x},${u.y}`;
  res.set(start, { cost: 0, prev: null });
  const q: [number, number][] = [[u.x, u.y]];
  const team = effTeam(u);
  while (q.length) {
    const [x, y] = q.shift()!;
    const cur = res.get(`${x},${y}`)!;
    if (cur.cost >= move) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!passable(b, nx, ny)) continue;
      if (dx && dy && (!passable(b, x + dx, y) || !passable(b, x, y + dy))) continue; // no corner cutting
      const occ = unitAt(b, nx, ny);
      if (occ && !occ.downed && effTeam(occ) !== team) continue;
      const key = `${nx},${ny}`;
      const cost = cur.cost + 1;
      const prev = res.get(key);
      if (prev && prev.cost <= cost) continue;
      res.set(key, { cost, prev: `${x},${y}` });
      q.push([nx, ny]);
    }
  }
  // cannot end on an occupied tile
  for (const key of [...res.keys()]) {
    if (key === start) continue;
    const [x, y] = key.split(',').map(Number);
    if (unitAt(b, x, y)) res.delete(key);
  }
  return res;
}

export function pathTo(reach: Map<string, { cost: number; prev: string | null }>, x: number, y: number): [number, number][] {
  const out: [number, number][] = [];
  let key: string | null = `${x},${y}`;
  while (key) {
    const [px, py] = key.split(',').map(Number);
    out.unshift([px, py]);
    key = reach.get(key)?.prev ?? null;
  }
  return out;
}

/** Walking distance from a unit ignoring other units (for AI approach). */
export function distanceField(b: Battle, tx: number, ty: number): Int16Array {
  const d = new Int16Array(b.w * b.h).fill(999);
  d[ty * b.w + tx] = 0;
  const q: [number, number][] = [[tx, ty]];
  while (q.length) {
    const [x, y] = q.shift()!;
    const c = d[y * b.w + x];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!passable(b, nx, ny)) continue;
      if (dx && dy && (!passable(b, x + dx, y) || !passable(b, x, y + dy))) continue;
      const i = ny * b.w + nx;
      if (d[i] > c + 1) {
        d[i] = c + 1;
        q.push([nx, ny]);
      }
    }
  }
  return d;
}

/** Bresenham line of sight; blocked tiles in between block the view. */
export function hasLos(b: Battle, ax: number, ay: number, bx: number, by: number): boolean {
  let x = ax, y = ay;
  const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
  let err = dx + dy;
  while (true) {
    if (!(x === ax && y === ay) && !(x === bx && y === by) && tileAt(b, x, y).cover === 2) return false;
    if (x === bx && y === by) return true;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/** Cover the target gets against an attacker at (ax, ay): 0, 1 (half) or 2 (full). */
export function coverAgainst(b: Battle, tx: number, ty: number, ax: number, ay: number): number {
  const vx = ax - tx, vy = ay - ty;
  const len = Math.hypot(vx, vy) || 1;
  let best = 0;
  for (const [dx, dy] of DIRS) {
    const nx = tx + dx, ny = ty + dy;
    if (!inBounds(b, nx, ny)) continue;
    const t = tileAt(b, nx, ny);
    if (!t.cover) continue;
    const dot = (dx * vx + dy * vy) / (Math.hypot(dx, dy) * len);
    if (dot > 0.55) best = Math.max(best, t.cover);
  }
  return best;
}

export function tilesInRadius(b: Battle, x: number, y: number, r: number): [number, number][] {
  const out: [number, number][] = [];
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (inBounds(b, xx, yy)) out.push([xx, yy]);
  return out;
}
