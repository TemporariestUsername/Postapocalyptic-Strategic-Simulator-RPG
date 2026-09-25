import { G, openPanel, emit } from './store';

export function installHotkeys(): () => void {
  const k = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const scr = G.ui.screen;
    if (!G.game || !['world', 'settlement', 'delve'].includes(scr) || G.ui.scene) return;
    const key = e.key.toLowerCase();
    if (key === 'c') openPanel('crew');
    else if (key === 'j') openPanel('journal');
    else if (key === 'f') openPanel('factions');
    else if (key === 'escape') {
      if (G.ui.panel) { G.ui.panel = null; emit(); }
      else if (scr === 'settlement' && G.ui.tab) { G.ui.tab = null; emit(); }
      else openPanel('menu');
    }
  };
  window.addEventListener('keydown', k);
  return () => window.removeEventListener('keydown', k);
}
