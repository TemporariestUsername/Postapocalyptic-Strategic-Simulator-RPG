import { img, sigil } from '../../engine/assets';
import { FACTIONS } from '../../data/factions';
import { maxHp } from '../../game/characters';
import { rankOf, rationsPerDay, warbandCap } from '../../game/actions';
import { calendar, fmtDuration } from '../../game/util';
import { G, openPanel, useStore } from '../store';
import { HpBar, IconBtn, Token, useTip } from './common';

export function Hud() {
  const { game: s } = useStore();
  if (!s) return null;
  const c = calendar(s.day);
  const left = s.burnDay - s.day;
  const statPts = s.crew.some((x) => x.statPoints > 0);
  const barterTip = useTip(<><b>Barter</b><br />The currency of the Burnlands: bullets, fuel, batteries, clean water.{s.playerFaction && <><br />Hold income last month: <b>{s.lastIncome}</b></>}</>);
  const rationTip = useTip(<><b>Rations</b><br />Your crew and warband eat {rationsPerDay(s)} per day. Starving crews weaken fast.</>);
  const wbTip = useTip(<><b>Warband</b><br />Fighters who follow you into army battles. Hire sellswords in saloons. Cap: {warbandCap(s)}.</>);
  const burnTip = useTip(<><b>The Great Burn</b><br />When this reaches zero, the Burnt King wakes the Kiln and the world burns. Kill him first.</>);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 78, zIndex: 40, display: 'flex', alignItems: 'center', gap: 22, padding: '0 22px',
      background: 'linear-gradient(180deg, rgba(8,6,4,0.96), rgba(8,6,4,0.78) 70%, rgba(8,6,4,0))' }}>
      <img src={img('key/logo')} style={{ height: 40, filter: 'drop-shadow(0 0 10px rgba(255,90,20,0.4))' }} />
      <div class="col" style={{ gap: 0, minWidth: 210 }}>
        <div class="display" style={{ fontSize: 22, lineHeight: 1.1 }}>{c.dom} {c.monthName}</div>
        <div class="tiny dim ui" style={{ letterSpacing: '0.12em' }}>YEAR {c.year} AFTER THE BURN</div>
      </div>
      {s.quest.burnRevealed && (
        <div {...burnTip} class="row" style={{ gap: 8, padding: '6px 14px', border: '1px solid rgba(176,124,255,0.5)', background: 'rgba(60,20,90,0.35)', animation: left < 120 ? 'pulse 1.2s infinite' : undefined }}>
          <span class="label psy" style={{ color: 'var(--psy)' }}>Great Burn</span>
          <span class="num" style={{ fontSize: 22 }}>{fmtDuration(left)}</span>
        </div>
      )}
      <div class="grow" />
      <Res icon="items/barter" value={s.barter} tip={barterTip} />
      <Res icon="items/rations" value={s.rations} tip={rationTip} warn={s.rations < rationsPerDay(s) * 3} />
      <Res icon="abilities/rally" value={`${s.warband}/${warbandCap(s)}`} tip={wbTip} />
      {s.pledged && (
        <div class="row" style={{ gap: 8 }}>
          <img src={sigil(s.pledged)!} style={{ width: 44, height: 44 }} />
          <div class="col" style={{ gap: 0 }}>
            <div class="tiny ui" style={{ color: FACTIONS[s.pledged].color, letterSpacing: '0.1em' }}>{FACTIONS[s.pledged].short.toUpperCase()}</div>
            <div class="ui" style={{ fontSize: 18, fontWeight: 600 }}>{rankOf(s).name} · {s.merit} merit</div>
          </div>
        </div>
      )}
      {s.playerFaction && <div class="row" style={{ gap: 8 }}><img src={sigil('player')!} style={{ width: 44, height: 44 }} /><div class="chip ember">Warlord of {s.playerFaction.name}</div></div>}
      <div class="row" style={{ gap: 8, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <IconBtn icon="abilities/rally" label="Crew & Gear" hotkey="C" on={G.ui.panel === 'crew'} onClick={() => openPanel('crew')} />
          {statPts && <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, background: 'var(--ember)', boxShadow: '0 0 10px var(--ember)', animation: 'pulse 1s infinite' }} />}
        </div>
        <IconBtn icon="items/map" label="Journal" hotkey="J" on={G.ui.panel === 'journal'} onClick={() => openPanel('journal')} />
        <IconBtn icon="abilities/warcry" label="Warlords" hotkey="F" on={G.ui.panel === 'factions'} onClick={() => openPanel('factions')} />
        <IconBtn icon="abilities/trick" label="Menu" hotkey="Esc" on={G.ui.panel === 'menu'} onClick={() => openPanel('menu')} />
      </div>
    </div>
  );
}

function Res({ icon, value, tip, warn }: { icon: string; value: number | string; tip: object; warn?: boolean }) {
  return (
    <div {...tip} class="row" style={{ gap: 8, padding: '4px 12px 4px 4px', background: 'rgba(0,0,0,0.4)', border: `1px solid ${warn ? 'rgba(255,90,70,0.7)' : 'var(--line)'}` }}>
      <img src={img(icon)} style={{ width: 38, height: 38 }} />
      <span class="num" style={{ fontSize: 24, color: warn ? '#ff8a75' : undefined }}>{value}</span>
    </div>
  );
}

export function CrewStrip() {
  const { game: s } = useStore();
  if (!s) return null;
  return (
    <div class="row" style={{ position: 'absolute', left: 22, bottom: 20, zIndex: 30, gap: 12 }}>
      {s.crew.map((c) => (
        <div key={c.id} class="panel plain" style={{ padding: '8px 12px 8px 8px', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}
          onClick={() => { G.ui.crewSel = c.id; openPanel('crew'); }}>
          <div style={{ position: 'relative' }}>
            <Token src={c.portrait} size={58} color={c.isPlayer ? 'var(--ember)' : '#b7a58a'} />
            {c.statPoints > 0 && <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, background: 'var(--ember)', boxShadow: '0 0 8px var(--ember)' }} />}
          </div>
          <div class="col" style={{ gap: 3 }}>
            <div class="ui" style={{ fontSize: 18, fontWeight: 700, maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
            <div class="tiny dim ui">LV {c.level} · {c.hp}/{maxHp(c)}</div>
            <HpBar hp={c.hp} max={maxHp(c)} width={120} height={8} />
          </div>
        </div>
      ))}
    </div>
  );
}
