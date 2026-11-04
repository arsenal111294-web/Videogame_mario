/* Скриншоты для README: node tools/screenshots.js */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '..', 'docs', 'screens');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 860, height: 400 }, deviceScaleFactor: 2, hasTouch: true });
  await page.goto('file://' + path.resolve(__dirname, '../game/index.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'title.png') });
  const shots = [[0, 'village', 2600, 8], [3, 'siege', 9000, 0], [4, 'cave', 2600, 6], [5, 'camp', 2600, 3], [6, 'horse', 3000, 0], [8, 'marwan', 3500, 0]];
  for (const [i, name, wait, run] of shots) {
    await page.evaluate((i) => { window.__anakopia.warp(i); window.__anakopia.god(true); }, i);
    if (run) { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(run * 100); await page.keyboard.up('ArrowRight'); }
    if (i === 3) for (let k = 0; k < 18; k++) { await page.keyboard.press('KeyX'); await page.waitForTimeout(450); }
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
  }
  await b.close();
  console.log('screens in', OUT);
})();
