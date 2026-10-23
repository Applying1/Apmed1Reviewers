/* Push notifications (level 2). Works once the Supabase "push" Edge Function and supabase_push.sql are set up
   (see PUSH_SETUP.md); until then the Settings section just says it isn't set up yet.
   The function hands out its public key (GET ?key) and sends new updates.json items to subscribed devices. */
(function () {
  const P = {
    cloud: null, key: null,
    init(cloud) { P.cloud = cloud || null; },
    fn() { return P.cloud ? P.cloud.url.replace(/\/+$/, '') + '/functions/v1/push' : '' },
    hdr() { const h = { 'Content-Type': 'application/json', apikey: P.cloud.key }; if (/^eyJ/.test(P.cloud.key)) h.Authorization = 'Bearer ' + P.cloud.key; return h },
    rpc(name, body) { return fetch(P.cloud.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + name, { method: 'POST', headers: P.hdr(), body: JSON.stringify(body) }).then(r => { if (!r.ok) throw new Error(r.status); return r.text() }) },
    supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window },
    async reg() { return (await navigator.serviceWorker.getRegistration()) || navigator.serviceWorker.register('sw.js') },
    async getKey() {
      if (P.key) return P.key;
      if (!P.cloud) throw new Error('no cloud');
      const r = await fetch(P.fn() + '?key=1', { headers: P.hdr() });
      if (!r.ok) throw new Error('not set up');
      const j = await r.json(); if (!j.key) throw new Error('not set up'); return (P.key = j.key);
    },
    b64(s) { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)) },
    async sub() { const r = await P.reg(); await navigator.serviceWorker.ready; return r.pushManager.getSubscription() },
    prefs() { const o = Object.fromEntries(Object.keys(Notify.TYPES).map(k => [k, Notify.on(k)])); if (window.Remind) o.rem = Remind.prefs(); return o },
    async testRem() { const s = await P.sub(); if (!s) return; const r = await fetch(P.fn(), { method: 'POST', headers: P.hdr(), body: JSON.stringify({ testrem: s.endpoint }) }); if (!r.ok) throw new Error(r.status) },
    async turnOn() {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error(perm === 'denied' ? 'blocked' : 'dismissed');
      const r = await P.reg(); await navigator.serviceWorker.ready;
      const s = (await r.pushManager.getSubscription()) || await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: P.b64(await P.getKey()) });
      await P.rpc('push_subscribe', { p_sub: s.toJSON(), p_prefs: P.prefs() });
    },
    async turnOff() { const s = await P.sub(); if (s) { try { await P.rpc('push_unsubscribe', { p_endpoint: s.endpoint }) } catch (e) { } await s.unsubscribe() } },
    async test() { const s = await P.sub(); if (!s) return; const r = await fetch(P.fn(), { method: 'POST', headers: P.hdr(), body: JSON.stringify({ test: s.endpoint }) }); if (!r.ok) throw new Error(r.status) },
    // settings changed: keep this device's subscription in step
    async sync() { try { const s = P.supported() && await P.sub(); if (s) await P.rpc('push_subscribe', { p_sub: s.toJSON(), p_prefs: P.prefs() }) } catch (e) { } },
    async draw(el) {
      const ios = /iP(hone|ad|od)/.test(navigator.userAgent), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      const say = h => { el.innerHTML = h };
      if (!P.supported()) return say('<p class="pstat">' + (ios && !standalone ? 'On iPhone, first add this site to your <b>Home Screen</b> (Share → Add to Home Screen), open it from there, then come back here.' : 'This browser can\'t receive push notifications.') + '</p>');
      try { await P.getKey() } catch (e) { return say('<p class="pstat">Push notifications aren\'t set up on the site yet. Everything else on this page already works.</p>') }
      let s = null; try { s = await P.sub() } catch (e) { }
      const blocked = Notification.permission === 'denied';
      say('<p class="pstat">' + (s ? '<b class="ok">On</b> for this device. You\'ll get the types you turned on above, even when the site is closed.' : blocked ? 'Notifications are <b>blocked</b> for this site. Allow them in your browser\'s site settings (the icon left of the address), then try again.' : '<b>Off</b> for this device.') + '</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px">' + (s ? '<button class="btn" id="pbtest">Send a test</button><button class="btn" id="pboff">Turn off</button>' : '<button class="btn primary" id="pbon"' + (blocked ? ' disabled' : '') + '>Turn on notifications</button>') + '</div>');
      const busy = (b, t) => { b.disabled = true; b.textContent = t };
      if (el.querySelector('#pbon')) el.querySelector('#pbon').onclick = async e => { busy(e.target, 'Turning on…'); try { await P.turnOn() } catch (err) { if (err.message !== 'dismissed' && err.message !== 'blocked') window.tell && tell('Please try again in a moment.', { title: 'Could not turn on notifications' }) } P.draw(el) };
      if (el.querySelector('#pboff')) el.querySelector('#pboff').onclick = async e => { busy(e.target, 'Turning off…'); await P.turnOff(); P.draw(el) };
      if (el.querySelector('#pbtest')) el.querySelector('#pbtest').onclick = async e => { busy(e.target, 'Sending…'); try { await P.test(); e.target.textContent = 'Sent' } catch (err) { e.target.textContent = 'Could not send' } };
    },
  };
  window.Push = P;
  if (window.Notify) Notify.pushSync = () => P.sync();
})();
