import type { Stat } from '../engine/dice';

export type ItemKind = 'weapon' | 'armor' | 'gear' | 'consumable' | 'quest';

/**
 * Weapon tags (Apocalypse-World style):
 *  messy  – strong hits deal +1 extra harm
 *  ap     – ignores armor
 *  area   – also hits everything adjacent to the target
 *  close  – +1 harm at range 2 or less
 *  far    – no long-range penalty, but -1 to hit adjacent targets
 *  burn   – sets the target burning (1 harm/turn for 2 turns)
 *  reach  – melee weapon that strikes 2 tiles away
 *  quick  – +1 to hit
 *  heavy  – -1 to hit
 *  burst  – rolls two attacks
 */
export type WeaponTag = 'messy' | 'ap' | 'area' | 'close' | 'far' | 'burn' | 'reach' | 'quick' | 'heavy' | 'burst' | 'loud';

export interface WeaponStats {
  harm: number;
  range: number; // 1 = adjacent melee
  stat: Stat;
  tags: WeaponTag[];
  sfx: 'blade' | 'blunt' | 'pistol' | 'rifle' | 'shotgun' | 'auto' | 'bow' | 'flame' | 'laser' | 'bite';
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  icon: string;
  price: number;
  desc: string;
  /** 0 = never sold, only found. 1..4 = shop tier (higher tiers appear in richer markets). */
  tier: number;
  weapon?: WeaponStats;
  armor?: { armor: number; move?: number; hp?: number; bonus?: Partial<Record<Stat, number>> };
  gear?: { bonus?: Partial<Record<Stat, number>>; hit?: number; heal?: number; travel?: number; armor?: number };
  use?: { effect: 'heal' | 'molotov' | 'grenade' | 'dampener' | 'medkit'; amount: number; range?: number; radius?: number };
}

const W = (
  id: string, name: string, price: number, tier: number, desc: string,
  harm: number, range: number, stat: Stat, tags: WeaponTag[], sfx: WeaponStats['sfx'], icon = id,
): ItemDef => ({ id, name, kind: 'weapon', icon, price, tier, desc, weapon: { harm, range, stat, tags, sfx } });

export const ITEMS: Record<string, ItemDef> = {};
const add = (i: ItemDef) => (ITEMS[i.id] = i);

// ---------------------------------------------------------------- weapons
add(W('fists', 'Bare Knuckles', 0, 0, 'When all else is gone, there are still your hands.', 1, 1, 'hard', ['quick'], 'blunt', 'melee'));
add(W('knife', 'Scav Knife', 12, 1, 'Taped handle, filed edge. Quick and quiet.', 2, 1, 'cool', ['quick'], 'blade'));
add(W('pipe', 'Spiked Pipe', 18, 1, 'A length of lead pipe wrapped in barbed wire.', 3, 1, 'hard', [], 'blunt'));
add(W('crowbar', 'Crowbar', 10, 1, 'Opens doors. Opens skulls.', 2, 1, 'hard', ['quick'], 'blunt'));
add(W('machete', 'Notched Machete', 28, 1, 'Every notch is a story nobody wants to hear.', 3, 1, 'hard', ['messy'], 'blade'));
add(W('spear', 'Rebar Spear', 24, 1, 'Keeps the biters at arm\'s length. Strikes two tiles away.', 3, 2, 'hard', ['reach'], 'blade'));
add(W('sledge', 'Sledgehammer', 60, 2, 'Slow. Final.', 4, 1, 'hard', ['messy', 'heavy'], 'blunt'));
add(W('chainsaw', 'Chainsaw', 150, 3, 'Runs on a cupful of fuel and pure hatred.', 5, 1, 'hard', ['messy', 'loud', 'heavy'], 'blade'));
add(W('pistol', '9mm Pistol', 35, 1, 'Reliable-ish. Ammo is the real currency.', 2, 5, 'cool', ['quick'], 'pistol'));
add(W('revolver', 'Long Revolver', 75, 2, 'Six chances to change your mind.', 3, 6, 'cool', [], 'pistol'));
add(W('shotgun', 'Sawn-off', 80, 2, 'Brutal up close; worthless past a stone\'s throw.', 3, 3, 'hard', ['close', 'messy', 'loud'], 'shotgun'));
add(W('crossbow', 'Spring Crossbow', 90, 2, 'Car-spring limbs, sharpened rebar bolts. Punches through armor.', 3, 7, 'cool', ['ap'], 'bow'));
add(W('rifle', 'Hunting Rifle', 110, 2, 'Scoped and patient.', 3, 10, 'cool', ['far'], 'rifle'));
add(W('smg', 'Grease Gun', 150, 3, 'Sprays two bursts each trigger pull.', 2, 5, 'hard', ['burst', 'loud'], 'auto'));
add(W('assault', 'Assault Rifle', 230, 3, 'Military-grade. Somebody died for this and so will you.', 3, 8, 'hard', ['loud', 'burst'], 'auto'));
add(W('flamer', 'Flamer', 280, 4, 'Pressurised fuel and a pilot light. Burns everything near the target.', 3, 3, 'hard', ['area', 'burn', 'loud'], 'flame'));
add(W('laser', 'Heritage Lancer', 0, 0, 'A pre-Burn energy pistol. Hums like it remembers the old world.', 4, 8, 'cool', ['ap'], 'laser'));
add(W('kingsblade', 'Ember Crown-Blade', 0, 0, 'The Burnt King\'s own blade, still warm.', 5, 1, 'hard', ['messy', 'burn'], 'blade', 'machete'));

// ---------------------------------------------------------------- armor
const A = (id: string, name: string, price: number, tier: number, desc: string, armor: number, extra: Partial<NonNullable<ItemDef['armor']>> = {}): ItemDef =>
  ({ id, name, kind: 'armor', icon: id, price, tier, desc, armor: { armor, ...extra } });
add(A('leathers', 'Road Leathers', 22, 1, 'Patched leather. Better than skin.', 1));
add(A('tirearmor', 'Tire Armor', 40, 1, 'Cut tires and strapping. Heavy but it soaks punishment.', 1, { hp: 3 }));
add(A('scrapplate', 'Scrap Plate', 75, 2, 'Hammered car panels. Clanks when you walk.', 2, { move: -1 }));
add(A('kevlar', 'Kevlar Vest', 170, 3, 'Old-world military vest. Light and tough.', 2));
add(A('riot', 'Riot Armor', 320, 4, 'Full riot kit with helmet. You are a walking wall.', 3, { move: -1 }));
add(A('powerharness', 'Power Harness', 0, 0, 'Heritage exoskeleton. Servos whine; your fists hit like trucks.', 3, { bonus: { hard: 1 } }));

// ---------------------------------------------------------------- gear (trinket slot)
const G = (id: string, name: string, price: number, tier: number, desc: string, gear: NonNullable<ItemDef['gear']>): ItemDef =>
  ({ id, name, kind: 'gear', icon: id, price, tier, desc, gear });
add(G('goggles', 'Brass Goggles', 45, 1, 'See the dust before it sees you. +1 Sharp.', { bonus: { sharp: 1 } }));
add(G('charm', 'Bone Charm', 45, 1, 'Bullets and knuckle bones on a cord. +1 Cool.', { bonus: { cool: 1 } }));
add(G('scope', 'Salvaged Scope', 90, 2, '+1 to hit with ranged weapons.', { hit: 1 }));
add(G('medkit', 'Field Medkit', 80, 2, 'Healing you give restores +2 more.', { heal: 2 }));
add(G('map', 'Waymaker\'s Map', 70, 2, 'Shortcuts and dry wells. Travel is 1 day faster (min 1).', { travel: 1 }));
add(G('tome', 'Scorched Codex', 120, 3, 'Its pages whisper. +1 Weird.', { bonus: { weird: 1 } }));
add(G('relic', 'Heritage Relic', 0, 0, 'A humming pre-Burn device. +1 Weird, +1 armor.', { bonus: { weird: 1 }, armor: 1 }));
add(G('crown', 'Warlord\'s Signet', 0, 0, 'A ring that makes hard people kneel. +1 Hot, +1 Hard.', { bonus: { hot: 1, hard: 1 } }));

// ---------------------------------------------------------------- consumables
const C = (id: string, name: string, price: number, tier: number, desc: string, use: NonNullable<ItemDef['use']>): ItemDef =>
  ({ id, name, kind: 'consumable', icon: id, price, tier, desc, use });
add(C('bandage', 'Bandages & Salve', 10, 1, 'Heals 3 harm. Usable in and out of combat.', { effect: 'heal', amount: 3, range: 1 }));
add(C('stim', 'Stim Shot', 28, 1, 'Heals 6 harm. Usable in and out of combat.', { effect: 'heal', amount: 6, range: 1 }));
add(C('medkit_c', 'Surgeon\'s Kit', 60, 2, 'Heals 12 harm. Out of combat, heals the whole crew by 5.', { effect: 'medkit', amount: 12, range: 1 }));
ITEMS.medkit_c.icon = 'medkit';
add(C('molotov', 'Molotov', 20, 1, 'Thrown up to 5 tiles. 2 harm to all in the blast and sets them burning.', { effect: 'molotov', amount: 2, range: 5, radius: 1 }));
add(C('grenade', 'Frag Grenade', 45, 2, 'Thrown up to 5 tiles. 4 harm to all in the blast.', { effect: 'grenade', amount: 4, range: 5, radius: 1 }));
add(C('dampener', 'Blue Hush', 35, 2, 'Psychic dampener. Clears all ailments and ability cooldowns for one crew member.', { effect: 'dampener', amount: 0 }));

// ---------------------------------------------------------------- quest items
const Q = (id: string, name: string, desc: string, icon: string): ItemDef => ({ id, name, kind: 'quest', icon, price: 0, tier: 0, desc });
add(Q('keycard', 'Kiln Access Keycard', 'A cracked pre-Burn keycard stamped with the reactor\'s sigil. It opens the service tunnels under the Kiln.', 'keycard'));
add(Q('blackbox', 'The Tower Tape', 'A recording of the Burnt King\'s plan, taken from the Radio Tower. Warlords may listen to it.', 'tome'));

export function item(id: string): ItemDef {
  const i = ITEMS[id];
  if (!i) throw new Error(`unknown item ${id}`);
  return i;
}

export const SHOP_ITEMS = Object.values(ITEMS).filter((i) => i.tier > 0);
