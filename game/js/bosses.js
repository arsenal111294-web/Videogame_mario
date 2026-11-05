/* Анакопиа — особые сущности: погоня Абнауаю, осадная башня, оборона стен, Марван */
'use strict';
(function () {
  const G = window.G, A = G.art, T = G.T, E = G.ent, I = G.input;
  const sfx = (n) => G.audio.sfx(n);
  const { Ent, Enemy } = E;

  /* ======================= ПОГОНЯ: Абнауаю ======================= */
  class Abnauaiu extends Ent {
    constructor() { super(0, 0, 40, 60); this.front = true; this.roarT = 2; this.stopped = false; }
    update(dt) {
      const W = this.world, p = W.player;
      this.t += dt;
      this.x = W.camX - 12 + Math.sin(this.t * 2) * 4;
      if (p) this.y = G.lerp(this.y || p.y, Math.min(p.y + p.h - this.h, W.ph - 3 * T - this.h), dt * 3);
      this.roarT -= dt;
      if (this.roarT <= 0 && !this.stopped) { this.roarT = 4 + Math.random() * 3; sfx('roar'); W.shake = 0.3; }
      if (!this.stopped && p && !p.dead && p.x < W.camX + 26) p.die('caught');
    }
    draw(x, t) {
      const c = A.get('abnauaiu_' + (Math.floor(t * 6) % 4), 1);
      if (c) { x.imageSmoothingEnabled = true; A.blit(x, c, this.x + 22 - 28, this.y + this.h - 70); x.imageSmoothingEnabled = false; }
      else A.drawAbnauaiu(x, this.x + 22, this.y + this.h, t, 1, 1);
    }
  }
  E.Abnauaiu = Abnauaiu;

  /* ======================= ОСАДНАЯ БАШНЯ ======================= */
  class FallingStone extends Ent {
    constructor(x, y, big) { super(x, y, big ? 14 : 10, big ? 14 : 10); this.enemyShot = true; }
    update(dt) {
      const W = this.world;
      this.vy = Math.min(this.vy + 700 * dt, 400); this.y += this.vy * dt; this.x += this.vx * dt;
      if (W.isSolidPx(this.cx, this.y + this.h) || this.y > W.ph) {
        this.dead = true; W.burst(this.cx, this.y + this.h, 8, ['#8a8478', '#5a554c', '#aaa'], { min: 30, max: 100 }); sfx('bump');
      }
      const p = W.player;
      if (p && !p.dead && G.overlap(this, p)) { p.hurt(this); this.dead = true; }
    }
    draw(x) {
      x.fillStyle = '#1b1218'; x.beginPath(); x.arc(this.cx, this.cy, this.w / 2 + 1, 0, 7); x.fill();
      x.fillStyle = '#8a8478'; x.beginPath(); x.arc(this.cx, this.cy, this.w / 2, 0, 7); x.fill();
      x.fillStyle = '#aaa59a'; x.fillRect(this.cx - 2, this.cy - 3, 3, 2);
    }
  }
  E.FallingStone = FallingStone;

  class StoneRain extends Ent {
    constructor(every) { super(0, 0, 0, 0); this.every = every || 3; this.cd = 2; this.warn = []; this.front = true; }
    update(dt) {
      const W = this.world, p = W.player;
      if (!p || p.dead || W.bossActive) return;
      this.cd -= dt;
      if (this.cd <= 0) {
        this.cd = this.every * G.rr(0.7, 1.2);
        const tx = G.clamp(p.cx + G.rr(-60, 60), 24, W.pw - 24);
        // камень появляется под ближайшим потолком над героем
        let ty = Math.floor(p.y / T);
        while (ty > 0 && !W.solidAt(Math.floor(tx / T), ty - 1)) ty--;
        this.warn.push({ x: tx, y: Math.max(ty * T, W.camY), t: 0.7 });
      }
      for (const w of this.warn) {
        w.t -= dt;
        if (w.t <= 0 && !w.done) { w.done = true; W.add(new FallingStone(w.x - 5, w.y - 4)); }
      }
      this.warn = this.warn.filter((w) => w.t > -0.1);
    }
    draw(x, t) {
      for (const w of this.warn) if (!w.done) {
        x.fillStyle = Math.floor(t * 12) % 2 ? '#ff4020' : '#ffd040';
        x.beginPath(); x.moveTo(w.x - 5, w.y + 2); x.lineTo(w.x + 5, w.y + 2); x.lineTo(w.x, w.y + 10); x.fill();
      }
    }
  }
  E.StoneRain = StoneRain;

  class Shockwave extends Ent {
    constructor(x, y, dir) { super(x, y - 10, 12, 10); this.vx = dir * 140; this.enemyShot = true; }
    update(dt) {
      const W = this.world; this.t += dt; this.x += this.vx * dt;
      if (this.t > 1.6 || W.isSolidPx(this.cx + G.sign(this.vx) * 7, this.y + 4)) this.dead = true;
      const p = W.player;
      if (p && !p.dead && G.overlap(this, p)) { p.hurt(this); }
      if (Math.random() < 0.6) W.burst(this.cx, this.y + this.h, 1, ['#c8b090', '#8a7050'], { angle: -Math.PI / 2, spread: 0.6, min: 20, max: 70, life: 0.4 });
    }
    draw(x) {
      x.fillStyle = 'rgba(230,210,170,0.8)';
      x.beginPath(); x.moveTo(this.x, this.y + this.h); x.lineTo(this.cx, this.y - 2 + Math.sin(this.t * 30) * 2); x.lineTo(this.x + this.w, this.y + this.h); x.fill();
    }
  }
  E.Shockwave = Shockwave;

  /* Осадный мастер — страж вершины башни */
  class SiegeMaster extends Enemy {
    constructor(x, y) {
      super(x - 5, y - 14, 20, 28); this.kind = 'master'; this.hp = 5; this.maxHp = 5; this.boss = true; this.scaleK = 2;
      this.state = 'sleep'; this.timer = 0; this.stompable = false; this.score = 3000; this.name = 'Осадный мастер';
    }
    blocks() { return this.state !== 'recover'; }
    hit(dir, kind) {
      if (kind === 'lightning') return 'blocked';
      if (this.state !== 'recover' || this.hurtT > 0) { sfx('clang'); return 'blocked'; }
      this.hp--; this.flashT = 0.3; this.hurtT = 0.5; sfx('stomp'); this.world.shake = 0.2; G.vibrate(40);
      this.state = 'walk'; this.timer = 0.8;
      if (this.hp <= 0) { this.die(kind, dir); this.world.bossActive = false; this.world.boss = null; if (G.game) G.game.onBossDefeated(this); }
      return true;
    }
    stomp() { if (this.state === 'recover') { this.hit(0, 'stomp'); return true; } return false; }
    update(dt) {
      const W = this.world, p = W.player;
      this.t += dt; if (this.flashT > 0) this.flashT -= dt; if (this.hurtT > 0) this.hurtT -= dt;
      if (this.state === 'sleep') {
        this.physics(dt);
        if (p && Math.abs(p.cy - this.cy) < 50 && Math.abs(p.cx - this.cx) < 150) { this.state = 'walk'; this.timer = 1; W.boss = this; W.bossActive = true; sfx('roar'); if (G.game) G.game.say('master', 'Кто посмел подняться на мою башню? Раздавлю!'); }
        return;
      }
      this.timer -= dt;
      this.stompable = this.state === 'recover';
      this.harmful = this.state !== 'recover';
      if (this.state === 'walk') {
        if (p) this.face = p.cx < this.cx ? -1 : 1;
        this.vx = this.face * 45;
        if (this.timer <= 0) { this.state = 'leap'; this.vy = -360; this.vx = p ? G.clamp((p.cx - this.cx) * 1.1, -130, 130) : 0; }
      } else if (this.state === 'leap') {
        if (this.onGround && this.vy >= 0 && this.timer < 0.5) {
          this.state = 'recover'; this.timer = 1.5; this.vx = 0;
          W.add(new Shockwave(this.x - 12, this.y + this.h, -1)); W.add(new Shockwave(this.x + this.w, this.y + this.h, 1));
          W.shake = 0.35; sfx('boom'); G.vibrate(60);
        }
      } else if (this.state === 'recover') {
        this.vx = 0;
        if (this.timer <= 0) { this.state = 'walk'; this.timer = 1.4; }
      }
      this.physics(dt);
    }
    sprName() {
      const p = A.painted('master_stand');
      if (this.state === 'leap') return 'master_jump';
      if (this.state === 'recover') return p ? (this.timer > 1.2 ? 'master_attack' : 'master_hurt') : 'master_stand';
      if (Math.abs(this.vx) > 3) return p ? 'master_run' + (1 + (Math.floor(this.t * 7) % 4)) : (Math.floor(this.t * 6) % 2 ? 'master_run1' : 'master_run2');
      return 'master_stand';
    }
    draw(x, t) {
      if (this.flashT > 0 && Math.floor(t * 20) % 2) x.globalAlpha = 0.4;
      this.spr(x, this.sprName(), -6, -2);
      x.globalAlpha = 1;
      if (A.painted('master_stand')) { if (this.state === 'recover') this.drawStars(x, t); return; }
      // булава
      const hx = this.face > 0 ? this.x + this.w + 2 : this.x - 2, hy = this.y + 18;
      x.fillStyle = '#4a3020'; x.fillRect(hx - 1, hy - 14, 3, 16);
      x.fillStyle = '#1b1218'; x.beginPath(); x.arc(hx, hy - 16, 6, 0, 7); x.fill();
      x.fillStyle = '#7a7a84'; x.beginPath(); x.arc(hx, hy - 16, 5, 0, 7); x.fill();
      if (this.state === 'recover') this.drawStars(x, t);
    }
    drawStars(x, t) {
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + (i * Math.PI * 2) / 3;
        x.fillStyle = '#ffe070'; x.fillRect(Math.round(this.cx + Math.cos(a) * 12), Math.round(this.y - 6 + Math.sin(a) * 3), 3, 3);
      }
    }
  }
  E.SiegeMaster = SiegeMaster;

  /* Канат, держащий башню — надо перерубить */
  class Rope extends Enemy {
    constructor(x, y) { super(x + 5, y - 24, 6, 40); this.kind = 'rope'; this.harmful = false; this.stompable = false; this.cut = false; this.score = 500; }
    hit(dir, kind) {
      if (this.cut || kind === 'bump') return 'blocked';
      if (this.world.bossActive) { sfx('clang'); this.world.float(this.cx, this.y, 'Сначала — мастер!', '#ffb0a0'); return 'blocked'; }
      this.cut = true; this.enemy = false; sfx('sword'); sfx('break'); G.vibrate(30);
      this.world.burst(this.cx, this.cy, 10, ['#c8a070', '#8a6030'], { min: 40, max: 120 });
      this.world.objDone = (this.world.objDone || 0) + 1;
      this.world.float(this.cx, this.y, 'Канат перерублен!', '#ffe070');
      if (G.game) G.game.onObjective();
      return true;
    }
    touchPlayer() {}
    update(dt) { this.t += dt; }
    draw(x) {
      const bx = Math.round(this.x + 2);
      x.fillStyle = '#1b1218'; x.fillRect(bx - 1, this.y - 200, 4, this.cut ? 190 : 200 + this.h);
      x.fillStyle = '#c8a070'; x.fillRect(bx, this.y - 200, 2, this.cut ? 189 : 199 + this.h);
      if (!this.cut) {
        x.fillStyle = '#8a6030'; for (let j = 0; j < this.h; j += 4) x.fillRect(bx, this.y + j, 2, 1);
        x.fillStyle = '#5a5a64'; x.fillRect(bx - 4, this.y + this.h - 2, 10, 6);
      }
    }
  }
  E.Rope = Rope;

  /* ======================= ВЫЛАЗКА: обоз ======================= */
  class Cart extends Enemy {
    constructor(x, y) { super(x - 8, y - 4, 30, 20); this.kind = 'cart'; this.harmful = false; this.hp = 1; this.score = 400; }
    update(dt) { this.t += dt; this.physics(dt); }
    touchPlayer() {}
    die(kind, dir) {
      if (this.dead) return;
      this.dead = true;
      const W = this.world;
      W.score += this.score; W.float(this.cx, this.y - 6, 'Обоз разбит!', '#ffe070');
      sfx('break'); G.vibrate(30);
      for (let i = 0; i < 4; i++) W.debris(Math.floor(this.cx / T), Math.floor(this.cy / T), i % 2 ? '#8a5a30' : '#d8c8a0');
      for (let i = 0; i < 3; i++) W.add(new E.PopCoin(this.cx - 6 + i * 6, this.y - 8));
      W.objDone = (W.objDone || 0) + 1;
      if (G.game) G.game.onObjective();
    }
    draw(x) {
      const bx = Math.round(this.x), by = Math.round(this.y);
      const pc = A.prop('cart', 1);
      if (pc) { A.blit(x, pc, this.x - 2, this.y + this.h - 24 + 1); return; }
      x.fillStyle = '#1b1218'; x.fillRect(bx - 1, by + 5, 32, 11);
      x.fillStyle = '#7a4a26'; x.fillRect(bx, by + 6, 30, 9);
      x.fillStyle = '#d8c8a0'; x.beginPath(); x.ellipse(bx + 9, by + 5, 8, 6, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(bx + 21, by + 5, 8, 6, 0, 0, 7); x.fill();
      x.fillStyle = '#b8a880'; x.fillRect(bx + 8, by + 1, 2, 3); x.fillRect(bx + 20, by + 1, 2, 3);
      x.fillStyle = '#1b1218'; [6, 24].forEach((w) => { x.beginPath(); x.arc(bx + w, by + 17, 4, 0, 7); x.fill(); });
      x.fillStyle = '#9a7a50'; [6, 24].forEach((w) => { x.fillRect(bx + w - 1, by + 16, 2, 2); });
    }
  }
  E.Cart = Cart;

  /* ======================= МАРВАН ======================= */
  class Spear extends Ent {
    constructor(x, y, vx, vy) { super(x, y, 8, 4); this.vx = vx; this.vy = vy; this.enemyShot = true; }
    update(dt) {
      const W = this.world; this.t += dt;
      this.vy += 500 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (W.isSolidPx(this.cx, this.cy) || this.t > 4) { this.dead = true; W.burst(this.cx, this.cy, 4, ['#aaa', '#fff'], { min: 20, max: 60 }); return; }
      const p = W.player;
      if (p && !p.dead) {
        const sb = p.swordBox();
        if (sb && G.overlap(this, sb)) { this.dead = true; sfx('clang'); return; }
        if (G.overlap(this, p)) { p.hurt(this); this.dead = true; }
      }
    }
    draw(x) {
      x.save(); x.translate(this.cx, this.cy); x.rotate(Math.atan2(this.vy, this.vx));
      x.fillStyle = '#4a3020'; x.fillRect(-10, -1, 16, 2);
      x.fillStyle = '#e8eef4'; x.beginPath(); x.moveTo(6, -3); x.lineTo(12, 0); x.lineTo(6, 3); x.fill();
      x.restore();
    }
  }
  E.Spear = Spear;

  class LightningStrike extends Ent {
    constructor(x, groundY) { super(x - 12, groundY - 240, 24, 240); this.warn = 1.0; this.front = true; this.struck = false; this.light = 0; }
    update(dt) {
      const W = this.world;
      this.t += dt;
      if (!this.struck && this.t >= this.warn) {
        this.struck = true; W.flash = 0.6; W.shake = 0.4; sfx('lightning'); G.vibrate(80);
        const zone = { x: this.x, y: this.y + this.h - 60, w: this.w, h: 60 };
        const p = W.player;
        if (p && !p.dead && G.overlap(p, zone)) p.hurt(this);
        for (const e of W.entities) if (e.boss && !e.dead && G.overlap(e, zone) && e.struckBy) e.struckBy(this);
        W.burst(this.cx, this.y + this.h, 20, ['#fff', '#bfe0ff', '#ffe070'], { angle: -Math.PI / 2, spread: 1.2, min: 60, max: 200 });
      }
      if (this.t > this.warn + 0.35) this.dead = true;
    }
    draw(x, t) {
      const gy = this.y + this.h;
      if (!this.struck) {
        const k = this.t / this.warn;
        x.fillStyle = `rgba(150,200,255,${0.25 + k * 0.5})`;
        x.beginPath(); x.ellipse(this.cx, gy - 1, 12 * (0.5 + k * 0.5), 3, 0, 0, 7); x.fill();
        if (Math.floor(t * 16) % 2) { x.fillStyle = '#e8f4ff'; x.fillRect(this.cx - 1, gy - 8 - k * 10, 2, 4); }
      } else {
        x.strokeStyle = '#ffffff'; x.lineWidth = 3; x.beginPath();
        let px = this.cx, py = this.world.camY;
        x.moveTo(px, py);
        while (py < gy) { py += 14; px = this.cx + G.rr(-8, 8); x.lineTo(px, Math.min(py, gy)); }
        x.stroke();
        x.strokeStyle = 'rgba(150,200,255,0.6)'; x.lineWidth = 7; x.stroke();
      }
    }
  }
  E.LightningStrike = LightningStrike;

  class Marwan extends Enemy {
    constructor(x, y) {
      super(x - 15, y - 26, 40, 40); this.kind = 'marwan'; this.boss = true; this.name = 'Марван';
      this.hp = 9; this.maxHp = 9; this.phase = 1; this.state = 'intro'; this.timer = 1.2; this.stompable = false;
      this.mounted = true; this.score = 10000; this.face = -1; this.hurtT = 0; this.strikeCd = 2;
    }
    init() { this.world.boss = this; this.world.bossActive = true; }
    vulnerable() { return this.state === 'dizzy' || this.state === 'tired' || this.state === 'stunned'; }
    setPhase(n) {
      const W = this.world;
      this.phase = n;
      if (n === 2) {
        this.mounted = false; this.x += 10; this.y += 12; this.w = 20; this.h = 28;
        W.add(new E.PowerItem(this.cx, this.y - 20, 'honey', false));
        this.state = 'walk'; this.timer = 1.2;
        const sp = (x) => { const s = new E.Soldier(x, W.ph - 4 * T - 14); s.face = x < W.pw / 2 ? 1 : -1; W.add(s); };
        sp(2 * T); sp(W.pw - 3 * T);
        if (G.game) G.game.say('marwan', 'Конь пал… Ничего. Я и пешим сокрушу тебя!');
      }
      if (n === 3) {
        W.def.rain = true; this.state = 'walk'; this.timer = 1;
        if (G.game) { G.game.say('narrator', 'И тогда загремел Аҩы, владыка грома, — и небо раскололось над Анакопиа.'); G.game.storm(); }
      }
    }
    struckBy() {
      if (this.state === 'defeated') return;
      this.state = 'stunned'; this.timer = 2.6; this.vx = 0;
      this.world.float(this.cx, this.y - 10, 'Гром Аҩы!', '#bfe0ff');
    }
    hit(dir, kind) {
      if (this.state === 'defeated' || this.state === 'intro') return 'blocked';
      if (kind === 'lightning') return 'blocked';
      if (!this.vulnerable() || this.hurtT > 0) { sfx('clang'); this.world.burst(this.cx, this.cy, 4, ['#fff', '#ffe080'], { min: 30, max: 90, life: 0.3 }); return 'blocked'; }
      this.hp--; this.hurtT = 0.7; this.flashT = 0.4; sfx('stomp'); this.world.shake = 0.3; G.vibrate(50);
      this.world.float(this.cx, this.y - 8, '-1', '#ff8080');
      if (this.hp <= 0) { this.defeat(); return true; }
      if (this.hp === 6 && this.phase === 1) { this.setPhase(2); return true; }
      if (this.hp === 3 && this.phase === 2) { this.setPhase(3); return true; }
      this.state = this.mounted ? 'turn' : 'walk'; this.timer = 0.8;
      return true;
    }
    stomp(p) {
      if (this.vulnerable()) { this.hit(0, 'stomp'); return true; }
      if (p) { p.vy = -300; sfx('clang'); }
      return true;
    }
    touchPlayer(p) { if (this.vulnerable() || this.state === 'defeated' || this.state === 'intro') return; p.hurt(this); }
    defeat() {
      this.state = 'defeated'; this.timer = 2.2; this.vx = 0; this.harmful = false;
      this.world.bossActive = false;
      sfx('boom');
      if (G.game) G.game.onBossDefeated(this);
    }
    update(dt) {
      const W = this.world, p = W.player;
      this.t += dt; if (this.flashT > 0) this.flashT -= dt; if (this.hurtT > 0) this.hurtT -= dt;
      this.timer -= dt;
      this.stompable = true;
      this.harmful = !this.vulnerable() && this.state !== 'defeated';
      const toP = p ? G.sign(p.cx - this.cx) || 1 : -1;
      switch (this.state) {
        case 'intro': this.vx = 0; if (this.timer <= 0) { this.state = 'aim'; this.timer = 1; } break;
        case 'aim': this.vx = 0; this.face = toP; if (this.timer <= 0) { this.state = 'charge'; sfx('roar'); } break;
        case 'charge':
          this.vx = this.face * 235;
          if (Math.floor(this.t * 6) !== Math.floor((this.t - dt) * 6)) sfx('gallop');
          if (this.hitL || this.hitR || this.x < 2 || this.x + this.w > W.pw - 2) { this.state = 'dizzy'; this.timer = 1.9; this.vx = 0; W.shake = 0.4; sfx('boom'); G.vibrate(60); }
          break;
        case 'dizzy': this.vx = 0; if (this.timer <= 0) { this.state = 'turn'; this.timer = 0.6; } break;
        case 'turn': this.vx = 0; if (this.timer <= 0) { this.state = 'aim'; this.timer = this.phase === 1 ? 0.9 : 0.6; } break;
        case 'walk':
          this.face = toP; this.vx = this.face * (this.phase === 3 ? 70 : 50);
          if (this.timer <= 0) {
            const r = Math.random();
            if (p && Math.abs(p.cx - this.cx) < 70 && r < 0.6) { this.state = 'raise'; this.timer = 0.55; }
            else { this.state = 'spears'; this.timer = 0.2; this.spearN = this.phase === 3 ? 4 : 3; }
          }
          break;
        case 'raise': this.vx = 0; if (this.timer <= 0) { this.state = 'lunge'; this.timer = 0.35; sfx('sword'); } break;
        case 'lunge':
          this.vx = this.face * 230;
          if (p && !p.dead) { const box = { x: this.face > 0 ? this.x + this.w : this.x - 26, y: this.y, w: 26, h: this.h }; if (G.overlap(box, p)) p.hurt(this); }
          if (this.timer <= 0) { this.state = 'tired'; this.timer = this.phase === 3 ? 1.0 : 1.3; this.vx = 0; }
          break;
        case 'spears':
          this.vx = 0; this.face = toP;
          if (this.timer <= 0 && p) {
            const dx = p.cx - this.cx, tt = 0.8;
            W.add(new Spear(this.cx, this.y + 4, dx / tt + G.rr(-30, 30), (-0.5 * 500 * tt * tt + (p.cy - this.y - 4)) / tt));
            sfx('throw');
            this.spearN--; this.timer = 0.45;
            if (this.spearN <= 0) { this.state = 'tired'; this.timer = this.phase === 3 ? 0.9 : 1.2; }
          }
          break;
        case 'tired': this.vx = 0; if (this.timer <= 0) { this.state = 'walk'; this.timer = this.phase === 3 ? 1 : 1.5; } break;
        case 'stunned': this.vx = 0; if (this.timer <= 0) { this.state = 'walk'; this.timer = 0.8; } break;
        case 'defeated':
          this.vx = 0;
          if (this.timer <= 0) { this.state = 'flee'; this.mounted = true; this.face = 1; }
          break;
        case 'flee': this.vx = 200; this.x += this.vx * dt; if (this.x > W.pw + 100) { this.dead = true; if (G.game) G.game.levelComplete(); } return;
        default: break;
      }
      // молнии в третьей фазе
      if (this.phase === 3 && this.state !== 'defeated' && this.state !== 'flee') {
        this.strikeCd -= dt;
        if (this.strikeCd <= 0) {
          this.strikeCd = 2.1;
          const target = Math.random() < 0.55 ? this.cx + this.vx * 0.6 : (p ? p.cx : this.cx);
          W.add(new LightningStrike(G.clamp(target, 20, W.pw - 20), this.y + this.h));
        }
      }
      this.physics(dt);
      if (this.x < 0) this.x = 0;
      if (this.x + this.w > W.pw) this.x = W.pw - this.w;
    }
    draw(x, t) {
      if (this.flashT > 0 && Math.floor(t * 20) % 2) x.globalAlpha = 0.4;
      if (this.mounted) {
        const fr = this.state === 'charge' || this.state === 'flee' ? ['a', 'b', 'c', 'b'][Math.floor(t * 12) % 4] : 'a';
        const hx = this.cx - 24, hy = this.y + this.h - 30;
        if (this.state === 'aim') { x.save(); x.translate(this.cx, this.y + this.h); x.rotate(-this.face * 0.12); x.translate(-this.cx, -(this.y + this.h)); }
        const moving = this.state === 'charge' || this.state === 'flee';
        const mr = A.get('marwanhorse_' + (this.state === 'aim' ? 'rear' : moving ? fr : 'stand'), this.face);
        if (mr) A.blit(x, mr, hx + (mr.ox || 0), hy + (mr.oy || 0));
        else {
          const hc = A.get('whorse_' + fr, this.face);
          const top = A.get('marwan_stand', this.face);
          if (top) A.blitPart(x, top, 0, 0, 32, 24, hx + (this.face > 0 ? 6 : 10), hy - 18);
          if (hc) A.blit(x, hc, hx, hy);
        }
        if (this.state === 'aim') x.restore();
      } else {
        const pm = A.painted('marwan_stand');
        const tired = this.state === 'tired' || this.state === 'stunned' || this.state === 'defeated';
        const f = this.state === 'raise' || this.state === 'lunge' ? 'attack' : tired && pm ? 'hurt' : Math.abs(this.vx) > 3 ? (pm ? 'run' + (1 + (Math.floor(t * 7) % 4)) : (Math.floor(t * 6) % 2 ? 'run1' : 'run2')) : 'stand';
        this.spr(x, 'marwan_' + f, -6, -2);
        if (pm) { x.globalAlpha = 1; if (this.vulnerable()) { for (let i = 0; i < 3; i++) { const a = t * 5 + (i * Math.PI * 2) / 3; x.fillStyle = '#ffe070'; x.fillRect(this.cx + Math.cos(a) * 12, this.y - 8 + Math.sin(a) * 3, 3, 3); } } if (this.state === 'raise') { x.fillStyle = '#ff3020'; x.font = 'bold 12px sans-serif'; x.fillText('!', this.cx - 2, this.y - 10); } return; }
        // сабля
        const hx = this.face > 0 ? this.x + this.w + 4 : this.x - 4, hy = this.y + 18;
        x.save(); x.translate(hx, hy); x.rotate(this.state === 'raise' ? -this.face * 1.2 : this.state === 'lunge' ? 0 : this.face * 0.6);
        x.fillStyle = '#1b1218'; x.fillRect(-1, -22, 4, 24); x.fillStyle = '#e8eef4'; x.fillRect(0, -21, 2, 22); x.fillStyle = '#f0c040'; x.fillRect(-3, 0, 8, 2);
        x.restore();
      }
      x.globalAlpha = 1;
      if (this.vulnerable()) {
        for (let i = 0; i < 3; i++) { const a = t * 5 + (i * Math.PI * 2) / 3; x.fillStyle = '#ffe070'; x.fillRect(Math.round(this.cx + Math.cos(a) * 12), Math.round(this.y - 8 + Math.sin(a) * 3), 3, 3); }
      }
      if (this.state === 'aim' || this.state === 'raise') { x.fillStyle = '#ff3020'; x.font = 'bold 12px sans-serif'; x.fillText('!', this.cx - 2, this.y - 10); }
    }
  }
  E.Marwan = Marwan;

  /* ======================= ОБОРОНА СТЕН ======================= */
  class Stone extends Ent { // камень, брошенный защитником
    constructor(x, y, vx, vy) { super(x - 4, y - 4, 8, 8); this.vx = vx; this.vy = vy; this.friendly = true; }
    update(dt) {
      const W = this.world; this.t += dt;
      this.vy += 500 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      for (const e of W.entities) {
        if ((e.enemy || e.ramTarget) && !e.dead && e !== this && G.overlap(this, e)) {
          if (e.ramTarget) e.damage(1); else e.hit(G.sign(this.vx) || 1, 'stone');
          this.dead = true; W.burst(this.cx, this.cy, 6, ['#8a8478', '#aaa'], { min: 30, max: 90 }); return;
        }
      }
      const overWall = W.director && this.cx < W.director.wallRight + 2; // камень летит через парапет
      const tch = W.tile(Math.floor(this.cx / T), Math.floor((this.cy + 4) / T));
      if ((!overWall && tch !== 'X' && G.art.SOLID.has(tch) && this.t > 0.05) || this.y > W.ph) { this.dead = true; W.burst(this.cx, this.cy, 6, ['#8a8478', '#aaa'], { min: 30, max: 90 }); sfx('bump'); }
    }
    draw(x) {
      x.fillStyle = '#1b1218'; x.beginPath(); x.arc(this.cx, this.cy, 5, 0, 7); x.fill();
      x.fillStyle = '#9a9488'; x.beginPath(); x.arc(this.cx, this.cy, 4, 0, 7); x.fill();
      x.fillStyle = '#c8c2b8'; x.fillRect(this.cx - 2, this.cy - 2, 2, 2);
    }
  }
  E.Stone = Stone;

  class Ladder extends Ent {
    constructor(x, topY, bottomY) { super(x, topY, 12, bottomY - topY); this.back = true; this.climbers = 0; this.falling = 0; this.ang = 0; }
    update(dt) {
      if (this.falling) { this.ang += dt * 2.5 * (1 + this.ang); if (this.ang > 1.4) this.dead = true; }
    }
    push() { if (this.falling) return; this.falling = 1; sfx('break'); this.world.score += 300; this.world.float(this.cx, this.y, 'Лестница сброшена!', '#ffe070'); for (const e of this.world.entities) if (e.ladder === this && !e.dead) e.fall(); }
    draw(x) {
      x.save(); x.translate(this.x + 6, this.y + this.h); x.rotate(this.ang + 0.18);
      x.fillStyle = '#6a4424'; x.fillRect(-6, -this.h, 2, this.h); x.fillRect(4, -this.h, 2, this.h);
      x.fillStyle = '#9a6a3a'; for (let j = 6; j < this.h; j += 9) x.fillRect(-6, -j, 12, 2);
      x.restore();
    }
  }

  class SiegeSoldier extends Enemy {
    constructor(x, y, kind, D) {
      super(x, y, 10, 14); this.kind = kind === 'archer' ? 'archer' : kind === 'shield' ? 'shield' : 'soldier';
      this.role = kind; this.D = D; this.state = 'walk'; this.face = -1; this.cd = 2 + Math.random() * 2; this.score = 100;
      this.stompable = true; this.carry = kind === 'ladder';
    }
    fall() { this.state = 'fall'; this.vy = -60; this.vx = 30; }
    hit(dir, kind) { if (this.role === 'shield' && kind === 'stone' && this.state === 'walk' && Math.random() < 0.5) { sfx('clang'); return 'blocked'; } return super.hit(dir, kind); }
    update(dt) {
      const W = this.world, D = this.D, p = W.player;
      this.t += dt; if (this.flashT > 0) this.flashT -= dt;
      if (this.state === 'walk') {
        const stopX = this.role === 'archer' ? this.archerX : D.wallRight + 2;
        if (this.x > stopX) { this.vx = -(this.role === 'ladder' ? 26 : 32); this.face = -1; }
        else {
          this.vx = 0;
          if (this.role === 'archer') this.state = 'shoot';
          else {
            let lad = W.entities.find((e) => e instanceof Ladder && !e.dead && !e.falling && Math.abs(e.x - D.wallRight) < 30 && e.climbers < 2);
            if (!lad && this.role === 'ladder') { lad = W.add(new Ladder(D.wallRight - 2, D.wallTop - 6, D.groundY)); sfx('bump'); }
            if (lad) { this.ladder = lad; lad.climbers++; this.state = 'climb'; this.x = lad.x; }
            else if (this.x > D.wallRight - 2) this.x -= 0; // ждёт лестницу у стены
          }
        }
        this.physics(dt);
      } else if (this.state === 'climb') {
        if (this.ladder.dead || this.ladder.falling) { this.fall(); return; }
        this.vx = 0; this.y -= 22 * dt;
        if (this.y + this.h <= D.wallTop) { this.y = D.wallTop - this.h; this.state = 'onwall'; this.ladder.climbers--; this.x = D.wallRight - this.w - 2; this.face = -1; G.game.say('leon', 'Враг на стене! Руби его!', true); }
      } else if (this.state === 'onwall') {
        if (p) this.face = p.cx < this.cx ? -1 : 1;
        this.vx = this.face * 30; this.physics(dt);
        if (this.x + this.w > D.wallRight) this.x = D.wallRight - this.w;
      } else if (this.state === 'shoot') {
        this.vx = 0; this.face = -1; this.cd -= dt;
        if (this.cd <= 0 && p && !p.dead) {
          this.cd = 2.6 + Math.random();
          const tt = 1.1, dx = p.cx - this.cx, dy = p.cy - this.y;
          const ar = W.add(new E.EnemyArrow(this.cx - 6, this.y + 4, -1, (dy - 0.5 * 160 * tt * tt) / tt));
          ar.vx = dx / tt;
          sfx('arrow');
        }
        this.physics(dt);
      } else if (this.state === 'fall') {
        this.vy += 700 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.y + this.h >= D.groundY) { this.die('stone', 1); }
      }
    }
    extra(x) {
      if (this.role === 'ladder' && this.state === 'walk') {
        x.fillStyle = '#6a4424'; x.fillRect(Math.round(this.x - 14), Math.round(this.y + 2), 40, 2); x.fillRect(Math.round(this.x - 14), Math.round(this.y + 7), 40, 2);
        x.fillStyle = '#9a6a3a'; for (let i = -12; i < 26; i += 7) x.fillRect(Math.round(this.x + i), Math.round(this.y + 2), 2, 7);
      }
      if (this.role === 'archer') E.Archer.prototype.extra.call(this, x);
      if (this.role === 'shield') E.ShieldBearer.prototype.extra.call(this, x);
    }
  }

  class Ram extends Ent {
    constructor(x, y, D) { super(x, y - 26, 64, 26); this.D = D; this.hp = 12; this.maxHp = 12; this.ramTarget = true; this.cd = 2; this.back = false; this.hitAnim = 0; }
    damage(n) { this.hp -= n; this.flashT = 0.15; sfx('break'); this.world.shake = 0.1; if (this.hp <= 0 && !this.dead) { this.dead = true; this.D.onRamDestroyed(this); } }
    update(dt) {
      this.t += dt; if (this.flashT > 0) this.flashT -= dt;
      const D = this.D;
      if (this.x > D.wallRight + 4) this.x -= 16 * dt;
      else {
        this.cd -= dt; this.hitAnim = Math.max(0, this.hitAnim - dt);
        if (this.cd <= 0) { this.cd = 2.2; this.hitAnim = 0.3; D.gateHit(); }
      }
    }
    draw(x, t) {
      const bx = Math.round(this.x - (this.hitAnim > 0.15 ? 4 : 0)), by = Math.round(this.y);
      if (this.flashT > 0) x.globalAlpha = 0.6;
      // навес
      x.fillStyle = '#1b1218'; x.beginPath(); x.moveTo(bx + 2, by + 12); x.lineTo(bx + 32, by - 4); x.lineTo(bx + 62, by + 12); x.fill();
      x.fillStyle = '#7a5a3a'; x.beginPath(); x.moveTo(bx + 5, by + 11); x.lineTo(bx + 32, by - 2); x.lineTo(bx + 59, by + 11); x.fill();
      x.fillStyle = '#5a3a20'; x.fillRect(bx + 6, by + 11, 3, 12); x.fillRect(bx + 55, by + 11, 3, 12);
      // бревно-таран
      x.fillStyle = '#1b1218'; x.fillRect(bx - 8, by + 13, 64, 7);
      x.fillStyle = '#8a5a30'; x.fillRect(bx - 7, by + 14, 62, 5);
      x.fillStyle = '#6a6a74'; x.fillRect(bx - 10, by + 12, 6, 9);
      x.fillStyle = '#1b1218'; [10, 32, 54].forEach((w) => { x.beginPath(); x.arc(bx + w, by + 23, 4, 0, 7); x.fill(); });
      // толкачи
      const leg = Math.floor(t * 6) % 2;
      [22, 40].forEach((w) => { const c = A.get('soldier_' + (leg ? 'run1' : 'run2'), -1); if (c) A.blit(x, c, bx + w + (c.ox || 0), by + 10 + (c.oy || 0)); });
      x.globalAlpha = 1;
    }
  }

  /* Камень из вражеского камнемёта, падающий на стену */
  class WallBoulder extends Ent {
    constructor(x, D) { super(x - 7, -30, 14, 14); this.D = D; this.warnT = 1.1; this.front = true; this.enemyShot = true; }
    update(dt) {
      const W = this.world, D = this.D;
      if (this.warnT > 0) { this.warnT -= dt; return; }
      this.vy += 600 * dt; this.y += this.vy * dt;
      const p = W.player;
      if (p && !p.dead && G.overlap(this, p)) p.hurt(this);
      if (this.y + this.h >= D.wallTop) { this.dead = true; W.shake = 0.25; sfx('boom'); W.burst(this.cx, D.wallTop, 12, ['#8a8478', '#aaa', '#5a554c'], { min: 40, max: 140 }); }
    }
    draw(x, t) {
      const D = this.D;
      if (this.warnT > 0 || this.y < D.wallTop - 40) {
        const k = 1 - Math.max(0, this.warnT) / 1.1;
        x.fillStyle = `rgba(0,0,0,${0.15 + k * 0.35})`; x.beginPath(); x.ellipse(this.cx, D.wallTop, 4 + k * 6, 2, 0, 0, 7); x.fill();
      }
      if (this.warnT <= 0) {
        x.fillStyle = '#1b1218'; x.beginPath(); x.arc(this.cx, this.cy, 8, 0, 7); x.fill();
        x.fillStyle = '#8a8478'; x.beginPath(); x.arc(this.cx, this.cy, 7, 0, 7); x.fill();
      }
    }
  }

  /* Режиссёр обороны: волны, броски камней, ворота */
  class SiegeDirector extends Ent {
    constructor(def) {
      super(0, 0, 0, 0);
      this.wallRight = def.wallCols * T; this.wallTop = def.wallTopRow * T; this.groundY = def.groundRow * T;
      this.time = 0; this.duration = def.duration || 80; this.gateHp = 8; this.maxGate = 8;
      this.ram = null; this.ramDone = false; this.spawnCd = 1.5; this.boulderCd = 7; this.throwCd = 0; this.front = true; this.said = {};
    }
    init() { this.world.director = this; }
    onAction(p) {
      const W = this.world;
      // рядом враг на стене — рубим мечом
      const near = W.entities.find((e) => e instanceof SiegeSoldier && !e.dead && e.state === 'onwall' && Math.abs(e.cx - p.cx) < 30);
      if (near) return false;
      // у края стены — сталкиваем лестницу
      if (p.x + p.w > this.wallRight - 22) {
        const lad = W.entities.find((e) => e instanceof Ladder && !e.dead && !e.falling);
        if (lad) { lad.push(); return true; }
      }
      // иначе — бросок камня в ближайшую цель
      const tgt = this.autoTarget(p);
      if (tgt) {
        // упреждение: целимся туда, где враг окажется к моменту падения камня
        let tx = tgt.cx, ty = tgt.cy;
        for (let k = 0; k < 2; k++) {
          const tt = G.clamp(Math.hypot(tx - p.cx, ty - p.y) / 260, 0.3, 0.95);
          tx = tgt.cx + (tgt.vx || (tgt instanceof Ram && tgt.x > this.wallRight + 4 ? -16 : 0)) * tt;
          ty = tgt.cy + (tgt.state === 'climb' ? -22 * tt : 0);
        }
        this.throwAt(p, tx, ty);
      }
      else this.throwAt(p, p.cx + 120, this.groundY - 6);
      return true;
    }
    autoTarget(p) {
      const W = this.world;
      let best = null, bd = 1e9;
      for (const e of W.entities) {
        if (e.dead) continue;
        let pri = 0;
        if (e instanceof SiegeSoldier) pri = e.state === 'climb' ? 0 : e.state === 'onwall' ? 1e9 : 200;
        else if (e instanceof Ram) pri = 100;
        else continue;
        const d = Math.abs(e.cx - p.cx) + pri;
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }
    throwAt(p, tx, ty) {
      if (this.throwCd > 0) return;
      this.throwCd = 0.32;
      const sx = p.cx + p.face * 4, sy = p.y + 2;
      const dx = tx - sx, dy = ty - sy;
      const tt = G.clamp(Math.hypot(dx, dy) / 260, 0.3, 0.95);
      p.face = dx < 0 ? -1 : 1; p.attackT = 0.15;
      this.world.add(new Stone(sx, sy, dx / tt, (dy - 0.5 * 500 * tt * tt) / tt));
      sfx('throw');
    }
    gateHit() {
      this.gateHp--; this.world.shake = 0.35; sfx('boom'); G.vibrate(50);
      if (this.gateHp === 4) G.game.say('leon', 'Ворота трещат! Камни на таран!', true);
      if (this.gateHp <= 0 && G.game) G.game.failLevel('Ворота пали…');
    }
    onRamDestroyed(r) {
      this.ramDone = true;
      const W = this.world;
      for (let i = 0; i < 6; i++) W.debris(Math.floor((r.x + i * 10) / T), Math.floor(r.cy / T), '#8a5a30');
      sfx('boom'); W.shake = 0.5; W.score += 3000;
      for (const e of W.entities) if (e instanceof SiegeSoldier && !e.dead && e.state !== 'onwall') { e.state = 'flee'; }
      G.game.say('leon', 'Таран разбит! Они бегут! Анакопиа стоит!', true);
      setTimeout(() => G.game && G.game.levelComplete(), 2200);
    }
    spawn(kind) {
      const W = this.world;
      const s = new SiegeSoldier(W.pw - 14, this.groundY - 14, kind, this);
      if (kind === 'archer') s.archerX = G.rr(this.wallRight + 90, Math.min(W.pw, W.viewW || W.pw) - 28);
      W.add(s);
    }
    update(dt) {
      const W = this.world, p = W.player;
      if (!p || p.dead || this.ramDone) { for (const e of W.entities) if (e.state === 'flee') { e.x += 60 * dt; e.face = 1; e.vx = 60; } return; }
      this.time += dt; if (this.throwCd > 0) this.throwCd -= dt;
      // касания по экрану — бросок в точку
      for (const tp of I.taps) {
        const wx = tp.x + W.camX, wy = tp.y + W.camY;
        if (wx > this.wallRight - 10 || wy > this.wallTop + 10) this.throwAt(p, wx, wy);
      }
      const t = this.time;
      if (t < this.duration) {
        this.spawnCd -= dt;
        if (this.spawnCd <= 0) {
          const lvl = t / this.duration;
          this.spawnCd = G.lerp(3.2, 1.6, lvl) * G.rr(0.8, 1.2);
          const r = Math.random();
          if (r < 0.35) this.spawn('ladder');
          else if (r < 0.6 || t < 15) this.spawn('soldier');
          else if (r < 0.8) this.spawn('archer');
          else this.spawn('shield');
        }
        this.boulderCd -= dt;
        if (this.boulderCd <= 0 && t > 12) {
          this.boulderCd = G.rr(4.5, 7);
          W.add(new WallBoulder(G.clamp(p.cx + G.rr(-20, 20), 14, this.wallRight - 14), this));
          if (!this.said.boulder) { this.said.boulder = 1; G.game.say('leon', 'Камнемёт! Следи за тенью на стене!', true); }
        }
        if (t > 25 && !this.said.archers) { this.said.archers = 1; G.game.say('leon', 'Их лучники бьют снизу — дави их камнями!', true); }
      } else if (!this.ram) {
        this.ram = W.add(new Ram(W.pw + 20, this.groundY, this));
        G.game.say('leon', 'Таран! Они тащат таран к воротам!', true);
        sfx('roar');
      }
      W.objectiveText = !this.ram ? `Держись: ${Math.max(0, Math.ceil(this.duration - t))} с · Ворота ${this.gateHp}/${this.maxGate}` : `Разбей таран: ${Math.max(0, this.ram.hp)} · Ворота ${this.gateHp}/${this.maxGate}`;
      // враги на стене не дальше края
      for (const e of W.entities) if (e instanceof SiegeSoldier && e.state === 'flee') { e.x += 60 * dt; }
    }
    draw(x) {
      // зубцы и ворота
      const W = this.world;
      x.fillStyle = '#8f8a80';
      for (let i = 0; i < this.wallRight; i += 16) { x.fillStyle = '#1b1218'; x.fillRect(i + 1, this.wallTop - 11, 10, 11); x.fillStyle = '#9a958a'; x.fillRect(i + 2, this.wallTop - 10, 8, 10); }
      const gx = this.wallRight - 22, gy = this.groundY;
      x.fillStyle = '#1b1218'; x.fillRect(gx - 1, gy - 34, 22, 34);
      const k = this.gateHp / this.maxGate;
      x.fillStyle = k > 0.5 ? '#6a4424' : k > 0.25 ? '#5a3a1e' : '#4a2a14'; x.fillRect(gx, gy - 33, 20, 33);
      x.fillStyle = '#9aa2ac'; x.fillRect(gx, gy - 24, 20, 2); x.fillRect(gx, gy - 10, 20, 2);
      if (k < 0.6) { x.fillStyle = '#1b1218'; x.fillRect(gx + 8, gy - 30, 1, 12); x.fillRect(gx + 12, gy - 18, 1, 10); }
      void W;
    }
  }
  E.SiegeDirector = SiegeDirector;
  E.SiegeSoldier = SiegeSoldier;
  E.Ladder = Ladder;
  E.Ram = Ram;
})();
