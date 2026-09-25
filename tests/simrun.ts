import { newGame } from '../src/game/state';
import { dailyTick, monthlyTick, resolveAutoBattle } from '../src/game/sim';
import { regionsOf, troopsOf, rngOf } from '../src/game/util';
import { FACTION_IDS } from '../src/data/factions';
import type { GameState } from '../src/game/types';

export function runSim(seed: number, years: number, verbose = false, tweak?: (s: GameState) => void): GameState {
  const s = newGame({ name: 'T', playbook: 'gunhand', portrait: 'portraits/gunhand_1', difficulty: 'normal', seed });
  s.location = 'nowhere';
  tweak?.(s);
  for (let d = 0; d < years * 360; d++) {
    s.day++;
    if (s.day % 30 === 0) monthlyTick(s);
    for (const a of dailyTick(s)) resolveAutoBattle(s, a, rngOf(s));
    if (verbose && s.day % 180 === 0) {
      console.log(`y${(s.day / 360).toFixed(1)} ` + FACTION_IDS.map((f) => `${f}:${regionsOf(s, f).length}/${troopsOf(s, f)}`).join(' ') + ` free:${regionsOf(s, 'free').length}`);
    }
  }
  return s;
}
