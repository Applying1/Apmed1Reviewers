/* One-time notification setup guide (Nov 5). Classmates forget to turn notifications on, so on entering the site (any page
   but Notifications) this shows a plain card with the steps for their device and a Turn on button. Only while this device's
   notifications are off; at most 3 times, 20 h apart, once per browser session, never over another dialog. Turning them on
   here ends it for good. Device only: 'reviewer_push_nudge' = {n: times shown, at: last shown ms}. If storage is missing it
   never shows (it couldn't count). window.NUDGE_TEST_MS shortens the wait in tests. Loaded by update.js. */
(function () {
  if (window.top !== window) return;
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (page === 'notifications.html') return;
  const K = 'reviewer_push_nudge', SS = 'reviewer_push_nudge_s', T = +window.NUDGE_TEST_MS || 0;
  let st;
  try { st = JSON.parse(localStorage.getItem(K) || '{}') || {}; localStorage.setItem(K, JSON.stringify(st)) } catch (e) { return }
  if ((st.n || 0) >= 3 || (st.at && Date.now() - st.at < 20 * 36e5)) return;
  try { if (sessionStorage.getItem(SS)) return; sessionStorage.setItem(SS, '1') } catch (e) { return }
  const save = () => { try { localStorage.setItem(K, JSON.stringify(st)) } catch (e) { } };

  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const can = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const signed = () => { try { const s = JSON.parse(localStorage.getItem('reviewer_session') || 'null'); return !!(s && s.access) } catch (e) { return false } };
  async function isOn() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try { const r = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration(); const s = r && r.pushManager && await r.pushManager.getSubscription(); if (!s) return false } catch (e) { return false }
    if (!signed()) return true;
    try { return localStorage.getItem('reviewer_att_alerts') === '1' } catch (e) { return false }
  }
  function mode() {
    if (ios && !standalone) return 'ios';
    if (!can) return null;
    return Notification.permission === 'denied' ? 'blocked' : 'on';
  }
  function busy() {
    // some pages keep closed dialogs in the layout and fade them out (.modal[hidden] with opacity/visibility): check what is really seen
    const seen = e => {
      if (e.closest('.altw') || e.closest('[hidden]')) return false;
      try { if (e.checkVisibility) return e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) } catch (x) { }
      const cs = getComputedStyle(e); return e.offsetParent !== null && cs.visibility !== 'hidden' && cs.opacity !== '0';
    };
    return Array.from(document.querySelectorAll('dialog[open], .modal.show, .modal.open, [aria-modal="true"], [role=dialog], [role=alertdialog]')).some(seen);
  }
  function load(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s) }) }
  let prep = null;
  function ready() {
    return prep || (prep = (async () => {
      if (!window.Notify) await load('notify-core.js');
      if (!window.Push) await load('push-client.js');
      if (signed() && typeof Auth === 'undefined') await load('auth.js');
      if (!Push.cloud) { const l = await (await fetch('courses.json')).json(); Push.init((l.find(x => x.cloud && x.cloud.url) || {}).cloud) }
    })());
  }

  const STEPS = {
    on: ['Tap <b>Turn on</b> below.', 'When your browser asks, choose <b>Allow</b>.', 'That\'s it. You can pick what you get anytime in Notifications.'],
    ios: ['In Safari, tap the <b>Share</b> button (the square with an arrow).', 'Choose <b>Add to Home Screen</b>.', 'Open the site from that new icon, then come back here to turn notifications on.'],
    blocked: ['Notifications are blocked for this site. Tap the <b>lock</b> or settings icon left of the address.', 'Open <b>Notifications</b> (or Site settings → Notifications) and choose <b>Allow</b>.', 'Reload the page, then turn them on in Notifications.']
  };
  function css() {
    const s = document.createElement('style');
    s.textContent =
      '.pnbg{position:fixed;inset:0;z-index:58;background:rgba(0,0,0,.28);display:flex;align-items:flex-end;justify-content:center;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}' +
      '@media (min-width:600px){.pnbg{align-items:center}}' +
      '.pnc{position:relative;width:100%;max-width:400px;box-sizing:border-box;background:var(--card,#fff);color:var(--text,#1d1b18);border:1px solid var(--border,rgba(0,0,0,.12));border-radius:18px;' +
      'padding:18px 18px 14px;box-shadow:0 18px 50px rgba(0,0,0,.25);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left}' +
      '.pnc .pnk{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;opacity:.6}' +
      '.pnc h2{margin:2px 0 6px;font-size:19px;line-height:1.25}.pnc .pnwhy{margin:0 0 10px;opacity:.85}' +
      '.pnc ol{margin:0 0 14px;padding-left:22px}.pnc li{margin:4px 0}' +
      '.pnc .pnb{display:flex;gap:8px;flex-wrap:wrap}.pnc .pnb button{font:inherit;font-weight:700;border:0;border-radius:11px;padding:9px 16px;cursor:pointer;background:rgba(127,127,127,.15);color:inherit}' +
      '.pnc .pnb button.pri{background:var(--accent,#4f46e5);color:#fff}.pnc .pnb button:disabled{opacity:.6;cursor:default}' +
      '.pnc .pnfoot{margin:10px 0 0;font-size:12.5px;opacity:.6}.pnc .pnmsg{margin:0 0 12px;font-weight:600}.pnc .pnmsg a{color:var(--accent,#4f46e5)}' +
      '.pnc .pnx{position:absolute;top:8px;right:8px;width:30px;height:30px;border:0;border-radius:9px;background:transparent;color:inherit;opacity:.6;font:17px/30px system-ui;cursor:pointer;padding:0}' +
      '.pnc .pnx:hover{opacity:1;background:rgba(127,127,127,.15)}' +
      '@media (prefers-reduced-motion:no-preference){.pnc{animation:pnin .25s ease-out}}@keyframes pnin{from{opacity:0;transform:translateY(14px)}}';
    document.head.appendChild(s);
  }
  function show(m) {
    st.n = (st.n || 0) + 1; st.at = Date.now(); save();
    css();
    const bg = document.createElement('div'); bg.className = 'pnbg';
    const c = document.createElement('div'); c.className = 'pnc'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-labelledby', 'pnt');
    bg.appendChild(c); document.body.appendChild(bg);
    const close = () => { bg.remove(); document.removeEventListener('keydown', esc) };
    const esc = e => { if (e.key === 'Escape') close() };
    document.addEventListener('keydown', esc);
    bg.addEventListener('click', e => { if (e.target === bg) close() });
    function draw(m, msg) {
      c.innerHTML = '<button type="button" class="pnx" aria-label="Close" title="Close">✕</button>' +
        '<div class="pnk">One-time setup</div><h2 id="pnt">Turn on notifications</h2>' +
        '<p class="pnwhy">So you see it when a classmate messages you, replies, or challenges you to a duel, even with the site closed.</p>' +
        (msg ? '<p class="pnmsg">' + msg + '</p>' : '') +
        '<ol>' + STEPS[m].map(s => '<li>' + s + '</li>').join('') + '</ol>' +
        '<div class="pnb">' + (m === 'on' ? '<button type="button" class="pri pnon">Turn on</button><button type="button" class="pnno">Not now</button>' : '<button type="button" class="pri pnno">Got it</button>') + '</div>' +
        '<p class="pnfoot">We\'ll only remind you a couple of times.</p>';
      c.querySelector('.pnx').addEventListener('click', close);
      c.querySelector('.pnno').addEventListener('click', close);
      const on = c.querySelector('.pnon');
      if (on) on.addEventListener('click', async () => {
        on.disabled = true; on.textContent = 'Turning on…';
        try {
          const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
          if (perm !== 'granted') throw new Error(perm === 'denied' ? 'blocked' : 'dismissed');
          await ready();
          if (signed() && typeof Auth !== 'undefined') await Push.attSet(true); else await Push.turnOn();
          st.n = 3; save();
          c.innerHTML = '<div class="pnk">One-time setup</div><h2 id="pnt">You\'re all set</h2><p class="pnwhy">This device will now get a heads-up for messages, replies and duels.</p>';
          setTimeout(close, T || 2000);
        } catch (e) {
          const k = e && e.message;
          if (k === 'dismissed') { close(); return }
          if (k === 'blocked' || Notification.permission === 'denied') { draw('blocked'); return }
          draw('on', 'Couldn\'t turn on. Try again from <a href="notifications.html">Notifications</a>.');
        }
      });
    }
    draw(m);
    if (m === 'on') ready().catch(() => { });
  }
  async function go(retry) {
    const m = mode(); if (!m) return;
    if (await isOn()) return;
    if (document.visibilityState !== 'visible' || busy() || !document.body) { if (retry) setTimeout(() => go(false), T || 20000); return }
    show(m);
  }
  setTimeout(() => go(true), T || 6000);
})();
