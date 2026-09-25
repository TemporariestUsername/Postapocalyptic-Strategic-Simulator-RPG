import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
const T = (x, y) => [232 + 104 * x + 52, 92 + 104 * y + 52];
await page.goto('http://localhost:4173/');
await page.waitForTimeout(1500);
await page.mouse.click(960, 540);
await page.waitForTimeout(1200);
await page.getByText('New Game').click();
await page.waitForTimeout(800);
await page.getByText('Walk Into the Burnlands').click();
await page.waitForTimeout(800);
await page.getByText('Skip').click();
await page.waitForTimeout(1200);
await page.getByText('Draw your weapon').click();
await page.waitForTimeout(800);
await page.getByText('To Battle!').click();
await page.waitForTimeout(2500);
for (let turn = 0; turn < 12; turn++) {
  // let the game auto-select; press keys: move toward enemies by clicking a far blue tile
  const state = await page.evaluate(() => window.__battleDebug?.());
  if (!state) break;
  if (state.result) break;
  for (const u of state.mine) {
    await page.mouse.click(...T(u.x, u.y));
    await page.waitForTimeout(250);
    const st2 = await page.evaluate(() => window.__battleDebug?.());
    const me = st2.mine.find((m) => m.id === u.id);
    if (!me) continue;
    if (st2.targets.length) {
      const t = st2.targets[0];
      await page.mouse.click(...T(t.x, t.y));
      await page.waitForTimeout(2200);
      continue;
    }
    if (st2.moves.length) {
      const best = st2.moves.sort((a, b) => b[0] - a[0])[0];
      await page.mouse.click(...T(best[0], best[1]));
      await page.waitForTimeout(1500);
      const st3 = await page.evaluate(() => window.__battleDebug?.());
      if (st3.targets.length) { const t = st3.targets[0]; await page.mouse.click(...T(t.x, t.y)); await page.waitForTimeout(2200); }
    }
  }
  if (turn === 1) await page.screenshot({ path: '/tmp/claude-0/shots/08_battle_mid.png' });
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  if (turn === 1) await page.screenshot({ path: '/tmp/claude-0/shots/09_enemy_turn.png' });
  await page.waitForTimeout(4500);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/claude-0/shots/10_result.png' });
console.log(errors.join('\n'));
await browser.close();
