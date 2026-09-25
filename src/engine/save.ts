import type { GameState } from '../game/types';
import { SAVE_VERSION } from '../game/state';

export const SLOTS = ['auto', '1', '2', '3'] as const;
export type Slot = (typeof SLOTS)[number];

export interface SaveMeta {
  slot: Slot;
  name: string;
  playbook: string;
  portrait: string;
  level: number;
  day: number;
  location: string;
  savedAt: number;
}

const key = (slot: Slot) => `burnlands.save.${slot}`;
const metaKey = (slot: Slot) => `burnlands.meta.${slot}`;

export function saveGame(s: GameState, slot: Slot): boolean {
  try {
    const pc = s.crew[0];
    const meta: SaveMeta = { slot, name: pc.name, playbook: pc.playbook, portrait: pc.portrait, level: pc.level, day: s.day, location: s.location, savedAt: Date.now() };
    localStorage.setItem(key(slot), JSON.stringify(s));
    localStorage.setItem(metaKey(slot), JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot: Slot): GameState | null {
  try {
    const raw = localStorage.getItem(key(slot));
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== SAVE_VERSION) return null;
    s.pending ??= [];
    s.delve ??= null;
    return s;
  } catch {
    return null;
  }
}

export function listSaves(): SaveMeta[] {
  const out: SaveMeta[] = [];
  for (const slot of SLOTS) {
    try {
      const raw = localStorage.getItem(metaKey(slot));
      if (raw) out.push(JSON.parse(raw));
    } catch { /* ignore */ }
  }
  return out;
}

export function deleteSave(slot: Slot): void {
  try {
    localStorage.removeItem(key(slot));
    localStorage.removeItem(metaKey(slot));
  } catch { /* ignore */ }
}

export function latestSave(): SaveMeta | null {
  const all = listSaves();
  return all.sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}
