import { runAi } from './ai';
import { beginPhase, emit } from './battle';
import type { Battle } from './types';

/** Player ends their turn: AI allies act, then the enemy, then a new round begins. */
export function endPlayerTurn(b: Battle): void {
  if (b.result) return;
  b.phase = 'ally';
  beginPhase(b, 0, false);
  runAi(b, 0, false);
  if (!b.result) {
    b.phase = 'enemy';
    emit(b, { t: 'phase', phase: 'enemy', turn: b.turn });
    beginPhase(b, 1, null);
    runAi(b, 1, null);
  }
  if (!b.result) {
    b.turn++;
    b.phase = 'player';
    emit(b, { t: 'phase', phase: 'player', turn: b.turn });
    beginPhase(b, 0, true);
  }
}

/** Headless helper: let the AI play the player's side too (tests & auto-resolve). */
export function autoPlay(b: Battle, maxTurns = 40): void {
  while (!b.result && b.turn <= maxTurns) {
    runAi(b, 0, true);
    endPlayerTurn(b);
  }
}
