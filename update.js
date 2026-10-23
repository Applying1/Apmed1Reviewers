/* "Update ready" banner. The offline worker (sw.js) opens pages from the saved copy and checks for a newer version in the
   background; when a file this page uses has changed, it tells the page, and this offers a reload. */
(function () {
  if (!('serviceWorker' in navigator) || window.top !== window) return;
  let shown = false;
  function used(path) {
    if (path === location.pathname) return true;
    try { return performance.getEntriesByType('resource').some(r => new URL(r.name).pathname === path); } catch (e) { return false; }
  }
  function show() {
    if (shown || !document.body) return;
    shown = true;
    const st = document.createElement('style');
    st.textContent = '.updbar{position:fixed;z-index:60;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;align-items:center;gap:10px;' +
      'max-width:calc(100vw - 24px);padding:9px 10px 9px 16px;border-radius:14px;background:var(--text,#1d1b18);color:var(--bg,#fff);' +
      'font:500 14px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)}' +
      '.updbar button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:7px 12px;background:var(--accent,#4f46e5);color:#fff;cursor:pointer}' +
      '.updbar button.later{background:transparent;color:inherit;opacity:.75;padding:7px 6px}body.tabs .updbar{bottom:calc(var(--tbh,58px) + 14px)}' +
      '@media (prefers-reduced-motion:no-preference){.updbar{animation:updin .25s ease-out}}@keyframes updin{from{opacity:0;transform:translate(-50%,10px)}}';
    document.head.appendChild(st);
    const b = document.createElement('div');
    b.className = 'updbar';
    b.setAttribute('role', 'status');
    b.innerHTML = '<span>Update ready</span><button type="button">Reload</button><button type="button" class="later">Later</button>';
    b.querySelector('button').onclick = () => { try { if (window.flushSave) window.flushSave(); } catch (e) { } location.reload(); };
    b.querySelector('.later').onclick = () => b.remove();
    document.body.appendChild(b);
  }
  navigator.serviceWorker.addEventListener('message', e => {
    const d = e.data;
    if (!d || d.type !== 'updated') return;
    let p;
    try { p = new URL(d.url, location.href).pathname; } catch (x) { return; }
    if (used(p)) show();
  });
  // a change found before this script was listening: ask once the page has loaded, and again a little later
  const since = Math.round(performance.timeOrigin || Date.now());
  const ask = () => { try { if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'changes?', since }); } catch (e) { } };
  if (document.readyState === 'complete') ask(); else addEventListener('load', ask);
  setTimeout(ask, 4000);
})();
