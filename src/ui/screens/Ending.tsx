import { useEffect } from 'preact/hooks';
import { audio } from '../../engine/audio';
import { img } from '../../engine/assets';
import { Btn, Embers } from '../components/common';
import { regionsOf, fmtDate } from '../../game/util';
import { G, goto, useStore } from '../store';

export function EndingScreen() {
  const { game: s } = useStore();
  if (!s) return null;
  const kind = s.ended ?? 'death';
  const pc = s.crew[0];
  const warlord = !!s.playerFaction;
  useEffect(() => {
    audio.music(kind === 'victory' ? 'victory' : 'defeat');
  }, []);
  const image = kind === 'victory' ? (warlord ? 'story/warlord_end' : 'story/victory') : kind === 'death' ? 'story/death' : 'story/defeat';
  const title = kind === 'victory' ? 'The Fires Go Out' : kind === 'death' ? 'Buried by the Road' : 'The Great Burn';
  const text = kind === 'victory'
    ? `Ozmyr the Burnt King is dead, and the Kiln falls silent for the first time in a generation. The Maelstrom still howls beneath the world — it always will — but tonight nobody is feeding it. ${warlord ? `From ${s.playerFaction!.name}, ${pc.name} rules ${regionsOf(s, 'player').length} holds, a warlord among warlords. The Burnlands will remember that name.` : s.pledged ? `${pc.name} returns to their warlord a hero, and the war for the basin goes on — but it is a war among the living.` : `${pc.name} walks away from the Kiln as they came: a drifter, with a weapon and a name. Every hold in the basin knows that name now.`}`
    : kind === 'death'
      ? `${pc.name} fell on ${fmtDate(s.day)}, somewhere in the Burnlands. The crew buried them by the road with their boots on. The Burnt King never learned their name.`
      : s.flags.defeatReason === 'conquest'
        ? 'Hold by hold, the Cinder Throne swallowed the basin. With no one left to stand against him, the Burnt King woke the Kiln at his leisure. The sky turned violet, and then it turned to fire.'
        : 'The countdown ran out. Deep beneath the Kiln the dead reactor woke, and the Maelstrom came up through the ground like a tide of screaming light. The Burnlands burned again. This time, nothing was left to name them.';
  return (
    <div class="screen" style={{ background: '#000' }}>
      <div class="bg-cover" style={{ backgroundImage: `url(${img(image)})`, animation: 'kenburns 40s ease-out both' }} />
      <div class="screen" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.92))' }} />
      <Embers count={kind === 'victory' ? 50 : 100} color={kind === 'victory' ? '255,200,120' : '255,110,50'} />
      <div class="col fade" style={{ position: 'absolute', left: 200, right: 200, bottom: 90, gap: 18, zIndex: 8 }}>
        <div class="label" style={{ color: kind === 'victory' ? 'var(--good)' : '#ff6a55' }}>{kind === 'victory' ? 'Victory' : 'The End'}</div>
        <div class="h1" style={{ fontSize: 84 }}>{title}</div>
        <div class="narr" style={{ fontSize: 26, maxWidth: 1400 }}>{text}</div>
        <div class="row wrap" style={{ gap: 10 }}>
          <span class="chip">{Math.floor(s.day / 360)} years, {Math.floor((s.day % 360) / 30)} months</span>
          <span class="chip">Battles won {s.stats.wins}</span>
          <span class="chip">Kills {s.stats.kills}</span>
          <span class="chip">Jobs {s.stats.jobsDone}</span>
          <span class="chip">Holds taken {s.stats.regionsTaken}</span>
          <span class="chip">Ruins cleared {s.stats.delves}</span>
          <span class="chip">Level {pc.level} {pc.name}</span>
        </div>
        <div class="row" style={{ gap: 14, marginTop: 10 }}>
          <Btn variant="primary" size="lg" onClick={() => { G.game = null; goto('title'); }}>Return to Title</Btn>
        </div>
      </div>
    </div>
  );
}
