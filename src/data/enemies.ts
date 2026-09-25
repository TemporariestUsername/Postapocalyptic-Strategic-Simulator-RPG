import type { Stat } from '../engine/dice';

export interface EnemyDef {
  id: string;
  name: string;
  portrait: string;
  hp: number;
  armor: number;
  move: number;
  stats: Record<Stat, number>;
  weapon: string;
  abilities?: string[];
  xp: number;
  loot: number; // barter dropped
  boss?: boolean;
  /** AI archetype */
  ai: 'melee' | 'ranged' | 'psychic' | 'beast' | 'support';
  desc: string;
}

const S = (cool: number, hard: number, hot: number, sharp: number, weird: number) => ({ cool, hard, hot, sharp, weird });

export const ENEMIES: Record<string, EnemyDef> = {
  burnlad: { id: 'burnlad', name: 'Burnlad', portrait: 'enemies/burnlad', hp: 10, armor: 1, move: 4, stats: S(0, 1, -1, 0, 0), weapon: 'machete', xp: 14, loot: 6, ai: 'melee',
    desc: 'Branded fanatic of the Burnt King. Charges without fear.' },
  burnlad_gun: { id: 'burnlad_gun', name: 'Burnlad Gunner', portrait: 'enemies/burnlad', hp: 9, armor: 1, move: 4, stats: S(1, 1, -1, 0, 0), weapon: 'rifle', xp: 15, loot: 8, ai: 'ranged',
    desc: 'Burnlad sharpshooter. Hangs back in cover.' },
  kilnguard: { id: 'kilnguard', name: 'Kiln Guard', portrait: 'enemies/kilnguard', hp: 18, armor: 2, move: 3, stats: S(0, 2, -1, 0, 0), weapon: 'sledge', xp: 30, loot: 15, ai: 'melee',
    desc: 'Walking furnace in welded plate. Slow, relentless, very hard to put down.' },
  raider: { id: 'raider', name: 'Road Raider', portrait: 'enemies/raider', hp: 9, armor: 1, move: 5, stats: S(0, 1, 0, 0, -1), weapon: 'shotgun', xp: 12, loot: 8, ai: 'melee',
    desc: 'Chrome-mad highway bandit.' },
  warboss: { id: 'warboss', name: 'Raider Warboss', portrait: 'enemies/warboss', hp: 22, armor: 2, move: 4, stats: S(1, 2, 1, 0, -1), weapon: 'chainsaw', abilities: ['warcry'], xp: 45, loot: 40, ai: 'melee', boss: true,
    desc: 'A mountain of scar tissue with a car hood for a pauldron.' },
  cultist: { id: 'cultist', name: 'Ash Cultist', portrait: 'enemies/cultist', hp: 8, armor: 0, move: 4, stats: S(0, 0, 0, 0, 1), weapon: 'knife', abilities: ['mindlash'], xp: 12, loot: 4, ai: 'psychic',
    desc: 'Choir faithful. Whispers the storm into your skull.' },
  psyker: { id: 'psyker', name: 'Choir Screamer', portrait: 'enemies/psyker', hp: 9, armor: 0, move: 4, stats: S(0, -1, 0, 1, 2), weapon: 'knife', abilities: ['mindlash', 'maelstrom'], xp: 22, loot: 10, ai: 'psychic',
    desc: 'A psychic whose eyes leak violet light. Keep her busy or keep her dead.' },
  hollow: { id: 'hollow', name: 'Hollow', portrait: 'enemies/hollow', hp: 12, armor: 0, move: 4, stats: S(0, 1, -2, 0, 2), weapon: 'fists', abilities: ['mindlash'], xp: 18, loot: 2, ai: 'psychic',
    desc: 'What the Maelstrom leaves behind when it is done with a person.' },
  militia: { id: 'militia', name: 'Iron Rifleman', portrait: 'enemies/militia', hp: 10, armor: 1, move: 4, stats: S(1, 1, 0, 1, -1), weapon: 'rifle', xp: 14, loot: 8, ai: 'ranged',
    desc: 'Drilled militia marksman of the Iron Hundred.' },
  pumpthug: { id: 'pumpthug', name: 'Pump Thug', portrait: 'enemies/pumpthug', hp: 12, armor: 1, move: 4, stats: S(0, 1, 0, 0, -1), weapon: 'pipe', xp: 13, loot: 9, ai: 'melee',
    desc: 'Rubber-suited enforcer with a wrench and a grudge.' },
  ratman: { id: 'ratman', name: 'Tunnel Rat', portrait: 'enemies/ratman', hp: 7, armor: 0, move: 5, stats: S(1, 0, -1, 1, 0), weapon: 'knife', xp: 9, loot: 4, ai: 'melee',
    desc: 'Pale mutant scuttler. Never alone.' },
  saltguard: { id: 'saltguard', name: 'Caravan Guard', portrait: 'enemies/saltguard', hp: 10, armor: 1, move: 4, stats: S(1, 1, 0, 0, -1), weapon: 'crossbow', xp: 14, loot: 10, ai: 'ranged',
    desc: 'Salt-crusted mercenary with a car-spring crossbow.' },
  scav: { id: 'scav', name: 'Scavenger', portrait: 'enemies/scav', hp: 7, armor: 0, move: 4, stats: S(0, 0, 0, 0, 0), weapon: 'pistol', xp: 8, loot: 5, ai: 'ranged',
    desc: 'Starving and desperate. That makes them dangerous.' },
  hound: { id: 'hound', name: 'Ash Hound', portrait: 'enemies/hound', hp: 7, armor: 0, move: 6, stats: S(1, 1, -2, 1, -1), weapon: 'fists', xp: 8, loot: 0, ai: 'beast',
    desc: 'Mangy mutant dog. Hunts in packs.' },
  crawler: { id: 'crawler', name: 'Sump Crawler', portrait: 'enemies/crawler', hp: 16, armor: 2, move: 3, stats: S(0, 2, -3, 0, 0), weapon: 'fists', xp: 22, loot: 6, ai: 'beast',
    desc: 'River mutant with a carapace like a car door.' },
  glowbug: { id: 'glowbug', name: 'Glowbug', portrait: 'enemies/glowbug', hp: 6, armor: 0, move: 5, stats: S(1, 0, -3, 0, 1), weapon: 'fists', xp: 7, loot: 1, ai: 'beast',
    desc: 'Dog-sized insect with a glowing, acidic gut.' },
  ozmyr: { id: 'ozmyr', name: 'Ozmyr, the Burnt King', portrait: 'warlords/ozmyr', hp: 46, armor: 2, move: 4, stats: S(2, 3, 2, 1, 3), weapon: 'kingsblade', abilities: ['maelstrom', 'warcry', 'brainburn'], xp: 300, loot: 500, ai: 'melee', boss: true,
    desc: 'The Burnt King himself. The Maelstrom burns inside him like a second heart.' },
  champion: { id: 'champion', name: 'Warlord\'s Champion', portrait: 'enemies/warboss', hp: 24, armor: 2, move: 4, stats: S(1, 2, 0, 1, 0), weapon: 'sledge', abilities: ['warcry'], xp: 50, loot: 40, ai: 'melee', boss: true,
    desc: 'The finest killer in the warlord\'s host.' },
};

/** Beasts and ruin-dwellers by encounter theme. */
export const WILD_GROUPS: Record<string, string[][]> = {
  wastes: [['hound', 'hound', 'hound'], ['scav', 'scav', 'scav'], ['raider', 'raider', 'scav'], ['glowbug', 'glowbug', 'glowbug', 'glowbug']],
  ruins: [['glowbug', 'glowbug', 'hound'], ['scav', 'scav', 'hollow'], ['hollow', 'hollow'], ['crawler', 'glowbug', 'glowbug']],
  sewer: [['ratman', 'ratman', 'ratman', 'ratman'], ['crawler', 'ratman', 'ratman']],
  maelstrom: [['hollow', 'hollow', 'hollow'], ['psyker', 'hollow', 'cultist']],
};
