/* Class-day summaries (supabase_attendance2.sql): the owner types them on classday.html in a light format, quick to type on a
   phone during class, and My attendance shows them:
     ## Pharmacology          a subject
     - a point                a bullet (two spaces before the dash = a sub-point)
     Due: Oct 31 · lab report a deadline (highlighted)
     Exam: ch 5 only          an exam or quiz hint (highlighted)
     ! will come out          something the teacher stressed
     **word**                 bold
   Anything else is a plain line. Everything is escaped first: no HTML from the notes reaches the page. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const CSS = '.cn{font-size:14.5px;line-height:1.55}.cn h3{font:600 15px/1.3 var(--sans);margin:14px 0 6px;color:var(--accent)}.cn h3:first-child{margin-top:0}' +
    '.cn ul{margin:4px 0 8px;padding-left:20px}.cn li{margin:2px 0}.cn ul ul{margin:2px 0}.cn p{margin:4px 0}' +
    '.cn .cnx{display:flex;gap:8px;align-items:baseline;margin:5px 0;padding:6px 10px;border-radius:10px;font-size:14px}' +
    '.cn .cnx i{flex:none;font:700 11px/1.6 var(--sans);letter-spacing:.04em;text-transform:uppercase;font-style:normal;padding:0 7px;border-radius:99px}' +
    '.cn .due{background:color-mix(in srgb,var(--warn) 12%,transparent)}.cn .due i{background:var(--warn);color:var(--surface)}' +
    '.cn .exam{background:var(--accent-soft)}.cn .exam i{background:var(--accent);color:var(--accent-ink)}' +
    '.cn .must{background:color-mix(in srgb,var(--bad) 9%,transparent)}.cn .must i{background:var(--bad);color:var(--surface)}';
  function html(text) {
    const out = [], open = [];                       // one entry per open <ul>: is its last <li> still open?
    const close = to => { while (open.length > to) { if (open.pop()) out.push('</li>'); out.push('</ul>') } };
    for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) { close(0); continue }
      let m;
      if ((m = line.match(/^\s*#{1,3}\s+(.+)$/))) { close(0); out.push('<h3>' + inline(m[1]) + '</h3>'); continue }
      if ((m = line.match(/^(\s*)[-*•]\s+(.+)$/))) {
        const lvl = m[1].replace(/\t/g, '  ').length >= 2 ? 2 : 1;
        close(lvl);
        if (open.length === lvl && open[lvl - 1]) { out.push('</li>'); open[lvl - 1] = false }
        while (open.length < lvl) { out.push('<ul>'); open.push(false) }
        out.push('<li>' + inline(m[2])); open[lvl - 1] = true; continue
      }
      close(0);
      if ((m = line.match(/^\s*(due|deadline)\s*:\s*(.+)$/i))) { out.push('<div class="cnx due"><i>Due</i><span>' + inline(m[2]) + '</span></div>'); continue }
      if ((m = line.match(/^\s*(exam|quiz|evals?)\s*:\s*(.+)$/i))) { out.push('<div class="cnx exam"><i>' + esc(m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) + '</i><span>' + inline(m[2]) + '</span></div>'); continue }
      if ((m = line.match(/^\s*!+\s*(.+)$/))) { out.push('<div class="cnx must"><i>Key</i><span>' + inline(m[1]) + '</span></div>'); continue }
      out.push('<p>' + inline(line) + '</p>');
    }
    close(0);
    return '<div class="cn">' + out.join('') + '</div>';
  }
  function style() { if (document.getElementById('cn-css')) return; const s = document.createElement('style'); s.id = 'cn-css'; s.textContent = CSS; document.head.appendChild(s) }
  window.ClassNotes = { html, style, esc };
})();
