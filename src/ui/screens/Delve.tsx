import { img } from '../../engine/assets';
import { DELVES } from '../../game/delve';
import { Btn } from '../components/common';
import { CrewStrip, Hud } from '../components/Hud';
import { delveNext, leaveDelve, useStore } from '../store';

const ROOM_INFO = {
  fight: { icon: 'abilities/melee', label: 'Hostiles', text: 'Movement in the dark ahead. Weapons ready.' },
  trap: { icon: 'abilities/pipebomb', label: 'Danger', text: 'Something about this passage feels wrong.' },
  loot: { icon: 'items/barter', label: 'Cache', text: 'Undisturbed rooms. Something might be left.' },
  shrine: { icon: 'abilities/maelstrom', label: 'Shrine', text: 'Violet light flickers beyond the doorway.' },
  rest: { icon: 'abilities/patch', label: 'Shelter', text: 'A room with a door that still locks.' },
  boss: { icon: 'abilities/warcry', label: 'The Deep', text: 'Whatever rules this place waits at the bottom.' },
} as const;

export function DelveScreen() {
  const { game: s } = useStore();
  const d = s?.delve;
  if (!s || !d) return null;
  const def = DELVES[d.id];
  const room = d.rooms[d.room];
  const info = ROOM_INFO[room.type];
  const last = d.room === d.rooms.length - 1;
  return (
    <div class="screen">
      <div class="bg-cover" key={d.room} style={{ backgroundImage: `url(${img(room.image)})`, animation: 'kenburns 30s ease-out both' }} />
      <div class="screen" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.5), rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.85))' }} />
      <Hud />
      <div style={{ position: 'absolute', left: 60, top: 110, width: 900, zIndex: 20 }}>
        <div class="label psy" style={{ color: 'var(--psy)' }}>Ruins · {def.name}</div>
        <div class="h1" style={{ fontSize: 60 }}>{def.name}</div>
        <div class="type dim" style={{ marginTop: 8 }}>{def.desc}</div>
      </div>
      <div class="row" style={{ position: 'absolute', left: 60, right: 60, top: 330, zIndex: 20, gap: 0, justifyContent: 'center' }}>
        {d.rooms.map((r, i) => {
          const inf = ROOM_INFO[r.type];
          const state = r.done ? 'done' : i === d.room ? 'cur' : i < d.room ? 'done' : 'locked';
          return (
            <div key={i} class="row" style={{ gap: 0 }}>
              {i > 0 && <div style={{ width: 90, height: 4, background: i <= d.room ? 'var(--ember)' : 'rgba(255,255,255,0.15)' }} />}
              <div class={`room-node ${state}`}>
                <img src={img(state === 'locked' && r.type !== 'boss' ? 'abilities/trick' : inf.icon)} />
                <div class="tiny ui">{state === 'locked' && r.type !== 'boss' ? '???' : inf.label}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div class="panel rise" key={`${d.room}-${room.done}`} style={{ position: 'absolute', left: '50%', top: 520, transform: 'translateX(-50%)', width: 820, padding: '26px 34px', zIndex: 20 }}>
        <div class="label">Chamber {d.room + 1} of {d.rooms.length}</div>
        <div class="h2" style={{ margin: '4px 0 10px' }}>{room.done ? 'Cleared' : info.label}</div>
        <div class="narr">{room.done ? (last ? 'The ruins are silent.' : 'The way deeper lies open.') : info.text}</div>
        <div class="row" style={{ gap: 12, marginTop: 20 }}>
          <Btn variant="ghost" onClick={leaveDelve} tip="Leave the ruins. Progress is lost.">Retreat to the surface</Btn>
          <span class="grow" />
          {!room.done && <Btn variant={room.type === 'boss' ? 'danger' : 'primary'} size="lg" onClick={delveNext}>{room.type === 'fight' || room.type === 'boss' ? 'Engage' : 'Enter'}</Btn>}
          {room.done && !last && <Btn variant="primary" size="lg" onClick={delveNext}>Press deeper</Btn>}
        </div>
      </div>
      <CrewStrip />
    </div>
  );
}
