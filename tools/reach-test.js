/* Проверка проходимости уровней «Анакопиа» на настоящей физике героя.
   Запуск: node tools/reach-test.js [номера глав через запятую]
   Для каждой главы перебирает прыжки/шаги/лазание из каждой достижимой точки (поиск в ширину)
   и сообщает, достижимы ли выход, струны апхьарцы, камнемёты и канаты. */
const { chromium } = require('playwright');
const path = require('path');

const URL = 'file://' + path.resolve(__dirname, '../game/index.html');

function pageReach(levelIdx) {
  const { game, G } = window.__anakopia;
  const E = G.ent, T = G.T, I = G.input;
  const def = Object.assign({}, G.LEVELS[levelIdx]);
  if (def.mode === 'siege') return { id: def.id, skipped: 'оборона — без карты прыжков' };
  game.buildWorld(def);
  const w = game.world;
  const targets = [];
  for (const e of w.entities) {
    if (e instanceof E.StringItem) targets.push({ name: 'струна ' + (e.idx + 1), box: { x: e.x, y: e.y, w: e.w, h: e.h } });
    else if (e instanceof E.Exit) targets.push({ name: 'выход', box: { x: e.x + 8, y: e.y, w: 16, h: e.h } });
    else if (e instanceof E.Catapult) targets.push({ name: 'камнемёт', box: { x: e.x, y: e.y, w: e.w, h: e.h } });
    else if (e instanceof E.Rope) targets.push({ name: 'канат', box: { x: e.x - 14, y: e.y, w: e.w + 28, h: e.h } });
    else if (e instanceof E.Checkpoint) targets.push({ name: 'маяк', box: { x: e.x, y: e.y, w: e.w, h: e.h } });
  }
  const keep = w.entities.filter((e) => e.platform || e instanceof E.Spring);
  w.entities = keep.slice();
  const snap = keep.map((e) => ({ e, s: { x: e.x, y: e.y, t: e.t, state: e.state, timer: e.timer, vy: e.vy, platform: e.platform, pressT: e.pressT } }));
  const hasMoving = keep.some((e) => e instanceof E.MovingPlatform);
  const start = w.startPos;
  const found = new Set();
  const visited = new Map();
  const queue = [];
  let sims = 0;

  function reset(phase) {
    for (const { e, s } of snap) { Object.assign(e, s); if (e instanceof E.MovingPlatform) { e.t = phase; e.update(0); } }
  }
  function mkPlayer(x, y) {
    const p = new E.Player(x, y, def.hero, { horse: def.horse });
    p.world = w; w.player = p;
    p.hurt = function () { this.bad = true; };
    p.die = function () { this.bad = true; };
    p.bumpTile = function () {};
    p.onGround = true;
    return p;
  }
  function key(p, phase) { return Math.round(p.x / 8) + ',' + Math.round(p.y / 6) + (phase !== null ? ',' + Math.round(phase * 4) : '') + (def.horse ? ',' + Math.round(p.vx / 30) : ''); }

  /* Один «макрос» управления: функция (кадр, игрок) → нажатые кнопки */
  function run(node, prog, maxF) {
    sims++;
    reset(node.phase || 0);
    const p = mkPlayer(node.x, node.y);
    if (node.vx) p.vx = node.vx;
    p.update(1 / 60); // осесть на опору
    let air = 0, prevJump = false;
    for (let f = 0; f < maxF; f++) {
      const inp = prog(f, p) || {};
      if (inp === 'stop') break;
      I.down = { left: !!inp.left, right: !!inp.right, up: !!inp.up, down: !!inp.down, jump: !!inp.jump };
      I.latch = {};
      if (inp.jump && !prevJump) I.latch.jump = true;
      prevJump = !!inp.jump;
      for (const e of keep) e.update(1 / 60);
      p.update(1 / 60);
      I.latch = {};
      if (p.bad) return null;
      for (const tg of targets) if (!found.has(tg.name + tg.box.x + ',' + tg.box.y) && G.overlap(p, tg.box)) found.add(tg.name + tg.box.x + ',' + tg.box.y);
      if (!p.onGround && p.state !== 'climb') air++;
      if (p.onGround && f > 3 && (air > 2 || inp.settle) && Math.abs(p.vx) < (def.horse ? 400 : 30)) {
        const ph = hasMoving && p.riding instanceof E.MovingPlatform ? p.riding.t : null;
        return { x: p.x, y: p.y, phase: ph, vx: def.horse ? p.vx : 0 };
      }
    }
    if (p.onGround) return { x: p.x, y: p.y, phase: null, vx: def.horse ? p.vx : 0 };
    return null;
  }

  const progs = [];
  const dirs = [-1, 0, 1];
  const D = (d) => (d < 0 ? { left: true } : d > 0 ? { right: true } : {});
  // шаги
  for (const d of [-1, 1]) for (const n of [8, 16, 30]) progs.push((f) => (f < n ? D(d) : { settle: true }));
  // прыжки: разбег, удержание прыжка, направление в воздухе
  for (const d of dirs) for (const runF of [0, 12]) for (const hold of [4, 12, 30]) for (const airMode of [0, 1, 2]) {
    progs.push((f, p) => {
      const o = Object.assign({}, f < runF ? D(d) : {});
      if (f >= runF) {
        const af = f - runF;
        o.jump = af < hold;
        const ad = airMode === 0 ? d : airMode === 1 ? (af < 14 ? d : 0) : (af < 8 ? 0 : d);
        Object.assign(o, D(ad));
      }
      return o;
    });
  }
  // плавание
  for (const d of dirs) progs.push((f) => Object.assign({ jump: f % 14 < 6 }, D(d)));
  // лестницы
  for (const v of ['up', 'down']) for (const k of [30, 80, 140, 220]) for (const d of [-1, 0, 1]) {
    const pr = (f) => { const o = {}; if (f < k + 40) o[v] = true; if (f >= k && d) Object.assign(o, D(d)); return o; };
    pr.long = true; progs.push(pr);
  }
  // прыжки от стен (Амра)
  if (def.hero === 'amra') for (const d of [-1, 1]) {
    progs.push((f, p) => {
      if (!p._wd) p._wd = d;
      const o = D(p._wd);
      if (f < 3) o.jump = true;
      if (!p.onGround && p.touchingWall() === p._wd && f - (p._wj || -99) > 10) { p._wj = f; p._jf = f; }
      if (p._jf !== undefined && f - p._jf < 3) o.jump = true;
      if (p._jf !== undefined && f - p._jf === 3) p._wd = -p._wd;
      return o;
    });
  }
  // конь: ждать и прыгать
  if (def.horse) {
    progs.length = 0;
    for (const d of dirs) for (const wait of [0, 6, 12, 20, 30]) for (const hold of [6, 30]) progs.push((f) => Object.assign(D(d), { jump: f >= wait && f < wait + hold }));
    for (const d of dirs) progs.push((f) => Object.assign(D(d), { settle: f > 10 }));
  }

  const startNode = { x: start.x, y: start.y, phase: null };
  const phases = hasMoving ? [0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8] : [0];
  queue.push(startNode);
  visited.set('s', 1);
  const t0 = Date.now();
  let maxX = 0, minY = 1e9;
  while (queue.length && Date.now() - t0 < 150000) {
    const n = queue.shift();
    maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y);
    const usePh = n.phase !== null && n.phase !== undefined ? [n.phase] : phases;
    for (const ph of usePh) for (const prog of progs) {
      const r = run({ x: n.x, y: n.y, phase: ph, vx: n.vx }, prog, def.horse ? 120 : prog.long ? 320 : 200);
      if (!r) continue;
      const k = key(r, r.phase);
      if (visited.has(k)) continue;
      visited.set(k, 1);
      queue.push(r);
    }
  }
  const names = targets.map((tg) => tg.name + tg.box.x + ',' + tg.box.y);
  const missing = targets.filter((tg, i) => !found.has(names[i])).map((tg) => `${tg.name} @(${Math.round(tg.box.x / T)},${Math.round(tg.box.y / T)})`);
  const xs = {}; for (const k of visited.keys()) { const tx = Math.floor((+k.split(',')[0]) * 8 / T); if (!isNaN(tx)) xs[tx] = (xs[tx] || 0) + 1; }
  return { xs: (typeof DEBUG_XS !== 'undefined') ? xs : undefined, id: def.id, nodes: visited.size, sims, timeout: queue.length > 0, maxXtile: Math.round(maxX / T), minYtile: Math.round(minY / T), targets: targets.length, missing };
}

(async () => {
  const which = process.argv[2] ? process.argv[2].split(',').map((n) => +n - 1) : [0, 1, 2, 4, 5, 6, 7, 8];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 854, height: 400 } });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(URL);
  await page.waitForTimeout(500);
  let bad = 0;
  for (const i of which) {
    if (process.env.DEBUG_XS) await page.evaluate(() => { window.DEBUG_XS = 1; });
    const r = await page.evaluate(pageReach, i);
    console.log(JSON.stringify(r));
    if (r.missing && r.missing.length) bad++;
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
