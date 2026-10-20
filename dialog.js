/* In-page dialogs for the site pages (the reviewer engine has its own): ask() resolves true/false, tell() just informs,
   copyBox() shows text to copy when the browser blocks the clipboard. Uses each page's color tokens. */
(function () {
  const css = '#askbox{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.45)}#askbox[hidden]{display:none}' +
    '#askbox .ab{width:min(420px,100%);background:var(--surface);color:var(--text);border:1px solid var(--line2);border-radius:18px;padding:22px 22px 18px;box-shadow:0 20px 50px #0004}' +
    '#askbox h2{margin:0 0 8px;font:600 19px/1.3 var(--serif,Georgia,serif)}#askbox p{margin:0 0 18px;color:var(--mute);font-size:14.5px;line-height:1.5}' +
    '#askbox .ar{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}#askbox .ab .btn.danger{color:var(--bad);border-color:var(--bad)}' +
    '#askbox textarea{width:100%;box-sizing:border-box;margin:0 0 16px;resize:none;padding:8px 10px;border-radius:10px;border:1px solid var(--line2);background:var(--bg);color:var(--text);font:13px/1.4 ui-monospace,Consolas,monospace}';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  window.ask = function (text, o) {
    o = o || {};
    return new Promise(res => {
      if (!document.getElementById('askcss')) { const st = document.createElement('style'); st.id = 'askcss'; st.textContent = css; document.head.appendChild(st) }
      let m = document.getElementById('askbox');
      if (!m) { m = document.createElement('div'); m.id = 'askbox'; m.hidden = true; document.body.appendChild(m) }
      m.innerHTML = '<div class="ab" role="' + (o.alert ? 'dialog' : 'alertdialog') + '" aria-modal="true">' + (o.title ? '<h2>' + esc(o.title) + '</h2>' : '') + (text ? '<p>' + esc(text) + '</p>' : '') +
        (o.copy != null ? '<textarea readonly rows="3" aria-label="Text to copy">' + esc(o.copy) + '</textarea>' : '') +
        '<div class="ar">' + (o.alert ? '' : '<button class="btn" data-v="0">' + esc(o.no || 'Cancel') + '</button>') +
        '<button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-v="1">' + esc(o.ok || 'OK') + '</button></div></div>';
      const prev = document.activeElement; m.hidden = false;
      const done = v => { m.hidden = true; document.removeEventListener('keydown', key, true); try { prev && prev.focus && prev.focus() } catch (e) { } res(v) };
      const key = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false) }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const a = document.activeElement; done(!(a && a.dataset && a.dataset.v === '0')) }
        else if (e.key === 'Tab') { const b = [...m.querySelectorAll('button,textarea')], i = b.indexOf(document.activeElement); e.preventDefault(); b[(i + (e.shiftKey ? b.length - 1 : 1)) % b.length].focus() }
      };
      document.addEventListener('keydown', key, true);
      m.onclick = e => { if (e.target === m) done(false); const v = e.target.closest && e.target.closest('[data-v]'); if (v) done(v.dataset.v === '1') };
      setTimeout(() => { const t = m.querySelector('textarea'); if (t) { t.focus(); t.select() } else m.querySelector(o.danger && !o.alert ? '[data-v="0"]' : '[data-v="1"]').focus() }, 0);
    });
  };
  window.tell = (text, o) => window.ask(text, Object.assign({ alert: 1 }, o || {}));
  window.copyBox = text => window.tell('Your browser blocked copying. Select the text below and copy it.', { title: 'Copy this', copy: text, ok: 'Done' });
})();
