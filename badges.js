/* Badges for study habits (Oct 31, Opus): the saved state, the rules and the awarding. The badge screen is Sonnet's
   (PLAN.md, "Badge screen"); until it ships, SHOW is false and badges are earned silently, so the whole class gets
   theirs (old progress counts too) the day the screen goes live.

   Saved site-wide in 'reviewer_badges' and synced with the courses' sync code (row "_badges"):
     {v:1, d:{<device>:{<counter>:n}},      counted events, one bucket per device so two phones add up instead of overwriting
          L:{<counter>:{<course>:n}},       levels a course reports (answers given, sections and lessons mastered), merged by max
          got:{<badge>:ms},                 earned badges (never taken away), merged by the earliest time
          seen:ms, off:1}                   last time the shelf was opened; off = no pop-ups (badges still count)
   Counters: answers, sections, lessons (levels from each course); fixes (a missed question answered right later), exams
   (mock exams finished), cards (flashcard reviews), focus (25-minute focus timers finished) (events); streak, words,
   sorts, perfect, crosswords, duels (read from the daily goal and the games' own saved progress).

   API: Badges.add(counter, n)          an event (engine, cards, focus timer)
        Badges.level(counter, course, n) a course's level for answers / sections / lessons
        Badges.check()                   re-read the games and the streak, award anything new
        Badges.list()                    [{id, name, icon, desc, need, have, got: ms|0, group}] for the screen
        Badges.onEarn(fn)                fn(badge) when one is earned (the screen shows its own pop-up)
        Badges.seen() / Badges.unseen()  mark the shelf opened / count earned since
        Badges.setOff(bool), Badges.isOff(), Badges.SHOW */
(function (g) {
  const KEY = 'reviewer_badges', DK = 'reviewer_dev', mem = {};
  const SHOW = true;   // the badge screen (badges.html) shipped Oct 31
  // [id, group, icon (emoji), name, what it takes, counter, need]
  const DEFS = [
    ['first10', 'Practice', '🌱', 'First steps', 'Answer 10 questions', 'answers', 10],
    ['ans500', 'Practice', '📚', 'Steady learner', 'Answer 500 questions', 'answers', 500],
    ['ans2000', 'Practice', '🧠', 'Question machine', 'Answer 2,000 questions', 'answers', 2000],
    ['ans5000', 'Practice', '🏔️', 'Summit', 'Answer 5,000 questions', 'answers', 5000],
    ['fix10', 'Mistakes', '🔁', 'Comeback', 'Get 10 missed questions right later', 'fixes', 10],
    ['fix100', 'Mistakes', '💪', 'Comeback kid', 'Get 100 missed questions right later', 'fixes', 100],
    ['fix500', 'Mistakes', '🦾', 'Unbreakable', 'Get 500 missed questions right later', 'fixes', 500],
    ['sec1', 'Mastery', '✅', 'Section cleared', 'Master every question in a section', 'sections', 1],
    ['sec10', 'Mastery', '🧩', 'Ten sections', 'Master 10 sections', 'sections', 10],
    ['les1', 'Mastery', '🎓', 'Lesson master', 'Master a whole lesson or chapter', 'lessons', 1],
    ['les5', 'Mastery', '🏅', 'Five lessons', 'Master 5 lessons or chapters', 'lessons', 5],
    ['exam1', 'Mastery', '📝', 'Dress rehearsal', 'Finish a mock exam', 'exams', 1],
    ['exam10', 'Mastery', '🗂️', 'Exam-ready', 'Finish 10 mock exams', 'exams', 10],
    ['streak3', 'Habits', '🔥', 'Warming up', 'Meet your daily goal 3 days in a row', 'streak', 3],
    ['streak7', 'Habits', '📅', 'One full week', 'Meet your daily goal 7 days in a row', 'streak', 7],
    ['streak30', 'Habits', '🌟', 'Habit formed', 'Meet your daily goal 30 days in a row', 'streak', 30],
    ['cards100', 'Habits', '🃏', 'Card shark', 'Review 100 flashcards', 'cards', 100],
    ['cards1000', 'Habits', '🎴', 'Spaced out', 'Review 1,000 flashcards', 'cards', 1000],
    ['focus1', 'Habits', '⏱️', 'In the zone', 'Finish a 25-minute focus', 'focus', 1],
    ['focus10', 'Habits', '🧘', 'Deep worker', 'Finish 10 focus sessions', 'focus', 10],
    ['word5', 'Games', '🔤', 'Wordsmith', "Solve APMed'le 5 times", 'words', 5],
    ['sort5', 'Games', '🗃️', 'Sorted', 'Finish Sort It 5 times', 'sorts', 5],
    ['perfect3', 'Games', '🎯', 'Perfect sort', 'Get 3 perfect Sort It days', 'perfect', 3],
    ['cw5', 'Games', '✏️', 'Puzzler', 'Solve 5 daily crosswords', 'crosswords', 5],
    ['duel1', 'Games', '⚔️', 'En garde', 'Finish a duel', 'duels', 1],
    ['duel10', 'Games', '🏆', 'Duelist', 'Finish 10 duels', 'duels', 10]];
  const EVENTS = ['fixes', 'exams', 'cards', 'focus'], LEVELS = ['answers', 'sections', 'lessons'];
  const ls = {
    get(k) { if (k in mem) return mem[k]; try { return localStorage.getItem(k) } catch (e) { return null } },
    set(k, v) { try { localStorage.setItem(k, v); delete mem[k] } catch (e) { mem[k] = v } }
  };
  const json = k => { try { return JSON.parse(ls.get(k)) || null } catch (e) { return null } };
  function dev() {   // the same device code as classnow.js
    let d = ls.get(DK);
    if (!d || !/^[A-Za-z0-9]{16,64}$/.test(d)) { d = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); ls.set(DK, d) }
    return d;
  }
  const clean = o => (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
  function load() { const s = clean(json(KEY)); return { v: 1, d: clean(s.d), L: clean(s.L), got: clean(s.got), seen: +s.seen || 0, off: s.off ? 1 : 0 } }
  let S = load();
  const save = () => { ls.set(KEY, JSON.stringify(S)); push() };

  // what the games and the daily goal have saved on this device (synced by their own pages)
  function external() {
    const days = o => Object.values(clean(o && o.g));
    const w = json('reviewer_apmeddle'), st = json('reviewer_sortit'), cw = json('reviewer_crossword'), du = json('reviewer_duels');
    let streak = 0;
    try { if (g.Daily && Daily.now) { const s = Daily.now(); streak = Math.max(s.best || 0, s.streak || 0) } } catch (e) { }
    return {
      streak, words: days(w).filter(x => x && x.w === 1).length,
      sorts: days(st).filter(x => x && x.d === 1).length, perfect: days(st).filter(x => x && x.d === 1 && x.c === 1).length,
      crosswords: days(cw).filter(x => x && x.done).length, duels: Object.values(clean(du)).filter(x => x && x.done).length
    };
  }
  function value(c, ext) {
    if (EVENTS.includes(c)) return Object.values(S.d).reduce((a, x) => a + (+clean(x)[c] || 0), 0);
    if (LEVELS.includes(c)) return Object.values(clean(S.L[c])).reduce((a, n) => a + (+n || 0), 0);
    return (ext || external())[c] || 0;
  }
  const listeners = [];
  function award() {
    const ext = external(), now = Date.now(), fresh = [];
    for (const [id, , , , , c, need] of DEFS) if (!S.got[id] && value(c, ext) >= need) { S.got[id] = now; fresh.push(id) }
    if (!fresh.length) return false;
    save();
    if (SHOW && !S.off) fresh.forEach(id => { const b = list().find(x => x.id === id); listeners.forEach(f => { try { f(b) } catch (e) { } }); if (!listeners.length) pop(b) });
    return true;
  }
  // the earned-badge card: one at a time (queued), 3.5 s, above the phone tab bar on course pages
  const queue = []; let showing = false;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function pop(b) {
    if (typeof document === 'undefined' || !document.body) return;
    queue.push(b); if (!showing) next();
  }
  // a soft chime made with Web Audio (no files); follows the Sounds switch in Settings (reviewer_quiz_mute) and stays quiet if the browser blocks audio
  let actx = null;
  function chime() {
    try {
      if (ls.get('reviewer_quiz_mute') === '1') return;
      const AC = g.AudioContext || g.webkitAudioContext; if (!AC) return;
      actx = actx || new AC(); if (actx.state === 'suspended') actx.resume().catch(() => { });
      const t0 = actx.currentTime + 0.02, out = actx.createGain(); out.gain.value = 0.16; out.connect(actx.destination);
      // a quick rising sparkle: E6 G6 C7, then a tiny high twinkle
      [[1318.5, 0, 0.42], [1568, 0.09, 0.42], [2093, 0.18, 0.7], [3136, 0.34, 0.5]].forEach(([f, at, len], i) => {
        const o = actx.createOscillator(), e = actx.createGain(); o.type = i === 3 ? 'triangle' : 'sine'; o.frequency.value = f;
        e.gain.setValueAtTime(0.0001, t0 + at); e.gain.exponentialRampToValueAtTime(i === 3 ? 0.35 : 1, t0 + at + 0.015); e.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
        o.connect(e); e.connect(out); o.start(t0 + at); o.stop(t0 + at + len + 0.05);
      });
    } catch (e) { }
  }
  function next() {
    const b = queue.shift(); if (!b) { showing = false; return }
    showing = true;
    if (!document.getElementById('bdpopcss')) {
      const st = document.createElement('style'); st.id = 'bdpopcss';
      st.textContent = '.bdpop{position:fixed;left:50%;bottom:calc(var(--tbh,0px) + 16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:95;display:flex;align-items:center;gap:12px;padding:10px 16px 10px 12px;border-radius:16px;background:var(--surface,#fff);color:var(--text,#222);border:1px solid var(--accent-line,#c7c3f3);box-shadow:0 10px 30px #0004;font:600 14px/1.3 system-ui,sans-serif;max-width:calc(100vw - 32px);overflow:hidden;animation:bdin .45s cubic-bezier(.2,1.3,.4,1)}'
        + '.bdpop .e{position:relative;font-size:30px;line-height:1;display:inline-block;animation:bdshake .7s .25s ease-in-out}.bdpop small{display:block;font-size:11.5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--accent,#4f46e5)}.bdpop a{display:block;margin-top:2px;font-size:12.5px;font-weight:600;color:var(--accent,#4f46e5)}'
        + '.bdpop::after{content:"";position:absolute;top:0;bottom:0;left:0;width:45%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.6),transparent);transform:translateX(-130%) skewX(-18deg);animation:bdshine .9s .35s ease-out forwards;pointer-events:none}'
        + '.bdpop .sp{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:1px;background:var(--accent,#4f46e5);opacity:0;transform:rotate(45deg);animation:bdsp .8s .3s ease-out forwards}'
        + '.bdpop .sp:nth-child(odd){background:#f5b82e}'
        + '@keyframes bdin{from{opacity:0;transform:translate(-50%,24px) scale(.85)}}'
        + '@keyframes bdshake{0%,100%{transform:rotate(0) scale(1)}15%{transform:rotate(-16deg) scale(1.25)}35%{transform:rotate(13deg) scale(1.2)}55%{transform:rotate(-8deg) scale(1.1)}75%{transform:rotate(4deg) scale(1.05)}}'
        + '@keyframes bdshine{to{transform:translateX(340%) skewX(-18deg)}}'
        + '@keyframes bdsp{0%{opacity:0;transform:translate(0,0) rotate(45deg) scale(.4)}25%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(225deg) scale(1.1)}}'
        + '@media (prefers-reduced-motion:reduce){.bdpop,.bdpop .e,.bdpop::after,.bdpop .sp{animation:none!important}.bdpop::after,.bdpop .sp{display:none}}';
      document.head.appendChild(st);
    }
    const t = document.createElement('div'); t.className = 'bdpop'; t.setAttribute('role', 'status');
    const sp = [[-20, -20], [24, -22], [-13, 22], [30, 12], [2, -26], [-22, 6]].map(([x, y]) => '<i class="sp" style="--dx:' + x + 'px;--dy:' + y + 'px;left:27px"></i>').join('');
    t.innerHTML = '<span class="e" aria-hidden="true">' + b.icon + '</span><span><small>New badge</small>' + esc(b.name) + '<a href="badges.html">See your badges</a></span>' + sp;
    document.body.appendChild(t); chime();
    setTimeout(() => { t.remove(); next() }, 3500);
  }
  function add(c, n) {
    if (!EVENTS.includes(c) || !(n > 0)) return;
    const d = dev(), b = S.d[d] = clean(S.d[d]); b[c] = (+b[c] || 0) + Math.floor(n);
    save(); award();
  }
  function level(c, course, n) {
    if (!LEVELS.includes(c) || !/^[a-z0-9_-]{1,40}$/.test(course || '') || !(n >= 0)) return;
    const o = S.L[c] = clean(S.L[c]); if ((+o[course] || 0) >= n) return;
    o[course] = Math.floor(n); save(); award();
  }
  function list() {
    const ext = external();
    return DEFS.map(([id, group, icon, name, desc, c, need]) => ({ id, group, icon, name, desc, need, have: Math.min(need, value(c, ext)), got: S.got[id] || 0 }));
  }

  // ---------- sync (the courses' sync code; one row "_badges"), like the games ----------
  function merge(r) {
    if (!r || r.v !== 1) return false;
    let any = false;
    for (const [d, b] of Object.entries(clean(r.d))) { const m = S.d[d] = clean(S.d[d]); for (const [c, n] of Object.entries(clean(b))) if ((+n || 0) > (+m[c] || 0)) { m[c] = +n; any = true } }
    for (const [c, o] of Object.entries(clean(r.L))) { const m = S.L[c] = clean(S.L[c]); for (const [k, n] of Object.entries(clean(o))) if ((+n || 0) > (+m[k] || 0)) { m[k] = +n; any = true } }
    for (const [id, t] of Object.entries(clean(r.got))) if (+t && (!S.got[id] || +t < S.got[id])) { S.got[id] = +t; any = true }
    if ((+r.seen || 0) > S.seen) { S.seen = +r.seen; any = true }
    if (r.off && !S.off) { S.off = 1; any = true }
    if (any) ls.set(KEY, JSON.stringify(S));
    return any;
  }
  const code = () => { const s = json('reviewer_sync'); return (s && s.code) || '' };
  const A = () => (typeof Auth !== 'undefined' ? Auth : null);   // auth.js declares a top-level const, not a window property
  const cloudOn = () => !!(A() && A().cloud && code());
  let pushT = 0, pulled = null;
  function pull() {
    if (!cloudOn()) return Promise.resolve(false);
    return pulled || (pulled = Promise.race([Auth.rpc('sync_get', { p_code: code(), p_course: '_badges' }), new Promise(r => setTimeout(() => r(null), 4000))])
      .then(rows => { const row = Array.isArray(rows) ? rows[0] : rows; return row && row.data ? merge(row.data) : false }).catch(() => false).finally(() => { pulled = null }));
  }
  function push() {
    clearTimeout(pushT); if (!cloudOn()) return;
    pushT = setTimeout(() => pull().then(() => Auth.rpc('sync_put', { p_code: code(), p_course: '_badges', p_data: S })).catch(() => { }), 4000);
  }
  function check() {
    if (A() && !A().cloud && g.CONFIG && CONFIG.cloud && CONFIG.cloud.url) A().cloud = CONFIG.cloud;   // course pages
    S = load(); return pull().then(() => award());
  }

  g.Badges = {
    SHOW, DEFS, add, level, check, list,
    onEarn: f => listeners.push(f),
    seen() { S.seen = Date.now(); save() },
    unseen() { return Object.values(S.got).filter(t => t > S.seen).length },
    isOff: () => !!S.off,
    setOff(v) { S.off = v ? 1 : 0; save() },
    _merge: merge, _state: () => S
  };
  if (typeof document !== 'undefined') {
    addEventListener('storage', e => { if (e.key === KEY) S = load() });
    setTimeout(() => { const on = cloudOn(); check(); if (!on) setTimeout(check, 5000) }, 1500);   // after the page has drawn (and Auth.cloud is set)
  }
})(typeof self !== 'undefined' ? self : this);
