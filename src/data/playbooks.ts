import type { Stat } from '../engine/dice';

export type TargetKind = 'self' | 'ally' | 'enemy' | 'tile' | 'downed';

export interface AbilityDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cooldown: number;
  target: TargetKind;
  range: number;
  radius?: number;
  stat?: Stat;
  /** Opening your brain to the Maelstrom: misses hurt the user. */
  weird?: boolean;
  /** Only usable while leading a gang in an army battle. */
  army?: boolean;
}

export const ABILITIES: Record<string, AbilityDef> = {};
const ab = (a: AbilityDef) => (ABILITIES[a.id] = a);

// ---- universal
ab({ id: 'defend', name: 'Dig In', icon: 'defend', desc: 'Take cover and brace. +1 armor and enemies take -1 to hit you until your next turn.', cooldown: 0, target: 'self', range: 0 });

// ---- Gunhand
ab({ id: 'suppress', name: 'Suppressing Fire', icon: 'suppress', desc: 'Hose down an area (radius 1) with your weapon. Everyone caught takes harm-1 and is Pinned (cannot move next turn).', cooldown: 3, target: 'tile', range: 6, radius: 1, stat: 'hard' });
ab({ id: 'overwatch', name: 'Overwatch', icon: 'overwatch', desc: 'Watch the killing ground. Fire a free shot at the first enemy that moves within your weapon range.', cooldown: 2, target: 'self', range: 0 });
ab({ id: 'bloodbath', name: 'Bloodbath', icon: 'execute', desc: 'An all-out assault: attack with +2 harm and +1 to hit.', cooldown: 3, target: 'enemy', range: 99, stat: 'hard' });
// ---- Sawbones
ab({ id: 'patch', name: 'Patch Up', icon: 'patch', desc: 'Roll Sharp to stitch an adjacent ally (or yourself): heal 6 on 10+, 4 on 7–9, 2 on a miss.', cooldown: 2, target: 'ally', range: 1, stat: 'sharp' });
ab({ id: 'revive', name: 'Back From the Brink', icon: 'revive', desc: 'Drag a downed ally within 1 tile back to their feet with half their harm restored.', cooldown: 4, target: 'downed', range: 1, stat: 'sharp' });
ab({ id: 'triage', name: 'Field Surgery', icon: 'heal_all', desc: 'Heal every ally within 2 tiles by 4 and clear burning and pins.', cooldown: 4, target: 'self', range: 0, radius: 2 });
// ---- Duelist
ab({ id: 'flurry', name: 'Flurry', icon: 'doublestrike', desc: 'Two quick attacks against the same target.', cooldown: 2, target: 'enemy', range: 99, stat: 'cool' });
ab({ id: 'riposte', name: 'Riposte', icon: 'riposte', desc: 'Until your next turn, strike back at anyone who attacks you in melee, and take -1 harm from them.', cooldown: 2, target: 'self', range: 0 });
ab({ id: 'execute', name: 'Coup de Grâce', icon: 'execute', desc: 'Attack with +3 harm, ignoring armor, against a target already below half harm.', cooldown: 3, target: 'enemy', range: 99, stat: 'cool' });
// ---- Mindbender
ab({ id: 'mindlash', name: 'Mind Lash', icon: 'mindlash', desc: 'Open your brain and whip a mind within 6 tiles. 10+: 4 harm ignoring armor. 7–9: 3 harm, you Bleed 1. Miss: you Bleed 2.', cooldown: 1, target: 'enemy', range: 6, stat: 'weird', weird: true });
ab({ id: 'puppet', name: 'Puppet Strings', icon: 'puppet', desc: 'Seize an enemy within 5 tiles. On a hit they turn and attack their nearest ally on their next turn (7–9: you Bleed 1).', cooldown: 3, target: 'enemy', range: 5, stat: 'weird', weird: true });
ab({ id: 'brainburn', name: 'Brain Burn', icon: 'maelstrom', desc: 'The Maelstrom pours through you: 3 harm ignoring armor to every enemy within radius 1 of a point up to 6 tiles away.', cooldown: 4, target: 'tile', range: 6, radius: 1, stat: 'weird', weird: true });
// ---- Prophet
ab({ id: 'sermon', name: 'Sermon of Fire', icon: 'sermon', desc: 'Allies within 3 tiles get +1 to all rolls for 2 turns.', cooldown: 3, target: 'self', range: 0, radius: 3 });
ab({ id: 'maelstrom', name: 'Call the Maelstrom', icon: 'maelstrom', desc: 'Tear the sky open: 3 harm ignoring armor to all within radius 1 of a point up to 5 tiles away. 7–9: you Bleed 1.', cooldown: 3, target: 'tile', range: 5, radius: 1, stat: 'weird', weird: true });
ab({ id: 'grace', name: 'Martyr\'s Grace', icon: 'heal_all', desc: 'Every ally on the field heals 5; you take 2 harm.', cooldown: 5, target: 'self', range: 0 });
// ---- Road Boss
ab({ id: 'pack', name: 'Call the Pack', icon: 'pack', desc: 'Whistle up two of your gang: toughs appear beside you and fight until they drop. Once per fight.', cooldown: 99, target: 'self', range: 0 });
ab({ id: 'rally', name: 'Rally', icon: 'rally', desc: 'Allies within 3 tiles gain +1 armor for 2 turns and shake off pins.', cooldown: 3, target: 'self', range: 0, radius: 3 });
ab({ id: 'warcry', name: 'War Cry', icon: 'warcry', desc: 'Roll Hot. Enemies within 3 tiles take -1 to all rolls for 2 turns (10+: and are Pinned).', cooldown: 3, target: 'self', range: 0, radius: 3, stat: 'hot' });
// ---- Wrencher
ab({ id: 'turret', name: 'Scrap Turret', icon: 'turret', desc: 'Deploy an auto-turret on an empty tile within 2. It shoots the nearest enemy every turn. Once per fight.', cooldown: 99, target: 'tile', range: 2 });
ab({ id: 'pipebomb', name: 'Pipe Bomb', icon: 'pipebomb', desc: 'Throw a pipe bomb up to 5 tiles: 4 harm to everything within radius 1.', cooldown: 3, target: 'tile', range: 5, radius: 1, stat: 'sharp' });
ab({ id: 'overclock', name: 'Overclock', icon: 'sprint', desc: 'Jolt an adjacent ally with a jury-rigged stim-battery: they may act again this turn.', cooldown: 4, target: 'ally', range: 1 });
// ---- Siren
ab({ id: 'captivate', name: 'Captivate', icon: 'captivate', desc: 'Roll Hot against an enemy within 4. 10+: they lose their next two turns. 7–9: their next turn.', cooldown: 3, target: 'enemy', range: 4, stat: 'hot' });
ab({ id: 'kiss', name: 'Kiss of the Knife', icon: 'kiss', desc: 'Close in for a treacherous strike: +2 harm, ignores armor.', cooldown: 2, target: 'enemy', range: 99, stat: 'hot' });
ab({ id: 'heartbreak', name: 'Heartbreaker', icon: 'captivate', desc: 'Roll Hot: on a hit an enemy within 4 fights for you for 2 turns (not bosses).', cooldown: 5, target: 'enemy', range: 4, stat: 'hot' });

// ---- army orders (usable by a gang led by a hero)
ab({ id: 'o_volley', name: 'Volley', icon: 'suppress', desc: 'Your gang fires a coordinated volley at a gang up to 4 tiles away.', cooldown: 2, target: 'enemy', range: 4, stat: 'hard', army: true });
ab({ id: 'o_charge', name: 'Charge!', icon: 'charge', desc: 'Move up to 3 extra tiles and smash into an adjacent gang with +1 to the roll and +25% casualties.', cooldown: 2, target: 'enemy', range: 4, stat: 'hard', army: true });
ab({ id: 'o_zeal', name: 'Zeal', icon: 'sermon', desc: 'Adjacent friendly gangs get +1 to rolls for 2 turns.', cooldown: 3, target: 'self', range: 0, radius: 1, army: true });
ab({ id: 'o_triage', name: 'Triage', icon: 'patch', desc: 'Restore 25% of the fallen to your gang or an adjacent one.', cooldown: 3, target: 'ally', range: 1, army: true });
ab({ id: 'o_terror', name: 'Terror', icon: 'mindlash', desc: 'Psychic terror: an enemy gang within 4 loses 20% of its fighters to panic.', cooldown: 3, target: 'enemy', range: 4, stat: 'weird', weird: true, army: true });
ab({ id: 'o_parley', name: 'Parley', icon: 'captivate', desc: 'Talk an enemy gang within 3 into standing down for a turn.', cooldown: 3, target: 'enemy', range: 3, stat: 'hot', army: true });
ab({ id: 'o_bomb', name: 'Rig Charges', icon: 'pipebomb', desc: 'Blast a gang up to 3 tiles away and everything next to it.', cooldown: 3, target: 'tile', range: 3, radius: 1, stat: 'sharp', army: true });
ab({ id: 'o_challenge', name: 'Challenge', icon: 'duel', desc: 'Call out an adjacent gang\'s champion. Win and they lose 30% of their fighters.', cooldown: 3, target: 'enemy', range: 1, stat: 'cool', army: true });
ABILITIES.o_challenge.icon = 'riposte';

export interface Playbook {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  stats: Record<Stat, number>;
  hp: number;
  move: number;
  weapon: string;
  armor: string;
  gear?: string;
  abilities: [string, string, string]; // unlocked at levels 1, 3, 5
  passive: { name: string; desc: string };
  order: string; // army-battle order
  hireBase: number;
}

export const PLAYBOOKS: Record<string, Playbook> = {
  gunhand: {
    id: 'gunhand', name: 'Gunhand', tagline: 'Violence is a language. You are fluent.',
    desc: 'A walking arsenal who solves problems with volume. Hard as rebar and just as warm.',
    stats: { cool: 1, hard: 2, hot: -1, sharp: 1, weird: 0 }, hp: 16, move: 4,
    weapon: 'shotgun', armor: 'tirearmor', abilities: ['suppress', 'overwatch', 'bloodbath'],
    passive: { name: 'Battle-Hardened', desc: '+1 harm with Hard weapons.' }, order: 'o_volley', hireBase: 70,
  },
  sawbones: {
    id: 'sawbones', name: 'Sawbones', tagline: 'Somebody has to put them back together.',
    desc: 'Half-trained surgeon, half-mad saint. Keeps the crew breathing and knows exactly where to cut.',
    stats: { cool: 1, hard: 0, hot: 1, sharp: 2, weird: -1 }, hp: 12, move: 4,
    weapon: 'pistol', armor: 'leathers', gear: 'medkit', abilities: ['patch', 'revive', 'triage'],
    passive: { name: 'Healing Touch', desc: 'Crew recovers twice as fast when resting; clinic costs halved.' }, order: 'o_triage', hireBase: 80,
  },
  duelist: {
    id: 'duelist', name: 'Duelist', tagline: 'Dangerous, and knows it.',
    desc: 'Cool-headed killer, all reflexes and grace. Fights best up close, where others hesitate.',
    stats: { cool: 2, hard: 1, hot: 0, sharp: 1, weird: -1 }, hp: 13, move: 5,
    weapon: 'machete', armor: 'leathers', abilities: ['flurry', 'riposte', 'execute'],
    passive: { name: 'Untouchable', desc: 'Enemies take -1 to hit you.' }, order: 'o_challenge', hireBase: 75,
  },
  mindbender: {
    id: 'mindbender', name: 'Mindbender', tagline: 'Your brain is a door. The Maelstrom is on the other side.',
    desc: 'A psychic hollowed out by the world\'s screaming. Everyone is afraid of you, and they should be.',
    stats: { cool: 1, hard: -1, hot: 0, sharp: 1, weird: 2 }, hp: 10, move: 4,
    weapon: 'knife', armor: 'leathers', abilities: ['mindlash', 'puppet', 'brainburn'],
    passive: { name: 'Deep Brain', desc: 'Reads the Maelstrom: +1 to Weird rolls outside combat.' }, order: 'o_terror', hireBase: 90,
  },
  prophet: {
    id: 'prophet', name: 'Prophet', tagline: 'They will follow you into fire.',
    desc: 'Preacher of the Burn and its ending. Fills followers with zeal and calls the storm down on unbelievers.',
    stats: { cool: 0, hard: 0, hot: 1, sharp: -1, weird: 2 }, hp: 11, move: 4,
    weapon: 'spear', armor: 'leathers', abilities: ['sermon', 'maelstrom', 'grace'],
    passive: { name: 'Congregation', desc: 'Warband troops cost 25% less to hire.' }, order: 'o_zeal', hireBase: 70,
  },
  roadboss: {
    id: 'roadboss', name: 'Road Boss', tagline: 'Your gang. Your road. Your rules.',
    desc: 'A chrome-and-leather gang leader who never rides alone. Commands respect with a word or a chain.',
    stats: { cool: 0, hard: 2, hot: 1, sharp: 0, weird: -1 }, hp: 15, move: 4,
    weapon: 'pipe', armor: 'tirearmor', abilities: ['pack', 'rally', 'warcry'],
    passive: { name: 'Pack Leader', desc: 'Your warband can hold 50% more troops; gangs you lead in battle fight harder.' }, order: 'o_charge', hireBase: 85,
  },
  wrencher: {
    id: 'wrencher', name: 'Wrencher', tagline: 'Give me scrap and an hour.',
    desc: 'Savvy tinker who hears machines talk. Builds turrets from trash and bombs from breakfast.',
    stats: { cool: 0, hard: 0, hot: -1, sharp: 2, weird: 1 }, hp: 12, move: 4,
    weapon: 'crossbow', armor: 'leathers', abilities: ['turret', 'pipebomb', 'overclock'],
    passive: { name: 'Salvager', desc: 'Finds 50% more barter when looting and scavenging.' }, order: 'o_bomb', hireBase: 75,
  },
  siren: {
    id: 'siren', name: 'Siren', tagline: 'Everybody wants something. You know what.',
    desc: 'Beautiful, magnetic and lethal. Talks enemies into mistakes and slips the knife in while they smile.',
    stats: { cool: 1, hard: -1, hot: 2, sharp: 1, weird: 0 }, hp: 11, move: 4,
    weapon: 'knife', armor: 'leathers', abilities: ['captivate', 'kiss', 'heartbreak'],
    passive: { name: 'Silver Tongue', desc: 'Market prices 15% better; crew hire costs 20% less.' }, order: 'o_parley', hireBase: 70,
  },
};

export const PLAYBOOK_IDS = Object.keys(PLAYBOOKS);
