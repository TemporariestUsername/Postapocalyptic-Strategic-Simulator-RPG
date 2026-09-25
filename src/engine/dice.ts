import type { Rng } from './rng';

export type Stat = 'cool' | 'hard' | 'hot' | 'sharp' | 'weird';
export const STATS: Stat[] = ['cool', 'hard', 'hot', 'sharp', 'weird'];

export const STAT_INFO: Record<Stat, { label: string; blurb: string }> = {
  cool: { label: 'Cool', blurb: 'Nerve under fire. Precise weapons, stealth, keeping your head.' },
  hard: { label: 'Hard', blurb: 'Violence and grit. Heavy weapons, brawling, intimidation, toughness.' },
  hot: { label: 'Hot', blurb: 'Charm and command. Persuasion, leadership, bargaining.' },
  sharp: { label: 'Sharp', blurb: 'Wits and awareness. Reading people and places, medicine, tech.' },
  weird: { label: 'Weird', blurb: 'Openness to the Maelstrom. Psychic powers and strange insight.' },
};

export type Outcome = 'strong' | 'weak' | 'miss';

export interface Roll {
  dice: [number, number];
  mod: number;
  total: number;
  outcome: Outcome;
  crit: boolean;
  label?: string;
}

/** The 2d6 move: 10+ strong hit, 7-9 weak hit, 6- miss. Double sixes are a crit. */
export function roll2d6(rng: Rng, mod: number, label?: string): Roll {
  const dice: [number, number] = [rng.d6(), rng.d6()];
  const total = dice[0] + dice[1] + mod;
  const outcome: Outcome = total >= 10 ? 'strong' : total >= 7 ? 'weak' : 'miss';
  return { dice, mod, total, outcome, crit: dice[0] === 6 && dice[1] === 6, label };
}

/** Probability that 2d6+mod reaches at least `target`. */
export function chanceAtLeast(mod: number, target: number): number {
  let n = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b + mod >= target) n++;
  return n / 36;
}

export function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
