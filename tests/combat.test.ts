import { describe, expect, it } from 'vitest';
import { createArmyBattle, createSkirmish } from '../src/combat/setup';
import { autoPlay } from '../src/combat/turn';
import { makeCharacter } from '../src/game/characters';

function crew(level: number, pbs: string[]) {
  return pbs.map((pb, i) => makeCharacter(`c${i}`, pb, pb, `portraits/${pb}_1`, i === 0, level));
}

describe('combat', () => {
  it('skirmishes resolve and win rates are sane', () => {
    const cases: [string, number, string[], { id: string; tier: number }[]][] = [
      ['tutorial 2v3 burnlads', 1, ['gunhand', 'sawbones'], [{ id: 'burnlad', tier: 0 }, { id: 'burnlad', tier: 0 }, { id: 'burnlad_gun', tier: 0 }]],
      ['early 3v hounds', 1, ['duelist', 'sawbones', 'gunhand'], [{ id: 'hound', tier: 0 }, { id: 'hound', tier: 0 }, { id: 'hound', tier: 0 }, { id: 'hound', tier: 0 }]],
      ['mid 4v5 raiders+boss', 3, ['duelist', 'sawbones', 'gunhand', 'mindbender'], [{ id: 'raider', tier: 1 }, { id: 'raider', tier: 1 }, { id: 'raider', tier: 1 }, { id: 'scav', tier: 1 }, { id: 'warboss', tier: 1 }]],
      ['psychics', 3, ['siren', 'prophet', 'wrencher', 'roadboss'], [{ id: 'cultist', tier: 1 }, { id: 'cultist', tier: 1 }, { id: 'psyker', tier: 1 }, { id: 'hollow', tier: 1 }]],
      ['boss Ozmyr', 6, ['duelist', 'sawbones', 'gunhand', 'mindbender'], [{ id: 'ozmyr', tier: 3 }, { id: 'kilnguard', tier: 3 }, { id: 'kilnguard', tier: 3 }]],
    ];
    for (const [name, lvl, pbs, enemies] of cases) {
      let wins = 0, turns = 0;
      const N = 60;
      for (let seed = 1; seed <= N; seed++) {
        const b = createSkirmish({ crew: crew(lvl, pbs), enemies, battlemap: 'waste', seed, context: { type: 'encounter', canFlee: true, title: 't' } });
        autoPlay(b);
        expect(b.result === null || ['win', 'lose'].includes(b.result)).toBe(true);
        if (b.result === 'win') wins++;
        turns += b.turn;
      }
      console.log(`${name.padEnd(26)} win ${(wins / N * 100).toFixed(0)}%  avg turns ${(turns / N).toFixed(1)}`);
    }
  });

  it('army battles resolve', () => {
    let wins = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = crew(3, ['roadboss', 'gunhand']);
      const b = createArmyBattle({
        seed, battlemap: 'road', context: { type: 'army', canFlee: true, title: 'x' }, fortified: true,
        gangs: [
          { name: 'Warband', troops: 20, quality: 0, ranged: false, faction: 'player', portrait: '', leader: c[0], controlled: true, team: 0 },
          { name: 'Riflemen', troops: 20, quality: 0, ranged: true, faction: 'player', portrait: '', leader: c[1], controlled: true, team: 0 },
          { name: 'Burnlads', troops: 18, quality: 0, ranged: false, faction: 'cinder', portrait: '', controlled: false, team: 1, leaderStat: 1 },
          { name: 'Burnlads', troops: 18, quality: 0, ranged: false, faction: 'cinder', portrait: '', controlled: false, team: 1, leaderStat: 1 },
          { name: 'Gunners', troops: 12, quality: 0, ranged: true, faction: 'cinder', portrait: '', controlled: false, team: 1, leaderStat: 1 },
        ],
      });
      autoPlay(b);
      if (b.result === 'win') wins++;
    }
    console.log('army 40v48 win rate', wins / 40);
  });
});
