import { Rng } from '../engine/rng';
import { FACTIONS, FACTION_IDS } from '../data/factions';
import { REGIONS } from '../data/regions';
import { makeCharacter, portraitsFor, randomRecruit } from './characters';
import type { FactionState, GameState, RegionState } from './types';

export const SAVE_VERSION = 1;

const BASE_RELATIONS: Record<string, Record<string, number>> = {
  cinder: { choir: -80, iron: -40, pump: -25, rats: -30, dust: -30, salt: -35 },
  choir: { iron: -5, pump: -15, rats: -20, dust: -10, salt: 5 },
  iron: { pump: 25, rats: -25, dust: -30, salt: 15 },
  pump: { rats: -15, dust: 5, salt: 10 },
  rats: { dust: -20, salt: -10 },
  dust: { salt: -40 },
  salt: {},
};

export interface NewGameOptions {
  name: string;
  playbook: string;
  portrait: string;
  difficulty: 'easy' | 'normal' | 'hard';
  seed?: number;
}

export function newGame(opts: NewGameOptions): GameState {
  const seed = opts.seed ?? (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const rng = Rng.fromSeed(seed);

  const regions: Record<string, RegionState> = {};
  for (const r of REGIONS) regions[r.id] = { id: r.id, owner: r.owner, garrison: r.garrison, sacked: 0 };

  const factions: Record<string, FactionState> = {};
  for (const fid of FACTION_IDS) {
    const relations: Record<string, number> = {};
    for (const other of FACTION_IDS) {
      if (other === fid) continue;
      relations[other] = BASE_RELATIONS[fid]?.[other] ?? BASE_RELATIONS[other]?.[fid] ?? 0;
    }
    factions[fid] = {
      id: fid, alive: true, treasury: fid === 'cinder' ? 80 : 60, relations,
      rep: fid === 'cinder' ? -20 : 0, coalition: false, leaderAlive: true, lastAttackDay: -30, heardTape: false,
    };
  }

  const player = makeCharacter('pc', opts.name || 'Drifter', opts.playbook, opts.portrait, true);
  const used = new Set<string>([opts.portrait]);
  // A companion who covers the player's weaknesses joins at Hope's Rest.
  const companionPb = opts.playbook === 'sawbones' ? 'gunhand' : 'sawbones';
  const compPortrait = portraitsFor(companionPb).find((p) => !used.has(p))!;
  used.add(compPortrait);
  const companion = makeCharacter('c1', companionPb === 'sawbones' ? 'Mercy' : 'Brick', companionPb, compPortrait, false, 1, rng);
  companion.bio = companionPb === 'sawbones'
    ? 'Hope\'s Rest\'s only healer. Old Nell\'s niece, and twice as stubborn.'
    : 'Hope\'s Rest\'s gate guard. Says little, shoots straight.';

  const s: GameState = {
    version: SAVE_VERSION,
    rng: rng.state,
    day: 0,
    difficulty: opts.difficulty,
    crew: [player, companion],
    regions,
    factions,
    armies: [],
    jobs: [],
    news: [],
    location: 'hopesrest',
    travel: null,
    barter: 60,
    rations: 20,
    warband: 0,
    stash: { bandage: 2, stim: 1, molotov: 1 },
    pledged: null,
    merit: 0,
    recruits: {},
    quest: { stage: 0, burnRevealed: false, keycard: false, tape: false, coalition: 0 },
    flags: {},
    stats: { battles: 0, wins: 0, kills: 0, jobsDone: 0, regionsTaken: 0, delves: 0 },
    playerFaction: null,
    ended: null,
    idCounter: 10,
    pending: [],
    delve: null,
    lastIncome: 0,
    burnDay: opts.difficulty === 'easy' ? 360 * 6 : opts.difficulty === 'hard' ? 360 * 4 : 360 * 5,
  };
  for (const pid of used) s.flags[`used:${pid}`] = true;
  refreshRecruits(s, rng);
  s.news.push({ day: 0, text: 'The Burnt King\'s Burnlads have been seen raiding south of Ashfall.', kind: 'burn', faction: 'cinder' });
  return s;
}

export function usedPortraits(s: GameState): Set<string> {
  const set = new Set<string>();
  for (const c of s.crew) set.add(c.portrait);
  for (const list of Object.values(s.recruits)) for (const c of list) set.add(c.portrait);
  return set;
}

/** Each settlement with a bar offers a few hands for hire; refreshed monthly. */
export function refreshRecruits(s: GameState, rng: Rng): void {
  s.recruits = {};
  const used = new Set<string>(s.crew.map((c) => c.portrait));
  const level = Math.min(6, 1 + Math.floor(s.day / 150));
  const bars = REGIONS.filter((r) => r.bar);
  rng.shuffle(bars);
  for (const r of bars.slice(0, 9)) {
    const n = r.kind === 'capital' ? 2 : 1;
    s.recruits[r.id] = [];
    for (let i = 0; i < n; i++) {
      s.idCounter++;
      const lvl = Math.max(1, level + rng.int(-1, 1));
      s.recruits[r.id].push(randomRecruit(rng, `r${s.idCounter}`, lvl, used));
    }
  }
  // Hope's Rest always has someone at the start
  if (s.day === 0 && !s.recruits.hopesrest) {
    s.idCounter++;
    s.recruits.hopesrest = [randomRecruit(rng, `r${s.idCounter}`, 1, used, 'duelist')];
  }
}

export { FACTIONS };
