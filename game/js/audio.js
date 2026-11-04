/* Анакопиа — звук: синтезатор эффектов и музыкальный секвенсор (Web Audio, без файлов) */
'use strict';
(function () {
  const G = window.G;
  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null, pulseWave = null;
  let current = null, track = null, nextTime = 0, stepIdx = 0, trackGain = null;

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Пульс 25% — «восьмибитный» тембр
    const N = 32, re = new Float32Array(N), im = new Float32Array(N), duty = 0.25;
    for (let n = 1; n < N; n++) {
      re[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
      im[n] = (2 * Math.pow(Math.sin(Math.PI * n * duty), 2)) / (n * Math.PI);
    }
    pulseWave = ctx.createPeriodicWave(re, im);
    applySettings();
    setInterval(schedule, 30);
    return true;
  }

  function applySettings() {
    if (!ctx || !G.save.data) return;
    musicBus.gain.value = G.save.data.music ? 0.32 : 0;
    sfxBus.gain.value = G.save.data.sfx ? 0.55 : 0;
  }

  function osc(type, f, t0) {
    const o = ctx.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(pulseWave); else o.type = type;
    o.frequency.setValueAtTime(f, t0);
    return o;
  }

  /* Одиночный тон с огибающей */
  function tone(type, f, dur, vol, opt) {
    if (!ctx) return;
    opt = opt || {};
    const t0 = ctx.currentTime + (opt.delay || 0);
    const o = osc(type, f, t0);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (opt.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = opt.lp; o.connect(fl); node = fl; }
    node.connect(g); g.connect(opt.bus || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, opt) {
    if (!ctx) return;
    opt = opt || {};
    const t0 = (opt.at !== undefined ? opt.at : ctx.currentTime) + (opt.delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = opt.type || 'lowpass'; f.frequency.value = opt.freq || 2000;
    if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(opt.bus || sfxBus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }

  const SFX = {
    jump() { tone('pulse', 260, 0.16, 0.22, { to: 620 }); },
    coin() { tone('pulse', 988, 0.07, 0.18); tone('pulse', 1319, 0.22, 0.18, { delay: 0.07 }); },
    stomp() { tone('square', 220, 0.12, 0.25, { to: 60 }); noise(0.08, 0.3, { freq: 900 }); },
    hurt() { tone('square', 440, 0.3, 0.25, { to: 110 }); },
    power() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('pulse', f, 0.12, 0.18, { delay: i * 0.06 })); },
    fire() { noise(0.18, 0.35, { freq: 3000, to: 400 }); tone('square', 180, 0.12, 0.12, { to: 90 }); },
    sword() { noise(0.12, 0.35, { type: 'bandpass', freq: 3500, to: 900 }); },
    arrow() { noise(0.15, 0.25, { type: 'highpass', freq: 2500 }); tone('triangle', 900, 0.08, 0.1, { to: 500 }); },
    bow() { tone('triangle', 320, 0.12, 0.25, { to: 140 }); noise(0.06, 0.2, { type: 'highpass', freq: 3000 }); },
    break() { noise(0.25, 0.45, { freq: 1500, to: 200 }); tone('square', 120, 0.15, 0.15, { to: 50 }); },
    bump() { tone('square', 140, 0.08, 0.25, { to: 90 }); },
    life() { [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone('pulse', f, 0.1, 0.16, { delay: i * 0.07 })); },
    check() { [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, 0.18, 0.25, { delay: i * 0.08 })); },
    lightning() { noise(0.9, 0.7, { freq: 6000, to: 100 }); tone('square', 60, 0.6, 0.3, { to: 30 }); },
    splash() { noise(0.35, 0.35, { type: 'bandpass', freq: 1200, to: 300 }); },
    alarm() { [880, 660, 880, 660].forEach((f, i) => tone('square', f, 0.14, 0.18, { delay: i * 0.15 })); },
    roar() { noise(0.9, 0.55, { freq: 500, to: 120 }); tone('sawtooth', 90, 0.9, 0.22, { to: 55, lp: 600 }); },
    clang() { tone('square', 1800, 0.12, 0.12, { to: 1200 }); tone('triangle', 2400, 0.2, 0.1); },
    boom() { noise(0.7, 0.7, { freq: 800, to: 60 }); tone('sine', 90, 0.5, 0.45, { to: 30 }); },
    select() { tone('pulse', 660, 0.06, 0.15); tone('pulse', 990, 0.08, 0.15, { delay: 0.05 }); },
    string() { [587, 880, 1175, 1760].forEach((f, i) => tone('sawtooth', f, 0.5, 0.08, { delay: i * 0.09, lp: 2500 })); },
    ignite() { noise(0.6, 0.45, { freq: 1800, to: 500 }); },
    gallop() { tone('triangle', 110, 0.05, 0.25, { to: 70 }); },
    thunderFar() { noise(1.4, 0.3, { freq: 300, to: 60 }); },
    throw() { noise(0.1, 0.25, { type: 'bandpass', freq: 1200, to: 600 }); },
    gate() { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone('pulse', f, 0.2, 0.16, { delay: i * 0.09 })); },
  };

  /* ---------- Музыка ---------- */
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freq(tok) {
    const m = /^([A-G][#b]?)(-?\d)$/.exec(tok);
    if (!m) return 0;
    const midi = 12 * (+m[2] + 1) + NOTE[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function parse(str) {
    const toks = str.replace(/\|/g, ' ').trim().split(/\s+/);
    const ev = [];
    let cur = null;
    toks.forEach((t, i) => {
      if (t === '-') { if (cur) cur.len++; }
      else if (t === '.') cur = null;
      else if (/^[kshc]$/.test(t)) { cur = null; ev.push({ step: i, drum: t, len: 1 }); }
      else { cur = { step: i, f: freq(t), len: 1 }; ev.push(cur); }
    });
    const byStep = {};
    ev.forEach((e) => { (byStep[e.step] = byStep[e.step] || []).push(e); });
    return { byStep, len: toks.length };
  }

  // Мелодии написаны для игры (лады ре минор / дорийский, «бурдон» как в народной полифонии)
  const TRACKS = {
    title: { bpm: 92, parts: [
      { wave: 'sawtooth', vol: 0.16, lp: 1800, n: 'D4 - - F4 G4 - A4 - | C5 - A4 - G4 F4 G4 - | A4 - - G4 F4 - E4 - | D4 - - - - - . . | F4 - - G4 A4 - C5 - | D5 - C5 A4 G4 - A4 - | G4 F4 E4 - F4 - E4 C4 | D4 - - - - - . .' },
      { wave: 'triangle', vol: 0.3, n: 'D3 - - - A2 - - - | F2 - - - C3 - - - | Bb2 - - - C3 - - - | D3 - - - A2 - - - | Bb2 - - - F2 - - - | D3 - - - C3 - - - | Bb2 - - - C3 - - - | D3 - - - - - - -' },
      { wave: 'pulse', vol: 0.05, n: 'A3 - - - - - - - | A3 - - - - - - - | F3 - - - G3 - - - | A3 - - - - - - - | F3 - - - - - - - | A3 - - - G3 - - - | F3 - - - G3 - - - | A3 - - - - - - -' },
    ] },
    village: { bpm: 132, parts: [
      { wave: 'pulse', vol: 0.14, n: 'A4 . A4 C5 D5 . C5 A4 | G4 . G4 A4 C5 . A4 G4 | F4 . F4 G4 A4 . G4 F4 | E4 . D4 E4 F4 - E4 - | A4 . A4 C5 D5 . E5 D5 | C5 . A4 G4 A4 . C5 D5 | E5 . D5 C5 A4 . G4 E4 | D4 - - - D4 . . .' },
      { wave: 'triangle', vol: 0.32, n: 'D3 . A2 . D3 . A2 . | C3 . G2 . C3 . G2 . | Bb2 . F2 . Bb2 . F2 . | A2 . E2 . A2 . C3 . | D3 . A2 . D3 . A2 . | C3 . G2 . C3 . G2 . | Bb2 . F2 . A2 . E2 . | D3 . A2 . D3 . . .' },
      { drum: true, vol: 1, n: 'k . h . s . h . | k . h . s . h h' },
    ] },
    gorge: { bpm: 112, parts: [
      { wave: 'pulse', vol: 0.12, n: 'D5 . A4 . F4 . A4 . | C5 . G4 . E4 . G4 . | Bb4 . F4 . D4 . F4 . | A4 . E4 . C#5 . E5 . | D5 - - C5 A4 - G4 - | F4 - G4 A4 C5 - - - | Bb4 - A4 G4 F4 - E4 - | D4 - - - . . . .' },
      { wave: 'triangle', vol: 0.3, n: 'D3 - - - D3 - - - | C3 - - - C3 - - - | Bb2 - - - Bb2 - - - | A2 - - - A2 - - - | D3 - - - F3 - - - | F2 - - - C3 - - - | Bb2 - - - C3 - - - | D3 - - - A2 - - -' },
      { drum: true, vol: 0.8, n: 'k . . h s . h . | k . k h s . h .' },
    ] },
    chase: { bpm: 168, parts: [
      { wave: 'pulse', vol: 0.13, n: 'D4 D4 F4 D4 G4 D4 F4 E4 | D4 D4 F4 D4 A4 G4 F4 E4 | C4 C4 E4 C4 F4 C4 E4 D4 | C#4 E4 A4 E4 C#5 A4 E4 C#4' },
      { wave: 'triangle', vol: 0.34, n: 'D2 D3 D2 D3 D2 D3 D2 D3 | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | C2 C3 C2 C3 C2 C3 C2 C3 | A1 A2 A1 A2 A1 A2 C#3 E3' },
      { drum: true, vol: 1, n: 'k h s h k k s h' },
    ] },
    siege: { bpm: 140, parts: [
      { wave: 'pulse', vol: 0.13, n: 'D4 - D4 F4 A4 - G4 F4 | E4 - E4 G4 Bb4 - A4 G4 | F4 - F4 A4 D5 - C5 Bb4 | A4 - G4 - A4 - - - | D5 - C5 Bb4 A4 - G4 F4 | E4 - F4 G4 A4 - - - | Bb4 - A4 G4 F4 - E4 F4 | D4 - - - - - . .' },
      { wave: 'triangle', vol: 0.34, n: 'D2 . D3 . D2 . D3 . | C2 . C3 . C2 . C3 . | Bb1 . Bb2 . Bb1 . Bb2 . | A1 . A2 . A1 . A2 . | D2 . D3 . D2 . D3 . | C2 . C3 . A1 . A2 . | Bb1 . Bb2 . A1 . A2 . | D2 . D3 . D2 . . .' },
      { drum: true, vol: 1, n: 'k . k s k . k s | k . k s k k s s' },
    ] },
    cave: { bpm: 76, parts: [
      { wave: 'triangle', vol: 0.22, n: 'D5 - - - . . A4 - | - - . . F4 - - - | E4 - - - . . G4 - | - - . . A4 - - - | D5 - - - . . C5 - | - - . . A4 - - - | Bb4 - - - A4 - G4 - | A4 - - - - - . .' },
      { wave: 'sine', vol: 0.3, n: 'D2 - - - - - - - | D2 - - - - - - - | C2 - - - - - - - | A1 - - - - - - - | D2 - - - - - - - | F2 - - - - - - - | G2 - - - - - - - | A1 - - - - - - -' },
      { drum: true, vol: 0.4, n: 'h . . . . . . . | . . . . h . . .' },
    ] },
    stealth: { bpm: 96, parts: [
      { wave: 'pulse', vol: 0.1, n: 'D4 . . F4 . . E4 . | D4 . . A3 . . C4 . | D4 . . F4 . . G4 . | A4 . . G4 . F4 E4 . | D4 . . F4 . . E4 . | D4 . . A3 . . C#4 . | D4 . F4 . A4 . G4 . | F4 . E4 . D4 . . .' },
      { wave: 'triangle', vol: 0.3, n: 'D2 . . . A1 . . . | D2 . . . A1 . . . | Bb1 . . . F2 . . . | A1 . . . E2 . . . | D2 . . . A1 . . . | D2 . . . A1 . . . | Bb1 . . . C2 . . . | D2 . . . A1 . . .' },
      { drum: true, vol: 0.6, n: 'h . . h . . s . | h . . h . h s .' },
    ] },
    horse: { bpm: 150, parts: [
      { wave: 'pulse', vol: 0.13, n: 'A4 - C5 D5 E5 - D5 C5 | D5 - C5 A4 G4 - A4 - | F4 - G4 A4 C5 - A4 G4 | A4 - - - E4 - - - | A4 - C5 D5 E5 - G5 E5 | D5 - C5 A4 C5 - D5 - | E5 - D5 C5 A4 - G4 E4 | D4 - - - - - - -' },
      { wave: 'triangle', vol: 0.34, n: 'D2 D2 A2 D2 D2 D2 A2 D2 | C2 C2 G2 C2 C2 C2 G2 C2 | Bb1 Bb1 F2 Bb1 Bb1 Bb1 F2 Bb1 | A1 A1 E2 A1 A1 A1 E2 A1' },
      { drum: true, vol: 1, n: 'k . k k s . k k' },
    ] },
    tower: { bpm: 126, parts: [
      { wave: 'pulse', vol: 0.12, n: 'D4 . F4 . A4 . D5 . | C5 . A4 . F4 . A4 . | E4 . G4 . Bb4 . E5 . | D5 . A4 . G4 . A4 . | F4 . A4 . C5 . F5 . | E5 . C5 . A4 . C5 . | D5 . Bb4 . G4 . E4 . | A4 - - - C#5 - - -' },
      { wave: 'triangle', vol: 0.32, n: 'D2 . D2 . D3 . D2 . | F2 . F2 . F3 . F2 . | C2 . C2 . C3 . C2 . | D2 . D2 . D3 . D2 . | F2 . F2 . F3 . F2 . | A1 . A1 . A2 . A1 . | Bb1 . Bb1 . Bb2 . Bb1 . | A1 . A1 . A2 . A1 .' },
      { drum: true, vol: 0.9, n: 'k . h k s . h . | k . h k s . s h' },
    ] },
    boss: { bpm: 152, parts: [
      { wave: 'pulse', vol: 0.13, n: 'D4 Eb4 D4 . A4 Bb4 A4 . | G4 A4 G4 . F4 E4 D4 . | D4 Eb4 D4 . C5 Bb4 A4 . | G4 F4 E4 F4 E4 D4 C#4 .' },
      { wave: 'sawtooth', vol: 0.06, lp: 900, n: 'D3 - - - - - - - | Bb2 - - - - - - - | C3 - - - - - - - | A2 - - - - - - -' },
      { wave: 'triangle', vol: 0.34, n: 'D2 D2 D3 D2 D2 D2 D3 D2 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 | C2 C2 C3 C2 C2 C2 C3 C2 | A1 A1 A2 A1 A1 A1 A2 C#2' },
      { drum: true, vol: 1, n: 'k h s h k k s s' },
    ] },
    victory: { bpm: 140, once: true, parts: [
      { wave: 'pulse', vol: 0.16, n: 'D4 F4 A4 D5 - - C5 D5 | E5 - - - F5 - - - | D5 - - - - - - - . .' },
      { wave: 'triangle', vol: 0.3, n: 'D3 - - - - - - - | A2 - - - Bb2 - - - | D3 - - - - - - - . .' },
    ] },
    gameover: { bpm: 100, once: true, parts: [
      { wave: 'pulse', vol: 0.14, n: 'A4 - G4 - F4 - E4 - | D4 - - - - - - - . .' },
      { wave: 'triangle', vol: 0.3, n: 'F2 - - - C2 - - - | D2 - - - - - - - . .' },
    ] },
    ending: { bpm: 84, parts: [
      { wave: 'sawtooth', vol: 0.15, lp: 2000, n: 'A4 - - G4 F4 - G4 A4 | D5 - - - C5 - A4 - | Bb4 - A4 G4 F4 - G4 - | A4 - - - - - - - | F4 - G4 A4 C5 - Bb4 A4 | G4 - F4 E4 F4 - E4 D4 | E4 - - F4 E4 - D4 C#4 | D4 - - - - - - -' },
      { wave: 'triangle', vol: 0.28, n: 'D3 - - - - - - - | F2 - - - - - - - | G2 - - - - - - - | A2 - - - - - - - | D3 - - - - - - - | C3 - - - - - - - | A2 - - - - - - - | D3 - - - - - - -' },
      { wave: 'pulse', vol: 0.04, n: 'A3 - - - - - - - | A3 - - - - - - - | Bb3 - - - - - - - | A3 - - - - - - - | A3 - - - - - - - | G3 - - - - - - - | E3 - - - - - - - | F3 - - - - - - -' },
    ] },
  };
  for (const k in TRACKS) TRACKS[k].parts.forEach((p) => (p.parsed = parse(p.n)));

  function drum(kind, t, vol) {
    if (kind === 'k') {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.5 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g); g.connect(trackGain); o.start(t); o.stop(t + 0.2);
    } else if (kind === 's') noise(0.12, 0.22 * vol, { at: t, type: 'bandpass', freq: 1800, bus: trackGain });
    else if (kind === 'h') noise(0.04, 0.12 * vol, { at: t, type: 'highpass', freq: 6000, bus: trackGain });
    else if (kind === 'c') noise(0.4, 0.12 * vol, { at: t, type: 'highpass', freq: 4000, bus: trackGain });
  }

  function note(p, f, t, dur) {
    const o = osc(p.wave, f, t);
    const g = ctx.createGain();
    const v = p.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.012);
    g.gain.setValueAtTime(v, t + Math.max(0.02, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (p.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = p.lp; o.connect(fl); node = fl; }
    if (p.wave === 'sawtooth') { // лёгкое вибрато «смычка»
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
      const lg = ctx.createGain(); lg.gain.value = f * 0.006;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    node.connect(g); g.connect(trackGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function schedule() {
    if (!ctx || !track || ctx.state !== 'running') return;
    const stepDur = 60 / track.bpm / 2;
    if (nextTime < ctx.currentTime - 0.5) nextTime = ctx.currentTime + 0.05; // после паузы
    while (nextTime < ctx.currentTime + 0.15) {
      let ended = true;
      track.parts.forEach((p) => {
        const P = p.parsed;
        if (track.once && stepIdx >= P.len) return;
        ended = false;
        const evs = P.byStep[stepIdx % P.len];
        if (!evs) return;
        evs.forEach((e) => {
          if (e.drum) drum(e.drum, nextTime, p.vol);
          else if (e.f) note(p, e.f, nextTime, e.len * stepDur * 0.95);
        });
      });
      if (ended) { track = null; return; }
      nextTime += stepDur;
      stepIdx++;
    }
  }

  function stopMusic(fade) {
    if (trackGain && ctx) {
      const g = trackGain;
      const t = ctx.currentTime;
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + (fade || 0.3));
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* */ } }, ((fade || 0.3) + 0.2) * 1000);
    }
    trackGain = null; track = null; current = null;
  }

  function playMusic(name, force) {
    G.audio.wanted = name;
    if (!ctx) return;
    if (current === name && !force && track) return;
    stopMusic(0.25);
    const tr = TRACKS[name];
    if (!tr) return;
    current = name; track = tr; stepIdx = 0;
    trackGain = ctx.createGain(); trackGain.gain.value = 1; trackGain.connect(musicBus);
    nextTime = ctx.currentTime + 0.08;
  }

  G.audio = {
    wanted: null,
    unlock() {
      const fresh = !ctx;
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (fresh && G.audio.wanted) playMusic(G.audio.wanted, true);
    },
    sfx(name) { if (ctx && G.save.data.sfx && SFX[name]) { try { SFX[name](); } catch (e) { /* */ } } },
    music: playMusic,
    stop: stopMusic,
    apply: applySettings,
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    tracks: TRACKS,
  };
})();
