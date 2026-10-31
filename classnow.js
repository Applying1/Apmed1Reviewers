/* Class goal + Studying now (Oct 31). Counts only: the cloud never learns who is studying, only how many.
   ClassNow.init(cloud, course)   course = the course id on a course page, '' on the home page
   ClassNow.ping(course)          after an answer or a card (the engine calls it; at most one a minute is sent)
   ClassNow.now()                 -> Promise {total, by: {course id: n}} for the last 3 minutes (cached 30 s)
   ClassNow.goal(list, test)      -> Promise {n, next, prev, since} answers the class sent for the test's course since a week before it
   Focus timer: ClassNow.focus(25) starts one (site-wide, 'reviewer_focus'), ClassNow.focus(0) stops it; while it runs, the
   device counts as studying and a small chip shows the time left on course pages. */
window.ClassNow = (function () {
  const DK = 'reviewer_dev', FK = 'reviewer_focus', mem = {};
  const ls = {
    // storage missing or full: keep the value in memory for this visit (memory wins over an older stored copy)
    get(k) { if (k in mem) return mem[k]; try { return localStorage.getItem(k) } catch (e) { return null } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); delete mem[k] } catch (e) { mem[k] = v == null ? null : v } }
  };
  let cloud = null, here = '', last = 0, lastC = '', nowP = null, nowAt = 0, goalP = null, goalAt = 0, timer = null, chip = null;
  const listeners = [];
  // a random id for this device (only its md5 is stored in the cloud)
  function dev() {
    let d = ls.get(DK);
    if (!d || !/^[A-Za-z0-9]{16,64}$/.test(d)) { d = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); ls.set(DK, d) }
    return d;
  }
  function rpc(fn, body) {
    if (!cloud || !cloud.url) return Promise.reject(new Error('no cloud'));
    const h = { 'Content-Type': 'application/json', apikey: cloud.key }; if (/^eyJ/.test(cloud.key)) h.Authorization = 'Bearer ' + cloud.key;
    return fetch(cloud.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h, body: JSON.stringify(body || {}) }).then(r => r.ok ? r.json().catch(() => null) : Promise.reject(new Error(r.status)));
  }
  function ping(course, force) {
    const t = Date.now(); if (!cloud || (!force && t - last < 60e3)) return; last = t; nowAt = 0;
    const c = course == null ? here : course; lastC = c || '';
    rpc('study_ping', { p_dev: dev(), p_course: /^[a-z0-9_]{2,40}$/.test(c || '') ? c : null }).catch(() => { });
  }
  function now() {
    if (nowP && Date.now() - nowAt < 30e3) return nowP;
    nowAt = Date.now();
    return nowP = rpc('study_count').then(rows => { const by = {}; let total = 0; (rows || []).forEach(r => { by[r.course] = (by[r.course] || 0) + r.n; total += r.n }); return { total, by, me: Date.now() - last < 180e3, here: lastC } }).catch(() => null);
  }
  // milestones the class climbs toward before a test
  const STEPS = [100, 250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 50000, 75000, 100000];
  const FIRST = '2026-10-31';
  const ymd = d => { const p = new Date(d.getTime() + 8 * 36e5); return p.toISOString().slice(0, 10) };     // Manila date
  function goal(list, test) {
    const c = (list || []).find(x => x.id === test.subj.course); if (!c || !c.storageKey) return Promise.resolve(null);
    if (!goalP || Date.now() - goalAt > 60e3) { goalAt = Date.now(); goalP = rpc('class_counts', { p_days: 14 }).catch(() => null) }
    const since = [ymd(new Date(test.from.getTime() - 7 * 864e5)), FIRST].sort()[1];     // counting began Oct 31, 2026

    return goalP.then(rows => {
      if (!rows) return null;
      const n = rows.filter(r => r.course === c.storageKey && r.day >= since).reduce((a, r) => a + r.n, 0);
      const next = STEPS.find(s => s > n) || Math.ceil((n + 1) / 50000) * 50000, i = STEPS.indexOf(next), prev = i > 0 ? STEPS[i - 1] : 0;
      return { n, next, prev, since, course: c };
    });
  }
  // focus timer
  function focusEnd() { try { return +(JSON.parse(ls.get(FK) || '{}').end) || 0 } catch (e) { return 0 } }
  function focus(min) {
    if (min > 0) { ls.set(FK, JSON.stringify({ end: Date.now() + min * 60e3, min })); ping(null, true) }
    else ls.set(FK, null);
    tick(); listeners.forEach(f => { try { f() } catch (e) { } });
  }
  function left() { return Math.max(0, focusEnd() - Date.now()) }
  const mmss = ms => { const s = Math.ceil(ms / 1e3); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') };
  function tick() {
    const end = focusEnd(), ms = end - Date.now();
    if (end && ms <= 0) { ls.set(FK, null); done(); listeners.forEach(f => { try { f(true) } catch (e) { } }) }
    else if (end) ping(null);
    drawChip();
    clearTimeout(timer); if (focusEnd()) timer = setTimeout(tick, 1000);
  }
  let doneUntil = 0;
  function done() { doneUntil = Date.now() + 8000; setTimeout(drawChip, 8100) }
  // the chip on course pages (the home page shows the timer in its Class card)
  function drawChip() {
    if (!here) return;
    const ms = left(), show = ms > 0 || Date.now() < doneUntil;
    if (!show) { if (chip) { chip.remove(); chip = null } return }
    if (!chip) {
      chip = document.createElement('button'); chip.type = 'button'; chip.className = 'cnchip';
      const st = document.createElement('style');
      st.textContent = '.cnchip{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:80;display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;border:1px solid var(--line2,#ddd);background:var(--surface,#fff);color:var(--text,#222);font:600 13px/1 system-ui,sans-serif;box-shadow:0 6px 18px #0002;cursor:pointer;font-variant-numeric:tabular-nums}' +
        'body.tabs .cnchip{bottom:calc(var(--tbh,0px) + 10px)}@media (max-width:900px){body:has(.sheetwrap .sheet) .cnchip{bottom:calc(var(--tbh,0px) + 64px)}}' +   // above the phone tab bar and the mock exam answer sheet
        '.cnchip i{width:8px;height:8px;border-radius:50%;background:#22a06b;box-shadow:0 0 0 3px #22a06b33}.cnchip.ask{border-color:var(--bad,#c0392b);color:var(--bad,#c0392b)}';
      document.head.appendChild(st);
      chip.addEventListener('click', () => {
        if (!left()) { doneUntil = 0; drawChip(); return }
        if (chip.classList.contains('ask')) { focus(0); return }
        chip.classList.add('ask'); drawChip(); setTimeout(() => { if (chip) { chip.classList.remove('ask'); drawChip() } }, 3000);
      });
      document.body.appendChild(chip);
    }
    const html = ms > 0 ? (chip.classList.contains('ask') ? 'Tap again to stop focus' : '<i></i>Focus · ' + mmss(ms) + ' left') : '25 minutes done. Nice work!';
    if (chip.innerHTML !== html) chip.innerHTML = html;
    chip.setAttribute('aria-label', ms > 0 ? 'Focus timer, ' + Math.ceil(ms / 60e3) + ' minutes left. Tap twice to stop.' : 'Focus done');
  }
  function init(c, course) {
    cloud = c && c.url ? c : null; here = course || '';
    tick();
    addEventListener('storage', e => { if (e.key === FK) { tick(); listeners.forEach(f => { try { f() } catch (x) { } }) } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick() });
  }
  return { init, ping, now, goal, focus, left, mmss, onFocus: f => listeners.push(f), STEPS };
})();
