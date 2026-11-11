/* Gift exchange chat: red dot on the home tile + a pop-up with a small ding when a new anonymous message is waiting
   (Nov 11, 2026). Loaded on every page by update.js. Signed-in only; asks rpc gift_chat_unread (supabase_gift_chat.sql),
   which returns two numbers and nothing about who wrote anything: {giftee: n|null, santa: n|null}.
   - Red dot (stays): on the home page's Gift exchange tile (#gifttool) while anything is unread.
   - Pop-up + ding (TEMPORARY, the user's word: "only for this while because it's important"): set POPUP = false, or
     delete that block, once the year-end party is over. It stays until tapped, and shows once per new message count.
   This device only: 'reviewer_gift_ping' = {n: unread count already announced}. No message text ever reaches this file.
   Quiet when: on gifts.html (it has its own badges), "Pop-ups on the site" is off (reviewer_notify.live.on === false),
   window.ALERTS_QUIET, or a course's mock exam is running. window.ALERTS_TEST_MS shortens the timers in tests. */
(function () {
  if (window.top !== window || !window.fetch || window.__giftPing) return;
  window.__giftPing = 1;
  const POPUP = true;
  const SK = 'reviewer_gift_ping';
  const PG = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (PG === 'gifts.html') return;
  const T = +window.ALERTS_TEST_MS || 0;
  const jget = k => { try { return JSON.parse(localStorage.getItem(k)) } catch (e) { return null } };
  let cloud = null, busy = false, last = 0, mem = null, shown = null;
  const told = () => { const s = jget(SK) || mem; return (s && +s.n) || 0 };
  const setTold = n => { mem = { n }; try { localStorage.setItem(SK, JSON.stringify(mem)) } catch (e) { } };

  function quiet() {
    if (window.ALERTS_QUIET === true) return true;
    if (((jget('reviewer_notify') || {}).live || {}).on === false) return true;
    try { if (PG === 'reviewer.html' && typeof state !== 'undefined' && state && state.exam && !state.exam.done && typeof page !== 'undefined' && page === 'exam') return true } catch (e) { }
    return false;
  }
  function tok() {
    try { if (typeof Auth !== 'undefined' && Auth && Auth.token) { if (!Auth.cloud) Auth.cloud = cloud; return Promise.resolve(Auth.token()).catch(() => '') } } catch (e) { }
    try { const s = JSON.parse(localStorage.getItem('reviewer_session') || 'null'); if (s && s.access && (!s.exp || Date.now() < s.exp)) return Promise.resolve(s.access) } catch (e) { }
    return Promise.resolve('');
  }
  function poll(force) {
    if (!cloud || busy || document.visibilityState !== 'visible') return;
    if (!force && Date.now() - last < 20e3) return;
    busy = true; last = Date.now();
    tok().then(tk => {
      if (!tk) return null;
      return fetch(cloud.url.replace(/\/+$/, '') + '/rest/v1/rpc/gift_chat_unread', {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cloud.key, Authorization: 'Bearer ' + tk }, body: '{}'
      }).then(r => r.ok ? r.json() : null);
    }).then(r => {
      if (!r || typeof r !== 'object' || Array.isArray(r)) return;
      const g = typeof r.giftee === 'number' ? r.giftee : 0, s = typeof r.santa === 'number' ? r.santa : 0;
      handle(g, s);
    }).catch(() => { }).finally(() => { busy = false });
  }

  function css() {
    if (document.getElementById('gpcss')) return;
    const st = document.createElement('style'); st.id = 'gpcss';
    st.textContent =
      '#gifttool .tic{position:relative}' +
      '.gpdot{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:var(--bad,#ef4444);color:#fff;' +
      'font:700 11px/18px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;box-shadow:0 0 0 2px var(--surface,#fff)}' +
      '.gpw{position:fixed;z-index:58;left:50%;top:calc(14px + env(safe-area-inset-top,0px));transform:translateX(-50%);width:360px;max-width:calc(100vw - 24px)}' +
      '.gp{display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:16px;background:var(--surface,var(--card,#fff));color:var(--text,#1d1b18);' +
      'border:1.5px solid var(--accent,#4f46e5);box-shadow:0 14px 40px rgba(0,0,0,.25);font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left}' +
      '.gp .gpi{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-size:20px;background:var(--accent-soft,rgba(79,70,229,.12))}' +
      '.gp .gpb{flex:1;min-width:0}.gp b{display:block;font-size:15px;overflow-wrap:anywhere}.gp p{margin:2px 0 0;opacity:.8;overflow-wrap:anywhere}' +
      '.gp .gpa{display:flex;gap:8px;margin-top:10px}' +
      '.gp button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:8px 14px;cursor:pointer;background:rgba(127,127,127,.15);color:inherit}' +
      '.gp button.pri{background:var(--accent,#4f46e5);color:var(--accent-ink,#fff)}' +
      '@media (prefers-reduced-motion:no-preference){.gp{animation:gpin .35s cubic-bezier(.2,1.3,.4,1)}.gp .gpi{animation:gpwig .8s ease-in-out .3s 2}}' +
      '@keyframes gpin{from{opacity:0;transform:translateY(-16px) scale(.96)}}@keyframes gpwig{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg)}75%{transform:rotate(14deg)}}';
    document.head.appendChild(st);
  }

  // ---- red dot on the home tile
  function dot(n) {
    const t = document.getElementById('gifttool'); if (!t) return;
    const ic = t.querySelector('.tic'); if (!ic) return;
    let d = ic.querySelector('.gpdot');
    const sub = document.getElementById('giftsub');
    if (sub) {
      if (n && sub.dataset.was == null) sub.dataset.was = sub.textContent;
      if (n) sub.textContent = n + ' new message' + (n > 1 ? 's' : '');
      else if (sub.dataset.was != null) { sub.textContent = sub.dataset.was; delete sub.dataset.was }
    }
    if (!n) { if (d) d.remove(); t.removeAttribute('aria-label'); return }
    css();
    if (!d) { d = document.createElement('span'); d.className = 'gpdot'; ic.appendChild(d) }
    d.textContent = n > 9 ? '9+' : n;
    t.setAttribute('aria-label', 'Gift exchange, ' + n + ' new message' + (n > 1 ? 's' : ''));
  }

  // ---- ding: two soft notes. Browsers block sound until the page has been tapped, so when it can't play right away
  // it plays on the first tap or key press while the pop-up is still showing.
  let dinged = false;
  function tone(ctx) {
    const t0 = ctx.currentTime + 0.02;
    [[880, 0], [1318.5, 0.13]].forEach(([f, at]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.16, t0 + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.42);
      o.connect(g); g.connect(ctx.destination); o.start(t0 + at); o.stop(t0 + at + 0.45);
    });
    setTimeout(() => { try { ctx.close() } catch (e) { } }, 1200);
  }
  function ding() {
    if (dinged) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    let ctx; try { ctx = new AC() } catch (e) { return }
    const go = () => { if (dinged) return; dinged = true; window.__giftDing = (window.__giftDing || 0) + 1; try { tone(ctx) } catch (e) { } };
    const later = () => {
      const once = () => { removeEventListener('pointerdown', once, true); removeEventListener('keydown', once, true); if (!shown || dinged) return; Promise.resolve(ctx.resume()).then(go).catch(() => { }) };
      addEventListener('pointerdown', once, true); addEventListener('keydown', once, true);
    };
    if (ctx.state === 'running') go();
    else Promise.resolve(ctx.resume()).then(() => { if (ctx.state === 'running') go(); else later() }).catch(later);
    setTimeout(() => { if (!dinged && ctx.state !== 'running') later() }, 400);
  }

  // ---- the pop-up (temporary)
  function hide() { if (shown) { shown.remove(); shown = null } }
  function popup(g, s) {
    if (!document.body) return;
    hide(); css();
    const n = g + s, side = s && !g ? 'santa' : g && !s ? 'giftee' : '';
    const w = document.createElement('div'); w.className = 'gpw'; w.id = 'giftpop';
    const el = document.createElement('div'); el.className = 'gp'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-labelledby', 'gptitle');
    const i = document.createElement('span'); i.className = 'gpi'; i.setAttribute('aria-hidden', 'true'); i.textContent = '🎁';
    const b = document.createElement('div'); b.className = 'gpb';
    const h = document.createElement('b'); h.id = 'gptitle';
    h.textContent = n > 1 ? n + ' new gift exchange messages' : 'New gift exchange message';
    const p = document.createElement('p');
    p.textContent = side === 'santa' ? 'Your Secret Santa sent you a message.' : side === 'giftee' ? 'Your giftee replied to you.' : 'From your Secret Santa and your giftee.';
    const a = document.createElement('div'); a.className = 'gpa';
    const open = document.createElement('button'); open.type = 'button'; open.className = 'pri'; open.textContent = 'Open chat';
    open.addEventListener('click', () => { hide(); location.href = 'gifts.html' + (side ? '?chat=' + side : '') });
    const lat = document.createElement('button'); lat.type = 'button'; lat.textContent = 'Later';
    lat.addEventListener('click', hide);
    a.appendChild(open); a.appendChild(lat); b.appendChild(h); b.appendChild(p); b.appendChild(a); el.appendChild(i); el.appendChild(b); w.appendChild(el);
    document.body.appendChild(w); shown = w;
    dinged = false; ding();
  }

  function handle(g, s) {
    const n = g + s;
    dot(n);
    if (!n) { if (told()) setTold(0); hide(); return }
    if (n < told()) setTold(n);            // some were read on another device
    if (!POPUP || n <= told() || quiet()) return;
    setTold(n);
    popup(g, s);
  }
  // another tab announced it or opened the chat: don't keep a stale pop-up here
  addEventListener('storage', e => { if (e.key === SK && shown && !told()) hide() });

  window.GiftPing = { poll: () => poll(true) };
  fetch('courses.json').then(r => r.json()).then(l => {
    const c = (l.find(x => x.cloud && x.cloud.url) || {}).cloud; if (!c || !c.key) return;
    cloud = c;
    setTimeout(() => poll(true), T || 1500);
    setInterval(() => poll(true), T ? T * 4 : 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(false) });
  }).catch(() => { });
})();
