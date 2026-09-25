import type { Stat } from '../engine/dice';
import type { RngState } from '../engine/rng';

export interface Character {
  id: string;
  name: string;
  playbook: string;
  portrait: string;
  level: number;
  xp: number;
  stats: Record<Stat, number>;
  hp: number;
  weapon: string;
  armor: string | null;
  gear: string | null;
  isPlayer: boolean;
  statPoints: number;
  bio: string;
  /** Kills across the campaign. */
  kills: number;
}

export interface RegionState {
  id: string;
  owner: string;
  garrison: number;
  /** Months until the region recovers from being sacked (reduced income). */
  sacked: number;
  /** player has scouted it recently (day) */
  scoutedDay?: number;
  delveCleared?: boolean;
}

export interface FactionState {
  id: string;
  alive: boolean;
  treasury: number;
  relations: Record<string, number>;
  rep: number; // player's reputation with this faction
  coalition: boolean;
  leaderAlive: boolean;
  lastAttackDay: number;
  heardTape: boolean;
}

export interface Army {
  id: string;
  faction: string;
  from: string;
  to: string;
  troops: number;
  daysLeft: number;
  totalDays: number;
  /** player is marching with this army */
  withPlayer?: boolean;
}

export type JobKind = 'bounty' | 'sabotage' | 'raid' | 'deliver' | 'scout' | 'assassinate' | 'envoy' | 'delve';

export interface Job {
  id: string;
  kind: JobKind;
  issuer: string;
  target: string; // region id
  enemy?: string; // faction id involved
  envoyTo?: string; // faction for envoy jobs
  title: string;
  desc: string;
  reward: number;
  rep: number;
  merit: number;
  deadline: number; // absolute day
  state: 'offered' | 'active' | 'done' | 'failed';
  offeredAt: string; // region id where offered
}

export type NewsKind = 'war' | 'capture' | 'death' | 'diplo' | 'player' | 'burn' | 'fall' | 'info';

export interface NewsItem {
  day: number;
  text: string;
  kind: NewsKind;
  faction?: string;
  region?: string;
}

export interface Travel {
  path: string[]; // remaining regions to walk through (next first)
  dayInLeg: number;
  legDays: number;
  from: string;
}

export interface PlayerFaction {
  name: string;
  color: string;
  capital: string;
}

export type Pending =
  | { kind: 'encounter'; eventId: string; region: string }
  | { kind: 'callToArms'; armyId: string }
  | { kind: 'defend'; armyId: string }
  | { kind: 'assault'; armyId: string }
  | { kind: 'story'; id: string }
  | { kind: 'message'; title: string; text: string; image?: string; portrait?: string }
  | { kind: 'patrol'; faction: string; region: string };

export interface DelveRoom {
  type: 'fight' | 'trap' | 'loot' | 'shrine' | 'rest' | 'boss';
  image: string;
  done: boolean;
}

export interface DelveState {
  id: string;
  room: number;
  rooms: DelveRoom[];
}

export interface GameState {
  version: number;
  rng: RngState;
  day: number;
  difficulty: 'easy' | 'normal' | 'hard';
  crew: Character[];
  regions: Record<string, RegionState>;
  factions: Record<string, FactionState>;
  armies: Army[];
  jobs: Job[];
  news: NewsItem[];
  location: string;
  travel: Travel | null;
  barter: number;
  rations: number;
  warband: number;
  stash: Record<string, number>;
  pledged: string | null;
  merit: number;
  recruits: Record<string, Character[]>;
  quest: { stage: number; burnRevealed: boolean; keycard: boolean; tape: boolean; coalition: number };
  flags: Record<string, number | boolean | string>;
  stats: { battles: number; wins: number; kills: number; jobsDone: number; regionsTaken: number; delves: number };
  playerFaction: PlayerFaction | null;
  ended: null | 'victory' | 'defeat' | 'death';
  idCounter: number;
  pending: Pending[];
  delve: DelveState | null;
  /** barter income collected for the player-founded faction last month */
  lastIncome: number;
  /** When the Burnt King's reactor ignites (absolute day). */
  burnDay: number;
}

export const RANKS = [
  { id: 'hand', name: 'Sworn Hand', merit: 0, stipend: 10, warband: 10 },
  { id: 'lieutenant', name: 'Lieutenant', merit: 60, stipend: 30, warband: 30 },
  { id: 'warboss', name: 'Warboss', merit: 180, stipend: 60, warband: 60 },
] as const;
