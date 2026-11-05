/* Site-wide pop-ups (Nov 5): a new DM, a reply/@mention in a discussion, or a duel challenge shows as one small toast on
   any page of the site (not on the page that already shows it: no DM toasts on dm.html, no duel toasts on duel.html, no
   reply toasts on discuss.html). Signed-in only; polls rpc alerts_poll (supabase_alerts.sql) once a minute while the page
   is visible. Settings: 'reviewer_notify'.live = {on, dm, disc, duel, title, pos} (missing = on, pos 'corner'|'top'),
   set on the Notifications page ("Pop-ups on the site"); that object already syncs across devices (daily.js).
   This device only: 'reviewer_alerts_seen' = {dm: highest DM id handled, disc: highest post id handled, duel: {CODE: snoozed until ms}}.
   window.ALERTS_QUIET = true silences it (e.g. during a timed exam); window.ALERTS_TEST_MS shortens the timers in tests.
   Loaded by update.js. */
(function () {
  if (window.top !== window || !window.fetch || window.__alertsOn) return;
  window.__alertsOn = 1;
  const SK = 'reviewer_alerts_seen', NK = 'reviewer_notify';
  const PG = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const T = +window.ALERTS_TEST_MS || 0;
  const jget = k => { try { return JSON.parse(localStorage.getItem(k)) } catch (e) { return null } };
  const jput = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } };
  let mem = null, cloud = null, last = 0, busy = false;
  const seen = () => jget(SK) || mem;
  const saveSeen = s => { mem = s; jput(SK, s) };
  const crs = PG === 'reviewer.html' ? new URLSearchParams(location.search).get('course') || '' : '';
  // silent during a course's mock exam (the engine's own top-level `state` and `page`), or when a page asks for quiet
  function quiet() {
    if (window.ALERTS_QUIET === true) return true;
    try { if (crs && typeof state !== 'undefined' && state && state.exam && !state.exam.done && typeof PG !== 'undefined' && page === 'exam') return true } catch (e) { }
    return false;
  }
  const live = () => Object.assign({ on: true, dm: true, disc: true, duel: true, title: true, pos: 'corner' }, ((jget(NK) || {}).live) || {});

  function tok() {
    try { if (typeof Auth !== 'undefined' && Auth && Auth.token) { if (!Auth.cloud) Auth.cloud = cloud; return Promise.resolve(Auth.token()).catch(() => '') } } catch (e) { }
    try { const s = JSON.parse(localStorage.getItem('reviewer_session') || 'null'); if (s && s.access && (!s.exp || Date.now() < s.exp)) return Promise.resolve(s.access) } catch (e) { }
    return Promise.resolve('');
  }
  function rpc(name, body) {
    return tok().then(tk => {
      if (!tk) return null;
      return fetch(cloud.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + name, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cloud.key, Authorization: 'Bearer ' + tk }, body: JSON.stringify(body)
      }).then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))));
    });
  }

  // ---- tab title: "(3) " while DMs are unread
  function setTitle(n) {
    const bare = document.title.replace(/^\(\d+\+?\) /, ''), p = n > 0 ? '(' + (n > 99 ? '99+' : n) + ') ' : '';
    if (document.title !== p + bare) document.title = p + bare;
  }

  // ---- polling
  function poll(force) {
    if (!cloud || busy || document.visibilityState !== 'visible') return;
    if (!force && Date.now() - last < 20e3) return;
    const L = live();
    if (L.on === false) { setTitle(0); return }
    busy = true; last = Date.now();
    const s = seen();
    rpc('alerts_poll', { p_dm_after: (s && s.dm) || 0, p_disc_after: (s && s.disc) || 0 })
      .then(r => { if (r && typeof r === 'object' && !Array.isArray(r)) handle(r, s, L) })
      .catch(() => { }).finally(() => { busy = false });
  }
  const isDuelMsg = b => /^\s*\[duel:[A-Z2-9]{8}\]\s*$/.test(String(b || ''));
  function preview(b) {
    b = String(b || '').replace(/^\[reply:[^\]]*\]\n?/, '');
    if (isDuelMsg(b)) return '⚔️ Duel challenge';
    b = b.replace(/\[sticker:[^\]]*\]/g, '🎨 Sticker').replace(/\s+/g, ' ').trim();
    return b.length > 90 ? b.slice(0, 88).trim() + '…' : b;
  }
  function handle(r, s, L) {
    const first = !s, now = Date.now();
    const st = { dm: (s && s.dm) || 0, disc: (s && s.disc) || 0, duel: Object.assign({}, (s && s.duel) || {}) };
    const dms = (r.dm || []).filter(m => m && m.id > st.dm), disc = (r.disc || []).filter(p => p && p.id > st.disc);
    dms.forEach(m => { st.dm = Math.max(st.dm, m.id) }); disc.forEach(p => { st.disc = Math.max(st.disc, p.id) });
    for (const c in st.duel) if (st.duel[c] < now - 8 * 864e5) delete st.duel[c];
    const duels = (r.duels || []).filter(d => d && d.code && !(st.duel[d.code] > now) && !queued(d.code));
    // a duel toast that was seen but not acted on comes back at most every 30 minutes
    const q = quiet();
    if (L.duel !== false && PG !== 'duel.html' && !q) duels.forEach(d => { st.duel[d.code] = now + 30 * 60e3 });
    saveSeen(st);
    setTitle(L.title !== false ? (+r.dm_unread || 0) : 0);
    if (q) return;
    if (L.duel !== false && PG !== 'duel.html') duels.slice().reverse().forEach(d => add(duelToast(d)));
    if (first) return;   // first run on this device: remember what is already there, don't pop it all up
    const plain = dms.filter(m => !isDuelMsg(m.body));   // a duel card in the DMs already has its own duel toast
    if (L.dm !== false && PG !== 'dm.html' && plain.length) add(dmToast(plain));
    // course pages already pop up replies in their own course (the engine's dpop): only other threads here
    if (L.disc !== false && PG !== 'discuss.html') disc.filter(p => !crs || String(p.thread || '').split(':')[0] !== crs).slice(0, 2).reverse().forEach(p => add(discToast(p)));
  }

  // ---- toast builders
  function dmToast(list) {
    const by = {}, order = [];
    list.forEach(m => { if (!by[m.from]) { by[m.from] = []; order.push(m.from) } by[m.from].push(m) });
    const newest = list[0], names = order.map(i => by[i][0].name || 'A classmate');
    let title;
    if (order.length === 1) { const n = by[order[0]].length; title = n > 1 ? names[0] + ' · ' + n + ' new messages' : names[0] + ' sent you a message' }
    else title = 'New messages from ' + (names.length === 2 ? names.join(' and ') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
    return {
      key: 'dm' + newest.id, who: newest, title, text: (order.length > 1 ? (newest.name || 'A classmate') + ': ' : '') + preview(newest.body),
      href: order.length === 1 ? 'dm.html?with=' + encodeURIComponent(order[0]) : 'dm.html'
    };
  }
  function discToast(p) {
    return { key: 'disc' + p.id, who: { name: p.name }, title: (p.name || 'A classmate') + (p.kind === 'reply' ? ' replied to you' : ' mentioned you'), text: preview(p.body), href: p.link || 'discuss.html' };
  }
  function duelToast(d) {
    return {
      key: 'duel' + d.code, duel: d, title: (d.name || 'A classmate') + ' challenged you to a duel',
      text: [d.course_title || d.course, d.scope, d.n ? d.n + ' questions' : ''].filter(Boolean).join(' · ')
    };
  }

  // ---- toast UI: one at a time, the rest wait
  const queue = []; let cur = null, wrap = null;
  function queued(code) { return (cur && cur.t.key === 'duel' + code) || queue.some(t => t.key === 'duel' + code) }
  function add(t) { if ((cur && cur.t.key === t.key) || queue.some(q => q.key === t.key)) return; queue.push(t); next() }
  function css() {
    if (document.getElementById('altcss')) return;
    const st = document.createElement('style'); st.id = 'altcss';
    st.textContent =
      '.altw{position:fixed;z-index:55;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:340px;max-width:calc(100vw - 32px);pointer-events:none}' +
      'body.tabs .altw{bottom:calc(var(--tbh,58px) + 14px)}' +
      '.altw.top{top:calc(12px + env(safe-area-inset-top,0px));bottom:auto;right:auto;left:50%;transform:translateX(-50%)}' +
      '@media (max-width:599px){.altw{left:16px;right:16px;width:auto;max-width:none}.altw.top{transform:none}}' +
      '.alt{pointer-events:auto;position:relative;display:flex;gap:10px;align-items:flex-start;padding:12px 34px 12px 12px;border-radius:14px;background:var(--card,#fff);color:var(--text,#1d1b18);' +
      'border:1px solid var(--border,rgba(0,0,0,.12));box-shadow:0 10px 30px rgba(0,0,0,.18);font:14px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left}' +
      '.alt .alb{flex:1;min-width:0;cursor:pointer}.alt.duel .alb{cursor:default}' +
      '.alt .altt{display:block;font-weight:700;overflow-wrap:anywhere}.alt .altp{margin:2px 0 0;opacity:.8;overflow-wrap:anywhere}' +
      '.alt .alav{flex:none;width:32px;height:32px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center}' +
      '.alt .alav.ini{background:var(--accent,#4f46e5);color:#fff;font-weight:700}' +
      '.alt .alsw{flex:none;font-size:26px;line-height:32px;display:inline-block;transform-origin:50% 70%}' +
      '.alt .alx,.alt .alg{position:absolute;top:6px;right:6px;width:26px;height:26px;border:0;border-radius:8px;background:transparent;color:inherit;opacity:.6;cursor:pointer;font:16px/26px system-ui;text-align:center;text-decoration:none;padding:0}' +
      '.alt .alg{top:auto;bottom:6px;font-size:14px}.alt .alx:hover,.alt .alg:hover{opacity:1;background:rgba(127,127,127,.15)}' +
      '.alt .ala{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}' +
      '.alt .ala button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:7px 12px;cursor:pointer;background:rgba(127,127,127,.15);color:inherit}' +
      '.alt .ala button.pri{background:var(--accent,#4f46e5);color:#fff}.alt .ala button:disabled{opacity:.55;cursor:default}' +
      '.alt.duel{border:2px solid transparent;background:linear-gradient(var(--card,#fff),var(--card,#fff)) padding-box,linear-gradient(135deg,var(--accent,#7c3aed),#f59e0b) border-box}' +
      '@media (prefers-reduced-motion:no-preference){.alt{animation:altin .28s ease-out}.alt.duel{animation:altside .55s cubic-bezier(.2,1.35,.4,1)}' +
      '.alt.duel .alsw{animation:altwig .9s ease-in-out .45s 2}.alt.out{animation:altout .2s ease-in forwards}}' +
      '@media (prefers-reduced-motion:reduce){.alt{animation:altfade .2s}.alt.out{opacity:0}}' +
      '@keyframes altin{from{opacity:0;transform:translateY(10px)}}@keyframes altside{from{opacity:0;transform:translateX(115%)}}' +
      '@keyframes altwig{0%,100%{transform:rotate(0)}25%{transform:rotate(-16deg)}75%{transform:rotate(16deg)}}' +
      '@keyframes altout{to{opacity:0;transform:translateY(8px)}}@keyframes altfade{from{opacity:0}}';
    document.head.appendChild(st);
  }
  function avatar(o) {
    const w = document.createElement('span'); w.className = 'alav';
    if (window.Profile && Profile.html && (o.av || o.url)) { try { w.innerHTML = Profile.html({ av: o.av, url: o.url, name: o.name || '' }, 32); return w } catch (e) { } }
    w.classList.add('ini'); w.textContent = (String(o.name || '?').trim().charAt(0) || '?').toUpperCase(); return w;
  }
  function btn(txt, cls, fn) { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; if (cls) b.className = cls; b.addEventListener('click', fn); return b }
  function snooze(code, ms) { const s = seen() || { dm: 0, disc: 0, duel: {} }; s.duel = s.duel || {}; s.duel[code] = Date.now() + ms; saveSeen(s) }
  function next() {
    if (cur || !queue.length || !document.body) return;
    const t = queue.shift(); css();
    if (!wrap || !wrap.isConnected) { wrap = document.createElement('div'); document.body.appendChild(wrap) }
    wrap.className = 'altw' + (live().pos === 'top' ? ' top' : '');
    const el = document.createElement('div'); el.className = 'alt' + (t.duel ? ' duel' : '');
    el.setAttribute('role', t.duel ? 'alertdialog' : 'status'); el.setAttribute('aria-live', 'polite');
    if (t.duel) { const i = document.createElement('span'); i.className = 'alsw'; i.setAttribute('aria-hidden', 'true'); i.textContent = '⚔️'; el.appendChild(i) }
    else el.appendChild(avatar(t.who || {}));
    const body = document.createElement('div'); body.className = 'alb';
    const h = document.createElement('b'); h.className = 'altt'; h.textContent = t.title;
    const p = document.createElement('p'); p.className = 'altp'; p.textContent = t.text || '';
    body.appendChild(h); body.appendChild(p); el.appendChild(body);
    const c = { t, el, timer: null, left: T ? T * 4 : 8000, at: 0 };
    cur = c;
    const close = () => {
      if (cur !== c) return; clearTimeout(c.timer); cur = null;
      el.classList.add('out'); setTimeout(() => { el.remove(); next() }, 220);
    };
    c.close = close;
    if (t.duel) {
      const code = t.duel.code, a = document.createElement('div'); a.className = 'ala';
      const acc = btn('Accept', 'pri', () => { snooze(code, 3 * 36e5); location.href = 'duel.html?d=' + encodeURIComponent(code) });
      const dec = btn('Decline', '', () => {
        acc.disabled = dec.disabled = later.disabled = true; p.textContent = 'Declining…';
        rpc('duel_decline', { p_code: code }).then(() => { snooze(code, 8 * 864e5); p.textContent = 'Declined'; setTimeout(close, T ? T : 1500) })
          .catch(() => { p.textContent = 'Couldn\'t decline. Try again.'; acc.disabled = dec.disabled = later.disabled = false });
      });
      const later = btn('Later', '', () => { snooze(code, 3 * 36e5); close() });
      a.appendChild(acc); a.appendChild(dec); a.appendChild(later); body.appendChild(a);
    } else {
      body.addEventListener('click', () => { close(); location.href = t.href });
      const run = () => { c.at = Date.now(); c.timer = setTimeout(close, c.left) };
      const pause = () => { if (!c.timer) return; clearTimeout(c.timer); c.timer = null; c.left = Math.max(1500, c.left - (Date.now() - c.at)) };
      el.addEventListener('mouseenter', pause); el.addEventListener('focusin', pause);
      el.addEventListener('mouseleave', () => { if (!c.timer && cur === c) run() });
      run();
    }
    const x = btn('✕', 'alx', () => { if (t.duel) snooze(t.duel.code, 3 * 36e5); close() }); x.setAttribute('aria-label', 'Close'); x.title = 'Close';
    const g = document.createElement('a'); g.className = 'alg'; g.href = 'notifications.html#alerts'; g.textContent = '⚙'; g.title = 'Pop-up settings'; g.setAttribute('aria-label', 'Pop-up settings');
    el.appendChild(x); el.appendChild(g);
    wrap.appendChild(el);
  }
  // a duel handled in another tab: close it here too
  addEventListener('storage', e => {
    if (e.key !== SK || !cur || !cur.t.duel) return;
    const s = seen(); if (s && s.duel && s.duel[cur.t.duel.code] > Date.now() + 31 * 60e3) cur.close();
  });

  window.Alerts = { poll: () => poll(true) };
  fetch('courses.json').then(r => r.json()).then(l => {
    const c = (l.find(x => x.cloud && x.cloud.url) || {}).cloud; if (!c || !c.key) return;
    cloud = c;
    setTimeout(() => poll(true), T || 2500);
    setInterval(() => poll(true), T || 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(false) });
  }).catch(() => { });
})();
