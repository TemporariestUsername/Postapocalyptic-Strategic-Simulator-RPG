import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../../engine/audio';
import { img, isPortrait, token, TOKEN_CROP } from '../../engine/assets';
import type { Roll } from '../../engine/dice';
import { fmtMod } from '../../engine/dice';

// ------------------------------------------------------------------------------ stage scaling

export function Stage({ children }: { children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => {
      const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      if (ref.current) ref.current.style.transform = `scale(${s}) translate(-50%, -50%)`;
      document.documentElement.style.setProperty('--stage-scale', String(s));
    };
    fit();
    window.addEventListener('resize', fit);
    // belt and braces for browsers without overflow: clip
    const el = ref.current!;
    const unscroll = () => { if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } };
    el.addEventListener('scroll', unscroll);
    return () => { window.removeEventListener('resize', fit); el.removeEventListener('scroll', unscroll); };
  }, []);
  return (
    <div id="stage" ref={ref} style={{ transform: 'translate(-50%, -50%)' }}>
      {children}
      <div class="vignette" />
      <div class="grain" />
      <TipLayer />
    </div>
  );
}

// ------------------------------------------------------------------------------ buttons

type BtnProps = JSX.HTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'psy' | '';
  size?: 'sm' | 'lg' | '';
  block?: boolean;
  disabled?: boolean;
  tip?: ComponentChildren;
  sfx?: false | 'ui_click' | 'ui_confirm' | 'coins' | 'equip';
};

export function Btn({ variant = '', size = '', block, tip, sfx = 'ui_click', onClick, children, class: cls, ...rest }: BtnProps) {
  const tipProps = useTip(tip);
  return (
    <button
      {...rest}
      {...tipProps}
      class={`btn ${variant} ${size} ${block ? 'block' : ''} ${cls ?? ''}`}
      onMouseEnter={(e) => { tipProps.onMouseEnter?.(e); if (!rest.disabled) audio.sfx('ui_hover', { vol: 0.35 }); }}
      onClick={(e) => { if (rest.disabled) return; if (sfx) audio.sfx(sfx); onClick?.(e as never); }}
    >
      {children}
    </button>
  );
}

export function IconBtn({ icon, label, onClick, on, hotkey }: { icon: string; label: string; onClick: () => void; on?: boolean; hotkey?: string }) {
  const tipProps = useTip(<><b>{label}</b>{hotkey && <span class="dim"> · {hotkey}</span>}</>);
  return (
    <div class={`icon-btn ${on ? 'on' : ''}`} {...tipProps} onClick={() => { audio.sfx('ui_click'); onClick(); }}>
      <img src={img(icon)} style={{ width: 44, height: 44, borderRadius: 2 }} />
    </div>
  );
}

// ------------------------------------------------------------------------------ portraits & tokens

export function Portrait({ src, size = 120, w, h, style, class: cls }: { src: string; size?: number; w?: number; h?: number; style?: JSX.CSSProperties; class?: string }) {
  return (
    <div class={`portrait ${cls ?? ''}`} style={{ width: w ?? size, height: h ?? size, ...style }}>
      <img src={img(src)} loading="lazy" />
    </div>
  );
}

export function Token({ src, size = 64, color = 'var(--ember)', style, dead }: { src: string; size?: number; color?: string; style?: JSX.CSSProperties; dead?: boolean }) {
  return (
    <div class="token-ring" style={{ width: size, height: size, borderColor: color, filter: dead ? 'grayscale(1) brightness(0.5)' : undefined, flexShrink: 0, ...style }}>
      <img src={token(src)} style={isPortrait(src) ? { width: `${100 / TOKEN_CROP.s}%`, height: `${100 / TOKEN_CROP.s}%`, maxWidth: 'none', marginLeft: `-${(TOKEN_CROP.x / TOKEN_CROP.s) * 100}%`, marginTop: `-${(TOKEN_CROP.y / TOKEN_CROP.s) * 100}%` } : undefined} />
    </div>
  );
}

export function HpBar({ hp, max, width = 160, height = 12, label }: { hp: number; max: number; width?: number | string; height?: number; label?: boolean }) {
  const pct = Math.max(0, Math.min(1, hp / Math.max(1, max)));
  const cls = pct > 0.6 ? 'hp-good' : pct > 0.3 ? 'hp-mid' : '';
  return (
    <div class="col" style={{ gap: 2, width }}>
      <div class={`bar segmented ${cls}`} style={{ height }}>
        <i style={{ width: `${pct * 100}%` }} />
      </div>
      {label && <div class="tiny num dim" style={{ textAlign: 'right' }}>{hp}/{max} HARM</div>}
    </div>
  );
}

export function XpBar({ xp, need, width = 160 }: { xp: number; need: number; width?: number | string }) {
  return (
    <div class="bar xp" style={{ width, height: 6 }}>
      <i style={{ width: `${Math.min(100, (xp / need) * 100)}%` }} />
    </div>
  );
}

export function Icon({ src, size = 40, style }: { src: string; size?: number; style?: JSX.CSSProperties }) {
  return <img src={img(src)} style={{ width: size, height: size, display: 'block', borderRadius: 2, ...style }} />;
}

// ------------------------------------------------------------------------------ tooltips

let tipContent: ComponentChildren = null;
let tipPos = { x: 0, y: 0 };
const tipListeners = new Set<() => void>();
function setTip(c: ComponentChildren, x = 0, y = 0) {
  tipContent = c;
  tipPos = { x, y };
  for (const l of tipListeners) l();
}

function stagePoint(e: MouseEvent): { x: number; y: number } {
  const stage = document.getElementById('stage');
  if (!stage) return { x: e.clientX, y: e.clientY };
  const r = stage.getBoundingClientRect();
  const s = r.width / 1920;
  return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
}

export function useTip(content: ComponentChildren) {
  if (!content) return {} as { onMouseEnter?: (e: MouseEvent) => void; onMouseMove?: (e: MouseEvent) => void; onMouseLeave?: () => void };
  return {
    onMouseEnter: (e: MouseEvent) => { const p = stagePoint(e); setTip(content, p.x, p.y); },
    onMouseMove: (e: MouseEvent) => { const p = stagePoint(e); setTip(content, p.x, p.y); },
    onMouseLeave: () => setTip(null),
  };
}

export function hideTip() { setTip(null); }

function TipLayer() {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((n) => n + 1);
    tipListeners.add(l);
    return () => void tipListeners.delete(l);
  }, []);
  if (!tipContent) return null;
  const left = tipPos.x > 1460 ? tipPos.x - 440 : tipPos.x + 22;
  const top = tipPos.y > 820 ? tipPos.y - 190 : tipPos.y + 22;
  return <div class="tip" style={{ left, top }}>{tipContent}</div>;
}

// ------------------------------------------------------------------------------ embers

export function Embers({ count = 70, color = '255,140,60', rise = 1 }: { count?: number; color?: string; rise?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    cv.width = 1920;
    cv.height = 1080;
    const ps = Array.from({ length: count }, () => spawn(true));
    function spawn(initial = false) {
      return { x: Math.random() * 1920, y: initial ? Math.random() * 1080 : 1090, vx: (Math.random() - 0.5) * 0.6, vy: -(0.4 + Math.random() * 1.4) * rise, r: 0.8 + Math.random() * 2.4, life: Math.random() * Math.PI * 2, a: 0.3 + Math.random() * 0.7 };
    }
    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, 1920, 1080);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) {
        p.life += 0.03;
        p.x += p.vx + Math.sin(p.life) * 0.4;
        p.y += p.vy;
        if (p.y < -20) Object.assign(p, spawn());
        const flick = 0.6 + Math.sin(p.life * 3) * 0.4;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(${color},${p.a * flick})`);
        g.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} class="fx-canvas" />;
}

// ------------------------------------------------------------------------------ dice

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

export function Die({ value, rolling, size = 72, delay = 0 }: { value: number; rolling?: boolean; size?: number; delay?: number }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!rolling) { setShown(value); return; }
    const t = setInterval(() => setShown(1 + Math.floor(Math.random() * 6)), 70);
    return () => clearInterval(t);
  }, [rolling, value]);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ animation: rolling ? `diceShake 0.25s ${delay}s infinite` : 'diceLand 0.35s ease-out', filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.7))' }}>
      <defs>
        <linearGradient id="dieg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f3e6cc" />
          <stop offset="1" stop-color="#b9a07a" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="16" fill="url(#dieg)" stroke="#5a3a1c" stroke-width="3" />
      {PIPS[shown].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill={shown === 6 && !rolling ? '#a3261b' : '#2a1a0e'} />)}
    </svg>
  );
}

export function RollDisplay({ roll, rolling, label }: { roll: Roll; rolling: boolean; label?: string }) {
  const color = roll.outcome === 'strong' ? 'var(--good)' : roll.outcome === 'weak' ? 'var(--ember-2)' : '#ff6a55';
  const text = roll.crit ? 'CRITICAL!' : roll.outcome === 'strong' ? 'STRONG HIT' : roll.outcome === 'weak' ? 'WEAK HIT' : 'MISS';
  return (
    <div class="col" style={{ alignItems: 'center', gap: 10 }}>
      {label && <div class="label">{label}</div>}
      <div class="row" style={{ gap: 16 }}>
        <Die value={roll.dice[0]} rolling={rolling} />
        <Die value={roll.dice[1]} rolling={rolling} delay={0.05} />
        <div class="num" style={{ fontSize: 40, color: 'var(--ink-2)', minWidth: 70 }}>{fmtMod(roll.mod)}</div>
        {!rolling && <div class="num" style={{ fontSize: 56, color }}>= {roll.total}</div>}
      </div>
      {!rolling && <div class="display" style={{ fontSize: 30, color, letterSpacing: '0.18em', animation: 'rise 0.3s both' }}>{text}</div>}
    </div>
  );
}

// ------------------------------------------------------------------------------ misc

export function Toasts({ toasts }: { toasts: { id: number; text: string; kind: string }[] }) {
  return (
    <div class="toasts">
      {toasts.map((t) => <div key={t.id} class={`toast ${t.kind}`}>{t.text}</div>)}
    </div>
  );
}

export function Typewriter({ text, speed = 18, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const t = setInterval(() => setN((x) => {
      if (x >= text.length) { clearInterval(t); onDone?.(); return x; }
      return x + 2;
    }), speed);
    return () => clearInterval(t);
  }, [text]);
  return <span onClick={() => setN(text.length)}>{text.slice(0, n)}<span style={{ opacity: n < text.length ? 1 : 0, animation: 'pulse 0.8s infinite' }}>▍</span></span>;
}

export function Frame({ title, onClose, children, width = 1400, height = 860, right }: { title: ComponentChildren; onClose?: () => void; children: ComponentChildren; width?: number; height?: number; right?: ComponentChildren }) {
  return (
    <div class="modal-back" onClick={(e) => { if (e.target === e.currentTarget && onClose) { audio.sfx('ui_close'); onClose(); } }}>
      <div class="panel rise" style={{ width, height, display: 'flex', flexDirection: 'column' }}>
        <div class="panel-head">
          <div class="h2 grow">{title}</div>
          {right}
          {onClose && <Btn variant="ghost" size="sm" sfx={false} onClick={() => { audio.sfx('ui_close'); onClose(); }}>Close ✕</Btn>}
        </div>
        <div class="grow" style={{ minHeight: 0, position: 'relative' }}>{children}</div>
      </div>
    </div>
  );
}
