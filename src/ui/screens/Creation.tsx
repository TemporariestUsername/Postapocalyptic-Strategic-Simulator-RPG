import { useState } from 'preact/hooks';
import { audio } from '../../engine/audio';
import { img } from '../../engine/assets';
import { STATS, STAT_INFO, fmtMod } from '../../engine/dice';
import { ITEMS } from '../../data/items';
import { ABILITIES, PLAYBOOKS, PLAYBOOK_IDS } from '../../data/playbooks';
import { randomName } from '../../game/characters';
import { Rng } from '../../engine/rng';
import { Btn, Embers, Icon, useTip } from '../components/common';
import { goto, startNewGame } from '../store';

const DIFFS = [
  { id: 'easy', name: 'Drifter', desc: 'Six years until the Great Burn. The Burnt King grows slowly.' },
  { id: 'normal', name: 'Survivor', desc: 'Five years until the Great Burn. The intended experience.' },
  { id: 'hard', name: 'Burnt', desc: 'Four years. The Burnt King is hungry and relentless.' },
] as const;

export function CreationScreen() {
  const [pb, setPb] = useState('gunhand');
  const [face, setFace] = useState(1);
  const [name, setName] = useState(() => randomName(Rng.fromSeed(Date.now())));
  const [diff, setDiff] = useState<'easy' | 'normal' | 'hard'>('normal');
  const p = PLAYBOOKS[pb];
  const portrait = `portraits/${pb}_${face}`;
  const begin = () => {
    audio.sfx('ui_confirm');
    startNewGame({ name: name.trim() || 'Drifter', playbook: pb, portrait, difficulty: diff });
  };
  return (
    <div class="screen" style={{ background: 'radial-gradient(ellipse at 30% 40%, #2a1a10 0%, #0b0806 70%)' }}>
      <div class="bg-cover" style={{ backgroundImage: `url(${img('story/intro2')})`, opacity: 0.18, filter: 'blur(2px)' }} />
      <Embers count={40} />
      <div style={{ position: 'absolute', left: 60, top: 40, zIndex: 6 }}>
        <div class="label">Step 1 of 1 · Who are you?</div>
        <div class="h1">Choose Your Playbook</div>
      </div>
      <div style={{ position: 'absolute', left: 60, top: 160, width: 1060, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, zIndex: 6 }}>
        {PLAYBOOK_IDS.map((id) => <PlaybookCard key={id} id={id} active={id === pb} face={id === pb ? face : 1} onClick={() => { setPb(id); setFace(1); audio.sfx('draw', { vol: 0.5 }); }} />)}
      </div>
      <div class="panel rise" key={pb} style={{ position: 'absolute', right: 50, top: 40, width: 720, bottom: 40, zIndex: 6, padding: '26px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div class="row" style={{ gap: 22, alignItems: 'flex-start' }}>
          <div class="portrait" style={{ width: 230, height: 230, flexShrink: 0 }}><img src={img(portrait)} /></div>
          <div class="col" style={{ gap: 8 }}>
            <div class="h1" style={{ fontSize: 48 }}>{p.name}</div>
            <div class="type ember" style={{ fontSize: 20 }}>“{p.tagline}”</div>
            <div class="small dim">{p.desc}</div>
            <div class="row" style={{ gap: 8, marginTop: 6 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} class="portrait" onClick={() => { setFace(i); audio.sfx('ui_click'); }}
                  style={{ width: 62, height: 62, cursor: 'pointer', borderColor: i === face ? 'var(--ember)' : undefined, boxShadow: i === face ? '0 0 14px var(--ember-glow)' : undefined }}>
                  <img src={img(`portraits/${pb}_${i}`)} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div class="row" style={{ gap: 8, justifyContent: 'space-between' }}>
          {STATS.map((s) => <StatPill key={s} stat={s} v={p.stats[s]} />)}
        </div>
        <div class="col" style={{ gap: 8 }}>
          <div class="label">Moves</div>
          {p.abilities.map((a, i) => (
            <div key={a} class="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <Icon src={`abilities/${ABILITIES[a].icon}`} size={44} />
              <div class="grow small"><b class="ember">{ABILITIES[a].name}</b> <span class="faint tiny">· {i === 0 ? 'starting' : `level ${i === 1 ? 3 : 5}`}</span><div class="dim tiny" style={{ lineHeight: 1.3 }}>{ABILITIES[a].desc}</div></div>
            </div>
          ))}
          <div class="small"><b style={{ color: 'var(--toxic)' }}>{p.passive.name}:</b> <span class="dim">{p.passive.desc}</span></div>
        </div>
        <div class="row" style={{ gap: 10 }}>
          <div class="label">Gear</div>
          {[p.weapon, p.armor, p.gear].filter(Boolean).map((it) => <GearIcon key={it} id={it!} />)}
        </div>
        <div class="divider" style={{ margin: '2px 0' }} />
        <div class="row" style={{ gap: 12 }}>
          <div class="label" style={{ width: 90 }}>Name</div>
          <input value={name} maxLength={22} onInput={(e) => setName((e.target as HTMLInputElement).value)}
            style={{ flex: 1, height: 50, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--line-2)', color: 'var(--ink)', padding: '0 16px', fontFamily: 'var(--display)', fontSize: 26, letterSpacing: '0.06em' }} />
          <Btn size="sm" variant="ghost" onClick={() => setName(randomName(Rng.fromSeed(Date.now())))} tip="Random name">⟳</Btn>
        </div>
        <div class="row" style={{ gap: 10 }}>
          <div class="label" style={{ width: 90 }}>Challenge</div>
          {DIFFS.map((d) => (
            <DiffBtn key={d.id} d={d} active={diff === d.id} onClick={() => setDiff(d.id)} />
          ))}
        </div>
        <div class="grow" />
        <div class="row" style={{ gap: 14 }}>
          <Btn variant="ghost" onClick={() => goto('title')}>Back</Btn>
          <Btn variant="primary" size="lg" class="grow" onClick={begin}>Walk Into the Burnlands</Btn>
        </div>
      </div>
    </div>
  );
}

function PlaybookCard({ id, active, face, onClick }: { id: string; active: boolean; face: number; onClick: () => void }) {
  const p = PLAYBOOKS[id];
  return (
    <div onClick={onClick} class="panel plain" style={{
      cursor: 'pointer', padding: 0, overflow: 'hidden', height: 404, transition: 'transform 0.2s, box-shadow 0.2s',
      transform: active ? 'translateY(-6px)' : undefined,
      borderColor: active ? 'var(--ember)' : undefined,
      boxShadow: active ? '0 0 30px rgba(255,110,40,0.35), 0 20px 50px rgba(0,0,0,0.7)' : undefined,
    }} onMouseEnter={() => audio.sfx('ui_hover', { vol: 0.3 })}>
      <div style={{ height: 300, position: 'relative', overflow: 'hidden' }}>
        <img src={img(`portraits/${id}_${face}`)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: active ? 'none' : 'grayscale(0.55) brightness(0.8)', transition: 'filter 0.3s' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 55%, rgba(10,7,5,0.95))' }} />
        <div class="h2" style={{ position: 'absolute', left: 16, bottom: 8, fontSize: 32, color: active ? 'var(--ember-2)' : 'var(--ink)' }}>{p.name}</div>
      </div>
      <div class="tiny dim" style={{ padding: '10px 16px', lineHeight: 1.35 }}>{p.tagline}</div>
    </div>
  );
}

function StatPill({ stat, v }: { stat: (typeof STATS)[number]; v: number }) {
  const tip = useTip(<><b>{STAT_INFO[stat].label}</b><br />{STAT_INFO[stat].blurb}</>);
  return (
    <div class="stat-pill" {...tip} style={{ flex: 1, borderColor: v >= 2 ? 'rgba(255,122,47,0.6)' : undefined }}>
      <b style={{ color: v >= 2 ? 'var(--ember-2)' : v < 0 ? '#c98a7a' : undefined }}>{fmtMod(v)}</b>
      <span>{STAT_INFO[stat].label}</span>
    </div>
  );
}

function GearIcon({ id }: { id: string }) {
  const it = ITEMS[id];
  const tip = useTip(<><b>{it.name}</b><br />{it.desc}</>);
  return <div {...tip} class="row" style={{ gap: 6 }}><Icon src={`items/${it.icon}`} size={46} /><span class="tiny dim">{it.name}</span></div>;
}

function DiffBtn({ d, active, onClick }: { d: (typeof DIFFS)[number]; active: boolean; onClick: () => void }) {
  return <Btn size="sm" variant={active ? 'primary' : 'ghost'} tip={d.desc} onClick={onClick}>{d.name}</Btn>;
}
