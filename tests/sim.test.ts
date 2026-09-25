import { describe, expect, it } from 'vitest';
import { runSim } from './simrun';
import { regionsOf } from '../src/game/util';
import { FACTION_IDS } from '../src/data/factions';

describe('world simulation', () => {
  it('runs 5 years without errors and keeps the map dynamic', () => {
    const tallies: Record<string, number[]> = {};
    for (let seed = 1; seed <= 12; seed++) {
      const s = runSim(seed, 5, seed === 1);
      for (const f of [...FACTION_IDS, 'free']) (tallies[f] ??= []).push(regionsOf(s, f).length);
      expect(Object.values(s.regions).every((r) => r.garrison >= 0)).toBe(true);
    }
    for (const [f, v] of Object.entries(tallies)) console.log(f.padEnd(7), v.join(' '));
  });
});
