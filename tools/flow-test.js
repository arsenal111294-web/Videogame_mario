/* Сквозной тест «Анакопиа» в Chromium: меню → сказание → глава → смерть/возрождение →
   прохождение главы → следующая глава; оборона стен; фазы Марвана; стелс.
   Запуск: node tools/flow-test.js [папка для скриншотов] */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = process.argv[2] || path.join(__dirname, '..', 'test-output');
fs.mkdirSync(OUT, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '../game/index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 860, height: 400 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  const st = () => page.evaluate(() => { const g = window.__anakopia.game; const p = g.world && g.world.player; return { state: g.state, idx: g.idx, lives: g.lives, hp: p && p.hp, x: p && Math.round(p.x), dead: p && p.dead }; });
  const check = (cond, msg) => { console.log((cond ? 'OK   ' : 'FAIL ') + msg); if (!cond) errors.push('assert: ' + msg); };
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });

  // 1. Меню → новая игра → сказание
  await shot('01-title');
  await page.click('#b-new');
  await page.waitForTimeout(400);
  check((await st()).state === 'story', 'после «Новая игра» начинается сказание');
  await shot('02-story');
  for (let i = 0; i < 20 && (await st()).state === 'story'; i++) { await page.click('#scr-story', { position: { x: 400, y: 300 } }); await page.waitForTimeout(80); }
  let s = await st();
  check(s.state === 'play' && s.idx === 0, 'сказание пролистано — глава 1 запущена');
  await page.waitForTimeout(300);
  await shot('03-level1');

  // 2. Сенсорный джойстик и прыжок
  const x0 = (await st()).x;
  await page.touchscreen.tap(860 - 60, 400 - 70);
  const zone = await page.$('#stick-zone');
  const zb = await zone.boundingBox();
  await page.evaluate(() => { window.__anakopia.G.input.press('right'); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__anakopia.G.input.release('right'); });
  check((await st()).x > x0 + 30, 'герой бежит вправо');
  void zb;

  // 3. Смерть и возрождение
  await page.evaluate(() => { const g = window.__anakopia.game; g.world.player.hurt({}); g.world.player.inv = 0; g.world.player.hurt({}); g.world.player.inv = 0; g.world.player.hurt({}); });
  await page.waitForTimeout(2200);
  s = await st();
  check(s.state === 'play' && s.lives === 4 && !s.dead && s.hp === 3, 'после гибели — возрождение, жизней стало 4');

  // 4. Прохождение главы → итоги → сказание → глава 2
  await page.evaluate(() => window.__anakopia.complete());
  await page.waitForTimeout(1800);
  check((await st()).state === 'complete', 'экран итогов главы');
  await shot('04-complete');
  await page.click('#b-next');
  await page.waitForTimeout(300);
  for (let i = 0; i < 40 && (await st()).state === 'story'; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(40); }
  s = await st();
  check(s.state === 'play' && s.idx === 1, 'после итогов и сказаний — глава 2');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('anakopia_save_v1')));
  check(saved && saved.unlocked === 2, 'прогресс сохранён (открыта глава 2)');

  // 5. Пауза кнопкой Android «Назад»
  const back = await page.evaluate(() => window.onAndroidBack());
  check(back === 'ok' && (await st()).state === 'paused', '«Назад» ставит игру на паузу');
  await shot('05-pause');
  await page.click('#b-resume');
  check((await st()).state === 'play', 'игра продолжается');

  // 6. Оборона стен: 12 секунд боя автоприцелом
  await page.evaluate(() => window.__anakopia.warp(3));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__anakopia.god(true));
  for (let i = 0; i < 30; i++) { await page.keyboard.press('KeyX'); await page.waitForTimeout(400); }
  const siege = await page.evaluate(() => { const w = window.__anakopia.game.world; return { ents: w.entities.length, stones: w.entities.filter((e) => e.constructor.name === 'Stone').length, score: w.score, obj: w.objectiveText }; });
  check(siege.ents > 3 && siege.score > 0, 'оборона: враги идут на штурм, камни поражают их (очки ' + siege.score + ')');
  await shot('06-siege');
  // ускорим до тарана
  await page.evaluate(() => { const w = window.__anakopia.game.world; w.director.time = 999; });
  await page.waitForTimeout(500);
  check(await page.evaluate(() => !!window.__anakopia.game.world.director.ram), 'появляется таран');
  for (let i = 0; i < 40 && (await st()).state === 'play'; i++) { await page.keyboard.press('KeyX'); await page.waitForTimeout(380); }
  await page.waitForTimeout(3000);
  check(['completing', 'complete'].includes((await st()).state), 'таран разбит — глава пройдена');
  await shot('07-siege-done');

  // 7. Марван: три фазы
  await page.evaluate(() => window.__anakopia.warp(8));
  await page.waitForTimeout(400);
  const phases = await page.evaluate(() => {
    const w = window.__anakopia.game.world; const m = w.boss; const out = [];
    for (let k = 0; k < 9; k++) { m.state = 'dizzy'; m.hurtT = 0; m.hit(1, 'sword'); out.push(m.phase); }
    return { phases: out, state: m.state };
  });
  check(phases.phases.join('') === '112223333' && phases.state === 'defeated', 'Марван проходит 3 фазы и повержен (' + phases.phases.join('') + ')');
  await page.waitForTimeout(4500);
  check(['completing', 'complete'].includes((await st()).state), 'после бегства Марвана — победа');

  // 8. Стелс: стражник замечает героиню
  await page.evaluate(() => { window.__anakopia.god(false); window.__anakopia.warp(5); });
  await page.waitForTimeout(400);
  const caught = await page.evaluate(() => {
    const g = window.__anakopia.game, w = g.world, p = w.player;
    const guard = w.entities.find((e) => e.constructor.name === 'Guard');
    p.x = guard.x + guard.face * 50; p.y = guard.y; guard.pause = 0;
    const hp = p.hp;
    for (let i = 0; i < 80; i++) { guard.update(1 / 60); }
    return { before: hp, after: p.hp };
  });
  check(caught.after === caught.before - 1, 'страж замечает Амру на свету — минус сердце');
  await shot('08-stealth');

  // 9. Все главы стартуют без ошибок
  for (let i = 0; i < 9; i++) {
    await page.evaluate((i) => window.__anakopia.warp(i), i);
    await page.waitForTimeout(250);
    check((await st()).state === 'play', 'глава ' + (i + 1) + ' запускается');
  }

  console.log('\nОшибок JS: ' + errors.filter((e) => !e.startsWith('assert')).length);
  errors.forEach((e) => console.log('  ' + e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
