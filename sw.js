// Offline support. Pages, code and course files are fetched fresh when online (so fixes show up right away)
// and served from the cache when offline. Fonts are cached after first use.
const CACHE = 'reviewers-v1';
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
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch (err) {
        // reviewer.html?course=x is cached once as reviewer.html, so ignore the query for it.
        return (await c.match(req, { ignoreSearch: url.pathname.endsWith('reviewer.html') }))
          || (req.mode === 'navigate' && await c.match('index.html')) || Response.error();
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
