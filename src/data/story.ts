import type { Scene } from '../game/scenes';
import { fxItem, fxRep, fxXp, tierFor } from '../game/scenes';
import type { GameState } from '../game/types';
import { adjustRelation } from '../game/sim';
import { news } from '../game/util';
import { FACTIONS } from './factions';

export const INTRO_SLIDES = [
  { image: 'story/intro1', text: 'Nobody remembers why the world burned. Only that it did — cities, highways, the sky itself. When the fires finally went out, the survivors called what was left the Burnlands.' },
  { image: 'story/intro2', text: 'Fifty-seven years later, the storm still howls. Not the one in the sky — the one underneath. The Maelstrom: every scream the world ever made, echoing forever. Some people can hear it. Most wish they couldn\'t.' },
  { image: 'story/intro3', text: 'Seven warlords carve up the basin between them: oil barons, cult mothers, road queens and rat kings. They trade, they raid, they betray. Holds change hands every season.' },
  { image: 'story/intro4', text: 'And in the dead reactor they call the Kiln, the Burnt King is listening to the storm. His Burnlads march further every year. They say he means to set the whole world on fire again. They say he can.' },
  { image: 'story/intro5', text: 'You are nobody. A drifter with a weapon and a name. But the road has brought you to Hope\'s Rest, the last free hold in the Burnlands — on the very day the Burnlads come for it.' },
];

export function storyScene(s: GameState, id: string): Scene | null {
  const pc = s.crew[0];
  const comp = s.crew[1];
  switch (id) {
    case 'arrival':
      return {
        id, title: 'Hope\'s Rest', image: 'towns/hopesrest', portrait: 'npcs/nell', speaker: 'Old Nell',
        text: `An old woman with a shotgun meets you at the gate. "Another drifter. Well, you picked a bad day, ${pc.name}. Burnlads have been circling since dawn." A bell starts clanging on the wall. "Aaand there they are. ${comp?.name ?? 'Mercy'}, get to the gate! You — if you can fight, now's the time to prove it."`,
        choices: [
          { label: 'Draw your weapon', resolve: () => ({
            text: 'Four branded raiders come howling out of the smoke.',
            fight: { enemies: [{ id: 'burnlad', tier: 0 }, { id: 'burnlad', tier: 0 }, { id: 'burnlad_gun', tier: 0 }], battlemap: 'farm', context: { type: 'tutorial', ref: 'raid', canFlee: false, title: 'Raid on Hope\'s Rest' } },
          }) },
        ],
      };
    case 'after_raid':
      return {
        id, title: 'Smoke Over the Fields', image: 'towns/hopesrest', portrait: 'npcs/nell', speaker: 'Old Nell',
        text: `Nell spits on a dead Burnlad. "Every month, closer. The Burnt King wants the whole basin kneeling or burning, and he's winning." She looks you over. "You fight well. Keep ${comp?.name ?? 'Mercy'} — they're wasted on a farm. And listen: there's a madwoman in the old Radio Tower out on Ember Road, broadcasting warnings every night. Says she knows what the King is planning. If anyone can find out, it's someone like you."`,
        choices: [
          { label: '"I\'ll go to the Tower."', resolve: () => {
            s.quest.stage = 1;
            s.barter += 30;
            return { text: 'Nell nods and presses a pouch of barter into your hand. "For the road. Come back alive."', effects: [fxItem(s, 'stim'), '+30 barter', 'New objective: Visit the Radio Tower at Ember Road'] };
          } },
        ],
      };
    case 'tower':
      return {
        id, title: 'The Voice in the Tower', image: 'events/tower', portrait: 'npcs/voice', speaker: 'The Voice',
        text: '"Come in, come in, the storm told me you\'d come." An old woman with milk-white eyes sits among humming radio tubes. "I listen. That\'s all I do. And I heard him — the Burnt King — talking to the Maelstrom through his dead reactor. He\'s going to wake it. Start the core. When it wakes, the storm comes up through the ground and it does not stop. Everything burns again. Everything."',
        choices: [
          { label: '"How long do we have?"', resolve: () => {
            s.quest.stage = 2;
            s.quest.burnRevealed = true;
            s.quest.tape = true;
            s.stash.blackbox = 1;
            news(s, 'You learned of the Great Burn: the Burnt King means to wake the Kiln\'s reactor.', 'player');
            return {
              text: `"Years. Not many. The storm counts it in heartbeats." She presses a tape into your hands. "His own voice, recorded off the air. Play it to the warlords. They won't unite for you — but they might unite against HIM. And there are old tunnels under the Kiln. The keys were kept in the glassed bunker at Blackglass Rise. Go. Go, before I forget you were here."`,
              effects: ['Received: The Tower Tape', 'The Great Burn countdown has begun', 'New objectives: Rally the warlords · Find a way into the Kiln', fxXp(s, 30)],
            };
          } },
        ],
      };
    case 'keycard':
      return {
        id, title: 'The Kiln Keycard', image: 'delve/vault',
        text: 'In the bunker\'s deepest vault, among the bones of officers who died at their posts, you find it: a cracked keycard stamped with the reactor\'s sigil. The service tunnels under the Kiln are open to you now — if you are brave enough, or mad enough, to use them.',
        choices: [{ label: 'Pocket the keycard', resolve: () => ({ text: 'Infiltration is now possible from any region bordering the Kiln.' }) }],
      };
    case 'final':
      return {
        id, title: 'The Throne of Turbines', image: 'story/intro4', portrait: 'warlords/ozmyr', speaker: 'Ozmyr, the Burnt King', music: 'boss',
        text: '"So. The drifter." The Burnt King rises from his throne of welded turbine blades, and the air around him ripples with heat. "You have fought so hard to save a world that is already dead. Listen — can you hear it? The storm is singing. It wants to come home. I am only opening the door." Embers drift from the cracks in his skin. "Kneel, and burn clean with the rest. Or stand, and burn now."',
        choices: [
          { label: '"I\'ll stand."', resolve: () => ({
            text: 'The Burnt King draws his blade, and the reactor behind him roars.',
            fight: { enemies: [{ id: 'ozmyr', tier: Math.max(2, tierFor(s)) }, { id: 'kilnguard', tier: Math.max(2, tierFor(s)) }, { id: 'kilnguard', tier: Math.max(2, tierFor(s)) }], battlemap: 'kiln', context: { type: 'boss', ref: 'ozmyr', canFlee: false, title: 'The Burnt King', music: 'boss' } },
          }) },
        ],
      };
    default:
      return null;
  }
}

/** Playing the Tower Tape for a warlord: the chance they join the coalition. */
export function tapeScene(s: GameState, fid: string): Scene {
  const def = FACTIONS[fid];
  const f = s.factions[fid];
  return {
    id: 'tape', title: `The Tape for ${def.leader}`, image: 'interiors/hall', portrait: def.portrait, speaker: def.leader,
    text: `The hall goes quiet as the tape crackles. The Burnt King's voice fills the room, calm and terrible, speaking to something that answers in screams. When it ends, ${def.leader} stares at the machine for a long time.`,
    choices: [
      { label: 'Make the case for war against the King', stat: 'hot', bonus: f.rep >= 40 ? 2 : f.rep >= 15 ? 1 : f.rep < -10 ? -1 : 0, hint: f.rep >= 15 ? 'Good reputation helps' : f.rep < -10 ? 'Poor reputation hurts' : undefined,
        resolve: (_s, r) => {
          f.heardTape = true;
          if (r!.outcome === 'miss') return { text: `"A trick. Some Choir madness on a tape." ${def.leader} waves you away. "Come back when you have proof I can hold in my hand."`, effects: [fxRep(s, fid, -5)] };
          f.coalition = true;
          s.quest.coalition++;
          adjustRelation(s, fid, 'cinder', -100);
          news(s, `${def.name} joins the coalition against the Burnt King!`, 'diplo', { faction: fid });
          const fx = [`${def.name} joins the coalition`, fxRep(s, fid, r!.outcome === 'strong' ? 15 : 5), fxXp(s, 25)];
          return { text: r!.outcome === 'strong'
            ? `"Then he dies." ${def.leader} slams a fist on the table. "My ${def.troopName} march against the Kiln. Tell the others: we stand together, or we burn one by one."`
            : `"...I will not be the fool who ignores this." ${def.leader} nods, slowly. "We fight the King. But I remember who brought me this news, drifter. Don't make me regret it."`, effects: fx };
        } },
    ],
  };
}
