import { useState } from 'preact/hooks';
import { img, token } from '../../engine/assets';
import { FACTIONS, PLAYER_FACTION_ID } from '../../data/factions';
import { ADJACENCY, MAP_H, MAP_W, NEIGHBORS, REGIONS, REGION_BY_ID } from '../../data/regions';
import { findPath, pathDays, rationsPerDay } from '../../game/actions';
import { DELVES } from '../../game/delve';
import { activeJobs, jobScene } from '../../game/jobs';
import { atWar } from '../../game/sim';
import { attackTargets, availableGarrison, canCommand, garrisonTransfer, kilnAssaultPlan, muster, orderAttack, seizePlan } from '../../game/war';
import type { GameState } from '../../game/types';
import { factionColor, factionName, fmtDate, playerSide, regionName } from '../../game/util';
import { Btn, useTip } from '../components/common';
import { CrewStrip, Hud } from '../components/Hud';
import { Hint } from '../components/Hint';
import { regionPaths } from '../mapgeo';
import {
  G, emit, enterDelve, setArriveHandler, enterSettlement, game, openScene, regionHasSettlement, rest, resumeTravel, select, startArmy, stopTravel, toast, travelTo, useStore,
} from '../store';

const KIND_LABEL = { capital: 'Capital', hold: 'Hold', outpost: 'Outpost', ruins: 'Ruins' } as const;

function playerPos(s: GameState): [number, number] {
  const here = REGION_BY_ID[s.location];
  if (!s.travel || !s.travel.path.length) return [here.x, here.y];
  const to = REGION_BY_ID[s.travel.path[0]];
  const t = Math.min(1, s.travel.dayInLeg / Math.max(1, s.travel.legDays));
  return [here.x + (to.x - here.x) * t, here.y + (to.y - here.y) * t];
}

const BASE = 0.62; // map scale at zoom 1: the whole basin fits between the HUD and the bottom bar
const view = { tx: (1920 - MAP_W * BASE) / 2, ty: 84, k: 1 };
/** Markers keep a constant on-screen size regardless of zoom. */
const markerScale = () => 0.7 / (BASE * view.k);

function clampView() {
  const S = BASE * view.k;
  const w = MAP_W * S, h = MAP_H * S;
  view.tx = Math.min(560, Math.max(1920 - w - 620, view.tx));
  view.ty = Math.min(220, Math.max(1080 - h - 300, view.ty));
}

/** Pan so a map point sits comfortably left of the region panel and above the bottom bar. */
export function focusRegion(id: string) {
  const r = REGION_BY_ID[id];
  const S = BASE * view.k;
  const sx = view.tx + r.x * S, sy = view.ty + r.y * S;
  if (sx > 1300) view.tx -= sx - 1080;
  if (sx < 160) view.tx += 300 - sx;
  if (sy > 820) view.ty -= sy - 660;
  if (sy < 170) view.ty += 260 - sy;
  clampView();
}

setArriveHandler((id) => focusRegion(id));

export function WorldScreen() {
  const { game: s, ui } = useStore();
  const [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  if (!s) return null;
  const paths = regionPaths();
  const sel = ui.selected;
  const previewPath = sel && sel !== s.location && !s.travel ? findPath(s, s.location, sel) : null;
  const travelLine = s.travel ? [s.location, ...s.travel.path] : previewPath ? [s.location, ...previewPath] : null;
  const [px, py] = playerPos(s);
  const scaleNow = () => (document.getElementById('stage')?.getBoundingClientRect().width ?? 1920) / 1920;
  const onDown = (e: MouseEvent) => setDrag({ x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false });
  const onMove = (e: MouseEvent) => {
    if (!drag) return;
    const k = scaleNow();
    const dx = (e.clientX - drag.x) / k, dy = (e.clientY - drag.y) / k;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    view.tx = drag.tx + dx;
    view.ty = drag.ty + dy;
    clampView();
    emit();
  };
  const onUp = () => setTimeout(() => setDrag(null), 0);
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const stage = document.getElementById('stage')!.getBoundingClientRect();
    const k = scaleNow();
    const mx = (e.clientX - stage.left) / k, my = (e.clientY - stage.top) / k;
    const old = view.k;
    view.k = Math.min(2.2, Math.max(1, view.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    const f = view.k / old;
    view.tx = mx - (mx - view.tx) * f;
    view.ty = my - (my - view.ty) * f;
    clampView();
    emit();
  };
  const pick = (id: string) => {
    if (drag?.moved) return;
    select(id);
    focusRegion(id);
    emit();
  };
  const S = BASE * view.k;

  return (
    <div class="screen" style={{ background: 'radial-gradient(ellipse at center, #1a120c, #070504)' }}>
      <svg viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: drag?.moved ? 'grabbing' : 'grab' }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onWheel={onWheel}>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.8" /></filter>
          <clipPath id="tokenClip"><circle r="44" /></clipPath>
          <clipPath id="leaderClip"><circle r="30" /></clipPath>
        </defs>
        <g style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${S})`, transition: drag ? 'none' : 'transform 0.5s cubic-bezier(.2,.8,.2,1)' }}>
        <image href={img('key/map')} x="0" y="0" width={MAP_W} height={MAP_H} preserveAspectRatio="none" />
        <rect width={MAP_W} height={MAP_H} fill="rgba(10,6,3,0.18)" />
        {/* faction tint */}
        <g style={{ mixBlendMode: 'color' }}>
          {REGIONS.map((r) => <path key={r.id} d={paths[r.id]} fill={factionColor(s, s.regions[r.id].owner)} fill-opacity={0.38} />)}
        </g>
        <g>
          {REGIONS.map((r) => (
            <path key={r.id} d={paths[r.id]} fill={hover === r.id ? 'rgba(255,230,190,0.12)' : sel === r.id ? 'rgba(255,160,80,0.10)' : 'rgba(0,0,0,0)'}
              stroke="rgba(0,0,0,0.55)" stroke-width="7" stroke-linejoin="round"
              style={{ cursor: 'pointer', transition: 'fill 0.2s' }}
              onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} onClick={() => pick(r.id)} />
          ))}
          {REGIONS.map((r) => (
            <path key={r.id + 'b'} d={paths[r.id]} fill="none" stroke={factionColor(s, s.regions[r.id].owner)} stroke-opacity={0.75} stroke-width="3" stroke-dasharray="14 6" pointer-events="none" />
          ))}
          {sel && <path d={paths[sel]} fill="none" stroke="#ffb35c" stroke-width="6" filter="url(#glow)" pointer-events="none" style={{ animation: 'pulse 1.6s infinite' }} />}
        </g>
        {/* roads */}
        <g pointer-events="none">
          {ADJACENCY.map(([a, b]) => {
            const A = REGION_BY_ID[a], B = REGION_BY_ID[b];
            return <line key={a + b} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="rgba(255,235,200,0.28)" stroke-width="3" stroke-dasharray="4 14" stroke-linecap="round" />;
          })}
        </g>
        {/* travel path */}
        {travelLine && travelLine.length > 1 && (
          <g pointer-events="none">
            <polyline points={travelLine.map((id) => `${REGION_BY_ID[id].x},${REGION_BY_ID[id].y}`).join(' ')} fill="none" stroke="rgba(0,0,0,0.6)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
            <polyline points={travelLine.map((id) => `${REGION_BY_ID[id].x},${REGION_BY_ID[id].y}`).join(' ')} fill="none" stroke="#ffb35c" stroke-width="6" stroke-dasharray="18 14" stroke-linecap="round" stroke-linejoin="round" style={{ animation: 'dash 1s linear infinite' }} />
          </g>
        )}
        {/* armies */}
        {s.armies.map((a) => {
          const A = REGION_BY_ID[a.from], B = REGION_BY_ID[a.to];
          const t = 1 - a.daysLeft / Math.max(1, a.totalDays);
          const x = A.x + (B.x - A.x) * t, y = A.y + (B.y - A.y) * t;
          const col = factionColor(s, a.faction);
          const ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI;
          return (
            <g key={a.id} filter="url(#shadow)">
              <line x1={x} y1={y} x2={B.x} y2={B.y} stroke={col} stroke-width="5" stroke-dasharray="10 10" stroke-opacity="0.8" />
              <g transform={`translate(${B.x},${B.y}) rotate(${ang})`}><path d="M-44,-18 L-18,0 L-44,18 Z" fill={col} stroke="#000" stroke-width="3" /></g>
              <g transform={`translate(${x},${y}) scale(${markerScale()})`}>
                <circle r="34" fill="#140e0a" stroke={col} stroke-width="6" />
                <image href={img('abilities/charge')} x="-24" y="-24" width="48" height="48" />
                <rect x="-38" y="30" width="76" height="30" rx="4" fill="#000" stroke={col} stroke-width="2" />
                <text y="52" text-anchor="middle" fill="#fff" font-family="Barlow Condensed" font-weight="700" font-size="24">{a.troops}</text>
              </g>
            </g>
          );
        })}
        {/* region markers */}
        {REGIONS.map((r) => <RegionMarker key={r.id} s={s} id={r.id} hovered={hover === r.id} selected={sel === r.id} onHover={setHover} onPick={pick} />)}
        {/* player */}
        <g style={{ transform: `translate(${px}px, ${py - 70 * markerScale()}px) scale(${markerScale()})`, transition: ui.traveling ? 'transform 0.26s linear' : 'transform 0.4s ease-out' }} filter="url(#shadow)" pointer-events="none">
          <circle r="54" fill="none" stroke="#ff7a2f" stroke-width="4" style={{ animation: 'pulse 1.4s infinite' }} filter="url(#glow)" />
          <circle r="47" fill="#000" stroke="#ffb35c" stroke-width="5" />
          <image href={token(s.crew[0].portrait)} x="-44" y="-44" width="88" height="88" clip-path="url(#tokenClip)" />
          <path d="M-14,50 L0,70 L14,50 Z" fill="#ffb35c" />
        </g>
        </g>
      </svg>
      <Hud />
      {sel && <RegionPanel />}
      <NewsTicker />
      <CrewStrip />
      {!ui.scene && <Hint id="world" />}
      {(ui.traveling || s.travel) && <TravelBar />}
      {ui.resting > 0 && <div class="panel" style={{ position: 'absolute', left: '50%', top: 110, transform: 'translateX(-50%)', padding: '12px 30px', zIndex: 45 }}><span class="display">Resting… {ui.resting} days left</span></div>}
    </div>
  );
}

function RegionMarker({ s, id, hovered, selected, onHover, onPick }: { s: GameState; id: string; hovered: boolean; selected: boolean; onHover: (id: string | null) => void; onPick: (id: string) => void }) {
  const r = REGION_BY_ID[id];
  const st = s.regions[id];
  const col = factionColor(s, st.owner);
  const icon = r.kind === 'capital' ? 'abilities/rally' : r.kind === 'ruins' ? (st.delveCleared ? 'abilities/defend' : 'abilities/mindlash') : r.kind === 'outpost' ? 'abilities/overwatch' : 'abilities/defend';
  const threatened = s.armies.some((a) => a.to === id);
  const job = activeJobs(s).some((j) => j.target === id);
  const scale = (hovered || selected ? 1.12 : 1) * markerScale();
  const isCap = r.kind === 'capital';
  const lead = isCap && st.owner !== 'free' && st.owner !== PLAYER_FACTION_ID && FACTIONS[st.owner]?.capital === id;
  return (
    <g transform={`translate(${r.x},${r.y}) scale(${scale})`} style={{ cursor: 'pointer', transition: 'transform 0.15s' }}
      onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)} onClick={() => onPick(id)} filter="url(#shadow)">
      {threatened && <circle r="58" fill="none" stroke="#ff4a3a" stroke-width="5" stroke-dasharray="8 8" style={{ animation: 'spin 6s linear infinite' }} />}
      {lead ? (
        <>
          <circle r="40" fill="#0d0907" stroke={col} stroke-width="7" />
          <image href={token(FACTIONS[st.owner].portrait)} x="-30" y="-30" width="60" height="60" clip-path="url(#leaderClip)" />
        </>
      ) : (
        <>
          <circle r={isCap ? 38 : 30} fill="#0d0907" stroke={col} stroke-width="6" />
          <image href={img(icon)} x={isCap ? -26 : -21} y={isCap ? -26 : -21} width={isCap ? 52 : 42} height={isCap ? 52 : 42} style={{ opacity: 0.95 }} />
        </>
      )}
      {job && <g transform="translate(30,-30)"><circle r="14" fill="#ffb35c" stroke="#000" stroke-width="3" /><text y="7" text-anchor="middle" font-size="22" font-weight="700" fill="#000">!</text></g>}
      <g transform={`translate(0, ${isCap ? 66 : 56})`}>
        <rect x={-(r.name.length * 9.6 + 22)} y="-22" width={r.name.length * 19.2 + 44} height="38" rx="3" fill="rgba(8,5,3,0.85)" stroke={col} stroke-opacity="0.6" stroke-width="2" />
        <text y="6" text-anchor="middle" fill="#f1e3c8" font-family="Oswald" font-weight="600" font-size="24" letter-spacing="2">{r.name.toUpperCase()}</text>
      </g>
      <g transform={`translate(${isCap ? 44 : 36}, ${isCap ? -8 : -4})`}>
        <rect x="-4" y="-18" width={String(st.garrison).length * 14 + 14} height="30" rx="3" fill="rgba(0,0,0,0.85)" stroke={col} stroke-width="2" />
        <text x={String(st.garrison).length * 7 + 3} y="4" text-anchor="middle" fill="#fff" font-family="Barlow Condensed" font-weight="700" font-size="22">{st.garrison}</text>
      </g>
    </g>
  );
}

function NewsTicker() {
  const { game: s } = useStore();
  if (!s) return null;
  const items = s.news.slice(0, 3);
  const colorOf = (k: string) => ({ war: '#ff9a5c', capture: '#ffd27a', burn: '#ff5a44', death: '#ff5a44', fall: '#ff5a44', diplo: '#9ecbff', player: '#b8e08f', info: '#ccc' } as Record<string, string>)[k] ?? '#ccc';
  return (
    <div class="panel plain" style={{ position: 'absolute', right: 22, bottom: 20, width: 700, zIndex: 30, padding: '8px 16px', pointerEvents: 'none' }}>
      <div class="label" style={{ marginBottom: 4 }}>Word on the Road</div>
      {items.map((n, i) => (
        <div key={i} class="row small" style={{ gap: 10, opacity: 1 - i * 0.16, alignItems: 'flex-start', lineHeight: 1.3, marginTop: 3 }}>
          <span style={{ width: 8, height: 8, marginTop: 8, borderRadius: 4, background: colorOf(n.kind), flexShrink: 0, boxShadow: `0 0 8px ${colorOf(n.kind)}` }} />
          <span class="tiny faint num" style={{ width: 66, flexShrink: 0, marginTop: 2 }}>{fmtDate(n.day).split(',')[0]}</span>
          <span>{n.text}</span>
        </div>
      ))}
    </div>
  );
}

function TravelBar() {
  const { game: s, ui } = useStore();
  if (!s?.travel) return null;
  const dest = s.travel.path[s.travel.path.length - 1];
  const left = pathDays(s, s.travel.path) - s.travel.dayInLeg;
  const marching = !!s.flags.marching;
  return (
    <div class="panel" style={{ position: 'absolute', left: '50%', top: 100, transform: 'translateX(-50%)', padding: '14px 26px', zIndex: 45, display: 'flex', gap: 22, alignItems: 'center' }}>
      <img src={img(marching ? 'abilities/charge' : 'abilities/sprint')} style={{ width: 48, height: 48 }} />
      <div class="col" style={{ gap: 2 }}>
        <div class="display" style={{ fontSize: 24 }}>{marching ? 'Marching on' : 'Traveling to'} {regionName(dest)}</div>
        <div class="small dim">{left} day{left === 1 ? '' : 's'} remaining · eating {rationsPerDay(s)} rations/day</div>
      </div>
      {!marching && (ui.traveling ? <Btn size="sm" onClick={stopTravel}>Halt</Btn> : <Btn size="sm" variant="primary" onClick={resumeTravel}>Continue</Btn>)}
      {marching && !ui.traveling && <Btn size="sm" variant="primary" onClick={resumeTravel}>March</Btn>}
    </div>
  );
}

// ------------------------------------------------------------------------------------ region panel

function RegionPanel() {
  const { game: s, ui } = useStore();
  if (!s) return null;
  const id = ui.selected!;
  const r = REGION_BY_ID[id];
  const st = s.regions[id];
  const owner = st.owner;
  const col = factionColor(s, owner);
  const here = id === s.location && !s.travel;
  const path = !here ? findPath(s, s.location, id) : null;
  const days = path ? pathDays(s, path) : 0;
  const fdef = FACTIONS[owner];
  const incoming = s.armies.filter((a) => a.to === id);
  const jobsHere = activeJobs(s).filter((j) => j.target === id && j.kind !== 'delve');
  const delve = r.delve ? DELVES[r.delve] : null;
  const busy = !!s.travel || ui.traveling || ui.resting > 0;
  const side = playerSide(s);
  const rep = fdef ? s.factions[owner].rep : null;

  return (
    <div class="panel rise" key={id} style={{ position: 'absolute', right: 22, top: 96, width: 520, zIndex: 30, maxHeight: 760, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 150, overflow: 'hidden', flexShrink: 0 }}>
        <div class="bg-cover" style={{ backgroundImage: `url(${img(`towns/${r.town}`)})` }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 20%, rgba(14,10,8,0.97))' }} />
        <div style={{ position: 'absolute', left: 20, bottom: 12, right: 20 }}>
          <div class="row" style={{ gap: 8 }}>
            <span class="chip" style={{ borderColor: col, color: col }}>{KIND_LABEL[r.kind]}</span>
            {here && <span class="chip ember">You are here</span>}
            <span class="grow" />
            <span class="chip" style={{ cursor: 'pointer', pointerEvents: 'auto' }} onClick={() => select(null)}>✕</span>
            {incoming.length > 0 && <span class="chip bad">Under attack</span>}
          </div>
          <div class="h2" style={{ fontSize: 38, marginTop: 4 }}>{r.name}</div>
        </div>
      </div>
      <div class="scroll" style={{ padding: '14px 22px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div class="row" style={{ gap: 12 }}>
          {fdef ? <img src={token(fdef.portrait)} style={{ width: 52, height: 52, borderRadius: 26, border: `3px solid ${col}` }} /> : <div style={{ width: 16, height: 52, background: col }} />}
          <div class="col grow" style={{ gap: 0 }}>
            <div class="ui" style={{ fontSize: 22, fontWeight: 700, color: col }}>{factionName(s, owner)}</div>
            <div class="tiny dim">{fdef ? `${fdef.leader}, ${fdef.leaderTitle}` : owner === PLAYER_FACTION_ID ? 'Your own hold' : 'Nobody\'s — yet'}</div>
          </div>
          {rep !== null && <span class={`chip ${rep >= 15 ? 'good' : rep <= -20 ? 'bad' : ''}`}>Rep {rep > 0 ? '+' : ''}{rep}</span>}
        </div>
        <div class="type small dim" style={{ lineHeight: 1.45 }}>{r.desc}</div>
        <div class="row wrap" style={{ gap: 8 }}>
          <Stat label="Garrison" v={st.garrison} />
          <Stat label="Wealth" v={`${r.wealth}/mo`} />
          <Stat label="Walls" v={`×${r.fort}`} />
          <Stat label="Danger" v={r.danger >= 0.35 ? 'High' : r.danger >= 0.2 ? 'Med' : 'Low'} />
        </div>
        <div class="row wrap" style={{ gap: 6 }}>
          {r.market > 0 && <span class="chip">Market {'★'.repeat(r.market)}</span>}
          {r.bar && <span class="chip">Saloon</span>}
          {r.clinic && <span class="chip">Clinic</span>}
          {fdef?.capital === id && owner !== 'free' && <span class="chip ember">Warlord's Hall</span>}
          {delve && <span class={`chip ${st.delveCleared ? '' : 'psy'}`}>{st.delveCleared ? 'Ruins (cleared)' : delve.name}</span>}
          {id === 'emberroad' && <span class="chip psy">Radio Tower</span>}
        </div>
        {incoming.map((a) => <div key={a.id} class="small bad">⚔ {a.troops} {factionName(s, a.faction)} arrive in {a.daysLeft} days</div>)}
        <div class="divider" style={{ margin: '4px 0' }} />
        {!here && (
          <Btn variant="primary" block disabled={busy || !path || !!s.flags.marching} onClick={() => travelTo(id)}>
            Travel · {days} days
          </Btn>
        )}
        {!here && path && <div class="tiny dim" style={{ marginTop: -4 }}>Route: {path.map(regionName).join(' → ')} · needs ~{days * rationsPerDay(s)} rations (you have {s.rations})</div>}
        {here && (
          <div class="col" style={{ gap: 8 }}>
            {regionHasSettlement(id) && <Btn variant="primary" block disabled={busy} onClick={enterSettlement}>Enter {r.name}</Btn>}
            {jobsHere.map((j) => <Btn key={j.id} block disabled={busy} onClick={() => openScene(jobScene(s, j))}>Job: {j.title}</Btn>)}
            {delve && !st.delveCleared && delve.id !== 'kiln' && <Btn variant="psy" block disabled={busy} onClick={() => enterDelve(delve.id)} tip={delve.desc}>Explore {delve.name}</Btn>}
            <KilnActions />
            <WarActions />
            <div class="row" style={{ gap: 8 }}>
              <Btn size="sm" class="grow" disabled={busy} onClick={() => rest(3)} tip="Rest 3 days: heal, eat rations, let the world turn.">Rest 3d</Btn>
              <Btn size="sm" class="grow" disabled={busy} onClick={() => rest(7)} tip="Rest a week.">Rest 7d</Btn>
            </div>
          </div>
        )}
        {side && owner !== side && atWar(s, side, owner) && owner !== 'free' && <div class="tiny bad">At war with your side.</div>}
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string | number }) {
  return <div class="stat-pill" style={{ minWidth: 100, flex: 1 }}><b style={{ fontSize: 22 }}>{v}</b><span>{label}</span></div>;
}

function KilnActions() {
  const s = game();
  const nearKiln = s.location === 'kiln' || NEIGHBORS[s.location].includes('kiln');
  if (!nearKiln || !s.factions.cinder.leaderAlive || !s.quest.burnRevealed) return null;
  const plan = kilnAssaultPlan(s);
  const force = s.warband + plan.allied;
  const infTip = useTip(<><b>Infiltrate the Kiln</b><br />Use the keycard to slip through the service tunnels to the Burnt King's throne. The more Burnlads left in the Kiln, the harder the way in.</>);
  return (
    <div class="col" style={{ gap: 8, padding: 12, border: '1px solid rgba(255,90,60,0.5)', background: 'rgba(90,20,10,0.25)' }}>
      <div class="label" style={{ color: '#ff8a6a' }}>The Kiln · {s.regions.kiln.garrison} Burnlads inside</div>
      <div {...infTip}>
        <Btn variant="danger" block disabled={!s.quest.keycard} onClick={() => enterDelve('kiln')}>{s.quest.keycard ? 'Infiltrate the Kiln' : 'Infiltrate (needs Kiln keycard)'}</Btn>
      </div>
      <Btn variant="danger" block disabled={force < 30} tip={<><b>Storm the Kiln</b><br />Your warband ({s.warband}) plus coalition fighters ({plan.allied}) against {s.regions.kiln.garrison} defenders. Needs at least 30.</>}
        onClick={() => openScene({
          id: 'storm', title: 'Storm the Kiln', image: 'events/army',
          text: `${force} fighters stand ready beneath the smoking towers: your warband and ${plan.allied ? 'coalition war-bands' : 'no allies at all'}. Behind the walls wait ${s.regions.kiln.garrison} Burnlads and the Burnt King himself. There will be no retreat once the gates are breached — and the Burnt King himself waits inside. (A seasoned crew, level 5 or higher, is strongly advised.)`,
          choices: [
            { label: 'Sound the charge', resolve: () => ({ text: 'War horns echo off the cooling towers.', army: plan }) },
            { label: 'Not yet', resolve: () => ({ text: '' }) },
          ],
        })}>
        Storm the Kiln ({force} fighters)
      </Btn>
    </div>
  );
}

function WarActions() {
  const s = game();
  const here = s.location;
  const st = s.regions[here];
  const side = playerSide(s);
  const cmd = canCommand(s);
  const out: preact.JSX.Element[] = [];
  // seize the region you stand in (drifters found their own hold; warbosses take it for their warlord)
  const mayseize = here !== 'kiln' && st.owner !== side && (!s.pledged || cmd) && !(s.pledged && s.factions[st.owner]?.coalition && s.factions[s.pledged]?.coalition);
  if (mayseize) {
    const enough = s.warband >= 10;
    out.push(
      <Btn key="seize" variant="danger" block disabled={!enough} tip={<><b>Seize {regionName(here)}</b><br />Lead your warband ({s.warband}) against the garrison ({st.garrison}). {!s.pledged && !s.playerFaction ? 'Winning makes you a warlord with a hold of your own.' : ''}{!enough ? ' Needs at least 10 warband troops — hire sellswords in a saloon.' : ''}</>}
        onClick={() => openScene({
          id: 'seize', title: `Seize ${regionName(here)}`, image: 'events/army',
          text: `Your warband of ${s.warband} gathers at dusk. ${regionName(here)} is held by ${st.garrison} ${factionName(s, st.owner)} fighters.${st.owner !== 'free' ? ` ${factionName(s, st.owner)} will not forgive this.` : ''}`,
          choices: [
            { label: 'Attack', resolve: () => ({ text: 'Torches are lit. Blades come out.', army: seizePlan(s, here) }) },
            { label: 'Stand down', resolve: () => ({ text: '' }) },
          ],
        })}>
        Seize this hold ({s.warband} vs {st.garrison})
      </Btn>,
    );
  }
  if (cmd && side && st.owner === side) {
    const avail = availableGarrison(s, here);
    for (const t of attackTargets(s)) {
      if (t === 'kiln') continue;
      out.push(
        <Btn key={t} size="sm" block tip={`March ${avail} troops from the garrison plus your warband (${s.warband}) on ${regionName(t)} (${s.regions[t].garrison} defenders).`}
          disabled={avail + s.warband < 10}
          onClick={() => { orderAttack(s, t, avail); toast(`Marching on ${regionName(t)}`); G.ui.traveling = true; resumeTravel(); emit(); }}>
          March on {regionName(t)} · {avail + s.warband} vs {s.regions[t].garrison}
        </Btn>,
      );
    }
  }
  if (st.owner === PLAYER_FACTION_ID) {
    out.push(
      <div key="own" class="row" style={{ gap: 6 }}>
        <Btn size="sm" class="grow" disabled={s.barter < 40} tip="Recruit 10 garrison troops for 40 barter." onClick={() => { muster(s, here, 10); emit(); }}>Muster 10</Btn>
        <Btn size="sm" class="grow" disabled={s.warband < 10} tip="Move 10 warband fighters into the garrison." onClick={() => { garrisonTransfer(s, here, 10); emit(); }}>Garrison 10</Btn>
        <Btn size="sm" class="grow" disabled={st.garrison < 15} tip="Draft 10 garrison fighters into your warband." onClick={() => { garrisonTransfer(s, here, -10); emit(); }}>Draft 10</Btn>
      </div>,
    );
  }
  if (!out.length) return null;
  return <div class="col" style={{ gap: 6 }}><div class="label">War</div>{out}</div>;
}

export { startArmy };
