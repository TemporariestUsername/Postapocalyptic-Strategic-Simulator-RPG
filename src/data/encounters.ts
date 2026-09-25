import type { Scene, FightSpec } from '../game/scenes';
import {
  crewHas, fxBarter, fxHarmAll, fxHarmOne, fxHealAll, fxItem, fxRations, fxRep, fxWarband, fxXp, pickLoot, tierFor,
} from '../game/scenes';
import type { GameState } from '../game/types';
import { REGION_BY_ID } from './regions';
import { enemyTypesOf, factionName, rngOf } from '../game/util';
import { randomRecruit } from '../game/characters';
import { usedPortraits } from '../game/state';

export interface EncounterDef {
  id: string;
  weight: number;
  when?: (s: GameState, region: string) => boolean;
  build: (s: GameState, region: string) => Scene;
}

const bm = (region: string) => REGION_BY_ID[region]?.battlemap ?? 'waste';

function fight(s: GameState, region: string, ids: string[], title: string, bump = 0, type: FightSpec['context']['type'] = 'encounter'): FightSpec {
  const t = tierFor(s, bump);
  return { enemies: ids.map((id) => ({ id, tier: t })), battlemap: bm(region), context: { type, canFlee: true, title } };
}

function scaleGroup(s: GameState, base: string[]): string[] {
  const extra = Math.floor(s.day / 300);
  const out = [...base];
  for (let i = 0; i < extra && out.length < 7; i++) out.push(base[i % base.length]);
  return out;
}

export const ENCOUNTERS: EncounterDef[] = [
  {
    id: 'ambush', weight: 10,
    build: (s, region) => ({
      id: 'ambush', title: 'Engines on the Ridge', image: 'events/ambush',
      text: 'The whine of two-stroke engines rises out of the dust. Raiders — a half-dozen bikes, chains swinging, whooping like jackals — fan out to cut you off.',
      choices: [
        { label: 'Stand and fight', resolve: () => ({ text: 'You plant your feet and let them come.', fight: fight(s, region, scaleGroup(s, ['raider', 'raider', 'scav']), 'Raider Ambush') }) },
        { label: 'Outrun them through the gullies', stat: 'cool', resolve: (_s, r) => r!.outcome === 'strong'
          ? { text: 'You vanish into a dry wash and let the raiders chase their own dust.', effects: [fxXp(s, 8)] }
          : r!.outcome === 'weak'
            ? { text: 'You get away, but a saddlebag of supplies goes bouncing down the rocks behind you.', effects: [fxRations(s, -4)] }
            : { text: 'A dead end. The engines close in from both sides.', fight: fight(s, region, scaleGroup(s, ['raider', 'raider', 'raider', 'scav']), 'Cornered') } },
        { label: 'Throw them a toll (20 barter)', cost: { barter: 20 }, resolve: () => ({ text: 'The leader catches the pouch, weighs it, and waves you on with a grin full of steel teeth.', effects: [fxBarter(s, -20)] }) },
      ],
    }),
  },
  {
    id: 'wreck', weight: 8,
    build: (s, region) => ({
      id: 'wreck', title: 'The Overturned Rig', image: 'events/wreck',
      text: 'An armored cargo truck lies on its side across the dead highway, doors hanging open. No bodies. No tracks. Just the wind moaning through bullet holes.',
      choices: [
        { label: 'Search it carefully', stat: 'sharp', resolve: (_s, r) => {
          if (r!.outcome === 'strong') { const it = pickLoot(s, 3); return { text: 'Behind a false panel: a smuggler\'s stash.', effects: [fxItem(s, it), fxBarter(s, 25)] }; }
          if (r!.outcome === 'weak') return { text: 'Some barter in the glovebox — and a tripwire grenade you spot half a second too late.', effects: [fxBarter(s, 15), fxHarmOne(s, 3)] };
          return { text: 'The cargo hold is a nest. Glowing things pour out of the dark.', fight: fight(s, region, scaleGroup(s, ['glowbug', 'glowbug', 'glowbug', 'hound']), 'The Nest in the Rig') };
        } },
        { label: 'Strip it fast and move on', resolve: () => ({ text: 'You grab what\'s loose: a jerrycan, some scrap, a tin of beans.', effects: [fxBarter(s, 8), fxRations(s, 2)] }) },
        { label: 'Leave it. It smells like a trap.', resolve: () => ({ text: 'Some things are better left lying where they fell.' }) },
      ],
    }),
  },
  {
    id: 'campfire', weight: 7,
    build: (s, region) => ({
      id: 'campfire', title: 'A Fire in the Dark', image: 'events/campfire',
      text: 'A lone hooded figure sits by a small fire. Without looking up, they gesture at the empty ground across from them. "Sit. The night\'s long and the Maelstrom\'s loud."',
      choices: [
        { label: 'Share the fire and swap stories', stat: 'hot', resolve: (_s, r) => r!.outcome === 'strong'
          ? { text: 'The stranger is a scout from the old wars. By dawn you know three shortcuts and they press something into your hand.', effects: [fxItem(s, rngOf(s).pick(['map', 'goggles', 'stim', 'charm'])), fxXp(s, 10)] }
          : r!.outcome === 'weak'
            ? { text: 'Good talk, bad company. In the morning the stranger is gone, and so are some of your rations.', effects: [fxRations(s, -3), fxXp(s, 6)] }
            : { text: 'The hood falls back. There is no face beneath — only violet light and a mouth that will not stop screaming.', fight: fight(s, region, ['hollow', 'hollow'], 'The Stranger') } },
        { label: 'Keep walking', resolve: () => ({ text: 'You give the fire a wide berth. The figure never moves.' }) },
      ],
    }),
  },
  {
    id: 'duststorm', weight: 8,
    build: (s) => ({
      id: 'duststorm', title: 'The Brown Wall', image: 'events/duststorm',
      text: 'The horizon goes brown, then black. A dust storm a mile high is rolling across the flats, swallowing everything in its path.',
      choices: [
        { label: 'Push through it', stat: 'hard', resolve: (_s, r) => r!.outcome === 'strong'
          ? { text: 'Heads down, scarves up, you walk straight through hell and out the other side.', effects: [fxXp(s, 8)] }
          : r!.outcome === 'weak'
            ? { text: 'You make it, but grit ruins half your food.', effects: [fxRations(s, -3)] }
            : { text: 'The storm flays you raw and scatters your packs across a mile of desert.', effects: [fxHarmAll(s, 2), fxRations(s, -4)] } },
        { label: 'Dig in and wait it out', resolve: () => ({ text: 'You huddle in a culvert for a day and a night, eating through your supplies.', effects: [fxRations(s, -3)] }) },
      ],
    }),
  },
  {
    id: 'maelstrom', weight: 6,
    build: (s, region) => ({
      id: 'maelstrom', title: 'The Sky Opens', image: 'events/maelstrom', music: 'maelstrom',
      text: 'The clouds tear open like a wound. Violet light pours down and with it comes the sound — every voice that ever died, screaming at once. The Maelstrom is here.',
      choices: [
        { label: 'Open your brain to it', stat: 'weird', resolve: (_s, r) => r!.outcome === 'strong'
          ? { text: 'You let it in and ride the scream. You see the Kiln\'s heart burning, and a thousand roads laid out like veins. You come back knowing things.', effects: [fxXp(s, 30)] }
          : r!.outcome === 'weak'
            ? { text: 'You catch fragments before it throws you out. Your nose won\'t stop bleeding.', effects: [fxXp(s, 15), fxHarmOne(s, 2)] }
            : { text: 'It sees you seeing it. Shapes step out of the light, hollow and hungry.', fight: fight(s, region, ['hollow', 'hollow', 'psyker'], 'Things From the Storm', 1) } },
        { label: 'Hunker down and wait', stat: 'cool', resolve: (_s, r) => r!.outcome === 'strong'
          ? { text: 'You close your eyes, hum an old song, and wait for it to pass. It does.' }
          : r!.outcome === 'weak'
            ? { text: 'It passes, but it leaves splinters in your skull.', effects: [fxHarmOne(s, 1)] }
            : { text: 'The scream gets inside everyone.', effects: [fxHarmAll(s, 2)] } },
      ],
    }),
  },
  {
    id: 'wounded', weight: 6,
    build: (s, region) => ({
      id: 'wounded', title: 'Blood on the Signpost', image: 'events/wounded',
      text: 'A traveler slumps against a rusted road sign, clutching a gut wound. "Please... water... I can pay..." The vultures are already circling.',
      choices: [
        { label: 'Tend the wound', stat: 'sharp', bonus: crewHas(s, 'sawbones') ? 1 : 0, hint: crewHas(s, 'sawbones') ? 'Sawbones +1' : undefined, resolve: (_s, r) => r!.outcome === 'strong'
          ? { text: 'You stitch them up. They are a courier and they pay well for their life.', effects: [fxBarter(s, 35), fxXp(s, 10)] }
          : r!.outcome === 'weak'
            ? { text: 'They live, barely. They have nothing but thanks and a battered tin of food.', effects: [fxRations(s, 2), fxXp(s, 6)] }
            : { text: 'As you kneel, they grin. Scavengers rise from the ditch.', fight: fight(s, region, scaleGroup(s, ['scav', 'scav', 'scav']), 'The Bait') } },
        { label: 'Rob them and move on', resolve: () => ({ text: 'Their purse is light. Your conscience is lighter.', effects: [fxBarter(s, 12)] }) },
        { label: 'Leave them to the vultures', resolve: () => ({ text: 'You walk on. The vultures do not.' }) },
      ],
    }),
  },
  {
    id: 'burntvillage', weight: 6,
    when: (s) => s.day > 20,
    build: (s, region) => ({
      id: 'burntvillage', title: 'The Ember Brand', image: 'events/burntvillage',
      text: 'What was a village yesterday is smoking ash today. On the one standing wall, someone has painted the Burnt King\'s brand in pitch. The tracks lead north.',
      choices: [
        { label: 'Track the Burnlads', stat: 'sharp', resolve: (_s, r) => r!.outcome !== 'miss'
          ? { text: 'You find their camp at dusk — and hit them before they know you are there.', fight: fight(s, region, r!.outcome === 'strong' ? ['burnlad', 'burnlad'] : ['burnlad', 'burnlad', 'burnlad_gun'], 'Vengeance for the Village') }
          : { text: 'They were waiting for you.', fight: fight(s, region, scaleGroup(s, ['burnlad', 'burnlad', 'burnlad_gun', 'burnlad']), 'Burnlad Ambush', 1) } },
        { label: 'Bury the dead', resolve: () => ({ text: 'It takes all afternoon. Nobody talks. Afterwards, the crew seems harder, somehow.', effects: [fxXp(s, 12)] }) },
        { label: 'Pick through the ashes', stat: 'sharp', resolve: (_s, r) => r!.outcome === 'miss'
          ? { text: 'A collapsing beam catches someone across the back.', effects: [fxHarmOne(s, 3)] }
          : { text: 'The fire missed a root cellar.', effects: [fxRations(s, r!.outcome === 'strong' ? 6 : 3), fxBarter(s, 10)] } },
      ],
    }),
  },
  {
    id: 'tollgate', weight: 7,
    build: (s, region) => ({
      id: 'tollgate', title: 'The Toll of Skulls', image: 'events/tollgate',
      text: 'A wall of welded car wrecks blocks the canyon road. Skulls on spikes. A dozen rifles on top. "Road tax!" someone bellows. "Fifteen barter a head, or you can go around — through the minefield!"',
      choices: [
        { label: `Pay the toll (${15 * s.crew.length} barter)`, cost: { barter: 15 * s.crew.length }, resolve: () => ({ text: 'The gate grinds open.', effects: [fxBarter(s, -15 * s.crew.length)] }) },
        { label: 'Stare them down', stat: 'hard', resolve: (_s, r) => r!.outcome === 'strong'
          ? { text: 'Their boss recognizes something in your eyes. He waves you through — and tosses you a "gift" to stay friends.', effects: [fxBarter(s, 15), fxXp(s, 10)] }
          : r!.outcome === 'weak'
            ? { text: 'They let you pass, grumbling. You will not be welcome back.', effects: [fxXp(s, 6)] }
            : { text: 'Wrong answer. The rifles come up.', fight: fight(s, region, scaleGroup(s, ['raider', 'raider', 'scav', 'scav']), 'The Toll Gate') } },
        { label: 'Slip around in the night', stat: 'cool', resolve: (_s, r) => r!.outcome !== 'miss'
          ? { text: 'You pick your way along a goat track above the gate, silent as ghosts.', effects: r!.outcome === 'weak' ? [fxRations(s, -2)] : [fxXp(s, 8)] }
          : { text: 'A mine. Not a big one. Big enough.', effects: [fxHarmAll(s, 2)] } },
      ],
    }),
  },
  {
    id: 'nest', weight: 5,
    build: (s, region) => ({
      id: 'nest', title: 'The Egg Chamber', image: 'events/nest',
      text: 'The shortcut through the collapsed tunnel stinks of ammonia. Pulsing egg sacs cover the walls, and far back in the dark, something clicks.',
      choices: [
        { label: s.stash.molotov ? 'Burn it all (use a Molotov)' : 'Burn it all (need a Molotov)', disabled: s.stash.molotov ? false : 'No Molotov', resolve: () => { s.stash.molotov--; return { text: 'The nest goes up with a shriek. In the ashes you find what the creatures dragged home.', effects: [fxBarter(s, 30), fxItem(s, pickLoot(s, 2)), fxXp(s, 12)] }; } },
        { label: 'Clear it out by hand', resolve: () => ({ text: 'You go in hard.', fight: fight(s, region, scaleGroup(s, ['crawler', 'glowbug', 'glowbug', 'glowbug']), 'The Nest') }) },
        { label: 'Back out slowly', stat: 'cool', resolve: (_s, r) => r!.outcome !== 'miss' ? { text: 'You retreat without waking anything.' } : { text: 'Something wakes.', fight: fight(s, region, ['crawler', 'glowbug', 'glowbug'], 'Awakened') } },
      ],
    }),
  },
  {
    id: 'cache', weight: 5,
    build: (s, region) => ({
      id: 'cache', title: 'The Buried Hatch', image: 'events/cache',
      text: 'The wind has uncovered a steel hatch in the sand, stenciled with faded pre-Burn markings. The lock is corroded but intact. Something might still be down there.',
      choices: [
        { label: 'Crack the lock', stat: 'sharp', bonus: crewHas(s, 'wrencher') ? 1 : 0, hint: crewHas(s, 'wrencher') ? 'Wrencher +1' : undefined, resolve: (_s, r) => {
          if (r!.outcome === 'strong') return { text: 'A pre-Burn emergency locker, sealed and dry.', effects: [fxItem(s, pickLoot(s, 4)), fxRations(s, 6), fxXp(s, 12)] };
          if (r!.outcome === 'weak') return { text: 'Most of it rotted. Most.', effects: [fxItem(s, pickLoot(s, 2))] };
          return { text: 'The hatch opens. Something that used to be a person climbs out.', fight: fight(s, region, ['hollow', 'hollow', 'glowbug'], 'What Waited Below', 1) };
        } },
        { label: 'Leave it buried', resolve: () => ({ text: 'You kick sand back over the hatch.' }) },
      ],
    }),
  },
  {
    id: 'pillar', weight: 4,
    build: (s) => ({
      id: 'pillar', title: 'The Pillar Prophet', image: 'events/pillar',
      text: 'A ragged prophet stands atop a broken concrete pillar, preaching to a small crowd. "The Burnt King will light the last fire! The storm will drink us all! Repent, and listen!"',
      choices: [
        { label: 'Listen closely', stat: 'weird', resolve: (_s, r) => r!.outcome !== 'miss'
          ? { text: 'Beneath the ranting there is real knowledge: the Kiln\'s reactor, a date, a countdown.', effects: [fxXp(s, r!.outcome === 'strong' ? 25 : 12)] }
          : { text: 'The words crawl into your head and nest there. You sleep badly for a week.', effects: [fxHarmOne(s, 2)] } },
        { label: 'Drop some barter in his bowl (10)', cost: { barter: 10 }, resolve: () => ({ text: 'The prophet blesses you. The crowd murmurs approval.', effects: [fxBarter(s, -10), fxRep(s, 'choir', 6), fxXp(s, 5)] }) },
        { label: 'Move along', resolve: () => ({ text: 'The ranting follows you down the road for a long time.' }) },
      ],
    }),
  },
  {
    id: 'convoy', weight: 5,
    when: (s) => s.factions.cinder.alive,
    build: (s, region) => ({
      id: 'convoy', title: 'Chains on the Road', image: 'events/convoy',
      text: 'A line of chained prisoners shuffles along the scorched road, driven by black-armored Burnlads. They are bound for the Kiln\'s furnaces. One of the prisoners meets your eyes.',
      choices: [
        { label: 'Free the prisoners', resolve: () => ({ text: 'You draw steel.', fight: { ...fight(s, region, scaleGroup(s, ['burnlad', 'burnlad', 'burnlad_gun', 'burnlad']), 'Break the Chains'), context: { type: 'encounter', ref: 'convoy', canFlee: true, title: 'Break the Chains' } } }) },
        { label: 'Follow them and learn their route', stat: 'sharp', resolve: (_s, r) => r!.outcome !== 'miss'
          ? { text: 'You learn the patrol routes around Ashfall. That knowledge is worth something to the Burnt King\'s enemies.', effects: [fxXp(s, 12), fxBarter(s, 15)] }
          : { text: 'A rear guard spots you.', fight: fight(s, region, ['burnlad', 'burnlad_gun'], 'Rear Guard') } },
        { label: 'Look away', resolve: () => ({ text: 'You let them pass. The prisoner\'s eyes stay with you.' }) },
      ],
    }),
  },
  {
    id: 'oasis', weight: 4,
    build: (s) => ({
      id: 'oasis', title: 'Green Water', image: 'events/oasis',
      text: 'A miracle: a working well beneath a stunted tree, and a few travelers resting in the shade. Nobody reaches for a weapon. Here, today, there is peace.',
      choices: [
        { label: 'Rest and refill', resolve: () => ({ text: 'You drink until your belly aches and sleep in the shade.', effects: [fxHealAll(s, 6), fxRations(s, 4)] }) },
        { label: 'Trade with the travelers', stat: 'hot', resolve: (_s, r) => ({ text: 'Barter changes hands under the tree.', effects: [fxBarter(s, r!.outcome === 'strong' ? 30 : r!.outcome === 'weak' ? 15 : 5), fxRations(s, 2)] }) },
      ],
    }),
  },
  {
    id: 'traders', weight: 5,
    build: (s, region) => ({
      id: 'traders', title: 'The Salt Caravan', image: 'events/traders',
      text: 'A Saltmarch caravan has pulled over by the road: pack-beasts, a rusted truck, blankets spread with goods. Their guards watch you with crossbows loosely held.',
      choices: [
        { label: 'Buy 10 rations (8 barter)', cost: { barter: 8 }, resolve: () => ({ text: 'Dried lizard and flatbread. Food is food.', effects: [fxBarter(s, -8), fxRations(s, 10)] }) },
        { label: 'Buy medical supplies (30 barter)', cost: { barter: 30 }, resolve: () => ({ text: 'Clean bandages. Real stims.', effects: [fxBarter(s, -30), fxItem(s, 'stim'), fxItem(s, 'bandage', 2)] }) },
        { label: 'Rob the caravan', resolve: () => ({ text: 'The guards were ready for you.', fight: { ...fight(s, region, scaleGroup(s, ['saltguard', 'saltguard', 'saltguard']), 'Caravan Robbery'), context: { type: 'encounter', ref: 'robcaravan', canFlee: true, title: 'Caravan Robbery' } } }) },
        { label: 'Wave and move on', resolve: () => ({ text: 'The guards relax their crossbows.' }) },
      ],
    }),
  },
  {
    id: 'duel', weight: 4,
    build: (s) => ({
      id: 'duel', title: 'The Challenge', image: 'events/duel',
      text: 'A roadside fighting ring, burning barrels, a crowd of raiders. Their champion points a notched blade at you. "You look soft, drifter. One bout. Your purse against mine."',
      choices: [
        { label: 'Accept the duel', stat: 'cool', resolve: (_s, r) => r!.outcome === 'strong'
          ? { text: 'Three passes and he is in the dirt. The crowd roars your name and pays up.', effects: [fxBarter(s, 45), fxXp(s, 20)] }
          : r!.outcome === 'weak'
            ? { text: 'You win, but he opens you up before he goes down.', effects: [fxBarter(s, 30), fxHarmOne(s, 4), fxXp(s, 12)] }
            : { text: 'He puts you on your back in front of everyone and takes your purse.', effects: [fxBarter(s, -20), fxHarmOne(s, 4)] } },
        { label: 'Decline', resolve: () => ({ text: 'Jeers follow you out. Words don\'t bleed.' }) },
      ],
    }),
  },
  {
    id: 'hounds', weight: 7,
    build: (s, region) => ({
      id: 'hounds', title: 'The Pack', image: 'events/battlefield',
      text: 'Yellow eyes in the scrub, then more. Ash hounds — a whole pack of them, ribs showing, drool smoking where it hits the ground. They circle closer.',
      choices: [
        { label: 'Fight them off', resolve: () => ({ text: 'Back to back!', fight: fight(s, region, scaleGroup(s, ['hound', 'hound', 'hound', 'hound']), 'Ash Hounds') }) },
        { label: 'Throw them food (4 rations)', cost: { rations: 4 }, resolve: () => ({ text: 'They fight over the meat while you slip away.', effects: [fxRations(s, -4)] }) },
      ],
    }),
  },
  {
    id: 'deserter', weight: 3,
    when: (s) => s.crew.length < 4,
    build: (s) => {
      const used = usedPortraits(s);
      s.idCounter++;
      const recruit = randomRecruit(rngOf(s), `r${s.idCounter}`, Math.max(1, Math.min(5, Math.floor(s.day / 120) + 1)), used);
      return {
        id: 'deserter', title: 'The Deserter', image: 'events/campfire', portrait: recruit.portrait,
        text: `A figure staggers out of the scrub with hands raised. "Don't shoot! Name's ${recruit.name}. I ran from the Burnt King's levy. I can fight — I just need a crew that isn't going to feed me to a furnace."`,
        choices: [
          { label: `Take ${recruit.name} in`, resolve: () => { s.crew.push(recruit); return { text: `${recruit.name} falls in with the crew, grateful and hungry.`, effects: [`${recruit.name} joins the crew`] }; } },
          { label: 'Turn them over to the Cinder Throne', resolve: () => ({ text: 'You march them to the nearest Burnlad post. The bounty is good. Your crew won\'t meet your eyes.', effects: [fxBarter(s, 30), fxRep(s, 'cinder', 10)] }) },
          { label: 'Give them some food and send them on', resolve: () => ({ text: 'They bless you and vanish into the dust.', effects: [fxRations(s, -2), fxXp(s, 5)] }) },
        ],
      };
    },
  },
  {
    id: 'army', weight: 5,
    when: (s) => s.armies.length > 0,
    build: (s, region) => {
      const a = s.armies[Math.floor(rngOf(s).next() * s.armies.length)];
      return {
        id: 'army', title: 'An Army on the March', image: 'events/army',
        text: `From a hilltop you watch ${a.troops} ${factionName(s, a.faction)} fighters crawl across the plain, bound for ${REGION_BY_ID[a.to].name}. The ground shakes with their war-rigs.`,
        choices: [
          { label: 'Count their numbers and sell the intel', stat: 'sharp', resolve: (_s, r) => r!.outcome !== 'miss'
            ? { text: 'You count every rig and rifle. Somebody will pay for this.', effects: [fxBarter(s, r!.outcome === 'strong' ? 40 : 20), fxXp(s, 10)] }
            : { text: 'Outriders spot you on the ridge.', fight: fight(s, region, enemyTypesOf(a.faction).slice(0, 3), 'Outriders') } },
          { label: 'Stay low and let them pass', resolve: () => ({ text: 'It takes hours for the column to pass.' }) },
        ],
      };
    },
  },
];

export function encounterScene(s: GameState, id: string, region: string): Scene {
  const def = ENCOUNTERS.find((e) => e.id === id) ?? ENCOUNTERS[0];
  return def.build(s, region);
}

/** Fights with local faction patrols when the player is hated. */
export function patrolScene(s: GameState, faction: string, region: string): Scene {
  const types = enemyTypesOf(faction);
  const t = tierFor(s);
  return {
    id: 'patrol', title: `${factionName(s, faction)} Patrol`, image: 'events/army',
    text: `A ${factionName(s, faction)} patrol blocks the road. Their leader recognizes you. "That's the one. The one with the price on their head."`,
    choices: [
      { label: 'Fight your way through', resolve: () => ({ text: 'Weapons out.', fight: { enemies: [types[0], types[1], types[2], types[0]].map((id) => ({ id, tier: t })), battlemap: bm(region), context: { type: 'patrol', canFlee: true, title: 'Patrol' } } }) },
      { label: 'Bribe them (40 barter)', cost: { barter: 40 }, resolve: () => ({ text: 'Barter talks. They look the other way.', effects: [fxBarter(s, -40)] }) },
      { label: 'Talk your way out', stat: 'hot', resolve: (_s, r) => r!.outcome !== 'miss'
        ? { text: 'Wrong person, you insist. Somehow they believe it.', effects: r!.outcome === 'weak' ? [fxBarter(s, -15)] : [] }
        : { text: 'They are not buying it.', fight: { enemies: [types[0], types[1], types[2], types[0], types[3] ?? types[0]].map((id) => ({ id, tier: t })), battlemap: bm(region), context: { type: 'patrol', canFlee: true, title: 'Patrol' } } } },
    ],
  };
}

export { fxWarband };
