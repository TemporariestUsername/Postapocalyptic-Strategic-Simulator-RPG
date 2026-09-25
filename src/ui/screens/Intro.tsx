import { useEffect, useState } from 'preact/hooks';
import { audio } from '../../engine/audio';
import { img } from '../../engine/assets';
import { INTRO_SLIDES } from '../../data/story';
import { Btn, Embers, Typewriter } from '../components/common';
import { G, flow, goto } from '../store';

export function IntroScreen() {
  const [i, setI] = useState(0);
  const slide = INTRO_SLIDES[i];
  const finish = () => {
    goto('world');
    if (G.game) G.ui.selected = G.game.location;
    flow();
  };
  const next = () => {
    audio.sfx('page');
    if (i < INTRO_SLIDES.length - 1) setI(i + 1);
    else finish();
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') next(); if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [i]);
  return (
    <div class="screen" style={{ background: '#000' }} onClick={next}>
      {INTRO_SLIDES.map((s, k) => (
        <div key={k} class="bg-cover" style={{ backgroundImage: `url(${img(s.image)})`, opacity: k === i ? 1 : 0, transition: 'opacity 1.4s', animation: k === i ? 'kenburns 18s ease-out both' : undefined }} />
      ))}
      <div class="screen" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.92) 82%)' }} />
      <Embers count={50} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 250, padding: '0 260px', zIndex: 7, display: 'flex', alignItems: 'center' }}>
        <div class="narr" style={{ fontSize: 30, lineHeight: 1.6, textShadow: '0 2px 8px #000' }} key={i}>
          <Typewriter text={slide.text} speed={22} />
        </div>
      </div>
      <div class="row" style={{ position: 'absolute', right: 40, bottom: 30, zIndex: 8, gap: 12 }} onClick={(e) => e.stopPropagation()}>
        <div class="label" style={{ marginRight: 12 }}>{i + 1} / {INTRO_SLIDES.length}</div>
        <Btn variant="ghost" size="sm" onClick={finish}>Skip</Btn>
        <Btn variant="primary" size="sm" onClick={next}>{i < INTRO_SLIDES.length - 1 ? 'Next' : 'Begin'}</Btn>
      </div>
    </div>
  );
}
