/* Анакопиа — главный цикл, экраны, сюжет, HUD, сохранения прогресса */
'use strict';
(function () {
  const G = window.G, A = G.art, E = G.ent, T = G.T, I = G.input;
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  // холст без прозрачности и с низкой задержкой вывода (быстрее реагирует на касания)
  let ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d');
  let W = 427;
  let H = G.VH;
  const MENU_VIEW = 176;
  /* Высота кадра в игровых единицах: крупный план в обычных главах, шире там, где нужен обзор */
  function setView(h) {
    if (G.VH === h && H === h) return;
    G.VH = h; H = h;
    resize();
  }
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const portraits = {};
  const log = (...a) => { try { console.info('[anakopia]', ...a); } catch (e) { /* */ } };
  const portrait = (who) => portraits[who] || (portraits[who] = A.portrait(who));

  /* Вспышка молнии от пера Аҩы */
  class Bolt extends E.Ent {
    constructor(x, y) { super(x, y, 0, 0); this.front = true; this.life = 0.35; }
    update(dt) { this.t += dt; if (this.t > this.life) this.dead = true; }
    draw(x) {
      const W0 = this.world;
      x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath();
      let px = this.x, py = W0.camY - 4; x.moveTo(px, py);
      while (py < this.y) { py += 12; px = this.x + G.rr(-6, 6); x.lineTo(px, Math.min(py, this.y)); }
      x.stroke(); x.strokeStyle = 'rgba(160,210,255,0.6)'; x.lineWidth = 5; x.stroke();
    }
  }

  const game = (G.game = {
    state: 'boot', world: null, idx: 0, lives: 5, coins: 0, score: 0, checkpoint: null,
    deathT: 0, godMode: false, hintT: 0, sayT: 0, story: null, time: 0, doneT: 0,
    hudCache: {},

    /* ---------- Экраны ---------- */
    show(id) {
      log('screen', id || 'play', 'state', this.state);
      document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
      const playing = id === null;
      $('hud').classList.toggle('hidden', !playing && id !== 'scr-pause');
      $('touch').classList.toggle('hidden', !(playing && isTouch));
      if (!playing) { $('hint').classList.add('hidden'); }
      I.clearAll();
    },

    toTitle() {
      this.state = 'title'; this.world = null;
      setView(MENU_VIEW);
      this.show('scr-title');
      const sv = G.save.data;
      $('b-continue').classList.toggle('hidden', !(sv.unlocked > 1));
      $('b-continue').textContent = sv.unlocked > 1 ? `Продолжить: глава ${Math.min(sv.unlocked, G.LEVELS.length)}` : 'Продолжить';
      G.audio.music('title');
    },

    openLevels() {
      this.state = 'menu';
      const list = $('level-list'); list.innerHTML = '';
      G.LEVELS.forEach((L, i) => {
        const b = document.createElement('button');
        b.className = 'lvl';
        const st = G.save.stringsOf(L.id).filter(Boolean).length;
        const locked = i + 1 > G.save.data.unlocked;
        b.disabled = locked;
        b.innerHTML = `<small>Глава ${i + 1}</small><b>${locked ? '???' : L.title}</b><span class="st">${locked ? 'закрыто' : `струны: ${st}/3${G.save.data.done[L.id] ? ' · пройдено' : ''}`}</span>`;
        b.addEventListener('click', () => { G.audio.sfx('select'); this.lives = 5; this.startLevel(i, true); });
        list.appendChild(b);
      });
      this.show('scr-levels');
    },

    /* ---------- Сюжет ---------- */
    playStory(lines, done, bg) {
      if (!lines || !lines.length) { done(); return; }
      this.state = 'story';
      this.story = { lines, i: 0, done, bg: bg || 'fortress', shown: 0, typing: true };
      this.show('scr-story');
      G.audio.music('title');
      this.showLine();
    },
    showLine() {
      const s = this.story, [who, text] = s.lines[s.i];
      $('story-img').src = portrait(who);
      $('story-who').textContent = G.WHO[who] || who;
      s.full = text; s.shown = 0; s.typing = true;
      $('story-text').textContent = '';
    },
    advanceStory() {
      const s = this.story;
      if (!s) return;
      if (s.typing) { s.typing = false; s.shown = s.full.length; $('story-text').textContent = s.full; return; }
      s.i++;
      G.audio.sfx('select');
      if (s.i >= s.lines.length) { this.story = null; s.done(); return; }
      this.showLine();
    },
    skipStory() { const s = this.story; if (!s) return; this.story = null; s.done(); },

    /* ---------- Уровни ---------- */
    startLevel(i, withIntro) {
      this.idx = i;
      this.checkpoint = null;
      const def = G.LEVELS[i];
      if (withIntro && def.intro) this.playStory(def.intro, () => this.beginLevel(i), def.bg);
      else this.beginLevel(i);
    },

    beginLevel(i) {
      const def0 = G.LEVELS[i];
      const def = Object.assign({}, def0);
      this.idx = i;
      setView(def.viewH || 136);
      this.buildWorld(def);
      this.state = 'play';
      this.deathT = 0; this.doneT = 0; this.completing = false;
      this.show(null);
      this.hudCache = {};
      G.audio.music(def.music);
      const bn = $('banner');
      $('banner-num').textContent = `Глава ${i + 1}`;
      $('banner-title').textContent = def.title;
      $('banner-sub').textContent = def.sub || '';
      bn.classList.remove('hidden'); bn.style.animation = 'none'; void bn.offsetWidth; bn.style.animation = '';
      clearTimeout(this.bannerTimer);
      this.bannerTimer = setTimeout(() => bn.classList.add('hidden'), 2700);
      $('ico-coin').src = A.icons.coin;
      document.querySelector('.ico-head').style.backgroundImage = `url(${portrait(def.hero)})`;
    },

    buildWorld(def) {
      const rows = def.mode === 'siege' ? G.buildSiege(def, Math.ceil(W / T)) : def.map();
      const data = G.parseMap(rows);
      const decor = (def.decor || []).map((d) => ({ type: d[0], x: d[1], y: d[2], w: typeof d[3] === 'number' ? d[3] : 1, col: typeof d[3] === 'string' ? d[3] : undefined }));
      const w = new G.World(def, { w: data.w, h: data.h, tiles: data.tiles, blockItems: {}, decor });
      this.world = w;
      w.strings = G.save.stringsOf(def.id).slice();
      w.foundNow = [false, false, false];
      let signI = 0, platI = 0, start = { x: 2 * T, y: 10 * T };
      for (const s of data.spawns) {
        const px = s.x * T, py = s.y * T;
        switch (s.ch) {
          case '@': start = { x: px + 3, y: py + 2 }; break;
          case 'E': w.add(new E.Exit(px - 8, py, def.exitStyle)); break;
          case '!': w.add(new E.Checkpoint(px, py)); break;
          case 'o': w.add(new E.Coin(px, py)); break;
          case 'i': w.add(new E.Sign(px, py, (def.signs || [])[signI++] || '')); break;
          case '1': case '2': case '3': w.add(new E.StringItem(px, py, +s.ch - 1)); break;
          case 's': w.add(new E.Soldier(px + 3, py + 2)); break;
          case 'p': w.add(new E.Spearman(px + 3, py + 2)); break;
          case 'a': w.add(new E.Archer(px + 3, py + 2)); break;
          case 'd': w.add(new E.ShieldBearer(px + 3, py + 2)); break;
          case 'r': w.add(new E.Rider(px + 3, py + 2)); break;
          case 'b': w.add(new E.Bat(px, py)); break;
          case 'k': w.add(new E.Boar(px + 3, py + 2)); break;
          case 'f': w.add(new E.Fish(px, py)); break;
          case 't': w.add(new E.Stalactite(px, py)); break;
          case 'g': w.add(new E.Guard(px + 3, py + 2, 3)); break;
          case 'c': w.add(new E.Catapult(px + 8, py)); break;
          case 'z': w.decor.push({ type: 'sleeper', x: s.x, y: s.y }); break;
          case 'm': { const p = (def.plats || [])[platI++] || [3, 4, 0, 0.4]; w.add(new E.MovingPlatform(px, py, p[0], p[1], p[2], p[3])); break; }
          case 'v': w.add(new E.MovingPlatform(px, py, 3, 0, 3, 0.4)); break;
          case 'x': w.add(new E.FallingLog(px, py, 2)); break;
          case 'j': w.add(new E.Spring(px, py)); break;
          case 'u': w.add(new E.Cart(px + 8, py)); break;
          case 'l': w.add(new E.Rope(px, py)); break;
          case 'G': w.add(new E.SiegeMaster(px + 3, py + 2)); break;
          case 'Z': w.add(new E.Marwan(px + 8, py + 2)); break;
          case 'h': w.add(new E.PowerItem(px + 2, py + 2, 'honey', false)); break;
          default: break;
        }
      }
      w.startPos = start;
      if (def.mode === 'siege') {
        w.add(new E.SiegeDirector(def));
        const leon = new E.NPC(1 * T + 3, (def.wallTopRow - 1) * T, 'leon', '');
        leon.update = function () { this.face = 1; };
        w.add(leon);
      }
      if (def.autoscroll) { w.scrollX = 0; w.scrollDelay = 2.2; w.add(new E.Abnauaiu()); }
      if (def.stoneRain) w.add(new E.StoneRain(def.stoneRain));
      if (def.objective) {
        const o = def.objective;
        w.objective = { done: () => (w.objDone || 0) >= o.need };
        w.objectiveLabel = () => `${o.label}: ${w.objDone || 0}/${o.total || o.need}`;
      }
      this.spawnPlayer(start);
      const p = w.player;
      w.camX = p.x - W / 2; w.camY = p.y - H / 2;
      w.updateCamera(p, W, H, 1);
      if (def.mode === 'siege') { w.camX = 0; w.camY = Math.max(0, w.ph - H); }
      return w;
    },

    spawnPlayer(pos, keep) {
      const w = this.world, def = w.def;
      const old = w.player;
      const p = new E.Player(pos.x, pos.y, def.hero, { horse: def.horse, maxHp: old ? old.maxHp : 3 });
      p.world = w; w.player = p;
      if (keep) p.inv = 2;
      return p;
    },

    respawnPos() {
      const cp = this.checkpoint;
      if (!cp) return this.world.startPos;
      return { x: cp.x + 3, y: cp.y + 24 - 16 };
    },

    respawn() {
      const w = this.world;
      const p = this.spawnPlayer(this.respawnPos(), true);
      for (const e of w.entities) {
        if (e.enemyShot || e instanceof E.Fireball || e instanceof E.Arrow) e.dead = true;
        if (e instanceof E.Guard) { e.alert = 0; e.pause = 1; }
      }
      if (w.def.autoscroll) { w.scrollX = Math.max(0, p.x - 90); w.scrollDelay = 1.2; }
      w.camX = p.x - W / 2; w.camY = p.y - H / 2;
      w.updateCamera(p, W, H, 1);
      if (w.def.autoscroll) w.camX = w.scrollX;
      this.state = 'play';
    },

    /* ---------- События игры ---------- */
    onPlayerDeath() { this.deathT = 0.0001; },

    handleDeath() {
      this.deathT = 0;
      this.lives--;
      if (this.lives < 0) { this.gameOver(); return; }
      const def = this.world.def;
      if (def.mode === 'siege' || def.boss) { this.beginLevel(this.idx); return; }
      this.respawn();
      this.flash(`Жизней: ${this.lives}`);
    },

    gameOver() {
      this.state = 'over';
      G.audio.music('gameover');
      $('over-title').textContent = 'Песня оборвалась…';
      $('over-text').textContent = 'Но сказительница помнит, как было дальше. Попробуешь снова?';
      this.show('scr-over');
    },

    failLevel(msg) {
      const p = this.world && this.world.player;
      this.flash(msg);
      if (p && !p.dead) { p.inv = 0; p.shieldT = 0; p.die('fail'); }
    },

    onCaught() {
      const w = this.world, p = w.player;
      if (!p || p.dead || p.inv > 0 || this.state !== 'play') return;
      G.audio.sfx('alarm');
      this.flash('Тебя заметили!');
      w.flash = 0.3;
      p.hurt({ cx: p.cx + 1 });
      if (p.dead) return;
      const pos = this.respawnPos();
      p.x = pos.x; p.y = pos.y; p.vx = 0; p.vy = 0; p.inv = 2;
      for (const e of w.entities) if (e instanceof E.Guard) { e.alert = 0; e.pause = 1.2; }
    },

    setCheckpoint(cp) { this.checkpoint = cp; },
    addCoin(n) {
      this.coins += n; this.score += 10 * n;
      if (this.world) this.world.coins += n;
      if (this.coins >= 100) { this.coins -= 100; this.addLife(); }
    },
    addLife() { this.lives++; G.audio.sfx('life'); this.flash('+1 жизнь'); },
    shieldMusic() {},
    restoreMusic() {},
    storm() { const w = this.world; w.def.rain = true; w.flash = 1; G.audio.sfx('lightning'); },

    thunder() {
      const w = this.world;
      w.flash = 0.9; w.shake = 0.5;
      G.audio.sfx('lightning'); G.vibrate(120);
      this.flash('Гром Аҩы!');
      for (const e of w.entities) {
        if (!e.enemy || e.dead || e.boss || e.kind === 'rope' || e.kind === 'cart') continue;
        if (e.x < w.camX - 20 || e.x > w.camX + W + 20 || e.y < w.camY - 40 || e.y > w.camY + H + 20) continue;
        w.add(new Bolt(e.cx, e.y + e.h));
        e.hit(0, 'lightning');
      }
    },

    onObjective() {
      const w = this.world, o = w.def.objective;
      if (!o) return;
      if (o.autoComplete && (w.objDone || 0) >= o.need) {
        w.shake = 2.5; G.audio.sfx('boom'); this.flash('Башня рушится!');
        setTimeout(() => this.levelComplete(), 1800);
      } else if (o.need && (w.objDone || 0) === o.need) {
        this.flash('Путь открыт!'); G.audio.sfx('gate');
      }
    },

    onBossDefeated(b) {
      const w = this.world;
      w.flash = 0.6;
      if (b instanceof E.Marwan) this.say('marwan', 'Нет… Эта гора проклята! Отступаем!');
      else this.say('astamur', 'Мастер повержен! Теперь — канаты!');
    },

    levelComplete() {
      if (this.state !== 'play' || this.completing) return;
      this.completing = true;
      const w = this.world, def = w.def, sv = G.save.data;
      G.audio.music('victory', true);
      const prev = G.save.stringsOf(def.id);
      sv.strings[def.id] = prev.map((v, k) => v || w.strings[k]);
      sv.unlocked = Math.max(sv.unlocked, Math.min(G.LEVELS.length, this.idx + 2));
      sv.done[def.id] = true;
      sv.best[def.id] = Math.max(sv.best[def.id] || 0, this.score);
      G.save.write();
      this.doneT = 1.3;
      this.state = 'completing';
    },

    showComplete() {
      const w = this.world, def = w.def;
      this.state = 'complete';
      $('cmp-num').textContent = `Глава ${this.idx + 1} пройдена`;
      $('cmp-title').textContent = def.title;
      $('cmp-coins').textContent = w.coins;
      $('cmp-score').textContent = this.score;
      const st = G.save.stringsOf(def.id);
      $('cmp-strings').innerHTML = st.map((v) => `<img src="${A.icons.string}" class="${v ? '' : 'off'}" alt="">`).join('');
      this.show('scr-complete');
      $('hud').classList.add('hidden');
    },

    nextAfterComplete() {
      const def = G.LEVELS[this.idx];
      const last = this.idx >= G.LEVELS.length - 1;
      this.playStory(def.outro, () => {
        if (last) this.ending();
        else this.startLevel(this.idx + 1, true);
      }, def.bg);
    },

    ending() {
      const all = G.save.totalStrings() >= 27;
      const lines = G.ENDING.concat([all ? G.ENDING_ALL : G.ENDING_SOME]);
      this.playStory(lines, () => {
        this.state = 'ending';
        this.world = null;
        G.save.data.seenEnding = true; G.save.write();
        $('end-stats').textContent = `Струн апхьарцы найдено: ${G.save.totalStrings()} из 27 · очки: ${this.score}`;
        this.show('scr-ending');
        G.audio.music(all ? 'ending' : 'title');
      }, 'fortress');
    },

    pause() {
      if (this.state !== 'play') return;
      this.state = 'paused';
      $('pause-level').textContent = `Глава ${this.idx + 1}: ${this.world.def.title}`;
      this.updateSoundBtn();
      this.show('scr-pause');
      G.audio.suspend();
    },
    resume() {
      if (this.state !== 'paused') return;
      this.state = 'play';
      this.show(null);
      G.audio.resume();
    },
    updateSoundBtn() {
      const on = G.save.data.music || G.save.data.sfx;
      $('b-toggle-sound').textContent = on ? 'Звук: вкл' : 'Звук: выкл';
    },

    /* ---------- Подсказки ---------- */
    showHint(text) {
      if (!text) return;
      const el = $('hint');
      if (el.textContent !== text) el.textContent = text;
      el.classList.remove('hidden');
      this.hintT = 0.25;
    },
    say(who, text, short) {
      $('say-img').src = portrait(who);
      $('say-who').textContent = G.WHO[who] || who;
      $('say-text').textContent = text;
      $('say').classList.remove('hidden');
      this.sayT = short ? 2.6 : Math.max(3, text.length / 14);
    },
    flash(text) {
      const el = $('flashmsg');
      el.textContent = text;
      el.classList.remove('hidden');
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => el.classList.add('hidden'), 1400);
    },

    /* ---------- Обновление ---------- */
    update(dt) {
      this.time += dt;
      if (I.pressed('pause')) {
        if (this.state === 'play') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (this.state === 'story') {
        const s = this.story;
        if (s && s.typing) {
          s.shown += dt * 55;
          if (s.shown >= s.full.length) { s.shown = s.full.length; s.typing = false; }
          $('story-text').textContent = s.full.slice(0, Math.floor(s.shown));
        }
        if (I.pressed('confirm') || I.pressed('jump') || I.pressed('action')) this.advanceStory();
        return;
      }
      if (this.state === 'completing') {
        this.world.time += dt; this.world.updateParticles(dt);
        this.doneT -= dt;
        if (this.doneT <= 0) this.showComplete();
        return;
      }
      if (this.state !== 'play') return;
      const w = this.world, p = w.player, def = w.def;
      w.time += dt;
      w.viewW = W;
      const camL = w.camX - 200, camR = w.camX + W + 200, camT = w.camY - 200, camB = w.camY + H + 200;
      const list = w.entities;
      for (let i = 0, n = list.length; i < n; i++) {
        const e = list[i];
        if (e.dead) continue;
        if ((e.enemy || e.platform || e.item) && !e.boss && (e.x + e.w < camL || e.x > camR || e.y + e.h < camT || e.y > camB)) continue;
        e.update(dt);
      }
      p.update(dt);
      E.interact(w);
      w.updateParticles(dt);
      if (list.some((e) => e.dead)) w.entities = list.filter((e) => !e.dead);
      // камера
      if (def.mode === 'siege') { w.camX = 0; w.camY = Math.max(0, w.ph - H); }
      else if (def.autoscroll) {
        if (w.scrollDelay > 0) w.scrollDelay -= dt;
        else if (!p.dead) w.scrollX = Math.min(w.pw - W, w.scrollX + def.autoscroll * dt);
        w.updateCamera(p, W, H, dt, { autoX: w.scrollX });
        if (p.x + p.w > w.camX + W - 4) p.x = w.camX + W - 4 - p.w;
        const ab = w.entities.find((e) => e instanceof E.Abnauaiu);
        if (ab && w.scrollX >= w.pw - W - 1) ab.stopped = true;
      } else w.updateCamera(p, W, H, dt);
      if (w.shake > 0) w.shake -= dt;
      if (w.flash > 0) w.flash -= dt * 2.5;
      if (this.deathT > 0) { this.deathT += dt; if (this.deathT > 1.7) this.handleDeath(); }
      // всплывающие окна
      if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) $('hint').classList.add('hidden'); }
      if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) $('say').classList.add('hidden'); }
      this.updateHud();
    },

    updateHud() {
      const w = this.world, p = w.player, c = this.hudCache;
      const hk = p.hp + '/' + p.maxHp + (p.power || '');
      if (c.h !== hk) {
        c.h = hk;
        let s = '';
        for (let i = 0; i < p.maxHp; i++) s += `<img src="${i < p.hp ? A.icons.heart : A.icons.heartEmpty}" alt="">`;
        if (p.power === 'fire') s += `<img src="${A.icons.pepper}" alt="">`;
        $('hud-hearts').innerHTML = s;
      }
      if (c.l !== this.lives) { c.l = this.lives; $('hud-lives').textContent = Math.max(0, this.lives); }
      if (c.c !== this.coins) { c.c = this.coins; $('hud-coins').textContent = this.coins; }
      const sk = w.strings.join();
      if (c.s !== sk) {
        c.s = sk;
        $('hud-strings').innerHTML = w.strings.map((v) => `<img src="${A.icons.string}" class="${v ? '' : 'off'}" alt="">`).join('');
      }
      const ot = w.objectiveText || (w.objectiveLabel ? w.objectiveLabel() : '');
      if (c.o !== ot) { c.o = ot; $('hud-objective').textContent = ot; }
      const b = w.boss && !w.boss.dead && w.bossActive ? w.boss : null;
      const bk = b ? b.name + b.hp : '';
      if (c.b !== bk) {
        c.b = bk;
        $('boss-bar').classList.toggle('hidden', !b);
        if (b) { $('boss-name').textContent = b.name; $('boss-fill').style.width = (100 * Math.max(0, b.hp)) / b.maxHp + '%'; }
      }
    },

    /* ---------- Отрисовка ---------- */
    render() {
      ctx.setTransform(G.RES, 0, 0, G.RES, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const w = this.world;
      if (w && (this.state === 'play' || this.state === 'paused' || this.state === 'completing' || this.state === 'complete' || this.state === 'over' || (this.state === 'story' && w))) {
        w.render(ctx, W, H);
        return;
      }
      // фоновая сцена меню и сказаний
      const t = this.time;
      const bg = this.state === 'story' && this.story ? this.story.bg : 'title';
      A.drawBackground(ctx, bg, t * 18, 0, W, H, t);
      // земля из тайлов (если нет рисованного фона со своей землёй)
      const painted = A.paintBg && A.paintBg[bg === 'title' ? 'title' : bg];
      const gy = painted ? H - 12 : H - 30;
      if (painted) {
        const gr = ctx.createLinearGradient(0, H - 60, 0, H);
        gr.addColorStop(0, 'rgba(10,6,10,0)'); gr.addColorStop(1, 'rgba(10,6,10,0.55)');
        ctx.fillStyle = gr; ctx.fillRect(0, H - 60, W, 60);
      }
      for (let px = -((t * 18 * 0.9) % 16) - 16; !painted && px < W; px += 16) {
        const nb = { up: false, left: true, right: true, down: true };
        A.drawTile(ctx, '#', px, gy, A.THEMES.village, nb, G.rng(7), 'village');
        A.drawTile(ctx, '#', px, gy + 16, A.THEMES.village, { up: true, left: true, right: true, down: true }, G.rng(9), 'village');
      }
      if (!painted && (this.state === 'title' || this.state === 'menu' || this.state === 'ending' || this.state === 'boot')) {
        const run = ['run1', 'run2', 'run3', 'run4'][Math.floor(t * 8) % 4];
        const fr = A.get('astamur_run3') ? run : 'stand';
        const hero = (name, x0, face, f) => {
          const c = A.get(name + '_' + f, face);
          if (!c) return;
          ctx.save(); ctx.translate(x0, gy); ctx.scale(2.2, 2.2);
          ctx.imageSmoothingEnabled = true;
          A.blit(ctx, c, -8 + (c.ox || 0), -15 + (c.oy || 0));
          ctx.restore(); ctx.imageSmoothingEnabled = false;
        };
        hero('astamur', 38, 1, fr);
        hero('amra', 70, 1, fr);
        hero('leon', W - 40, -1, 'stand');
      }
    },
  });

  /* ---------- Размер экрана ---------- */
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const aspect = vw / Math.max(1, vh);
    W = G.clamp(Math.round(H * aspect), 260, 600);
    canvas.width = W * G.RES; canvas.height = H * G.RES;
    ctx.imageSmoothingEnabled = false;
    $('rotate').classList.toggle('hidden', aspect >= 1.05);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  /* ---------- Цикл ---------- */
  let last = performance.now(), acc = 0;
  /* Автокачество: если телефон не держит ~45 кадров/с, снижаем плотность холста */
  let perfT = 0, perfN = 0, perfSum = 0;
  function adaptQuality(dt) {
    if (game.state !== 'play') { perfT = 0; perfN = 0; perfSum = 0; return; }
    perfT += dt; perfN++; perfSum += dt;
    if (perfT < 2.5) return;
    const avg = perfSum / perfN;
    perfT = 0; perfN = 0; perfSum = 0;
    if (avg > 1 / 45 && G.RES > 2) {
      G.RES--;
      resize();
      if (game.world) game.world.prerender();
      console.info('[anakopia] качество снижено: RES', G.RES, 'кадр', Math.round(avg * 1000), 'мс');
    }
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    adaptQuality(dt);
    acc += dt;
    let steps = 0;
    while (acc >= G.STEP && steps < 6) {
      try { game.update(G.STEP); } catch (e) { console.error(e); }
      I.endStep();
      acc -= G.STEP; steps++;
    }
    if (steps >= 6) acc = 0;
    try { game.render(); } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }

  /* ---------- Кнопки интерфейса ---------- */
  function bind(id, fn) { $(id).addEventListener('click', (e) => { e.stopPropagation(); G.audio.unlock(); G.audio.sfx('select'); fn(); }); }
  function setupUI() {
    bind('b-new', () => { game.lives = 5; game.coins = 0; game.score = 0; game.startLevel(0, true); });
    bind('b-continue', () => { game.lives = 5; game.startLevel(Math.min(G.save.data.unlocked, G.LEVELS.length) - 1, true); });
    bind('b-levels', () => game.openLevels());
    bind('b-help', () => { game.state = 'menu'; game.show('scr-help'); });
    bind('b-about', () => { game.state = 'menu'; game.show('scr-about'); });
    bind('b-settings', () => {
      game.state = 'menu';
      $('set-music').checked = G.save.data.music; $('set-sfx').checked = G.save.data.sfx; $('set-vibro').checked = G.save.data.vibro;
      game.show('scr-settings');
    });
    ['music', 'sfx', 'vibro'].forEach((k) => $('set-' + k).addEventListener('change', (e) => { G.save.data[k] = e.target.checked; G.save.write(); G.audio.apply(); if (k === 'music' && e.target.checked) G.audio.music('title', true); }));
    bind('b-reset', () => {
      const btn = $('b-reset');
      if (btn.dataset.armed) { G.save.reset(); btn.dataset.armed = ''; btn.textContent = 'Прогресс сброшен'; }
      else { btn.dataset.armed = '1'; btn.textContent = 'Точно сбросить? Нажми ещё раз'; }
    });
    document.querySelectorAll('.back').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); G.audio.sfx('select'); $('b-reset').dataset.armed = ''; $('b-reset').textContent = 'Сбросить прогресс'; game.toTitle(); }));
    bind('b-skip', () => game.skipStory());
    $('scr-story').addEventListener('pointerdown', (e) => { if (e.target.id === 'b-skip') return; G.audio.unlock(); game.advanceStory(); });
    $('btn-pause').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); game.pause(); });
    bind('b-resume', () => game.resume());
    bind('b-restart', () => { G.audio.resume(); game.checkpoint = null; game.beginLevel(game.idx); });
    bind('b-toggle-sound', () => {
      const on = !(G.save.data.music || G.save.data.sfx);
      G.save.data.music = on; G.save.data.sfx = on; G.save.write(); G.audio.apply(); game.updateSoundBtn();
    });
    bind('b-menu', () => { G.audio.resume(); game.toTitle(); });
    bind('b-next', () => game.nextAfterComplete());
    bind('b-cmp-menu', () => game.toTitle());
    bind('b-retry', () => { game.lives = 5; game.checkpoint = null; game.beginLevel(game.idx); });
    bind('b-over-menu', () => game.toTitle());
    bind('b-end-menu', () => game.toTitle());
    document.addEventListener('pointerdown', () => G.audio.unlock(), { passive: true });
    document.addEventListener('keydown', () => G.audio.unlock());
  }

  /* ---------- Клавиатура в меню (Enter/Пробел) ---------- */
  G.onKey = function (k) {
    if (k !== 'confirm' && k !== 'jump') return;
    const s = game.state;
    if (s === 'title') $(G.save.data.unlocked > 1 ? 'b-continue' : 'b-new').click();
    else if (s === 'complete') $('b-next').click();
    else if (s === 'over') $('b-retry').click();
    else if (s === 'ending') $('b-end-menu').click();
  };

  /* ---------- Android: кнопка «Назад» и сворачивание ---------- */
  window.onAndroidBack = function () {
    const s = game.state;
    log('back', s);
    if (s === 'play') { game.pause(); return 'ok'; }
    if (s === 'paused') { game.resume(); return 'ok'; }
    if (s === 'story') { game.skipStory(); return 'ok'; }
    if (s === 'menu' || s === 'complete' || s === 'over' || s === 'ending') { game.toTitle(); return 'ok'; }
    return 'exit';
  };
  window.onAndroidPause = function () { if (game.state === 'play') game.pause(); G.audio.suspend(); };
  window.onAndroidResume = function () { if (game.state !== 'paused') G.audio.resume(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) window.onAndroidPause(); else window.onAndroidResume(); });

  /* ---------- Запуск ---------- */
  function boot() {
    G.save.load();
    A.init();
    resize();
    G.setupTouch();
    setupUI();
    const ld = $('loading');
    A.loadAssets((p) => { if (ld) ld.querySelector('i').style.width = Math.round(p * 100) + '%'; }).then(() => {
      if (ld) ld.classList.add('hidden');
      game.toTitle();
    });
    requestAnimationFrame(frame);
    // отладочный доступ для автотестов
    window.__anakopia = {
      game, G,
      warp(i) { game.lives = 5; game.startLevel(i, false); },
      complete() { game.levelComplete(); },
      god(v) { game.godMode = v !== false; },
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
