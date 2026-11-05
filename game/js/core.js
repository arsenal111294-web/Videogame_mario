/* Анакопиа — ядро: константы, утилиты, сохранения, ввод */
'use strict';
(function () {
  const G = (window.G = {});
  G.T = 16;            // размер тайла в пикселях
  G.VH = 176;          // высота экрана в игровых единицах (11 рядов тайлов — крупный план)
  G.RES = 4;           // пикселей холста на игровую единицу (снижается автоматически на слабых телефонах)
  G.snap = (v) => Math.round(v * G.RES) / G.RES;
  G.STEP = 1 / 60;     // фиксированный шаг симуляции

  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
  G.rr = (a, b) => a + Math.random() * (b - a);
  G.ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  G.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  G.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  G.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- Сохранения ---------- */
  const SAVE_KEY = 'anakopia_save_v1';
  G.save = {
    data: null,
    defaults() {
      return { unlocked: 1, strings: {}, best: {}, done: {}, music: true, sfx: true, vibro: true, lives: 5, seenEnding: false };
    },
    load() {
      let d = null;
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        d = raw ? JSON.parse(raw) : null;
      } catch (e) { d = null; }
      this.data = Object.assign(this.defaults(), d || {});
      return this.data;
    },
    write() {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* хранилище недоступно */ }
    },
    reset() {
      const keep = { music: this.data.music, sfx: this.data.sfx, vibro: this.data.vibro };
      this.data = Object.assign(this.defaults(), keep);
      this.write();
    },
    stringsOf(id) {
      return this.data.strings[id] || [false, false, false];
    },
    totalStrings() {
      let n = 0;
      for (const k in this.data.strings) n += this.data.strings[k].filter(Boolean).length;
      return n;
    },
  };

  /* ---------- Вибрация ---------- */
  G.vibrate = function (ms) {
    if (!G.save.data || !G.save.data.vibro) return;
    try {
      if (window.Android && window.Android.vibrate) window.Android.vibrate(ms | 0);
      else if (navigator.vibrate) navigator.vibrate(ms | 0);
    } catch (e) { /* нет вибрации */ }
  };

  /* ---------- Ввод ---------- */
  const I = (G.input = {
    down: {},
    latch: {},
    taps: [],
    stick: { x: 0, y: 0, active: false },
    touchMode: false,
  });
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
    KeyX: 'action', KeyJ: 'action', KeyC: 'action',
    Escape: 'pause', KeyP: 'pause',
    Enter: 'confirm',
  };
  // запасная раскладка по e.key: у событий от внешних клавиатур и adb на Android e.code бывает пустым
  const KEYMAP2 = {
    arrowleft: 'left', left: 'left', a: 'left', ф: 'left',
    arrowright: 'right', right: 'right', d: 'right', в: 'right',
    arrowup: 'up', up: 'up', w: 'up', ц: 'up',
    arrowdown: 'down', down: 'down', s: 'down', ы: 'down',
    ' ': 'jump', spacebar: 'jump', z: 'jump', k: 'jump', я: 'jump', л: 'jump',
    x: 'action', j: 'action', c: 'action', ч: 'action', о: 'action', с: 'action',
    escape: 'pause', esc: 'pause', p: 'pause', з: 'pause',
    enter: 'confirm',
  };
  const keyOf = (e) => KEYMAP[e.code] || KEYMAP2[(e.key || '').toLowerCase()];
  I.press = function (name) {
    if (!I.down[name]) I.latch[name] = true;
    I.down[name] = true;
  };
  I.release = function (name) { I.down[name] = false; };
  I.pressed = (name) => !!I.latch[name];
  I.held = (name) => !!I.down[name];
  I.consume = function (name) { const v = !!I.latch[name]; I.latch[name] = false; return v; };
  I.endStep = function () { I.latch = {}; I.taps.length = 0; };
  I.clearAll = function () {
    I.down = {}; I.latch = {}; I.taps.length = 0;
    I.stick.x = 0; I.stick.y = 0; I.stick.active = false;
    if (I.onClear) I.onClear();
  };

  window.addEventListener('keydown', (e) => {
    const k = keyOf(e);
    if (!k) return;
    e.preventDefault();
    if (e.repeat) return;
    I.touchMode = false;
    I.press(k);
    if (G.onKey) G.onKey(k);
  });
  window.addEventListener('keyup', (e) => {
    const k = keyOf(e);
    if (!k) return;
    e.preventDefault();
    I.release(k);
  });
  window.addEventListener('blur', () => I.clearAll());

  /* Сенсорное управление: плавающий джойстик + кнопки */
  G.setupTouch = function () {
    const zone = document.getElementById('stick-zone');
    const base = document.getElementById('stick-base');
    const knob = document.getElementById('stick-knob');
    let stickId = null, ox = 0, oy = 0;
    const R = 42;
    const homeBase = () => { base.style.left = ''; base.style.top = ''; base.classList.remove('active'); knob.style.transform = 'translate(-50%,-50%)'; };
    const applyStick = () => {
      const s = I.stick;
      const set = (n, v) => { if (v) I.press(n); else I.release(n); };
      set('left', s.x < -0.35);
      set('right', s.x > 0.35);
      set('up', s.y < -0.55);
      set('down', s.y > 0.55);
    };
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (G.audio) G.audio.unlock();
      I.touchMode = true;
      if (stickId !== null) return;
      stickId = e.pointerId;
      try { zone.setPointerCapture(e.pointerId); } catch (er) { /* */ }
      const r = zone.getBoundingClientRect();
      ox = e.clientX; oy = e.clientY;
      base.style.left = (e.clientX - r.left) + 'px';
      base.style.top = (e.clientY - r.top) + 'px';
      base.classList.add('active');
      I.stick.active = true; I.stick.x = 0; I.stick.y = 0;
      applyStick();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stickId) return;
      e.preventDefault();
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      I.stick.x = dx / R; I.stick.y = dy / R;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      applyStick();
    });
    const endStick = (e) => {
      if (e.pointerId !== stickId) return;
      stickId = null;
      I.stick.active = false; I.stick.x = 0; I.stick.y = 0;
      applyStick();
      homeBase();
    };
    zone.addEventListener('pointerup', endStick);
    zone.addEventListener('pointercancel', endStick);
    I.onClear = () => { stickId = null; homeBase(); };

    const bindBtn = (id, name) => {
      const el = document.getElementById(id);
      const ids = new Set();
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (G.audio) G.audio.unlock();
        I.touchMode = true;
        ids.add(e.pointerId);
        try { el.setPointerCapture(e.pointerId); } catch (er) { /* */ }
        el.classList.add('down');
        I.press(name);
      });
      const up = (e) => {
        if (!ids.has(e.pointerId)) return;
        ids.delete(e.pointerId);
        if (ids.size === 0) { el.classList.remove('down'); I.release(name); }
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    bindBtn('btn-jump', 'jump');
    bindBtn('btn-action', 'action');

    /* Касание по игровому полю (режим обороны стен: бросок камня в точку) */
    const canvas = document.getElementById('game');
    canvas.addEventListener('pointerdown', (e) => {
      if (G.audio) G.audio.unlock();
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * (canvas.width / G.RES);
      const y = ((e.clientY - r.top) / r.height) * (canvas.height / G.RES);
      I.taps.push({ x, y });
    });
  };
})();
