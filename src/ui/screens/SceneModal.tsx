import { img } from '../../engine/assets';
import { chanceAtLeast, fmtMod, STAT_INFO } from '../../engine/dice';
import { bestFor, moveBonus } from '../../game/scenes';
import { Btn, RollDisplay } from '../components/common';
import { chooseOption, continueScene, game, useStore } from '../store';

export function SceneModal() {
  const { ui } = useStore();
  const v = ui.scene!;
  const s = game();
  const sc = v.scene;
  return (
    <div class="modal-back" style={{ zIndex: 320 }}>
      <div class="panel rise" style={{ width: 1440, maxHeight: 1010, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ position: 'relative', height: 470, flexShrink: 0, overflow: 'hidden' }}>
          <div class="bg-cover" style={{ backgroundImage: `url(${img(sc.image)})`, animation: 'kenburns 30s ease-out both' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 40%, rgba(14,10,8,0.98) 100%)' }} />
          {sc.portrait && (
            <div class="portrait" style={{ position: 'absolute', left: 36, bottom: 24, width: 170, height: 170, borderColor: 'var(--ember)' }}>
              <img src={img(sc.portrait)} />
            </div>
          )}
          <div style={{ position: 'absolute', left: sc.portrait ? 230 : 40, bottom: 28, right: 40 }}>
            {sc.speaker && <div class="label" style={{ color: 'var(--ember-2)' }}>{sc.speaker}</div>}
            <div class="h1" style={{ fontSize: 52 }}>{sc.title}</div>
          </div>
          {v.roll && (v.phase === 'rolling' || v.phase === 'result') && (
            <div style={{ position: 'absolute', right: 36, top: 26, padding: '18px 26px', background: 'rgba(8,6,4,0.85)', border: '1px solid var(--line-2)' }}>
              <RollDisplay roll={v.roll} rolling={v.phase === 'rolling'} label={`${STAT_INFO[v.choice!.stat!].label} · ${bestFor(s, v.choice!.stat!).name}`} />
            </div>
          )}
        </div>
        <div class="scroll" style={{ padding: '22px 44px 30px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {v.phase !== 'result' && <div class="narr">{sc.text}</div>}
          {v.phase === 'choose' && (
            <div class="col" style={{ gap: 10, marginTop: 6 }}>
              {sc.choices.map((c, i) => {
                const mod = c.stat ? moveBonus(s, c.stat) + (c.bonus ?? 0) : 0;
                const lacking = (c.cost?.barter && s.barter < c.cost.barter) || (c.cost?.rations && s.rations < c.cost.rations);
                const disabled = !!c.disabled || !!lacking;
                return (
                  <button key={i} class="btn ghost block" disabled={disabled} onClick={() => chooseOption(c)}
                    style={{ justifyContent: 'space-between', minHeight: 60, textTransform: 'none', letterSpacing: '0.02em', fontFamily: 'var(--body)', fontWeight: 600, fontSize: 22, padding: '0 22px' }}>
                    <span><span class="ember" style={{ marginRight: 12, fontFamily: 'var(--display)' }}>{i + 1}.</span>{c.label}{c.hint && <span class="chip ember" style={{ marginLeft: 12 }}>{c.hint}</span>}</span>
                    {c.stat && (
                      <span class="row" style={{ gap: 10 }}>
                        <span class="chip">Roll {STAT_INFO[c.stat].label} {fmtMod(mod)}</span>
                        <span class="chip good">{Math.round(chanceAtLeast(mod, 7) * 100)}% hit</span>
                        <span class="chip ember">{Math.round(chanceAtLeast(mod, 10) * 100)}% strong</span>
                      </span>
                    )}
                    {c.disabled && <span class="chip bad">{c.disabled}</span>}
                    {lacking && !c.disabled && <span class="chip bad">Can't afford</span>}
                  </button>
                );
              })}
            </div>
          )}
          {v.phase === 'rolling' && <div class="label" style={{ animation: 'pulse 0.8s infinite' }}>The dice are rolling…</div>}
          {v.phase === 'result' && v.result && (
            <>
              {v.result.text && <div class="narr rise">{v.result.text}</div>}
              {!!v.result.effects?.length && (
                <div class="row wrap rise" style={{ gap: 8 }}>
                  {v.result.effects.filter(Boolean).map((e, i) => <span key={i} class={`chip ${/^-|harm|lost|failed|-\d/.test(e) ? 'bad' : 'good'}`}>{e}</span>)}
                </div>
              )}
              <div class="row" style={{ justifyContent: 'flex-end' }}>
                <Btn variant="primary" onClick={continueScene}>{v.result.fight || v.result.army ? 'To Battle!' : 'Continue'}</Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
