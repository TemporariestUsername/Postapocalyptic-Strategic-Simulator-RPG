import type { GameState } from '../game/types';
import { FACTIONS } from './factions';
import { factionName, regionName, regionsOf } from '../game/util';

type Rumor = (s: GameState) => string;

const strongest = (s: GameState) => Object.keys(FACTIONS).filter((f) => s.factions[f].alive).sort((a, b) => regionsOf(s, b).length - regionsOf(s, a).length)[0];

export const RUMORS: Rumor[] = [
  (s) => `${factionName(s, strongest(s))} holds more land than anyone now. Somebody ought to do something about that.`,
  () => 'They say the Burnt King doesn\'t sleep. Just sits on that throne listening to the storm.',
  () => 'Ruins at Blackglass Rise — old military bunker. Choir says it\'s haunted. Choir says everything\'s haunted.',
  () => 'Hire a Sawbones, friend. Nothing kills a crew faster than one bad wound and no one to stitch it.',
  () => 'Heard you can buy fighters here. Sellswords. Enough of them and you could take a hold of your own.',
  (s) => s.armies.length ? `${factionName(s, s.armies[0].faction)} is marching on ${regionName(s.armies[0].to)}. Stay off that road.` : 'Quiet month. Too quiet. Something\'s building.',
  () => 'Spirefall tower\'s got a pre-Burn armory on the top floors. Nobody\'s come back down to confirm it.',
  () => 'The Salt Widow pays double for anyone who hurts the Dust Riders. Just saying.',
  () => 'Baron Kesh never loses the dam. Never. Something about those walls.',
  () => 'Psychics in the Choir can reach into your skull and squeeze. Kill them first. Always first.',
  () => 'Get behind something solid when the shooting starts. Cars, rocks. Barrels are better than nothing.',
  () => 'Gnaw\'s rats trade fair, believe it or not. Better than Dremmer, anyway.',
  (s) => s.quest.burnRevealed ? 'Everybody\'s talking about the Great Burn now. Some say it\'s Choir lies. Most are praying it is.' : 'An old woman out on Ember Road keeps broadcasting warnings. Crazy talk about the Kiln.',
  () => 'A crew that\'s dug in behind cover shrugs off half of what\'s thrown at it. Patience wins fights.',
  () => 'Dremmer Gasface once sold fuel to both sides of the same battle. Then sold them the bandages.',
  (s) => `Last I heard, ${FACTIONS.cinder.troopName} number more than ${Math.round(Object.values(s.regions).filter((r) => r.owner === 'cinder').reduce((a, r) => a + r.garrison, 0) / 10) * 10} across the King's holds.`,
  () => 'Ride fast through the Howling Waste. The Maelstrom\'s thin there. Things come through.',
  () => 'If you\'re going to open your brain to the storm, have someone watching your back.',
];
