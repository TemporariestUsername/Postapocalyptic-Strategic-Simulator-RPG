/**
 * Music: two streaming <audio> elements crossfaded. SFX: decoded WebAudio buffers with slight
 * pitch variation so repeated gunshots and footsteps don't sound robotic.
 */
const SFX_NAMES = [
  'ui_click', 'ui_hover', 'ui_open', 'ui_close', 'ui_confirm', 'ui_error', 'page', 'coins', 'dice_shake', 'dice_throw',
  'blade', 'blade2', 'draw', 'bow', 'blunt', 'bite', 'hit', 'hit_metal', 'death', 'flame', 'laser', 'explosion', 'boom',
  'psychic', 'glitch', 'heal', 'step', 'miss', 'levelup', 'turret', 'door', 'engine', 'equip', 'drop',
  'pistol', 'revolver', 'shotgun', 'rifle', 'auto', 'assault',
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

interface Settings { music: number; sfx: number; muted: boolean }

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('burnlands.audio');
    if (raw) return { music: 0.55, sfx: 0.8, muted: false, ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return { music: 0.55, sfx: 0.8, muted: false };
}

class AudioManager {
  settings: Settings = loadSettings();
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private decks: HTMLAudioElement[] = [];
  private active = 0;
  private current: string | null = null;
  private fadeRaf = 0;
  private unlocked = false;

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.ctx.destination);
      this.applyVolumes();
      for (const n of SFX_NAMES) void this.load(n);
    } catch { /* no audio */ }
    if (this.current) {
      const want = this.current;
      this.current = null;
      this.music(want);
    }
  }

  private load(name: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return Promise.resolve(null);
    let p = this.loading.get(name);
    if (!p) {
      const ctx = this.ctx;
      p = fetch(`./assets/sfx/${name}.mp3`)
        .then((r) => r.arrayBuffer())
        .then((a) => ctx.decodeAudioData(a))
        .then((b) => { this.buffers.set(name, b); return b; })
        .catch(() => null);
      this.loading.set(name, p);
    }
    return p;
  }

  sfx(name: SfxName, opts: { vol?: number; rate?: number; delay?: number } = {}): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const buf = this.buffers.get(name);
    if (!buf) { void this.load(name); return; }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (opts.rate ?? 1) * (0.94 + Math.random() * 0.12);
    const g = this.ctx.createGain();
    g.gain.value = opts.vol ?? 1;
    src.connect(g).connect(this.sfxGain);
    src.start(this.ctx.currentTime + (opts.delay ?? 0));
  }

  music(track: string | null): void {
    if (track === this.current) return;
    this.current = track;
    if (!this.unlocked) return;
    if (!this.decks.length) {
      for (let i = 0; i < 2; i++) {
        const a = new Audio();
        a.loop = true;
        a.preload = 'auto';
        a.volume = 0;
        this.decks.push(a);
      }
    }
    const from = this.decks[this.active];
    this.active = 1 - this.active;
    const to = this.decks[this.active];
    if (track) {
      to.src = `./assets/music/${track}.webm`;
      to.currentTime = 0;
      void to.play().catch(() => undefined);
    }
    cancelAnimationFrame(this.fadeRaf);
    const start = performance.now();
    const dur = 1800;
    const target = () => (this.settings.muted ? 0 : this.settings.music);
    const fromVol = from.volume;
    const step = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / dur));
      from.volume = Math.max(0, Math.min(1, fromVol * (1 - t)));
      if (track) to.volume = Math.max(0, Math.min(1, target() * t));
      if (t < 1) this.fadeRaf = requestAnimationFrame(step);
      else {
        from.pause();
        if (!track) to.pause();
      }
    };
    this.fadeRaf = requestAnimationFrame(step);
  }

  get currentTrack(): string | null {
    return this.current;
  }

  applyVolumes(): void {
    if (this.sfxGain) this.sfxGain.gain.value = this.settings.muted ? 0 : this.settings.sfx;
    const deck = this.decks[this.active];
    if (deck && this.current) deck.volume = this.settings.muted ? 0 : this.settings.music;
    try { localStorage.setItem('burnlands.audio', JSON.stringify(this.settings)); } catch { /* ignore */ }
  }

  set(k: keyof Settings, v: number | boolean): void {
    (this.settings as unknown as Record<string, number | boolean>)[k] = v;
    this.applyVolumes();
  }
}

export const audio = new AudioManager();

const WEAPON_SFX: Record<string, SfxName> = {
  blade: 'blade', blunt: 'blunt', pistol: 'pistol', rifle: 'rifle', shotgun: 'shotgun', auto: 'auto', bow: 'bow', flame: 'flame', laser: 'laser', bite: 'bite',
};
export function weaponSfx(kind: string): SfxName {
  return WEAPON_SFX[kind] ?? 'blunt';
}
