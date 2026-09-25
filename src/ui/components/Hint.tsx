import type { ComponentChildren } from 'preact';
import { audio } from '../../engine/audio';
import { Btn } from './common';
import { emit, G } from '../store';

export const HINTS: Record<string, { title: string; body: ComponentChildren }> = {
  world: {
    title: 'The Burnlands',
    body: <>Click any region to inspect it. <b>Travel</b> takes days and eats <b>rations</b>; the roads are dangerous. Drag to pan, scroll to zoom. The seven warlords wage war on their own — watch the colored borders shift and the armies march. Your first lead: <b class="ember">the Radio Tower at Ember Road</b>.</>,
  },
  settlement: {
    title: 'Holds & Settlements',
    body: <>Buy rations and gear at the <b>Market</b>, hire crew and sellswords at the <b>Saloon</b>, and take <b>jobs</b> for the local warlord to earn barter and reputation. Capitals have a <b>Warlord's Hall</b>, where you can swear your blade in service.</>,
  },
  battle: {
    title: 'How to Fight',
    body: <>Click a crew member, then a <span style={{ color: '#8ec5ff' }}>blue tile</span> to move or an enemy with a <span class="bad">red ring</span> to attack. Each fighter moves and acts once per turn. <b>Hover an enemy</b> to see your odds. Cover matters: stand next to barrels and wrecks. Moves on the action bar (keys 1–5) are your crew's special powers. Press <span class="kbd">Space</span> to end your turn.</>,
  },
  army: {
    title: 'Army Battles',
    body: <>Each token is a <b>gang</b>; the number is its fighters. Your crew each lead one and can issue a special <b>Order</b>. Bigger gangs hit harder. A gang <b>breaks</b> when it falls to a quarter of its strength, and a host that loses 70% of its fighters routs.</>,
  },
  delve: {
    title: 'Ruins',
    body: <>Push through the chambers one at a time: fights, traps, caches and stranger things. You can retreat to the surface between chambers, but the prize waits in the deepest room.</>,
  },
};

export function Hint({ id }: { id: string }) {
  const s = G.game;
  const h = HINTS[id];
  if (!s || !h || s.flags[`hint:${id}`]) return null;
  const dismiss = () => {
    s.flags[`hint:${id}`] = true;
    audio.sfx('ui_close');
    emit();
  };
  return (
    <div class="panel rise" style={{ position: 'absolute', left: '50%', top: 100, transform: 'translateX(-50%)', width: 820, padding: '18px 26px', zIndex: 150, borderColor: 'rgba(255,179,92,0.5)' }}>
      <div class="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <div class="col grow" style={{ gap: 6 }}>
          <div class="label ember">Field Manual</div>
          <div class="h3">{h.title}</div>
          <div class="small" style={{ lineHeight: 1.5 }}>{h.body}</div>
        </div>
        <Btn size="sm" variant="primary" onClick={dismiss}>Got it</Btn>
      </div>
    </div>
  );
}
