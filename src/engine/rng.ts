/** Small seedable PRNG (mulberry32) whose state lives in plain data so it survives save/load. */
export interface RngState { s: number }

export class Rng {
  constructor(public state: RngState) {}

  static fromSeed(seed: number): Rng {
    return new Rng({ s: seed >>> 0 || 0x9e3779b9 });
  }

  next(): number {
    let t = (this.state.s = (this.state.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    const total = items.reduce((a, t) => a + Math.max(0, weight(t)), 0);
    let r = this.next() * total;
    for (const t of items) {
      r -= Math.max(0, weight(t));
      if (r <= 0) return t;
    }
    return items[items.length - 1];
  }

  d6(): number {
    return this.int(1, 6);
  }
}
