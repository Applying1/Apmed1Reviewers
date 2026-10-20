/* Notifications shared by the home page, notifications.html and the reviewer engine.
   Feed: updates.json [{id, date, type, course?, title, text, link?}], newest id highest.
   Settings (localStorage 'reviewer_notify'): {types:{course,content,transes,schedule,feature}, pop, dpop, ddot}; missing = on.
   Read state ('reviewer_notify_read'): {last} = highest feed id the person has caught up to. */
(function () {
  const PK = 'reviewer_notify', RK = 'reviewer_notify_read';
  const TYPES = {
    course: ['New courses', 'A course is added to the site'],
    content: ['New questions and notes', 'New chapters, questions, notes or drills in a course'],
    transes: ['Transes and slides', 'New transes or slides to read'],
    schedule: ['Timetable changes', 'Cancelled, moved or added classes and exams'],
    feature: ['Site updates', 'New features and fixes'],
  };
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d } catch (e) { return d } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } };
  let feed = null, loading = null;
  const N = {
    TYPES,
    prefs() { const p = get(PK, {}); p.types = p.types || {}; return p },
    setPref(path, v) { const p = N.prefs(); if (path.startsWith('types.')) p.types[path.slice(6)] = v; else p[path] = v; put(PK, p); N.pushSync && N.pushSync(); return p },
    on(type) { return N.prefs().types[type] !== false },
    load(base) {
      if (feed) return Promise.resolve(feed);
      return loading || (loading = fetch((base || '') + 'updates.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).catch(() => []).then(f => (feed = (Array.isArray(f) ? f : []).sort((a, b) => b.id - a.id))));
    },
    shown(f) { return (f || feed || []).filter(u => N.on(u.type)) },
    readUpTo() { return get(RK, {}).last || 0 },
    unread(f) { const r = N.readUpTo(); return N.shown(f).filter(u => u.id > r).length },
    markRead(f) { const top = Math.max(0, ...(f || feed || []).map(u => u.id)); put(RK, Object.assign(get(RK, {}), { last: top })); },
    // in-course pop-ups: 'reviewer_notify_read'.popped = highest id already shown as a pop-up
    popped() { return get(RK, {}).popped },
    setPopped(id) { put(RK, Object.assign(get(RK, {}), { popped: id })) },
    esc: s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    when(d) {
      const t = new Date(d + 'T12:00:00'), days = Math.round((Date.now() - t) / 864e5);
      return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? days + ' days ago' : t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    },
  };
  window.Notify = N;
})();
