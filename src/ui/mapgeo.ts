import { Delaunay } from 'd3-delaunay';
import { MAP_H, MAP_W, REGIONS } from '../data/regions';

type Pt = [number, number];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function onBorder(p: Pt): boolean {
  return p[0] <= 0.5 || p[1] <= 0.5 || p[0] >= MAP_W - 0.5 || p[1] >= MAP_H - 0.5;
}

/** Points from `a` up to (not including) `b`, with deterministic perpendicular jitter so borders look hand-drawn. Shared edges jitter identically for both cells. */
function jitterEdge(a: Pt, b: Pt): Pt[] {
  if (onBorder(a) && onBorder(b)) return [a];
  const flip = a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
  const [p, q] = flip ? [b, a] : [a, b];
  const key = `${p[0].toFixed(1)},${p[1].toFixed(1)}|${q[0].toFixed(1)},${q[1].toFixed(1)}`;
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const n = Math.max(2, Math.round(len / 38));
  const nx = -(q[1] - p[1]) / (len || 1), ny = (q[0] - p[0]) / (len || 1);
  const mids: Pt[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const amp = Math.sin(t * Math.PI) * Math.min(26, len * 0.08);
    const o = (hash(`${key}#${i}`) - 0.5) * 2 * amp;
    mids.push([p[0] + (q[0] - p[0]) * t + nx * o, p[1] + (q[1] - p[1]) * t + ny * o]);
  }
  if (flip) mids.reverse();
  return [a, ...mids];
}

let cache: Record<string, string> | null = null;
let centroids: Record<string, Pt> = {};

export function regionPaths(): Record<string, string> {
  if (cache) return cache;
  const pts = REGIONS.map((r) => [r.x, r.y] as Pt);
  const v = Delaunay.from(pts).voronoi([0, 0, MAP_W, MAP_H]);
  cache = {};
  REGIONS.forEach((r, i) => {
    const poly = v.cellPolygon(i) as Pt[];
    const ring: Pt[] = [];
    for (let k = 0; k < poly.length - 1; k++) {
      const seg = jitterEdge(poly[k], poly[k + 1]);
      ring.push(...seg);
    }
    cache![r.id] = 'M' + ring.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
    let cx = 0, cy = 0;
    for (const p of poly) { cx += p[0]; cy += p[1]; }
    centroids[r.id] = [cx / poly.length, cy / poly.length];
  });
  return cache;
}

export function regionCentroid(id: string): Pt {
  regionPaths();
  return centroids[id];
}
