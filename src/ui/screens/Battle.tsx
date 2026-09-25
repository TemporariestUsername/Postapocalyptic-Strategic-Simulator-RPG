import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { audio } from '../../engine/audio';
import { img } from '../../engine/assets';
import { chanceAtLeast, fmtMod, STAT_INFO } from '../../engine/dice';
import { ITEMS } from '../../data/items';
import { ABILITIES } from '../../data/playbooks';
import { ENEMIES } from '../../data/enemies';
import {
  abilityReady, attackPreview, canAttack, doAttack, doMove, flee, itemTargets, useAbility, useItem, validAbilityTargets, weaponOf, weaponRange,
} from '../../combat/battle';
import { cheb, pathTo, reachable, unitAt } from '../../combat/grid';
import { BattleRenderer } from '../../combat/render';
import { endPlayerTurn } from '../../combat/turn';
import type { Unit } from '../../combat/types';
import { applyBattle } from '../../game/outcome';
import { Btn, HpBar, Token, useTip } from '../components/common';
import { Hint } from '../components/Hint';
import { itemLine } from '../itemInfo';
import { G, emit, finishBattle, game, useStore } from '../store';

type Mode = { kind: 'none' } | { kind: 'ability'; id: string } | { kind: 'item'; id: string };

export function BattleScreen() {
  const { ui } = useStore();
  const bv = ui.battle!;
  const b = bv.battle;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const R = useMemo(() => new BattleRenderer(b), [b]);
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'none' });
  const [hover, setHover] = useState<{ unit?: string; tile?: [number, number]; px: number; py: number } | null>(null);
  const [busy, setBusy] = useState(true);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    R.attach(canvasRef.current!);
    R.onIdle = () => { setBusy(false); force((n) => n + 1); };
    return () => R.detach();
  }, [R]);

  const selUnit = sel ? b.units.find((u) => u.id === sel && !u.dead && !u.downed) : undefined;
  const myTurn = b.phase === 'player' && !b.result;
  const canControl = (u?: Unit) => !!u && u.controlled && u.team === 0 && !u.dead && !u.downed;

  // auto-select first ready unit
  useEffect(() => {
    if (busy || !myTurn) return;
    if (!selUnit || (selUnit.acted && selUnit.moved)) {
      const next = b.units.find((u) => canControl(u) && (!u.acted || !u.moved));
      if (next && next.id !== sel) setSel(next.id);
    }
  }, [busy, b.turn, myTurn]);

  // highlights
  useEffect(() => {
    R.moveTiles.clear();
    R.targetUnits.clear();
    R.targetTiles.clear();
    R.aoeRadius = 0;
    R.selected = selUnit?.id ?? null;
    if (busy || !myTurn || !selUnit) return;
    if (mode.kind === 'none') {
      if (!selUnit.moved && !selUnit.status.pinned) for (const k of reachable(b, selUnit, selUnit.move).keys()) if (k !== `${selUnit.x},${selUnit.y}`) R.moveTiles.add(k);
      if (!selUnit.acted) for (const e of b.units) if (!e.dead && !e.downed && e.team !== selUnit.team && canAttack(b, selUnit, e)) R.targetUnits.add(e.id);
    } else if (mode.kind === 'ability') {
      const t = validAbilityTargets(b, selUnit, mode.id);
      for (const u of t.units) R.targetUnits.add(u.id);
      for (const [x, y] of t.tiles) R.targetTiles.add(`${x},${y}`);
      R.aoeRadius = ABILITIES[mode.id].radius ?? 0;
      if (ABILITIES[mode.id].target === 'tile' && mode.id === 'turret') R.aoeRadius = 0;
    } else if (mode.kind === 'item') {
      const t = itemTargets(b, selUnit, mode.id);
      for (const u of t.units) R.targetUnits.add(u.id);
      for (const [x, y] of t.tiles) R.targetTiles.add(`${x},${y}`);
      R.aoeRadius = ITEMS[mode.id].use?.radius ?? 0;
    }
  });

  const act = (fn: () => void) => {
    fn();
    setBusy(true);
    setMode({ kind: 'none' });
    setItemsOpen(false);
    R.pathPreview = [];
    emit();
  };

  const stagePt = (e: MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 1920, ((e.clientY - r.top) / r.height) * 1080];
  };

  const onMove = (e: MouseEvent) => {
    const [px, py] = stagePt(e);
    const t = R.tileAt(px, py);
    R.hoverTile = t;
    const u = t ? unitAt(b, t[0], t[1]) : undefined;
    R.hoverUnit = u?.id ?? null;
    R.pathPreview = [];
    if (t && selUnit && mode.kind === 'none' && R.moveTiles.has(`${t[0]},${t[1]}`)) {
      R.pathPreview = pathTo(reachable(b, selUnit, selUnit.move), t[0], t[1]);
    }
    setHover(t ? { unit: u?.id, tile: t, px, py } : null);
  };

  const onClick = (e: MouseEvent) => {
    if (busy || !myTurn) return;
    const [px, py] = stagePt(e);
    const t = R.tileAt(px, py);
    if (!t) return;
    const u = unitAt(b, t[0], t[1]) ?? b.units.find((x) => x.downed && !x.dead && x.x === t[0] && x.y === t[1]);
    if (mode.kind !== 'none' && selUnit) {
      const key = `${t[0]},${t[1]}`;
      if (u && R.targetUnits.has(u.id)) {
        if (mode.kind === 'ability') act(() => useAbility(b, selUnit, mode.id, { unit: u, x: u.x, y: u.y }));
        else act(() => useItem(b, selUnit, mode.id, { unit: u, x: u.x, y: u.y }, bv.items));
        return;
      }
      if (R.targetTiles.has(key)) {
        if (mode.kind === 'ability') act(() => useAbility(b, selUnit, mode.id, { x: t[0], y: t[1] }));
        else act(() => useItem(b, selUnit, mode.id, { x: t[0], y: t[1] }, bv.items));
        return;
      }
      audio.sfx('ui_error', { vol: 0.5 });
      return;
    }
    if (u && canControl(u)) {
      setSel(u.id);
      audio.sfx('ui_click');
      return;
    }
    if (selUnit && u && R.targetUnits.has(u.id)) {
      act(() => doAttack(b, selUnit, u));
      return;
    }
    if (selUnit && R.moveTiles.has(`${t[0]},${t[1]}`)) {
      act(() => doMove(b, selUnit, t[0], t[1]));
      return;
    }
  };

  const cancel = (e?: MouseEvent) => {
    e?.preventDefault();
    if (mode.kind !== 'none') setMode({ kind: 'none' });
    else setItemsOpen(false);
  };

  const endTurn = () => {
    if (busy || !myTurn) return;
    audio.sfx('ui_confirm');
    act(() => endPlayerTurn(b));
  };

  const cycle = () => {
    const ready = b.units.filter((u) => canControl(u) && (!u.acted || !u.moved));
    if (!ready.length) return;
    const i = ready.findIndex((u) => u.id === sel);
    setSel(ready[(i + 1) % ready.length].id);
    setMode({ kind: 'none' });
  };

  const abilities = selUnit ? selUnit.abilities : [];
  const consumables = Object.entries(bv.items).filter(([k, v]) => v > 0 && ITEMS[k].kind === 'consumable');

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (G.ui.scene || G.ui.panel) return;
      if (e.key === ' ') { e.preventDefault(); endTurn(); }
      else if (e.key === 'Tab') { e.preventDefault(); cycle(); }
      else if (e.key === 'Escape') cancel();
      else if (/^[1-9]$/.test(e.key) && selUnit && !selUnit.acted && !busy) {
        const id = abilities[Number(e.key) - 1];
        if (id && abilityReady(selUnit, id)) startAbility(id);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const startAbility = (id: string) => {
    if (!selUnit || selUnit.acted) return;
    const a = ABILITIES[id];
    audio.sfx('ui_click');
    if (a.target === 'self') act(() => useAbility(b, selUnit, id, {}));
    else setMode({ kind: 'ability', id });
  };

  // automation hook used by the Playwright playtest script
  (window as unknown as Record<string, unknown>).__battleDebug = () => ({
    result: b.result, busy, phase: b.phase,
    mine: b.units.filter((u) => canControl(u) && (!u.acted || !u.moved)).map((u) => ({ id: u.id, x: u.x, y: u.y })),
    targets: b.units.filter((u) => R.targetUnits.has(u.id)).map((u) => ({ id: u.id, x: u.x, y: u.y })),
    moves: [...R.moveTiles].map((k) => k.split(',').map(Number)),
  });

  const hoverUnit = hover?.unit ? b.units.find((u) => u.id === hover.unit) : undefined;
  const allDone = myTurn && !busy && b.units.filter((u) => canControl(u)).every((u) => u.acted && (u.moved || u.status.pinned));
  const showResult = !!b.result && !busy;

  return (
    <div class="screen" style={{ background: '#000' }}>
      <canvas ref={canvasRef} class="battle-canvas" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: mode.kind !== 'none' ? 'crosshair' : 'default' }}
        onMouseMove={onMove} onClick={onClick} onContextMenu={cancel} onMouseLeave={() => { R.hoverTile = null; setHover(null); }} />
      {/* top bar */}
      <div class="battle-top">
        <div class="row" style={{ gap: 8 }}>
          {b.units.filter((u) => u.team === 0 && !u.summon).map((u) => <Token key={u.id} src={u.portrait} size={46} color={u.controlled ? 'var(--ember-2)' : '#6fd6c8'} dead={u.dead || u.downed} style={{ opacity: u.acted && u.moved ? 0.55 : 1, cursor: 'pointer' }} />)}
        </div>
        <div class="col" style={{ alignItems: 'center', gap: 0 }}>
          <div class="display" style={{ fontSize: 30 }}>{b.context.title}</div>
          <div class="label" style={{ color: myTurn ? 'var(--ember-2)' : '#ff7a6a' }}>Round {b.turn} · {myTurn ? 'Your move' : 'Enemy moving…'}</div>
        </div>
        <div class="row" style={{ gap: 8 }}>
          {b.units.filter((u) => u.team === 1).map((u) => <Token key={u.id} src={u.portrait} size={46} color="#e8493a" dead={u.dead} />)}
          {b.context.canFlee && !b.result && <Btn size="sm" variant="ghost" disabled={busy || !myTurn} onClick={() => act(() => flee(b))} tip="Retreat from the battle. No rewards.">Flee</Btn>}
        </div>
      </div>
      {/* hover preview */}
      {hover && hoverUnit && !busy && <HoverCard u={hoverUnit} sel={selUnit} mode={mode} px={hover.px} py={hover.py} />}
      {/* bottom HUD */}
      <div class="battle-bottom">
        <div class="row" style={{ gap: 14, width: 470 }}>
          {selUnit ? <UnitCard u={selUnit} /> : <div class="dim small">Select a fighter.</div>}
        </div>
        <div class="row grow" style={{ gap: 10, justifyContent: 'center', position: 'relative' }}>
          {selUnit && myTurn && (
            <>
              <ActionBtn icon={selUnit.gang ? 'abilities/melee' : weaponRange(selUnit) > 2 ? 'abilities/shoot' : 'abilities/melee'} label={selUnit.gang ? 'Clash' : 'Attack'}
                desc={selUnit.gang ? 'Click an enemy gang in range to attack.' : `${ITEMS[selUnit.weapon]?.name}: ${itemLine(ITEMS[selUnit.weapon] ?? ITEMS.fists)}. Click a highlighted enemy.`}
                on={mode.kind === 'none' && !selUnit.acted} disabled={selUnit.acted || busy} onClick={() => setMode({ kind: 'none' })} hot="LMB" />
              {abilities.map((id, i) => {
                const a = ABILITIES[id];
                const cd = selUnit.cooldowns[id] ?? 0;
                const used = selUnit.used?.[id];
                return (
                  <ActionBtn key={id} icon={`abilities/${a.icon}`} label={a.name} desc={a.desc + (a.stat ? ` (rolls ${STAT_INFO[a.stat].label} ${fmtMod(selUnit.stats[a.stat])})` : '')}
                    cd={used ? 'used' : cd > 0 ? String(cd) : undefined} on={mode.kind === 'ability' && mode.id === id}
                    disabled={selUnit.acted || busy || !abilityReady(selUnit, id)} onClick={() => startAbility(id)} hot={String(i + 1)} psy={a.weird} />
                );
              })}
              {!selUnit.gang && (
                <ActionBtn icon="items/medkit" label="Items" desc={consumables.length ? 'Use a consumable from your stash.' : 'No consumables.'} on={itemsOpen || mode.kind === 'item'}
                  disabled={selUnit.acted || busy || !consumables.length} onClick={() => setItemsOpen(!itemsOpen)} />
              )}
              {itemsOpen && (
                <div class="panel" style={{ position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)', padding: 12, display: 'flex', gap: 8, zIndex: 20 }}>
                  {consumables.map(([id, n]) => (
                    <div key={id} class="item-pick" onClick={() => { setMode({ kind: 'item', id }); setItemsOpen(false); audio.sfx('ui_click'); }}>
                      <img src={img(`items/${ITEMS[id].icon}`)} />
                      <div class="tiny">{ITEMS[id].name}</div>
                      <div class="tiny ember num">×{n}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {mode.kind !== 'none' && <div class="chip ember" style={{ position: 'absolute', top: -46 }}>{mode.kind === 'ability' ? ABILITIES[mode.id].name : ITEMS[mode.id].name}: choose a target · right-click to cancel</div>}
        </div>
        <div class="col" style={{ width: 470, gap: 8, alignItems: 'flex-end' }}>
          <div class="battle-log scroll">
            {b.log.slice(-6).map((l, i) => <div key={b.log.length - 6 + i}>{l}</div>)}
          </div>
          <div class="row" style={{ gap: 8 }}>
            <Btn size="sm" variant="ghost" disabled={busy || !myTurn} onClick={cycle} tip="Next ready fighter (Tab)">Next</Btn>
            <Btn variant="primary" disabled={busy || !myTurn} onClick={endTurn} style={allDone ? { animation: 'glowPulse 1s infinite' } : undefined}>End Turn <span class="kbd" style={{ marginLeft: 6 }}>Space</span></Btn>
          </div>
        </div>
      </div>
      {!showResult && <Hint id={b.mode === 'army' ? 'army' : 'battle'} />}
      {showResult && <ResultOverlay />}
    </div>
  );
}

function ActionBtn({ icon, label, desc, on, disabled, onClick, cd, hot, psy }: { icon: string; label: string; desc: string; on?: boolean; disabled?: boolean; onClick: () => void; cd?: string; hot?: string; psy?: boolean }) {
  const tip = useTip(<><b>{label}</b>{psy && <span class="psy"> · Maelstrom</span>}<br />{desc}</>);
  return (
    <div class={`action-btn ${on ? 'on' : ''} ${disabled ? 'off' : ''} ${psy ? 'psy' : ''}`} {...tip} onClick={() => !disabled && onClick()}>
      <img src={img(icon)} />
      {cd && <div class="cd">{cd === 'used' ? '✕' : cd}</div>}
      {hot && <div class="hot">{hot}</div>}
      <div class="lbl">{label}</div>
    </div>
  );
}

function UnitCard({ u }: { u: Unit }) {
  const w = weaponOf(u);
  return (
    <>
      <Token src={u.portrait} size={96} color={u.team === 0 ? 'var(--ember-2)' : '#e8493a'} />
      <div class="col" style={{ gap: 4, flex: 1 }}>
        <div class="display" style={{ fontSize: 24 }}>{u.name}</div>
        {u.gang ? (
          <>
            <div class="small dim">{u.leaderName ? `Led by ${u.leaderName}` : 'Captain'} · {u.ranged ? 'Shooters' : 'Brawlers'}</div>
            <div class="small"><b class="num ember">{u.troops}</b> / {u.maxTroops} fighters · breaks at {Math.ceil((u.maxTroops ?? 0) * 0.25)}</div>
          </>
        ) : (
          <>
            <HpBar hp={u.hp} max={u.maxHp} width={300} height={12} />
            <div class="tiny dim ui" style={{ letterSpacing: '0.06em' }}>HARM {u.hp}/{u.maxHp} · ARMOR {u.armor} · MOVE {u.move} · {ITEMS[u.weapon]?.name ?? 'Fists'} ({w.harm} harm{w.range > 1 ? `, rng ${w.range}` : ''})</div>
          </>
        )}
        <div class="row" style={{ gap: 6 }}>
          <span class={`chip ${u.moved ? '' : 'good'}`} style={{ fontSize: 13 }}>{u.moved ? 'Moved' : 'Can move'}</span>
          <span class={`chip ${u.acted ? '' : 'ember'}`} style={{ fontSize: 13 }}>{u.acted ? 'Acted' : 'Can act'}</span>
        </div>
      </div>
    </>
  );
}

function HoverCard({ u, sel, mode, px, py }: { u: Unit; sel?: Unit; mode: Mode; px: number; py: number }) {
  const b = G.ui.battle!.battle;
  const enemy = u.enemyId ? ENEMIES[u.enemyId] : null;
  const left = px > 1400 ? px - 400 : px + 30;
  const top = Math.min(700, Math.max(90, py - 60));
  let preview = null;
  if (sel && !sel.acted && u.team !== sel.team && !u.dead) {
    const inRange = canAttack(b, sel, u);
    if (mode.kind === 'none' && inRange) {
      const pv = attackPreview(b, sel, u);
      preview = (
        <>
          <div class="divider" style={{ margin: '8px 0' }} />
          <div class="row" style={{ gap: 8 }}>
            <span class="chip good">{Math.round(pv.pHit * 100)}% hit</span>
            <span class="chip ember">{Math.round(pv.pStrong * 100)}% strong</span>
          </div>
          <div class="small" style={{ marginTop: 6 }}>{sel.gang ? `Casualties ${pv.dmgWeak}–${pv.dmgStrong}` : `Harm ${pv.dmgWeak} / ${pv.dmgStrong} on a strong hit`}{weaponOf(sel).tags.includes('burst') && !sel.gang ? ' · ×2 shots' : ''}</div>
          <div class="tiny dim">{pv.mods.map(([l, v]) => `${l} ${fmtMod(v)}`).join(' · ')}</div>
        </>
      );
    } else if (mode.kind === 'ability') {
      const a = ABILITIES[mode.id];
      if (a.stat) {
        const m = sel.stats[a.stat];
        preview = <><div class="divider" style={{ margin: '8px 0' }} /><div class="small">{a.name}: roll {STAT_INFO[a.stat].label} {fmtMod(m)} · {Math.round(chanceAtLeast(m, 7) * 100)}% hit</div></>;
      }
    } else if (!inRange && mode.kind === 'none') {
      preview = <div class="tiny dim" style={{ marginTop: 6 }}>{cheb(sel.x, sel.y, u.x, u.y) > weaponRange(sel) ? 'Out of range.' : 'No line of sight.'}</div>;
    }
  }
  return (
    <div class="tip" style={{ left, top, minWidth: 300 }}>
      <div class="row" style={{ gap: 10 }}>
        <b style={{ fontSize: 20 }}>{u.name}</b>
        {u.boss && <span class="chip bad">Boss</span>}
      </div>
      {u.gang ? <div class="small">{u.troops}/{u.maxTroops} fighters{u.ranged ? ' · shooters' : ''}</div>
        : <div class="small">Harm {u.hp}/{u.maxHp} · Armor {u.armor} · {ITEMS[u.weapon]?.name ?? 'Claws & teeth'}</div>}
      {enemy && <div class="tiny dim">{enemy.desc}</div>}
      {u.downed && <div class="small bad">Downed — bleeding out in {u.bleedout} turns</div>}
      {preview}
    </div>
  );
}

function ResultOverlay() {
  const bv = G.ui.battle!;
  const b = bv.battle;
  const s = game();
  if (!bv.summary) bv.summary = applyBattle(s, b, bv.items);
  const sum = bv.summary;
  useEffect(() => {
    audio.sfx(sum.result === 'win' ? 'levelup' : 'ui_error');
  }, []);
  const title = sum.result === 'win' ? 'Victory' : b.context.type === 'tutorial' ? 'Close Call' : sum.result === 'fled' ? 'Retreat' : 'Defeat';
  return (
    <div class="modal-back" style={{ zIndex: 200 }}>
      <div class="panel rise" style={{ width: 900, padding: '34px 44px', textAlign: 'center' }}>
        <div class="h1" style={{ fontSize: 86, color: sum.result === 'win' ? 'var(--ember-2)' : '#ff6a55', textShadow: `0 0 40px ${sum.result === 'win' ? 'rgba(255,140,60,0.6)' : 'rgba(255,60,40,0.5)'}` }}>{title}</div>
        <div class="label" style={{ marginTop: 6 }}>{b.context.title} · {b.turn} rounds</div>
        <div class="divider" />
        {sum.xp > 0 && <div class="h3 good">+{sum.xp} XP to every survivor</div>}
        {sum.levelUps.length > 0 && <div class="h3 ember" style={{ marginTop: 6 }}>Level up: {sum.levelUps.join(', ')}!</div>}
        {sum.deaths.length > 0 && <div class="h3 bad" style={{ marginTop: 6 }}>Fallen: {sum.deaths.join(', ')}</div>}
        <div class="row wrap" style={{ gap: 8, justifyContent: 'center', margin: '16px 0' }}>
          {sum.lines.map((l, i) => <span key={i} class="chip">{l}</span>)}
        </div>
        <Btn variant="primary" size="lg" onClick={finishBattle}>Continue</Btn>
      </div>
    </div>
  );
}
