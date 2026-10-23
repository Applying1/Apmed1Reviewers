/* Exam reminders: which classes on the timetable are exams, evals or quizzes, and this device's reminder settings.
   Settings live in the notification settings (localStorage 'reviewer_notify').rem and travel with the push subscription;
   the "push" Edge Function sends the reminders (same rules, Philippine time). Needs notify-core.js and schedule-core.js. */
(function () {
  const DEF = { on: true, days: [1], hour: 19, kinds: ['exam', 'evals', 'quiz'], off: [] };
  let timer = null;
  const R = {
    DEF,
    KINDS: { exam: 'Exams', evals: 'Evals', quiz: 'Quizzes' },
    DAYS: [[7, '1 week before'], [3, '3 days before'], [2, '2 days before'], [1, 'The day before'], [0, 'Morning of (6 AM)']],
    HOURS: [[6, '6 AM'], [12, '12 noon'], [17, '5 PM'], [19, '7 PM'], [21, '9 PM']],
    // not set yet: on (1 day before, 7 PM), unless timetable news is switched off
    prefs() { const p = Notify.prefs(); return Object.assign({}, DEF, { on: p.types.schedule !== false }, p.rem || {}) },
    set(changes) {
      const r = Object.assign(R.prefs(), changes), p = Notify.prefs(); p.rem = r;
      try { localStorage.setItem('reviewer_notify', JSON.stringify(p)) } catch (e) { }
      clearTimeout(timer); timer = setTimeout(() => Notify.pushSync && Notify.pushSync(), 800);   // one sync after a burst of taps
      return r;
    },
    kind(t) {
      if (!t || /review/i.test(t)) return null;
      if (/\bevals?\b|\bevaluation\b/i.test(t)) return 'evals';
      if (/\bquiz(zes)?\b/i.test(t)) return 'quiz';
      if (/\b(exams?|prelims?|midterms?|prefinals?|finals?|comprehensive|practical|defen[cs]e)\b/i.test(t)) return 'exam';
      return null;
    },
    label(t) { return t.split(' · ').find(x => R.kind(x)) || t },
    // assessments from this week on, for `weeks` weeks (Sched must be loaded)
    list(weeks = 4, now = new Date()) {
      const out = [], n0 = Sched.weekNo(now);
      for (let n = n0; n < n0 + weeks; n++)
        for (const c of Sched.classes(n)) {
          if (c.cancelled || c.from <= now) continue;
          const t = c.extra ? [c.kind, c.topic].filter(Boolean).join(' ') : c.topic, k = R.kind(t);
          if (k) out.push(Object.assign(c, { kind: k, label: R.label(t) }));
        }
      return out;
    },
    wants(r, a) { return r.on && r.kinds.includes(a.kind) && !r.off.includes(a.subject) },
    // when this device would be reminded about a (only times still ahead and before the class)
    moments(r, a, now = new Date()) {
      return r.days.map(d => { const x = new Date(a.date); x.setDate(x.getDate() - d); x.setHours(d === 0 ? 6 : r.hour, 0, 0, 0); return x })
        .filter(x => x > now && x < a.from).sort((p, q) => p - q);
    },
  };
  window.Remind = R;
})();
