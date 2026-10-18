// Timetable data helpers shared by schedule.html and the home page.
// schedule.json: classes = the standard week; weeks.<n> = topics, cancellations, make-up classes and notes for week n.
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const Sched = {
  data: null,
  async load() {
    if (!this.data) this.data = await (await fetch('schedule.json')).json();
    return this.data;
  },
  dayStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; },
  // Monday of the week containing d
  monday(d) { const x = this.dayStart(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; },
  weekNo(d) {
    const w1 = new Date(this.data.week1 + 'T00:00');
    return Math.floor(Math.round((this.monday(d) - w1) / 864e5) / 7) + 1;
  },
  weekStart(n) { const x = new Date(this.data.week1 + 'T00:00'); x.setDate(x.getDate() + (n - 1) * 7); return x; },
  // The week to show by default: this week, or next week on a Sunday (the week is over).
  defaultWeek(now = new Date()) { return this.weekNo(now) + (now.getDay() === 0 ? 1 : 0); },
  mins(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; },
  // Classes of week n with their dates and that week's topic; cancelled ones are kept but marked.
  classes(n) {
    const d = this.data, w = (d.weeks || {})[n] || {}, start = this.weekStart(n);
    const list = d.classes.map(c => Object.assign({}, c, { topic: (w.topics || {})[c.id] || '', cancelled: (w.cancel || []).includes(c.id) }))
      .concat((w.extra || []).map((c, i) => Object.assign({ id: 'extra-' + i, extra: true }, c)));
    for (const c of list) {
      const di = DAYS.indexOf(c.day), at = new Date(start);
      at.setDate(at.getDate() + di);
      c.di = di; c.date = at;
      c.from = new Date(+at + this.mins(c.start) * 6e4); c.to = new Date(+at + this.mins(c.end) * 6e4);
      c.subj = d.subjects[c.subject] || { name: c.subject, hue: 260 };
    }
    return list.sort((a, b) => a.from - b.from);
  },
  notes(n) { return (((this.data.weeks || {})[n] || {}).notes) || []; },
  // The class going on now, or the next one (looks up to two weeks ahead).
  upNext(now = new Date()) {
    const n = this.weekNo(now);
    for (const k of [n, n + 1, n + 2])
      for (const c of this.classes(k)) if (!c.cancelled && c.to > now) return Object.assign(c, { now: c.from <= now });
    return null;
  },
  time(t) { let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + ap; },
  // "7:00–10:00 AM", or "10:00 AM–1:00 PM" when it crosses noon
  span(c) {
    const a = this.time(c.start), b = this.time(c.end);
    return a.slice(-2) === b.slice(-2) ? a.slice(0, -3) + '–' + b : a + '–' + b;
  },
  date(d) { return MONTHS[d.getMonth()] + ' ' + d.getDate(); },
  // "Today", "Tomorrow", "Friday" (this week) or "Mon, Oct 26"
  when(d, now = new Date()) {
    const days = Math.round((this.dayStart(d) - this.dayStart(now)) / 864e5);
    return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days < 7 ? DAY_NAMES[(d.getDay() + 6) % 7] : DAYS[(d.getDay() + 6) % 7] + ', ' + this.date(d);
  },
};
