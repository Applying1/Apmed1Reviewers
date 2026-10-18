// Offline support. Pages, code and course files are fetched fresh when online (so fixes show up right away)
// and served from the cache when offline. Fonts are cached after first use.
const CACHE = 'reviewers-v5';
const SHELL = ['./', 'index.html', 'reviewer.html', 'engine.js', 'courses.json', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png'];

// Saves every course (and its pictures) not saved yet, so courses added after someone's first visit also work offline.
async function cacheCourses(c, list) {
  for (const u of list.flatMap(x => ['courses/' + x.id + '.json', ...(x.assets || [])]))
    if (!(await c.match(u))) { try { await c.add(new Request(u, { cache: 'no-cache' })); } catch (err) { /* try again next visit */ } }
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    // Every course, so all of them work offline after the first visit.
    try {
      await cacheCourses(c, await (await fetch('courses.json')).json());
    } catch (err) { /* offline during install: courses get cached as they are opened */ }
  })());
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
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
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        // Always ask GitHub whether a file changed (a cheap check when it did not) instead of trusting the
        // 10-minute browser cache, so a page and its code are never from different versions.
        let res = await (nav ? fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' }));
        // Chrome refuses a page load answered with a response that was redirected along the way (ERR_FAILED),
        // which happens when an extension or network rewrites the link. Re-wrap it as a plain response.
        if (nav && res.redirected) res = new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
        if (res.ok && !url.search) c.put(req, res.clone());
        // On every online page visit, quietly save any course that is not stored yet.
        if (nav && res.ok) e.waitUntil(fetch('courses.json', { cache: 'no-cache' }).then(r => r.json()).then(list => cacheCourses(c, list)).catch(() => {}));
        return res;
      } catch (err) {
        // Offline or blocked: serve the saved copy. Links shared on Facebook/Messenger carry ?fbclid=...,
        // so match without the query; a page we never saved falls back to the home screen.
        const page = url.pathname.endsWith('reviewer.html') ? 'reviewer.html' : nav ? 'index.html' : null;
        return (await c.match(req, { ignoreSearch: true })) || (page && await c.match(page)) || Response.error();
      }
    })());
  } else if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
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
