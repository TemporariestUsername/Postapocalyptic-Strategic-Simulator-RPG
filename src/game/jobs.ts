import { FACTIONS, FACTION_IDS } from '../data/factions';
import { NEIGHBORS, REGION_BY_ID } from '../data/regions';
import { WILD_GROUPS } from '../data/enemies';
import type { Scene } from './scenes';
import { fxBarter, fxItem, fxRep, fxXp, tierFor } from './scenes';
import { adjustRelation, atWar } from './sim';
import type { GameState, Job, JobKind } from './types';
import { bareName, enemyTypesOf, factionName, news, nextId, regionName, regionsOf, rngOf } from './util';
import { DELVES } from './delve';

export const MAX_ACTIVE_JOBS = 3;

export function generateJobs(s: GameState): void {
  const rng = rngOf(s);
  // expire old offers
  s.jobs = s.jobs.filter((j) => j.state === 'active');
  for (const fid of FACTION_IDS) {
    const f = s.factions[fid];
    if (!f.alive || fid === 'cinder' && f.rep < 20) continue;
    const own = regionsOf(s, fid);
    if (!own.length) continue;
    const enemyTargets = new Set<string>();
    for (const rid of own) for (const n of NEIGHBORS[rid]) if (atWar(s, fid, s.regions[n].owner) && s.regions[n].owner !== 'free') enemyTargets.add(n);
    const enemies = [...enemyTargets];
    const tier = tierFor(s);
    const kinds: JobKind[] = ['bounty', 'deliver'];
    if (enemies.length) kinds.push('sabotage', 'raid', 'scout', 'assassinate');
    kinds.push('envoy');
    if (Object.values(DELVES).some((d) => d.id !== 'kiln' && !s.regions[d.region].delveCleared)) kinds.push('delve');
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const kind = rng.pick(kinds);
      const offeredAt = rng.pick(own);
      const job = makeJob(s, fid, kind, own, enemies, offeredAt, tier);
      if (job && !s.jobs.some((j) => j.kind === job.kind && j.target === job.target && j.issuer === job.issuer)) s.jobs.push(job);
    }
  }
}

function makeJob(s: GameState, fid: string, kind: JobKind, own: string[], enemies: string[], offeredAt: string, tier: number): Job | null {
  const rng = rngOf(s);
  const base = { id: nextId(s, 'job'), kind, issuer: fid, state: 'offered' as const, offeredAt, deadline: s.day + rng.int(35, 55) };
  const pay = (lo: number, hi: number) => Math.round(rng.int(lo, hi) * (1 + tier * 0.35));
  const leader = FACTIONS[fid].leader;
  switch (kind) {
    case 'bounty': {
      const target = rng.pick(own);
      return { ...base, target, title: `Clear the Road at ${regionName(target)}`, desc: `Something is preying on travelers near ${regionName(target)}. ${leader} wants it dead.`, reward: pay(30, 45), rep: 8, merit: 6 };
    }
    case 'deliver': {
      const others = own.length > 1 ? own.filter((r) => r !== offeredAt) : FACTION_IDS.filter((f) => f !== fid && s.factions[f].alive && !atWar(s, fid, f)).map((f) => FACTIONS[f].capital).filter((c) => s.regions[c]);
      if (!others.length) return null;
      const target = rng.pick(others);
      return { ...base, target, title: `Sealed Cargo to ${regionName(target)}`, desc: `Carry a sealed crate to ${regionName(target)}. Don't open it. Don't lose it.`, reward: pay(22, 35), rep: 5, merit: 4 };
    }
    case 'sabotage': {
      const target = rng.pick(enemies);
      const enemy = s.regions[target].owner;
      return { ...base, target, enemy, title: `Sabotage ${regionName(target)}`, desc: `Cripple the ${bareName(s, enemy)} garrison at ${regionName(target)}: spike their fuel, burn their stores, cut their wire.`, reward: pay(55, 80), rep: 12, merit: 14 };
    }
    case 'raid': {
      const target = rng.pick(enemies);
      const enemy = s.regions[target].owner;
      return { ...base, target, enemy, title: `Raid the ${bareName(s, enemy)} Supply Line`, desc: `A ${bareName(s, enemy)} supply column is moving through ${regionName(target)}. Hit it and take what you can carry.`, reward: pay(45, 70), rep: 10, merit: 12 };
    }
    case 'scout': {
      const target = rng.pick(enemies);
      const enemy = s.regions[target].owner;
      return { ...base, target, enemy, title: `Scout ${regionName(target)}`, desc: `Count the guns and walls at ${regionName(target)}. Get in, get out, and don't be seen.`, reward: pay(30, 45), rep: 7, merit: 8 };
    }
    case 'assassinate': {
      const target = rng.pick(enemies);
      const enemy = s.regions[target].owner;
      return { ...base, target, enemy, title: `Kill the Commander at ${regionName(target)}`, desc: `A ${bareName(s, enemy)} war-chief commands at ${regionName(target)}. ${leader} wants their head in a sack.`, reward: pay(110, 160), rep: 18, merit: 25 };
    }
    case 'envoy': {
      const others = FACTION_IDS.filter((f) => f !== fid && f !== 'cinder' && s.factions[f].alive && (s.factions[fid].relations[f] ?? 0) < 20);
      if (!others.length) return null;
      const to = rng.pick(others);
      const target = FACTIONS[to].capital;
      if (s.regions[target].owner !== to) return null;
      return { ...base, target, envoyTo: to, title: `Envoy to ${FACTIONS[to].leader}`, desc: `Carry ${leader}'s words to ${FACTIONS[to].leader} at ${regionName(target)} and bring back peace, or at least a truce.`, reward: pay(40, 60), rep: 10, merit: 15 };
    }
    case 'delve': {
      const ds = Object.values(DELVES).filter((d) => d.id !== 'kiln' && !s.regions[d.region].delveCleared);
      if (!ds.length) return null;
      const d = rng.pick(ds);
      return { ...base, target: d.region, title: `Plunder ${d.name}`, desc: `Rumor says ${d.name} at ${regionName(d.region)} holds pre-Burn treasure. Clear it and ${leader} will pay for the proof.`, reward: pay(70, 100), rep: 10, merit: 12, deadline: s.day + 90 };
    }
  }
  return null;
}

export function jobsAt(s: GameState, region: string): Job[] {
  const owner = s.regions[region].owner;
  return s.jobs.filter((j) => j.state === 'offered' && j.issuer === owner && s.factions[owner]?.rep > -30);
}

export function activeJobs(s: GameState): Job[] {
  return s.jobs.filter((j) => j.state === 'active');
}

export function acceptJob(s: GameState, id: string): boolean {
  const j = s.jobs.find((x) => x.id === id);
  if (!j || activeJobs(s).length >= MAX_ACTIVE_JOBS) return false;
  j.state = 'active';
  j.deadline = Math.max(j.deadline, s.day + 20);
  return true;
}

export function abandonJob(s: GameState, id: string): void {
  const j = s.jobs.find((x) => x.id === id);
  if (!j) return;
  j.state = 'failed';
  fxRep(s, j.issuer, -6);
}

export function expireJobs(s: GameState): void {
  for (const j of s.jobs) {
    if (j.state === 'active' && s.day > j.deadline) {
      j.state = 'failed';
      fxRep(s, j.issuer, -8);
      news(s, `You failed to finish "${j.title}" in time. ${FACTIONS[j.issuer].leader} will remember.`, 'player');
    }
  }
}

export function completeJob(s: GameState, j: Job): string[] {
  j.state = 'done';
  s.stats.jobsDone++;
  const fx = [fxBarter(s, j.reward), fxRep(s, j.issuer, j.rep), fxXp(s, 15 + j.merit)];
  if (s.pledged === j.issuer) {
    s.merit += j.merit;
    fx.push(`+${j.merit} merit`);
  }
  const t = s.regions[j.target];
  switch (j.kind) {
    case 'sabotage':
      t.garrison = Math.round(t.garrison * 0.65);
      if (j.enemy) fx.push(fxRep(s, j.enemy, -10));
      news(s, `Saboteurs cripple the garrison at ${regionName(j.target)}.`, 'player', { region: j.target });
      break;
    case 'raid':
      if (j.enemy && s.factions[j.enemy]) s.factions[j.enemy].treasury = Math.max(0, s.factions[j.enemy].treasury - 60);
      t.garrison = Math.max(3, t.garrison - 6);
      if (j.enemy) fx.push(fxRep(s, j.enemy, -8));
      break;
    case 'assassinate':
      t.garrison = Math.round(t.garrison * 0.75);
      if (j.enemy) fx.push(fxRep(s, j.enemy, -20));
      news(s, `A ${bareName(s, j.enemy ?? '')} war-chief is found dead at ${regionName(j.target)}.`, 'player', { region: j.target });
      break;
    case 'envoy':
      if (j.envoyTo) {
        adjustRelation(s, j.issuer, j.envoyTo, 35);
        fx.push(`${FACTIONS[j.issuer].short}–${FACTIONS[j.envoyTo].short} relations improve`);
        news(s, `Envoys broker peace between ${factionName(s, j.issuer)} and ${factionName(s, j.envoyTo)}.`, 'diplo');
      }
      break;
    case 'scout':
      t.scoutedDay = s.day;
      break;
  }
  return fx;
}

/** The scene that plays out when the player works a job at its target region. */
export function jobScene(s: GameState, j: Job): Scene {
  const tier = tierFor(s);
  const bm = REGION_BY_ID[j.target].battlemap;
  const done = (text: string, extra: string[] = []) => ({ text, effects: [...extra, ...completeJob(s, j)] });
  const enemyFight = (ids: string[], title: string) => ({
    enemies: ids.map((id) => ({ id, tier })), battlemap: bm, context: { type: 'job' as const, ref: j.id, canFlee: true, title },
  });
  const enemyTypes = j.enemy ? enemyTypesOf(j.enemy) : ['scav', 'scav', 'raider'];
  switch (j.kind) {
    case 'bounty': {
      const rng = rngOf(s);
      const group = rng.pick(REGION_BY_ID[j.target].battlemap === 'sewer' ? WILD_GROUPS.sewer : WILD_GROUPS.wastes);
      return { id: 'job', title: j.title, image: 'events/battlefield', text: `You find the killers' lair in the hills above ${regionName(j.target)}: bones, blood, and fresh tracks.`,
        choices: [{ label: 'Hunt them down', resolve: () => ({ text: 'They come out to meet you.', fight: enemyFight([...group, group[0]], j.title) }) }] };
    }
    case 'deliver':
      return { id: 'job', title: j.title, image: 'events/traders', text: `The quartermaster at ${regionName(j.target)} signs for the crate without a word and counts out your pay.`,
        choices: [{ label: 'Hand over the cargo', resolve: () => done('Job done. Nobody asks what was in the crate. You don\'t tell them you peeked.') }] };
    case 'sabotage':
      return { id: 'job', title: j.title, image: 'events/burntvillage', text: `Night over ${regionName(j.target)}. Fuel dumps, ammo stores, a generator shed. Sentries walk the wire.`,
        choices: [
          { label: 'Sneak in and plant charges', stat: 'cool', resolve: (_s, r) => r!.outcome === 'strong' ? done('The stores go up like the end of the world. You are long gone when the sirens start.')
            : r!.outcome === 'weak' ? { text: 'The charges are set — then a sentry stumbles right into you.', fight: enemyFight([enemyTypes[0], enemyTypes[1]], 'Blown Cover') }
              : { text: 'A searchlight snaps on. You are surrounded.', fight: enemyFight([enemyTypes[0], enemyTypes[1], enemyTypes[2], enemyTypes[0]], 'Alarm!') } },
          { label: 'Bribe a guard (30 barter)', cost: { barter: 30 }, stat: 'hot', resolve: (_s, r) => { s.barter -= 30; return r!.outcome !== 'miss' ? done('The guard looks the other way. Easy money for both of you.') : { text: 'The guard takes the barter and raises the alarm.', fight: enemyFight([enemyTypes[0], enemyTypes[1], enemyTypes[2]], 'Double-Crossed') }; } },
          { label: 'Hit them head-on', resolve: () => ({ text: 'Subtlety is overrated.', fight: enemyFight([enemyTypes[0], enemyTypes[1], enemyTypes[2], enemyTypes[3] ?? enemyTypes[0]], 'Frontal Assault') }) },
        ] };
    case 'raid':
      return { id: 'job', title: j.title, image: 'events/ambush', text: `The supply column crawls along the road below ${regionName(j.target)}: two trucks, a handful of guards. Perfect.`,
        choices: [{ label: 'Spring the ambush', resolve: () => ({ text: 'You hit them hard and fast.', fight: enemyFight([enemyTypes[0], enemyTypes[1], enemyTypes[2]], j.title) }) }] };
    case 'scout':
      return { id: 'job', title: j.title, image: 'events/army', text: `From a ridge above ${regionName(j.target)} you can see the whole camp. Now to count it without getting caught.`,
        choices: [{ label: 'Count the garrison', stat: 'sharp', resolve: (_s, r) => r!.outcome === 'strong' ? done(`${s.regions[j.target].garrison} fighters, every gun accounted for.`)
          : r!.outcome === 'weak' ? { text: 'You get the numbers — and a patrol gets your scent.', effects: completeJob(s, j), fight: enemyFight([enemyTypes[0], enemyTypes[1]], 'Spotted') }
            : { text: 'A sniper\'s bullet cracks past your ear. They know you are here.', fight: enemyFight([enemyTypes[0], enemyTypes[1], enemyTypes[2]], 'Spotted') } }] };
    case 'assassinate':
      return { id: 'job', title: j.title, image: 'events/duel', text: `The war-chief keeps a tight guard, but you have found where they eat, sleep and drink. The rest is steel.`,
        choices: [{ label: 'Go in for the kill', resolve: () => ({ text: 'The guards close ranks around their champion.', fight: enemyFight(['champion', enemyTypes[0], enemyTypes[1], enemyTypes[2]], j.title) }) }] };
    case 'envoy': {
      const to = j.envoyTo!;
      return { id: 'job', title: j.title, image: 'interiors/hall', portrait: FACTIONS[to].portrait, speaker: FACTIONS[to].leader,
        text: `${FACTIONS[to].leader} hears you out in silence, fingers drumming. "${FACTIONS[j.issuer].leader} wants peace? Convince me."`,
        choices: [{ label: 'Make the case', stat: 'hot', resolve: (_s, r) => r!.outcome === 'strong' ? done('"...Fine. Tell your master we have an understanding."')
          : r!.outcome === 'weak' ? done('"A truce, then. For now. And you will carry my gift back." It costs you a little barter to seal it.', [fxBarter(s, -15)])
            : (() => { j.state = 'failed'; return { text: '"Get out before I have you thrown out." The talks collapse.', effects: [fxRep(s, j.issuer, -5), fxRep(s, to, -5)] }; })() }] };
    }
    case 'delve':
    default:
      return { id: 'job', title: j.title, image: 'towns/ruins', text: `${j.title}: return here after clearing the ruins at ${regionName(j.target)}.`,
        choices: [{ label: 'Understood', resolve: () => ({ text: 'The ruins wait.' }) }] };
  }
}

export function checkDelveJobs(s: GameState, region: string): string[] {
  const fx: string[] = [];
  for (const j of activeJobs(s)) if (j.kind === 'delve' && j.target === region) fx.push(`Job complete: ${j.title}`, ...completeJob(s, j));
  return fx;
}

export { fxItem };
