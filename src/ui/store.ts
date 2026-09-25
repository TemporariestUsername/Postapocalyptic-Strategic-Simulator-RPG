/**
 * The UI controller. Holds the live GameState plus transient UI state, and drives the flow between
 * the map, settlements, scenes, battles and endings. Components re-render via useStore().
 */
import { useEffect, useState } from 'preact/hooks';
import type { Roll } from '../engine/dice';
import { audio } from '../engine/audio';
import { saveGame, type Slot } from '../engine/save';
import { createSkirmish } from '../combat/setup';
import type { Battle } from '../combat/types';
import { encounterScene, patrolScene } from '../data/encounters';
import { storyScene } from '../data/story';
import { FACTIONS } from '../data/factions';
import { NEIGHBORS, REGION_BY_ID } from '../data/regions';
import { advanceDay, startTravel } from '../game/actions';
import { delveFight, delveReward, delveRoomScene, DELVES, startDelve } from '../game/delve';
import { applyBattle, type BattleSummary } from '../game/outcome';
import type { FightSpec, Scene, SceneChoice, SceneResult } from '../game/scenes';
import { rollMove } from '../game/scenes';
import { checkDelveJobs } from '../game/jobs';
import { resolveAutoBattle, playerDefends } from '../game/sim';
import { buildArmyBattle, joinArmy, planForArmy, type ArmyBattlePlan } from '../game/war';
import { newGame, type NewGameOptions } from '../game/state';
import type { GameState } from '../game/types';
import { factionName, regionName, rngOf } from '../game/util';

export type Screen = 'boot' | 'title' | 'creation' | 'intro' | 'world' | 'settlement' | 'battle' | 'delve' | 'ending';
export type Panel = null | 'crew' | 'journal' | 'factions' | 'menu' | 'saveload' | 'settings' | 'help';
export type Tab = null | 'market' | 'bar' | 'clinic' | 'hall' | 'tower' | 'command';

export interface SceneView {
  scene: Scene;
  phase: 'choose' | 'rolling' | 'result';
  choice?: SceneChoice;
  roll?: Roll;
  result?: SceneResult;
}

export interface BattleView {
  battle: Battle;
  items: Record<string, number>;
  summary?: BattleSummary;
}

export interface Toast { id: number; text: string; kind: 'info' | 'good' | 'bad' }

interface UIState {
  screen: Screen;
  panel: Panel;
  tab: Tab;
  scene: SceneView | null;
  battle: BattleView | null;
  returnTo: 'world' | 'settlement' | 'delve';
  selected: string | null;
  traveling: boolean;
  resting: number;
  toasts: Toast[];
  saveMode: 'save' | 'load';
  crewSel: string | null;
}

export const G: { game: GameState | null; ui: UIState } = {
  game: null,
  ui: {
    screen: 'boot', panel: null, tab: null, scene: null, battle: null, returnTo: 'world', selected: null,
    traveling: false, resting: 0, toasts: [], saveMode: 'save', crewSel: null,
  },
};

const listeners = new Set<() => void>();
let raf = 0;
export function emit(): void {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    for (const l of listeners) l();
  });
}

export function useStore(): typeof G {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return G;
}

export function game(): GameState {
  if (!G.game) throw new Error('no game');
  return G.game;
}

let toastId = 0;
export function toast(text: string, kind: Toast['kind'] = 'info'): void {
  const t = { id: ++toastId, text, kind };
  G.ui.toasts = [...G.ui.toasts.slice(-4), t];
  emit();
  setTimeout(() => {
    G.ui.toasts = G.ui.toasts.filter((x) => x.id !== t.id);
    emit();
  }, 3800);
}

// ------------------------------------------------------------------------------ navigation & music

const SCREEN_MUSIC: Partial<Record<Screen, string>> = { title: 'title', creation: 'creation', intro: 'creation' };

export function worldMusic(): string {
  const s = G.game;
  if (!s) return 'map_a';
  return Math.floor(s.day / 45) % 2 === 0 ? 'map_a' : 'map_b';
}

export function goto(screen: Screen): void {
  G.ui.screen = screen;
  G.ui.panel = null;
  if (screen !== 'settlement') G.ui.tab = null;
  const m = SCREEN_MUSIC[screen];
  if (m) audio.music(m);
  else if (screen === 'world') audio.music(worldMusic());
  else if (screen === 'settlement') audio.music('town');
  else if (screen === 'delve') audio.music('delve');
  emit();
}

export function openPanel(p: Panel): void {
  G.ui.panel = G.ui.panel === p ? null : p;
  audio.sfx(G.ui.panel ? 'ui_open' : 'ui_close');
  emit();
}

export function setTab(t: Tab): void {
  G.ui.tab = t;
  audio.sfx(t ? 'ui_open' : 'ui_close');
  if (t === 'bar') audio.music('bar');
  else if (t === 'hall') audio.music('hall');
  else audio.music('town');
  emit();
}

// ------------------------------------------------------------------------------ game lifecycle

export function startNewGame(o: NewGameOptions): void {
  G.game = newGame(o);
  G.ui.selected = null;
  G.game.pending.push({ kind: 'story', id: 'arrival' });
  goto('intro');
}

export function loadState(s: GameState): void {
  G.game = s;
  G.ui.scene = null;
  G.ui.battle = null;
  G.ui.traveling = false;
  G.ui.selected = s.location;
  if (s.ended) goto('ending');
  else if (s.delve) goto('delve');
  else goto('world');
  flow();
}

export function autosave(): void {
  if (G.game && !G.game.ended) saveGame(G.game, 'auto');
}

export function saveTo(slot: Slot): void {
  if (!G.game) return;
  if (saveGame(G.game, slot)) toast(slot === 'auto' ? 'Autosaved' : `Saved to slot ${slot}`, 'good');
  else toast('Could not save (storage unavailable)', 'bad');
}

// ------------------------------------------------------------------------------ scenes

export function openScene(scene: Scene): void {
  G.ui.scene = { scene, phase: 'choose' };
  if (scene.music) audio.music(scene.music);
  audio.sfx('page');
  emit();
}

export function chooseOption(choice: SceneChoice): void {
  const v = G.ui.scene;
  const s = game();
  if (!v || v.phase !== 'choose' || choice.disabled) return;
  if (choice.cost?.barter && s.barter < choice.cost.barter) return toast('Not enough barter', 'bad');
  if (choice.cost?.rations && s.rations < choice.cost.rations) return toast('Not enough rations', 'bad');
  v.choice = choice;
  if (choice.stat) {
    v.roll = rollMove(s, choice.stat, choice.bonus ?? 0);
    v.phase = 'rolling';
    audio.sfx('dice_shake');
    emit();
    setTimeout(() => {
      audio.sfx('dice_throw');
      finishChoice();
    }, 1500);
  } else finishChoice();
}

function finishChoice(): void {
  const v = G.ui.scene;
  if (!v?.choice) return;
  v.result = v.choice.resolve(game(), v.roll ?? null);
  v.phase = 'result';
  const r = v.result;
  if (!r.text && !r.effects?.length && !r.fight && !r.army && !r.next) return continueScene();
  const out = v.roll?.outcome;
  if (out === 'strong') audio.sfx('ui_confirm');
  else if (out === 'miss') audio.sfx('ui_error');
  emit();
}

export function continueScene(): void {
  const v = G.ui.scene;
  if (!v?.result) {
    G.ui.scene = null;
    emit();
    return flow();
  }
  const r = v.result;
  G.ui.scene = null;
  if (r.next) return openScene(r.next);
  if (r.fight) return startSkirmish(r.fight);
  if (r.army) return startArmy(r.army);
  restoreMusic();
  emit();
  flow();
}

function restoreMusic(): void {
  const scr = G.ui.screen;
  if (scr === 'world') audio.music(worldMusic());
  else if (scr === 'settlement') audio.music(G.ui.tab === 'bar' ? 'bar' : G.ui.tab === 'hall' ? 'hall' : 'town');
  else if (scr === 'delve') audio.music('delve');
}

function messageScene(title: string, text: string, image?: string, portrait?: string): Scene {
  return { id: 'msg', title, text, image: image ?? 'events/battlefield', portrait, choices: [{ label: 'Continue', resolve: () => ({ text: '' }) }] };
}

/** Process the next pending world event, if nothing else is on screen. */
export function flow(): void {
  const s = G.game;
  if (!s) return;
  if (s.ended) {
    G.ui.traveling = false;
    goto('ending');
    return;
  }
  if (G.ui.scene || G.ui.battle || G.ui.screen === 'intro' || G.ui.screen === 'ending') return;
  const p = s.pending.shift();
  if (!p) {
    emit();
    return;
  }
  G.ui.traveling = false;
  switch (p.kind) {
    case 'story': {
      const sc = storyScene(s, p.id);
      if (sc) openScene(sc);
      else flow();
      return;
    }
    case 'message':
      openScene(messageScene(p.title, p.text, p.image, p.portrait));
      return;
    case 'encounter':
      openScene(encounterScene(s, p.eventId, p.region));
      return;
    case 'patrol':
      openScene(patrolScene(s, p.faction, p.region));
      return;
    case 'callToArms': {
      const a = s.armies.find((x) => x.id === p.armyId);
      if (!a) return flow();
      const f = FACTIONS[a.faction];
      openScene({
        id: 'cta', title: 'Call to Arms', image: 'events/army', portrait: f.portrait, speaker: f.leader,
        text: `${f.leader} marches on ${regionName(a.to)} with ${a.troops} ${f.troopName}. "You're sworn to me, drifter. Ride at the head of my column, and your warband with you."`,
        choices: [
          { label: 'Ride to war', resolve: () => { joinArmy(s, a); return { text: `You take your place at the head of the column. ${a.daysLeft} days to ${regionName(a.to)}.` }; } },
          { label: 'Stay behind', resolve: () => ({ text: `${f.leader}'s host marches without you.` }) },
        ],
      });
      return;
    }
    case 'defend': {
      const a = s.armies.find((x) => x.id === p.armyId);
      if (!a) return flow();
      if (!playerDefends(s, a)) {
        resolveAutoBattle(s, a, rngOf(s));
        return flow();
      }
      openScene({
        id: 'defend', title: `${regionName(a.to)} Under Siege`, image: 'events/army',
        text: `War horns! ${a.troops} ${factionName(s, a.faction)} fighters pour over the ridge toward ${regionName(a.to)}. The defenders look to you.`,
        choices: [
          { label: 'Man the walls', resolve: () => ({ text: 'You take command of the defense.', army: planForArmy(s, a, false) }) },
          { label: 'Slip away before the gates close', resolve: () => {
            resolveAutoBattle(s, a, rngOf(s));
            const flee = NEIGHBORS[a.to].find((n) => s.regions[n].owner !== a.faction) ?? NEIGHBORS[a.to][0];
            s.location = flee;
            G.ui.selected = flee;
            return { text: `You escape to ${regionName(flee)} as the battle begins behind you.` };
          } },
        ],
      });
      return;
    }
    case 'assault': {
      const a = s.armies.find((x) => x.id === p.armyId);
      if (!a) return flow();
      s.location = a.from;
      if (s.regions[a.to].owner === a.faction) {
        s.flags.marching = false;
        return flow();
      }
      startArmy(planForArmy(s, a, true));
      return;
    }
  }
}

// ------------------------------------------------------------------------------ battles

export function startSkirmish(f: FightSpec): void {
  const s = game();
  G.ui.traveling = false;
  const b = createSkirmish({ crew: s.crew, enemies: f.enemies, battlemap: f.battlemap, context: f.context, seed: rngOf(s).int(1, 1e9) });
  const items: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.stash)) items[k] = v;
  if (G.ui.screen !== 'battle') G.ui.returnTo = G.ui.screen === 'delve' ? 'delve' : G.ui.screen === 'settlement' ? 'settlement' : 'world';
  G.ui.battle = { battle: b, items };
  goto('battle');
  audio.music(f.context.music ?? (s.day % 2 ? 'combat_a' : 'combat_b'));
}

export function startArmy(plan: ArmyBattlePlan): void {
  const s = game();
  G.ui.traveling = false;
  const b = buildArmyBattle(s, plan);
  const items: Record<string, number> = { ...s.stash };
  G.ui.returnTo = 'world';
  G.ui.battle = { battle: b, items };
  goto('battle');
  audio.music('army');
}

export function finishBattle(): void {
  const s = game();
  const bv = G.ui.battle;
  if (!bv) return;
  if (!bv.summary) bv.summary = applyBattle(s, bv.battle, bv.items);
  const sum = bv.summary;
  G.ui.battle = null;
  if (sum.levelUps.length) {
    audio.sfx('levelup');
    toast(`Level up: ${sum.levelUps.join(', ')} — spend stat points in the Crew screen`, 'good');
  }
  switch (sum.next) {
    case 'death':
    case 'victory':
      goto('ending');
      return;
    case 'afterRaid':
      goto('world');
      G.ui.selected = s.location;
      s.pending.unshift({ kind: 'story', id: 'after_raid' });
      autosave();
      flow();
      return;
    case 'final':
      goto('world');
      openScene(storyScene(s, 'final')!);
      return;
    case 'founded':
      goto('world');
      s.pending.unshift({ kind: 'message', title: 'A Hold of Your Own', text: `The banner of ${s.playerFaction?.name} flies over ${regionName(s.playerFaction!.capital)}. You are a warlord now: your holds pay you tribute each month, and from the Command tab you can muster troops and march on your neighbors. The other warlords have noticed.`, image: 'story/warlord_end' });
      autosave();
      flow();
      return;
    case 'delve':
      goto('delve');
      afterDelveFight();
      return;
    default:
      goto(G.ui.returnTo === 'delve' && !s.delve ? 'world' : G.ui.returnTo);
      autosave();
      flow();
  }
}

// ------------------------------------------------------------------------------ delves

export function enterDelve(id: string): void {
  const s = game();
  startDelve(s, id);
  goto('delve');
}

export function delveNext(): void {
  const s = game();
  const d = s.delve;
  if (!d) return;
  const room = d.rooms[d.room];
  if (room.done) {
    if (d.room < d.rooms.length - 1) d.room++;
    emit();
    return;
  }
  if (room.type === 'fight' || room.type === 'boss') {
    if (room.type === 'boss' && d.id === 'kiln') {
      openScene(storyScene(s, 'final')!);
      return;
    }
    startSkirmish(delveFight(s, room.type === 'boss'));
    return;
  }
  openScene(delveRoomScene(s));
}

function afterDelveFight(): void {
  const s = game();
  const d = s.delve;
  if (!d) return;
  const room = d.rooms[d.room];
  room.done = true;
  if (room.type === 'boss') {
    const fx = delveReward(s);
    fx.push(...checkDelveJobs(s, DELVES[d.id].region));
    const def = DELVES[d.id];
    s.delve = null;
    openScene({
      id: 'dreward', title: `${def.name} Cleared`, image: def.images[def.images.length - 1], text: 'The last defender falls. In the silence afterwards you search the deepest room and find what you came for.',
      choices: [{ label: 'Leave the ruins', resolve: () => ({ text: 'You climb back into the light, richer and harder than you went in.', effects: fx }) }],
    });
    if (def.id === 'blackglass') s.pending.unshift({ kind: 'story', id: 'keycard' });
    G.ui.returnTo = 'world';
    goto('world');
    autosave();
    return;
  }
  if (d.room < d.rooms.length - 1) d.room++;
  autosave();
  emit();
}

export function leaveDelve(): void {
  const s = game();
  s.delve = null;
  goto('world');
}

// ------------------------------------------------------------------------------ travel & time

let travelTimer = 0;

export function travelTo(dest: string): void {
  const s = game();
  if (s.flags.marching) return;
  if (!startTravel(s, dest)) return;
  audio.sfx('engine', { vol: 0.5 });
  G.ui.traveling = true;
  G.ui.panel = null;
  if (G.ui.screen !== 'world') goto('world');
  tick();
}

function tick(): void {
  clearTimeout(travelTimer);
  const s = G.game;
  if (!s || !G.ui.traveling) return;
  if (!s.travel) {
    G.ui.traveling = false;
    emit();
    return;
  }
  const r = advanceDay(s);
  if (r.newMonth) audio.sfx('page', { vol: 0.5 });
  if (s.day % 2 === 0) audio.sfx('step', { vol: 0.35 });
  if (r.arrived) {
    G.ui.selected = s.location;
    toast(`Arrived at ${regionName(s.location)}`);
    audio.sfx('door', { vol: 0.5 });
    autosave();
  }
  if (r.stop || r.arrived) {
    G.ui.traveling = s.travel !== null && !r.stop ? true : false;
    emit();
    flow();
    return;
  }
  emit();
  travelTimer = window.setTimeout(tick, 260);
}

export function resumeTravel(): void {
  const s = game();
  if (!s.travel) return;
  G.ui.traveling = true;
  tick();
}

export function stopTravel(): void {
  G.ui.traveling = false;
  emit();
}

export function rest(days: number): void {
  const s = game();
  G.ui.resting = days;
  const step = () => {
    if (!G.game || G.ui.resting <= 0) return;
    const r = advanceDay(s, true);
    G.ui.resting--;
    emit();
    if (r.stop) {
      G.ui.resting = 0;
      flow();
      return;
    }
    if (G.ui.resting > 0) setTimeout(step, 180);
    else {
      toast('Rested', 'good');
      autosave();
      flow();
    }
  };
  step();
}

export function select(region: string | null): void {
  G.ui.selected = region;
  audio.sfx('ui_click', { vol: 0.5 });
  emit();
}

export function enterSettlement(): void {
  audio.sfx('door');
  G.ui.tab = null;
  goto('settlement');
}

export function regionHasSettlement(id: string): boolean {
  const r = REGION_BY_ID[id];
  return r.market > 0 || r.bar || r.clinic || r.kind === 'capital' || id === 'emberroad';
}

// Debug/automation handle (used by the Playwright playtest scripts).
(window as unknown as Record<string, unknown>).__G = G;
(window as unknown as Record<string, unknown>).__api = { goto, emit, flow, openPanel, setTab, travelTo, select, startSkirmish, startArmy, enterDelve, finishBattle };
