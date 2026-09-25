import { ITEMS, type ItemDef } from '../data/items';
import { STAT_INFO } from '../engine/dice';

const TAG_TEXT: Record<string, string> = {
  messy: 'Messy: strong hits deal +1 harm', ap: 'Armor-piercing', area: 'Area: also hits adjacent', close: 'Close: +1 harm within 2 tiles',
  far: 'Far: no long-range penalty, -1 to hit adjacent', burn: 'Burn: sets targets burning', reach: 'Reach: strikes 2 tiles away',
  quick: 'Quick: +1 to hit', heavy: 'Heavy: -1 to hit', burst: 'Burst: attacks twice', loud: 'Loud',
};

export function itemLine(it: ItemDef): string {
  if (it.weapon) {
    const w = it.weapon;
    return `${w.harm} harm · ${w.range <= 1 ? 'melee' : w.tags.includes('reach') ? 'reach 2' : `range ${w.range}`} · ${STAT_INFO[w.stat].label}${w.tags.filter((t) => t !== 'loud').length ? ' · ' + w.tags.filter((t) => t !== 'loud').join(', ') : ''}`;
  }
  if (it.armor) {
    const a = it.armor;
    const parts = [`Armor ${a.armor}`];
    if (a.move) parts.push(`${a.move} move`);
    if (a.hp) parts.push(`+${a.hp} max harm`);
    if (a.bonus) for (const [k, v] of Object.entries(a.bonus)) parts.push(`+${v} ${k}`);
    return parts.join(' · ');
  }
  if (it.kind === 'consumable') return 'Consumable';
  if (it.kind === 'quest') return 'Quest item';
  return 'Trinket';
}

export function ItemTip({ id }: { id: string }) {
  const it = ITEMS[id];
  return (
    <div>
      <b style={{ fontSize: 20 }}>{it.name}</b>
      <div class="ember tiny ui" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>{itemLine(it)}</div>
      <div style={{ marginTop: 6 }}>{it.desc}</div>
      {it.weapon && it.weapon.tags.filter((t) => t !== 'loud').map((t) => <div key={t} class="tiny dim">• {TAG_TEXT[t]}</div>)}
    </div>
  );
}
