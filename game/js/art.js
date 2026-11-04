/* Анакопиа — графика: пиксельные спрайты, тайлы, фоны (всё рисуется кодом, без внешних файлов) */
'use strict';
(function () {
  const G = window.G;
  const OUT = '#1b1218';
  const A = (G.art = {});

  function cnv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return c;
  }
  A.cnv = cnv;

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* Спрайт из текстовой карты + палитра; автоматический контур */
  function sprite(rows, pal, opt) {
    opt = opt || {};
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const c = cnv(w, h), x = c.getContext('2d');
    const img = x.createImageData(w, h), d = img.data;
    const solid = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = rows[j][i];
      if (!ch || ch === '.' || !pal[ch]) continue;
      const [r, g, b] = hexToRgb(pal[ch]);
      const k = (j * w + i) * 4;
      d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
      solid[j * w + i] = 1;
    }
    if (opt.outline !== false) {
      const [r, g, b] = hexToRgb(opt.outlineColor || OUT);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        if (solid[j * w + i]) continue;
        const n = (i > 0 && solid[j * w + i - 1]) || (i < w - 1 && solid[j * w + i + 1]) ||
          (j > 0 && solid[(j - 1) * w + i]) || (j < h - 1 && solid[(j + 1) * w + i]);
        if (n) { const k = (j * w + i) * 4; d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255; }
      }
    }
    x.putImageData(img, 0, 0);
    if (opt.scale && opt.scale > 1) {
      const s = cnv(w * opt.scale, h * opt.scale);
      s.getContext('2d').drawImage(c, 0, 0, w * opt.scale, h * opt.scale);
      return s;
    }
    return c;
  }
  A.sprite = sprite;

  function flip(c) {
    const f = cnv(c.width, c.height), x = f.getContext('2d');
    x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
    return f;
  }
  A.flip = flip;

  /* ---------- Палитры ---------- */
  const SKIN = '#f0bf93', SKIN2 = '#c98f68';
  const PAL = {
    astamur: { m: '#4b3527', M: '#33241b', s: SKIN, S: SKIN2, e: OUT, c: '#a33326', C: '#6e1f19', b: '#d8b04c', p: '#2c2633', o: '#3a2a20', h: '#2a1a12' },
    amra: { m: '#ece4d2', M: '#bdb29c', s: SKIN, S: SKIN2, e: OUT, c: '#2f7a4d', C: '#1f4a30', b: '#8a5a2e', p: '#3b2f2a', o: '#4a3020', h: '#3a2214' },
    soldier: { g: '#a9b1bb', G: '#6b737e', s: '#d9a77d', e: OUT, h: '#2b1d16', t: '#e6dfcc', T: '#b5ab94', y: '#3b6f8f', p: '#4a3f36', o: '#2a221c' },
    spear: { g: '#a9b1bb', G: '#6b737e', s: '#d9a77d', e: OUT, h: '#2b1d16', t: '#d2c296', T: '#a8986a', y: '#7a3b2a', p: '#4a3f36', o: '#2a221c' },
    archer: { g: '#c9a86a', G: '#8a6e3e', s: '#d9a77d', e: OUT, h: '#2b1d16', t: '#b9cdb0', T: '#8aa080', y: '#5a3a1e', p: '#4a3f36', o: '#2a221c' },
    shield: { g: '#8c949e', G: '#5b636e', s: '#d9a77d', e: OUT, h: '#2b1d16', t: '#d8d0bc', T: '#aaa08a', y: '#2d4f6a', p: '#3a3a40', o: '#22201c' },
    guard: { g: '#8f97a1', G: '#5b636e', s: '#d9a77d', e: OUT, h: '#2b1d16', t: '#9a9aae', T: '#707088', y: '#4a2a5a', p: '#3a3a40', o: '#22201c' },
    master: { g: '#5a5a62', G: '#3a3a42', s: '#c9926a', e: '#ff4020', h: '#1a1210', t: '#6a3a2a', T: '#4a2418', y: '#c9a24a', p: '#2a2228', o: '#1a1410' },
    marwan: { g: '#f0c040', G: '#a87a20', s: '#d9a77d', e: OUT, h: '#151010', t: '#8c1c1c', T: '#5a0e0e', y: '#f0c040', p: '#2a1e1e', o: '#1a1010' },
    leon: { y: '#f0c040', h: '#3a2418', s: SKIN, S: SKIN2, e: OUT, B: '#5a3a24', r: '#5b2a7a', R: '#3a1a52', p: '#2c2633', o: '#3a2a20' },
    daur: { m: '#5a5048', w: '#f2f0ea', s: SKIN, S: SKIN2, e: OUT, c: '#6a4a30', C: '#4a3220', p: '#2c2633', o: '#3a2a20' },
    horse: { b: '#7a4826', h: '#1f140e', e: OUT, w: '#2a2a2a' },
    whitehorse: { b: '#e2ded6', h: '#8a8480', e: OUT, w: '#4a4a4a' },
  };
  A.PAL = PAL;

  /* ---------- Карты персонажей (верх + ноги) ---------- */
  const TOP = {
    astamur: [
      '................',
      '......mmmm......',
      '.....mmmmmm.....',
      '....mmmmmmmm....',
      '....mmmsssss....',
      '...Mmmsssses....',
      '...Mmmssssss....',
      '...MMmmssSs.....',
      '....Mcccccc.....',
      '....ccbbbbcs....',
      '...sccccccc.....',
      '....cCcCcCc.....',
    ],
    amra: [
      '................',
      '......mmmm......',
      '.....mmmmmm.....',
      '....mmmmmmmm....',
      '....mmmsssss....',
      '...hmmsssses....',
      '...hmmssssss....',
      '...hhmmssSs.....',
      '...h.cccccc.....',
      '...hccbbbbcs....',
      '...sccccccc.....',
      '....ccccccc.....',
    ],
    soldier: [
      '................',
      '.......g........',
      '......ggg.......',
      '.....ggggg......',
      '....gggggggg....',
      '....GGsssss.....',
      '....GGssses.....',
      '....GGhhhhh.....',
      '.....Ghhhh......',
      '....tttyyytts...',
      '...stttttttt....',
      '....ttttTttt....',
    ],
    leon: [
      '................',
      '.....y.y.y......',
      '.....yyyyy......',
      '....hhhhhhh.....',
      '....hhsssss.....',
      '...hhsssses.....',
      '...hhssssss.....',
      '....hBBBBBB.....',
      '.....BBBBB......',
      '....rrryyyrrs...',
      '...srrrrrrrr....',
      '...rrrrrRrrrr...',
    ],
    daur: [
      '................',
      '......mmmm......',
      '.....mmmmmm.....',
      '....wwwwwwww....',
      '....wwsssss.....',
      '...wwsssses.....',
      '...wwssssss.....',
      '....wwwwwww.....',
      '.....wwwww......',
      '....ccwwwccs....',
      '...sccccccc.....',
      '....cCcCcCc.....',
    ],
  };
  const LEGS = {
    stand: ['....pppppp......', '....pp..pp......', '....oo..oo......', '................'],
    run1: ['....pppppp......', '...pp....pp.....', '..oo......oo....', '................'],
    run2: ['....pppppp......', '.....pppp.......', '.....oooo.......', '................'],
    jump: ['....pppppp......', '...pp...pp......', '..oo.....oo.....', '................'],
    climb1: ['....pppppp......', '....pp..pp......', '....oo...pp.....', '..........oo....'],
    climb2: ['....pppppp......', '....pp..pp......', '.....pp..oo.....', '.....oo.........'],
  };
  const DRESS = {
    stand: ['....cccCcccc....', '.....pp..pp.....', '.....oo..oo.....', '................'],
    run1: ['....cccCcccc....', '....pp....pp....', '...oo......oo...', '................'],
    run2: ['....cccCcccc....', '......pppp......', '......oooo......', '................'],
    jump: ['....cccCcccc....', '....pp...pp.....', '...oo.....oo....', '................'],
    climb1: ['....cccCcccc....', '.....pp..pp.....', '.....oo...pp....', '..........oo....'],
    climb2: ['....cccCcccc....', '.....pp..pp.....', '......pp..oo....', '......oo........'],
  };

  function withAttack(top) {
    const t = top.slice();
    // вытянутая вперёд рука
    t[9] = t[9].slice(0, 11) + 'cc' + 's' + t[9].slice(14);
    return t;
  }

  /* ---------- Предметы ---------- */
  const ITEM = {
    honey: { pal: { y: '#f2b230', Y: '#c98a10', c: '#b8703c', C: '#8a4e26', w: '#fff4c0' }, rows: [
      '............', '....yyyy....', '...yYYYYy...', '....cccc....', '...cccccc...', '..ccwyyycc..',
      '..cyyyyyyc..', '..cyyYyyyc..', '..cccccccC..', '...ccccCC...', '............', '............'] },
    pepper: { pal: { g: '#3e8a2a', r: '#e2301e', R: '#a01810', w: '#ffb0a0' }, rows: [
      '............', '.......gg...', '......gg....', '.....rrr....', '....rwrrr...', '....rwrrR...',
      '.....rrrR...', '.....rrrR...', '......rrR...', '......rr....', '.......r....', '............'] },
    shield: { pal: { y: '#e8b84a', c: '#8a5a30', C: '#6a4020', s: '#d8dde4', S: '#9aa2ac' }, rows: [
      '............', '...yyyyyy...', '..ycccCccy..', '.ycccyycccy.', '.yccyssyccy.', '.ycyssSsycy.',
      '.ycysSSsycy.', '.yccyssyccy.', '.ycccyycccy.', '..ycccCccy..', '...yyyyyy...', '............'] },
    feather: { pal: { w: '#f4f8ff', b: '#7ab8ff', y: '#e8c050' }, rows: [
      '..........w.', '.........ww.', '........wwb.', '.......wwb..', '......wwb...', '.....wwb....',
      '....wwb.....', '...wwb......', '..wwb.......', '.wb.........', 'y...........', '............'] },
    heart: { pal: { r: '#e83040', R: '#a01828', w: '#ffc0c8' }, rows: [
      '.rr.rr.', 'rwrrrrr', 'rrrrrrr', 'rrrrrRr', '.rrrRr.', '..rRr..', '...r...'] },
    heartEmpty: { pal: { r: '#4a3038' }, rows: [
      '.rr.rr.', 'rrrrrrr', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'] },
  };

  /* ---------- Звери ---------- */
  const BEAST = {
    bat1: ['b............b', 'bb..........bb', '.bbb..bb..bbb.', '..bbbbbbbbbb..', '....bebbeb....', '......bb......', '..............'],
    bat2: ['..............', '......bb......', '....bebbeb....', '..bbbbbbbbbb..', '.bbb......bbb.', 'bb..........bb', 'b............b'],
    boar1: [
      '....................', '......hhhhh.........', '....hhbbbbbhh.......', '...hbbbbbbbbbbbb....',
      '..hbbbbbbbbbbbbbbe..', '..bbbbbbbbbbbbbbbbbn', '.bbbbbbbbbbbbbbbbbbn', '.bbbbbbbbbbbbbbbwbb.',
      '..bbbbbbbbbbbbbbb...', '...bb.bb....bb.bb...', '...bb.bb....bb.bb...', '...kk.kk....kk.kk...'],
    boar2: [
      '....................', '......hhhhh.........', '....hhbbbbbhh.......', '...hbbbbbbbbbbbb....',
      '..hbbbbbbbbbbbbbbe..', '..bbbbbbbbbbbbbbbbbn', '.bbbbbbbbbbbbbbbbbbn', '.bbbbbbbbbbbbbbbwbb.',
      '..bbbbbbbbbbbbbbb...', '..bb...bb..bb...bb..', '.bb.....bbbb....bb..', '.kk......kk.....kk..'],
  };
  const BEASTPAL = {
    bat: { b: '#3a2a4a', e: '#ff4040' },
    boar: { b: '#5a4030', h: '#2a1a12', e: '#ff3020', n: '#d08a80', w: '#f2eee0', k: '#1b1218' },
  };

  const HORSE_TOP = [
    '........................',
    '...................bb...',
    '..................bbbb..',
    '.................hbbbbb.',
    '................hhbbebbb',
    '...............hhbbbbbbb',
    '..............hhbbb.....',
    '..hhbbbbbbbbbbbbbb......',
    '.hh.bbbbbbbbbbbbbb......',
    '.h..bbbbbbbbbbbbbb......',
    '.h...bbbbbbbbbbbb.......',
  ];
  const HORSE_LEGS = {
    a: ['.....bb.bb...bb.bb......', '.....bb.bb...bb.bb......', '.....bb.bb...bb.bb......', '.....ww.ww...ww.ww......', '........................'],
    b: ['....bb.........bbb......', '...bb............bb.....', '..bb..............bb....', '.ww................ww...', '........................'],
    c: ['......bbb....bbb........', '.......bb.....bb........', '......bb.....bb.........', '......ww.....ww.........', '........................'],
  };

  /* ---------- Сборка библиотеки спрайтов ---------- */
  const LIB = (A.lib = {});
  function add(name, c) { LIB[name] = [c, flip(c)]; }
  A.get = function (name, face) { const s = LIB[name]; return s ? s[face < 0 ? 1 : 0] : null; };

  function buildHumanoid(key, topKey, palKey, legs, scale) {
    const top = TOP[topKey], pal = PAL[palKey];
    const frames = ['stand', 'run1', 'run2', 'jump', 'climb1', 'climb2'];
    frames.forEach((f) => add(key + '_' + f, sprite(top.concat(legs[f]), pal, { scale })));
    add(key + '_attack', sprite(withAttack(top).concat(legs.stand), pal, { scale }));
    add(key + '_attackj', sprite(withAttack(top).concat(legs.jump), pal, { scale }));
    add(key + '_top', sprite(top.concat(['................', '................', '................', '................']), pal, { scale }));
  }

  /* Монета — 4 кадра вращения */
  function coinFrames() {
    const out = [];
    [6, 4, 2, 4].forEach((rw, i) => {
      const c = cnv(12, 12), x = c.getContext('2d');
      x.fillStyle = OUT; x.fillRect(6 - rw - 1, 1, rw * 2 + 2, 10); x.fillRect(6 - rw, 0, rw * 2, 12);
      x.fillStyle = '#e8b030'; x.fillRect(6 - rw, 1, rw * 2, 10);
      x.fillStyle = '#ffe27a'; if (rw > 2) x.fillRect(6 - rw + 1, 2, 2, 7);
      x.fillStyle = '#b07a18'; if (rw > 3) { x.fillRect(5, 3, 2, 6); }
      if (i === 2) { x.fillStyle = '#ffe27a'; x.fillRect(5, 1, 1, 10); }
      out.push(c);
    });
    return out;
  }

  /* Апхьарца — абхазский смычковый инструмент (собираем её струны) */
  function apkhyartsa() {
    const c = cnv(12, 16), x = c.getContext('2d');
    x.fillStyle = OUT;
    x.fillRect(4, 0, 4, 2); x.fillRect(5, 0, 2, 9); x.fillRect(2, 7, 8, 8); x.fillRect(3, 6, 6, 10);
    x.fillStyle = '#8a4e22'; x.fillRect(5, 1, 2, 1); x.fillRect(5, 1, 2, 8);
    x.fillStyle = '#c27a3a'; x.fillRect(3, 8, 6, 6); x.fillRect(4, 7, 4, 8);
    x.fillStyle = '#5a3014'; x.fillRect(5, 9, 2, 3);
    x.fillStyle = '#ffe9a0'; x.fillRect(5, 2, 1, 12); x.fillRect(6, 2, 1, 12);
    return c;
  }

  /* Огонь-маяк (контрольная точка) */
  function brazier(lit, f) {
    const c = cnv(16, 24), x = c.getContext('2d');
    x.fillStyle = OUT; x.fillRect(7, 12, 2, 12); x.fillRect(3, 9, 10, 4); x.fillRect(5, 22, 6, 2);
    x.fillStyle = '#7a5a40'; x.fillRect(7, 13, 2, 9);
    x.fillStyle = '#5a5a64'; x.fillRect(4, 10, 8, 2);
    if (lit) {
      const h = [7, 9, 8][f % 3];
      x.fillStyle = '#e8481e'; x.fillRect(4, 10 - h, 8, h);
      x.fillStyle = '#ffa020'; x.fillRect(5, 11 - h + 2, 6, h - 2);
      x.fillStyle = '#fff0a0'; x.fillRect(7, 11 - h + 4, 2, h - 4);
    }
    return c;
  }

  function signPost() {
    const c = cnv(16, 16), x = c.getContext('2d');
    x.fillStyle = OUT; x.fillRect(1, 1, 14, 9); x.fillRect(6, 9, 4, 7);
    x.fillStyle = '#b88a50'; x.fillRect(2, 2, 12, 7);
    x.fillStyle = '#8a6030'; x.fillRect(7, 10, 2, 6);
    x.fillStyle = '#5a3a1a'; x.fillRect(4, 4, 8, 1); x.fillRect(4, 6, 6, 1);
    return c;
  }

  A.init = function () {
    buildHumanoid('astamur', 'astamur', 'astamur', LEGS);
    buildHumanoid('amra', 'amra', 'amra', DRESS);
    ['soldier', 'spear', 'archer', 'shield', 'guard'].forEach((k) => buildHumanoid(k, 'soldier', k, LEGS));
    buildHumanoid('master', 'soldier', 'master', LEGS, 2);
    buildHumanoid('marwan', 'soldier', 'marwan', LEGS, 2);
    buildHumanoid('leon', 'leon', 'leon', LEGS);
    buildHumanoid('daur', 'daur', 'daur', LEGS);
    ['a', 'b', 'c'].forEach((f) => {
      add('horse_' + f, sprite(HORSE_TOP.concat(HORSE_LEGS[f]), PAL.horse));
      add('whorse_' + f, sprite(HORSE_TOP.concat(HORSE_LEGS[f]), PAL.whitehorse, { scale: 2 }));
    });
    add('bat1', sprite(BEAST.bat1, BEASTPAL.bat)); add('bat2', sprite(BEAST.bat2, BEASTPAL.bat));
    add('boar1', sprite(BEAST.boar1, BEASTPAL.boar)); add('boar2', sprite(BEAST.boar2, BEASTPAL.boar));
    for (const k in ITEM) add(k, sprite(ITEM[k].rows, ITEM[k].pal));
    coinFrames().forEach((c, i) => add('coin' + i, c));
    add('string', apkhyartsa());
    for (let f = 0; f < 3; f++) add('fire' + f, brazier(true, f));
    add('brazier', brazier(false, 0));
    add('sign', signPost());
    A.icons = {
      heart: LIB.heart[0].toDataURL(), heartEmpty: LIB.heartEmpty[0].toDataURL(),
      coin: LIB.coin0[0].toDataURL(), string: LIB.string[0].toDataURL(), pepper: LIB.pepper[0].toDataURL(),
    };
  };

  /* ---------- Портреты для диалогов ---------- */
  A.portrait = function (who) {
    const c = cnv(96, 96), x = c.getContext('2d');
    const bg = { astamur: '#6e2a20', amra: '#22553a', leon: '#4a2a6a', daur: '#5a4632', marwan: '#5a1414', narrator: '#3a2a1a', master: '#3a2a2a', abnauaiu: '#1a2a1a' }[who] || '#333';
    x.fillStyle = bg; x.fillRect(0, 0, 96, 96);
    x.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 96; i += 8) x.fillRect(0, i, 96, 4);
    let src = null, sx = 2, sy = 0, sw = 12, sh = 12;
    if (who === 'narrator') {
      const s = LIB.string[0];
      x.drawImage(s, 0, 0, 12, 16, 24, 8, 48, 64 + 16);
      return c.toDataURL();
    }
    if (who === 'abnauaiu') {
      drawAbnauaiu(x, 48, 120, 0, 1, 1.6);
      return c.toDataURL();
    }
    const map = { astamur: 'astamur_stand', amra: 'amra_stand', leon: 'leon_stand', daur: 'daur_stand', marwan: 'marwan_stand', master: 'master_stand' };
    src = LIB[map[who]] && LIB[map[who]][0];
    if (src) {
      const k = src.width / 16;
      x.drawImage(src, sx * k, sy * k, sw * k, sh * k, 6, 12, 84, 84);
    }
    return c.toDataURL();
  };

  /* ---------- Абнауаю: лесной великан из абхазских сказаний ---------- */
  function drawAbnauaiu(x, cx, by, t, face, sc) {
    sc = sc || 1;
    const P = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(Math.round(cx + px * sc * face - (face < 0 ? w * sc : 0)), Math.round(by + py * sc), Math.ceil(w * sc), Math.ceil(h * sc)); };
    const sw = Math.sin(t * 8) * 3;
    // тело
    P(-14, -50, 26, 40, OUT); P(-13, -49, 24, 38, '#3a2a1e');
    for (let i = 0; i < 9; i++) P(-12 + i * 2.6, -48 + (i % 3) * 4, 1, 30, '#5a4230');
    // голова
    P(-8, -62, 18, 14, OUT); P(-7, -61, 16, 12, '#3a2a1e');
    P(-6, -63, 4, 3, '#3a2a1e'); P(3, -64, 4, 4, '#3a2a1e');
    // глаза и пасть
    P(2, -57, 3, 2, '#ffd020'); P(6, -57, 3, 2, '#ffd020');
    P(1, -52, 9, 3, '#200a0a'); P(2, -52, 1, 1, '#fff'); P(5, -52, 1, 1, '#fff'); P(8, -52, 1, 1, '#fff');
    // костяной гребень на груди (по преданию — острый, как топор)
    P(4, -44, 6, 3, '#e8e0c8'); P(6, -41, 4, 6, '#d8d0b8'); P(5, -35, 3, 2, '#b8b098');
    // руки
    P(8, -46 + sw, 6, 26, OUT); P(9, -45 + sw, 4, 24, '#4a3424'); P(9, -22 + sw, 7, 4, '#2a1a10');
    P(-16, -46 - sw, 6, 24, OUT); P(-15, -45 - sw, 4, 22, '#4a3424');
    // ноги
    const lg = Math.sin(t * 10) * 3;
    P(-10 + lg, -12, 7, 12, OUT); P(-9 + lg, -12, 5, 11, '#3a2a1e');
    P(2 - lg, -12, 7, 12, OUT); P(3 - lg, -12, 5, 11, '#3a2a1e');
  }
  A.drawAbnauaiu = drawAbnauaiu;

  /* ---------- Тайлы ---------- */
  const THEMES = {
    village: { d: '#8a5a34', d2: '#6e4526', d3: '#a87448', g: '#58b840', g2: '#2f7d2a', top: 'grass' },
    gorge: { d: '#77706a', d2: '#55504a', d3: '#948c84', g: '#5aa03e', g2: '#2f6d2a', top: 'grass' },
    forest: { d: '#3e3248', d2: '#2a2234', d3: '#54465e', g: '#2f6a4a', g2: '#1c4430', top: 'grass' },
    fortress: { d: '#8a7a68', d2: '#665848', d3: '#a8988a', g: '#6aa848', g2: '#3a7030', top: 'grass' },
    cave: { d: '#4a3e52', d2: '#2e2636', d3: '#62566c', g: '#6a5a78', g2: '#4a3e58', top: 'rock' },
    camp: { d: '#4a3a30', d2: '#2e241e', d3: '#5e4c40', g: '#3a5a34', g2: '#22381e', top: 'grass' },
    rain: { d: '#4a3e34', d2: '#30281e', d3: '#5e5044', g: '#3a6a3a', g2: '#204020', top: 'grass' },
    tower: { d: '#6a4a2e', d2: '#4a321e', d3: '#8a643e', g: '#8a643e', g2: '#5a3e22', top: 'plank' },
    gates: { d: '#5e5246', d2: '#3e342a', d3: '#7a6c5e', g: '#4a6a3a', g2: '#2a4222', top: 'grass' },
  };
  A.THEMES = THEMES;

  const SOLID = new Set(['#', 'S', 'B', 'U', '?', 'Q', 'P', 'D', 'Y', 'M', '+', 'L', 'W', 'C', 'X']);
  const ONEWAY = new Set(['=']);
  A.SOLID = SOLID; A.ONEWAY = ONEWAY;
  A.isBlock = (ch) => '?QPDYM+'.includes(ch);

  function noiseFill(x, px, py, w, h, base, cols, rnd, density) {
    x.fillStyle = base; x.fillRect(px, py, w, h);
    const n = Math.floor(w * h * density);
    for (let i = 0; i < n; i++) {
      x.fillStyle = cols[Math.floor(rnd() * cols.length)];
      x.fillRect(px + Math.floor(rnd() * w), py + Math.floor(rnd() * h), 1 + Math.floor(rnd() * 2), 1);
    }
  }

  /* Рисует статичный тайл в (px,py) с учётом соседей */
  A.drawTile = function (x, ch, px, py, th, nb, rnd) {
    const T = 16;
    switch (ch) {
      case '#': case 'C': {
        noiseFill(x, px, py, T, T, th.d, [th.d2, th.d3], rnd, 0.12);
        if (rnd() < 0.3) { x.fillStyle = th.d3; x.fillRect(px + 3 + Math.floor(rnd() * 8), py + 6 + Math.floor(rnd() * 6), 3, 2); }
        if (!nb.up) {
          if (th.top === 'grass' && ch === '#') {
            x.fillStyle = th.g; x.fillRect(px, py, T, 4);
            x.fillStyle = th.g2; x.fillRect(px, py + 4, T, 1);
            for (let i = 0; i < T; i += 2) if (rnd() < 0.6) x.fillRect(px + i, py + 4, 1, 1 + Math.floor(rnd() * 2));
            x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(px, py, T, 1);
          } else if (th.top === 'plank') {
            x.fillStyle = th.g; x.fillRect(px, py, T, 3); x.fillStyle = th.g2; x.fillRect(px, py + 3, T, 1);
          } else {
            x.fillStyle = th.d3; x.fillRect(px, py, T, 2); x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(px, py, T, 1);
          }
        }
        if (!nb.left) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(px, py, 1, T); }
        if (!nb.right) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px + T - 1, py, 1, T); }
        if (!nb.down && ch === 'C') { x.fillStyle = th.d2; for (let i = 0; i < T; i += 4) x.fillRect(px + i + 1, py + T - 1, 2, 2); }
        break;
      }
      case 'S': {
        x.fillStyle = '#8f8a80'; x.fillRect(px, py, T, T);
        x.fillStyle = '#6a655c';
        x.fillRect(px, py + 7, T, 1); x.fillRect(px, py + 15, T, 1);
        x.fillRect(px + 7, py, 1, 7); x.fillRect(px + 3, py + 8, 1, 7); x.fillRect(px + 12, py + 8, 1, 7);
        x.fillStyle = '#aaa59a'; x.fillRect(px, py, 7, 1); x.fillRect(px + 8, py, 8, 1); x.fillRect(px, py + 8, 3, 1); x.fillRect(px + 4, py + 8, 8, 1);
        for (let i = 0; i < 6; i++) { x.fillStyle = rnd() < 0.5 ? '#7a756c' : '#9c978c'; x.fillRect(px + Math.floor(rnd() * 15), py + Math.floor(rnd() * 15), 1, 1); }
        if (!nb.up) { x.fillStyle = '#b8b3a8'; x.fillRect(px, py, T, 2); }
        break;
      }
      case 'B': {
        x.fillStyle = '#b5623a'; x.fillRect(px, py, T, T);
        x.fillStyle = '#7a3a20';
        x.fillRect(px, py + 3, T, 1); x.fillRect(px, py + 7, T, 1); x.fillRect(px, py + 11, T, 1); x.fillRect(px, py + 15, T, 1);
        x.fillRect(px + 4, py, 1, 3); x.fillRect(px + 12, py, 1, 3); x.fillRect(px + 8, py + 4, 1, 3); x.fillRect(px, py + 4, 1, 3);
        x.fillRect(px + 4, py + 8, 1, 3); x.fillRect(px + 12, py + 8, 1, 3); x.fillRect(px + 8, py + 12, 1, 3); x.fillRect(px, py + 12, 1, 3);
        x.fillStyle = '#d4845a'; x.fillRect(px, py, T, 1);
        break;
      }
      case 'U': {
        x.fillStyle = OUT; x.fillRect(px, py, T, T);
        x.fillStyle = '#7a5a40'; x.fillRect(px + 1, py + 1, 14, 14);
        x.fillStyle = '#5a4030'; x.fillRect(px + 2, py + 2, 2, 2); x.fillRect(px + 12, py + 2, 2, 2); x.fillRect(px + 2, py + 12, 2, 2); x.fillRect(px + 12, py + 12, 2, 2);
        break;
      }
      case 'L': {
        x.fillStyle = '#6a4424'; x.fillRect(px, py, T, T);
        x.fillStyle = '#8a5a30'; for (let i = 1; i < T; i += 4) x.fillRect(px, py + i, T, 2);
        x.fillStyle = '#4a2e18'; x.fillRect(px, py + T - 1, T, 1);
        if (!nb.up) { x.fillStyle = '#a87440'; x.fillRect(px, py, T, 2); }
        break;
      }
      case 'W': {
        x.fillStyle = '#5a3e24'; x.fillRect(px, py, T, T);
        x.fillStyle = '#7a5634'; x.fillRect(px + 1, py, 6, T); x.fillRect(px + 9, py, 6, T);
        x.fillStyle = '#3a2614'; x.fillRect(px + 7, py, 2, T); x.fillRect(px + 15, py, 1, T);
        x.fillStyle = '#2a1a0e'; x.fillRect(px + 3, py + 4, 2, 2); x.fillRect(px + 11, py + 10, 2, 2);
        break;
      }
      case '=': {
        x.fillStyle = OUT; x.fillRect(px, py, T, 6);
        x.fillStyle = '#b8823e'; x.fillRect(px, py + 1, T, 4);
        x.fillStyle = '#7a5224'; x.fillRect(px + 7, py + 1, 1, 4); x.fillRect(px, py + 4, T, 1);
        x.fillStyle = '#5a3a1a'; x.fillRect(px + 2, py + 6, 2, 3); x.fillRect(px + 12, py + 6, 2, 3);
        break;
      }
      case 'H': {
        x.fillStyle = '#6a4626'; x.fillRect(px + 2, py, 2, T); x.fillRect(px + 12, py, 2, T);
        x.fillStyle = '#9a6a3a'; x.fillRect(px + 2, py + 3, 12, 2); x.fillRect(px + 2, py + 11, 12, 2);
        x.fillStyle = '#4a2e16'; x.fillRect(px + 4, py + 5, 8, 1); x.fillRect(px + 4, py + 13, 8, 1);
        break;
      }
      case '^': {
        for (let i = 0; i < 4; i++) {
          const bx = px + i * 4;
          x.fillStyle = OUT; x.fillRect(bx, py + 6, 4, 10);
          x.fillStyle = '#b89060'; x.fillRect(bx + 1, py + 8, 2, 8);
          x.fillStyle = '#e8d8b0'; x.fillRect(bx + 1, py + 7, 2, 2);
        }
        break;
      }
      case '*': {
        const cols = ['#2f6a2a', '#3e8a34', '#1e4a1e'];
        for (let i = 0; i < 14; i++) {
          x.fillStyle = cols[i % 3];
          const r = 3 + Math.floor(rnd() * 3);
          x.beginPath(); x.arc(px + 2 + rnd() * 12, py + 6 + rnd() * 8, r, 0, Math.PI * 2); x.fill();
        }
        break;
      }
      case 'K': {
        x.fillStyle = '#3ad8ff'; x.fillRect(px + 6, py + 4, 4, 10); x.fillRect(px + 3, py + 8, 3, 6); x.fillRect(px + 10, py + 7, 3, 7);
        x.fillStyle = '#c0f4ff'; x.fillRect(px + 7, py + 5, 1, 6); x.fillRect(px + 4, py + 9, 1, 3);
        break;
      }
      case 'T': {
        x.fillStyle = '#4a3020'; x.fillRect(px + 7, py + 6, 2, 10);
        x.fillStyle = '#2a2a30'; x.fillRect(px + 5, py + 5, 6, 2);
        break;
      }
      default: break;
    }
  };

  /* Анимированные тайлы рисуются каждый кадр */
  A.drawDynTile = function (x, ch, px, py, t, nb) {
    const T = 16;
    if (ch === 'w' || ch === '~') {
      x.fillStyle = 'rgba(40,110,170,0.62)'; x.fillRect(px, py, T, T);
      if (ch === '~' || !nb.upWater) {
        const o = Math.floor(t * 8 + px / 4) % 8;
        x.fillStyle = 'rgba(190,230,255,0.85)';
        for (let i = 0; i < T; i++) { const yy = ((i + o) % 8) < 4 ? 0 : 1; x.fillRect(px + i, py + yy, 1, 2); }
      }
      if (((px + py) / 16 + Math.floor(t * 2)) % 5 === 0) { x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(px + 4, py + 8, 5, 1); }
    } else if (ch === '%') {
      x.fillStyle = '#3a1a10'; x.fillRect(px, py + 10, T, 6);
      for (let i = 0; i < 4; i++) {
        const h = 4 + Math.floor((Math.sin(t * 12 + i * 2 + px) + 1) * 3);
        x.fillStyle = '#e84a1a'; x.fillRect(px + i * 4, py + 14 - h, 4, h);
        x.fillStyle = '#ffb030'; x.fillRect(px + i * 4 + 1, py + 15 - h + 2, 2, h - 2);
      }
    } else if (A.isBlock(ch)) {
      const sh = (Math.floor(t * 3) % 3);
      x.fillStyle = OUT; x.fillRect(px, py, T, T);
      x.fillStyle = ['#e0a838', '#ecb848', '#f4c858'][sh]; x.fillRect(px + 1, py + 1, 14, 14);
      x.fillStyle = '#a06a18'; x.fillRect(px + 1, py + 14, 14, 1); x.fillRect(px + 14, py + 1, 1, 14);
      x.fillStyle = '#fff0b0'; x.fillRect(px + 1, py + 1, 14, 1); x.fillRect(px + 1, py + 1, 1, 14);
      // орнамент-ромб (амфора-тайник)
      x.fillStyle = '#7a3a10';
      x.fillRect(px + 7, py + 3, 2, 2); x.fillRect(px + 5, py + 5, 2, 2); x.fillRect(px + 9, py + 5, 2, 2);
      x.fillRect(px + 3, py + 7, 2, 2); x.fillRect(px + 11, py + 7, 2, 2);
      x.fillRect(px + 5, py + 9, 2, 2); x.fillRect(px + 9, py + 9, 2, 2); x.fillRect(px + 7, py + 11, 2, 2);
      x.fillStyle = '#c0301a'; x.fillRect(px + 7, py + 7, 2, 2);
    }
  };

  /* ---------- Фоны (параллакс) ---------- */
  function mountainLayer(w, h, seed, col, snow, base, amp, rough) {
    const c = cnv(w, h), x = c.getContext('2d'), r = G.rng(seed);
    const pts = [];
    let y = base;
    for (let i = 0; i <= w; i += 4) {
      y += (r() - 0.5) * rough;
      y = G.clamp(y, base - amp, base + amp * 0.3);
      if (i % 64 === 0) y = base - amp * (0.4 + r() * 0.6);
      pts.push([i, y]);
    }
    // сглаживание
    for (let k = 0; k < 3; k++) for (let i = 1; i < pts.length - 1; i++) pts[i][1] = (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4;
    pts[pts.length - 1][1] = pts[0][1];
    x.fillStyle = col; x.beginPath(); x.moveTo(0, h);
    pts.forEach((p) => x.lineTo(p[0], p[1])); x.lineTo(w, h); x.closePath(); x.fill();
    if (snow) {
      x.save(); x.clip();
      x.fillStyle = snow;
      pts.forEach((p) => { if (p[1] < base - amp * 0.55) x.fillRect(p[0] - 2, p[1], 6, (base - amp * 0.55 - p[1]) * 0.8 + 3); });
      x.restore();
    }
    return c;
  }

  function treesLayer(w, h, seed, col, base, kind) {
    const c = cnv(w, h), x = c.getContext('2d'), r = G.rng(seed);
    x.fillStyle = col;
    for (let i = -10; i < w + 10; i += 6 + r() * 10) {
      const th = 20 + r() * 30;
      if (kind === 'cypress') {
        x.beginPath(); x.ellipse(i, base - th / 2, 3 + r() * 2, th / 2, 0, 0, Math.PI * 2); x.fill();
      } else {
        x.beginPath(); x.arc(i, base - th * 0.6, 8 + r() * 8, 0, Math.PI * 2); x.fill();
        x.fillRect(i - 1, base - th * 0.6, 3, th * 0.6);
      }
    }
    x.fillRect(0, base, w, h - base);
    return c;
  }

  function fortressSilhouette(x, cx, base, col, sc) {
    x.fillStyle = col;
    // гора
    x.beginPath(); x.moveTo(cx - 110 * sc, base); x.quadraticCurveTo(cx - 40 * sc, base - 70 * sc, cx, base - 80 * sc);
    x.quadraticCurveTo(cx + 50 * sc, base - 70 * sc, cx + 120 * sc, base); x.fill();
    // стены и башни
    const top = base - 80 * sc;
    x.fillRect(cx - 34 * sc, top - 10 * sc, 68 * sc, 12 * sc);
    for (let i = -3; i <= 3; i++) x.fillRect(cx + i * 10 * sc - 2 * sc, top - 14 * sc, 4 * sc, 4 * sc);
    x.fillRect(cx - 6 * sc, top - 32 * sc, 12 * sc, 24 * sc);
    x.fillRect(cx - 8 * sc, top - 34 * sc, 3 * sc, 3 * sc); x.fillRect(cx - 1.5 * sc, top - 34 * sc, 3 * sc, 3 * sc); x.fillRect(cx + 5 * sc, top - 34 * sc, 3 * sc, 3 * sc);
    x.fillRect(cx - 36 * sc, top - 20 * sc, 8 * sc, 12 * sc); x.fillRect(cx + 28 * sc, top - 20 * sc, 8 * sc, 12 * sc);
  }

  const BGS = {
    coast: { sky: ['#7ec8f0', '#c8ecff'], sun: '#fff6c8', layers: (W) => [
      { c: mountainLayer(512, 240, 11, '#a8c0d8', '#ffffff', 120, 70, 14), f: 0.1, y: 0 },
      { c: (() => { const c = cnv(512, 240), x = c.getContext('2d'); x.fillStyle = '#3a8ac0'; x.fillRect(0, 150, 512, 90); x.fillStyle = '#7ab8e0'; for (let i = 0; i < 40; i++) x.fillRect((i * 37) % 512, 152 + (i * 13) % 30, 8, 1); return c; })(), f: 0.15, y: 0 },
      { c: mountainLayer(512, 240, 23, '#5a9a50', null, 168, 30, 10), f: 0.3, y: 0 },
      { c: treesLayer(512, 240, 31, '#2e6e34', 196, 'cypress'), f: 0.55, y: 0 },
    ] },
    gorge: { sky: ['#8ab8d8', '#d8ecf0'], layers: () => [
      { c: mountainLayer(512, 240, 41, '#8a98a8', '#e8f0f8', 90, 70, 18), f: 0.1, y: 0 },
      { c: mountainLayer(512, 240, 43, '#6a7068', null, 130, 60, 22), f: 0.25, y: 0 },
      { c: (() => { const c = cnv(512, 240), x = c.getContext('2d'); x.fillStyle = 'rgba(220,240,255,0.7)'; [60, 230, 400].forEach((p) => { x.fillRect(p, 60, 10, 180); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(p + 2, 60, 3, 180); x.fillStyle = 'rgba(220,240,255,0.7)'; }); return c; })(), f: 0.3, y: 0 },
      { c: treesLayer(512, 240, 47, '#3a5a3a', 200, 'round'), f: 0.5, y: 0 },
    ] },
    forest: { sky: ['#0c1430', '#28365a'], moon: true, stars: true, layers: () => [
      { c: mountainLayer(512, 240, 51, '#1c2440', null, 130, 50, 14), f: 0.1, y: 0 },
      { c: treesLayer(512, 240, 53, '#142030', 170, 'round'), f: 0.3, y: 0 },
      { c: treesLayer(512, 240, 57, '#0c1420', 190, 'cypress'), f: 0.55, y: 0 },
    ] },
    fortress: { sky: ['#f0a060', '#fce0b0'], sun: '#fff0c0', layers: () => [
      { c: mountainLayer(512, 240, 61, '#b08aa0', '#fff0f0', 110, 60, 14), f: 0.08, y: 0 },
      { c: (() => { const c = cnv(512, 240), x = c.getContext('2d'); fortressSilhouette(x, 256, 200, '#7a5a6a', 1); return c; })(), f: 0.15, y: 0 },
      { c: treesLayer(512, 240, 67, '#5a4a4a', 205, 'cypress'), f: 0.45, y: 0 },
    ] },
    cave: { sky: ['#0e0a14', '#1e1626'], layers: () => [
      { c: (() => { const c = cnv(512, 240), x = c.getContext('2d'), r = G.rng(71); x.fillStyle = '#241c2e'; for (let i = 0; i < 512; i += 14) { const h = 20 + r() * 60; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 7, h); x.lineTo(i + 14, 0); x.fill(); const h2 = 20 + r() * 50; x.beginPath(); x.moveTo(i, 240); x.lineTo(i + 7, 240 - h2); x.lineTo(i + 14, 240); x.fill(); } return c; })(), f: 0.2, y: 0 },
      { c: (() => { const c = cnv(512, 240), x = c.getContext('2d'), r = G.rng(73); x.fillStyle = '#2e2438'; for (let i = 0; i < 512; i += 22) { const h = 30 + r() * 70; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 11, h); x.lineTo(i + 22, 0); x.fill(); } return c; })(), f: 0.4, y: 0 },
    ] },
    camp: { sky: ['#0a1028', '#2a2a48'], moon: true, stars: true, layers: () => [
      { c: (() => { const c = cnv(512, 240), x = c.getContext('2d'); fortressSilhouette(x, 380, 190, '#141a30', 0.8); return c; })(), f: 0.06, y: 0 },
      { c: (() => { const c = cnv(512, 240), x = c.getContext('2d'), r = G.rng(81); x.fillStyle = '#1a1a2a'; for (let i = 0; i < 512; i += 40 + r() * 30) { x.beginPath(); x.moveTo(i, 200); x.lineTo(i + 18, 170); x.lineTo(i + 36, 200); x.fill(); } x.fillRect(0, 200, 512, 40); x.fillStyle = 'rgba(255,140,40,0.5)'; for (let i = 30; i < 512; i += 120) { x.beginPath(); x.arc(i, 198, 6, 0, Math.PI * 2); x.fill(); } return c; })(), f: 0.3, y: 0 },
    ] },
    rain: { sky: ['#1a2030', '#3a4250'], layers: () => [
      { c: mountainLayer(512, 240, 91, '#2a3040', null, 120, 60, 14), f: 0.08, y: 0 },
      { c: (() => { const c = cnv(512, 240), x = c.getContext('2d'); fortressSilhouette(x, 120, 190, '#20262f', 0.7); return c; })(), f: 0.12, y: 0 },
      { c: treesLayer(512, 240, 93, '#1a2420', 196, 'round'), f: 0.4, y: 0 },
    ] },
    tower: { sky: ['#3a2818', '#2a1c10'], layers: () => [
      { c: (() => { const c = cnv(256, 256), x = c.getContext('2d'); x.fillStyle = '#4a3420'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#3a2816'; for (let i = 0; i < 256; i += 32) x.fillRect(i, 0, 3, 256); for (let j = 0; j < 256; j += 64) { x.fillRect(0, j, 256, 4); } x.fillStyle = '#5a4028'; for (let i = 0; i < 256; i += 32) x.fillRect(i + 3, 0, 1, 256); x.fillStyle = 'rgba(255,180,90,0.1)'; for (let i = 16; i < 256; i += 64) x.fillRect(i, 20, 12, 30); return c; })(), f: 0.5, y: 0, tileY: true },
    ] },
    gates: { sky: ['#20202e', '#4a4050'], layers: () => [
      { c: mountainLayer(512, 240, 101, '#2e2e3e', null, 110, 60, 14), f: 0.08, y: 0 },
      { c: (() => { const c = cnv(512, 240), x = c.getContext('2d'); x.fillStyle = '#3e3a40'; x.fillRect(0, 70, 512, 170); x.fillStyle = '#4a464c'; for (let i = 0; i < 512; i += 24) { x.fillRect(i, 58, 14, 14); } x.fillStyle = '#2a262c'; for (let j = 80; j < 240; j += 12) for (let i = (j / 12) % 2 ? 0 : 12; i < 512; i += 24) x.fillRect(i, j, 1, 12); for (let j = 80; j < 240; j += 12) x.fillRect(0, j, 512, 1); x.fillStyle = '#1a161c'; x.beginPath(); x.moveTo(220, 240); x.lineTo(220, 150); x.quadraticCurveTo(256, 120, 292, 150); x.lineTo(292, 240); x.fill(); return c; })(), f: 0.2, y: 0 },
    ] },
  };

  A.makeBackground = function (name) {
    const b = BGS[name] || BGS.coast;
    if (!b._layers) b._layers = b.layers();
    return b;
  };

  A.drawBackground = function (x, name, camX, camY, W, H, t) {
    const b = A.makeBackground(name);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, b.sky[0]); g.addColorStop(1, b.sky[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    if (b.stars) {
      const r = G.rng(5);
      for (let i = 0; i < 70; i++) {
        const sx = r() * W, sy = r() * H * 0.6, tw = (Math.sin(t * 2 + i) + 1) / 2;
        x.fillStyle = `rgba(255,255,240,${0.3 + tw * 0.6})`; x.fillRect(sx | 0, sy | 0, 1, 1);
      }
    }
    if (b.moon) { x.fillStyle = '#f4f0d8'; x.beginPath(); x.arc(W * 0.78, 40, 14, 0, Math.PI * 2); x.fill(); x.fillStyle = b.sky[0]; x.beginPath(); x.arc(W * 0.78 + 6, 36, 12, 0, Math.PI * 2); x.fill(); }
    if (b.sun) { x.fillStyle = b.sun; x.beginPath(); x.arc(W * 0.8, 46, 16, 0, Math.PI * 2); x.fill(); x.fillStyle = 'rgba(255,250,220,0.25)'; x.beginPath(); x.arc(W * 0.8, 46, 24, 0, Math.PI * 2); x.fill(); }
    b._layers.forEach((L) => {
      const lw = L.c.width;
      let ox = -((camX * L.f) % lw);
      if (ox > 0) ox -= lw;
      const oy = L.tileY ? -((camY * L.f) % L.c.height) : Math.round(-camY * L.f * 0.3) + (L.y || 0);
      for (let px = Math.floor(ox); px < W; px += lw) {
        if (L.tileY) { for (let py = oy - L.c.height; py < H; py += L.c.height) x.drawImage(L.c, px, Math.floor(py)); }
        else x.drawImage(L.c, px, oy);
      }
    });
  };

  /* ---------- Декорации (дома, шатры, деревья, ворота) ---------- */
  A.drawDecor = function (x, d, px, py, t) {
    switch (d.type) {
      case 'house': { // абхазский дом-апацха: плетёные стены, соломенная крыша
        x.fillStyle = OUT; x.fillRect(px - 1, py - 33, 50, 34);
        x.fillStyle = '#c8a070'; x.fillRect(px, py - 32, 48, 32);
        x.fillStyle = '#a07a4a'; for (let i = 0; i < 48; i += 4) x.fillRect(px + i, py - 32, 1, 32);
        for (let j = 0; j < 32; j += 6) { x.fillStyle = '#b88c58'; x.fillRect(px, py - 32 + j, 48, 2); }
        x.fillStyle = '#3a2416'; x.fillRect(px + 18, py - 20, 12, 20);
        x.fillStyle = OUT; x.beginPath(); x.moveTo(px - 8, py - 31); x.lineTo(px + 24, py - 58); x.lineTo(px + 56, py - 31); x.fill();
        x.fillStyle = '#d8b860'; x.beginPath(); x.moveTo(px - 5, py - 32); x.lineTo(px + 24, py - 55); x.lineTo(px + 53, py - 32); x.fill();
        x.fillStyle = '#b8984a'; for (let i = 0; i < 6; i++) x.fillRect(px + 2 + i * 8, py - 36 - (i < 3 ? i * 4 : (5 - i) * 4), 6, 1);
        break;
      }
      case 'fence': {
        x.fillStyle = '#7a5530';
        for (let i = 0; i < d.w * 16; i += 6) x.fillRect(px + i, py - 12, 2, 12);
        x.fillRect(px, py - 9, d.w * 16, 2); x.fillRect(px, py - 4, d.w * 16, 2);
        break;
      }
      case 'tree': {
        x.fillStyle = '#4a3020'; x.fillRect(px + 6, py - 30, 6, 30);
        x.fillStyle = '#2e6a2a'; x.beginPath(); x.arc(px + 9, py - 38, 16, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#3e8a34'; x.beginPath(); x.arc(px + 4, py - 42, 9, 0, Math.PI * 2); x.fill();
        break;
      }
      case 'darktree': {
        x.fillStyle = '#1a1420'; x.fillRect(px + 5, py - 60, 8, 60);
        x.fillStyle = '#14202a'; x.beginPath(); x.arc(px + 9, py - 66, 22, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.arc(px - 6, py - 54, 14, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(px + 24, py - 56, 14, 0, Math.PI * 2); x.fill();
        break;
      }
      case 'tent': {
        x.fillStyle = OUT; x.beginPath(); x.moveTo(px - 2, py); x.lineTo(px + 24, py - 34); x.lineTo(px + 50, py); x.fill();
        x.fillStyle = d.col || '#d8cdb0'; x.beginPath(); x.moveTo(px + 1, py); x.lineTo(px + 24, py - 31); x.lineTo(px + 47, py); x.fill();
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.moveTo(px + 24, py - 31); x.lineTo(px + 47, py); x.lineTo(px + 30, py); x.fill();
        x.fillStyle = '#2a1e14'; x.beginPath(); x.moveTo(px + 18, py); x.lineTo(px + 24, py - 14); x.lineTo(px + 30, py); x.fill();
        break;
      }
      case 'campfire': {
        x.fillStyle = '#4a3020'; x.fillRect(px + 2, py - 3, 12, 3);
        const h = 6 + Math.sin(t * 14 + px) * 2;
        x.fillStyle = '#e84a1a'; x.fillRect(px + 4, py - 3 - h, 8, h);
        x.fillStyle = '#ffc040'; x.fillRect(px + 6, py - 3 - h + 3, 4, h - 3);
        break;
      }
      case 'banner': {
        x.fillStyle = '#5a3a1a'; x.fillRect(px + 7, py - 40, 2, 40);
        const wv = Math.sin(t * 4) * 2;
        x.fillStyle = d.col || '#e8e2d0'; x.beginPath(); x.moveTo(px + 9, py - 40); x.lineTo(px + 28, py - 36 + wv); x.lineTo(px + 9, py - 28); x.fill();
        break;
      }
      case 'wallbg': { // кладка крепости на заднем плане
        x.fillStyle = '#6a6258'; x.fillRect(px, py - d.h * 16, d.w * 16, d.h * 16);
        x.fillStyle = '#5a5248';
        for (let j = 0; j < d.h * 16; j += 8) { x.fillRect(px, py - d.h * 16 + j, d.w * 16, 1); for (let i = (j / 8) % 2 ? 0 : 6; i < d.w * 16; i += 12) x.fillRect(px + i, py - d.h * 16 + j, 1, 8); }
        x.fillStyle = '#7a7268'; for (let i = 0; i < d.w * 16; i += 16) x.fillRect(px + i, py - d.h * 16 - 8, 10, 8);
        break;
      }
      case 'column': {
        x.fillStyle = '#3e2a1a'; x.fillRect(px + 4, py - d.h * 16, 8, d.h * 16);
        x.fillStyle = '#5a3e26'; x.fillRect(px + 5, py - d.h * 16, 2, d.h * 16);
        break;
      }
      case 'stalag': {
        x.fillStyle = '#3a3044'; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 8, py - 20 - (d.h || 0)); x.lineTo(px + 16, py); x.fill();
        break;
      }
      case 'sleeper': {
        x.fillStyle = '#5a4a3a'; x.fillRect(px - 2, py - 4, 22, 4);
        x.fillStyle = '#e6dfcc'; x.fillRect(px, py - 8, 14, 5);
        x.fillStyle = '#a9b1bb'; x.fillRect(px + 13, py - 9, 6, 6);
        x.fillStyle = '#d9a77d'; x.fillRect(px + 14, py - 6, 4, 3);
        if (Math.floor(t * 1.5) % 2 === 0) { x.fillStyle = '#c8d8ff'; x.font = '8px monospace'; x.fillText('z', px + 18, py - 12 - (t * 6 % 6)); }
        break;
      }
      default: break;
    }
  };
})();
