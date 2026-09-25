import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(1200);
await page.mouse.click(960, 540);
await page.waitForTimeout(900);
await page.getByText('New Game').click();
await page.waitForTimeout(500);
await page.getByText('Walk Into the Burnlands').click();
await page.waitForTimeout(500);
await page.getByText('Skip').click();
await page.waitForTimeout(700);
await page.evaluate(() => { const G = window.__G; G.ui.scene = null; G.game.quest.stage = 2; G.game.quest.tape = true; G.game.quest.burnRevealed = true; G.game.pending = []; G.game.warband = 30; G.game.barter = 500; window.__api.emit(); });
await page.waitForTimeout(600);
// army battle: seize Hope's Rest
await page.evaluate(() => { const G = window.__G; window.__api.startArmy({ region: 'deadspan', attacker: 'player', defender: 'dust', playerAttacking: true, allied: 20, enemy: 40 }); });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/claude-0/shots/20_army.png' }); console.log(await page.evaluate(() => { const s = document.getElementById('stage'); const b = s.getBoundingClientRect(); return [s.style.transform, b.x, b.y, b.width, b.height, window.scrollX, window.scrollY, document.documentElement.scrollTop, document.body.scrollTop, document.getElementById('app').scrollTop, document.getElementById('app').scrollLeft]; }));
await page.keyboard.press('Space');
await page.waitForTimeout(6000);
await page.screenshot({ path: '/tmp/claude-0/shots/21_army2.png' });
// hall
await page.evaluate(() => { const G = window.__G; G.ui.battle = null; G.game.location = 'brinetown'; window.__api.goto('settlement'); window.__api.setTab('hall'); });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/claude-0/shots/22_hall.png' });
// delve
await page.evaluate(() => { const G = window.__G; G.ui.tab = null; G.game.location = 'blackglass'; window.__api.enterDelve('blackglass'); });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/claude-0/shots/23_delve.png' });
// encounter scene
await page.evaluate(() => { const G = window.__G; G.game.delve = null; window.__api.goto('world'); G.game.pending.push({ kind: 'encounter', eventId: 'maelstrom', region: 'howling' }); window.__api.flow(); });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/claude-0/shots/24_encounter.png' });
await page.getByText('Open your brain to it').click();
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/claude-0/shots/25_rolling.png' });
await page.waitForTimeout(1600);
await page.screenshot({ path: '/tmp/claude-0/shots/26_result.png' });
// ending
await page.evaluate(() => { const G = window.__G; G.ui.scene = null; G.game.ended = 'victory'; window.__api.goto('ending'); });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/claude-0/shots/27_ending.png' });
console.log(errors.join('\n'));
await browser.close();
