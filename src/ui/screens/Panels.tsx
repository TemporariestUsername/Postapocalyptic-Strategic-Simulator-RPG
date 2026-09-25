import { useState } from 'preact/hooks';
import { audio } from '../../engine/audio';
import { img, sigil } from '../../engine/assets';
import { STATS, STAT_INFO, fmtMod } from '../../engine/dice';
import { deleteSave, listSaves, loadGame, SLOTS, type Slot } from '../../engine/save';
import { FACTIONS, FACTION_IDS } from '../../data/factions';
import { ITEMS } from '../../data/items';
import { ABILITIES, PLAYBOOKS } from '../../data/playbooks';
import { dismiss, equip, unequip, useOutOfCombat } from '../../game/actions';
import { abilitiesOf, armorOf, effStat, MAX_STAT, maxHp, moveOf, xpForLevel } from '../../game/characters';
import { activeJobs, abandonJob } from '../../game/jobs';
import { atWar, cinderShare } from '../../game/sim';
import type { GameState } from '../../game/types';
import { fmtDate, fmtDuration, regionName, regionsOf, troopsOf } from '../../game/util';
import { Btn, Frame, HpBar, Icon, Portrait, Token, XpBar, useTip } from '../components/common';
import { ItemTip, itemLine } from '../itemInfo';
import { G, emit, game, goto, loadState, openPanel, saveTo, toast, useStore } from '../store';

export function Panels() {
  const { ui } = useStore();
  const close = () => { G.ui.panel = null; emit(); };
  switch (ui.panel) {
    case 'crew': return <CrewPanel close={close} />;
    case 'journal': return <JournalPanel close={close} />;
    case 'factions': return <FactionsPanel close={close} />;
    case 'menu': return <MenuPanel close={close} />;
    case 'saveload': return <SaveLoadPanel close={close} />;
    case 'settings': return <SettingsPanel close={close} />;
    case 'help': return <JournalPanel close={close} initial="guide" />;
    default: return null;
  }
}

// ------------------------------------------------------------------------------------ crew

function CrewPanel({ close }: { close: () => void }) {
  const s = game();
  const [selId, setSel] = useState(G.ui.crewSel ?? s.crew[0].id);
  const c = s.crew.find((x) => x.id === selId) ?? s.crew[0];
  const pb = PLAYBOOKS[c.playbook];
  const need = xpForLevel(c.level);
  const stash = Object.entries(s.stash).filter(([k, v]) => v > 0);
  const refresh = () => emit();
  return (
    <Frame title="Crew & Gear" onClose={close} width={1780} height={930}>
      <div class="row" style={{ height: '100%', alignItems: 'stretch', gap: 0 }}>
        <div class="col scroll" style={{ width: 250, padding: 16, gap: 10, borderRight: '1px solid var(--line)' }}>
          {s.crew.map((x) => (
            <div key={x.id} class={`crew-tab ${x.id === c.id ? 'on' : ''}`} onClick={() => { setSel(x.id); G.ui.crewSel = x.id; audio.sfx('ui_click'); }}>
              <Token src={x.portrait} size={54} color={x.isPlayer ? 'var(--ember)' : '#b7a58a'} />
              <div class="col" style={{ gap: 2 }}>
                <b class="ui" style={{ fontSize: 18 }}>{x.name}</b>
                <span class="tiny dim">{PLAYBOOKS[x.playbook].name} · {x.level}</span>
                {x.statPoints > 0 && <span class="tiny ember">+{x.statPoints} stat point</span>}
              </div>
            </div>
          ))}
        </div>
        <div class="col scroll" style={{ flex: 1, padding: '20px 28px', gap: 14 }}>
          <div class="row" style={{ gap: 24, alignItems: 'flex-start' }}>
            <Portrait src={c.portrait} size={250} />
            <div class="col grow" style={{ gap: 6 }}>
              <div class="h1" style={{ fontSize: 50 }}>{c.name}</div>
              <div class="ember ui" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '0.12em' }}>{pb.name.toUpperCase()} · LEVEL {c.level}</div>
              <div class="type small dim">{c.bio}</div>
              <div class="row" style={{ gap: 18, marginTop: 6 }}>
                <div class="col" style={{ gap: 4 }}><span class="label">Harm</span><HpBar hp={c.hp} max={maxHp(c)} width={240} height={14} label /></div>
                <div class="col" style={{ gap: 4 }}><span class="label">XP {c.xp}/{need}</span><XpBar xp={c.xp} need={need} width={200} /></div>
              </div>
              <div class="row" style={{ gap: 8 }}>
                <span class="chip">Armor {armorOf(c)}</span><span class="chip">Move {moveOf(c)}</span><span class="chip">Kills {c.kills}</span>
              </div>
            </div>
          </div>
          <div class="row" style={{ gap: 10 }}>
            {STATS.map((st) => {
              const tip = useTip(<><b>{STAT_INFO[st].label}</b><br />{STAT_INFO[st].blurb}</>);
              const eff = effStat(c, st);
              return (
                <div key={st} class="stat-pill" {...tip} style={{ flex: 1, position: 'relative', padding: '10px 8px' }}>
                  <b style={{ color: eff >= 2 ? 'var(--ember-2)' : undefined }}>{fmtMod(eff)}</b>
                  <span>{STAT_INFO[st].label}</span>
                  {c.statPoints > 0 && c.stats[st] < MAX_STAT && (
                    <Btn size="sm" variant="primary" style={{ position: 'absolute', top: -14, right: -8, minHeight: 30, padding: '0 10px' }}
                      onClick={() => { c.stats[st]++; c.statPoints--; c.hp = Math.min(maxHp(c), c.hp + (st === 'hard' ? 2 : 0)); audio.sfx('levelup'); refresh(); }}>+</Btn>
                  )}
                </div>
              );
            })}
          </div>
          {c.statPoints > 0 && <div class="small ember">Level up! Choose a stat to improve (max +{MAX_STAT}).</div>}
          <div class="label">Moves</div>
          {pb.abilities.map((a, i) => {
            const unlocked = abilitiesOf(c).includes(a);
            return (
              <div key={a} class="row" style={{ gap: 12, opacity: unlocked ? 1 : 0.45 }}>
                <Icon src={`abilities/${ABILITIES[a].icon}`} size={50} />
                <div class="col grow" style={{ gap: 0 }}>
                  <b>{ABILITIES[a].name} {!unlocked && <span class="tiny faint">· unlocks at level {i === 1 ? 3 : 5}</span>}</b>
                  <span class="small dim">{ABILITIES[a].desc}</span>
                </div>
              </div>
            );
          })}
          <div class="small"><b style={{ color: 'var(--toxic)' }}>{pb.passive.name}:</b> <span class="dim">{pb.passive.desc}</span></div>
          <div class="small"><b class="ember">Army order — {ABILITIES[pb.order].name}:</b> <span class="dim">{ABILITIES[pb.order].desc}</span></div>
          {!c.isPlayer && (
            <Btn variant="danger" size="sm" style={{ alignSelf: 'flex-start' }} onClick={() => { dismiss(s, c.id); setSel(s.crew[0].id); toast(`${c.name} leaves the crew`); refresh(); }}>Dismiss {c.name}</Btn>
          )}
        </div>
        <div class="col" style={{ width: 560, padding: '20px 22px', gap: 12, borderLeft: '1px solid var(--line)' }}>
          <div class="label">Equipped</div>
          {(['weapon', 'armor', 'gear'] as const).map((slot) => {
            const id = c[slot];
            const it = id ? ITEMS[id] : null;
            const tip = useTip(it ? <ItemTip id={id!} /> : null);
            return (
              <div key={slot} class="row item-row" {...tip}>
                {it ? <Icon src={`items/${it.icon}`} size={58} /> : <div style={{ width: 58, height: 58, border: '1px dashed var(--line-2)' }} />}
                <div class="col grow" style={{ gap: 0 }}>
                  <span class="tiny faint ui" style={{ letterSpacing: '0.14em' }}>{slot.toUpperCase()}</span>
                  <b>{it ? it.name : 'Empty'}</b>
                  {it && <span class="tiny dim">{itemLine(it)}</span>}
                </div>
                {it && id !== 'fists' && <Btn size="sm" variant="ghost" sfx="equip" onClick={() => { unequip(s, c.id, slot); refresh(); }}>Remove</Btn>}
              </div>
            );
          })}
          <div class="label" style={{ marginTop: 8 }}>Stash · click to equip or use on {c.name}</div>
          <div class="scroll col" style={{ gap: 6, flex: 1, minHeight: 0 }}>
            {!stash.length && <div class="small dim">Empty.</div>}
            {stash.map(([id, n]) => {
              const it = ITEMS[id];
              const tip = useTip(<ItemTip id={id} />);
              const equippable = it.kind === 'weapon' || it.kind === 'armor' || it.kind === 'gear';
              const usable = it.use && (it.use.effect === 'heal' || it.use.effect === 'medkit');
              return (
                <div key={id} class="row item-row" {...tip}>
                  <Icon src={`items/${it.icon}`} size={44} />
                  <div class="col grow" style={{ gap: 0 }}><b class="small">{it.name}{n > 1 && <span class="dim"> ×{n}</span>}</b><span class="tiny dim">{itemLine(it)}</span></div>
                  {equippable && <Btn size="sm" sfx="equip" onClick={() => { equip(s, c.id, id); refresh(); }}>Equip</Btn>}
                  {usable && <Btn size="sm" disabled={c.hp >= maxHp(c) && it.use!.effect !== 'medkit'} onClick={() => { if (useOutOfCombat(s, id, c.id)) { audio.sfx('heal'); refresh(); } }}>Use</Btn>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ------------------------------------------------------------------------------------ journal

function objectives(s: GameState): { text: string; done: boolean; hint?: string }[] {
  const q = s.quest;
  const out: { text: string; done: boolean; hint?: string }[] = [];
  out.push({ text: 'Survive the raid on Hope\'s Rest', done: q.stage >= 1 });
  if (q.stage >= 1) out.push({ text: 'Visit the Radio Tower at Ember Road', done: q.stage >= 2, hint: 'Ember Road lies west of Ashfall. Enter the settlement and climb the tower.' });
  if (q.stage >= 2) {
    out.push({ text: `Rally the warlords against the Burnt King (${q.coalition} joined)`, done: q.coalition >= 2, hint: 'Play the Tower Tape in each warlord\'s hall. Good reputation helps — work their jobs first.' });
    out.push({ text: 'Find a way into the Kiln', done: q.keycard, hint: 'The Voice said the keys were kept in the glassed bunker at Blackglass Rise.' });
    out.push({ text: 'Kill Ozmyr, the Burnt King', done: !s.factions.cinder.leaderAlive, hint: 'From a region next to the Kiln: infiltrate with the keycard, or storm the walls with a warband of at least 30 (coalition warlords send fighters).' });
  }
  return out;
}

const GUIDE: [string, string][] = [
  ['The Goal', 'The Burnt King means to wake the dead reactor under the Kiln and let the Maelstrom burn the world. Stop him before the Great Burn countdown ends, and before the Cinder Throne controls 16 of the 23 regions.'],
  ['Moves & the 2d6 Roll', 'Risky actions roll two six-sided dice plus a stat. 10+ is a strong hit: you get what you want. 7–9 is a weak hit: you get it, with a cost or complication. 6 or less is a miss: things go badly. Double sixes are a critical. Out of combat, your best crew member for the stat makes the roll.'],
  ['Stats', 'COOL: nerve and precise weapons. HARD: violence and heavy weapons. HOT: charm and command. SHARP: wits, medicine and tech. WEIRD: the psychic Maelstrom.'],
  ['Travel', 'Click a region, then Travel. Each day eats rations — keep your packs full at markets. The roads are dangerous: expect encounters, especially in high-danger regions and in lands whose warlord hates you.'],
  ['Combat', 'Battles are turn-based on a grid. Each fighter can move and act once per turn. Click a crew member, then a blue tile to move or an enemy to attack. Hover an enemy to see your odds. Low cover (barrels, sandbags) gives -1 to hit; full cover (cars, rocks) gives -2 and blocks line of sight. Downed crew bleed out in 3 turns unless revived by a Sawbones or a healing item.'],
  ['Harm & Armor', 'Weapons deal harm; armor subtracts from it (minimum 1). Strong hits add +1 harm, messy weapons +1 more. Rest, clinics and healing items restore harm between fights.'],
  ['Warlords & Reputation', 'Seven warlords wage war on their own. Work their jobs to earn reputation. At 15 reputation you can swear your blade in their hall: earn a stipend, merit and promotions. Warbosses can order attacks on enemy holds.'],
  ['Warbands & Army Battles', 'Hire sellswords at saloons. With a warband you can seize holds — as a free drifter, winning makes you a warlord with holds that pay you tribute. In army battles each crew member leads a gang; bigger gangs hit harder, and gangs break when they lose three quarters of their fighters.'],
  ['The Coalition', 'After you learn of the Great Burn, play the Tower Tape to the warlords. Those who join stop fighting each other and turn on the Cinder Throne, and they send fighters when you storm the Kiln.'],
  ['Ruins', 'Ruins hold pre-Burn treasure behind fights, traps and strange shrines. Clear a ruin to claim its prize. The bunker at Blackglass Rise holds the key to the Kiln.'],
];

function JournalPanel({ close, initial = 'quests' }: { close: () => void; initial?: string }) {
  const s = game();
  const [tab, setTab] = useState(initial);
  const jobs = activeJobs(s);
  return (
    <Frame title="Journal" onClose={close} width={1500} height={900} right={
      <div class="row" style={{ gap: 6, marginRight: 12 }}>
        {[['quests', 'Objectives'], ['jobs', `Jobs (${jobs.length})`], ['news', 'Chronicle'], ['guide', 'Field Guide']].map(([k, l]) => <Btn key={k} size="sm" variant={tab === k ? 'primary' : 'ghost'} onClick={() => setTab(k)}>{l}</Btn>)}
      </div>
    }>
      <div class="scroll" style={{ height: '100%', padding: '24px 40px' }}>
        {tab === 'quests' && (
          <div class="col" style={{ gap: 18 }}>
            {s.quest.burnRevealed && <div class="panel plain" style={{ padding: 18, borderColor: 'rgba(176,124,255,0.5)' }}><span class="h3 psy" style={{ color: 'var(--psy)' }}>The Great Burn: {fmtDuration(s.burnDay - s.day)}</span><div class="small dim">The Burnt King will wake the Kiln on {fmtDate(s.burnDay)}.</div></div>}
            {objectives(s).map((o, i) => (
              <div key={i} class="row" style={{ gap: 16, alignItems: 'flex-start', opacity: o.done ? 0.55 : 1 }}>
                <div style={{ width: 30, height: 30, border: '2px solid var(--ember)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 4 }}>{o.done ? '✓' : ''}</div>
                <div class="col" style={{ gap: 2 }}>
                  <div class="h3" style={{ textDecoration: o.done ? 'line-through' : undefined }}>{o.text}</div>
                  {!o.done && o.hint && <div class="small dim type">{o.hint}</div>}
                </div>
              </div>
            ))}
            <div class="divider" />
            <div class="row wrap" style={{ gap: 10 }}>
              <span class="chip">Battles won {s.stats.wins}/{s.stats.battles}</span>
              <span class="chip">Kills {s.stats.kills}</span>
              <span class="chip">Jobs done {s.stats.jobsDone}</span>
              <span class="chip">Holds taken {s.stats.regionsTaken}</span>
              <span class="chip">Ruins cleared {s.stats.delves}</span>
              <span class="chip bad">Cinder dominion {regionsOf(s, 'cinder').length}/23 (defeat at 16)</span>
            </div>
          </div>
        )}
        {tab === 'jobs' && (
          <div class="col" style={{ gap: 12 }}>
            {!jobs.length && <div class="dim">No active jobs. Look for work at saloons and warlords' halls.</div>}
            {jobs.map((j) => (
              <div key={j.id} class="job-card">
                <div class="spread"><div class="h3">{j.title}</div><span class="chip ember">{j.reward} barter</span></div>
                <div class="small dim">{j.desc}</div>
                <div class="row" style={{ gap: 8, marginTop: 8 }}>
                  <span class="chip">For {FACTIONS[j.issuer].short}</span>
                  <span class="chip">Go to {regionName(j.target)}</span>
                  <span class={`chip ${j.deadline - s.day < 10 ? 'bad' : ''}`}>{j.deadline - s.day} days left</span>
                  <span class="grow" />
                  <Btn size="sm" onClick={() => { G.ui.selected = j.target; G.ui.panel = null; emit(); }}>Show on map</Btn>
                  <Btn size="sm" variant="danger" onClick={() => { abandonJob(s, j.id); emit(); }}>Abandon</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'news' && (
          <div class="col" style={{ gap: 6 }}>
            {s.news.map((n, i) => <div key={i} class="row small" style={{ gap: 14 }}><span class="num faint" style={{ width: 200, flexShrink: 0 }}>{fmtDate(n.day)}</span><span>{n.text}</span></div>)}
          </div>
        )}
        {tab === 'guide' && (
          <div class="col" style={{ gap: 18 }}>
            {GUIDE.map(([t, d]) => <div key={t}><div class="h3 ember">{t}</div><div style={{ marginTop: 4 }}>{d}</div></div>)}
            <div class="divider" />
            <div class="small dim">Hotkeys: <span class="kbd">C</span> crew · <span class="kbd">J</span> journal · <span class="kbd">F</span> warlords · <span class="kbd">Esc</span> menu · in battle <span class="kbd">Space</span> end turn, <span class="kbd">1-5</span> moves, <span class="kbd">Tab</span> next fighter.</div>
          </div>
        )}
      </div>
    </Frame>
  );
}

// ------------------------------------------------------------------------------------ factions

function FactionsPanel({ close }: { close: () => void }) {
  const s = game();
  const share = cinderShare(s);
  return (
    <Frame title="The Warlords of the Burnlands" onClose={close} width={1800} height={940}>
      <div class="col" style={{ height: '100%', padding: '18px 26px', gap: 14 }}>
        <div class="row" style={{ gap: 16 }}>
          <span class="label">Cinder dominion</span>
          <div class="bar" style={{ flex: 1, height: 16 }}><i style={{ width: `${(share / 0.7) * 100}%` }} /></div>
          <span class="num bad">{regionsOf(s, 'cinder').length} / 16 regions</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, flex: 1, minHeight: 0 }}>
          {FACTION_IDS.map((fid) => {
            const def = FACTIONS[fid];
            const f = s.factions[fid];
            const wars = FACTION_IDS.filter((o) => o !== fid && s.factions[o].alive && atWar(s, fid, o));
            return (
              <div key={fid} class="panel plain" style={{ position: 'relative', padding: 14, display: 'flex', flexDirection: 'column', gap: 8, opacity: f.alive ? 1 : 0.45, borderColor: `${def.color}66` }}>
                <div class="row" style={{ gap: 12 }}>
                  <Portrait src={def.portrait} size={96} style={{ borderColor: def.color, filter: f.alive ? undefined : 'grayscale(1)' }} />
                  <img src={sigil(fid)!} style={{ position: 'absolute', right: 10, top: 10, width: 64, height: 64, opacity: 0.85 }} />
                  <div class="col" style={{ gap: 2 }}>
                    <div class="h3" style={{ color: def.color, fontSize: 22 }}>{def.name}</div>
                    <div class="small">{def.leader}</div>
                    <div class="tiny dim">{def.leaderTitle}</div>
                  </div>
                </div>
                {f.alive ? (
                  <>
                    <div class="row wrap" style={{ gap: 6 }}>
                      <span class="chip">{regionsOf(s, fid).length} holds</span>
                      <span class="chip">{troopsOf(s, fid)} troops</span>
                      {f.coalition && <span class="chip good">Coalition</span>}
                      {s.pledged === fid && <span class="chip ember">Your warlord</span>}
                    </div>
                    <div class="row" style={{ gap: 8 }}>
                      <span class="tiny dim" style={{ width: 90 }}>Your rep</span>
                      <div class="bar" style={{ flex: 1, height: 10 }}><i style={{ left: f.rep < 0 ? `${50 + f.rep / 2}%` : '50%', width: `${Math.abs(f.rep) / 2}%`, background: f.rep >= 0 ? 'linear-gradient(180deg,#9ad16a,#3f7a1f)' : undefined }} /></div>
                      <span class="num tiny" style={{ width: 36, textAlign: 'right' }}>{f.rep}</span>
                    </div>
                    <div class="row wrap" style={{ gap: 4 }}>
                      {wars.length ? wars.map((w) => <span key={w} class="chip bad" style={{ fontSize: 13 }}>War: {FACTIONS[w].short}</span>) : <span class="tiny dim">At peace with all.</span>}
                    </div>
                    <div class="tiny" style={{ lineHeight: 1.35 }}><span class="dim">Holds:</span> {regionsOf(s, fid).map(regionName).join(', ')}</div>
                    <div class="tiny dim type" style={{ lineHeight: 1.35, marginTop: 'auto' }}>“{def.motto}”</div>
                  </>
                ) : <div class="h3 bad">Destroyed</div>}
              </div>
            );
          })}
          <div class="panel plain" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div class="h3">Free Holds</div>
            <div class="small dim">{regionsOf(s, 'free').map(regionName).join(', ') || 'None left.'}</div>
            {s.playerFaction && <><div class="h3 ember" style={{ marginTop: 10 }}>{s.playerFaction.name}</div><div class="small">{regionsOf(s, 'player').map(regionName).join(', ')}</div></>}
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ------------------------------------------------------------------------------------ menu, save, settings

function MenuPanel({ close }: { close: () => void }) {
  return (
    <Frame title="Menu" onClose={close} width={560} height={640}>
      <div class="col" style={{ padding: 36, gap: 14 }}>
        <Btn variant="primary" block onClick={close}>Resume</Btn>
        <Btn block onClick={() => { G.ui.saveMode = 'save'; openPanel('saveload'); }}>Save Game</Btn>
        <Btn block onClick={() => { G.ui.saveMode = 'load'; openPanel('saveload'); }}>Load Game</Btn>
        <Btn block onClick={() => openPanel('settings')}>Settings</Btn>
        <Btn block onClick={() => openPanel('help')}>Field Guide</Btn>
        <Btn variant="danger" block onClick={() => { G.ui.traveling = false; G.game = null; goto('title'); }}>Quit to Title</Btn>
      </div>
    </Frame>
  );
}

function SaveLoadPanel({ close }: { close: () => void }) {
  const { ui } = useStore();
  const mode = ui.saveMode;
  const saves = listSaves();
  const metaOf = (slot: Slot) => saves.find((x) => x.slot === slot);
  return (
    <Frame title={mode === 'save' ? 'Save Game' : 'Load Game'} onClose={close} width={1100} height={720}>
      <div class="col" style={{ padding: 30, gap: 14 }}>
        {SLOTS.map((slot) => {
          const m = metaOf(slot);
          const canSave = mode === 'save' && slot !== 'auto' && !!G.game;
          return (
            <div key={slot} class="row item-row" style={{ gap: 18, padding: 14 }}>
              {m ? <Token src={m.portrait} size={64} /> : <div style={{ width: 64, height: 64, border: '1px dashed var(--line-2)', borderRadius: 32 }} />}
              <div class="col grow" style={{ gap: 2 }}>
                <b class="ui" style={{ fontSize: 22 }}>{slot === 'auto' ? 'Autosave' : `Slot ${slot}`}{m && ` — ${m.name}`}</b>
                <span class="small dim">{m ? `${PLAYBOOKS[m.playbook]?.name} · level ${m.level} · ${fmtDate(m.day)} · ${regionName(m.location)} · saved ${new Date(m.savedAt).toLocaleString()}` : 'Empty'}</span>
              </div>
              {mode === 'save' && canSave && <Btn size="sm" variant="primary" onClick={() => { saveTo(slot); emit(); }}>Save</Btn>}
              {mode === 'load' && m && <Btn size="sm" variant="primary" onClick={() => { const s = loadGame(slot); if (s) { G.ui.panel = null; loadState(s); } else toast('Could not load', 'bad'); }}>Load</Btn>}
              {m && slot !== 'auto' && <Btn size="sm" variant="ghost" onClick={() => { deleteSave(slot); emit(); }}>Delete</Btn>}
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

function SettingsPanel({ close }: { close: () => void }) {
  const st = audio.settings;
  const [, force] = useState(0);
  const slider = (k: 'music' | 'sfx', label: string) => (
    <div class="row" style={{ gap: 16 }}>
      <span class="label" style={{ width: 140 }}>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={st[k]} style={{ flex: 1, accentColor: '#ff7a2f' }}
        onInput={(e) => { audio.set(k, Number((e.target as HTMLInputElement).value)); force((n) => n + 1); if (k === 'sfx') audio.sfx('ui_click'); }} />
      <span class="num" style={{ width: 50 }}>{Math.round(st[k] * 100)}</span>
    </div>
  );
  return (
    <Frame title="Settings" onClose={close} width={820} height={520}>
      <div class="col" style={{ padding: 36, gap: 22 }}>
        {slider('music', 'Music')}
        {slider('sfx', 'Effects')}
        <div class="row" style={{ gap: 12 }}>
          <Btn variant={st.muted ? 'primary' : 'ghost'} onClick={() => { audio.set('muted', !st.muted); force((n) => n + 1); }}>{st.muted ? 'Unmute' : 'Mute all'}</Btn>
          <Btn variant="ghost" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }}>Toggle Fullscreen</Btn>
        </div>
        <div class="small dim">Audio settings are remembered on this device.</div>
      </div>
    </Frame>
  );
}

export { img };
