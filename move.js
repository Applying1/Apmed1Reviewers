/* Bring progress from the old address (applying1.github.io). Browsers keep saved data per address, so the old copy is
   read by a page on that address (repo Applying1/move) and arrives here as #import=<gzip, base64url>.
   Merge rules: a key missing here is copied; a course with more answers there replaces this one; daily counts take the
   larger number per day; anything else already here stays. */
(function () {
  const OLD = 'https://applying1.github.io/move/', DONE = 'reviewer_moved', UNTIL = '2027-01-01';
  const get = k => { try { return localStorage.getItem(k) } catch (e) { return null } };
  const set = (k, v) => { try { localStorage.setItem(k, v); return true } catch (e) { return false } };
  const obj = v => { try { const o = JSON.parse(v); return o && typeof o === 'object' ? o : null } catch (e) { return null } };
  const answers = o => (o && typeof o.correct === 'number' ? o.correct + (o.wrong || 0) : -1);
  async function unpack(s) {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')), u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return JSON.parse(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  }
  function merge(src) {
    let n = 0;
    for (const k in src) {
      const here = get(k), there = src[k];
      if (here === null) { if (set(k, there)) n++; continue }
      if (k === 'reviewer_daily') {
        const a = obj(here) || {}, b = obj(there) || {}; a.days = a.days || {};
        for (const d in b.days || {}) if ((b.days[d] || 0) > (a.days[d] || 0)) a.days[d] = b.days[d];
        a.best = Math.max(a.best || 0, b.best || 0); set(k, JSON.stringify(a)); n++; continue;
      }
      if (answers(obj(there)) > answers(obj(here))) { if (set(k, there)) n++ }
    }
    return n;
  }
  const M = {
    show: () => !get(DONE) && new Date() < new Date(UNTIL),
    go: () => { location.href = OLD },
    dismiss: () => set(DONE, 'no'),
    // call on page load; resolves to null (nothing to do), or {n} / {none} / {error}
    async take() {
      const m = location.hash.match(/(?:^#|&)import=([^&]*)/); if (!m) return null;
      history.replaceState(null, '', location.pathname + location.search);
      if (m[1] === 'none') return { none: true };
      try { const n = merge(await unpack(m[1])); set(DONE, 'yes'); return { n } } catch (e) { return { error: true } }
    }
  };
  window.Move = M;
})();
