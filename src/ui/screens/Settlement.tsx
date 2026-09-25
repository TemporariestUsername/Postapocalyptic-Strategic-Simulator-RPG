import type { ComponentChildren } from 'preact';
import { img, sigil } from '../../engine/assets';
import { Rng } from '../../engine/rng';
import { STATS, STAT_INFO, fmtMod } from '../../engine/dice';
import { FACTIONS, PLAYER_FACTION_ID } from '../../data/factions';
import { ITEMS, SHOP_ITEMS } from '../../data/items';
import { PLAYBOOKS } from '../../data/playbooks';
import { REGION_BY_ID } from '../../data/regions';
import { tapeScene } from '../../data/story';
import {
  buy, buyPrice, buyRations, canPledge, clinicCost, clinicHeal, hire, hireTroops, MAX_CREW, pledge, rankOf, rationPrice, recruitCost, renounce,
  sell, sellPrice, troopCost, warbandCap,
} from '../../game/actions';
import { maxHp } from '../../game/characters';
import { acceptJob, activeJobs, jobsAt, MAX_ACTIVE_JOBS } from '../../game/jobs';
import { atWar } from '../../game/sim';
import type { GameState, Job } from '../../game/types';
import { factionColor, factionName, regionName } from '../../game/util';
import { Btn, HpBar, Icon, Portrait, Token, useTip } from '../components/common';
import { CrewStrip, Hud } from '../components/Hud';
import { Hint } from '../components/Hint';
import { ItemTip, itemLine } from '../itemInfo';
import { G, emit, game, goto, openScene, setTab, toast, useStore } from '../store';
import { audio } from '../../engine/audio';
import { storyScene } from '../../data/story';
import { RUMORS } from '../../data/rumors';

export function SettlementScreen() {
  const { game: s, ui } = useStore();
  if (!s) return null;
  const id = s.location;
  const r = REGION_BY_ID[id];
  const owner = s.regions[id].owner;
  const fdef = FACTIONS[owner];
  const hasHall = !!fdef && fdef.capital === id;
  const tabs: { id: NonNullable<typeof ui.tab>; label: string; icon: string; show: boolean; sub: string }[] = [
    { id: 'market', label: 'Market', icon: 'items/barter', show: r.market > 0, sub: 'Weapons, armor, supplies' },
    { id: 'bar', label: 'Saloon', icon: 'abilities/trick', show: r.bar, sub: 'Hands for hire, work, rumors' },
    { id: 'clinic', label: 'Clinic', icon: 'abilities/patch', show: r.clinic, sub: 'Stitches and stims' },
    { id: 'hall', label: 'Warlord\'s Hall', icon: 'abilities/rally', show: hasHall, sub: fdef ? `Audience with ${fdef.leader}` : '' },
    { id: 'tower', label: 'Radio Tower', icon: 'abilities/maelstrom', show: id === 'emberroad', sub: 'The Voice listens' },
  ];
  return (
    <div class="screen">
      <div class="bg-cover" style={{ backgroundImage: `url(${img(ui.tab === 'bar' ? 'interiors/bar' : ui.tab === 'market' ? 'interiors/market' : ui.tab === 'clinic' ? 'interiors/clinic' : ui.tab === 'hall' ? `interiors/hall_${owner}` : ui.tab === 'tower' ? 'events/tower' : `towns/${r.town}`)})`, transition: 'background-image 0.4s', animation: 'kenburns 50s ease-in-out infinite alternate' }} />
      <div class="screen" style={{ background: 'linear-gradient(90deg, rgba(6,4,3,0.92) 0%, rgba(6,4,3,0.55) 30%, rgba(6,4,3,0.15) 60%, rgba(6,4,3,0.3) 100%)' }} />
      <Hud />
      <div style={{ position: 'absolute', left: 50, top: 110, width: 430, zIndex: 20 }} class="col">
        <div class="label" style={{ color: factionColor(s, owner) }}>{factionName(s, owner)}</div>
        <div class="h1" style={{ fontSize: 64 }}>{r.name}</div>
        <div class="type small dim" style={{ lineHeight: 1.5, marginBottom: 12 }}>{r.desc}</div>
        {tabs.filter((t) => t.show).map((t) => (
          <div key={t.id} class={`loc-btn ${ui.tab === t.id ? 'on' : ''}`} onClick={() => setTab(ui.tab === t.id ? null : t.id)} onMouseEnter={() => audio.sfx('ui_hover', { vol: 0.3 })}>
            <img src={img(t.icon)} />
            <div class="col" style={{ gap: 0 }}>
              <div class="display" style={{ fontSize: 26 }}>{t.label}</div>
              <div class="tiny dim">{t.sub}</div>
            </div>
          </div>
        ))}
        <Btn variant="ghost" onClick={() => goto('world')} style={{ marginTop: 14 }}>← Back to the Map</Btn>
      </div>
      {ui.tab && (
        <div class="panel rise" key={ui.tab} style={{ position: 'absolute', left: 530, top: 100, right: 40, bottom: 130, zIndex: 20, display: 'flex', flexDirection: 'column' }}>
          {ui.tab === 'market' && <Market />}
          {ui.tab === 'bar' && <Saloon />}
          {ui.tab === 'clinic' && <Clinic />}
          {ui.tab === 'hall' && <Hall />}
          {ui.tab === 'tower' && <Tower />}
        </div>
      )}
      <CrewStrip />
      {!ui.scene && <Hint id="settlement" />}
    </div>
  );
}

function Head({ title, sub, right, icon }: { title: string; sub?: ComponentChildren; right?: ComponentChildren; icon?: string }) {
  return (
    <div class="panel-head">
      {icon && <img src={icon} style={{ width: 58, height: 58, filter: 'drop-shadow(0 2px 6px #000)' }} />}
      <div class="col grow" style={{ gap: 0 }}>
        <div class="h2">{title}</div>
        {sub && <div class="small dim">{sub}</div>}
      </div>
      {right}
      <Btn variant="ghost" size="sm" onClick={() => setTab(null)}>✕</Btn>
    </div>
  );
}

// ------------------------------------------------------------------------------------ market

function shopStock(s: GameState, region: string): string[] {
  const r = REGION_BY_ID[region];
  let h = 0;
  for (const ch of region) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = Rng.fromSeed(h + Math.floor(s.day / 30) * 7919);
  const cons = SHOP_ITEMS.filter((i) => i.kind === 'consumable' && i.tier <= r.market);
  const gear = SHOP_ITEMS.filter((i) => i.kind !== 'consumable' && i.tier <= r.market);
  rng.shuffle(gear);
  const extra = gear.slice(0, 6 + r.market * 2).sort((a, b) => (a.kind + a.price).localeCompare(b.kind + b.price) || a.price - b.price);
  return [...cons.map((i) => i.id), ...extra.sort((a, b) => a.kind.localeCompare(b.kind) || a.price - b.price).map((i) => i.id)];
}

function Market() {
  const s = game();
  const here = s.location;
  const stock = shopStock(s, here);
  const stash = Object.entries(s.stash).filter(([k, v]) => v > 0 && ITEMS[k].kind !== 'quest');
  const rp = rationPrice(s, here);
  return (
    <>
      <Head title="Market" sub="Everything has a price. Prices depend on your reputation here." right={<span class="chip ember">{s.barter} barter</span>} />
      <div class="row grow" style={{ alignItems: 'stretch', minHeight: 0, gap: 0 }}>
        <div class="col grow scroll" style={{ padding: '16px 22px', gap: 8, borderRight: '1px solid var(--line)' }}>
          <div class="label">For Sale</div>
          <div class="row item-row">
            <Icon src="items/rations" size={52} />
            <div class="col grow" style={{ gap: 0 }}><b>Rations</b><span class="tiny dim">Food and water. You have {s.rations}.</span></div>
            <Btn size="sm" disabled={s.barter < Math.ceil(10 * rp)} sfx="coins" onClick={() => { buyRations(s, here, 10); emit(); }}>+10 · {Math.ceil(10 * rp)}</Btn>
            <Btn size="sm" disabled={s.barter < Math.ceil(30 * rp)} sfx="coins" onClick={() => { buyRations(s, here, 30); emit(); }}>+30 · {Math.ceil(30 * rp)}</Btn>
          </div>
          {stock.map((id) => <ShopRow key={id} id={id} price={buyPrice(s, here, id)} action="Buy" can={s.barter >= buyPrice(s, here, id)} onAct={() => { if (buy(s, here, id)) { toast(`Bought ${ITEMS[id].name}`); emit(); } }} />)}
        </div>
        <div class="col scroll" style={{ width: 520, padding: '16px 22px', gap: 8 }}>
          <div class="label">Your Stash (sell)</div>
          {!stash.length && <div class="dim small">Nothing to sell. Equipped gear is on your crew.</div>}
          {stash.map(([id, n]) => <ShopRow key={id} id={id} price={sellPrice(id)} count={n} action="Sell" can onAct={() => { sell(s, id); audio.sfx('coins'); emit(); }} />)}
        </div>
      </div>
    </>
  );
}

function ShopRow({ id, price, action, can, onAct, count }: { id: string; price: number; action: string; can: boolean; onAct: () => void; count?: number }) {
  const it = ITEMS[id];
  const tip = useTip(<ItemTip id={id} />);
  return (
    <div class="row item-row" {...tip}>
      <Icon src={`items/${it.icon}`} size={52} />
      <div class="col grow" style={{ gap: 0 }}>
        <b>{it.name}{count && count > 1 ? <span class="dim"> ×{count}</span> : null}</b>
        <span class="tiny dim">{itemLine(it)}</span>
      </div>
      <span class="num ember" style={{ fontSize: 22, minWidth: 56, textAlign: 'right' }}>{price}</span>
      <Btn size="sm" disabled={!can} sfx={action === 'Sell' ? false : 'coins'} onClick={onAct}>{action}</Btn>
    </div>
  );
}

// ------------------------------------------------------------------------------------ saloon

function Saloon() {
  const s = game();
  const here = s.location;
  const recruits = s.recruits[here] ?? [];
  const jobs = jobsAt(s, here);
  const cap = warbandCap(s);
  const tc = troopCost(s);
  const room = cap - s.warband;
  const rumor = RUMORS[(s.day + here.length * 7) % RUMORS.length](s);
  return (
    <>
      <Head title="The Saloon" sub="Smoke, cheap hooch, and people who will do anything for barter." right={<span class="chip ember">{s.barter} barter</span>} />
      <div class="row grow" style={{ alignItems: 'stretch', minHeight: 0, gap: 0 }}>
        <div class="col scroll" style={{ width: 640, padding: '16px 22px', gap: 12, borderRight: '1px solid var(--line)' }}>
          <div class="label">Hands for Hire · crew {s.crew.length}/{MAX_CREW}</div>
          {!recruits.length && <div class="dim small">Nobody here is looking for work this month.</div>}
          {recruits.map((c) => {
            const cost = recruitCost(s, c.id, here);
            const pb = PLAYBOOKS[c.playbook];
            return (
              <div key={c.id} class="row recruit" style={{ gap: 16, alignItems: 'flex-start' }}>
                <Portrait src={c.portrait} size={128} />
                <div class="col grow" style={{ gap: 4 }}>
                  <div class="spread"><div class="h3" style={{ fontSize: 26 }}>{c.name}</div><span class="chip">Lv {c.level}</span></div>
                  <div class="ember ui" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.08em' }}>{pb.name.toUpperCase()}</div>
                  <div class="tiny dim type" style={{ lineHeight: 1.35 }}>{c.bio}</div>
                  <div class="row" style={{ gap: 6 }}>{STATS.map((st) => <span key={st} class="chip" style={{ fontSize: 14 }}>{STAT_INFO[st].label.slice(0, 3)} {fmtMod(c.stats[st])}</span>)}</div>
                  <Btn size="sm" disabled={s.barter < cost || s.crew.length >= MAX_CREW} sfx="coins" onClick={() => { if (hire(s, here, c.id)) { toast(`${c.name} joins the crew`, 'good'); emit(); } }}>
                    Hire · {cost} barter
                  </Btn>
                </div>
              </div>
            );
          })}
          <div class="divider" />
          <div class="label">Sellswords for your Warband · {s.warband}/{cap}</div>
          <div class="small dim">Fighters who follow you into army battles. {tc} barter each. Needed to seize holds and storm the Kiln.</div>
          <div class="row" style={{ gap: 8 }}>
            {[5, 10, 25].map((n) => <Btn key={n} size="sm" disabled={room <= 0 || s.barter < Math.min(n, room) * tc} sfx="coins" onClick={() => { hireTroops(s, n); emit(); }}>+{Math.min(n, Math.max(room, 0))} · {Math.min(n, Math.max(room, 0)) * tc}</Btn>)}
          </div>
        </div>
        <div class="col grow scroll" style={{ padding: '16px 22px', gap: 10 }}>
          <div class="label">Job Board · {activeJobs(s).length}/{MAX_ACTIVE_JOBS} active</div>
          {!jobs.length && <div class="dim small">No work posted here right now. Try again next month, or at another hold.</div>}
          {jobs.map((j) => <JobCard key={j.id} j={j} />)}
          <div class="divider" />
          <div class="label">Overheard at the Bar</div>
          <div class="narr small" style={{ fontSize: 20 }}>“{rumor}”</div>
        </div>
      </div>
    </>
  );
}

function JobCard({ j }: { j: Job }) {
  const s = game();
  const full = activeJobs(s).length >= MAX_ACTIVE_JOBS;
  return (
    <div class="job-card">
      <div class="spread">
        <div class="h3" style={{ fontSize: 22 }}>{j.title}</div>
        <span class="chip ember">{j.reward} barter</span>
      </div>
      <div class="small dim" style={{ margin: '4px 0 8px' }}>{j.desc}</div>
      <div class="row" style={{ gap: 8 }}>
        <span class="chip">{regionName(j.target)}</span>
        <span class="chip">{j.deadline - s.day} days</span>
        <span class="chip good">+{j.rep} rep</span>
        {s.pledged === j.issuer && <span class="chip ember">+{j.merit} merit</span>}
        <span class="grow" />
        <Btn size="sm" variant="primary" disabled={full} onClick={() => { if (acceptJob(s, j.id)) { toast('Job accepted', 'good'); emit(); } }}>{full ? 'Too many jobs' : 'Accept'}</Btn>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------ clinic

function Clinic() {
  const s = game();
  const cost = clinicCost(s);
  return (
    <>
      <Head title="The Clinic" sub="Stitches, splints and questionable medicine." right={<span class="chip ember">{s.barter} barter</span>} />
      <div class="row grow" style={{ padding: 26, gap: 30, alignItems: 'flex-start' }}>
        <div class="col" style={{ alignItems: 'center', width: 280 }}>
          <Portrait src="npcs/doc" size={260} />
          <div class="narr small" style={{ textAlign: 'center' }}>“Lie down. This is going to hurt. It always hurts.”</div>
        </div>
        <div class="col grow" style={{ gap: 14 }}>
          {s.crew.map((c) => (
            <div key={c.id} class="row item-row" style={{ gap: 16 }}>
              <Token src={c.portrait} size={56} />
              <div class="col grow" style={{ gap: 4 }}><b>{c.name}</b><HpBar hp={c.hp} max={maxHp(c)} width="100%" /></div>
              <span class="num">{c.hp}/{maxHp(c)}</span>
            </div>
          ))}
          <Btn variant="primary" size="lg" disabled={cost <= 0 || s.barter < cost} onClick={() => { if (clinicHeal(s)) { audio.sfx('heal'); toast('The crew is patched up', 'good'); emit(); } }}>
            {cost <= 0 ? 'Everyone is healthy' : `Heal everyone · ${cost} barter`}
          </Btn>
          <div class="tiny dim">Resting in the field also heals slowly (faster with a Sawbones in the crew). Clinic prices are halved when you travel with a Sawbones.</div>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------ hall

function Hall() {
  const s = game();
  const here = s.location;
  const fid = s.regions[here].owner;
  const def = FACTIONS[fid];
  const f = s.factions[fid];
  const pledgeBlock = canPledge(s, fid);
  const jobs = jobsAt(s, here);
  const greet = def.greeting[s.day % def.greeting.length];
  const wars = Object.keys(FACTIONS).filter((o) => o !== fid && s.factions[o].alive && atWar(s, fid, o));
  const hostile = f.rep <= -40;
  return (
    <>
      <Head title={`${def.leader}`} sub={def.leaderTitle} icon={sigil(fid) ?? undefined} right={<span class={`chip ${f.rep >= 15 ? 'good' : f.rep <= -20 ? 'bad' : ''}`}>Reputation {f.rep > 0 ? '+' : ''}{f.rep}</span>} />
      <div class="row grow" style={{ padding: 26, gap: 30, alignItems: 'flex-start', minHeight: 0 }}>
        <div class="col" style={{ width: 340, alignItems: 'center' }}>
          <Portrait src={def.portrait} size={330} style={{ borderColor: def.color, boxShadow: `0 0 40px ${def.color}55` }} />
          <div class="type ember" style={{ fontSize: 20, textAlign: 'center' }}>“{def.motto}”</div>
        </div>
        <div class="col grow scroll" style={{ gap: 14, maxHeight: '100%' }}>
          <div class="narr" style={{ fontSize: 24 }}>“{hostile ? 'You have some nerve showing your face here. Speak quickly, before I change my mind about letting you leave.' : greet}”</div>
          <div class="small dim">{def.desc}</div>
          <div class="row wrap" style={{ gap: 8 }}>
            <span class="chip">{Object.values(s.regions).filter((r) => r.owner === fid).length} holds</span>
            <span class="chip">Treasury {Math.round(f.treasury)}</span>
            {f.coalition && <span class="chip good">Coalition member</span>}
            {wars.map((w) => <span key={w} class="chip bad">At war: {FACTIONS[w].short}</span>)}
          </div>
          <div class="divider" />
          {s.pledged === fid ? (
            <div class="col" style={{ gap: 8 }}>
              <div class="ember h3">You are {rankOf(s).name} of {def.name}</div>
              <div class="small dim">Stipend {rankOf(s).stipend} barter/month. Merit {s.merit}. {rankOf(s).id !== 'warboss' ? 'Earn merit through jobs and battles for promotion.' : 'As Warboss you may march on enemy holds from any of your warlord\'s territory.'}</div>
              <Btn variant="danger" size="sm" onClick={() => openScene({ id: 'renounce', title: 'Renounce Your Oath', image: 'interiors/hall', portrait: def.portrait, speaker: def.leader, text: `"Leaving? Oaths aren't coats, drifter. You don't just take them off." ${def.leader} will not forget this.`, choices: [{ label: 'Renounce the oath', resolve: () => { renounce(s); return { text: 'You walk out of the hall. Nobody stops you. Yet.' }; } }, { label: 'Stay', resolve: () => ({ text: '' }) }] })}>Renounce oath</Btn>
            </div>
          ) : (
            fid !== 'cinder' || !s.quest.burnRevealed ? (
              <Btn variant="primary" disabled={!!pledgeBlock} tip={<><b>Swear Your Blade</b><br />Serve {def.leader}: earn a monthly stipend, rise through the ranks, command troops in their wars. {pledgeBlock && <><br /><span class="bad">{pledgeBlock}</span></>}</>}
                onClick={() => openScene({ id: 'pledge', title: 'The Oath', image: 'interiors/hall', portrait: def.portrait, speaker: def.leader, text: `"Kneel, then." ${def.leader} rests a blade on your shoulder. "Serve me well and you'll never go hungry again. Betray me and you'll wish the Burn had taken you."`, choices: [{ label: `Swear to ${def.leader}`, resolve: () => { pledge(s, fid); return { text: `You are now a Sworn Hand of ${def.name}.`, effects: ['Stipend: 10 barter/month', '+10 reputation'] }; } }, { label: 'Not today', resolve: () => ({ text: '' }) }] })}>
                Swear your blade to {def.leader}
              </Btn>
            ) : null
          )}
          {s.quest.tape && !f.coalition && fid !== 'cinder' && !hostile && (() => {
            const last = s.flags[`tape:${fid}`] as number | undefined;
            const wait = last !== undefined ? last + 30 - s.day : 0;
            return (
              <Btn variant="psy" disabled={wait > 0} onClick={() => openScene(tapeScene(s, fid))}
                tip={<><b>Play the Tower Tape</b><br />Roll Hot to bring {def.leader} into the coalition against the Burnt King. A strong hit always works; a weak hit needs 20+ reputation.{wait > 0 && <><br /><span class="bad">{def.leader} won't hear it again for {wait} days.</span></>}</>}>
                Play the Tower Tape{wait > 0 ? ` (${wait}d)` : ''}
              </Btn>
            );
          })()}
          <div class="divider" />
          <div class="label">Work for {def.leader}</div>
          {hostile ? <div class="small bad">{def.leader} will not give you work.</div> : jobs.length ? jobs.map((j) => <JobCard key={j.id} j={j} />) : <div class="small dim">No work at the moment.</div>}
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------ tower

function Tower() {
  const s = game();
  const lines = [
    'The storm says the King sleeps with his eyes open. He is afraid of the dark under the Kiln — the tunnels. Somebody sealed them. Somebody kept the key at Blackglass.',
    'Warlords are like dogs, dear. They only stop fighting each other when a bigger dog walks into the yard. Play them the tape.',
    'Every hold the King burns makes him louder in the storm. Take them back and he grows quieter. Weaker.',
    'I heard your name in the static last night. You were standing on a throne of turbines. Were you sitting on it, or burning on it? The static didn\'t say.',
  ];
  const stage1 = s.quest.stage === 1;
  return (
    <>
      <Head title="The Radio Tower" sub="Candles, glowing tubes, and a voice that listens to the storm." />
      <div class="row grow" style={{ padding: 26, gap: 30, alignItems: 'flex-start' }}>
        <Portrait src="npcs/voice" size={300} />
        <div class="col grow" style={{ gap: 16 }}>
          {stage1 ? (
            <>
              <div class="narr">Static crackles as you climb the rusted stairs. A cracked voice calls down: “Come up, come up. I have been waiting for you. The storm told me your face.”</div>
              <Btn variant="psy" size="lg" onClick={() => openScene(storyScene(s, 'tower')!)}>Climb the tower</Btn>
            </>
          ) : s.quest.stage < 1 ? (
            <div class="narr">The tower door is barred. Somewhere above, a radio hisses and an old woman is talking to nobody. Perhaps you should come back when you have a reason.</div>
          ) : (
            <>
              <div class="narr">“Back again? The storm is loud today.” The Voice tilts her head, listening.</div>
              <div class="narr ember">“{lines[s.day % lines.length]}”</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export { G, PLAYER_FACTION_ID };
