// Home page "Customize": drag the top cards, the tiles and the courses into any order, × hides one, the Hidden tray
// brings it back. Saves on every change to the same per-device layout as Settings → Home page ('reviewer_home', through
// HomeLayout in index.html's <head>). Mouse: drag anywhere on an item. Touch: hold for a moment, then drag (a quick swipe
// still scrolls), or drag the grip at once. Keyboard: arrow keys move the focused item, Delete hides it.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NAMES = { upnext: 'Next class', tests: 'Tests coming up', today: 'Today', gdtool: 'General discussion', qztool: 'Live quiz', cwtool: 'Daily crossword',
    wdtool: 'APMed’le', atttool: 'My attendance', shoptool: 'Class shop', cdtool: 'Class day', modtool: 'Moderator' };
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const X = '<svg class="i" width="13" height="13" aria-hidden="true"><use href="icons.svg#i-x"/></svg>';
  const GRIP = '<svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true"><g fill="currentColor"><circle cx="2.5" cy="3" r="1.5"/><circle cx="7.5" cy="3" r="1.5"/><circle cx="2.5" cy="8" r="1.5"/><circle cx="7.5" cy="8" r="1.5"/><circle cx="2.5" cy="13" r="1.5"/><circle cx="7.5" cy="13" r="1.5"/></g></svg>';
  let on = false, bar = null, drag = null, pending = false;

  // the three groups: t = top cards (in <main>), o = tiles (nav.tools), c = courses (#list); an item can't leave its group
  const keyOf = el => el.dataset.c || el.id;
  const courseName = id => { const c = (window.COURSE_LIST || []).find(x => x.id === id); return c ? c.title : id };
  const nameOf = (g, id) => g === 'c' ? courseName(id) : (NAMES[id] || id);
  function items(g) {
    if (g === 't') return HomeLayout.TOP.map($).filter(e => e && !e.hidden).sort((a, b) => a.compareDocumentPosition(b) & 4 ? -1 : 1);
    if (g === 'o') return [...document.querySelectorAll('nav.tools>.tool:not(.hghost)')].filter(e => !e.hidden);
    return [...document.querySelectorAll('#list>[data-c]:not(.hghost)')];
  }
  const visible = el => getComputedStyle(el).display !== 'none';

  function decorate() {
    if (!on) return;
    ['t', 'o', 'c'].forEach(g => items(g).forEach(el => {
      el.dataset.g = g; el.classList.add('hed'); el.tabIndex = 0; el.setAttribute('draggable', 'false');
      el.querySelectorAll('a,button,input').forEach(x => { if (!x.closest('.hx')) x.tabIndex = -1 });
      if (!el.querySelector(':scope>.hx')) {
        const n = nameOf(g, keyOf(el));
        el.insertAdjacentHTML('beforeend', '<span class="hg" aria-hidden="true">' + GRIP + '</span><button type="button" class="hx" aria-label="Hide ' + esc(n) + '" title="Hide">' + X + '</button>');
      }
    }));
    drawBar();
  }
  function undecorate() {
    document.querySelectorAll('.hed').forEach(el => {
      el.classList.remove('hed'); el.removeAttribute('tabindex'); el.removeAttribute('draggable'); delete el.dataset.g;
      el.querySelectorAll(':scope>.hg,:scope>.hx').forEach(x => x.remove());
      el.querySelectorAll('[tabindex="-1"]').forEach(x => x.removeAttribute('tabindex'));
    });
  }

  // the bar at the bottom of the screen
  function drawBar() {
    if (!bar) return;
    const h = HomeLayout.get(), hid = [];
    h.hide.forEach(id => { const e = $(id); if (e && !e.hidden && (HomeLayout.TOP.includes(id) || e.classList.contains('tool'))) hid.push([HomeLayout.TOP.includes(id) ? 't' : 'o', id]) });
    h.hideC.forEach(id => { if (document.querySelector('#list>[data-c="' + id + '"]')) hid.push(['c', id]) });
    const seg = [['auto', 'Auto'], ['compact', 'Compact'], ['full', 'Full']].map(([v, t]) => '<button type="button" role="radio" aria-checked="' + ((h.layout || 'auto') === v) + '" data-l="' + v + '">' + t + '</button>').join('');
    const touch = matchMedia('(pointer: coarse)').matches;
    bar.innerHTML = '<div class="hb1"><div class="ht"><b>Customize home</b><span>' + (touch ? 'Hold and drag to move' : 'Drag to move') + ' · × to hide</span></div><button type="button" class="btn primary" data-a="done">Done</button></div>' +
      '<div class="hb2"><span class="hseg" role="radiogroup" aria-label="Tile size">' + seg + '</span>' +
      '<button type="button" class="hck" role="switch" aria-checked="' + !!h.first + '" data-a="first"><i aria-hidden="true"></i>Courses first</button>' +
      '<button type="button" class="hrs" data-a="reset">Reset</button></div>' +
      (hid.length ? '<div class="htray" aria-label="Hidden"><span>Hidden</span>' + hid.map(([g, id]) => '<button type="button" data-show="' + g + ':' + esc(id) + '"><svg class="i" width="12" height="12" aria-hidden="true"><use href="icons.svg#i-plus"/></svg>' + esc(nameOf(g, id)) + '</button>').join('') + '</div>' : '');
    document.body.style.paddingBottom = (bar.offsetHeight + 12) + 'px';
  }
  function barClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const h = HomeLayout.get();
    if (b.dataset.l) { h.layout = b.dataset.l === 'auto' ? undefined : b.dataset.l; HomeLayout.put(h); drawBar() }
    else if (b.dataset.a === 'first') { h.first = !h.first || undefined; HomeLayout.put(h); HomeLayout.place(h); drawBar() }
    else if (b.dataset.a === 'reset') reset();
    else if (b.dataset.a === 'done') close();
    else if (b.dataset.show) {
      const [g, id] = b.dataset.show.split(':');
      animate(g, () => { if (g === 'c') h.hideC = h.hideC.filter(x => x !== id); else h.hide = h.hide.filter(x => x !== id); HomeLayout.put(h) });
      drawBar();
      const el = g === 'c' ? document.querySelector('#list>[data-c="' + id + '"]') : $(id);
      if (el) { el.classList.add('hnew'); setTimeout(() => el.classList.remove('hnew'), 900); try { el.focus({ preventScroll: true }) } catch (x) { } }
    }
  }
  async function reset() {
    const ok = window.ask ? await ask('Every card, tile and course goes back to the usual order and shows again. Tile size goes back to Auto.', { title: 'Reset the home page?', ok: 'Reset' }) : true;
    if (!ok) return;
    HomeLayout.put({}); HomeLayout.place();
    if (window.drawCourses) drawCourses();
    decorate();
  }

  // FLIP: items slide to their new places instead of jumping
  function animate(g, change) {
    const els = g === 'c' ? [...document.querySelectorAll('#list>[data-c]:not(.hghost)')] : g === 'o' ? [...document.querySelectorAll('nav.tools>.tool:not(.hghost)')] : items('t');
    const before = new Map(els.map(x => [x, x.getBoundingClientRect()]));
    change();
    if (calm()) return;
    els.forEach(x => {
      if (drag && x === drag.el) return;
      const a = before.get(x), b = x.getBoundingClientRect();
      if (!a.width || !b.width) return;
      const dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) { x.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' }); x._busy = performance.now() + 200 }
    });
  }
  // move el to just before/after ref (the Next class card carries its warm-up button along)
  function moveTo(el, ref, after) {
    const pq = $('prevq');
    if (after && ref.id === 'upnext' && pq) ref = pq;
    ref.parentNode.insertBefore(el, after ? ref.nextSibling : ref);
    if (el.id === 'upnext' && pq) el.after(pq);
  }
  function save(g) {
    const h = HomeLayout.get();
    if (g === 't') h.top = HomeLayout.TOP.map($).filter(Boolean).sort((a, b) => a.compareDocumentPosition(b) & 4 ? -1 : 1).map(e => e.id);
    else if (g === 'o') h.order = [...document.querySelectorAll('nav.tools>.tool:not(.hghost)')].map(e => e.id);
    else h.courses = [...document.querySelectorAll('#list>[data-c]:not(.hghost)')].map(e => e.dataset.c);
    HomeLayout.put(h);
  }
  function hide(el) {
    const g = el.dataset.g, id = keyOf(el), h = HomeLayout.get(), list = items(g).filter(visible), i = list.indexOf(el);
    animate(g, () => { if (g === 'c') { if (!h.hideC.includes(id)) h.hideC.push(id) } else if (!h.hide.includes(id)) h.hide.push(id); HomeLayout.put(h) });
    drawBar();
    const next = list[i + 1] || list[i - 1];
    try { (next || bar.querySelector('[data-show]') || bar.querySelector('[data-a="done"]')).focus({ preventScroll: true }) } catch (x) { }
  }

  // dragging
  function down(e) {
    if (!on || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = e.target.closest('.hed'); if (!el || e.target.closest('.hx')) return;
    const grip = !!e.target.closest('.hg'), touch = e.pointerType !== 'mouse';
    drag = { el, g: el.dataset.g, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, pid: e.pointerId, touch, started: false };
    if (grip) { e.preventDefault(); start() }
    else if (touch) { el.classList.add('hhold'); drag.timer = setTimeout(start, 280) }
  }
  function move(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    drag.cx = e.clientX; drag.cy = e.clientY;
    if (!drag.started) {
      const d = Math.hypot(drag.cx - drag.x, drag.cy - drag.y);
      if (drag.touch) { if (d > 8) cancel() }      // a swipe: let the page scroll
      else if (d > 5) start();
      return;
    }
    e.preventDefault(); follow();
  }
  function start() {
    const d = drag; if (!d || d.started) return;
    clearTimeout(d.timer); d.el.classList.remove('hhold'); d.started = true;
    const r = d.el.getBoundingClientRect(); d.ox = d.x - r.left; d.oy = d.y - r.top;
    const gh = d.el.cloneNode(true); gh.removeAttribute('id'); gh.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    gh.classList.add('hghost'); gh.classList.remove('hed', 'hhold'); delete gh.dataset.c; gh.querySelectorAll('.hx,.hg').forEach(x => x.remove()); gh.removeAttribute('tabindex'); gh.setAttribute('aria-hidden', 'true');
    gh.style.width = r.width + 'px'; gh.style.height = r.height + 'px';
    d.el.parentNode.appendChild(gh); d.ghost = gh;          // same parent, so compact/grid styles still apply
    d.el.classList.add('hph'); document.documentElement.classList.add('hdragging');
    try { navigator.vibrate && navigator.vibrate(12) } catch (x) { }
    follow(); d.raf = requestAnimationFrame(scroll);
  }
  function follow() {
    const d = drag; if (!d || !d.ghost) return;
    d.ghost.style.transform = 'translate(' + (d.cx - d.ox) + 'px,' + (d.cy - d.oy) + 'px)';
    const t = document.elementFromPoint(d.cx, d.cy), o = t && t.closest('.hed');
    if (!o || o === d.el || o.dataset.g !== d.g || (o._busy && o._busy > performance.now())) return;
    const list = items(d.g), a = list.indexOf(d.el), b = list.indexOf(o); if (a < 0 || b < 0) return;
    const r = o.getBoundingClientRect(), me = d.el.getBoundingClientRect(), row = Math.abs(r.top - me.top) < 8;
    const past = row ? d.cx > r.left + r.width / 2 : d.cy > r.top + r.height / 2;
    if (b > a && past) animate(d.g, () => moveTo(d.el, o, true));
    else if (b < a && !past) animate(d.g, () => moveTo(d.el, o, false));
  }
  function scroll() {      // near the top or bottom edge, the page scrolls along
    const d = drag; if (!d || !d.started) return;
    const top = 70, bot = innerHeight - (bar ? bar.offsetHeight : 0) - 60;
    const v = d.cy < top ? -(top - d.cy) / 3 : d.cy > bot ? (d.cy - bot) / 3 : 0;
    if (v) { scrollBy(0, Math.max(-20, Math.min(20, v))); follow() }
    d.raf = requestAnimationFrame(scroll);
  }
  function up(e) {
    if (!drag || (e && e.pointerId !== drag.pid)) return;
    const d = drag; if (!d.started) return cancel();
    cancelAnimationFrame(d.raf); drag = null;
    const end = () => { d.ghost.remove(); d.el.classList.remove('hph'); document.documentElement.classList.remove('hdragging') };
    if (calm()) end();
    else {
      const r = d.el.getBoundingClientRect();
      d.ghost.style.transition = 'transform .16s ease'; d.ghost.style.transform = 'translate(' + r.left + 'px,' + r.top + 'px)';
      setTimeout(end, 170);
    }
    save(d.g);
    if (pending) { pending = false; setTimeout(() => window.drawCourses && drawCourses(), 200) }
  }
  function cancel() { if (!drag) return; clearTimeout(drag.timer); drag.el.classList.remove('hhold'); drag = null }
  // stop the page from scrolling while a touch drag is on (must be a non-passive listener)
  document.addEventListener('touchmove', e => { if (drag && drag.started) e.preventDefault() }, { passive: false });
  document.addEventListener('pointerdown', down);
  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', e => { if (drag && drag.started) up(e); else cancel() });
  document.addEventListener('contextmenu', e => { if (on && e.target.closest('.hed')) e.preventDefault() });
  document.addEventListener('dragstart', e => { if (on && e.target.closest && e.target.closest('.hed')) e.preventDefault() });
  // while customizing, tapping an item doesn't open it
  document.addEventListener('click', e => {
    if (!on) return;
    const x = e.target.closest('.hx');
    if (x) { e.preventDefault(); e.stopPropagation(); hide(x.closest('.hed')); return }
    if (e.target.closest('.hed')) { e.preventDefault(); e.stopPropagation() }
  }, true);
  document.addEventListener('keydown', e => {
    if (!on) return;
    if (e.key === 'Escape' && !($('askbox') && !$('askbox').hidden)) { close(); return }
    const el = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('hed') ? document.activeElement : null;
    if (!el) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); hide(el); return }
    const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft', fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    if (!back && !fwd) return;
    e.preventDefault();
    const g = el.dataset.g, list = items(g).filter(visible), i = list.indexOf(el), o = list[i + (fwd ? 1 : -1)];
    if (!o) return;
    animate(g, () => moveTo(el, o, fwd)); save(g);
    try { el.focus({ preventScroll: true }) } catch (x) { }
  });

  function open() {
    if (on) return true;
    on = true; document.documentElement.classList.add('hediting');
    HomeLayout.place();
    bar = document.createElement('div'); bar.className = 'hbar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Customize home');
    bar.addEventListener('click', barClick); document.body.appendChild(bar);
    decorate();
    try { bar.querySelector('[data-a="done"]').focus({ preventScroll: true }) } catch (x) { }
    return true;
  }
  function close() {
    if (!on) return; cancel();
    on = false; document.documentElement.classList.remove('hediting', 'hdragging');
    undecorate(); if (bar) bar.remove(); bar = null; document.body.style.paddingBottom = '';
    HomeLayout.put(HomeLayout.get());
    const c = document.querySelector('nav.tools .cust'); try { c && c.focus({ preventScroll: true }) } catch (x) { }
  }
  window.HomeEdit = {
    open, close, isOn: () => on,
    // index.html's drawCourses asks first: a redraw in the middle of a drag waits until the drop
    busy: () => !!(drag && drag.started), later: () => { pending = true }, redecorate: decorate
  };
  const c = document.querySelector('nav.tools .cust');
  if (c) c.addEventListener('click', e => { e.preventDefault(); open() });
})();
