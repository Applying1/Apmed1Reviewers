/* Theme effects: lets a color theme carry more than colors (a backdrop behind the page, small ornaments in named
   slots, one-shot moments on study events). Shared by the course pages (the engine loads it) and the hand-written pages.

   A theme with effects is registered by its palette id:
     ThemeFx.theme('winter', { backdrop:'snow', ornaments:{hero:'drift', ledge:'drift'}, moments:{section:'flurry'}, sound:'bells' })
   Building blocks are registered by name, so the next special theme adds its own without touching the pages:
     ThemeFx.backdrop(name, mount)    mount({layer, dark, still, phone}) returns {quiet(on), pause(on), moment(name), resize(), unmount()}
     ThemeFx.ornament(name, html)     html({dark}) returns the markup placed inside every first visible [data-fx-slot="..."]
   Pages talk to it with document events, never by calling into it:
     fx:moment {kind}   section | lesson | goal | exam | badge | solved
   and with one attribute: <html data-fx-quiet> while a question or a reading view is open (the backdrop stops making new motion).
   Setting (this device, like the colors): reviewer_fx = full | still | off. Without storage it is full, or still when the
   device asks for reduced motion. Still keeps the picture and drops the motion; off leaves only the colors. */
window.ThemeFx = (function () {
  const KEY = 'reviewer_fx', root = document.documentElement;
  const THEMES = {}, BACKDROPS = {}, ORNAMENTS = {};
  const mqDark = matchMedia('(prefers-color-scheme: dark)'), mqCalm = matchMedia('(prefers-reduced-motion: reduce)');
  let memMode = null, live = null, liveKey = '', quiet = false, layer = null, css = null, obs = null, decoT = 0;

  function mode() {
    if (memMode) return memMode;
    try { const v = localStorage.getItem(KEY); if (v === 'full' || v === 'still' || v === 'off') return v } catch (e) {}
    return mqCalm.matches ? 'still' : 'full';
  }
  function setMode(m) {
    if (m !== 'full' && m !== 'still' && m !== 'off') return;
    try { localStorage.setItem(KEY, m); memMode = null } catch (e) { memMode = m }
    sync();
  }
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : mqDark.matches;
  const current = () => THEMES[root.dataset.palette] || null;

  const CSS =
    '#themefx{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;contain:strict}' +
    '#themefx canvas{position:absolute;inset:0;width:100%;height:100%}' +
    '[data-fx-on]{position:relative;overflow:visible!important}' +
    '.fx-orn{position:absolute;pointer-events:none;z-index:1;line-height:0}' +
    '@media print{#themefx,.fx-orn{display:none!important}}';

  function ensure() {
    if (!css) { css = document.createElement('style'); css.id = 'themefxcss'; css.textContent = CSS; document.head.appendChild(css) }
    if (!layer) { layer = document.createElement('div'); layer.id = 'themefx'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer) }
  }
  function addCSS(id, text) { if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = text; document.head.appendChild(s) }

  // ---- ornaments: one per slot name, on the first slot that is on screen ----
  function decorate() {
    decoT = 0;
    const th = current(), on = th && mode() !== 'off' ? th.ornaments || {} : {};
    document.querySelectorAll('[data-fx-on]').forEach(el => {
      const n = el.dataset.fxSlot;
      if (!on[n] || el.dataset.fxOn !== liveKey || el.hidden || !el.offsetParent) { el.querySelectorAll(':scope>.fx-orn').forEach(o => o.remove()); el.removeAttribute('data-fx-on') }
    });
    for (const n in on) {
      const make = ORNAMENTS[on[n]]; if (!make) continue;
      const slots = [...document.querySelectorAll('[data-fx-slot="' + n + '"]')].filter(el => !el.hidden && el.offsetParent);
      slots.forEach((el, i) => {
        const has = el.querySelector(':scope>.fx-orn');
        if (i) { if (has) { el.querySelectorAll(':scope>.fx-orn').forEach(o => o.remove()); el.removeAttribute('data-fx-on') } return }
        if (has && el.dataset.fxOn === liveKey) return;
        el.querySelectorAll(':scope>.fx-orn').forEach(o => o.remove());
        const box = document.createElement('div'); box.innerHTML = make({ dark: isDark() });
        [...box.children].forEach(o => { o.classList.add('fx-orn'); o.setAttribute('aria-hidden', 'true'); el.appendChild(o) });
        el.dataset.fxOn = liveKey;
      });
    }
  }
  const decorateSoon = () => { if (!decoT) decoT = setTimeout(decorate, 180) };

  // ---- mount / unmount the current theme's effects ----
  function sync() {
    if (!document.body) return;
    if (root.dataset.palette === 'minecraft' && !document.getElementById('fxmcfont')) { const f = document.createElement('link'); f.id = 'fxmcfont'; f.rel = 'stylesheet'; f.href = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap'; document.head.appendChild(f) }
    const th = current(), m = mode(), key = th && m !== 'off' ? root.dataset.palette + '|' + (isDark() ? 'd' : 'l') + '|' + m : '';
    if (key === liveKey) return;
    if (live) { try { live.unmount() } catch (e) {} live = null }
    if (layer) layer.textContent = '';
    liveKey = key;
    if (key) {
      ensure(); root.dataset.fx = root.dataset.palette;
      const mount = BACKDROPS[th.backdrop];
      if (mount) try { live = mount({ layer, dark: isDark(), still: m === 'still', phone: Math.min(innerWidth, innerHeight) < 700 }); if (live && quiet) live.quiet(true) } catch (e) { live = null }
      if (!obs && window.MutationObserver) { obs = new MutationObserver(decorateSoon); obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] }) }
    } else {
      delete root.dataset.fx;
      if (obs) { obs.disconnect(); obs = null }
    }
    decorate();
  }

  function hush() { const q = root.hasAttribute('data-fx-quiet'); if (q !== quiet) { quiet = q; if (live && live.quiet) live.quiet(q) } }
  function boot() {
    quiet = root.hasAttribute('data-fx-quiet'); sync();
    new MutationObserver(() => { hush(); sync() }).observe(root, { attributes: true, attributeFilter: ['data-palette', 'data-theme', 'data-fx-quiet'] });
    mqDark.addEventListener('change', sync);
    addEventListener('storage', e => { if (e.key === KEY || e.key === 'reviewer_palette' || e.key === 'reviewer_theme') { if (e.key === 'reviewer_palette') { if (e.newValue) root.dataset.palette = e.newValue; else delete root.dataset.palette } sync() } });
    document.addEventListener('visibilitychange', () => { if (live && live.pause) live.pause(document.visibilityState === 'hidden') });
    let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (live && live.resize) live.resize() }, 200) });
    document.addEventListener('fx:moment', e => {
      const th = current(), k = e.detail && e.detail.kind, name = th && th.moments && (th.moments[k] || th.moments.any);
      if (name && live && live.moment && mode() === 'full') live.moment(name);
    });
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);

  return {
    theme(id, def) { THEMES[id] = def; if (document.body) sync() },
    backdrop(name, mount) { BACKDROPS[name] = mount },
    ornament(name, html) { ORNAMENTS[name] = html },
    css: addCSS, mode, setMode, current, isDark,
    has: () => !!current(),
    sound: () => { const th = current(); return th && th.sound || '' },
    MODES: [['full', 'Full'], ['still', 'Still'], ['off', 'Off']]
  };
})();

/* ---------------------------------------------------------------------------------------------------------------
   Winter: slow snowfall in three depths, an aurora at night, snow resting on the main card, a flurry for milestones
   --------------------------------------------------------------------------------------------------------------- */
(function () {
  const TAU = Math.PI * 2;
  ThemeFx.css('fxwinter',
    '.fx-sky{position:absolute;left:-12%;right:-12%;top:-14vh;height:54vh;transition:opacity 1.2s ease}' +
    '.fx-sky.night{filter:blur(22px);background:' +
      'radial-gradient(58% 78% at 22% 0%,rgba(116,222,178,.42),transparent 72%),' +
      'radial-gradient(46% 70% at 72% 0%,rgba(150,168,255,.34),transparent 72%),' +
      'radial-gradient(40% 56% at 48% 8%,rgba(156,203,228,.26),transparent 72%)}' +
    '.fx-sky.day{background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(255,255,255,0))}' +
    '.fx-sky.night.drift{animation:fxaurora 28s ease-in-out infinite alternate}' +
    '.fx-sky.hush{opacity:.4}' +
    '@keyframes fxaurora{from{transform:translate3d(-3%,0,0) scaleY(.92);opacity:.75}to{transform:translate3d(3%,2%,0) scaleY(1.06);opacity:1}}' +
    '.fx-drift{top:-11px;left:22px;width:150px;height:12px}.fx-drift.r{left:auto;right:36px;top:-8px;width:88px;height:9px}' +
    '.fx-drift svg{display:block;width:100%;height:100%;overflow:visible}' +
    '@media (max-width:640px){.fx-drift{left:14px;width:116px;top:-10px;height:11px}.fx-drift.r{right:20px;width:70px;top:-7px;height:8px}}' +
    /* a light top edge on cards at night, like frost catching the light */
    ':root[data-fx="winter"]{--fx-snow:#fff;--fx-snow-shade:#cfe0ec;--fx-snow-edge:#a9c3d4}' +
    '@media (prefers-color-scheme:dark){:root[data-fx="winter"]:not([data-theme="light"]){--fx-snow:#e3edf3;--fx-snow-shade:#b9d2e0;--fx-snow-edge:transparent}}' +
    ':root[data-fx="winter"][data-theme="dark"]{--fx-snow:#e3edf3;--fx-snow-shade:#b9d2e0;--fx-snow-edge:transparent}');

  // snow settled on a ledge: one longer drift near the left corner, a small one near the right
  const DRIFT = 'M1 15C4 9.5 12 8.6 18 9.6 25 3.4 44 1.6 56 6.6 66 2.4 86 3 95 8 107 6.4 126 8.6 139 15Z';
  const SHADE = 'M1 15C10 12.6 24 12.2 38 13 58 11.2 78 11.6 96 12.8 112 12 128 13 139 15Z';
  ThemeFx.ornament('drift', () =>
    '<span class="fx-drift"><svg viewBox="0 0 140 15" preserveAspectRatio="none"><path d="' + DRIFT + '" fill="var(--fx-snow)" stroke="var(--fx-snow-edge)" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="' + SHADE + '" fill="var(--fx-snow-shade)" opacity=".55"/></svg></span>' +
    '<span class="fx-drift r"><svg viewBox="0 0 140 15" preserveAspectRatio="none"><path d="' + DRIFT + '" fill="var(--fx-snow)" stroke="var(--fx-snow-edge)" stroke-width="1" vector-effect="non-scaling-stroke" transform="translate(140 0) scale(-1 1)"/><path d="' + SHADE + '" fill="var(--fx-snow-shade)" opacity=".55"/></svg></span>');

  ThemeFx.backdrop('snow', function (c) {
    const sky = document.createElement('div'); sky.className = 'fx-sky ' + (c.dark ? 'night' : 'day') + (c.dark && !c.still ? ' drift' : '');
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    c.layer.appendChild(sky); c.layer.appendChild(cv);
    const N = c.phone ? 40 : 90, DEPTH = [[.9, 1.5, 11, .34], [1.5, 2.3, 19, .55], [2.3, 3.4, 30, .82]];   // radius from, to, fall px/s, opacity
    let W = 0, H = 0, flakes = [], raf = 0, last = 0, quiet = false, paused = false, gone = false, clock = 0;
    function size() { const d = Math.min(window.devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = Math.round(W * d); cv.height = Math.round(H * d); g.setTransform(d, 0, 0, d, 0, 0) }
    function make(top, flurry) {
      const r0 = Math.random(), d = flurry ? 1 + (Math.random() < .5 ? 1 : 0) : r0 < .5 ? 0 : r0 < .84 ? 1 : 2, D = DEPTH[d];
      return { x: Math.random() * (W + 80) - 40, y: top ? -8 - Math.random() * (flurry ? H * .5 : 60) : Math.random() * H, r: D[0] + Math.random() * (D[1] - D[0]),
        vy: D[2] * (.8 + Math.random() * .4) * (flurry ? 4.2 : 1), a: D[3], ph: Math.random() * TAU, sw: 5 + Math.random() * 9 + d * 3, f: .35 + Math.random() * .5, wind: flurry ? 26 + Math.random() * 30 : 0, once: !!flurry };
    }
    function paint() {
      g.clearRect(0, 0, W, H);
      for (const f of flakes) {
        g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU);
        if (c.dark) { g.fillStyle = 'rgba(238,244,248,' + f.a + ')'; g.fill() }
        else { g.fillStyle = 'rgba(132,174,203,' + (f.a * .8).toFixed(2) + ')'; g.fill() }   // on a pale page snow reads as soft blue shadow
      }
    }
    function step(now) {
      raf = 0; if (gone || paused) return;
      if (now - last < 32) { raf = requestAnimationFrame(step); return }
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; clock += dt;
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i]; f.y += f.vy * dt; f.x += (Math.sin(f.ph + clock * f.f) * f.sw + f.wind) * dt;
        if (f.y - f.r > H) { if (f.once || quiet) flakes.splice(i, 1); else flakes[i] = make(true) }
      }
      // back from a quiet page: let the sky fill up again a few flakes at a time
      if (!quiet && flakes.filter(f => !f.once).length < N && Math.random() < .5) flakes.push(make(true));
      paint();
      if (flakes.length || !quiet) raf = requestAnimationFrame(step);
    }
    const run = () => { if (!raf && !c.still && !gone && !paused) { last = performance.now(); raf = requestAnimationFrame(step) } };
    size(); for (let i = 0; i < N; i++) flakes.push(make(false)); paint(); run();
    return {
      quiet(on) { quiet = on; sky.classList.toggle('hush', on); if (c.still) { if (on) { flakes = []; paint() } else { flakes = []; for (let i = 0; i < N; i++) flakes.push(make(false)); paint() } } else run() },
      pause(on) { paused = on; if (on) { cancelAnimationFrame(raf); raf = 0 } else run() },
      moment(name) { if (name !== 'flurry' || c.still) return; const n = c.phone ? 46 : 80; for (let i = 0; i < n; i++) flakes.push(make(true, true)); run() },
      resize() { size(); if (c.still) { flakes = quiet ? [] : flakes.map(() => make(false)); } paint() },
      unmount() { gone = true; cancelAnimationFrame(raf); sky.remove(); cv.remove() }
    };
  });

  ThemeFx.theme('winter', {
    backdrop: 'snow',
    ornaments: { hero: 'drift', ledge: 'drift' },
    moments: { section: 'flurry', lesson: 'flurry', goal: 'flurry', exam: 'flurry', badge: 'flurry', solved: 'flurry' },
    sound: 'bells'
  });
})();

/* ---------------------------------------------------------------------------------------------------------------
   Sakura: airy spring blossoms and young green leaves drifting in a breeze, blossom branch ornaments
   --------------------------------------------------------------------------------------------------------------- */
(function () {
  const TAU = Math.PI * 2;
  ThemeFx.css('fxsakura',
    '.fx-sky.sakura-day{background:' +
      'radial-gradient(60% 76% at 18% 0%,rgba(255,204,224,.55),transparent 72%),' +
      'radial-gradient(50% 68% at 82% 2%,rgba(182,235,198,.42),transparent 70%),' +
      'linear-gradient(180deg,rgba(255,250,252,.78),rgba(255,250,252,0))}' +
    '.fx-sky.sakura-night{filter:blur(18px);background:' +
      'radial-gradient(56% 76% at 24% 0%,rgba(255,179,206,.24),transparent 72%),' +
      'radial-gradient(48% 68% at 78% 4%,rgba(140,224,168,.16),transparent 72%)}' +
    '.fx-sky.sakura-day.drift,.fx-sky.sakura-night.drift{animation:fxaurora 32s ease-in-out infinite alternate}' +
    '.fx-bough{top:-14px;left:16px;width:168px;height:22px}.fx-bough.r{left:auto;right:20px;top:-11px;width:124px;height:18px}' +
    '.fx-bough svg{display:block;width:100%;height:100%;overflow:visible}' +
    '@media (max-width:640px){.fx-bough{left:12px;width:128px;top:-12px;height:18px}.fx-bough.r{right:14px;width:94px;top:-10px;height:15px}}');

  const BLOSSOM = (cx, cy, r) =>
    '<g transform="translate(' + cx + ' ' + cy + ') scale(' + r + ')">' +
      '<path d="M0-1C2-5 5-5 4-1C7-3 8 1 4 2C6 6 2 7 0 3C-2 7-6 6-4 2C-8 1-7-3-4-1C-5-5-2-5 0-1Z" fill="#ffd9e8" stroke="#f09cbc" stroke-width=".45"/>' +
      '<circle r="1.3" fill="#ff94b8"/><circle r=".55" fill="#fff4b8"/>' +
    '</g>';
  const LEAF = (x, y, rot, s) =>
    '<path transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + s + ')" d="M0 0C3-4 8-4 11 0C8 4 3 4 0 0Z" fill="#78c488" stroke="#4f9960" stroke-width=".5"/>';

  ThemeFx.ornament('bough', () =>
    '<span class="fx-bough"><svg viewBox="0 0 168 22" preserveAspectRatio="none">' +
      '<path d="M2 18Q42 8 88 12T152 9" fill="none" stroke="#8a5a52" stroke-width="2.1" stroke-linecap="round"/>' +
      '<path d="M44 11Q58 4 72 5" fill="none" stroke="#8a5a52" stroke-width="1.3" stroke-linecap="round"/>' +
      LEAF(24, 14, -28, .95) + LEAF(66, 7, 16, .88) + LEAF(116, 13, -18, .92) +
      BLOSSOM(40, 11, 1.05) + BLOSSOM(84, 11, 1.15) + BLOSSOM(136, 9, .95) +
      '<ellipse cx="62" cy="18" rx="3.2" ry="1.6" transform="rotate(-14 62 18)" fill="#ffc2d9" opacity=".85"/>' +
      '<ellipse cx="106" cy="19" rx="2.8" ry="1.4" transform="rotate(20 106 19)" fill="#ffd6e6" opacity=".85"/>' +
    '</svg></span>' +
    '<span class="fx-bough r"><svg viewBox="0 0 124 18" preserveAspectRatio="none">' +
      '<path d="M122 15Q84 7 46 10T10 8" fill="none" stroke="#8a5a52" stroke-width="1.8" stroke-linecap="round"/>' +
      LEAF(96, 11, 155, .85) + LEAF(54, 9, -155, .82) +
      BLOSSOM(76, 9, 1.0) + BLOSSOM(32, 9, .9) +
      '<ellipse cx="48" cy="16" rx="2.8" ry="1.3" transform="rotate(-12 48 16)" fill="#ffc2d9" opacity=".85"/>' +
    '</svg></span>');

  ThemeFx.backdrop('petals', function (c) {
    const sky = document.createElement('div');
    sky.className = 'fx-sky ' + (c.dark ? 'sakura-night' : 'sakura-day') + (!c.still ? ' drift' : '');
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    c.layer.appendChild(sky); c.layer.appendChild(cv);
    const N = c.phone ? 32 : 65;
    const PETAL_COLS = c.dark ? ['#ffd6e6', '#ffb8d2', '#ff9ec2', '#ffeaf2'] : ['#ffc8dd', '#ffb3cf', '#ff9ebb', '#ffe0ec'];
    const LEAF_COLS = c.dark ? ['#8ce0a8', '#6fc88f'] : ['#68b678', '#80cb90'];
    let W = 0, H = 0, items = [], raf = 0, last = 0, quiet = false, paused = false, gone = false, clock = 0;

    function size() { const d = Math.min(window.devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = Math.round(W * d); cv.height = Math.round(H * d); g.setTransform(d, 0, 0, d, 0, 0) }
    function make(top, gust) {
      const leaf = Math.random() < .30;
      const sz = (leaf ? 6.5 : 5.2) + Math.random() * 4.2;
      const cols = leaf ? LEAF_COLS : PETAL_COLS;
      return {
        x: gust ? -20 + Math.random() * W * .85 : Math.random() * (W + 100) - 50,
        y: top ? -14 - Math.random() * (gust ? H * .55 : 70) : Math.random() * H,
        sz, leaf, col: cols[Math.floor(Math.random() * cols.length)],
        vy: (18 + Math.random() * 22) * (gust ? 2.4 : 1),
        vx: (12 + Math.random() * 14) * (gust ? 2.9 : 1),
        a: (c.dark ? .72 : .84) * (.7 + Math.random() * .3),
        rot: Math.random() * TAU, vrot: (Math.random() - .5) * 1.8,
        ph: Math.random() * TAU, sw: 14 + Math.random() * 18, f: .7 + Math.random() * .8,
        once: !!gust
      };
    }
    function drawItem(p) {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      const tilt = .42 + .58 * Math.abs(Math.cos(p.ph + clock * p.f));
      g.scale(1, tilt);
      g.globalAlpha = p.a;
      g.fillStyle = p.col;
      const s = p.sz;
      if (p.leaf) {
        g.beginPath();
        g.moveTo(-s, 0);
        g.quadraticCurveTo(0, -s * .68, s, 0);
        g.quadraticCurveTo(0, s * .68, -s, 0);
        g.fill();
        g.strokeStyle = c.dark ? 'rgba(255,255,255,.32)' : 'rgba(42,102,58,.32)';
        g.lineWidth = .8;
        g.beginPath(); g.moveTo(-s * .75, 0); g.lineTo(s * .75, 0); g.stroke();
      } else {
        // notched sakura petal
        g.beginPath();
        g.moveTo(0, -s * .9);
        g.bezierCurveTo(s * .72, -s * .55, s * .62, s * .42, s * .14, s * .72);
        g.lineTo(0, s * .42);
        g.lineTo(-s * .14, s * .72);
        g.bezierCurveTo(-s * .62, s * .42, -s * .72, -s * .55, 0, -s * .9);
        g.fill();
      }
      g.restore();
    }
    function paint() { g.clearRect(0, 0, W, H); for (const p of items) drawItem(p) }
    function step(now) {
      raf = 0; if (gone || paused) return;
      if (now - last < 32) { raf = requestAnimationFrame(step); return }
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; clock += dt;
      for (let i = items.length - 1; i >= 0; i--) {
        const p = items[i];
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(p.ph + clock * p.f) * p.sw) * dt;
        p.rot += p.vrot * dt;
        if (p.y - p.sz > H || p.x - p.sz > W + 60) {
          if (p.once || quiet) items.splice(i, 1); else items[i] = make(true);
        }
      }
      if (!quiet && items.filter(p => !p.once).length < N && Math.random() < .45) items.push(make(true));
      paint();
      if (items.length || !quiet) raf = requestAnimationFrame(step);
    }
    const run = () => { if (!raf && !c.still && !gone && !paused) { last = performance.now(); raf = requestAnimationFrame(step) } };
    size(); for (let i = 0; i < N; i++) items.push(make(false)); paint(); run();
    return {
      quiet(on) { quiet = on; sky.classList.toggle('hush', on); if (c.still) { items = on ? [] : Array.from({ length: N }, () => make(false)); paint() } else run() },
      pause(on) { paused = on; if (on) { cancelAnimationFrame(raf); raf = 0 } else run() },
      moment(name) { if (name !== 'gust' || c.still) return; const n = c.phone ? 38 : 65; for (let i = 0; i < n; i++) items.push(make(true, true)); run() },
      resize() { size(); if (c.still) items = quiet ? [] : items.map(() => make(false)); paint() },
      unmount() { gone = true; cancelAnimationFrame(raf); sky.remove(); cv.remove() }
    };
  });

  ThemeFx.theme('sakura', {
    backdrop: 'petals',
    ornaments: { hero: 'bough', ledge: 'bough' },
    moments: { section: 'gust', lesson: 'gust', goal: 'gust', exam: 'gust', badge: 'gust', solved: 'gust' },
    sound: 'koto'
  });
})();

/* ---------------------------------------------------------------------------------------------------------------
   Galaxy: nebula clouds, twinkling diffraction stars, shooting stars, constellation & planet ornaments
   --------------------------------------------------------------------------------------------------------------- */
(function () {
  const TAU = Math.PI * 2;
  ThemeFx.css('fxgalaxy',
    '.fx-sky.galaxy-night{filter:blur(24px);background:' +
      'radial-gradient(62% 82% at 20% 0%,rgba(180,142,255,.34),transparent 72%),' +
      'radial-gradient(50% 72% at 78% 4%,rgba(76,224,255,.24),transparent 72%),' +
      'radial-gradient(45% 60% at 50% 18%,rgba(255,126,182,.16),transparent 70%)}' +
    '.fx-sky.galaxy-day{filter:blur(22px);background:' +
      'radial-gradient(60% 80% at 22% 0%,rgba(134,98,238,.22),transparent 72%),' +
      'radial-gradient(48% 70% at 80% 4%,rgba(0,175,220,.18),transparent 72%),' +
      'radial-gradient(42% 56% at 50% 10%,rgba(218,118,198,.14),transparent 70%)}' +
    '.fx-sky.galaxy-night.drift,.fx-sky.galaxy-day.drift{animation:fxaurora 34s ease-in-out infinite alternate}' +
    '.fx-const{top:-12px;left:18px;width:154px;height:20px}.fx-const.r{left:auto;right:22px;top:-12px;width:110px;height:20px}' +
    '.fx-const svg{display:block;width:100%;height:100%;overflow:visible}' +
    '@media (max-width:640px){.fx-const{left:12px;width:118px;top:-11px;height:18px}.fx-const.r{right:14px;width:86px;top:-11px;height:18px}}');

  const SPARK = (x, y, r, col) =>
    '<path d="M' + x + ' ' + (y - r) + 'L' + (x + r * .24) + ' ' + (y - r * .24) + 'L' + (x + r) + ' ' + y + 'L' + (x + r * .24) + ' ' + (y + r * .24) + 'L' + x + ' ' + (y + r) + 'L' + (x - r * .24) + ' ' + (y + r * .24) + 'L' + (x - r) + ' ' + y + 'L' + (x - r * .24) + ' ' + (y - r * .24) + 'Z" fill="' + col + '"/>';

  ThemeFx.ornament('constellation', ({ dark }) => {
    const line = dark ? 'rgba(180,142,255,.55)' : 'rgba(99,54,214,.42)';
    const c1 = dark ? '#eef0ff' : '#6336d6', c2 = dark ? '#4ce0ff' : '#0088b8', c3 = dark ? '#b48eff' : '#8a5cf6';
    return '<span class="fx-const"><svg viewBox="0 0 154 20" preserveAspectRatio="none">' +
      '<polyline points="12,13 46,6 88,12 132,5" fill="none" stroke="' + line + '" stroke-width="1.2" stroke-dasharray="3 2.5"/>' +
      SPARK(12, 13, 4.4, c3) + SPARK(46, 6, 5.5, c2) + '<circle cx="88" cy="12" r="2.1" fill="' + c1 + '"/>' + SPARK(132, 5, 4.8, c1) +
    '</svg></span>' +
    '<span class="fx-const r"><svg viewBox="0 0 110 20" preserveAspectRatio="none">' +
      '<g transform="translate(76 10)"><circle r="5" fill="' + c3 + '"/><ellipse rx="10.5" ry="2.7" transform="rotate(-18)" fill="none" stroke="' + c2 + '" stroke-width="1.3"/></g>' +
      SPARK(28, 12, 4.6, c2) + '<circle cx="48" cy="7" r="1.6" fill="' + c1 + '"/>' +
    '</svg></span>';
  });

  ThemeFx.backdrop('cosmos', function (c) {
    const sky = document.createElement('div');
    sky.className = 'fx-sky ' + (c.dark ? 'galaxy-night' : 'galaxy-day') + (!c.still ? ' drift' : '');
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    c.layer.appendChild(sky); c.layer.appendChild(cv);
    const N = c.phone ? 50 : 100;
    const COLS = c.dark ? ['#ffffff', '#c9b3ff', '#7ceeff', '#ffd4ea'] : ['#6336d6', '#0088b8', '#9b5de5', '#c22568'];
    let W = 0, H = 0, stars = [], meteors = [], raf = 0, last = 0, quiet = false, paused = false, gone = false, clock = 0, nextMeteor = 3.5;

    function size() { const d = Math.min(window.devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = Math.round(W * d); cv.height = Math.round(H * d); g.setTransform(d, 0, 0, d, 0, 0) }
    function makeStar() {
      const bright = Math.random() < .16;
      return {
        x: Math.random() * W, y: Math.random() * H,
        r: bright ? 2.1 + Math.random() * 1.4 : .7 + Math.random() * 1.3,
        bright, col: COLS[Math.floor(Math.random() * COLS.length)],
        ph: Math.random() * TAU, sp: 1.2 + Math.random() * 2.2,
        baseA: (c.dark ? .82 : .34) * (.55 + Math.random() * .45)
      };
    }
    function makeMeteor() {
      const len = 70 + Math.random() * 80, spd = 480 + Math.random() * 260, ang = .46 + Math.random() * .24;
      return {
        x: Math.random() * W * .85, y: Math.random() * H * .32,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, len,
        life: 0, max: .7 + Math.random() * .45, col: Math.random() < .5 ? (c.dark ? '#4ce0ff' : '#0088b8') : (c.dark ? '#eef0ff' : '#6336d6')
      };
    }
    function paint() {
      g.clearRect(0, 0, W, H);
      for (const s of stars) {
        const tw = c.still ? 1 : (.48 + .52 * Math.sin(s.ph + clock * s.sp));
        g.globalAlpha = s.baseA * tw * (quiet ? .45 : 1);
        g.fillStyle = s.col;
        if (s.bright) {
          const r = s.r * 2.4;
          g.beginPath();
          g.moveTo(s.x, s.y - r); g.lineTo(s.x + r * .22, s.y - r * .22);
          g.lineTo(s.x + r, s.y); g.lineTo(s.x + r * .22, s.y + r * .22);
          g.lineTo(s.x, s.y + r); g.lineTo(s.x - r * .22, s.y + r * .22);
          g.lineTo(s.x - r, s.y); g.lineTo(s.x - r * .22, s.y - r * .22);
          g.closePath(); g.fill();
        } else {
          g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
        }
      }
      for (const m of meteors) {
        const p = m.life / m.max, al = Math.sin(p * Math.PI);
        const mag = Math.hypot(m.vx, m.vy) || 1;
        const tx = m.x - (m.vx / mag) * m.len, ty = m.y - (m.vy / mag) * m.len;
        const gr = g.createLinearGradient(m.x, m.y, tx, ty);
        gr.addColorStop(0, m.col); gr.addColorStop(1, 'transparent');
        g.globalAlpha = al * (c.dark ? .9 : .55);
        g.strokeStyle = gr; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(tx, ty); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(m.x, m.y, 1.8, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    }
    function step(now) {
      raf = 0; if (gone || paused) return;
      if (now - last < 32) { raf = requestAnimationFrame(step); return }
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; clock += dt;
      if (!quiet) {
        nextMeteor -= dt;
        if (nextMeteor <= 0) { meteors.push(makeMeteor()); nextMeteor = 3.2 + Math.random() * 4.5 }
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]; m.x += m.vx * dt; m.y += m.vy * dt; m.life += dt;
        if (m.life >= m.max) meteors.splice(i, 1);
      }
      paint();
      raf = requestAnimationFrame(step);
    }
    const run = () => { if (!raf && !c.still && !gone && !paused) { last = performance.now(); raf = requestAnimationFrame(step) } };
    size(); for (let i = 0; i < N; i++) stars.push(makeStar()); paint(); run();
    return {
      quiet(on) { quiet = on; sky.classList.toggle('hush', on); paint() },
      pause(on) { paused = on; if (on) { cancelAnimationFrame(raf); raf = 0 } else run() },
      moment(name) { if (name !== 'meteor' || c.still) return; const n = c.phone ? 8 : 14; for (let i = 0; i < n; i++) { const m = makeMeteor(); m.life = -i * .08; meteors.push(m) } run() },
      resize() { size(); stars = Array.from({ length: N }, makeStar); paint() },
      unmount() { gone = true; cancelAnimationFrame(raf); sky.remove(); cv.remove() }
    };
  });

  ThemeFx.theme('galaxy', {
    backdrop: 'cosmos',
    ornaments: { hero: 'constellation', ledge: 'constellation' },
    moments: { section: 'meteor', lesson: 'meteor', goal: 'meteor', exam: 'meteor', badge: 'meteor', solved: 'meteor' },
    sound: 'synth'
  });
})();

/* ---------------------------------------------------------------------------------------------------------------
   Minecraft: blocky sky with square sun/moon & pixel clouds, floating XP orbs & runes, Creeper/diamond ornaments
   --------------------------------------------------------------------------------------------------------------- */
(function () {
  ThemeFx.css('fxminecraft',
    '.fx-sky.mc-sky{left:0;right:0;top:0;height:36vh;overflow:hidden;transition:opacity .8s ease}' +
    '.fx-sky.mc-sky .mc-cel{position:absolute;top:14px;right:4%;width:28px;height:28px;opacity:.55}' +
    '.fx-sky.mc-day .mc-cel{background:#ffe65c;border:3px solid #f0b830;box-shadow:0 0 0 6px rgba(255,230,92,.22)}' +
    '.fx-sky.mc-night .mc-cel{background:#e8eef8;border:3px solid #9aa8c4;box-shadow:inset -8px 0 0 #b8c4dc,0 0 0 6px rgba(232,238,248,.12)}' +
    '.fx-sky.mc-sky .mc-cl{position:absolute;height:14px;background:var(--mc-cl);box-shadow:18px -10px 0 var(--mc-cl),36px 0 0 var(--mc-cl);opacity:.7}' +
    '.fx-sky.mc-day{--mc-cl:rgba(255,255,255,.72)}.fx-sky.mc-night{--mc-cl:rgba(140,152,188,.2)}' +
    '.fx-sky.mc-sky.drift .mc-cl{animation:fxmccloud 60s linear infinite}' +
    '@keyframes fxmccloud{from{transform:translateX(-14vw)}to{transform:translateX(112vw)}}' +
    '.fx-voxel{top:-14px;left:14px;width:156px;height:18px}.fx-voxel.r{left:auto;right:16px;top:-14px;width:116px;height:18px}' +
    '.fx-voxel svg{display:block;width:100%;height:100%;overflow:visible;shape-rendering:crispEdges}' +
    '@media (max-width:640px){.fx-voxel{left:10px;width:118px;top:-13px;height:16px}.fx-voxel.r{right:10px;width:88px;top:-13px;height:16px}}');

  ThemeFx.ornament('voxel', () =>
    '<span class="fx-voxel"><svg viewBox="0 0 156 18" preserveAspectRatio="none">' +
      /* grass turf overhang */
      '<rect x="4" y="12" width="144" height="4" fill="#3c8527"/><rect x="4" y="10" width="144" height="3" fill="#55b836"/>' +
      '<rect x="12" y="16" width="10" height="3" fill="#7c5334"/><rect x="44" y="16" width="14" height="3" fill="#3c8527"/><rect x="108" y="16" width="12" height="3" fill="#7c5334"/>' +
      /* pixel Creeper face */
      '<g transform="translate(22 0)">' +
        '<rect x="0" y="0" width="14" height="14" fill="#52c43b"/><rect x="0" y="0" width="14" height="2" fill="#7ee836"/>' +
        '<rect x="2" y="3" width="3" height="3" fill="#132b0c"/><rect x="9" y="3" width="3" height="3" fill="#132b0c"/>' +
        '<rect x="5" y="6" width="4" height="3" fill="#132b0c"/><rect x="3" y="8" width="8" height="4" fill="#132b0c"/><rect x="5" y="10" width="4" height="2" fill="#52c43b"/>' +
      '</g>' +
      /* pixel torch */
      '<g transform="translate(88 1)">' +
        '<rect x="2" y="5" width="3" height="8" fill="#7c5334"/><rect x="1" y="1" width="5" height="4" fill="#ffb830"/><rect x="2" y="0" width="3" height="3" fill="#fff3a1"/>' +
      '</g>' +
    '</svg></span>' +
    '<span class="fx-voxel r"><svg viewBox="0 0 116 18" preserveAspectRatio="none">' +
      '<rect x="4" y="12" width="108" height="4" fill="#3c8527"/><rect x="4" y="10" width="108" height="3" fill="#55b836"/>' +
      /* pixel emerald */
      '<g transform="translate(34 1)">' +
        '<rect x="2" y="0" width="6" height="10" fill="#2d9e49"/><rect x="0" y="2" width="10" height="6" fill="#52c43b"/><rect x="2" y="2" width="3" height="4" fill="#a8ff96"/>' +
      '</g>' +
      /* pixel diamond gem / heart */
      '<g transform="translate(72 2)">' +
        '<rect x="2" y="0" width="3" height="3" fill="#ff3333"/><rect x="7" y="0" width="3" height="3" fill="#ff3333"/>' +
        '<rect x="0" y="2" width="12" height="4" fill="#ff3333"/><rect x="2" y="6" width="8" height="2" fill="#cc1a1a"/><rect x="4" y="8" width="4" height="2" fill="#cc1a1a"/>' +
        '<rect x="2" y="2" width="2" height="2" fill="#ffaaaa"/>' +
      '</g>' +
    '</svg></span>');

  ThemeFx.backdrop('blocks', function (c) {
    const sky = document.createElement('div');
    sky.className = 'fx-sky mc-sky ' + (c.dark ? 'mc-night' : 'mc-day') + (!c.still ? ' drift' : '');
    sky.innerHTML =
      '<div class="mc-cel"></div>' +
      '<div class="mc-cl" style="top:18%;left:8%;width:52px"></div>' +
      '<div class="mc-cl" style="top:34%;left:46%;width:44px;animation-delay:-22s"></div>' +
      '<div class="mc-cl" style="top:12%;left:74%;width:38px;animation-delay:-41s"></div>';
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    c.layer.appendChild(sky); c.layer.appendChild(cv);
    const N = c.phone ? 28 : 54;
    let W = 0, H = 0, cubes = [], raf = 0, last = 0, quiet = false, paused = false, gone = false, clock = 0;

    function size() { const d = Math.min(window.devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = Math.round(W * d); cv.height = Math.round(H * d); g.setTransform(d, 0, 0, d, 0, 0) }
    function make(bottom, burst) {
      const r = Math.random();
      const kind = burst ? 0 : (r < .55 ? 0 : r < .85 ? 1 : 2); // 0=XP orb, 1=enchant rune, 2=ember
      const sz = burst ? 5 + Math.floor(Math.random() * 4) : 4 + Math.floor(Math.random() * 4);
      const col = kind === 0 ? (Math.random() < .7 ? '#7ee836' : '#ffe65c') : kind === 1 ? (Math.random() < .5 ? '#b48eff' : '#4eedd8') : '#ff9e30';
      return {
        x: burst ? W * (.25 + Math.random() * .5) : Math.random() * W,
        y: bottom ? H + 12 + Math.random() * 40 : Math.random() * H,
        sz, col, kind,
        vy: burst ? -(80 + Math.random() * 140) : -(12 + Math.random() * 20),
        vx: burst ? (Math.random() - .5) * 180 : (Math.random() - .5) * 8,
        a: (c.dark ? .78 : .68) * (.65 + Math.random() * .35),
        ph: Math.random() * 6.28, once: !!burst
      };
    }
    function paint() {
      g.clearRect(0, 0, W, H);
      for (const b of cubes) {
        const pulse = c.still ? 1 : (.75 + .25 * Math.sin(b.ph + clock * 4));
        g.globalAlpha = b.a * pulse * (quiet ? .4 : 1);
        const x = Math.round(b.x), y = Math.round(b.y), s = b.sz;
        g.fillStyle = b.col;
        g.fillRect(x, y, s, s);
        if (b.kind === 0 && s >= 5) {
          g.fillStyle = '#eaffc4';
          g.fillRect(x + 1, y + 1, Math.max(1, s - 3), Math.max(1, s - 3));
        }
      }
      g.globalAlpha = 1;
    }
    function step(now) {
      raf = 0; if (gone || paused) return;
      if (now - last < 32) { raf = requestAnimationFrame(step); return }
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; clock += dt;
      for (let i = cubes.length - 1; i >= 0; i--) {
        const b = cubes[i];
        b.y += b.vy * dt; b.x += (b.vx + Math.sin(b.ph + clock * 1.6) * 8) * dt;
        if (b.once) b.vy += 120 * dt; // burst arcs slightly
        if (b.y < -20 || b.y > H + 40) {
          if (b.once || quiet) cubes.splice(i, 1); else cubes[i] = make(true);
        }
      }
      if (!quiet && cubes.filter(b => !b.once).length < N && Math.random() < .4) cubes.push(make(true));
      paint();
      if (cubes.length || !quiet) raf = requestAnimationFrame(step);
    }
    const run = () => { if (!raf && !c.still && !gone && !paused) { last = performance.now(); raf = requestAnimationFrame(step) } };
    size(); for (let i = 0; i < N; i++) cubes.push(make(false)); paint(); run();
    return {
      quiet(on) { quiet = on; sky.classList.toggle('hush', on); if (c.still) { cubes = on ? [] : Array.from({ length: N }, () => make(false)); paint() } else run() },
      pause(on) { paused = on; if (on) { cancelAnimationFrame(raf); raf = 0 } else run() },
      moment(name) { if (name !== 'xpburst' || c.still) return; const n = c.phone ? 36 : 55; for (let i = 0; i < n; i++) cubes.push(make(true, true)); run() },
      resize() { size(); if (c.still) cubes = quiet ? [] : cubes.map(() => make(false)); paint() },
      unmount() { gone = true; cancelAnimationFrame(raf); sky.remove(); cv.remove() }
    };
  });

  ThemeFx.theme('minecraft', {
    backdrop: 'blocks',
    ornaments: { hero: 'voxel', ledge: 'voxel' },
    moments: { section: 'xpburst', lesson: 'xpburst', goal: 'xpburst', exam: 'xpburst', badge: 'xpburst', solved: 'xpburst' },
    sound: 'bit'
  });
})();
