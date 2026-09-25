import { useEffect, useState } from 'preact/hooks';
import { audio } from '../../engine/audio';
import { CORE_IMAGES, img, preloadImages } from '../../engine/assets';
import { latestSave, loadGame } from '../../engine/save';
import { Btn, Embers, Frame } from '../components/common';
import { G, emit, goto, loadState, openPanel, toast } from '../store';

export function BootScreen() {
  const [p, setP] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void preloadImages(CORE_IMAGES, (d, t) => setP(d / t)).then(() => setReady(true));
  }, []);
  const start = () => {
    if (!ready) return;
    audio.unlock();
    goto('title');
  };
  useEffect(() => {
    if (!ready) return;
    const k = () => start();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [ready]);
  return (
    <div class="screen center" style={{ background: '#050403', cursor: ready ? 'pointer' : 'default' }} onClick={start}>
      <Embers count={40} />
      <div class="col" style={{ alignItems: 'center', gap: 36, zIndex: 2 }}>
        <img src={img('key/logo')} style={{ width: 760, filter: 'drop-shadow(0 0 40px rgba(255,100,30,0.35))', opacity: ready ? 1 : 0.5, transition: 'opacity 1s' }} />
        {!ready ? (
          <div class="col" style={{ alignItems: 'center', gap: 12 }}>
            <div class="bar xp" style={{ width: 420, height: 6 }}><i style={{ width: `${p * 100}%` }} /></div>
            <div class="label">Loading the Burnlands…</div>
          </div>
        ) : (
          <div class="display" style={{ fontSize: 26, letterSpacing: '0.35em', color: 'var(--ember-2)', animation: 'pulse 1.6s infinite' }}>Click to begin</div>
        )}
        <div class="tiny faint" style={{ maxWidth: 700, textAlign: 'center', marginTop: 20 }}>Best experienced with sound on, in fullscreen (F11).</div>
      </div>
    </div>
  );
}

export function TitleScreen() {
  const [credits, setCredits] = useState(false);
  const save = latestSave();
  const cont = () => {
    if (!save) return;
    const s = loadGame(save.slot);
    if (!s) return toast('That save could not be loaded', 'bad');
    loadState(s);
  };
  return (
    <div class="screen">
      <div class="bg-cover" style={{ backgroundImage: `url(${img('key/title')})`, animation: 'kenburns 40s ease-in-out infinite alternate' }} />
      <div class="screen" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.85) 100%)' }} />
      <Embers count={90} />
      <img src={img('key/logo')} class="fade" style={{ position: 'absolute', left: '50%', top: 50, width: 980, transform: 'translateX(-50%)', filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.9)) drop-shadow(0 0 60px rgba(255,90,20,0.3))', zIndex: 6 }} />
      <div class="display fade" style={{ position: 'absolute', top: 372, width: '100%', textAlign: 'center', fontSize: 28, letterSpacing: '0.6em', color: 'var(--ink-2)', textShadow: '0 2px 10px #000', zIndex: 6 }}>Warlords of the Maelstrom</div>
      <div class="col rise" style={{ position: 'absolute', left: '50%', bottom: 110, transform: 'translateX(-50%)', width: 460, gap: 14, zIndex: 6 }}>
        {save && <Btn variant="primary" size="lg" block onClick={cont}>Continue</Btn>}
        <Btn variant={save ? '' : 'primary'} size="lg" block onClick={() => goto('creation')}>New Game</Btn>
        <Btn block onClick={() => { G.ui.saveMode = 'load'; openPanel('saveload'); }}>Load Game</Btn>
        <div class="row" style={{ gap: 14 }}>
          <Btn class="grow" onClick={() => openPanel('settings')}>Settings</Btn>
          <Btn class="grow" onClick={() => setCredits(true)}>Credits</Btn>
        </div>
      </div>
      {save && <div class="tiny dim" style={{ position: 'absolute', left: '50%', bottom: 76, transform: 'translateX(-50%)', zIndex: 6 }}>Last played: {save.name}, level {save.level} · {new Date(save.savedAt).toLocaleString()}</div>}
      <div class="tiny faint" style={{ position: 'absolute', right: 26, bottom: 18, zIndex: 6 }}>v1.0 · A wasteland warlord saga</div>
      {credits && <Credits onClose={() => { setCredits(false); emit(); }} />}
    </div>
  );
}

function Credits({ onClose }: { onClose: () => void }) {
  return (
    <Frame title="Credits" onClose={onClose} width={1000} height={720}>
      <div class="scroll" style={{ padding: '30px 50px', height: '100%', fontSize: 20 }}>
        <p class="narr">BURNLANDS is a strategic wasteland RPG. Its setting pays homage to <i>Apocalypse World</i> by D. Vincent Baker &amp; Meguey Baker, and its living world takes loose inspiration from Koei&apos;s <i>Inindo: Way of the Ninja</i>.</p>
        <div class="divider" />
        <div class="h3 ember">Design, code &amp; writing</div>
        <p>Claude (Anthropic), commissioned as a from-scratch production.</p>
        <div class="h3 ember">Art</div>
        <p>All paintings, portraits, maps, props and icons were generated for this game with Google Gemini image models (via OpenRouter), directed from a written art bible (<code>tools/manifest.py</code>).</p>
        <div class="h3 ember">Music</div>
        <p>Original soundtrack generated with Google Lyria 3 (via OpenRouter).</p>
        <div class="h3 ember">Sound effects</div>
        <p>Kenney (kenney.nl) — Impact, Interface, RPG, UI, Sci-Fi and Casino audio packs, CC0.<br />"The Free Firearm Sound Library" and "Gunshot sounds" from OpenGameArt.org, CC0.</p>
        <div class="h3 ember">Type</div>
        <p>Oswald, Barlow, Barlow Condensed and Special Elite (SIL Open Font License), via Fontsource.</p>
      </div>
    </Frame>
  );
}
