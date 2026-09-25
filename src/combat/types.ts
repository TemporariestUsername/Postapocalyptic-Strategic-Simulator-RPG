import type { Roll, Stat } from '../engine/dice';
import type { RngState } from '../engine/rng';

export type AiKind = 'melee' | 'ranged' | 'psychic' | 'beast' | 'support' | 'turret';

export interface Status {
  pinned?: number;
  burning?: number;
  captivated?: number;
  puppet?: number;
  sermon?: number;
  rally?: number;
  warcry?: number;
  charmed?: number; // fights for the other team
  defend?: boolean;
  riposte?: boolean;
  overwatch?: boolean;
  zeal?: number;
  parley?: number;
}

export interface Unit {
  id: string;
  name: string;
  team: 0 | 1;
  controlled: boolean;
  portrait: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  armor: number;
  move: number;
  stats: Record<Stat, number>;
  weapon: string;
  abilities: string[];
  cooldowns: Record<string, number>;
  status: Status;
  ai: AiKind;
  charId?: string;
  enemyId?: string;
  boss?: boolean;
  downed?: boolean;
  bleedout?: number;
  dead?: boolean;
  moved: boolean;
  acted: boolean;
  /** extra: passives & gear */
  hitBonus: number;
  healBonus: number;
  hardHarm: number; // gunhand passive
  evasive: boolean; // duelist passive
  xp: number;
  loot: number;
  summon?: boolean;
  // gangs (army battles)
  gang?: boolean;
  troops?: number;
  maxTroops?: number;
  quality?: number;
  ranged?: boolean;
  faction?: string;
  leaderName?: string;
  /** used once-per-fight abilities */
  used?: Record<string, boolean>;
  kills?: number;
}

export interface Tile {
  blocked: boolean; // impassable
  cover: 0 | 1 | 2; // 1 = low cover (see over it), 2 = full cover (blocks line of sight)
  prop?: string;
  rot?: number;
  scale?: number;
  fire?: number; // burning ground turns
}

export type BattleMode = 'skirmish' | 'army';

export interface BattleContext {
  type: 'encounter' | 'job' | 'delve' | 'quest' | 'army' | 'patrol' | 'boss' | 'tutorial';
  ref?: string;
  /** army battles: which strategic army / region this represents */
  armyId?: string;
  region?: string;
  attacker?: string;
  defender?: string;
  playerAttacking?: boolean;
  canFlee: boolean;
  title: string;
  music?: string;
}

export type BattleEvent =
  | { t: 'move'; unit: string; path: [number, number][] }
  | { t: 'attack'; from: string; to: string; sfx: string; ranged: boolean; hit: boolean; dmg: number; crit?: boolean; roll?: Roll }
  | { t: 'roll'; unit: string; roll: Roll; label: string }
  | { t: 'damage'; unit: string; amount: number; kind?: 'burn' | 'psychic' | 'blast' | 'normal' }
  | { t: 'heal'; unit: string; amount: number }
  | { t: 'text'; unit: string; text: string; color?: string }
  | { t: 'death'; unit: string }
  | { t: 'downed'; unit: string }
  | { t: 'revive'; unit: string }
  | { t: 'spawn'; unit: string }
  | { t: 'blast'; x: number; y: number; r: number; kind: 'fire' | 'frag' | 'psychic' }
  | { t: 'psychic'; from: string; to: string }
  | { t: 'buff'; unit: string; kind: string }
  | { t: 'troops'; unit: string; delta: number }
  | { t: 'log'; text: string }
  | { t: 'phase'; phase: 'player' | 'ally' | 'enemy'; turn: number };

export interface Battle {
  w: number;
  h: number;
  tiles: Tile[];
  units: Unit[];
  turn: number;
  phase: 'player' | 'ally' | 'enemy';
  mode: BattleMode;
  battlemap: string;
  log: string[];
  result: null | 'win' | 'lose' | 'fled';
  context: BattleContext;
  rng: RngState;
  events: BattleEvent[];
  idc: number;
  /** starting troop totals per team for army morale */
  startTroops?: [number, number];
  /** army battles: strategic troops represented per battle trooper, per team */
  scale?: [number, number];
  /** army battles: fraction of the player's side that is their personal warband */
  warbandShare?: number;
}
