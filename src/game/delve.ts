import type { Scene } from './scenes';
import { fxBarter, fxHarmAll, fxHarmOne, fxHealAll, fxItem, fxXp, pickLoot, tierFor, crewHas } from './scenes';
import type { DelveRoom, GameState } from './types';
import { rngOf } from './util';

export interface DelveDef {
  id: string;
  name: string;
  region: string;
  desc: string;
  rooms: number;
  images: string[];
  battlemap: string;
  groups: string[][];
  boss: string[];
  bossName: string;
  reward: string[];
  tierBump: number;
}

export const DELVES: Record<string, DelveDef> = {
  northstack: {
    id: 'northstack', name: 'The Turbine Halls', region: 'northstack', tierBump: 1,
    desc: 'The reactor annex. Burnlad sentries guard the upper halls; below, the switching rooms hum with something that is not electricity.',
    rooms: 5, images: ['delve/corridor', 'delve/reactor', 'delve/stairs', 'delve/archive', 'delve/lab'], battlemap: 'industrial',
    groups: [['burnlad', 'burnlad', 'burnlad_gun'], ['hollow', 'hollow', 'glowbug'], ['burnlad', 'kilnguard'], ['glowbug', 'glowbug', 'glowbug', 'hound']],
    boss: ['kilnguard', 'kilnguard', 'burnlad_gun', 'burnlad_gun'], bossName: 'The Furnace Wardens', reward: ['powerharness'],
  },
  blackglass: {
    id: 'blackglass', name: 'The Glassed Command Bunker', region: 'blackglass', tierBump: 0,
    desc: 'A pre-Burn command bunker fused shut by the blast that made the crater. The Choir says it is haunted. The Choir is right.',
    rooms: 5, images: ['delve/stairs', 'delve/corridor', 'delve/shrine', 'delve/archive', 'delve/vault'], battlemap: 'glass',
    groups: [['hollow', 'hollow'], ['cultist', 'cultist', 'hollow'], ['glowbug', 'glowbug', 'hollow'], ['psyker', 'cultist']],
    boss: ['psyker', 'hollow', 'hollow', 'cultist'], bossName: 'The Screaming Vault', reward: ['keycard', 'relic'],
  },
  spirefall: {
    id: 'spirefall', name: 'Spirefall Tower', region: 'spirefall', tierBump: 1,
    desc: 'A drowned skyscraper. The lower floors are Rat King hunting grounds; the upper floors hold a pre-Burn armory, if the stories are true.',
    rooms: 6, images: ['delve/subway', 'delve/stairs', 'delve/ward', 'delve/corridor', 'delve/archive', 'delve/vault'], battlemap: 'street',
    groups: [['ratman', 'ratman', 'ratman'], ['crawler', 'glowbug'], ['ratman', 'ratman', 'crawler'], ['glowbug', 'glowbug', 'glowbug', 'glowbug']],
    boss: ['crawler', 'crawler', 'ratman', 'ratman', 'ratman'], bossName: 'The Broodmother\'s Court', reward: ['laser'],
  },
  airfield: {
    id: 'airfield', name: 'The Buried Airfield', region: 'whisperdunes', tierBump: 0,
    desc: 'Hangars swallowed by the dunes. Scavenger clans fight over the carcasses of the old flying machines.',
    rooms: 5, images: ['delve/hangar', 'delve/corridor', 'delve/stairs', 'delve/hangar', 'delve/vault'], battlemap: 'sand',
    groups: [['scav', 'scav', 'scav'], ['hound', 'hound', 'hound'], ['raider', 'raider', 'scav'], ['scav', 'raider', 'hound']],
    boss: ['warboss', 'raider', 'raider', 'scav'], bossName: 'King of the Hangars', reward: ['assault', 'kevlar'],
  },
  kiln: {
    id: 'kiln', name: 'The Heart of the Kiln', region: 'kiln', tierBump: 2,
    desc: 'The service tunnels beneath the reactor, leading up to the Burnt King\'s throne.',
    rooms: 4, images: ['delve/corridor', 'delve/reactor', 'delve/stairs', 'delve/reactor'], battlemap: 'kiln',
    groups: [['burnlad', 'burnlad', 'burnlad_gun', 'burnlad'], ['kilnguard', 'burnlad_gun', 'burnlad'], ['kilnguard', 'kilnguard', 'burnlad']],
    boss: ['ozmyr', 'kilnguard', 'kilnguard'], bossName: 'The Burnt King', reward: ['kingsblade', 'crown'],
  },
};

export function startDelve(s: GameState, id: string): void {
  const def = DELVES[id];
  const rng = rngOf(s);
  const rooms: DelveRoom[] = [];
  const kinds: DelveRoom['type'][] = id === 'kiln' ? ['fight', 'fight', 'trap'] : ['fight', 'fight', 'trap', 'loot', 'shrine', 'rest', 'fight'];
  rng.shuffle(kinds);
  for (let i = 0; i < def.rooms - 1; i++) rooms.push({ type: kinds[i % kinds.length], image: def.images[i % def.images.length], done: false });
  // guarantee a fight early and the boss at the end
  if (!rooms.some((r) => r.type === 'fight')) rooms[0].type = 'fight';
  rooms.push({ type: 'boss', image: def.images[def.images.length - 1], done: false });
  s.delve = { id, room: 0, rooms };
}

export function delveFight(s: GameState, boss: boolean) {
  const d = s.delve!;
  const def = DELVES[d.id];
  const rng = rngOf(s);
  const tier = tierFor(s, def.tierBump);
  let ids = boss ? def.boss : rng.pick(def.groups);
  // the Kiln's defenders grow with the garrison left inside
  if (d.id === 'kiln' && !boss) {
    const extra = Math.min(3, Math.floor(s.regions.kiln.garrison / 60));
    ids = [...ids, ...Array(extra).fill('burnlad')];
  }
  return {
    enemies: ids.map((id) => ({ id, tier })),
    battlemap: def.battlemap,
    context: { type: (d.id === 'kiln' && boss ? 'boss' : 'delve') as 'boss' | 'delve', ref: d.id, canFlee: !boss || d.id !== 'kiln', title: boss ? def.bossName : def.name, music: boss && d.id === 'kiln' ? 'boss' : undefined },
  };
}

/** Non-combat rooms become scenes. */
export function delveRoomScene(s: GameState): Scene {
  const d = s.delve!;
  const def = DELVES[d.id];
  const room = d.rooms[d.room];
  const done = () => { room.done = true; };
  switch (room.type) {
    case 'trap':
      return {
        id: 'd_trap', title: 'A Tripwire Glints', image: room.image, text: 'The corridor ahead is too clean. Wires, a pressure plate, the faint smell of old explosive. Somebody did not want visitors.',
        choices: [
          { label: 'Disarm it', stat: 'sharp', bonus: crewHas(s, 'wrencher') ? 1 : 0, hint: crewHas(s, 'wrencher') ? 'Wrencher +1' : undefined, resolve: (_s, r) => {
            done();
            if (r!.outcome === 'strong') return { text: 'You disarm it and salvage the charge.', effects: [fxItem(s, 'grenade'), fxXp(s, 10)] };
            if (r!.outcome === 'weak') return { text: 'It goes off, but you were ready for it.', effects: [fxHarmOne(s, 2), fxXp(s, 6)] };
            return { text: 'The blast fills the corridor with fire and shrapnel.', effects: [fxHarmAll(s, 3)] };
          } },
          { label: 'Find another way around', stat: 'cool', resolve: (_s, r) => {
            done();
            return r!.outcome !== 'miss' ? { text: 'A ventilation shaft leads past the trap.', effects: [fxXp(s, 6)] } : { text: 'The shaft collapses under you.', effects: [fxHarmAll(s, 2)] };
          } },
        ],
      };
    case 'loot':
      return {
        id: 'd_loot', title: 'A Forgotten Cache', image: room.image, text: 'Lockers, crates, a desk with its drawers still shut. Nobody has been here in fifty years.',
        choices: [
          { label: 'Search thoroughly', stat: 'sharp', resolve: (_s, r) => {
            done();
            const fx = [fxBarter(s, r!.outcome === 'strong' ? 40 : 20)];
            if (r!.outcome !== 'miss') fx.push(fxItem(s, pickLoot(s, r!.outcome === 'strong' ? 4 : 2)));
            return { text: 'You turn the room inside out.', effects: fx };
          } },
        ],
      };
    case 'shrine':
      return {
        id: 'd_shrine', title: 'A Maelstrom Shrine', image: 'delve/shrine', text: 'Someone built a shrine here: candles still burning, sigils painted in violet, offerings of teeth and bullets. The air hums. The storm is very close to the surface here.',
        choices: [
          { label: 'Open your brain to the shrine', stat: 'weird', resolve: (_s, r) => {
            done();
            if (r!.outcome === 'strong') return { text: 'The storm pours strength into you and then, politely, withdraws.', effects: [fxHealAll(s, 8), fxXp(s, 20)] };
            if (r!.outcome === 'weak') return { text: 'Visions, fragments, a terrible hunger. You learn something, and it costs you.', effects: [fxXp(s, 15), fxHarmOne(s, 3)] };
            return { text: 'The shrine screams back.', effects: [fxHarmAll(s, 3)] };
          } },
          { label: 'Take the offerings', resolve: () => { done(); return { text: 'Bullets and barter, left for a god that is not here.', effects: [fxBarter(s, 25)] }; } },
          { label: 'Leave it be', resolve: () => { done(); return { text: 'You pass the shrine without looking at it. It watches you go.' }; } },
        ],
      };
    case 'rest':
    default:
      return {
        id: 'd_rest', title: 'A Sealed Room', image: room.image, text: `A room with a door that still locks. For the first time since you entered ${def.name}, you can breathe.`,
        choices: [
          { label: 'Rest and bind wounds', resolve: () => { done(); return { text: 'You sleep in shifts.', effects: [fxHealAll(s, 7)] }; } },
        ],
      };
  }
}

export function delveReward(s: GameState): string[] {
  const d = s.delve!;
  const def = DELVES[d.id];
  const fx: string[] = [];
  for (const id of def.reward) {
    if (id === 'keycard') {
      s.quest.keycard = true;
      fx.push('Found: Kiln Access Keycard');
      s.stash.keycard = 1;
    } else fx.push(fxItem(s, id));
  }
  fx.push(fxBarter(s, 60 + def.tierBump * 40));
  fx.push(fxXp(s, 40));
  s.regions[def.region].delveCleared = true;
  s.stats.delves++;
  return fx;
}
