// Offline support. Pages, code and course files are fetched fresh when online (so fixes show up right away)
// and served from the cache when offline. Fonts are cached after first use.
const CACHE = 'reviewers-v4';
const SHELL = ['./', 'index.html', 'reviewer.html', 'engine.js', 'courses.json', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    // Every course, so all of them work offline after the first visit.
    try {
      const list = await (await fetch('courses.json')).json();
      await c.addAll(list.flatMap(x => ['courses/' + x.id + '.json', ...(x.assets || [])]));
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
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const nav = req.mode === 'navigate';
      try {
        // Always ask GitHub whether a file changed (a cheap check when it did not) instead of trusting the
        // 10-minute browser cache, so a page and its code are never from different versions.
        const res = await (nav ? fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' }));
        if (res.ok && !url.search) c.put(req, res.clone());
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
