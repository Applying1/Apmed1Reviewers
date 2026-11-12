/* Shared helpers of the newer games (blitz.html, clues.html, thread.html): Manila dates, a saved state that survives
   missing or full storage, streaks, the course list and next test, sharing, and sync through the courses' sync code.
   Needs schedule-core.js, reminders-core.js and auth.js loaded before it.

   A daily game saves {v:1, how, g:{<date>:{..., d:1 when finished, t1 finished at, k moves made, u changed at}}}. */
window.Kit = (function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = (n, s) => '<svg class="i" width="' + (s || 16) + '" height="' + (s || 16) + '" aria-hidden="true"><use href="icons.svg#i-' + n + '"/></svg>';
  function manila(d) { d = d || new Date(); try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) } catch (e) { return d.toISOString().slice(0, 10) } }
  function shift(day, n) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
  const niceDate = day => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const TODAY = manila();
  const short = t => String(t).replace(/^(Intro to|Introduction to|General) /, '').replace(/ in the Modern World$/, '');
  function toast(t, ms) { const e = $('toast'); if (!e) return; e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), ms || 2000) }
  function fx(type, detail) { try { document.dispatchEvent(new CustomEvent('fx:' + type, { detail: detail || {} })) } catch (e) { } }
  // the same "random" order for everyone on a day
  function rng(seedText) { let s = [...String(seedText)].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 11); return () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296 }
  function shuffle(a, rnd) { rnd = rnd || Math.random; a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
  // how the builders hide an answer index (tools/make_clues.py, make_thread.py)
  const key = (date, i) => { const d = date.replace(/-/g, '').split('').map(Number); return d[i % d.length] * 3 + i };
  const unkey = (v, date, i, n) => ((v - key(date, i)) % n + n * 99) % n;

  // ---- saved state ----
  function open(k) { let s = null; try { s = JSON.parse(localStorage.getItem(k)) } catch (e) { } return s && s.v === 1 && s.g && typeof s.g === 'object' ? s : { v: 1, g: {} } }
  function save(k, S) { const cut = shift(TODAY, -400); for (const d in S.g) if (/^\d{4}-/.test(d) && d < cut) delete S.g[d]; try { localStorage.setItem(k, JSON.stringify(S)) } catch (e) { } }
  const done = S => Object.keys(S.g).filter(d => S.g[d] && S.g[d].d === 1).sort();
  function streak(S) { const w = new Set(done(S)); let d = w.has(TODAY) ? TODAY : shift(TODAY, -1), n = 0; while (w.has(d)) { n++; d = shift(d, -1) } return n }
  function best(S) { let b = 0, run = 0, prev = ''; for (const d of done(S)) { run = prev && shift(prev, 1) === d ? run + 1 : 1; b = Math.max(b, run); prev = d } return b }

  // ---- courses and the next test ----
  let CR = null;
  async function courses() { if (CR) return CR; try { CR = (await (await fetch('courses.json')).json()).filter(c => !c.soon); const cl = CR.find(c => c.cloud && c.cloud.url); if (cl && typeof Auth !== 'undefined') Auth.cloud = cl.cloud } catch (e) { CR = [] } return CR }
  const course = id => (CR || []).find(c => c.id === id) || { id, title: id };
  async function tests() { try { await Sched.load(); return Remind.list(14).filter(a => a.subj && a.subj.course) } catch (e) { return [] } }
  function chips(cid, test) {
    const c = course(cid);
    return '<span class="chip">' + (c.image ? '<img src="' + esc(c.image) + '" alt="">' : '') + esc(short(c.title)) + '</span>' +
      (test ? '<span class="chip mute">' + esc(test.label || 'Test') + ' ' + esc(/^(Today|Tomorrow)$/.test(Sched.when(test.date)) ? Sched.when(test.date).toLowerCase() : 'on ' + Sched.when(test.date)) + '</span>' : '');
  }

  // ---- sharing ----
  function share(text) {
    const t = text + '\n' + location.origin + location.pathname;
    if (navigator.share) navigator.share({ text: t }).catch(() => { });
    else (navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copied. Paste it in the group chat.'), () => toast('Could not copy here.'));
  }
  let chatP = null;
  function loadChat() {
    if (window.ShareChat) return Promise.resolve(); if (chatP) return chatP;
    const add = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => ok(); s.onerror = () => no(new Error(src)); document.head.appendChild(s) });
    return chatP = add('sharechat.js').then(() => { chatP = null }, e => { chatP = null; throw e });
  }
  function send(game, id, text, label) { loadChat().then(() => ShareChat.open({ body: '[game:' + game + ':' + id + ']\n' + text, label: label, preview: text.split('\n')[0] })).catch(() => { }) }
  function countdown(el, word) {
    if (!el) return; const s = Math.max(0, Math.round((new Date(shift(TODAY, 1) + 'T00:00:00+08:00') - new Date()) / 1000));
    if (!s) { location.reload(); return }
    el.textContent = 'Next ' + word + ' in ' + Math.floor(s / 3600) + 'h ' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + 'm';
    clearTimeout(countdown.t); countdown.t = setTimeout(() => countdown(el, word), 30000);
  }

  // ---- sync between devices: one row per game in the courses' sync table ----
  // Daily games: per day a finished game beats an unfinished one (the earlier finish when both are), then more moves, then the newer.
  function better(a, b) {
    if (!a) return b; if (!b) return a; if (!!a.d !== !!b.d) return a.d ? a : b; if (a.d) return (a.t1 || 0) <= (b.t1 || 0) ? a : b;
    if ((a.k || 0) !== (b.k || 0)) return (a.k || 0) > (b.k || 0) ? a : b; return (b.u || 0) > (a.u || 0) ? b : a;
  }
  function mergeDays(S, r) {
    let any = false, cur = false; if (!r || r.v !== 1 || !r.g || typeof r.g !== 'object') return { any, cur };
    for (const d in r.g) { const a = S.g[d], b = r.g[d]; if (!b || typeof b !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue; if (better(a, b) !== a) { S.g[d] = b; any = true; if (d === TODAY) cur = true } }
    if (r.how && !S.how) { S.how = 1; any = true }
    return { any, cur };
  }
  const syncCode = () => { try { return (JSON.parse(localStorage.getItem('reviewer_sync')) || {}).code || '' } catch (e) { return '' } };
  // sync(row, {data: () => what to upload, merge: remote => {any, cur}, changed: m => redraw})
  function sync(row, o) {
    const on = () => typeof Auth !== 'undefined' && !!(Auth.cloud && syncCode());
    let pushT = 0, pulling = null;
    function pull() {
      if (!on()) return Promise.resolve(null); if (pulling) return pulling;
      pulling = Promise.race([Auth.rpc('sync_get', { p_code: syncCode(), p_course: row }), new Promise(r => setTimeout(() => r(null), 3000))])
        .then(rows => { const x = Array.isArray(rows) ? rows[0] : rows; return x && x.data ? o.merge(x.data) : null }).catch(() => null).finally(() => { pulling = null });
      return pulling;
    }
    function push(now) {
      clearTimeout(pushT); if (!on()) return;
      const go = () => pull().then(m => { if (m && o.changed) o.changed(m); return Auth.rpc('sync_put', { p_code: syncCode(), p_course: row, p_data: o.data() }) }).catch(() => { });
      if (now) go(); else pushT = setTimeout(go, 3000);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) push(true); else pull().then(m => { if (m && o.changed) o.changed(m) }) });
    return { pull, push };
  }
  // small dialogs: <div class="dlg" id="x" hidden>
  function show(id) { const d = $(id); d.hidden = false; const b = d.querySelector('.btn'); if (b) b.focus() }
  function hide(id) { $(id).hidden = true }

  return { $, esc, ic, manila, shift, niceDate, TODAY, short, toast, fx, rng, shuffle, key, unkey, open, save, done, streak, best, courses, course, tests, chips, share, send, countdown, mergeDays, sync, show, hide };
})();
