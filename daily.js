/* Daily practice across every course: answers per day, the daily goal and the streak, and what is due for review.
   Shared by the home page, the courses (engine) and the service worker (which only uses Daily.compose).
   localStorage 'reviewer_daily' = {days: {'YYYY-MM-DD': answers}, goal, best}. Each course's '<storageKey>_summary' also
   carries {id, title, due: [times its mastered questions come due]} (written by the engine).
   The daily review push: the server only knows the time each device picked. When the push arrives, the service worker
   reads a copy of this data (Cache Storage 'reviewer-meta', daily-digest.json, written here) and says what is actually
   due, so nobody's progress leaves their device. */
(function (g) {
  const KEY = 'reviewer_daily', META = 'reviewer-meta', DIGEST = 'daily-digest.json';
  const GOALS = [10, 20, 30, 50, 100], DEF_GOAL = 20;
  const ymd = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
  const back = (n, now) => { const d = new Date(now); d.setDate(d.getDate() - n); return ymd(d) };

  // streak = days in a row the goal was met; today counts once it is met, until then the streak runs up to yesterday
  function stats(o, now = Date.now()) {
    const days = o.days || {}, goal = GOALS.includes(o.goal) ? o.goal : DEF_GOAL, n = k => days[k] || 0, met = i => n(back(i, now)) >= goal;
    let streak = 0, i = met(0) ? 0 : 1;
    while (met(i) && i < 400) { streak++; i++ }
    const week = [];
    for (let j = 6; j >= 0; j--) { const k = back(j, now); week.push({ day: k, n: n(k), met: n(k) >= goal, today: j === 0 }) }
    const today = n(ymd(now));
    return { today, goal, streak, best: Math.max(o.best || 0, streak), met: today >= goal, week, active: Object.keys(days).length > 0, atRisk: !met(0) && streak > 0 };
  }
  const dueNow = (courses, now) => (courses || []).map(c => ({ id: c.id, title: c.title || c.id, n: (c.due || []).filter(t => t <= now).length }))
    .filter(c => c.n > 0).sort((a, b) => b.n - a.n);

  // Text of the daily review notification. digest = what the pages saved (or null), d = the push payload from the server
  // ({title, body, url, test?: "Pharmacology quiz in 2 days", testCourse?}). Returns {title, body, url}.
  function compose(digest, d, now = Date.now()) {
    d = d || {};
    const base = d.base || '';
    if (!digest) return { title: d.title || 'Time for your daily review', body: d.body || (d.test ? d.test + '. ' : '') + 'Open a course to see what is due today.', url: d.url || base };
    const s = stats(digest, now), due = dueNow(digest.courses, now), total = due.reduce((a, c) => a + c.n, 0);
    const short = t => String(t).replace(/^(Intro to|Introduction to) /, '').replace(/ in the Modern World$/, '');
    const parts = [];
    if (due.length) parts.push(due.slice(0, 3).map(c => short(c.title) + ' ' + c.n).join(' · ') + (due.length > 3 ? ' · +' + (due.length - 3) + ' more' : ''));
    if (d.test) parts.push(d.test);
    if (s.streak > 0 && !s.met) parts.push('Keep your ' + s.streak + '-day streak going');
    else if (s.met) parts.push(s.today + ' answered today' + (s.streak > 1 ? ' · ' + s.streak + '-day streak' : ''));
    else parts.push('Goal: ' + s.goal + ' questions today');
    const title = total ? total + (total === 1 ? ' review' : ' reviews') + ' due today'
      : s.met ? 'Today\'s goal is done' : s.today ? s.today + ' of ' + s.goal + ' today' : 'Time for your daily review';
    // open the course with the most due (straight into its reviews), else the course with the next test, else home
    const top = due[0] ? due[0].id : d.testCourse;
    const url = top ? base + 'reviewer.html?course=' + encodeURIComponent(top) + (due[0] ? '#due' : '') : (d.url || base);
    return { title, body: parts.join('. ').replace(/\.\./g, '.'), url };
  }

  const D = { GOALS, KEY, stats, compose, dueNow, META, DIGEST };
  g.Daily = D;
  if (typeof localStorage === 'undefined') return;    // service worker: compose() is all it needs

  const get = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch (e) { return {} } };
  const put = o => { try { localStorage.setItem(KEY, JSON.stringify(o)) } catch (e) { } };
  D.data = () => { const o = get(); o.days = o.days || {}; o.goal = GOALS.includes(o.goal) ? o.goal : DEF_GOAL; return o };
  D.now = () => stats(D.data());
  // one more answer (or n): returns the stats at the moment the daily goal is reached, else null
  D.add = (n = 1) => {
    const o = D.data(), k = ymd(Date.now()), was = o.days[k] || 0;
    o.days[k] = was + n;
    const keys = Object.keys(o.days).sort(); while (keys.length > 70) delete o.days[keys.shift()];
    const s = stats(o); o.best = s.best; put(o); D.digestSoon();
    return was < o.goal && o.days[k] >= o.goal ? s : null;
  };
  D.setGoal = n => { const o = D.data(); if (GOALS.includes(n)) o.goal = n; put(o); D.digestSoon(); return stats(o) };
  // course summaries on this device that know their id (written by the engine since v71)
  D.courses = () => {
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!/_summary$/.test(k)) continue; const s = JSON.parse(localStorage.getItem(k)); if (s && s.id) out.push(s) } } catch (e) { }
    return out;
  };
  D.due = (now = Date.now()) => dueNow(D.courses(), now);
  // the copy the service worker reads when the daily push arrives
  D.digest = () => {
    if (!g.caches || !/^https?:$/.test(location.protocol)) return Promise.resolve(false);
    const o = D.data(), body = JSON.stringify({ at: Date.now(), goal: o.goal, best: o.best || 0, days: o.days, courses: D.courses().map(s => ({ id: s.id, title: s.title || s.id, due: (s.due || []).slice(0, 400) })) });
    return caches.open(META).then(c => c.put(new URL(DIGEST, location.href).href, new Response(body, { headers: { 'Content-Type': 'application/json' } }))).then(() => true).catch(() => false);
  };
  D.digestSoon = () => { clearTimeout(D.t); D.t = setTimeout(D.digest, 1200) };
  // daily review reminder settings travel with the push subscription: Notify prefs .daily = {on, hour}
  D.HOURS = [[7, '7 AM'], [12, '12 noon'], [17, '5 PM'], [19, '7 PM'], [21, '9 PM']];
  D.rem = () => { const p = g.Notify ? Notify.prefs() : {}; return Object.assign({ on: false, hour: 19 }, p.daily || {}) };
  D.setRem = ch => { if (!g.Notify) return; const p = Notify.prefs(); p.daily = Object.assign(D.rem(), ch); try { localStorage.setItem('reviewer_notify', JSON.stringify(p)) } catch (e) { } clearTimeout(D.rt); D.rt = setTimeout(() => Notify.pushSync && Notify.pushSync(), 600); return p.daily };
})(typeof self !== 'undefined' ? self : this);
