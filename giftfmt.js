// Gift exchange: turns a wishlist (plain text typed by a student) into tidy, safe HTML. Used by gifts.html and giftadmin.html.
// Everything is escaped first; only http(s) links become <a>. Lines starting with -, *, a bullet or "1." become list items.
const GiftFmt = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
  function link(raw) {
    let u = raw, tail = '';
    const m = u.match(/[.,;:!?)\]]+$/);           // punctuation right after a link is not part of it
    if (m) { tail = m[0]; u = u.slice(0, -tail.length); }
    let url;
    try { url = new URL(/^www\./i.test(u) ? 'https://' + u : u); } catch (e) { return esc(raw); }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return esc(raw);
    const host = url.hostname.replace(/^www\./i, ''), more = (url.pathname + url.search).length > 1;
    return '<a class="wlink" href="' + esc(url.href) + '" target="_blank" rel="noopener noreferrer nofollow" title="' + esc(url.href) + '">' +
      esc(host) + (more ? '/…' : '') + '</a>' + esc(tail);
  }
  const inline = s => String(s).split(URL_RE).map((part, i) => i % 2 ? link(part) : esc(part)).join('');
  function html(w) {
    const out = []; let items = [];
    const flush = () => { if (items.length) { out.push('<ul>' + items.map(x => '<li>' + x + '</li>').join('') + '</ul>'); items = []; } };
    for (const line of String(w || '').split(/\r?\n/)) {
      const t = line.trim();
      if (!t) { flush(); continue; }
      const b = t.match(/^(?:[-*•–—]|\d{1,2}[.)])\s+(.+)$/);
      if (b) items.push(inline(b[1])); else { flush(); out.push('<p>' + inline(t) + '</p>'); }
    }
    flush();
    return out.join('');
  }
  return { html, MAX: 1000 };
})();
