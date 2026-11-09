/* Bookmarks for the transes reader: the last page + scroll spot and the pages a student starred, for every PDF.
   Saved site-wide in 'reviewer_marks' and synced with the courses' sync code (row "_marks"):
     {v:1, f:{"<pdf path>":{at:{p:1-based page, o:0..1 offset, t:ms}, s:{"<page>":ms}, x:{"<page>":ms}}}}
   s = starred, x = unstarred (kept so two devices can agree on the newest event).
   API: Marks.get(file) -> {at:{p,o,t}|null, stars:[pages ascending]}
        Marks.setAt(file,p,o)      save the reading spot (storage at most once a second)
        Marks.star(file,p,on)      star / unstar a page
        Marks.isStar(file,p)
        Marks.ready()              resolves after the first pull (4 s cap), or at once when not synced
        Marks.onChange(fn)         fn() when a pull merged something new */
(function (g) {
  const KEY = 'reviewer_marks', OLD = 'transes_at_', mem = {};
  const ls = {
    get(k) { if (k in mem) return mem[k]; try { return localStorage.getItem(k) } catch (e) { return null } },
    set(k, v) { try { localStorage.setItem(k, v); delete mem[k] } catch (e) { mem[k] = v } }
  };
  const json = k => { try { return JSON.parse(ls.get(k)) || null } catch (e) { return null } };
  const clean = o => (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
  const num = n => { n = +n; return isFinite(n) ? n : 0 };

  function load() {
    const s = clean(json(KEY)), out = { v: 1, f: {} };
    for (const [file, m] of Object.entries(clean(s.f))) {
      if (!m || typeof m !== 'object') continue;
      const at = m.at && num(m.at.p) > 0 ? {
        p: Math.max(1, Math.floor(num(m.at.p))), o: Math.min(1, Math.max(0, num(m.at.o))), t: num(m.at.t)
      } : null;
      const st = {}, xx = {};
      for (const [p, t] of Object.entries(clean(m.s))) { const pg = Math.floor(num(p)); if (pg > 0 && num(t)) st[pg] = num(t) }
      for (const [p, t] of Object.entries(clean(m.x))) { const pg = Math.floor(num(p)); if (pg > 0 && num(t)) xx[pg] = num(t) }
      for (const p of Object.keys(xx)) {   // one state per page: the newest event wins
        if (num(xx[p]) > num(st[p])) delete st[p]; else delete xx[p];
      }
      out.f[file] = { at, s: st, x: xx };
    }
    return out;
  }
  let S = load();

  const listeners = [];
  const notify = () => listeners.forEach(f => { try { f() } catch (e) { } });

  const touched = m => {
    let t = num(m.at && m.at.t);
    for (const k in clean(m.s)) t = Math.max(t, num(m.s[k]));
    for (const k in clean(m.x)) t = Math.max(t, num(m.x[k]));
    return t;
  };
  function prune(S) {
    const cut = Date.now() - 60 * 864e5;
    for (const file of Object.keys(S.f)) {
      const m = S.f[file];
      if (!m || typeof m !== 'object') { delete S.f[file]; continue }
      m.s = clean(m.s); m.x = clean(m.x);
      for (const p of Object.keys(m.x)) if (!(num(m.x[p]) > cut)) delete m.x[p];
      const keys = Object.keys(m.s);
      if (keys.length > 60) {
        const keep = new Set(keys.sort((a, b) => num(m.s[b]) - num(m.s[a])).slice(0, 60));
        for (const p of keys) if (!keep.has(p)) delete m.s[p];
      }
      if (!m.at && !Object.keys(m.s).length && !Object.keys(m.x).length) delete S.f[file];
    }
    const files = Object.keys(S.f);
    if (files.length > 80) {
      files.sort((a, b) => touched(S.f[b]) - touched(S.f[a]));
      for (const f of files.slice(80)) delete S.f[f];
    }
  }

  let lastWrite = 0, wtimer = 0;
  function saveNow() {
    lastWrite = Date.now();
    prune(S);
    ls.set(KEY, JSON.stringify(S));
  }
  function saveSoon() {   // at most once a second, trailing write kept
    if (wtimer) return;
    const wait = Math.max(0, 1000 - (Date.now() - lastWrite));
    if (!wait) { saveNow(); return }
    wtimer = setTimeout(() => { wtimer = 0; saveNow() }, wait);
  }
  function folder(file) {
    let m = S.f[file];
    if (!m || typeof m !== 'object') m = S.f[file] = { at: null, s: {}, x: {} };
    m.s = clean(m.s); m.x = clean(m.x);
    return m;
  }

  // ---------- sync (the courses' sync code; one row "_marks"), like badges.js ----------
  const code = () => { const s = json('reviewer_sync'); return (s && s.code) || '' };
  const A = () => (typeof Auth !== 'undefined' ? Auth : null);
  const cloudOn = () => !!(A() && A().cloud && code());
  let cloudP = null;
  function ensureCloud() {
    if (!A() || A().cloud) return Promise.resolve();
    if (g.CONFIG && CONFIG.cloud && CONFIG.cloud.url) { A().cloud = CONFIG.cloud; return Promise.resolve() }
    if (cloudP) return cloudP;
    cloudP = fetch('courses.json').then(r => r.json()).then(list => {
      const c = (list || []).find(x => x && x.cloud && x.cloud.url);
      if (c && A() && !A().cloud) A().cloud = c.cloud;
    }).catch(() => { });
    return cloudP;
  }

  function merge(r) {
    if (!r || r.v !== 1 || !r.f) return false;
    let any = false;
    for (const [file, rm] of Object.entries(clean(r.f))) {
      if (!rm || typeof rm !== 'object') continue;
      const m = folder(file);
      const ra = clean(rm.at);
      if (num(ra.p) > 0) {
        const t = num(ra.t), local = m.at ? num(m.at.t) : -1;
        if (!m.at || t > local) {
          m.at = { p: Math.max(1, Math.floor(num(ra.p))), o: Math.min(1, Math.max(0, num(ra.o))), t };
          any = true;
        }
      }
      const rs = clean(rm.s), rx = clean(rm.x);
      const pages = new Set([...Object.keys(m.s), ...Object.keys(m.x), ...Object.keys(rs), ...Object.keys(rx)]);
      for (const p of pages) {
        const evs = [
          { on: 1, t: num(rs[p]) }, { on: 0, t: num(rx[p]) },
          { on: 1, t: num(m.s[p]) }, { on: 0, t: num(m.x[p]) }
        ];
        let best = null;
        for (const e of evs) if (e.t && (!best || e.t > best.t)) best = e;
        if (!best) continue;
        const curS = num(m.s[p]), curX = num(m.x[p]);
        const cur = curS >= curX ? { on: 1, t: curS } : { on: 0, t: curX };
        if (best.t > cur.t || (best.t === cur.t && best.on !== cur.on)) {
          if (best.on) { m.s[p] = best.t; delete m.x[p] } else { m.x[p] = best.t; delete m.s[p] }
          any = true;
        }
      }
    }
    if (any) saveNow();
    return any;
  }

  // key-order-free comparison (the server stores jsonb, which reorders keys)
  const canon = v => v && typeof v === 'object' ? (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
    : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}') : JSON.stringify(v);
  let pulled = null, ahead = false;   // ahead: this device has something the cloud row lacks (e.g. a push lost at page close)
  function pull() {
    if (!cloudOn()) return Promise.resolve(false);
    return pulled || (pulled = Promise.race([
      A().rpc('sync_get', { p_code: code(), p_course: '_marks' }),
      new Promise(r => setTimeout(() => r(undefined), 4000))
    ]).then(rows => {
      if (rows === undefined) return false;   // timed out: don't guess
      const row = Array.isArray(rows) ? rows[0] : rows;
      const got = row && row.data ? merge(row.data) : false;
      prune(S);
      ahead = Object.keys(S.f).length > 0 && (!row || !row.data || canon(clean(row.data.f)) !== canon(S.f));
      if (got) notify();
      return got;
    }).catch(() => false).finally(() => { pulled = null }));
  }

  let pushT = 0;
  function pushNow() {
    if (!cloudOn()) return Promise.resolve(false);
    return pull().then(() => A().rpc('sync_put', { p_code: code(), p_course: '_marks', p_data: S })).catch(() => false);
  }
  function pushSoon() {
    clearTimeout(pushT);
    if (!code()) return;
    pushT = setTimeout(() => {
      pushT = 0;
      ensureCloud().then(() => { if (cloudOn()) pushNow() });
    }, 8000);
  }

  let readyP = null;
  function ready() {
    if (readyP) return readyP;
    if (!code()) return Promise.resolve();   // not signed in for sync: nothing to pull
    readyP = Promise.race([ensureCloud(), new Promise(r => setTimeout(r, 1000))])
      .then(() => cloudOn() ? pull() : false).then(() => { if (ahead && cloudOn()) pushSoon() }).catch(() => { });
    return readyP;
  }

  function get(file) {
    const m = S.f[file];
    let at = m && m.at ? { p: m.at.p, o: m.at.o, t: m.at.t } : null;
    if (!at) {   // the old per-file key (a page number only)
      let old = 0; try { old = +localStorage.getItem(OLD + file) || 0 } catch (e) { }
      if (old > 1) at = { p: Math.floor(old), o: 0, t: 0 };
    }
    const stars = m ? Object.keys(clean(m.s)).map(n => Math.floor(num(n))).filter(n => n > 0).sort((a, b) => a - b) : [];
    return { at, stars };
  }
  function setAt(file, p, o) {
    if (!file) return;
    p = Math.floor(num(p)); if (p < 1) return;
    folder(file).at = { p, o: Math.min(1, Math.max(0, num(o))), t: Date.now() };
    saveSoon();
    pushSoon();
  }
  function star(file, p, on) {
    if (!file) return;
    p = Math.floor(num(p)); if (p < 1) return;
    const m = folder(file), now = Date.now();
    if (on) { m.s[p] = now; delete m.x[p] } else { m.x[p] = now; delete m.s[p] }
    saveNow();
    pushSoon();
  }
  const isStar = (file, p) => !!(S.f[file] && clean(S.f[file].s)[Math.floor(num(p))]);

  g.Marks = {
    get, setAt, star, isStar, ready,
    onChange: fn => listeners.push(fn),
    _merge: merge, _state: () => S, _flush: saveNow
  };

  if (typeof document !== 'undefined') {
    addEventListener('storage', e => {
      if (e.key === KEY) { S = load(); notify() }
    });
    addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return;
      if (wtimer) { clearTimeout(wtimer); wtimer = 0; saveNow() }
      if (pushT) { clearTimeout(pushT); pushT = 0; pushNow() }
    });
  }
})(typeof self !== 'undefined' ? self : this);
