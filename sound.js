/* Interface sounds for the whole site: short, soft, low. The six most common ones are small recordings packed in snd.js
   (Kenney's Interface Sounds, CC0; built by tools/make_snd.py, never requested as .mp3 files because download managers grab those); the rest, and every sound when a file cannot be loaded, are
   made in the browser with Web Audio.
   The live quiz keeps its own louder set and its own mute button (sfx.js).

   Pages never call a sound by hand for study events; they send document events and this file decides what is heard:
     fx:answer {correct}                right: two soft rising notes; wrong: one low muted knock (never a buzzer)
     fx:moment {kind}                   section | goal | solved: three-note chime; lesson | exam: a longer one; badge: sparkle
     fx:sound  {name}                   flip, grade, step, bell, start, warn, found, won, lost
   Setting (this device): reviewer_sound = {"on":true,"vol":0.5}. On by default at a low volume (the user's choice, Nov 11).
   Nothing is created before the first tap or key press, and an iPhone's silent switch mutes it.
   A theme can name a sound pack (ThemeFx.sound()): Winter's "bells", Sakura's "koto", Galaxy's "synth", Minecraft's "bit". */
window.Sound = (function () {
  const KEY = 'reviewer_sound', BASE = .5;          // slider 0..1 times BASE = the real gain; the default lands at .25
  let ctx = null, out = null, mem = null, touched = false, lastAt = 0;
  function prefs() {
    let p = mem; if (!p) try { p = JSON.parse(localStorage.getItem(KEY)) } catch (e) {}
    p = p && typeof p === 'object' ? p : {};
    return { on: p.on !== false, vol: typeof p.vol === 'number' && p.vol >= 0 && p.vol <= 1 ? p.vol : .5 };
  }
  function set(n) {
    const p = Object.assign(prefs(), n || {});
    try { localStorage.setItem(KEY, JSON.stringify(p)); mem = null } catch (e) { mem = p }
    if (out) out.gain.value = p.vol * BASE;
    return p;
  }
  function boot() {
    if (ctx || !touched) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try {
      ctx = new AC(); out = ctx.createGain(); out.gain.value = prefs().vol * BASE;
      const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -14; lim.ratio.value = 6; out.connect(lim); lim.connect(ctx.destination);
    } catch (e) { ctx = null }
    if (ctx) loadFiles();
    return ctx;
  }
  const wake = () => { touched = true; if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}) };
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, wake, { capture: true, passive: true }));

  // ---- voices ----
  function env(g, t, peak, a, d) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d) }
  function osc(type, f, t, len, peak, a, to) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
    env(g, t, peak, a || .008, len); o.connect(g); g.connect(out); o.start(t); o.stop(t + len + .08);
  }
  // a soft mallet: the note, a quiet octave above it that dies quickly
  const note = (f, t, len, v) => { osc('sine', f, t, len, .5 * v, .006); osc('triangle', f * 2, t, len * .35, .09 * v, .004) };
  // a small glass bell: partials that are not whole multiples, the high ones fading first
  const bell = (f, t, len, v) => { [[1, .42, 1], [2.76, .16, .55], [5.4, .07, .28], [8.9, .03, .16]].forEach(([m, p, l]) => osc('sine', f * m, t, len * l, p * v, .003)) };
  // plucked pentatonic koto/chime
  const koto = (f, t, len, v) => { osc('triangle', f, t, len, .45 * v, .004); osc('sine', f * 2, t, len * .6, .18 * v, .004); osc('sine', f * 3, t, len * .35, .07 * v, .004) };
  // airy cosmic synth shimmer
  const synth = (f, t, len, v) => { osc('sine', f, t, len * 1.15, .36 * v, .025); osc('sine', f * 1.006, t, len * 1.15, .28 * v, .03); osc('sine', f * 1.5, t, len * .85, .14 * v, .03) };
  // crisp 8-bit chiptune / XP orb chime
  const bit = (f, t, len, v, to) => { osc('square', f, t, len, .18 * v, .003, to); osc('triangle', f * .5, t, len * .9, .24 * v, .003, to ? to * .5 : 0) };
  function hiss(t, len, v, freq, q) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * len)), b = ctx.createBuffer(1, n, ctx.sampleRate), x = b.getChannelData(0);
    for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.value = v; s.connect(f); f.connect(g); g.connect(out); s.start(t);
  }
  const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.7, E6: 1318.5, G6: 1568, C7: 2093 };

  // ---- the set: each takes the start time and the pack name ----
  const VOICE = { bells: bell, koto, synth, bit };
  const SET = {
    right: (t, p) => p === 'bells' ? (bell(N.E6, t, .5, .5), bell(N.G6, t + .085, .7, .5))
      : p === 'koto' ? (koto(N.D5, t, .26, .75), koto(N.A5, t + .08, .42, .8))
      : p === 'synth' ? (synth(N.E5, t, .34, .75), synth(N.C6, t + .09, .55, .75))
      : p === 'bit' ? (bit(N.E5, t, .08, .75), bit(N.A5, t + .065, .14, .8, N.C6))
      : (note(N.E5, t, .16, .8), note(N.A5, t + .085, .28, .8)),
    wrong: (t, p) => p === 'bit' ? (bit(220, t, .11, .75, 130), bit(150, t + .09, .14, .7, 98)) : (osc('sine', 168, t, .16, .55, .004, 96), hiss(t, .05, .12, 320, .7)),
    chime: (t, p) => {
      const seq = p === 'koto' ? [N.D5, N.E5, N.G5, N.A5] : p === 'bit' ? [N.C5, N.E5, N.G5, N.C6] : [N.C5, N.E5, N.G5];
      const v = VOICE[p] || note;
      seq.forEach((f, i) => v(p === 'bells' ? f * 2 : f, t + i * (p === 'bit' ? .07 : .1), i === seq.length - 1 ? (p === 'bells' ? 1.5 : .7) : (p === 'bells' ? .8 : .3), p === 'bells' ? .6 : .82));
    },
    big: (t, p) => {
      const seq = p === 'koto' ? [N.D5, N.G5, N.A5, N.D6] : [N.C5, N.E5, N.G5, N.C6];
      const v = VOICE[p] || note;
      seq.forEach((f, i) => v(p === 'bells' ? f * 2 : f, t + i * (p === 'bit' ? .075 : .11), i === seq.length - 1 ? (p === 'bells' ? 2 : .95) : (p === 'bells' ? .9 : .32), p === 'bells' ? .6 : .88));
    },
    badge: t => { [N.E6, N.G6, N.C7].forEach((f, i) => osc('sine', f, t + i * .09, i === 2 ? .7 : .42, .34, .012)); osc('triangle', 3136, t + .34, .5, .1, .012) },
    flip: t => hiss(t, .035, .2, 2600, 1.2),
    grade: t => { hiss(t, .03, .16, 1900, 1.4); osc('sine', 620, t, .07, .12, .004) },
    step: t => note(N.D5, t, .09, .45),
    bell: t => bell(N.A5, t, 1.6, .7),
    start: t => bell(N.E5 * 2, t, 1.1, .5),
    warn: t => { note(N.A5, t, .1, .6); note(N.A5, t + .2, .1, .6) },
    found: t => osc('sine', 392, t, .32, .4, .02, 784),
    won: (t, p) => { const v = VOICE[p] || note; [N.G5, N.C6, N.E6, N.G6].forEach((f, i) => v(f, t + i * (p === 'bit' ? .075 : .1), i === 3 ? 1 : .26, .8)) },
    lost: t => { note(N.E5, t, .26, .6); note(N.C5, t + .2, .5, .6) }
  };
  // recorded samples: name -> gain. Loaded once after the first tap; until then (or offline without the cache) the
  // synthesized version plays. A theme's sound pack (Winter's bells) takes over right and chime.
  const FILES = { right: .5, wrong: .55, chime: .45, flip: .5, grade: .4, step: .45 }, BUF = {}, PACKED = { right: 1, chime: 1, big: 1, won: 1 };
  let loading = false;
  function loadFiles() {
    if (loading || !ctx) return; loading = true;
    const go = () => { const D = window.SND_DATA; if (!D) return; Object.keys(FILES).forEach(n => { if (!D[n]) return; try {
      const bin = atob(D[n]), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
      const pr = ctx.decodeAudioData(a.buffer, b => { BUF[n] = b }, () => {}); if (pr && pr.catch) pr.catch(() => {}) } catch (e) {} }) };
    if (window.SND_DATA) return go();
    const s = document.createElement('script'); s.src = 'snd.js'; s.async = true; s.onload = go; s.onerror = () => {}; document.head.appendChild(s);
  }
  function sample(n, t) { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = BUF[n]; g.gain.value = FILES[n]; s.connect(g); g.connect(out); s.start(t) }
  const MOMENT = { section: 'chime', goal: 'chime', solved: 'chime', lesson: 'big', exam: 'big', badge: 'badge' };

  function play(name, force) {
    const fn = SET[name]; if (!fn || (!force && !prefs().on)) return false;
    if (!boot() || ctx.state !== 'running') { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); if (!ctx || ctx.state !== 'running') return false }
    const now = ctx.currentTime; if (now - lastAt < .05 && !force) return false; lastAt = now;
    let pack = ''; try { pack = window.ThemeFx ? ThemeFx.sound() : '' } catch (e) {}
    loadFiles();
    try { if (BUF[name] && !(pack && (PACKED[name] || (name === 'wrong' && pack === 'bit')))) sample(name, now + .012); else fn(now + .012, pack) } catch (e) { return false }
    return true;
  }
  document.addEventListener('fx:answer', e => play(e.detail && e.detail.correct ? 'right' : 'wrong'));
  document.addEventListener('fx:moment', e => { const n = MOMENT[e.detail && e.detail.kind]; if (n) setTimeout(() => play(n), n === 'badge' ? 0 : 160) });
  document.addEventListener('fx:sound', e => play(e.detail && e.detail.name));

  return {
    play, set, prefs, names: () => Object.keys(SET), loaded: () => Object.keys(BUF).sort(),
    on: () => prefs().on, vol: () => prefs().vol,
    // for the switch and the slider: play a sample right away so the choice can be heard
    test(name) { touched = true; boot(); if (ctx && ctx.state === 'suspended') ctx.resume().then(() => play(name || 'right', true)).catch(() => {}); else play(name || 'right', true) }
  };
})();
