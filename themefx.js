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
