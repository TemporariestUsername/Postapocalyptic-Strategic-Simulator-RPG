/**
 * Canvas renderer for tactical battles. The rules engine resolves actions instantly and emits
 * BattleEvents; the renderer replays them as animations against its own "display" copy of each unit.
 */
import { audio, weaponSfx } from '../engine/audio';
import { img, loadImage, token } from '../engine/assets';
import type { Roll } from '../engine/dice';
import type { Battle, BattleEvent, Unit } from './types';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

interface Disp {
  x: number; // pixel centre
  y: number;
  hp: number;
  troops: number;
  alpha: number;
  flash: number;
  dead: boolean;
  downed: boolean;
  lunge: { dx: number; dy: number; t: number } | null;
  pulse: number;
  pulseColor: string;
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: 'spark' | 'blood' | 'smoke' | 'ember' | 'psy' | 'dust'; g: number }
interface FloatText { x: number; y: number; text: string; color: string; life: number; max: number; size: number }
interface Tracer { x1: number; y1: number; x2: number; y2: number; life: number; max: number; color: string; width: number }
interface Ring { x: number; y: number; r: number; maxR: number; life: number; max: number; color: string }
interface DicePop { x: number; y: number; roll: Roll; life: number; max: number; label: string }

export interface Layout { tile: number; ox: number; oy: number }

export function layoutFor(b: Battle): Layout {
  const tile = 104;
  return { tile, ox: Math.round((STAGE_W - b.w * tile) / 2), oy: 92 };
}

const TEAM_COLORS = { player: '#ffb35c', ally: '#6fd6c8', enemy: '#e8493a', charmed: '#ff7ac8' };

export class BattleRenderer {
  b: Battle;
  L: Layout;
  ctx: CanvasRenderingContext2D | null = null;
  disp = new Map<string, Disp>();
  queue: BattleEvent[] = [];
  current: { e: BattleEvent; t: number; dur: number; started: boolean } | null = null;
  particles: Particle[] = [];
  texts: FloatText[] = [];
  tracers: Tracer[] = [];
  rings: Ring[] = [];
  dice: DicePop[] = [];
  shake = 0;
  flashScreen = 0;
  flashColor = '255,255,255';
  banner: { text: string; color: string; life: number; max: number } | null = null;
  time = 0;
  raf = 0;
  last = 0;
  onIdle: (() => void) | null = null;
  // input highlights (set by the UI)
  moveTiles = new Set<string>();
  targetUnits = new Set<string>();
  targetTiles = new Set<string>();
  aoeRadius = 0;
  hoverTile: [number, number] | null = null;
  pathPreview: [number, number][] = [];
  selected: string | null = null;
  hoverUnit: string | null = null;
  bg: HTMLImageElement;
  props = new Map<string, HTMLImageElement>();
  tokens = new Map<string, HTMLImageElement>();

  constructor(b: Battle) {
    this.b = b;
    this.L = layoutFor(b);
    this.bg = loadImage(img(`battlemaps/${b.battlemap}`));
    for (const t of b.tiles) if (t.prop && !this.props.has(t.prop)) this.props.set(t.prop, loadImage(img(`props/${t.prop}`)));
    for (const u of b.units) this.ensureUnit(u);
    this.drainInitialEvents();
  }

  private drainInitialEvents() {
    // events emitted during setup (phase banners) are played; spawn positions are already set
    this.enqueue();
  }

  ensureUnit(u: Unit) {
    if (!this.disp.has(u.id)) {
      const [x, y] = this.center(u.x, u.y);
      this.disp.set(u.id, { x, y, hp: u.hp, troops: u.troops ?? 0, alpha: 1, flash: 0, dead: !!u.dead, downed: !!u.downed, lunge: null, pulse: 0, pulseColor: '#fff' });
    }
    const src = u.portrait.startsWith('abilities/') ? img(u.portrait) : token(u.portrait);
    if (!this.tokens.has(src)) this.tokens.set(src, loadImage(src));
  }

  center(tx: number, ty: number): [number, number] {
    return [this.L.ox + tx * this.L.tile + this.L.tile / 2, this.L.oy + ty * this.L.tile + this.L.tile / 2];
  }

  tileAt(px: number, py: number): [number, number] | null {
    const tx = Math.floor((px - this.L.ox) / this.L.tile);
    const ty = Math.floor((py - this.L.oy) / this.L.tile);
    if (tx < 0 || ty < 0 || tx >= this.b.w || ty >= this.b.h) return null;
    return [tx, ty];
  }

  get busy(): boolean {
    return !!this.current || this.queue.length > 0;
  }

  /** Pull any new engine events into the animation queue. */
  enqueue() {
    if (this.b.events.length) {
      this.queue.push(...this.b.events);
      this.b.events.length = 0;
    }
  }

  attach(canvas: HTMLCanvasElement) {
    canvas.width = STAGE_W;
    canvas.height = STAGE_H;
    this.ctx = canvas.getContext('2d');
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  detach() {
    cancelAnimationFrame(this.raf);
  }

  // ------------------------------------------------------------------------------ event playback

  private unit(id: string): Unit | undefined {
    return this.b.units.find((u) => u.id === id);
  }

  private startEvent(e: BattleEvent): number {
    switch (e.t) {
      case 'move': {
        audio.sfx('step', { vol: 0.5 });
        return Math.max(0.12, (e.path.length - 1) * 0.13);
      }
      case 'attack': {
        const a = this.disp.get(e.from), t = this.disp.get(e.to);
        if (!a || !t) return 0.05;
        const au = this.unit(e.from);
        if (e.roll && au) this.popDice(a.x, a.y - 70, e.roll, '');
        if (e.ranged) {
          audio.sfx(weaponSfx(e.sfx), { vol: 0.8 });
          const col = e.sfx === 'laser' ? '#7fe0ff' : e.sfx === 'flame' ? '#ff9a3c' : e.sfx === 'bow' ? '#d9c7a0' : '#ffe0a0';
          const ang = Math.atan2(t.y - a.y, t.x - a.x);
          const miss = e.hit ? 0 : 0.18;
          const tx = t.x + Math.cos(ang + Math.PI / 2) * (miss ? 40 : 0), ty = t.y + Math.sin(ang + Math.PI / 2) * (miss ? 40 : 0);
          this.tracers.push({ x1: a.x + Math.cos(ang) * 40, y1: a.y + Math.sin(ang) * 40, x2: tx, y2: ty, life: 0.18, max: 0.18, color: col, width: e.sfx === 'shotgun' ? 5 : e.sfx === 'laser' ? 6 : 3 });
          if (e.sfx === 'shotgun') for (let i = 0; i < 4; i++) this.tracers.push({ x1: a.x, y1: a.y, x2: tx + (Math.random() - 0.5) * 60, y2: ty + (Math.random() - 0.5) * 60, life: 0.14, max: 0.14, color: col, width: 2 });
          if (e.sfx === 'flame') for (let i = 0; i < 26; i++) this.burst(a.x + (t.x - a.x) * Math.random(), a.y + (t.y - a.y) * Math.random(), 1, 'ember', '#ff8a2a');
          this.burst(a.x + Math.cos(ang) * 44, a.y + Math.sin(ang) * 44, 6, 'spark', '#ffd27a');
          this.shake = Math.max(this.shake, e.sfx === 'shotgun' || e.sfx === 'rifle' ? 6 : 3);
        } else {
          a.lunge = { dx: (t.x - a.x) * 0.35, dy: (t.y - a.y) * 0.35, t: 0 };
          audio.sfx(e.sfx === 'blade' ? 'blade' : e.sfx === 'bite' ? 'bite' : 'draw', { vol: 0.6 });
        }
        return e.ranged ? 0.45 : 0.42;
      }
      case 'roll': {
        const d = this.disp.get(e.unit);
        if (d) this.popDice(d.x, d.y - 70, e.roll, e.label);
        audio.sfx('dice_throw', { vol: 0.5 });
        return 0.55;
      }
      case 'damage': {
        const d = this.disp.get(e.unit);
        const u = this.unit(e.unit);
        if (!d || !u) return 0.05;
        if (!u.gang) d.hp = Math.max(0, d.hp - e.amount);
        d.flash = 1;
        const col = e.kind === 'psychic' ? '#c79bff' : e.kind === 'burn' ? '#ff9a3c' : '#ff5a44';
        this.float(d.x, d.y - 40, `-${e.amount}`, col, 40);
        if (e.kind === 'psychic') this.burst(d.x, d.y, 14, 'psy', '#b07cff');
        else if (e.kind !== 'burn') this.burst(d.x, d.y, u.armor >= 2 && e.amount <= 2 ? 8 : 16, u.armor >= 2 && e.amount <= 2 ? 'spark' : 'blood', u.armor >= 2 && e.amount <= 2 ? '#ffd27a' : '#9a1a10');
        else this.burst(d.x, d.y, 10, 'ember', '#ff8a2a');
        audio.sfx(u.armor >= 2 && e.amount <= 2 ? 'hit_metal' : 'hit', { vol: 0.8 });
        this.shake = Math.max(this.shake, 4 + Math.min(10, e.amount * 2));
        return 0.28;
      }
      case 'troops': {
        const d = this.disp.get(e.unit);
        if (!d) return 0.05;
        d.troops = Math.max(0, d.troops + e.delta);
        if (e.delta < 0) {
          d.flash = 1;
          this.float(d.x, d.y - 46, `${e.delta}`, '#ff5a44', 40);
          this.burst(d.x, d.y, 18, 'blood', '#9a1a10');
          this.burst(d.x, d.y, 8, 'dust', '#a08a6a');
          audio.sfx('hit', { vol: 0.9 });
          this.shake = Math.max(this.shake, 6);
        } else {
          this.float(d.x, d.y - 46, `+${e.delta}`, '#8fd16a', 36);
          audio.sfx('heal');
        }
        return 0.3;
      }
      case 'heal': {
        const d = this.disp.get(e.unit);
        if (!d) return 0.05;
        d.hp += e.amount;
        this.float(d.x, d.y - 40, `+${e.amount}`, '#8fd16a', 38);
        this.ring(d.x, d.y, '#8fd16a');
        this.burst(d.x, d.y, 10, 'spark', '#b8f08a');
        audio.sfx('heal');
        return 0.35;
      }
      case 'text': {
        const d = this.disp.get(e.unit);
        if (d) this.float(d.x, d.y - 62, e.text, e.color ?? '#ffe0b0', 26);
        return 0.18;
      }
      case 'death': {
        const d = this.disp.get(e.unit);
        if (d) {
          d.dead = true;
          this.burst(d.x, d.y, 24, 'blood', '#7a140c');
          this.burst(d.x, d.y, 10, 'dust', '#8a7a64');
        }
        audio.sfx('death');
        return 0.45;
      }
      case 'downed': {
        const d = this.disp.get(e.unit);
        if (d) { d.downed = true; d.hp = 0; }
        audio.sfx('death', { vol: 0.8, rate: 0.9 });
        return 0.45;
      }
      case 'revive': {
        const d = this.disp.get(e.unit);
        const u = this.unit(e.unit);
        if (d && u) { d.downed = false; d.hp = u.hp; this.ring(d.x, d.y, '#8fd16a'); this.float(d.x, d.y - 50, 'Revived!', '#8fd16a', 30); }
        audio.sfx('heal');
        return 0.5;
      }
      case 'spawn': {
        const u = this.unit(e.unit);
        if (u) {
          this.ensureUnit(u);
          const d = this.disp.get(u.id)!;
          d.alpha = 0;
          this.ring(d.x, d.y, '#ffb35c');
          this.burst(d.x, d.y, 12, 'dust', '#a08a6a');
        }
        audio.sfx('turret', { vol: 0.6 });
        return 0.35;
      }
      case 'blast': {
        const [x, y] = this.center(e.x, e.y);
        const col = e.kind === 'fire' ? '#ff8a2a' : e.kind === 'psychic' ? '#b07cff' : '#ffd27a';
        const n = 60;
        for (let i = 0; i < n; i++) this.burst(x + (Math.random() - 0.5) * this.L.tile * 2.4, y + (Math.random() - 0.5) * this.L.tile * 2.4, 1, e.kind === 'psychic' ? 'psy' : 'ember', col);
        for (let i = 0; i < 16; i++) this.burst(x, y, 1, 'smoke', e.kind === 'psychic' ? '#3a1a5a' : '#2a2420');
        this.rings.push({ x, y, r: 10, maxR: this.L.tile * 1.7, life: 0.45, max: 0.45, color: col });
        this.flashScreen = e.kind === 'psychic' ? 0.35 : 0.45;
        this.flashColor = e.kind === 'psychic' ? '170,110,255' : '255,190,120';
        this.shake = 16;
        audio.sfx(e.kind === 'psychic' ? 'psychic' : e.kind === 'fire' ? 'flame' : 'explosion');
        if (e.kind === 'frag') audio.sfx('boom', { vol: 0.7 });
        return 0.5;
      }
      case 'psychic': {
        const a = this.disp.get(e.from), t = this.disp.get(e.to);
        if (a && t) {
          for (let i = 0; i < 3; i++) this.tracers.push({ x1: a.x, y1: a.y, x2: t.x + (Math.random() - 0.5) * 20, y2: t.y + (Math.random() - 0.5) * 20, life: 0.4, max: 0.4, color: '#b07cff', width: 4 - i });
          this.ring(t.x, t.y, '#b07cff');
          this.flashScreen = 0.18;
          this.flashColor = '170,110,255';
        }
        audio.sfx('psychic', { vol: 0.8 });
        audio.sfx('glitch', { vol: 0.5 });
        return 0.45;
      }
      case 'buff': {
        const d = this.disp.get(e.unit);
        if (d) this.ring(d.x, d.y, e.kind === 'sermon' ? '#ffcf5a' : e.kind === 'rally' ? '#8fd16a' : e.kind === 'riposte' ? '#ff7ac8' : '#9ecbff');
        audio.sfx('equip', { vol: 0.5 });
        return 0.2;
      }
      case 'phase': {
        const txt = e.phase === 'player' ? `YOUR TURN · ROUND ${e.turn}` : e.phase === 'enemy' ? 'ENEMY TURN' : 'ALLIES';
        this.banner = { text: txt, color: e.phase === 'player' ? '#ffb35c' : '#e8493a', life: 1.2, max: 1.2 };
        audio.sfx(e.phase === 'player' ? 'ui_confirm' : 'draw', { vol: 0.6 });
        return 0.75;
      }
      case 'log':
        return 0;
    }
    return 0.05;
  }

  private stepEvent(e: BattleEvent, p: number) {
    if (e.t === 'move') {
      const d = this.disp.get(e.unit);
      if (!d) return;
      const segs = e.path.length - 1;
      if (segs <= 0) return;
      const f = Math.min(segs, p * segs);
      const i = Math.min(segs - 1, Math.floor(f));
      const t = f - i;
      const [ax, ay] = this.center(e.path[i][0], e.path[i][1]);
      const [bx, by] = this.center(e.path[i + 1][0], e.path[i + 1][1]);
      d.x = ax + (bx - ax) * t;
      d.y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 6;
      if (Math.random() < 0.3) this.burst(d.x, d.y + 30, 1, 'dust', '#8a7a64');
    }
    if (e.t === 'attack' && !e.ranged) {
      const a = this.disp.get(e.from);
      if (a?.lunge) {
        a.lunge.t = p;
        if (p > 0.45 && p < 0.55 && e.hit) {
          const t = this.disp.get(e.to);
          if (t) this.burst(t.x, t.y, 4, 'spark', '#fff0c0');
        }
      }
    }
  }

  private endEvent(e: BattleEvent) {
    if (e.t === 'move') {
      const d = this.disp.get(e.unit);
      const last = e.path[e.path.length - 1];
      if (d) [d.x, d.y] = this.center(last[0], last[1]);
    }
    if (e.t === 'attack') {
      const a = this.disp.get(e.from);
      if (a) a.lunge = null;
      if (!e.hit) {
        const t = this.disp.get(e.to);
        if (t) this.float(t.x, t.y - 40, 'MISS', '#c9b89c', 30);
        audio.sfx('miss', { vol: 0.5 });
      } else if (e.crit) {
        const t = this.disp.get(e.to);
        if (t) this.float(t.x, t.y - 80, 'CRITICAL!', '#ffcf5a', 34);
      }
    }
  }

  /** Snap display state to the engine (called when the queue empties). */
  sync() {
    for (const u of this.b.units) {
      this.ensureUnit(u);
      const d = this.disp.get(u.id)!;
      [d.x, d.y] = this.center(u.x, u.y);
      d.hp = u.hp;
      d.troops = u.troops ?? 0;
      d.dead = !!u.dead;
      d.downed = !!u.downed;
      d.lunge = null;
    }
  }

  update(dt: number) {
    this.time += dt;
    this.enqueue();
    // advance animation queue
    let guard = 0;
    while (guard++ < 50) {
      if (!this.current) {
        const e = this.queue.shift();
        if (!e) break;
        this.current = { e, t: 0, dur: 0, started: false };
      }
      const c = this.current;
      if (!c.started) {
        c.dur = this.startEvent(c.e);
        c.started = true;
      }
      c.t += guard === 1 ? dt : 0;
      if (c.dur <= 0 || c.t >= c.dur) {
        this.stepEvent(c.e, 1);
        this.endEvent(c.e);
        this.current = null;
        if (!this.queue.length) {
          this.sync();
          this.onIdle?.();
        }
        continue;
      }
      this.stepEvent(c.e, c.t / c.dur);
      break;
    }
    // effects
    for (const d of this.disp.values()) {
      d.flash = Math.max(0, d.flash - dt * 4);
      if (d.alpha < 1 && !d.dead) d.alpha = Math.min(1, d.alpha + dt * 3);
      d.pulse = Math.max(0, d.pulse - dt * 2);
    }
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.vx *= 0.96;
      if (p.kind === 'smoke') { p.vy *= 0.97; p.size += dt * 30; }
    }
    this.texts = this.texts.filter((t) => (t.life -= dt) > 0);
    for (const t of this.texts) t.y -= dt * 40;
    this.tracers = this.tracers.filter((t) => (t.life -= dt) > 0);
    this.rings = this.rings.filter((r) => (r.life -= dt) > 0);
    for (const r of this.rings) r.r += (r.maxR - r.r) * Math.min(1, dt * 8);
    this.dice = this.dice.filter((d) => (d.life -= dt) > 0);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flashScreen = Math.max(0, this.flashScreen - dt * 1.6);
    if (this.banner) { this.banner.life -= dt; if (this.banner.life <= 0) this.banner = null; }
    // ambient embers
    if (Math.random() < dt * 8) this.particles.push({ x: Math.random() * STAGE_W, y: STAGE_H + 10, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 50, life: 8, max: 8, color: '#ff9a4a', size: 1.5 + Math.random() * 2, kind: 'ember', g: 0 });
  }

  burst(x: number, y: number, n: number, kind: Particle['kind'], color: string) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = kind === 'smoke' ? 20 + Math.random() * 40 : kind === 'dust' ? 20 + Math.random() * 60 : 80 + Math.random() * 260;
      const life = kind === 'smoke' ? 1.2 + Math.random() : kind === 'blood' ? 0.5 + Math.random() * 0.4 : 0.35 + Math.random() * 0.5;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'ember' ? 60 : 0), life, max: life, color, size: kind === 'smoke' ? 14 + Math.random() * 10 : kind === 'blood' ? 2 + Math.random() * 4 : 1.5 + Math.random() * 3, kind, g: kind === 'blood' ? 500 : kind === 'ember' ? -40 : 0 });
    }
  }

  float(x: number, y: number, text: string, color: string, size: number) {
    this.texts.push({ x: x + (Math.random() - 0.5) * 16, y, text, color, life: 1.1, max: 1.1, size });
  }

  ring(x: number, y: number, color: string) {
    this.rings.push({ x, y, r: 20, maxR: 70, life: 0.5, max: 0.5, color });
  }

  popDice(x: number, y: number, roll: Roll, label: string) {
    this.dice.push({ x, y, roll, life: 1.3, max: 1.3, label });
  }

  // ------------------------------------------------------------------------------ drawing

  private teamColor(u: Unit): string {
    if (u.status.charmed) return TEAM_COLORS.charmed;
    if (u.team === 1) return TEAM_COLORS.enemy;
    return u.controlled ? TEAM_COLORS.player : TEAM_COLORS.ally;
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const { tile, ox, oy } = this.L;
    const b = this.b;
    ctx.save();
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    ctx.translate(sx, sy);
    // background
    if (this.bg.complete && this.bg.naturalWidth) {
      const s = Math.max(STAGE_W / this.bg.naturalWidth, STAGE_H / this.bg.naturalHeight) * 1.02;
      const w = this.bg.naturalWidth * s, h = this.bg.naturalHeight * s;
      ctx.drawImage(this.bg, (STAGE_W - w) / 2, (STAGE_H - h) / 2, w, h);
    } else {
      ctx.fillStyle = '#2a2016';
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    }
    // darken outside the field
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-20, -20, STAGE_W + 40, oy + 20);
    ctx.fillRect(-20, oy + b.h * tile, STAGE_W + 40, STAGE_H);
    ctx.fillRect(-20, oy, ox + 20, b.h * tile);
    ctx.fillRect(ox + b.w * tile, oy, STAGE_W, b.h * tile);
    // grid
    ctx.strokeStyle = 'rgba(255,235,200,0.10)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= b.w; x++) { ctx.beginPath(); ctx.moveTo(ox + x * tile + 0.5, oy); ctx.lineTo(ox + x * tile + 0.5, oy + b.h * tile); ctx.stroke(); }
    for (let y = 0; y <= b.h; y++) { ctx.beginPath(); ctx.moveTo(ox, oy + y * tile + 0.5); ctx.lineTo(ox + b.w * tile, oy + y * tile + 0.5); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,160,80,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, b.w * tile, b.h * tile);
    // burning ground
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const t = b.tiles[y * b.w + x];
      if (t.fire) {
        const [cx, cy] = this.center(x, y);
        const g = ctx.createRadialGradient(cx, cy, 5, cx, cy, tile * 0.6);
        g.addColorStop(0, `rgba(255,140,40,${0.35 + Math.sin(this.time * 9 + x) * 0.1})`);
        g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - tile / 2, cy - tile / 2, tile, tile);
        if (Math.random() < 0.3) this.burst(cx + (Math.random() - 0.5) * tile * 0.7, cy + (Math.random() - 0.5) * tile * 0.7, 1, 'ember', '#ff8a2a');
      }
    }
    // move / target highlights
    for (const key of this.moveTiles) {
      const [x, y] = key.split(',').map(Number);
      ctx.fillStyle = 'rgba(90,170,255,0.20)';
      ctx.fillRect(ox + x * tile + 3, oy + y * tile + 3, tile - 6, tile - 6);
      ctx.strokeStyle = 'rgba(120,190,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox + x * tile + 3.5, oy + y * tile + 3.5, tile - 7, tile - 7);
    }
    for (const key of this.targetTiles) {
      const [x, y] = key.split(',').map(Number);
      ctx.fillStyle = 'rgba(255,120,60,0.10)';
      ctx.fillRect(ox + x * tile + 3, oy + y * tile + 3, tile - 6, tile - 6);
    }
    if (this.hoverTile && this.aoeRadius && this.targetTiles.has(`${this.hoverTile[0]},${this.hoverTile[1]}`)) {
      const [hx, hy] = this.hoverTile;
      ctx.fillStyle = 'rgba(255,80,40,0.28)';
      ctx.strokeStyle = 'rgba(255,140,80,0.9)';
      ctx.lineWidth = 2;
      const r = this.aoeRadius;
      ctx.fillRect(ox + (hx - r) * tile, oy + (hy - r) * tile, tile * (2 * r + 1), tile * (2 * r + 1));
      ctx.strokeRect(ox + (hx - r) * tile, oy + (hy - r) * tile, tile * (2 * r + 1), tile * (2 * r + 1));
    }
    if (this.hoverTile) {
      const [hx, hy] = this.hoverTile;
      ctx.strokeStyle = 'rgba(255,220,170,0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + hx * tile + 2, oy + hy * tile + 2, tile - 4, tile - 4);
    }
    // path preview
    if (this.pathPreview.length > 1) {
      ctx.strokeStyle = 'rgba(140,200,255,0.9)';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -this.time * 30;
      ctx.beginPath();
      this.pathPreview.forEach(([x, y], i) => { const [cx, cy] = this.center(x, y); if (i) ctx.lineTo(cx, cy); else ctx.moveTo(cx, cy); });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // props (sorted top to bottom)
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const t = b.tiles[y * b.w + x];
      if (!t.prop) continue;
      const im = this.props.get(t.prop);
      if (!im || !im.complete || !im.naturalWidth) continue;
      const [cx, cy] = this.center(x, y);
      const base = tile * 1.12 * (t.scale ?? 1);
      const k = base / Math.max(im.naturalWidth, im.naturalHeight);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((t.rot ?? 0) * Math.PI) / 180);
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 8;
      ctx.shadowOffsetY = 10;
      ctx.drawImage(im, (-im.naturalWidth * k) / 2, (-im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
      ctx.restore();
      if (t.prop === 'fire' && Math.random() < 0.25) this.burst(cx + (Math.random() - 0.5) * 20, cy - 10, 1, 'ember', '#ff9a3c');
    }
    // units: dead first, then living by y
    const units = [...b.units].sort((a, c) => Number(!(this.disp.get(a.id)?.dead)) - Number(!(this.disp.get(c.id)?.dead)) || (this.disp.get(a.id)?.y ?? 0) - (this.disp.get(c.id)?.y ?? 0));
    for (const u of units) this.drawUnit(ctx, u);
    // tracers
    ctx.globalCompositeOperation = 'lighter';
    for (const t of this.tracers) {
      const a = t.life / t.max;
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = t.width;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // particles
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.max);
      if (p.kind === 'smoke' || p.kind === 'blood' || p.kind === 'dust') continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === 'psy' ? 1.6 : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.particles) {
      if (p.kind !== 'smoke' && p.kind !== 'blood' && p.kind !== 'dust') continue;
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = p.kind === 'smoke' ? a * 0.45 : p.kind === 'dust' ? a * 0.5 : a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // rings
    for (const r of this.rings) {
      ctx.globalAlpha = r.life / r.max;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // floating text
    for (const t of this.texts) {
      const a = Math.min(1, t.life / (t.max * 0.5));
      ctx.globalAlpha = a;
      ctx.font = `700 ${t.size}px Oswald, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    // dice pops
    for (const d of this.dice) this.drawDice(ctx, d);
    ctx.restore();
    // screen flash
    if (this.flashScreen > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flashScreen * 0.4})`;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    }
    // phase banner
    if (this.banner) {
      const p = 1 - this.banner.life / this.banner.max;
      const a = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1;
      ctx.globalAlpha = a;
      const y = STAGE_H / 2 - 40;
      const g = ctx.createLinearGradient(0, 0, STAGE_W, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.3, 'rgba(0,0,0,0.8)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.8)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 60, STAGE_W, 120);
      ctx.font = '700 64px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.banner.color;
      ctx.shadowColor = this.banner.color;
      ctx.shadowBlur = 20;
      ctx.fillText(this.banner.text, STAGE_W / 2 + (1 - a) * 60, y + 22);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  private drawUnit(ctx: CanvasRenderingContext2D, u: Unit) {
    const d = this.disp.get(u.id);
    if (!d) return;
    if (d.dead && d.alpha <= 0.02) return;
    const tile = this.L.tile;
    let x = d.x, y = d.y;
    if (d.lunge) {
      const k = Math.sin(d.lunge.t * Math.PI);
      x += d.lunge.dx * k;
      y += d.lunge.dy * k;
    }
    const gang = !!u.gang;
    const r = tile * (gang ? 0.44 : 0.38);
    const col = this.teamColor(u);
    const isSel = this.selected === u.id;
    const isTarget = this.targetUnits.has(u.id);
    const bob = isSel && !d.dead ? Math.sin(this.time * 5) * 2 : 0;
    y += bob;
    ctx.save();
    if (d.dead) {
      d.alpha = Math.max(0.35, d.alpha - 0.01);
      ctx.globalAlpha = 0.5;
      ctx.filter = 'grayscale(1) brightness(0.45)';
    } else ctx.globalAlpha = d.alpha;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x + 6, y + r * 0.85, r * 1.0, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // gang crowd hint
    if (gang && !d.dead) {
      for (const [dx, dy] of [[-r * 0.8, -r * 0.35], [r * 0.8, -r * 0.35], [0, -r * 0.7]]) {
        ctx.fillStyle = '#1a120c';
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    // target highlight
    if (isTarget && !d.dead) {
      ctx.strokeStyle = `rgba(255,80,50,${0.6 + Math.sin(this.time * 8) * 0.3})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, r + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (isSel) {
      ctx.strokeStyle = '#fff2d0';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = this.time * 20;
      ctx.beginPath();
      ctx.arc(x, y, r + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // ring & portrait
    ctx.fillStyle = '#0d0907';
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.fill();
    const src = u.portrait.startsWith('abilities/') ? img(u.portrait) : token(u.portrait);
    const im = this.tokens.get(src);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    if (im?.complete && im.naturalWidth) ctx.drawImage(im, x - r, y - r, r * 2, r * 2);
    if (d.flash > 0) {
      ctx.fillStyle = `rgba(255,60,40,${d.flash * 0.6})`;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (d.downed) {
      ctx.fillStyle = 'rgba(120,0,0,0.45)';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r + 1, 0, Math.PI * 2);
    ctx.stroke();
    // ready indicator (player units that can still act)
    if (u.controlled && !u.dead && !u.downed && this.b.phase === 'player' && (!u.acted || !u.moved)) {
      ctx.fillStyle = !u.acted ? '#ffb35c' : '#6aa8ff';
      ctx.beginPath();
      ctx.arc(x + r * 0.78, y - r * 0.78, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.filter = 'none';
    // health / troops
    if (!d.dead) {
      const bw = r * 2, bh = 8;
      const bx = x - r, by = y + r + 8;
      if (gang) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(x - 34, by - 4, 68, 26);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 34, by - 4, 68, 26);
        ctx.font = '700 20px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(String(Math.round(d.troops)), x, by + 16);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        const pct = Math.max(0, d.hp / u.maxHp);
        ctx.fillStyle = pct > 0.6 ? '#7fc44f' : pct > 0.3 ? '#e0a03a' : '#e0493a';
        ctx.fillRect(bx, by, bw * pct, bh);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for (let i = 1; i < u.maxHp; i++) ctx.fillRect(bx + (bw * i) / u.maxHp, by, 1, bh);
      }
      // status icons
      const st: [string, string][] = [];
      if (u.status.burning) st.push(['🔥', '#ff8a2a']);
      if (u.status.pinned) st.push(['PIN', '#e0c060']);
      if (u.status.captivated) st.push(['♥', '#ff7ac8']);
      if (u.status.charmed) st.push(['♥', '#ff7ac8']);
      if (u.status.defend) st.push(['▣', '#9ecbff']);
      if (u.status.overwatch) st.push(['◎', '#ffb35c']);
      if (u.status.sermon || u.status.zeal) st.push(['▲', '#ffcf5a']);
      if (u.status.warcry) st.push(['▼', '#e0c060']);
      if (u.status.rally) st.push(['+', '#8fd16a']);
      if (d.downed) st.push([`✚${u.bleedout ?? ''}`, '#ff4a4a']);
      ctx.font = '700 16px "Barlow Condensed", sans-serif';
      st.forEach(([t, c], i) => {
        const sx = x - r + i * 26;
        const sy = y - r - 10;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(sx - 2, sy - 16, 26, 20);
        ctx.fillStyle = c;
        ctx.textAlign = 'center';
        ctx.fillText(t, sx + 11, sy);
      });
    }
    ctx.restore();
  }

  private drawDice(ctx: CanvasRenderingContext2D, d: DicePop) {
    const p = 1 - d.life / d.max;
    const a = p < 0.1 ? p / 0.1 : p > 0.8 ? (1 - p) / 0.2 : 1;
    const y = d.y - p * 20;
    ctx.globalAlpha = a;
    const w = 190, h = 52;
    ctx.fillStyle = 'rgba(10,7,5,0.92)';
    ctx.strokeStyle = d.roll.outcome === 'strong' ? '#8fd16a' : d.roll.outcome === 'weak' ? '#ffb35c' : '#e8493a';
    ctx.lineWidth = 2;
    ctx.fillRect(d.x - w / 2, y - h / 2, w, h);
    ctx.strokeRect(d.x - w / 2, y - h / 2, w, h);
    // dice faces
    for (let i = 0; i < 2; i++) {
      const dx = d.x - w / 2 + 12 + i * 42, dy = y - 17;
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(dx, dy, 34, 34);
      ctx.fillStyle = '#2a1a0e';
      ctx.font = '700 24px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(d.roll.dice[i]), dx + 17, dy + 27);
    }
    ctx.textAlign = 'left';
    ctx.font = '700 26px "Barlow Condensed", sans-serif';
    ctx.fillStyle = ctx.strokeStyle as string;
    const m = d.roll.mod >= 0 ? `+${d.roll.mod}` : `${d.roll.mod}`;
    ctx.fillText(`${m} = ${d.roll.total}`, d.x - w / 2 + 102, y + 9);
    if (d.label) {
      ctx.font = '600 15px "Barlow Condensed", sans-serif';
      ctx.fillStyle = '#c9b89c';
      ctx.textAlign = 'center';
      ctx.fillText(d.label.toUpperCase(), d.x, y - h / 2 - 6);
    }
    ctx.globalAlpha = 1;
  }
}
