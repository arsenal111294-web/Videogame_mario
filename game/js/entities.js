/* Анакопиа — сущности: герой, враги, предметы, платформы, ловушки */
'use strict';
(function () {
  const G = window.G, A = G.art, T = G.T, I = G.input;
  const sfx = (n) => G.audio.sfx(n);
  const E = (G.ent = {});

  class Ent {
    constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; this.vx = 0; this.vy = 0; this.face = -1; this.dead = false; this.t = 0; this.onGround = false; }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    update() {}
    draw() {}
    spr(x, name, ox, oy, face) {
      const c = A.get(name, face === undefined ? this.face : face);
      if (c) A.blit(x, c, this.x + ox + (c.ox || 0), this.y + oy + (c.oy || 0));
    }
  }
  E.Ent = Ent;

  /* ======================= ГЕРОЙ ======================= */
  class Player extends Ent {
    constructor(x, y, hero, opt) {
      super(x, y, 10, 14);
      opt = opt || {};
      this.hero = hero;
      this.face = 1;
      this.maxHp = opt.maxHp || 3;
      this.hp = opt.hp || this.maxHp;
      this.power = opt.power || null;
      this.inv = 0; this.shieldT = 0;
      this.coyote = 0; this.jumpBuf = 0; this.lockX = 0;
      this.attackT = 0; this.attackCd = 0; this.swing = 0;
      this.animT = 0; this.state = 'normal';
      this.ridesPlatforms = true;
      this.deadT = 0; this.hidden = false; this.interact = false;
      this.horse = !!opt.horse;
      if (this.horse) { this.w = 18; this.h = 22; this.x -= 4; this.y -= 8; }
      this.lightR = opt.lightR || 78;
    }

    update(dt) {
      const W = this.world, D = W.def;
      this.t += dt;
      if (this.dead) {
        this.deadT += dt;
        if (this.deadT > 0.4) { this.vy += 900 * dt; this.y += this.vy * dt; }
        return;
      }
      if (this.inv > 0) this.inv -= dt;
      if (this.shieldT > 0) {
        this.shieldT -= dt;
        if (Math.random() < 0.5) W.burst(this.cx, this.cy, 1, ['#ffe070', '#fff'], { min: 10, max: 40, g: 0, life: 0.4 });
        if (this.shieldT <= 0 && G.game) G.game.restoreMusic();
      }
      if (this.attackT > 0) this.attackT -= dt;
      if (this.attackCd > 0) this.attackCd -= dt;
      if (this.lockX > 0) this.lockX -= dt;
      if (this.boostT > 0) this.boostT -= dt;
      this.interact = false;
      if (I.pressed('jump')) this.jumpBuf = 0.12; else if (this.jumpBuf > 0) this.jumpBuf -= dt;

      let ix = (I.held('right') ? 1 : 0) - (I.held('left') ? 1 : 0);
      if (this.lockX > 0) ix = 0;
      const cx = this.cx, footY = this.y + this.h - 2;
      const inWater = W.waterAt(cx, this.y + 4) || W.waterAt(cx, footY);
      this.inWater = inWater;
      const tCenter = W.tile(Math.floor(cx / T), Math.floor(this.cy / T));
      const tBelow = W.tile(Math.floor(cx / T), Math.floor((this.y + this.h + 2) / T));

      // --- лестницы ---
      if (!this.horse && this.state !== 'climb') {
        if ((tCenter === 'H' && (I.held('up') || (I.held('down') && !this.onGround))) || (tBelow === 'H' && I.held('down') && this.onGround)) {
          this.state = 'climb'; this.vx = 0; this.vy = 0;
          this.x = Math.floor(cx / T) * T + 3;
          if (tBelow === 'H' && tCenter !== 'H') this.y += 4;
        }
      }
      if (this.state === 'climb') {
        const iy = (I.held('down') ? 1 : 0) - (I.held('up') ? 1 : 0);
        this.vx = ix * 50; this.vy = iy * 70;
        if (ix) this.face = ix;
        this.dropThrough = true;
        W.move(this, dt);
        this.dropThrough = false;
        if (iy || ix) this.animT += dt;
        const tc = W.tile(Math.floor(this.cx / T), Math.floor((this.y + this.h - 3) / T));
        const tc2 = W.tile(Math.floor(this.cx / T), Math.floor((this.y + 2) / T));
        if (this.jumpBuf > 0) { this.state = 'normal'; this.vy = -250; this.jumpBuf = 0; sfx('jump'); }
        else if (tc !== 'H' && tc2 !== 'H') { this.state = 'normal'; if (iy < 0) this.vy = -120; }
        else if (this.onGround && iy > 0 && tc !== 'H') this.state = 'normal';
        this.checkHazards(); this.handleAttack(dt);
        return;
      }

      // --- горизонталь ---
      let maxV = 105;
      if (this.horse) { maxV = ix > 0 ? 185 : ix < 0 ? 95 : 140; ix = 1; }
      if (inWater) maxV = 72;
      const accel = this.onGround ? 900 : 620;
      if (ix) {
        this.vx += G.sign(ix * maxV - this.vx) * accel * dt;
        if (Math.abs(this.vx) > maxV && G.sign(this.vx) === ix) this.vx = G.lerp(this.vx, ix * maxV, 0.2);
        this.face = ix;
      } else if (this.lockX <= 0) {
        const fr = (this.onGround ? 1000 : 300) * dt;
        this.vx = Math.abs(this.vx) <= fr ? 0 : this.vx - G.sign(this.vx) * fr;
      }

      // --- гравитация ---
      let g, maxFall = 380;
      if (inWater) { g = 320; maxFall = 80; }
      else if (this.vy < 0 && (I.held('jump') || this.boostT > 0)) g = 720;
      else if (this.vy < 0) g = 1800;
      else g = 1100;
      // скольжение по стене (Амра)
      this.wallDir = 0;
      if (this.hero === 'amra' && !this.onGround && !inWater && this.vy > -40) {
        const tl = W.isSolidPx(this.x - 1, this.y + 4) || W.isSolidPx(this.x - 1, this.y + this.h - 3);
        const tr = W.isSolidPx(this.x + this.w + 1, this.y + 4) || W.isSolidPx(this.x + this.w + 1, this.y + this.h - 3);
        if (tl && ix < 0) this.wallDir = -1;
        if (tr && ix > 0) this.wallDir = 1;
        if (this.wallDir && this.vy > 55) { this.vy = 55; if (Math.random() < 0.3) W.burst(this.wallDir > 0 ? this.x + this.w : this.x, this.y + this.h, 1, ['#ccc'], { min: 5, max: 20, life: 0.3 }); }
      }
      this.vy = Math.min(this.vy + g * dt, maxFall);

      // --- прыжок ---
      if (this.jumpBuf > 0) {
        if (this.onGround || this.coyote > 0) {
          this.vy = this.horse ? -335 : -320; this.jumpBuf = 0; this.coyote = 0; this.onGround = false;
          sfx('jump'); W.burst(this.cx, this.y + this.h, 4, ['#d8c8a8', '#fff'], { min: 10, max: 40, life: 0.3, g: 0 });
        } else if (inWater) {
          this.vy = -160; this.jumpBuf = 0; sfx('splash');
        } else if (this.wallDir || (this.hero === 'amra' && this.touchingWall())) {
          const wd = this.wallDir || this.touchingWall();
          this.vy = -295; this.vx = -wd * 150; this.face = -wd; this.lockX = 0.16; this.jumpBuf = 0;
          sfx('jump'); W.burst(wd > 0 ? this.x + this.w : this.x, this.cy, 5, ['#fff', '#ddd'], { min: 20, max: 60, life: 0.3, g: 0 });
        }
      }
      if (inWater && !this.wasInWater && this.vy > 60) { sfx('splash'); W.burst(this.cx, this.y, 8, ['#bfe6ff', '#fff'], { angle: -Math.PI / 2, spread: 0.8, min: 40, max: 120 }); }
      this.wasInWater = inWater;

      this.dropThrough = I.held('down') && this.onGround && !this.horse && tBelow === '=' && I.held('jump');
      const wasGround = this.onGround;
      this.riding = null;
      this.prevBottom = this.y + this.h;
      W.move(this, dt, { onHead: (tx, ty) => this.bumpTile(tx, ty) });
      if (this.onGround) this.coyote = 0.08; else if (wasGround) this.coyote = 0.08; else this.coyote -= dt;
      if (this.onGround && Math.abs(this.vx) > 5) this.animT += dt * Math.abs(this.vx) / 90;
      if (this.horse && this.onGround && Math.floor(this.t * 6.5) !== Math.floor((this.t - dt) * 6.5)) sfx('gallop');

      // границы уровня
      if (this.x < 0) { this.x = 0; this.vx = 0; }
      if (this.x + this.w > W.pw) { this.x = W.pw - this.w; this.vx = 0; }
      // прятки в кустах
      this.hidden = W.tile(Math.floor(this.cx / T), Math.floor((this.y + this.h - 4) / T)) === '*' && Math.abs(this.vx) < 30 && this.attackT <= 0;

      this.checkHazards();
      this.handleAttack(dt);
      if (this.y > W.ph + 40) this.die('fall');
    }

    touchingWall() {
      const W = this.world;
      if (W.isSolidPx(this.x - 2, this.y + 6)) return -1;
      if (W.isSolidPx(this.x + this.w + 2, this.y + 6)) return 1;
      return 0;
    }

    checkHazards() {
      const W = this.world;
      const pts = [[this.x + 2, this.y + this.h - 1], [this.x + this.w - 2, this.y + this.h - 1], [this.cx, this.y + this.h / 2]];
      for (const [px, py] of pts) {
        const tx = Math.floor(px / T), ty = Math.floor(py / T), ch = W.tile(tx, ty);
        if ((ch === '^' || ch === '%') && py - ty * T > 7) { this.hurt({ cx: px, spikes: true }); if (!this.dead) this.vy = -280; return; }
      }
    }

    handleAttack() {
      const W = this.world;
      if (!I.pressed('action')) return;
      this.interact = true;
      if (W.director && W.director.onAction && W.director.onAction(this)) return;
      if (this.attackCd > 0 || W.def.noAttack) return;
      if (this.power === 'fire') {
        const n = W.entities.filter((e) => e instanceof Fireball && !e.dead).length;
        if (n < 2) { W.add(new Fireball(this.cx + this.face * 6 - 3, this.y + 4, this.face)); sfx('fire'); this.attackT = 0.15; this.attackCd = 0.22; }
        return;
      }
      if (this.hero === 'amra') {
        W.add(new Arrow(this.cx + this.face * 6, this.y + 7, this.face)); sfx('bow');
        this.attackT = 0.2; this.attackCd = 0.38;
        return;
      }
      this.attackT = 0.24; this.attackCd = 0.3; this.swing++; sfx('sword');
    }

    swordBox() {
      if (this.attackT <= 0.06 || this.hero === 'amra' || this.power === 'fire') return null;
      const reach = this.horse ? 22 : 16;
      return { x: this.face > 0 ? this.x + this.w - 2 : this.x - reach + 2, y: this.y - (this.horse ? 2 : 1), w: reach, h: this.horse ? 18 : 14 };
    }

    bumpTile(tx, ty) {
      const W = this.world, ch = W.tile(tx, ty);
      W.bumps.push({ tx, ty, t: 0 });
      if (A.isBlock(ch)) {
        const key = tx + ',' + ty;
        let item = W.blockItems[key] || { '?': 'coin', Q: 'honey', P: 'pepper', D: 'shield', Y: 'feather', M: 'multicoin', '+': 'life' }[ch];
        if (item === 'multicoin') {
          W.blockItems[key + '#'] = (W.blockItems[key + '#'] || 0) + 1;
          W.add(new PopCoin(tx * T + 2, ty * T - 12));
          if (W.blockItems[key + '#'] >= 6) W.setTile(tx, ty, 'U');
        } else {
          if (item === 'coin') W.add(new PopCoin(tx * T + 2, ty * T - 12));
          else W.add(new PowerItem(tx * T + 2, ty * T, item, true));
          W.setTile(tx, ty, 'U');
          if (item !== 'coin') sfx('select');
        }
        sfx('bump');
        this.bumpEnemies(tx, ty);
      } else if (ch === 'B') {
        W.setTile(tx, ty, ' ');
        W.debris(tx, ty, '#b5623a');
        W.score += 10;
        sfx('break'); G.vibrate(15);
        this.bumpEnemies(tx, ty);
      } else sfx('bump');
    }
    bumpEnemies(tx, ty) {
      const box = { x: tx * T, y: ty * T - 6, w: T, h: 6 };
      for (const e of this.world.entities) if (e.enemy && !e.dead && G.overlap(box, e)) e.hit(this.face, 'bump');
    }

    hurt(src) {
      if (this.dead || this.inv > 0 || this.shieldT > 0) return;
      if (G.game && G.game.godMode) return;
      if (this.power) { this.power = null; sfx('hurt'); }
      else { this.hp--; sfx('hurt'); }
      this.inv = 1.6;
      G.vibrate(60);
      const dir = src && src.cx !== undefined ? G.sign(this.cx - src.cx) || -this.face : -this.face;
      this.vx = dir * 120; this.vy = -200; this.lockX = 0.18;
      this.world.shake = 0.2;
      if (this.hp <= 0) this.die('hp');
    }

    die(why) {
      if (this.dead) return;
      if (G.game && G.game.godMode && why !== 'fall') { this.hp = this.maxHp; return; }
      this.dead = true; this.deadT = 0; this.vy = -300; this.hp = 0;
      this.state = 'normal';
      sfx('hurt'); G.vibrate(150);
      if (G.game) G.game.onPlayerDeath(why);
    }

    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

    draw(x, t) {
      if (this.inv > 0 && Math.floor(this.inv * 14) % 2 === 0 && !this.dead) return;
      const h = this.hero;
      if (this.horse) return this.drawHorse(x, t);
      let f = 'stand';
      if (this.dead) f = 'jump';
      else if (this.state === 'climb') f = Math.floor(this.animT * 8) % 2 ? 'climb1' : 'climb2';
      else if (!this.onGround) f = this.inWater ? (Math.floor(t * 4) % 2 ? 'run1' : 'run2') : 'jump';
      else if (Math.abs(this.vx) > 8) f = A.get(h + '_run3') ? ['run1', 'run2', 'run3', 'run4'][Math.floor(this.animT * 10) % 4] : ['run1', 'stand', 'run2', 'stand'][Math.floor(this.animT * 10) % 4];
      if (this.inv > 1.2 && A.get(h + '_hurt')) f = 'hurt';
      if (this.attackT > 0 && this.state !== 'climb') f = this.onGround ? 'attack' : 'attackj';
      if (this.wallDir) f = 'climb1';
      const face = this.wallDir ? -this.wallDir : this.face;
      if (this.shieldT > 0) {
        x.fillStyle = `rgba(255,224,112,${0.25 + Math.sin(t * 20) * 0.15})`;
        x.beginPath(); x.arc(this.cx, this.cy, 13, 0, Math.PI * 2); x.fill();
      }
      if (this.dead) {
        x.save(); x.translate(Math.round(this.cx), Math.round(this.cy)); x.scale(1, -1);
        const c = A.get(h + '_' + f, face); if (c) A.blit(x, c, -8 + (c.ox || 0), -8 + (c.oy || 0)); x.restore();
        return;
      }
      if (this.hidden) x.globalAlpha = 0.55;
      this.spr(x, h + '_' + f, -3, -1, face);
      x.globalAlpha = 1;
      if (this.power === 'fire' && Math.random() < 0.3) this.world.burst(this.cx + G.rr(-4, 4), this.y + 2, 1, ['#ff8030', '#ffd040'], { angle: -Math.PI / 2, spread: 0.5, min: 10, max: 30, g: -50, life: 0.4 });
      // меч
      const pa = A.painted(h + '_attack');
      if (this.attackT > 0 && h === 'astamur' && this.power !== 'fire' && !pa) this.drawSword(x, this.x - 3, this.y - 1, face, 1);
      if (h === 'amra' && this.attackT > 0 && !pa) this.drawBow(x, face);
    }

    drawSword(x, sx, sy, face, k) {
      const p = 1 - this.attackT / 0.24;
      const hx = face > 0 ? sx + 14 : sx + 2, hy = sy + 9 + (this.horse ? 0 : 0);
      x.save(); x.translate(hx, hy);
      const ang = face > 0 ? -1.6 + p * 2.2 : Math.PI + 1.6 - p * 2.2;
      x.rotate(ang);
      x.fillStyle = '#1b1218'; x.beginPath(); x.moveTo(-0.5, -1.4); x.lineTo(13 * k, -1); x.lineTo(14.5 * k, 0); x.lineTo(13 * k, 1); x.lineTo(-0.5, 1.4); x.fill();
      x.fillStyle = '#dfe6ee'; x.beginPath(); x.moveTo(0, -0.8); x.lineTo(13 * k, -0.5); x.lineTo(14 * k, 0); x.lineTo(13 * k, 0.5); x.lineTo(0, 0.8); x.fill();
      x.fillStyle = '#ffffff'; x.fillRect(1.5, -0.5, 10 * k, 0.4);
      x.fillStyle = '#1b1218'; x.fillRect(-1.4, -2.6, 2.4, 5.2);
      x.fillStyle = '#d8b04c'; x.fillRect(-1, -2.2, 1.6, 4.4);
      x.fillStyle = '#5a3418'; x.fillRect(-4, -0.6, 3, 1.2);
      x.restore();
      if (p < 0.7) {
        x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 2; x.beginPath();
        if (face > 0) x.arc(hx, hy, 13 * k, -1.4 + p * 1.6, -0.2 + p * 1.6); else x.arc(hx, hy, 13 * k, Math.PI + 0.2 - p * 1.6, Math.PI + 1.4 - p * 1.6);
        x.stroke();
      }
    }

    drawBow(x, face) {
      const bx = face > 0 ? this.x + this.w + 3 : this.x - 3;
      const cx = face > 0 ? bx - 4 : bx + 4, a0 = face > 0 ? -1.15 : Math.PI - 1.15, a1 = face > 0 ? 1.15 : Math.PI + 1.15;
      x.lineCap = 'round';
      x.strokeStyle = '#1b1218'; x.lineWidth = 2.2; x.beginPath(); x.arc(cx, this.y + 7, 7, a0, a1); x.stroke();
      x.strokeStyle = '#a0662c'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, this.y + 7, 7, a0, a1); x.stroke();
      x.strokeStyle = 'rgba(245,240,225,0.95)'; x.lineWidth = 0.4; x.beginPath();
      x.moveTo(cx + Math.cos(a0) * 7, this.y + 7 + Math.sin(a0) * 7); x.lineTo(cx - (face > 0 ? 2 : -2), this.y + 7); x.lineTo(cx + Math.cos(a1) * 7, this.y + 7 + Math.sin(a1) * 7); x.stroke();
      x.lineCap = 'butt';
    }

    drawHorse(x, t) {
      const fr = !this.onGround ? 'b' : ['a', 'b', 'c', 'b'][Math.floor(t * 12) % 4];
      const face = this.face;
      const hx = Math.round(this.x - 3), hy = Math.round(this.y + this.h - 15);
      const rider = A.get('rider_' + (this.attackT > 0 ? 'attack' : fr), face);
      if (rider) A.blit(x, rider, hx + (rider.ox || 0), hy + (rider.oy || 0));
      else {
        const hc = A.get('horse_' + fr, face);
        const top = A.get('astamur_' + (this.attackT > 0 ? 'attack' : 'stand'), face);
        if (top) A.blitPart(x, top, 0, 0, 16, 12, hx + (face > 0 ? 3 : 5), hy - 9);
        if (hc) A.blit(x, hc, hx, hy);
      }
      if (this.attackT > 0 && !A.painted('rider_attack')) this.drawSword(x, hx + (face > 0 ? 3 : 5), hy - 9, face, 1.3);
      if (this.shieldT > 0) { x.fillStyle = `rgba(255,224,112,${0.25 + Math.sin(t * 20) * 0.15})`; x.beginPath(); x.arc(this.cx, this.cy, 18, 0, Math.PI * 2); x.fill(); }
    }
  }
  E.Player = Player;

  /* ======================= СНАРЯДЫ ГЕРОЯ ======================= */
  class Fireball extends Ent {
    constructor(x, y, dir) { super(x, y, 6, 6); this.vx = 190 * dir; this.vy = 40; this.life = 1.6; this.friendly = true; }
    update(dt) {
      const W = this.world; this.t += dt;
      this.vy += 800 * dt;
      W.move(this, dt);
      if (this.onGround) this.vy = -170;
      if (this.hitL || this.hitR || this.t > this.life || W.waterAt(this.cx, this.cy)) { this.dead = true; W.burst(this.cx, this.cy, 6, ['#ff8030', '#ffd040'], { min: 20, max: 60 }); }
      for (const e of W.entities) if (e.enemy && !e.dead && G.overlap(this, e)) { if (e.hit(G.sign(this.vx), 'fire') !== 'blocked') { this.dead = true; break; } this.dead = true; }
    }
    draw(x, t) {
      const r = 3 + Math.sin(t * 30) * 0.8;
      x.fillStyle = '#e83a10'; x.beginPath(); x.arc(this.cx, this.cy, r + 1, 0, 7); x.fill();
      x.fillStyle = '#ffc040'; x.beginPath(); x.arc(this.cx, this.cy, r - 1, 0, 7); x.fill();
      if (Math.random() < 0.5) this.world.burst(this.cx, this.cy, 1, ['#ff6020', '#ffb030'], { min: 5, max: 20, g: -40, life: 0.3 });
    }
  }
  E.Fireball = Fireball;

  class Arrow extends Ent {
    constructor(x, y, dir) { super(x - 4, y, 8, 3); this.vx = 280 * dir; this.vy = -10; this.face = dir; this.friendly = true; this.stuck = 0; }
    update(dt) {
      const W = this.world; this.t += dt;
      if (this.stuck) { this.stuck -= dt; if (this.stuck <= 0) this.dead = true; return; }
      this.vy += 90 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (W.isSolidPx(this.cx + this.face * 4, this.cy)) { this.stuck = 0.8; sfx('bump'); return; }
      if (this.t > 1.2) this.dead = true;
      for (const e of W.entities) if (e.enemy && !e.dead && G.overlap(this, e)) { e.hit(this.face, 'arrow'); this.dead = true; break; }
      for (const e of W.entities) if (e.shootable && !e.dead && G.overlap(this, e)) { e.onShot(this); this.dead = true; break; }
    }
    draw(x) {
      const a = Math.atan2(this.vy, this.vx);
      x.save(); x.translate(this.cx, this.cy); x.rotate(this.stuck ? Math.atan2(0, this.face) : a);
      x.fillStyle = '#6a4424'; x.fillRect(-6, -0.5, 10, 1.5);
      x.fillStyle = '#d8dde4'; x.fillRect(4, -1.5, 3, 3);
      x.fillStyle = '#f4f0e0'; x.fillRect(-7, -2, 3, 1); x.fillRect(-7, 1, 3, 1);
      x.restore();
    }
  }
  E.Arrow = Arrow;

  /* ======================= ВРАГИ ======================= */
  class Enemy extends Ent {
    constructor(x, y, w, h) {
      super(x, y, w, h);
      this.enemy = true; this.hp = 1; this.stompable = true; this.harmful = true; this.score = 100;
      this.speed = 28; this.flashT = 0; this.turnAtEdge = true; this.face = -1;
    }
    physics(dt) {
      this.vy = Math.min(this.vy + 900 * dt, 380);
      this.world.move(this, dt);
      if (this.y > this.world.ph + 40) this.dead = true;
    }
    patrol(dt, speed) {
      const W = this.world;
      if (this.onGround) {
        if (W.wallAhead(this, this.face) || (this.turnAtEdge && !W.groundAhead(this, this.face))) this.face = -this.face;
      }
      this.vx = this.face * speed;
    }
    blocks() { return false; }
    hit(dir, kind) {
      if (this.blocks(dir, kind)) { sfx('clang'); this.world.burst(this.cx - dir * 6, this.cy, 5, ['#fff', '#ffe080'], { min: 30, max: 90, life: 0.3 }); return 'blocked'; }
      this.hp -= kind === 'lightning' || kind === 'shield' ? 99 : 1;
      this.flashT = 0.15;
      if (this.hp <= 0) this.die(kind, dir);
      else { this.vx = dir * 80; this.vy = -100; sfx('stomp'); }
      return true;
    }
    stomp() {
      if (!this.stompable) return false;
      this.hp--;
      if (this.hp <= 0) this.die('stomp', 0); else { this.flashT = 0.15; sfx('stomp'); }
      return true;
    }
    die(kind, dir) {
      if (this.dead) return;
      this.dead = true;
      const W = this.world;
      W.score += this.score;
      W.float(this.cx, this.y - 4, '+' + this.score, '#ffe070');
      sfx('stomp'); G.vibrate(20);
      W.add(new Corpse(this, kind === 'stomp' ? 0 : dir || -this.face, kind === 'stomp'));
      if (this.onDie) this.onDie(kind);
    }
    touchPlayer(p) {
      if (p.shieldT > 0) { this.die('shield', G.sign(this.cx - p.cx)); sfx('stomp'); return; }
      if (this.harmful) p.hurt(this);
    }
    sprName() {
      if (Math.abs(this.vx) <= 3) return this.kind + '_stand';
      if (A.get(this.kind + '_run3')) return this.kind + '_run' + (1 + (Math.floor(this.t * 8) % 4));
      return this.kind + '_' + (Math.floor(this.t * 6) % 2 ? 'run1' : 'run2');
    }
    draw(x) {
      if (this.flashT > 0) x.globalAlpha = 0.5;
      this.spr(x, this.sprName(), -3, -1);
      x.globalAlpha = 1;
      if (this.extra) this.extra(x);
    }
  }
  E.Enemy = Enemy;

  class Corpse extends Ent {
    constructor(src, dir, flat) {
      super(src.x, src.y, src.w, src.h);
      this.name = src.sprName ? src.sprName() : null; this.face = src.face;
      this.vx = dir * 60; this.vy = flat ? 0 : -220; this.flat = flat; this.scaleK = src.scaleK || 1; this.src = src;
    }
    update(dt) {
      this.t += dt;
      if (this.flat) { if (this.t > 0.5) this.dead = true; return; }
      this.vy += 900 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.y > this.world.camY + 400) this.dead = true;
    }
    draw(x) {
      const c = this.name && A.get(this.name, this.face);
      if (!c) return;
      x.save();
      const k = c.k || 1, cw = c.width / k, ch = c.height / k;
      if (this.flat) { x.translate(G.snap(this.x - 3), G.snap(this.y + this.h)); x.scale(1, 0.35); A.blit(x, c, 0, -ch); }
      else { x.translate(G.snap(this.cx), G.snap(this.cy)); x.scale(1, -1); A.blit(x, c, -cw / 2, -ch / 2); }
      x.restore();
    }
  }
  E.Corpse = Corpse;

  /* Воин Марвана: ходит, поворачивает у края */
  class Soldier extends Enemy {
    constructor(x, y) { super(x, y, 10, 14); this.kind = 'soldier'; }
    update(dt) { this.t += dt; if (this.flashT > 0) this.flashT -= dt; this.patrol(dt, this.speed); this.physics(dt); }
  }
  E.Soldier = Soldier;

  /* Копейщик: когда копьё поднято — прыгать на него нельзя */
  class Spearman extends Enemy {
    constructor(x, y) { super(x, y, 10, 14); this.kind = 'spear'; this.hp = 1; this.cycle = Math.random() * 3; this.speed = 22; this.score = 150; }
    get up() { return this.cycle % 3 < 1.8; }
    update(dt) {
      this.t += dt; this.cycle += dt; if (this.flashT > 0) this.flashT -= dt;
      this.stompable = !this.up;
      this.patrol(dt, this.up ? this.speed : 0); this.physics(dt);
    }
    extra(x) {
      x.save();
      const hx = this.face > 0 ? this.x + this.w + 0.5 : this.x - 0.5, hy = this.y + 8;
      x.translate(hx, hy);
      x.rotate(this.up ? (this.face > 0 ? -1.45 : -1.69) : (this.face > 0 ? 0 : Math.PI));
      x.fillStyle = '#1b1218'; x.fillRect(-9, -0.8, 23, 1.6);
      x.fillStyle = '#8a5a30'; x.fillRect(-8.6, -0.45, 22, 0.9);
      x.fillStyle = '#1b1218'; x.beginPath(); x.moveTo(13, -2.2); x.lineTo(19, 0); x.lineTo(13, 2.2); x.fill();
      x.fillStyle = '#dfe5ec'; x.beginPath(); x.moveTo(13.4, -1.5); x.lineTo(18, 0); x.lineTo(13.4, 1.5); x.fill();
      x.restore();
    }
  }
  E.Spearman = Spearman;

  /* Лучник: стоит и стреляет */
  class Archer extends Enemy {
    constructor(x, y) { super(x, y, 10, 14); this.kind = 'archer'; this.cd = 1.5 + Math.random(); this.score = 150; }
    update(dt) {
      this.t += dt; if (this.flashT > 0) this.flashT -= dt;
      const p = this.world.player; this.vx = 0;
      if (p && !p.dead) {
        this.face = p.cx < this.cx ? -1 : 1;
        const d = Math.abs(p.cx - this.cx);
        if (d < 230 && Math.abs(p.cy - this.cy) < 120) {
          this.cd -= dt;
          if (this.cd <= 0 && !p.hidden) {
            this.cd = 2.2;
            const dy = p.cy - this.cy;
            this.world.add(new EnemyArrow(this.cx + this.face * 6, this.y + 6, this.face, G.clamp(dy * 0.9 - d * 0.25, -200, 120)));
            sfx('arrow');
          }
        }
      }
      this.physics(dt);
    }
    extra(x) {
      if (A.painted(this.kind + '_stand')) return;
      const bx = this.face > 0 ? this.x + this.w + 1 : this.x - 1;
      const cx = this.face > 0 ? bx - 4 : bx + 4, a0 = this.face > 0 ? -1.15 : Math.PI - 1.15, a1 = this.face > 0 ? 1.15 : Math.PI + 1.15;
      x.lineCap = 'round';
      x.strokeStyle = '#1b1218'; x.lineWidth = 2.2; x.beginPath(); x.arc(cx, this.y + 7, 7, a0, a1); x.stroke();
      x.strokeStyle = '#8a5424'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, this.y + 7, 7, a0, a1); x.stroke();
      x.strokeStyle = 'rgba(240,235,220,0.9)'; x.lineWidth = 0.4; x.beginPath();
      x.moveTo(cx + Math.cos(a0) * 7, this.y + 7 + Math.sin(a0) * 7); x.lineTo(cx + Math.cos(a1) * 7, this.y + 7 + Math.sin(a1) * 7); x.stroke();
      x.lineCap = 'butt';
    }
  }
  E.Archer = Archer;

  class EnemyArrow extends Ent {
    constructor(x, y, dir, vy) { super(x - 4, y, 8, 3); this.vx = 150 * dir; this.vy = vy || -40; this.face = dir; this.enemyShot = true; }
    update(dt) {
      const W = this.world; this.t += dt;
      this.vy += 160 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (W.isSolidPx(this.cx, this.cy) || this.t > 3) { this.dead = true; return; }
      const p = W.player;
      if (p && !p.dead) {
        const sb = p.swordBox && p.swordBox();
        if (sb && G.overlap(this, sb)) { this.dead = true; sfx('clang'); W.burst(this.cx, this.cy, 4, ['#fff'], { min: 20, max: 60, life: 0.3 }); return; }
        if (G.overlap(this, p)) { p.hurt(this); this.dead = true; }
      }
    }
    draw(x) {
      const a = Math.atan2(this.vy, this.vx);
      x.save(); x.translate(this.cx, this.cy); x.rotate(a);
      x.fillStyle = '#3a2414'; x.fillRect(-6, -0.5, 10, 1.5);
      x.fillStyle = '#bfc6cf'; x.fillRect(4, -1.5, 3, 3);
      x.fillStyle = '#8a1a1a'; x.fillRect(-7, -2, 3, 1); x.fillRect(-7, 1, 3, 1);
      x.restore();
    }
  }
  E.EnemyArrow = EnemyArrow;

  /* Щитоносец: отбивает удары спереди */
  class ShieldBearer extends Enemy {
    constructor(x, y) { super(x, y, 10, 14); this.kind = 'shield'; this.speed = 20; this.score = 200; }
    blocks(dir, kind) { return (kind === 'sword' || kind === 'arrow' || kind === 'fire' || kind === 'stone') && G.sign(dir) === -this.face; }
    update(dt) {
      this.t += dt; if (this.flashT > 0) this.flashT -= dt;
      const p = this.world.player;
      if (p && Math.abs(p.cx - this.cx) < 120 && Math.abs(p.cy - this.cy) < 40 && this.onGround) {
        const want = p.cx < this.cx ? -1 : 1;
        if (want !== this.face && Math.random() < dt * 1.2) this.face = want;
      }
      this.patrol(dt, this.speed); this.physics(dt);
    }
    extra(x) {
      if (A.painted(this.kind + '_stand')) return;
      const sx = this.face > 0 ? this.x + this.w + 1 : this.x - 1, sy = this.y + 8;
      x.fillStyle = '#1b1218'; x.beginPath(); x.ellipse(sx, sy, 3.6, 6.4, 0, 0, 7); x.fill();
      const g = x.createLinearGradient(sx - 3, sy - 6, sx + 3, sy + 6); g.addColorStop(0, '#b07a42'); g.addColorStop(1, '#5a3418');
      x.fillStyle = g; x.beginPath(); x.ellipse(sx, sy, 2.9, 5.7, 0, 0, 7); x.fill();
      x.strokeStyle = '#c9d0d8'; x.lineWidth = 0.6; x.beginPath(); x.ellipse(sx, sy, 2.6, 5.4, 0, 0, 7); x.stroke();
      x.fillStyle = '#e8edf2'; x.beginPath(); x.arc(sx, sy, 1.3, 0, 7); x.fill();
    }
  }
  E.ShieldBearer = ShieldBearer;

  /* Всадник: заметив героя, бросается в атаку */
  class Rider extends Enemy {
    constructor(x, y) { super(x - 4, y - 10, 18, 24); this.kind = 'rider'; this.hp = 2; this.score = 300; this.charge = 0; }
    update(dt) {
      this.t += dt; if (this.flashT > 0) this.flashT -= dt;
      const p = this.world.player;
      if (this.charge <= 0 && p && !p.dead && Math.abs(p.cy - this.cy) < 30 && Math.abs(p.cx - this.cx) < 150) { this.charge = 1.6; this.face = p.cx < this.cx ? -1 : 1; sfx('gallop'); }
      if (this.charge > 0) { this.charge -= dt; this.patrol(dt, 130); if (this.charge <= 0) this.vx = 0; }
      else this.patrol(dt, 25);
      this.physics(dt);
    }
    sprName() { return 'soldier_jump'; }
    draw(x, t) {
      if (this.flashT > 0) x.globalAlpha = 0.5;
      const fr = Math.abs(this.vx) > 60 ? ['a', 'b', 'c', 'b'][Math.floor(t * 12) % 4] : 'a';
      const hc = A.get('horse_' + fr, this.face);
      const hx = Math.round(this.x - 3), hy = Math.round(this.y + this.h - 15);
      const top = A.get('soldier_stand', this.face);
      if (top) A.blitPart(x, top, 0, 0, 16, 12, hx + (this.face > 0 ? 3 : 5), hy - 9);
      if (hc) A.blit(x, hc, hx, hy);
      x.globalAlpha = 1;
    }
  }
  E.Rider = Rider;

  /* Летучая мышь (пещеры) */
  class Bat extends Enemy {
    constructor(x, y) { super(x + 1, y + 2, 12, 7); this.kind = 'bat'; this.awake = false; this.homeY = this.y; this.score = 80; }
    update(dt) {
      this.t += dt; if (this.flashT > 0) this.flashT -= dt;
      const p = this.world.player;
      if (!this.awake && p && Math.abs(p.cx - this.cx) < 90 && Math.abs(p.cy - this.cy) < 110) this.awake = true;
      if (!this.awake) return;
      if (p && !p.dead) {
        const dx = p.cx - this.cx, dy = p.cy - this.cy;
        this.face = dx < 0 ? -1 : 1;
        this.vx = G.lerp(this.vx, G.sign(dx) * 60, dt * 2);
        this.vy = G.lerp(this.vy, G.sign(dy) * 40 + Math.sin(this.t * 6) * 60, dt * 3);
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
    }
    sprName() { return this.awake ? (Math.floor(this.t * 10) % 2 ? 'bat1' : 'bat2') : 'bat2'; }
    draw(x) { if (this.flashT > 0) x.globalAlpha = 0.5; this.spr(x, this.sprName(), -1, -1); x.globalAlpha = 1; }
  }
  E.Bat = Bat;

  /* Кабан (лес) */
  class Boar extends Enemy {
    constructor(x, y) { super(x - 3, y + 2, 18, 11); this.kind = 'boar'; this.hp = 2; this.score = 200; this.charge = 0; this.turnAtEdge = true; }
    update(dt) {
      this.t += dt; if (this.flashT > 0) this.flashT -= dt;
      const p = this.world.player;
      if (this.charge <= 0 && p && Math.abs(p.cy - this.cy) < 24 && Math.abs(p.cx - this.cx) < 120) { this.charge = 1.2; this.face = p.cx < this.cx ? -1 : 1; }
      if (this.charge > 0) { this.charge -= dt; this.patrol(dt, 120); } else this.patrol(dt, 30);
      this.physics(dt);
    }
    sprName() { return Math.floor(this.t * (this.charge > 0 ? 14 : 6)) % 2 ? 'boar1' : 'boar2'; }
    draw(x) { if (this.flashT > 0) x.globalAlpha = 0.5; this.spr(x, this.sprName(), -1, -1); x.globalAlpha = 1; }
  }
  E.Boar = Boar;

  /* Рыба, выпрыгивающая из воды */
  class Fish extends Enemy {
    constructor(x, y) { super(x + 3, y, 10, 8); this.kind = 'fish'; this.homeY = y; this.wait = Math.random() * 2; this.stompable = true; this.score = 50; }
    update(dt) {
      this.t += dt; if (this.flashT > 0) this.flashT -= dt;
      if (this.wait > 0) { this.wait -= dt; this.y = this.homeY; if (this.wait <= 0) { this.vy = -330; sfx('splash'); } return; }
      this.vy += 600 * dt; this.y += this.vy * dt;
      if (this.y >= this.homeY && this.vy > 0) { this.y = this.homeY; this.wait = 1.4 + Math.random(); }
    }
    draw(x) {
      if (this.wait > 0) return;
      const up = this.vy < 0;
      x.save(); x.translate(Math.round(this.cx), Math.round(this.cy)); if (!up) x.scale(1, -1);
      x.fillStyle = '#1b1218'; x.beginPath(); x.ellipse(0, 0, 5, 8, 0, 0, 7); x.fill();
      x.fillStyle = '#d0603a'; x.beginPath(); x.ellipse(0, 0, 4, 7, 0, 0, 7); x.fill();
      x.fillStyle = '#ffd0a0'; x.fillRect(-1, -5, 2, 6);
      x.fillStyle = '#1b1218'; x.fillRect(-3, -4, 1, 1); x.fillRect(2, -4, 1, 1);
      x.fillStyle = '#d0603a'; x.beginPath(); x.moveTo(0, 6); x.lineTo(-5, 11); x.lineTo(5, 11); x.fill();
      x.restore();
    }
  }
  E.Fish = Fish;

  /* Сталактит: падает, когда герой под ним */
  class Stalactite extends Enemy {
    constructor(x, y) { super(x + 4, y, 8, 14); this.kind = 'stal'; this.state = 0; this.stompable = false; this.score = 0; this.shakeT = 0; }
    hit() { return 'blocked'; }
    update(dt) {
      const W = this.world, p = W.player;
      if (this.state === 0 && p && Math.abs(p.cx - this.cx) < 22 && p.y > this.y && p.y - this.y < 150) { this.state = 1; this.shakeT = 0.45; sfx('bump'); }
      if (this.state === 1) { this.shakeT -= dt; if (this.shakeT <= 0) this.state = 2; }
      if (this.state === 2) {
        this.vy = Math.min(this.vy + 900 * dt, 420); this.y += this.vy * dt;
        if (W.isSolidPx(this.cx, this.y + this.h)) { this.dead = true; W.burst(this.cx, this.y + this.h, 10, ['#6a5a78', '#4a3e58', '#8a7a98'], { min: 40, max: 120 }); sfx('break'); }
      }
      this.harmful = this.state === 2;
    }
    touchPlayer(p) { if (this.state === 2) { p.hurt(this); this.dead = true; } }
    draw(x) {
      const ox = this.state === 1 ? Math.round(Math.sin(this.shakeT * 60)) : 0;
      x.fillStyle = '#1b1218'; x.beginPath(); x.moveTo(this.x - 1 + ox, this.y); x.lineTo(this.cx + ox, this.y + this.h + 1); x.lineTo(this.x + this.w + 1 + ox, this.y); x.fill();
      x.fillStyle = '#7a6a88'; x.beginPath(); x.moveTo(this.x + ox, this.y); x.lineTo(this.cx + ox, this.y + this.h - 1); x.lineTo(this.x + this.w + ox, this.y); x.fill();
      x.fillStyle = '#a898b8'; x.fillRect(this.x + 2 + ox, this.y, 1, 6);
    }
  }
  E.Stalactite = Stalactite;

  /* ======================= СТЕЛС ======================= */
  class Guard extends Enemy {
    constructor(x, y, range) {
      super(x, y, 10, 14); this.kind = 'guard'; this.speed = 22; this.score = 250;
      this.homeX = x; this.range = (range || 4) * T; this.alert = 0; this.pause = 0; this.light = 46; this.harmful = false;
    }
    update(dt) {
      this.t += dt;
      const W = this.world, p = W.player;
      if (this.pause > 0) { this.pause -= dt; this.vx = 0; if (this.pause <= 0) this.face = -this.face; }
      else {
        this.vx = this.face * this.speed;
        const out = (this.face > 0 && this.x > this.homeX + this.range) || (this.face < 0 && this.x < this.homeX - this.range);
        if (out || (this.onGround && (W.wallAhead(this, this.face) || !W.groundAhead(this, this.face)))) { this.pause = 1.3; this.vx = 0; }
      }
      this.physics(dt);
      // зрение
      this.sees = false;
      if (p && !p.dead && !p.hidden) {
        const ex = this.cx, ey = this.y + 4, dx = p.cx - ex, dy = p.cy - ey, d = Math.hypot(dx, dy);
        if (d < 112 && G.sign(dx) === this.face) {
          const ang = Math.abs(Math.atan2(dy, Math.abs(dx)));
          if (ang < 0.42 && W.lineOfSight(ex, ey, p.cx, p.cy)) this.sees = true;
        }
        if (d < 18) this.sees = true;
      }
      if (this.sees) this.alert += dt * 2.0; else this.alert = Math.max(0, this.alert - dt * 0.8);
      if (this.alert >= 1) { this.alert = 0; if (G.game) G.game.onCaught(this); }
    }
    hit(dir, kind) {
      // удар со спины — тихо, спереди — тревога
      if (G.sign(dir) === this.face || kind === 'lightning') return super.hit(dir, kind);
      if (G.game) G.game.onCaught(this);
      return 'blocked';
    }
    touchPlayer(p) { if (p.shieldT > 0) { this.die('shield', 0); return; } if (!this.sees) return; this.alert = 1; }
    draw(x, t) {
      // конус обзора
      const ex = this.cx, ey = this.y + 4, L = 112, a = 0.42;
      x.fillStyle = this.alert > 0.05 ? `rgba(255,80,40,${0.18 + this.alert * 0.25})` : 'rgba(255,220,120,0.13)';
      x.beginPath(); x.moveTo(ex, ey);
      x.lineTo(ex + this.face * L * Math.cos(a), ey - L * Math.sin(a));
      x.lineTo(ex + this.face * L * Math.cos(a), ey + L * Math.sin(a));
      x.fill();
      super.draw(x, t);
      // факел
      const tx = this.face > 0 ? this.x + this.w + 0.5 : this.x - 1.5;
      if (A.painted('guard_stand')) { x.fillStyle = 'rgba(255,140,40,0.28)'; x.beginPath(); x.arc(tx + this.face * 2, this.y - 1, 6, 0, 7); x.fill(); }
      else {
      x.fillStyle = '#1b1218'; x.fillRect(tx - 0.3, this.y + 1.7, 1.6, 9);
      x.fillStyle = '#6a4424'; x.fillRect(tx, this.y + 2, 1, 8.5);
      const fh = 4 + Math.sin(t * 22) * 0.8;
      x.fillStyle = 'rgba(255,120,30,0.35)'; x.beginPath(); x.arc(tx + 0.5, this.y + 0.5, 4, 0, 7); x.fill();
      x.fillStyle = '#ff6a18'; x.beginPath(); x.ellipse(tx + 0.5, this.y + 1.5 - fh / 2, 1.8, fh / 2 + 0.6, 0, 0, 7); x.fill();
      x.fillStyle = '#ffd860'; x.beginPath(); x.ellipse(tx + 0.5, this.y + 1.8 - fh / 3, 0.9, fh / 3, 0, 0, 7); x.fill();
      }
      if (this.alert > 0.05) {
        x.fillStyle = '#ff3020'; x.font = 'bold 10px sans-serif'; x.fillText(this.alert > 0.6 ? '!' : '?', this.cx - 2, this.y - 6);
      }
    }
  }
  E.Guard = Guard;

  /* Камнемёт — цель уровня «Лагерь» */
  class Catapult extends Ent {
    constructor(x, y) { super(x - 16, y - 18, 40, 34); this.burnt = false; this.back = true; this.fireT = 0; }
    update(dt) {
      this.t += dt;
      const p = this.world.player;
      if (!this.burnt && p && !p.dead && G.overlap(p, this) && p.interact) {
        this.burnt = true; sfx('ignite'); G.vibrate(40);
        this.world.objDone = (this.world.objDone || 0) + 1;
        this.world.float(this.cx, this.y, 'Камнемёт горит!', '#ffb040');
        this.light = 60;
        if (G.game) G.game.onObjective();
      }
      if (this.burnt && Math.random() < 0.6) this.world.burst(this.cx + G.rr(-16, 16), this.y + G.rr(4, 24), 1, ['#ff6020', '#ffb030', '#ffe070'], { angle: -Math.PI / 2, spread: 0.4, min: 20, max: 60, g: -60, life: 0.8 });
    }
    draw(x, t) {
      const bx = Math.round(this.x), by = Math.round(this.y + this.h);
      const pc = A.prop(this.burnt ? 'catapult_burnt' : 'catapult', 1);
      if (pc) { A.blit(x, pc, this.x - 6, by - 44 + 1); this.drawHint(x); return; }
      x.fillStyle = this.burnt ? '#2a1a10' : '#6a4424';
      x.fillRect(bx, by - 8, 40, 5); x.fillRect(bx + 4, by - 20, 4, 14); x.fillRect(bx + 30, by - 20, 4, 14);
      x.fillRect(bx + 4, by - 22, 30, 3);
      x.save(); x.translate(bx + 19, by - 20); x.rotate(this.burnt ? 0.4 : -0.7 + Math.sin(t) * 0.02);
      x.fillRect(-2, -26, 4, 30); x.fillStyle = '#3a2414'; x.fillRect(-5, -30, 10, 5); x.restore();
      x.fillStyle = '#1b1218'; [6, 34].forEach((w) => { x.beginPath(); x.arc(bx + w, by - 3, 4, 0, 7); x.fill(); });
      this.drawHint(x);
    }
    drawHint(x) {
      if (!this.burnt) {
        const p = this.world.player;
        if (p && G.dist(p.cx, p.cy, this.cx, this.cy) < 40) {
          x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(this.cx - 26, this.y - 16, 52, 11);
          x.fillStyle = '#ffe070'; x.font = '7px sans-serif'; x.textAlign = 'center'; x.fillText('⚔ — поджечь', this.cx, this.y - 8); x.textAlign = 'left';
        }
      }
    }
  }
  E.Catapult = Catapult;

  /* ======================= ПРЕДМЕТЫ ======================= */
  class Coin extends Ent {
    constructor(x, y) { super(x + 2, y + 2, 12, 12); this.item = true; this.t = Math.random() * 3; }
    update(dt) { this.t += dt; }
    collect(p) {
      this.dead = true; G.game.addCoin(1); sfx('coin');
      this.world.burst(this.cx, this.cy, 4, ['#ffe27a', '#fff'], { min: 20, max: 50, g: 0, life: 0.3 });
    }
    draw(x) { this.spr(x, 'coin' + (Math.floor(this.t * 8) % 4), 0, 0, 1); }
  }
  E.Coin = Coin;

  class PopCoin extends Ent {
    constructor(x, y) { super(x, y, 12, 12); this.vy = -260; }
    init() { G.game.addCoin(1); sfx('coin'); }
    update(dt) { this.t += dt; this.vy += 900 * dt; this.y += this.vy * dt; if (this.t > 0.5) { this.dead = true; this.world.float(this.cx, this.y, '+10', '#ffe070'); } }
    draw(x) { this.spr(x, 'coin' + (Math.floor(this.t * 16) % 4), 0, 0, 1); }
  }
  E.PopCoin = PopCoin;

  const ITEM_NAMES = { honey: 'Мёд Аҧсны — +1 сердце', pepper: 'Аџьыка! Огненные броски', shield: 'Щит Шьашәы — неуязвимость', feather: 'Перо Аҩы — гром!', life: '+1 жизнь' };
  class PowerItem extends Ent {
    constructor(x, y, kind, fromBlock) {
      super(x, y, 12, 12); this.kind = kind; this.item = true;
      this.rise = fromBlock ? 16 : 0; this.startY = y; this.face = 1;
      this.moving = kind === 'honey' || kind === 'life';
      this.bouncy = kind === 'shield';
    }
    update(dt) {
      this.t += dt;
      if (this.rise > 0) { const d = Math.min(this.rise, 32 * dt); this.y -= d; this.rise -= d; return; }
      if (this.moving || this.bouncy) {
        this.vx = this.face * (this.bouncy ? 70 : 55);
        this.vy = Math.min(this.vy + 900 * dt, 380);
        this.world.move(this, dt);
        if (this.hitL || this.hitR) this.face = -this.face;
        if (this.bouncy && this.onGround) this.vy = -260;
        if (this.y > this.world.ph + 20) this.dead = true;
      } else if (this.kind === 'feather') this.y = this.startY - 16 + Math.sin(this.t * 3) * 2;
    }
    collect(p) {
      if (this.rise > 4) return;
      this.dead = true;
      const g = G.game, W = this.world;
      W.float(this.cx, this.y - 6, ITEM_NAMES[this.kind] || '', '#fff');
      W.score += 500;
      if (this.kind === 'honey') { if (p.hp >= p.maxHp && p.maxHp < 5) p.maxHp++; p.heal(1); sfx('power'); }
      else if (this.kind === 'pepper') { p.power = 'fire'; sfx('power'); }
      else if (this.kind === 'shield') { p.shieldT = 9; sfx('power'); g.shieldMusic(); }
      else if (this.kind === 'feather') { g.thunder(); }
      else if (this.kind === 'life') { g.addLife(); }
      G.vibrate(30);
    }
    draw(x) { this.spr(x, this.kind === 'life' ? 'heart' : this.kind, 0, 0, 1); }
  }
  E.PowerItem = PowerItem;

  /* Струна апхьарцы — секретный предмет (по 3 на уровень) */
  class StringItem extends Ent {
    constructor(x, y, idx) { super(x + 2, y, 12, 16); this.idx = idx; this.item = true; this.baseY = y; this.light = 26; }
    init() { if (this.world.strings[this.idx]) this.ghost = true; }
    update(dt) { this.t += dt; this.y = this.baseY + Math.sin(this.t * 3) * 2; if (Math.random() < 0.15) this.world.burst(this.cx + G.rr(-6, 6), this.cy + G.rr(-6, 6), 1, ['#ffe9a0', '#fff'], { min: 2, max: 10, g: -10, life: 0.6 }); }
    collect() {
      this.dead = true; this.world.strings[this.idx] = true;
      sfx('string'); G.vibrate(40);
      this.world.float(this.cx, this.y - 6, 'Струна апхьарцы!', '#ffe9a0');
      this.world.score += 1000;
    }
    draw(x) { if (this.ghost) x.globalAlpha = 0.45; this.spr(x, 'string', 0, 0, 1); x.globalAlpha = 1; }
  }
  E.StringItem = StringItem;

  /* Огонь-маяк: контрольная точка */
  class Checkpoint extends Ent {
    constructor(x, y) { super(x, y - 8, 16, 24); this.lit = false; this.back = true; }
    update(dt) {
      this.t += dt;
      const p = this.world.player;
      if (!this.lit && p && !p.dead && G.overlap(p, this)) {
        this.lit = true; this.light = 50; sfx('check');
        this.world.float(this.cx, this.y - 4, 'Огонь зажжён', '#ffb040');
        if (G.game) G.game.setCheckpoint(this);
      }
      if (this.lit && Math.random() < 0.3) this.world.burst(this.cx, this.y + 2, 1, ['#ff8030', '#ffd040'], { angle: -Math.PI / 2, spread: 0.3, min: 10, max: 30, g: -40, life: 0.6 });
    }
    draw(x, t) {
      const pb = A.prop('brazier', 1);
      if (!pb) { this.spr(x, this.lit ? 'fire' + (Math.floor(t * 8) % 3) : 'brazier', 0, 0, 1); return; }
      A.blit(x, pb, this.x, this.y);
      if (this.lit) {
        for (let i = 0; i < 3; i++) {
          const h = 7 + Math.sin(t * 14 + i * 2) * 2.5, w = 6 - i * 1.6;
          x.fillStyle = ['#e8481e', '#ffa020', '#fff0a0'][i];
          x.beginPath(); x.ellipse(this.cx, this.y + 8 - h / 2 + i, w / 2 + 1, h / 2, 0, 0, 7); x.fill();
        }
      }
    }
  }
  E.Checkpoint = Checkpoint;

  /* Выход с уровня */
  class Exit extends Ent {
    constructor(x, y, style) { super(x, y - 32, 32, 48); this.style = style || 'gate'; this.back = true; this.done = false; }
    update(dt) {
      this.t += dt;
      const p = this.world.player;
      const open = !this.world.objective || this.world.objective.done();
      const box = { x: this.x + 8, y: this.y, w: 16, h: this.h };
      if (!this.done && open && p && !p.dead && G.overlap(p, box)) {
        this.done = true; if (G.game) G.game.levelComplete();
      }
      if (!open && p && G.game && Math.abs(p.cx - this.cx) < 40 && Math.abs(p.cy - this.cy) < 40) G.game.showHint('Ворота заперты. Сначала выполни задание!');
    }
    draw(x, t) {
      const open = !this.world.objective || this.world.objective.done();
      const bx = Math.round(this.x), by = Math.round(this.y + this.h);
      if (this.style === 'well') { // подземный родник
        x.fillStyle = `rgba(120,200,255,${0.25 + Math.sin(t * 3) * 0.1})`; x.beginPath(); x.ellipse(bx + 16, by - 20, 26, 30, 0, 0, 7); x.fill();
        x.fillStyle = '#1b1218'; x.fillRect(bx - 1, by - 13, 34, 13);
        x.fillStyle = '#7a7088'; x.fillRect(bx, by - 12, 32, 12);
        x.fillStyle = '#5a5068'; for (let i = 0; i < 32; i += 8) x.fillRect(bx + i, by - 12, 1, 12);
        x.fillStyle = '#5ac8ff'; x.fillRect(bx + 3, by - 14, 26, 3);
        for (let i = 0; i < 3; i++) { const yy = by - 16 - ((t * 20 + i * 9) % 26); x.fillStyle = 'rgba(200,240,255,0.8)'; x.fillRect(bx + 8 + i * 7, yy, 2, 2); }
        this.light = 70;
        return;
      }
      const gp = this.style === 'gate' || !this.style ? A.prop(open ? 'gate' : 'gate_closed', 1) : null;
      if (gp) {
        if (open) { x.fillStyle = `rgba(255,230,150,${0.3 + Math.sin(t * 4) * 0.12})`; x.fillRect(bx + 6, by - 36, 20, 36); }
        A.blit(x, gp, bx - 8, by - 66 + 1);
        x.fillStyle = '#5a3a1a'; x.fillRect(bx + 15, by - 86, 2, 22);
        const wv = Math.sin(t * 4) * 2;
        x.fillStyle = '#c0301a'; x.beginPath(); x.moveTo(bx + 17, by - 86); x.lineTo(bx + 34, by - 82 + wv); x.lineTo(bx + 17, by - 76); x.fill();
        return;
      }
      if (this.style === 'grove') { // священная роща Ажәеиҧшьаа
        x.fillStyle = '#3a2a1a'; x.fillRect(bx + 10, by - 60, 12, 60);
        x.fillStyle = '#2e5a2a'; x.beginPath(); x.arc(bx + 16, by - 66, 26, 0, 7); x.fill();
        x.fillStyle = '#3e7a34'; x.beginPath(); x.arc(bx + 6, by - 72, 14, 0, 7); x.fill(); x.beginPath(); x.arc(bx + 28, by - 70, 14, 0, 7); x.fill();
        const wv = Math.sin(t * 3) * 2;
        ['#e8e2d0', '#c0301a', '#e8b030'].forEach((c, i) => { x.fillStyle = c; x.fillRect(bx + 2 + i * 10, by - 50 + wv * (i % 2 ? 1 : -1), 3, 12); });
        x.fillStyle = `rgba(255,240,170,${0.2 + Math.sin(t * 4) * 0.1})`; x.beginPath(); x.arc(bx + 16, by - 20, 22, 0, 7); x.fill();
        return;
      }
      // каменная арка с деревянными воротами
      x.fillStyle = '#1b1218'; x.fillRect(bx - 5, by - 52, 42, 52);
      x.fillStyle = '#8f8a80'; x.fillRect(bx - 4, by - 51, 40, 51);
      x.fillStyle = '#6a655c'; for (let j = 0; j < 51; j += 8) x.fillRect(bx - 4, by - 51 + j, 40, 1);
      x.fillStyle = '#1b1218'; x.beginPath(); x.moveTo(bx + 4, by); x.lineTo(bx + 4, by - 32); x.quadraticCurveTo(bx + 16, by - 46, bx + 28, by - 32); x.lineTo(bx + 28, by); x.fill();
      if (!open) {
        x.fillStyle = '#6a4424'; x.fillRect(bx + 5, by - 34, 22, 34);
        x.fillStyle = '#4a2e18'; for (let i = 0; i < 22; i += 5) x.fillRect(bx + 5 + i, by - 34, 1, 34);
        x.fillStyle = '#9aa2ac'; x.fillRect(bx + 4, by - 20, 24, 3);
      } else {
        x.fillStyle = `rgba(255,230,150,${0.35 + Math.sin(t * 4) * 0.15})`; x.fillRect(bx + 6, by - 34, 20, 34);
      }
      // знамя
      x.fillStyle = '#5a3a1a'; x.fillRect(bx + 15, by - 72, 2, 22);
      const wv = Math.sin(t * 4) * 2;
      x.fillStyle = '#c0301a'; x.beginPath(); x.moveTo(bx + 17, by - 72); x.lineTo(bx + 33, by - 68 + wv); x.lineTo(bx + 17, by - 62); x.fill();
    }
  }
  E.Exit = Exit;

  /* Табличка-подсказка */
  class Sign extends Ent {
    constructor(x, y, text) { super(x, y, 16, 16); this.text = text; this.back = true; }
    update() {
      const p = this.world.player;
      const near = p && Math.abs(p.cx - this.cx) < 30 && Math.abs(p.cy - this.cy) < 30;
      if (near && G.game) G.game.showHint(this.text, this);
    }
    draw(x) { const ps = A.prop('sign', 1); if (ps) A.blit(x, ps, this.x, this.y); else this.spr(x, 'sign', 0, 0, 1); }
  }
  E.Sign = Sign;

  /* Персонаж-собеседник (облачко с репликой) */
  class NPC extends Ent {
    constructor(x, y, who, text) { super(x, y + 2, 10, 14); this.who = who; this.text = text; this.back = true; this.face = -1; }
    update(dt) {
      this.t += dt;
      const p = this.world.player;
      if (p) this.face = p.cx < this.cx ? -1 : 1;
      if (p && Math.abs(p.cx - this.cx) < 40 && Math.abs(p.cy - this.cy) < 30 && G.game) G.game.showHint(this.text, this);
    }
    draw(x) { this.spr(x, this.who + '_stand', -3, -1); }
  }
  E.NPC = NPC;

  /* ======================= ПЛАТФОРМЫ ======================= */
  class MovingPlatform extends Ent {
    constructor(x, y, w, dx, dy, speed) {
      super(x, y, (w || 3) * T, 8); this.platform = true; this.ox = x; this.oy = y;
      this.dx = (dx || 0) * T; this.dy = (dy || 0) * T; this.speed = speed || 0.5; this.phase = 0;
      this.log = true;
    }
    update(dt) {
      this.t += dt;
      const k = (Math.sin(this.t * this.speed * Math.PI) + 1) / 2;
      const nx = this.ox + this.dx * k, ny = this.oy + this.dy * k;
      this.dxLast = nx - this.x; this.dyLast = ny - this.y;
      this.x = nx; this.y = ny;
      const p = this.world.player;
      if (p && p.riding === this && !p.dead) { p.x += this.dxLast; p.y += this.dyLast; }
    }
    draw(x) {
      const bx = Math.round(this.x), by = Math.round(this.y);
      x.fillStyle = '#1b1218'; x.fillRect(bx, by, this.w, 8);
      x.fillStyle = '#8a5a30'; x.fillRect(bx + 1, by + 1, this.w - 2, 6);
      x.fillStyle = '#a87440'; x.fillRect(bx + 1, by + 1, this.w - 2, 2);
      x.fillStyle = '#5a3a1a'; for (let i = 6; i < this.w; i += 10) x.fillRect(bx + i, by + 3, 4, 2);
      x.fillStyle = '#c8a070'; x.fillRect(bx + 1, by + 2, 2, 4); x.fillRect(bx + this.w - 3, by + 2, 2, 4);
    }
  }
  E.MovingPlatform = MovingPlatform;

  class FallingLog extends Ent {
    constructor(x, y, w) { super(x, y, (w || 2) * T, 8); this.platform = true; this.ox = x; this.oy = y; this.state = 0; this.timer = 0; }
    onStand() { if (this.state === 0) { this.state = 1; this.timer = 0.45; } }
    update(dt) {
      this.dxLast = 0; this.dyLast = 0;
      if (this.state === 1) { this.timer -= dt; if (this.timer <= 0) { this.state = 2; this.vy = 0; } }
      else if (this.state === 2) {
        this.vy = Math.min(this.vy + 700 * dt, 300); const d = this.vy * dt; this.y += d; this.dyLast = d;
        const p = this.world.player; if (p && p.riding === this) p.y += d;
        if (this.y > this.world.ph + 30) { this.state = 3; this.timer = 2.5; this.platform = false; }
      } else if (this.state === 3) { this.timer -= dt; if (this.timer <= 0) { this.state = 0; this.x = this.ox; this.y = this.oy; this.platform = true; } }
    }
    draw(x) {
      if (this.state === 3) return;
      const sh = this.state === 1 ? Math.round(Math.sin(this.timer * 80)) : 0;
      const bx = Math.round(this.x + sh), by = Math.round(this.y);
      x.fillStyle = '#1b1218'; x.fillRect(bx, by, this.w, 8);
      x.fillStyle = '#7a4a26'; x.fillRect(bx + 1, by + 1, this.w - 2, 6);
      x.fillStyle = '#9a6a3a'; x.fillRect(bx + 1, by + 2, this.w - 2, 1);
      x.fillStyle = '#c8a070'; x.beginPath(); x.arc(bx + 3, by + 4, 3, 0, 7); x.fill();
    }
  }
  E.FallingLog = FallingLog;

  /* Согнутая ветка-пружина */
  class Spring extends Ent {
    constructor(x, y) { super(x + 1, y + 8, 14, 8); this.pressT = 0; this.back = true; }
    update(dt) {
      if (this.pressT > 0) this.pressT -= dt;
      const p = this.world.player;
      if (p && !p.dead && (p.vy > 0 || p.onGround) && p.state !== 'climb' && G.overlap(p, this) && p.y + p.h - this.y <= 9) {
        p.vy = -500; p.y = this.y - p.h; p.onGround = false; p.boostT = 0.7; this.pressT = 0.2; sfx('jump'); G.vibrate(20);
      }
    }
    draw(x) {
      const c = this.pressT > 0 ? 3 : 0, bx = Math.round(this.x), by = Math.round(this.y);
      x.fillStyle = '#1b1218'; x.fillRect(bx, by + c, 14, 8 - c);
      x.fillStyle = '#3e8a34'; x.fillRect(bx + 1, by + 1 + c, 12, 2);
      x.fillStyle = '#7a5530'; x.fillRect(bx + 2, by + 4 + c, 10, 3 - (c ? 1 : 0));
    }
  }
  E.Spring = Spring;

  /* ======================= ВЗАИМОДЕЙСТВИЕ ======================= */
  E.interact = function (W) {
    const p = W.player;
    if (!p || p.dead) return;
    const sb = p.swordBox();
    for (const e of W.entities) {
      if (e.dead) continue;
      if (e.item && G.overlap(p, e)) { e.collect(p); continue; }
      if (!e.enemy) continue;
      if (sb && e.lastSwing !== p.swing && G.overlap(sb, e)) {
        e.lastSwing = p.swing;
        const r = e.hit(p.face, 'sword');
        if (r === true) { G.vibrate(15); W.shake = Math.max(W.shake, 0.06); }
        else if (r === 'blocked') { p.vx = -p.face * 90; }
        continue;
      }
      if (e.dead || !G.overlap(p, e)) continue;
      if (p.shieldT > 0) { e.touchPlayer(p); continue; }
      const fromAbove = p.vy > 20 && (p.prevBottom || p.y + p.h) <= e.y + 7;
      if (fromAbove && e.stompable && !p.horse) {
        e.stomp(p);
        p.vy = I.held('jump') ? -330 : -220; p.y = e.y - p.h;
        W.burst(p.cx, p.y + p.h, 5, ['#fff', '#ddd'], { min: 20, max: 60, life: 0.3, g: 0 });
      } else if (fromAbove && e.stompable && p.horse) {
        e.stomp(p); p.vy = -260;
      } else if (fromAbove && e.kind === 'spear' && !e.stompable) {
        p.hurt(e); p.vy = -260;
      } else e.touchPlayer(p);
    }
    for (const e of W.entities) if (e.enemyShot && !e.dead && p.shieldT > 0 && G.overlap(p, e)) e.dead = true;
  };
})();
