/* Анакопиа — мир уровня: тайлы, физика тел, камера, частицы, пререндер */
'use strict';
(function () {
  const G = window.G, A = G.art, T = G.T;

  class World {
    constructor(def, data) {
      this.def = def;
      this.w = data.w; this.h = data.h;
      this.tiles = data.tiles;          // массив строк-символов (одномерный)
      this.blockItems = data.blockItems; // содержимое блоков-тайников
      this.theme = A.THEMES[def.theme] || A.THEMES.village;
      this.entities = [];
      this.particles = [];
      this.floaters = [];
      this.decor = data.decor || [];
      this.lights = [];
      this.time = 0;
      this.shake = 0;
      this.camX = 0; this.camY = 0;
      this.pw = this.w * T; this.ph = this.h * T;
      this.coins = 0; this.score = 0;
      this.strings = [false, false, false];
      this.bumps = [];
      this.flash = 0;
      this.objective = null;
      this.dynamic = [];
      this.bushes = [];
      for (let i = 0; i < this.tiles.length; i++) {
        const ch = this.tiles[i];
        if (ch === 'w' || ch === '~' || ch === '%' || A.isBlock(ch)) this.dynamic.push(i);
        if (ch === '*') this.bushes.push(i);
        if (ch === 'K' || ch === 'T') this.lights.push({ x: (i % this.w) * T + 8, y: Math.floor(i / this.w) * T + 8, r: ch === 'K' ? 34 : 46, tile: true });
      }
      this.prerender();
    }

    idx(tx, ty) { return ty * this.w + tx; }
    tile(tx, ty) {
      if (tx < 0 || tx >= this.w) return 'X';
      if (ty < 0) return this.def.closedTop ? 'X' : ' ';
      if (ty >= this.h) return ' ';
      return this.tiles[ty * this.w + tx];
    }
    setTile(tx, ty, ch) {
      if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
      const i = ty * this.w + tx;
      this.tiles[i] = ch;
      const d = this.dynamic.indexOf(i);
      if (d >= 0 && !(ch === 'w' || ch === '~' || A.isBlock(ch))) this.dynamic.splice(d, 1);
      this.redrawTile(tx, ty);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) this.redrawTile(tx + dx, ty + dy);
    }
    solidAt(tx, ty) { return A.SOLID.has(this.tile(tx, ty)); }
    isSolidPx(px, py) { return A.SOLID.has(this.tile(Math.floor(px / T), Math.floor(py / T))); }
    waterAt(px, py) { const c = this.tile(Math.floor(px / T), Math.floor(py / T)); return c === 'w' || c === '~'; }

    neighbors(tx, ty) {
      const s = (a, b) => A.SOLID.has(this.tile(a, b)) && this.tile(a, b) !== 'X';
      const up = this.tile(tx, ty - 1);
      return { up: s(tx, ty - 1) || (ty === 0), down: s(tx, ty + 1), left: s(tx - 1, ty), right: s(tx + 1, ty), upWater: up === 'w' || up === '~' };
    }

    /* Статичные тайлы пререндерятся в большой холст */
    prerender() {
      this.layer = A.cnv(this.pw, this.ph);
      const x = this.layer.getContext('2d');
      for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) this.redrawTile(tx, ty, x);
    }
    redrawTile(tx, ty, ctx) {
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
      const x = ctx || this.layer.getContext('2d');
      const px = tx * T, py = ty * T;
      x.clearRect(px, py, T, T);
      const ch = this.tiles[ty * this.w + tx];
      if (ch === ' ' || ch === 'X' || ch === 'w' || ch === '~' || ch === '%' || ch === '*' || A.isBlock(ch)) return;
      const rnd = G.rng(tx * 7919 + ty * 104729 + 13);
      A.drawTile(x, ch, px, py, this.theme, this.neighbors(tx, ty), rnd);
    }

    add(e) { e.world = this; this.entities.push(e); if (e.init) e.init(); return e; }

    /* ---------- Физика тела по тайлам ---------- */
    move(b, dt, opt) {
      opt = opt || {};
      b.hitL = b.hitR = b.hitU = false;
      const wasGround = b.onGround;
      b.onGround = false;
      // горизонталь
      let dx = b.vx * dt;
      const sx = Math.ceil(Math.abs(dx) / 6) || 1;
      for (let s = 0; s < sx; s++) this.moveX(b, dx / sx);
      // вертикаль
      let dy = b.vy * dt;
      const sy = Math.ceil(Math.abs(dy) / 6) || 1;
      for (let s = 0; s < sy; s++) this.moveY(b, dy / sy, opt);
      if (!b.onGround && wasGround && b.vy >= 0 && opt.snap) {
        // прилипание к платформе на спуске не нужно — оставлено для расширений
      }
    }
    moveX(b, dx) {
      if (!dx) return;
      b.x += dx;
      const top = Math.floor(b.y / T), bot = Math.floor((b.y + b.h - 0.01) / T);
      if (dx > 0) {
        const tx = Math.floor((b.x + b.w) / T);
        for (let ty = top; ty <= bot; ty++) if (this.solidAt(tx, ty)) { b.x = tx * T - b.w; b.vx = 0; b.hitR = true; return; }
      } else {
        const tx = Math.floor(b.x / T);
        for (let ty = top; ty <= bot; ty++) if (this.solidAt(tx, ty)) { b.x = (tx + 1) * T; b.vx = 0; b.hitL = true; return; }
      }
    }
    moveY(b, dy, opt) {
      if (!dy) return;
      const prevBottom = b.y + b.h;
      b.y += dy;
      const l = Math.floor(b.x / T), r = Math.floor((b.x + b.w - 0.01) / T);
      if (dy > 0) {
        const ty = Math.floor((b.y + b.h) / T);
        for (let tx = l; tx <= r; tx++) {
          const ch = this.tile(tx, ty);
          if (A.SOLID.has(ch) || (A.ONEWAY.has(ch) && prevBottom <= ty * T + 0.5 && !b.dropThrough)) {
            b.y = ty * T - b.h; b.vy = 0; b.onGround = true; return;
          }
        }
        // движущиеся платформы
        if (b.ridesPlatforms) {
          for (const p of this.entities) {
            if (!p.platform || p.dead) continue;
            if (b.x + b.w > p.x && b.x < p.x + p.w && prevBottom <= p.y + 0.5 + Math.max(0, p.dyLast || 0) && b.y + b.h >= p.y) {
              b.y = p.y - b.h; b.vy = 0; b.onGround = true; b.riding = p; if (p.onStand) p.onStand(b); return;
            }
          }
        }
      } else {
        const ty = Math.floor(b.y / T);
        for (let tx = l; tx <= r; tx++) {
          if (this.solidAt(tx, ty)) {
            b.y = (ty + 1) * T; b.vy = 0; b.hitU = true;
            if (opt.onHead) {
              // бьём тот тайл, что ближе к центру
              const cx = Math.floor((b.x + b.w / 2) / T);
              const hit = this.solidAt(cx, ty) ? cx : tx;
              opt.onHead(hit, ty);
            }
            return;
          }
        }
      }
    }

    /* Проверка опоры впереди (для патрулей, чтобы не падали) */
    groundAhead(e, dir) {
      const fx = dir > 0 ? e.x + e.w + 2 : e.x - 2;
      const fy = e.y + e.h + 4;
      const ch = this.tile(Math.floor(fx / T), Math.floor(fy / T));
      return A.SOLID.has(ch) || A.ONEWAY.has(ch);
    }
    wallAhead(e, dir) {
      const fx = dir > 0 ? e.x + e.w + 1 : e.x - 1;
      return this.isSolidPx(fx, e.y + e.h - 4) || this.isSolidPx(fx, e.y + 2);
    }
    lineOfSight(x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
      for (let i = 1; i < n; i++) {
        const px = x0 + ((x1 - x0) * i) / n, py = y0 + ((y1 - y0) * i) / n;
        if (this.isSolidPx(px, py)) return false;
      }
      return true;
    }

    /* ---------- Частицы и всплывающий текст ---------- */
    burst(x, y, n, cols, opt) {
      opt = opt || {};
      for (let i = 0; i < n; i++) {
        const a = opt.angle !== undefined ? opt.angle + G.rr(-opt.spread, opt.spread) : Math.random() * Math.PI * 2;
        const sp = G.rr(opt.min || 30, opt.max || 120);
        this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.up || 0), life: G.rr(0.3, opt.life || 0.8), t: 0, col: G.pick(cols), g: opt.g !== undefined ? opt.g : 300, s: opt.size || 2 });
      }
    }
    float(x, y, text, col) { this.floaters.push({ x, y, text, col: col || '#fff', t: 0 }); }
    debris(tx, ty, col) {
      for (let i = 0; i < 4; i++) this.particles.push({ x: tx * T + (i % 2) * 8 + 4, y: ty * T + Math.floor(i / 2) * 8 + 4, vx: (i % 2 ? 1 : -1) * G.rr(40, 80), vy: -G.rr(120, 220), life: 1.2, t: 0, col, g: 700, s: 4 });
    }

    updateParticles(dt) {
      for (const p of this.particles) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      this.particles = this.particles.filter((p) => p.t < p.life);
      for (const f of this.floaters) { f.t += dt; f.y -= 24 * dt; }
      this.floaters = this.floaters.filter((f) => f.t < 0.9);
      for (const b of this.bumps) b.t += dt;
      this.bumps = this.bumps.filter((b) => b.t < 0.15);
    }

    /* ---------- Камера ---------- */
    updateCamera(target, W, H, dt, opt) {
      opt = opt || {};
      if (opt.autoX !== undefined) this.camX = opt.autoX;
      else {
        const look = target.face * 24;
        const tx = target.x + target.w / 2 - W / 2 + look;
        this.camX = G.lerp(this.camX, tx, Math.min(1, dt * 6));
      }
      const ty = target.y + target.h / 2 - H * 0.55;
      if (this.ph <= H) this.camY = this.ph - H;
      else this.camY = G.lerp(this.camY, ty, Math.min(1, dt * 5));
      if (this.pw <= W) this.camX = -(W - this.pw) / 2;
      else this.camX = G.clamp(this.camX, 0, this.pw - W);
      if (this.ph > H) this.camY = G.clamp(this.camY, 0, this.ph - H);
      if (opt.minX !== undefined && this.pw > W) this.camX = Math.max(this.camX, opt.minX);
    }

    /* ---------- Отрисовка ---------- */
    render(x, W, H) {
      const t = this.time;
      let cx = Math.round(this.camX), cy = Math.round(this.camY);
      if (this.shake > 0) { cx += Math.round(G.rr(-2, 2) * Math.min(1, this.shake * 4)); cy += Math.round(G.rr(-2, 2) * Math.min(1, this.shake * 4)); }
      A.drawBackground(x, this.def.bg, cx, cy, W, H, t);
      if (this.def.rain) this.drawRainBack(x, W, H);
      x.save();
      x.translate(-cx, -cy);
      // декорации заднего плана
      for (const d of this.decor) {
        const px = d.x * T, py = (d.y + 1) * T;
        if (px > cx + W + 80 || px < cx - 120) continue;
        A.drawDecor(x, d, px, py, t);
      }
      for (const e of this.entities) if (e.back && !e.dead) e.draw(x, t);
      // пререндер тайлов
      const sx = Math.max(0, cx), sy = Math.max(0, cy);
      const sw = Math.min(W, this.pw - sx), sh = Math.min(H, this.ph - sy);
      if (sw > 0 && sh > 0) x.drawImage(this.layer, sx, sy, sw, sh, sx, sy, sw, sh);
      // динамические тайлы
      const tx0 = Math.floor(cx / T) - 1, tx1 = Math.ceil((cx + W) / T) + 1;
      const ty0 = Math.floor(cy / T) - 1, ty1 = Math.ceil((cy + H) / T) + 1;
      for (const i of this.dynamic) {
        const tx = i % this.w, ty = Math.floor(i / this.w);
        if (tx < tx0 || tx > tx1 || ty < ty0 || ty > ty1) continue;
        const ch = this.tiles[i];
        if (A.isBlock(ch)) {
          const b = this.bumps.find((bb) => bb.tx === tx && bb.ty === ty);
          const off = b ? -Math.sin((b.t / 0.15) * Math.PI) * 5 : 0;
          A.drawDynTile(x, ch, tx * T, ty * T + off, t, this.neighbors(tx, ty));
        }
      }
      for (const b of this.bumps) {
        const ch = this.tile(b.tx, b.ty);
        if (ch === 'U' || ch === 'B') {
          const off = -Math.sin((b.t / 0.15) * Math.PI) * 5;
          x.drawImage(this.layer, b.tx * T, b.ty * T, T, T, b.tx * T, b.ty * T + off, T, T);
        }
      }
      // сущности
      for (const e of this.entities) if (!e.back && !e.front && !e.dead) e.draw(x, t);
      if (this.player) this.player.draw(x, t);
      for (const e of this.entities) if (e.front && !e.dead) e.draw(x, t);
      // кусты рисуются поверх героя — в них можно спрятаться
      for (const i of this.bushes) {
        const tx = i % this.w, ty = Math.floor(i / this.w);
        if (tx < tx0 || tx > tx1 || ty < ty0 || ty > ty1) continue;
        A.drawTile(x, '*', tx * T, ty * T, this.theme, {}, G.rng(i * 31 + 7));
      }
      // вода и угли поверх
      for (const i of this.dynamic) {
        const tx = i % this.w, ty = Math.floor(i / this.w);
        if (tx < tx0 || tx > tx1 || ty < ty0 || ty > ty1) continue;
        const ch = this.tiles[i];
        if (!A.isBlock(ch)) A.drawDynTile(x, ch, tx * T, ty * T, t, this.neighbors(tx, ty));
      }
      // частицы
      for (const p of this.particles) {
        x.globalAlpha = Math.max(0, 1 - p.t / p.life);
        x.fillStyle = p.col; x.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
      }
      x.globalAlpha = 1;
      x.font = 'bold 8px sans-serif'; x.textAlign = 'center';
      for (const f of this.floaters) {
        x.globalAlpha = 1 - f.t / 0.9;
        x.fillStyle = '#000'; x.fillText(f.text, Math.round(f.x) + 1, Math.round(f.y) + 1);
        x.fillStyle = f.col; x.fillText(f.text, Math.round(f.x), Math.round(f.y));
      }
      x.globalAlpha = 1; x.textAlign = 'left';
      x.restore();
      if (this.def.dark) this.drawDarkness(x, W, H, cx, cy);
      if (this.def.night && !this.def.dark) { x.fillStyle = 'rgba(10,16,48,0.28)'; x.fillRect(0, 0, W, H); }
      if (this.def.rain) this.drawRain(x, W, H);
      if (this.flash > 0) { x.fillStyle = `rgba(255,255,255,${Math.min(0.85, this.flash)})`; x.fillRect(0, 0, W, H); }
    }

    drawDarkness(x, W, H, cx, cy) {
      if (!this.darkC || this.darkC.width !== W) this.darkC = A.cnv(W, H);
      const d = this.darkC.getContext('2d');
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, W, H);
      d.fillStyle = 'rgba(4,2,10,0.9)'; d.fillRect(0, 0, W, H);
      d.globalCompositeOperation = 'destination-out';
      const hole = (lx, ly, r) => {
        const g = d.createRadialGradient(lx, ly, r * 0.2, lx, ly, r);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = g; d.beginPath(); d.arc(lx, ly, r, 0, Math.PI * 2); d.fill();
      };
      const p = this.player;
      if (p) hole(p.x + p.w / 2 - cx, p.y + p.h / 2 - cy, (p.lightR || 78) + Math.sin(this.time * 9) * 3);
      for (const l of this.lights) {
        const lx = l.x - cx, ly = l.y - cy;
        if (lx < -80 || lx > W + 80 || ly < -80 || ly > H + 80) continue;
        hole(lx, ly, l.r + Math.sin(this.time * 6 + l.x) * 2);
      }
      for (const e of this.entities) if (e.light && !e.dead) hole(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy, e.light);
      x.drawImage(this.darkC, 0, 0);
    }

    drawRainBack(x, W, H) { x.fillStyle = 'rgba(20,30,50,0.25)'; x.fillRect(0, 0, W, H); }
    drawRain(x, W, H) {
      const t = this.time;
      x.strokeStyle = 'rgba(170,190,230,0.45)'; x.lineWidth = 1; x.beginPath();
      for (let i = 0; i < 90; i++) {
        const rx = ((i * 97 + t * 60 - this.camX * 0.3) % (W + 40) + W + 40) % (W + 40) - 20;
        const ry = ((i * 53 + t * 420) % (H + 20)) - 10;
        x.moveTo(rx, ry); x.lineTo(rx - 3, ry + 9);
      }
      x.stroke();
      x.fillStyle = 'rgba(10,20,40,0.18)'; x.fillRect(0, 0, W, H);
    }
  }
  G.World = World;
})();
