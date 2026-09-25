// End-to-end UI playtest: drives the real game in headless Chromium and screenshots key moments.
// Usage: npx vite preview --port 4173 & node tools/playtest.mjs
import { chromium } from 'playwright';
const OUT = process.env.SHOTS ?? '/tmp/claude-0/shots/play';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
let n = 0;
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}_${name}.png` }); };
const G = () => page.evaluate(() => { const g = window.__G; return { screen: g.ui.screen, scene: g.ui.scene?.scene.id ?? null, phase: g.ui.scene?.phase ?? null, battle: !!g.ui.battle, result: g.ui.battle?.battle.result ?? null, loc: g.game?.location, travel: !!g.game?.travel, traveling: g.ui.traveling, day: g.game?.day, stage: g.game?.quest.stage, ended: g.game?.ended }; });

async function resolveBattle() {
  await page.evaluate(() => window.__api.autoBattle());
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(500);
    const cont = page.getByRole('button', { name: 'Continue' });
    if (await cont.count()) { await shot('battle_result'); await cont.first().click(); return; }
  }
  throw new Error('battle never finished');
}

async function handleScene() {
  const st = await G();
  if (!st.scene) return false;
  if (st.phase === 'choose') {
    const btns = page.locator('.modal-back .btn.ghost.block:not([disabled])');
    await btns.first().click();
    await page.waitForTimeout(1900);
  }
  const toBattle = page.getByRole('button', { name: 'To Battle!' });
  if (await toBattle.count()) { await toBattle.click(); await page.waitForTimeout(1500); await resolveBattle(); return true; }
  const cont = page.locator('.modal-back').getByRole('button', { name: 'Continue' });
  if (await cont.count()) await cont.first().click();
  await page.waitForTimeout(500);
  return true;
}

await page.goto('http://localhost:4173/');
await page.waitForTimeout(1200);
await page.mouse.click(960, 540);
await page.waitForTimeout(900);
await page.getByText('New Game').click();
await page.waitForTimeout(500);
await page.locator('.panel.plain').nth(4).click(); // Prophet
await page.waitForTimeout(300);
await page.getByText('Walk Into the Burnlands').click();
await page.waitForTimeout(500);
await page.getByText('Skip').click();
await page.waitForTimeout(800);
await page.getByText('Draw your weapon').click();
await page.waitForTimeout(600);
await page.getByText('To Battle!').click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Got it' }).click();
await resolveBattle();
await page.waitForTimeout(800);
await shot('after_raid');
await handleScene(); // Nell
await page.waitForTimeout(500);
const gotIt = page.getByRole('button', { name: 'Got it' });
if (await gotIt.count()) await gotIt.click();
console.log('after tutorial', await G());
await shot('world_after_tutorial');
// travel to Ember Road, handling encounters along the way
await page.evaluate(() => window.__api.travelTo('emberroad'));
for (let i = 0; i < 80; i++) {
  await page.waitForTimeout(600);
  const st = await G();
  if (st.scene) { await shot('road_' + st.scene); await handleScene(); continue; }
  if (st.screen === 'world' && !st.travel && st.loc === 'emberroad') break;
  if (st.screen === 'world' && st.travel && !st.traveling) await page.evaluate(() => window.__api.flow()) , await page.getByRole('button', { name: /Continue|March/ }).first().click().catch(() => {});
}
console.log('arrived?', await G());
await shot('arrived_ember');
await page.evaluate(() => window.__api.enterSettlement());
await page.waitForTimeout(800);
const gi2 = page.getByRole('button', { name: 'Got it' });
if (await gi2.count()) await gi2.click();
await page.evaluate(() => window.__api.setTab('tower'));
await page.waitForTimeout(800);
await shot('tower');
await page.getByText('Climb the tower').click();
await page.waitForTimeout(800);
await shot('voice');
await handleScene();
await page.waitForTimeout(500);
console.log('after tower', await G());
await page.evaluate(() => window.__api.openPanel('journal'));
await page.waitForTimeout(700);
await shot('journal');
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
