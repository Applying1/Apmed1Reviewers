// Offline support and fast opening.
// Pages, code and course files: a saved copy from the last 6 hours opens at once and is checked against the network in
// the background; when something changed, the open page shows an "Update ready · Reload" banner (update.js). An older
// saved copy waits up to 1.5 s for the network first, so someone coming back after a while gets the newest version when
// the connection allows. Without a connection, the saved copy is used. Pictures show the saved copy first and refresh in
// the background. Fonts are cached after first use; transes PDFs only once opened.
const CACHE = 'reviewers-v21';
const FRESH = 6 * 3600e3, WAIT = 1500;
const SHELL = ['./', 'index.html', 'reviewer.html', 'engine.js', 'courses.json', 'manifest.webmanifest',
  'schedule.html', 'schedule-core.js', 'schedule.json', 'transes.html', 'discuss.html', 'auth.js', 'profile.js', 'dialog.js', 'live.js', 'ui.css', 'icons.svg', 'reminders-core.js', 'notifications.html', 'notify-core.js', 'push-client.js', 'privacy.html', 'update.js',
  'daily.js', 'move.js', 'quiz.html', 'sfx.js', 'slides.html', 'crossword.html', 'crossword/puzzles.json', 'apmeddle.html', 'apmeddle/days.json', 'attendance.html', 'classday.html', 'classnotes.js',
  'icons/icon-192.png', 'icons/icon-512.png'];

// A saved copy remembers when it was saved (x-saved-at), so its age can be checked.
async function stamp(res) {
  const h = new Headers(res.headers);
  h.set('x-saved-at', String(Date.now()));
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: h });
}
async function save(c, url) {
  try { const res = await fetch(new Request(url, { cache: 'no-cache' })); if (res.ok) await c.put(url, await stamp(res)); } catch (err) { /* next visit */ }
}

// Saves every course (and its pictures) not saved yet, so courses added after someone's first visit also work offline.
async function cacheCourses(c, list) {
  for (const u of list.flatMap(x => [...(x.soon ? [] : ['courses/' + x.id + '.json']), ...(x.assets || [])]))
    if (!(await c.match(u))) await save(c, u);
}

// Pages are saved without their query (every reviewer.html?course=… is the same page); files keep theirs.
function keyFor(url, nav) {
  const u = new URL(url);
  if (nav || /(\.html|\/)$/.test(u.pathname)) u.search = '';
  return u.href;
}

// Tell the open pages that a file changed, so they can offer a reload. A page that starts listening a little later asks
// (update.js sends 'changes?') and gets the changes of the last two minutes.
const CHANGED = new Map();
async function tell(url) {
  for (const w of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) w.postMessage({ type: 'updated', url });
}
// An open page asks now and then ({type:'check', paths}) whether its own files changed: each saved copy is compared with
// a fresh download (a unique address, so GitHub's servers can't answer with the copy they still hold for a few minutes
// after an update). A change is saved and the page is told, which shows the "Update ready" banner.
async function check(paths) {
  const c = await caches.open(CACHE);
  for (const p of paths.slice(0, 12)) {
    try {
      const u = new URL(p, self.registration.scope);
      if (u.origin !== location.origin) continue;
      const key = keyFor(u.href, false), old = await c.match(key);
      if (!old) continue;
      // "changed since this version?" (its ETag): unchanged files answer 304 with no body, so a check costs almost nothing
      const et = old.headers.get('etag'), res = await fetch(u.href + (u.search ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store', headers: et ? { 'If-None-Match': et } : {} });
      if (res.status === 304 || !res.ok) continue;
      const fresh = await stamp(res);
      const changed = (await old.text()) !== (await fresh.clone().text());
      await c.put(key, fresh);
      if (changed) { CHANGED.set(u.href, Date.now()); await tell(u.href); }
    } catch (err) { /* offline: next time */ }
  }
}
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'check' && Array.isArray(e.data.paths)) { e.waitUntil(check(e.data.paths)); return; }
  if (!e.data || e.data.type !== 'changes?' || !e.source) return;
  const since = +e.data.since || 0;      // when that page started loading: older changes are already in it
  for (const [url, at] of CHANGED) if (at > since && Date.now() - at < 120000) e.source.postMessage({ type: 'updated', url });
});

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => save(c, u)));
    // Every course, so all of them work offline after the first visit.
    try {
      await cacheCourses(c, await (await fetch('courses.json')).json());
    } catch (err) { /* offline during install: courses get cached as they are opened */ }
  })());
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== 'reviewer-meta') await caches.delete(k);   // reviewer-meta: daily.js's digest
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    const nav = req.mode === 'navigate';
    // Facebook/Messenger add tracking tags (?fbclid=…). Send the page to the clean address first.
    if (nav && [...url.searchParams.keys()].some(k => /^(fbclid|mibextid|igshid|utm_\w+)$/.test(k))) {
      for (const k of [...url.searchParams.keys()]) if (/^(fbclid|mibextid|igshid|utm_\w+)$/.test(k)) url.searchParams.delete(k);
      e.respondWith(Response.redirect(url.href, 302));
      return;
    }
    // The daily crossword and APMed'dle files gain new days: ask the network first (up to 4 s), else the saved copy.
    if (url.pathname.endsWith('/crossword/puzzles.json') || url.pathname.endsWith('/apmeddle/days.json')) {
      e.respondWith((async () => {
        const c = await caches.open(CACHE), key = keyFor(req.url, false);
        const net = fetch(req, { cache: 'no-cache' }).then(async res => { if (res.ok) await c.put(key, await stamp(res.clone())); return res; });
        const hit = await c.match(key);
        if (!hit) return net;
        const res = await Promise.race([net.catch(() => null), new Promise(r => setTimeout(() => r(null), 4000))]);
        if (res && res.ok) return res;
        e.waitUntil(net.catch(() => {}));
        return hit;
      })());
      return;
    }
    // Pictures rarely change: show the saved copy at once and refresh it in the background.
    if (/\.(jpe?g|png|webp|svg)$/i.test(url.pathname) && !url.search) {
      e.respondWith((async () => {
        const c = await caches.open(CACHE), hit = await c.match(req);
        const net = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) c.put(req, res.clone()); return res; });
        if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
        return net;
      })());
      return;
    }
    e.respondWith((async () => {
      const c = await caches.open(CACHE), key = keyFor(req.url, nav), hit = await c.match(key), old = hit ? hit.clone() : null;
      let served = false;   // true once the saved copy was handed to the page (its body can then be read only once: compare with old)
      const net = (async () => {
        let res = await (nav ? fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' }));
        // Chrome refuses a page load answered with a response that was redirected along the way (ERR_FAILED),
        // which happens when an extension or network rewrites the link. Re-wrap it as a plain response.
        if (nav && res.redirected) res = new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
        if (res.ok) {
          const fresh = await stamp(res.clone());
          const changed = !!old && (await old.text()) !== (await fresh.clone().text());
          await c.put(key, fresh);
          if (changed && served) { CHANGED.set(req.url, Date.now()); await tell(req.url); }
        }
        // On every online page visit, quietly save any course that is not stored yet.
        if (nav && res.ok) e.waitUntil(fetch('courses.json', { cache: 'no-cache' }).then(r => r.json()).then(list => cacheCourses(c, list)).catch(() => {}));
        return res;
      })();
      if (hit) {
        const recent = Date.now() - (+hit.headers.get('x-saved-at') || 0) < FRESH;
        const res = recent ? null : await Promise.race([net.catch(() => null), new Promise(r => setTimeout(() => r(null), WAIT))]);
        if (res && res.ok) return res;
        served = true;
        e.waitUntil(net.catch(() => {}));
        return hit;
      }
      try {
        return await net;
      } catch (err) {
        // Offline or blocked and nothing saved under this address: a page falls back to the saved reviewer page or the
        // home screen. A file (like a PDF) never gets a page in its place.
        const isPage = /(\/|\.html)$/.test(url.pathname);
        const page = url.pathname.endsWith('reviewer.html') ? 'reviewer.html' : nav && isPage ? 'index.html' : null;
        return (await c.match(req, { ignoreSearch: true })) || (page && await c.match(page)) || Response.error();
      }
    })());
  } else if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || (url.hostname === 'cdnjs.cloudflare.com' && url.pathname.startsWith('/ajax/libs/pdf.js/'))) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    })());
  }
});

// Push notifications (see push-client.js and PUSH_SETUP.md): {title, body, url, tag}.
// A daily review reminder ({daily: true, ...}) is written here from this device's own saved progress (daily.js).
try { importScripts('daily.js'); } catch (err) { /* offline on first install: daily pushes use the server's text */ }
async function dailyNote(d) {
  let digest = null;
  try { const c = await caches.open('reviewer-meta'), r = await c.match(new URL('daily-digest.json', self.registration.scope).href); if (r) digest = await r.json(); } catch (err) { }
  try { return self.Daily ? Object.assign({}, d, Daily.compose(digest, Object.assign({ base: self.registration.scope }, d))) : d; } catch (err) { return d; }
}
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    if (d.daily) d = await dailyNote(d);
    await self.registration.showNotification(d.title || "APMed '33 Reviewers", {
      body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || undefined,
      data: { url: d.url || 'notifications.html' }
    });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 'notifications.html', self.registration.scope).href;
  e.waitUntil((async () => {
    for (const w of await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      if (w.url === url && 'focus' in w) return w.focus();
    return self.clients.openWindow(url);
  })());
});
