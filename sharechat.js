/* Send something to a classmate's DMs. Usage: ShareChat.open({body, label, preview}).
   The bottom sheet lists recent conversations first, then the rest of the linked class. */
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var STYLES = '.shc-wrap{position:fixed;inset:0;z-index:130;display:flex;align-items:flex-end;justify-content:center;font-family:var(--sans,system-ui);color:var(--text,#111)}' +
    '.shc-wrap,.shc-wrap *{box-sizing:border-box}' +
    '.shc-wrap [hidden]{display:none!important}' +
    '.shc-back{position:absolute;inset:0;background:rgba(0,0,0,.45)}' +
    '.shc-sheet{position:relative;display:flex;flex-direction:column;width:100%;max-width:460px;max-height:75vh;max-height:75dvh;background:var(--surface,#fff);color:var(--text,#111);border:1px solid var(--line2,var(--line,#ddd));border-bottom:0;border-radius:18px 18px 0 0;box-shadow:0 -12px 42px rgba(0,0,0,.28);overflow:hidden;overscroll-behavior:contain;animation:shcUp .18s ease-out}' +
    '@keyframes shcUp{from{opacity:.55;transform:translateY(18px)}to{opacity:1;transform:none}}' +
    '.shc-head{display:flex;align-items:center;gap:10px;flex:none;padding:14px 14px 10px 18px;border-bottom:1px solid var(--line,#e5e5e5)}' +
    '.shc-head h2{margin:0;flex:1;min-width:0;font:700 18px/1.25 var(--sans,system-ui);letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.shc-x{flex:none;width:34px;height:34px;border:0;border-radius:50%;background:transparent;color:var(--mute,#666);font-size:23px;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0}' +
    '.shc-x:hover{background:var(--raised,#f0f0f0);color:var(--text,#111)}' +
    '.shc-meta{flex:none;padding:10px 18px 0}' +
    '.shc-label{font-size:13.5px;font-weight:700;color:var(--text,#111);overflow-wrap:anywhere}' +
    '.shc-prev{margin-top:3px;font-size:13px;line-height:1.35;color:var(--mute,#666);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.shc-search{flex:none;padding:10px 14px 6px}' +
    '.shc-search input{width:100%;padding:9px 12px;border-radius:11px;border:1px solid var(--line2,var(--line,#ddd));background:var(--raised,#f4f4f4);color:var(--text,#111);font:15px var(--sans,system-ui);outline:0}' +
    '.shc-search input:focus{border-color:var(--accent,#4f46e5);background:var(--surface,#fff)}' +
    '.shc-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:4px 10px 10px}' +
    '.shc-sec{font:700 11px/1 var(--sans,system-ui);letter-spacing:.5px;text-transform:uppercase;color:var(--faint,#999);padding:10px 8px 3px}' +
    '.shc-row{display:flex;align-items:center;gap:11px;width:100%;min-height:52px;padding:8px 10px;border:1px solid transparent;border-radius:12px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}' +
    '.shc-row:hover{background:var(--raised,#f0f0f0);border-color:var(--line,#e5e5e5)}' +
    '.shc-row[aria-selected="true"]{background:var(--accent-soft,#eef0ff);border-color:var(--accent,#4f46e5);box-shadow:0 1px 3px #0000000a}' +
    '.shc-row:focus-visible{outline:2px solid var(--accent,#4f46e5);outline-offset:1px}' +
    '.shc-av{flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px}' +
    '.shc-init{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--accent-soft,#eef0ff);color:var(--text,#111);font-weight:700}' +
    '.shc-w{flex:1;min-width:0}' +
    '.shc-name{display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.shc-sub{display:block;font-size:12.5px;color:var(--mute,#666);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.shc-pick{flex:none;width:20px;height:20px;border-radius:50%;border:1.5px solid var(--line2,var(--line,#ddd));display:grid;place-items:center;font-size:12px;font-weight:800;color:var(--accent-ink,#fff)}' +
    '.shc-row[aria-selected="true"] .shc-pick{background:var(--accent,#4f46e5);border-color:var(--accent,#4f46e5)}' +
    '.shc-empty{color:var(--faint,#999);font-size:14px;text-align:center;padding:24px 12px}' +
    '.shc-signinbox{padding:18px 6px 10px;text-align:center}' +
    '.shc-signinbox p{margin:0 0 12px;color:var(--mute,#666);font-size:14px;line-height:1.4}' +
    '.shc-signin{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--accent,#4f46e5);border-radius:11px;padding:9px 16px;background:var(--accent,#4f46e5);color:var(--accent-ink,#fff);font:600 14px var(--sans,system-ui);cursor:pointer}' +
    '.shc-compose{flex:none;display:flex;align-items:center;gap:8px;padding:10px 14px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--line,#e5e5e5);background:var(--surface,#fff)}' +
    '.shc-msg{flex:1;min-width:0;height:40px;max-height:80px;resize:none;padding:9px 11px;border-radius:11px;border:1px solid var(--line2,var(--line,#ddd));background:var(--raised,#f4f4f4);color:var(--text,#111);font:14.5px/1.35 var(--sans,system-ui);outline:0}' +
    '.shc-msg:focus{border-color:var(--accent,#4f46e5);background:var(--surface,#fff)}' +
    '.shc-send{flex:none;border:0;border-radius:11px;padding:0 16px;height:40px;background:var(--accent,#4f46e5);color:var(--accent-ink,#fff);font:700 14px var(--sans,system-ui);cursor:pointer}' +
    '.shc-send:disabled{opacity:.45;cursor:default}' +
    '.shc-err{flex:none;margin:0;padding:0 14px 8px;color:var(--bad,#c0392b);font-size:13px}' +
    '.shc-done{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;font-size:14px;font-weight:700}' +
    '.shc-open{color:var(--accent,#4f46e5);font-size:13.5px;font-weight:700;text-decoration:none;white-space:nowrap}' +
    '.shc-open:hover{text-decoration:underline}' +
    '@media (prefers-reduced-motion:reduce){.shc-sheet{animation:none}}';

  var S = { wrap: null, body: '', label: '', preview: '', token: '', people: [], picked: null, sending: false, sent: false, onKey: null };

  function css() {
    if (document.getElementById('shc-css')) return;
    var st = document.createElement('style');
    st.id = 'shc-css';
    st.textContent = STYLES;
    document.head.appendChild(st);
  }

  function ensureProfile() {
    if (window.Profile) return Promise.resolve();
    if (ensureProfile.p) return ensureProfile.p;
    ensureProfile.p = new Promise(function (resolve) {
      var done = false;
      var finish = function () { if (!done) { done = true; resolve(); } };
      var s = document.createElement('script');
      s.src = 'profile.js';
      s.async = true;
      s.onload = finish;
      s.onerror = finish;
      document.head.appendChild(s);
      setTimeout(finish, 3000);
    });
    return ensureProfile.p;
  }

  function formatName(name) {
    var s = String(name == null ? '' : name).trim();
    if (s.indexOf(',') >= 0) {
      var parts = s.split(',').map(function (p) { return p.trim(); });
      if (parts.length >= 2) s = parts.slice(1).join(' ') + ' ' + parts[0];
    }
    if (s && s === s.toUpperCase()) {
      s = s.toLowerCase().replace(/(?:^|\s|-)\S/g, function (c) { return c.toUpperCase(); });
    }
    return s;
  }

  function firstName(name) {
    var s = formatName(name);
    return s ? s.split(/\s+/)[0] : '';
  }

  function avatarHtml(p) {
    if (window.Profile) return Profile.html({ av: p.av || 'g', url: p.url || '', name: p.name || 'Classmate' }, 36);
    return '<span class="shc-init" aria-hidden="true">' + esc((String(p.name || '?').trim().charAt(0) || '?').toUpperCase()) + '</span>';
  }

  var GAME_NAME = { crossword: 'Crossword', apmeddle: "APMed'le", sortit: 'Sort It', duel: 'Duel' };

  function cleanPreview(txt) {
    var b = String(txt == null ? '' : txt).replace(/^\[reply:[^\]]+\]\s*/, '');
    var nl = b.indexOf('\n'), first = nl < 0 ? b : b.slice(0, nl), rest = nl < 0 ? '' : b.slice(nl + 1);
    var gm = first.match(/^\[game:(crossword|apmeddle|sortit|duel):[\w-]{1,40}\]$/);
    if (gm) return '🏆 Shared a ' + (GAME_NAME[gm[1]] || gm[1]) + ' result';
    var qm = first.match(/^\[q:[a-z0-9_-]{1,24}:[\w.:-]{1,60}\]$/);
    if (qm) {
      var r = rest.trim().replace(/[\r\n\t]+/g, ' ');
      return '❓ Shared a question' + (r ? ' ' + r : '');
    }
    b = b.replace(/\[duel:[A-Z2-9]{8}\]/g, '⚔️ Duel challenge');
    b = b.replace(/\[sticker:[^\]]*\]/g, '🎨 Sticker');
    return b.replace(/\s+/g, ' ').trim();
  }

  function stateText(p) {
    if (p.recent) return p.last_message ? cleanPreview(p.last_message).slice(0, 80) : 'Recent conversation';
    if (p.state === 'studying') return p.course ? 'Studying ' + p.course : 'Studying';
    if (p.state === 'here') return 'On the site';
    if (p.seen_at) return 'Last online recently';
    return 'Classmate';
  }

  function rowHtml(p) {
    return '<button class="shc-row" type="button" role="option" aria-selected="false" data-id="' + esc(p.id) + '">' +
      '<span class="shc-av">' + avatarHtml(p) + '</span>' +
      '<span class="shc-w"><span class="shc-name">' + esc(formatName(p.name) || 'Classmate') + '</span>' +
      '<span class="shc-sub">' + esc(stateText(p)) + '</span></span>' +
      '<span class="shc-pick" aria-hidden="true">✓</span>' +
      '</button>';
  }

  function filteredPeople() {
    var q = S.search ? S.search.trim().toLowerCase() : '';
    if (!q) return S.people;
    return S.people.filter(function (p) { return String(p.name || '').toLowerCase().indexOf(q) >= 0; });
  }

  function renderList() {
    var list = S.wrap && S.wrap.querySelector('.shc-list');
    if (!list) return;
    var people = filteredPeople();
    if (!people.length) {
      list.innerHTML = '<div class="shc-empty">' + (S.people.length ? 'No classmates found.' : 'No classmates to message yet.') + '</div>';
      return;
    }
    var recent = people.filter(function (p) { return p.recent; });
    var rest = people.filter(function (p) { return !p.recent; });
    var html = '';
    if (recent.length) html += '<div class="shc-sec">Recent conversations</div>' + recent.map(rowHtml).join('');
    if (rest.length) html += '<div class="shc-sec">Classmates</div>' + rest.map(rowHtml).join('');
    list.innerHTML = html;
    if (S.picked) {
      var sel = list.querySelector('.shc-row[data-id="' + cssEscape(S.picked.id) + '"]');
      if (sel) sel.setAttribute('aria-selected', 'true');
    }
  }

  function cssEscape(v) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(String(v));
    return String(v).replace(/["\\]/g, '\\$&');
  }

  function updateSend() {
    var btn = S.wrap && S.wrap.querySelector('.shc-send');
    if (btn) btn.disabled = !S.picked || S.sending || S.sent;
  }

  function select(id) {
    var p = S.people.filter(function (x) { return x.id === id; })[0];
    if (!p || S.sent) return;
    S.picked = p;
    var list = S.wrap.querySelector('.shc-list');
    list.querySelectorAll('.shc-row[data-id]').forEach(function (row) {
      row.setAttribute('aria-selected', row.getAttribute('data-id') === String(id) ? 'true' : 'false');
    });
    updateSend();
  }

  function close() {
    if (!S.wrap) return;
    if (S.onKey) { document.removeEventListener('keydown', S.onKey, true); S.onKey = null; }
    if (S.wrap.parentNode) S.wrap.parentNode.removeChild(S.wrap);
    S.wrap = null;
  }

  function showSignedOut() {
    if (!S.wrap) return;
    var list = S.wrap.querySelector('.shc-list');
    var search = S.wrap.querySelector('.shc-search');
    var compose = S.wrap.querySelector('.shc-compose');
    var err = S.wrap.querySelector('.shc-err');
    if (search) search.hidden = true;
    if (compose) compose.hidden = true;
    if (err) err.hidden = true;
    list.innerHTML = '<div class="shc-signinbox"><p>Sign in with Google to send this to a classmate.</p>' +
      '<button class="shc-signin" type="button">Sign in with Google</button></div>';
    list.querySelector('.shc-signin').addEventListener('click', function () {
      if (typeof Auth !== 'undefined' && Auth) Auth.signIn();
    });
  }

  function showLoading() {
    if (!S.wrap) return;
    var list = S.wrap.querySelector('.shc-list');
    if (list) list.innerHTML = '<div class="shc-empty">Loading classmates…</div>';
  }

  function showError(msg) {
    if (!S.wrap) return;
    var list = S.wrap.querySelector('.shc-list');
    if (list) list.innerHTML = '<div class="shc-empty">' + esc(msg || "Couldn't load classmates.") + '</div>';
  }

  function buildPeople(convs, classList, profiles) {
    var rows = Array.isArray(classList) ? classList : [];
    var meRow = rows.filter(function (r) { return r && r.me; })[0];
    var meId = meRow && meRow.id;
    var seen = {};
    var people = [];
    (Array.isArray(convs) ? convs : []).forEach(function (c) {
      if (!c || !c.id || c.id === meId || seen[c.id]) return;
      seen[c.id] = 1;
      people.push({
        id: c.id, name: c.name || '', av: c.av || '', url: c.avatar || '', state: c.state || '',
        course: c.course || '', seen_at: c.seen_at || '', recent: true,
        last_message: c.last_message || '', last_mine: !!c.last_mine, unread_count: +c.unread_count || 0
      });
    });
    rows.forEach(function (r) {
      if (!r || !r.id || r.me || r.id === meId || seen[r.id]) return;
      seen[r.id] = 1;
      var pr = (profiles && profiles[r.id]) || {};
      people.push({
        id: r.id, name: r.name || pr.name || '', av: r.av || 'g', url: r.avatar || '', state: r.state || '',
        course: r.course || '', seen_at: r.seen_at || '', recent: false,
        last_message: '', last_mine: false, unread_count: 0
      });
    });
    return people;
  }

  async function load() {
    if (typeof Auth === 'undefined' || !Auth) { showSignedOut(); return; }
    if (!Auth.cloud) {
      try {
        var list = await (await fetch('courses.json')).json();
        var c = list.filter(function (x) { return x.cloud && x.cloud.url; })[0];
        if (c) Auth.cloud = c.cloud;
      } catch (e) {}
    }
    if (!S.wrap) return;
    if (!Auth.cloud) { showError('Messaging is not set up here.'); return; }

    var token = '';
    try { token = await Auth.token(); } catch (e) { token = ''; }
    if (!S.wrap) return;
    S.token = token || '';
    if (!S.token) { showSignedOut(); return; }

    await ensureProfile();
    if (!S.wrap) return;
    try {
      var res = await Promise.all([
        Auth.rpc('dm_conversations', {}, true).catch(function () { return []; }),
        Auth.rpc('class_list', {}, true).catch(function () { return []; }),
        Auth.rpc('class_profiles', {}, true).catch(function () { return {}; })
      ]);
      if (!S.wrap) return;
      S.people = buildPeople(res[0], res[1], res[2]);
      renderList();
    } catch (e) {
      showError("Couldn't load classmates. Try again.");
    }
  }

  async function send() {
    if (!S.wrap || !S.picked || S.sending || S.sent) return;
    var input = S.wrap.querySelector('.shc-msg');
    var note = input ? String(input.value || '').trim() : '';
    var text = (S.body || '') + (note ? '\n' + note : '');
    if (text.length > 1000) text = text.slice(0, 1000);
    S.sending = true;
    updateSend();
    var err = S.wrap.querySelector('.shc-err');
    if (err) { err.textContent = ''; err.hidden = true; }
    try {
      await Auth.rpc('dm_send', { p_to: S.picked.id, p_body: text }, true);
      S.sent = true;
      S.sending = false;
      var compose = S.wrap.querySelector('.shc-compose');
      var href = 'dm.html?with=' + encodeURIComponent(S.picked.id) + '&to=' + encodeURIComponent(S.picked.name || '');
      compose.innerHTML = '<div class="shc-done"><span>Sent to ' + esc(firstName(S.picked.name) || 'your classmate') + '</span>' +
        '<a class="shc-open" href="' + href + '">Open chat</a></div>';
      setTimeout(close, 1500);
    } catch (e) {
      S.sending = false;
      updateSend();
      if (err) { err.textContent = "Couldn't send. Try again."; err.hidden = false; }
      else {
        var c2 = S.wrap.querySelector('.shc-compose');
        if (c2) c2.insertAdjacentHTML('beforebegin', '<p class="shc-err" role="alert">Couldn\'t send. Try again.</p>');
      }
    }
  }

  function open(opts) {
    opts = opts || {};
    if (S.wrap) close();
    css();
    S.body = String(opts.body == null ? '' : opts.body);
    S.label = String(opts.label == null ? '' : opts.label);
    S.preview = String(opts.preview == null ? '' : opts.preview);
    S.token = ''; S.people = []; S.picked = null; S.sending = false; S.sent = false; S.search = '';

    var wrap = document.createElement('div');
    wrap.className = 'shc-wrap';
    wrap.innerHTML = '<div class="shc-back"></div>' +
      '<section class="shc-sheet" role="dialog" aria-modal="true" aria-labelledby="shc-title">' +
      '<div class="shc-head"><h2 id="shc-title">Send to a classmate</h2>' +
      '<button class="shc-x" type="button" aria-label="Close" title="Close">×</button></div>' +
      '<div class="shc-meta"><div class="shc-label"></div><div class="shc-prev"' + (S.preview ? '' : ' hidden') + '></div></div>' +
      '<div class="shc-search"><input class="shc-search-input" type="search" placeholder="Search classmates" aria-label="Search classmates" autocomplete="off"></div>' +
      '<div class="shc-list" role="listbox" aria-label="Classmates"></div>' +
      '<p class="shc-err" role="alert" hidden></p>' +
      '<div class="shc-compose"><textarea class="shc-msg" rows="1" maxlength="300" placeholder="Add a message (optional)" aria-label="Add a message"></textarea>' +
      '<button class="shc-send" type="button" disabled>Send</button></div>' +
      '</section>';
    S.wrap = wrap;
    document.body.appendChild(wrap);

    var label = wrap.querySelector('.shc-label');
    if (label) label.textContent = S.label;
    var prev = wrap.querySelector('.shc-prev');
    if (prev) prev.textContent = S.preview;

    wrap.querySelector('.shc-x').addEventListener('click', close);
    wrap.querySelector('.shc-back').addEventListener('click', close);
    var list = wrap.querySelector('.shc-list');
    list.addEventListener('click', function (e) {
      var row = e.target.closest('.shc-row[data-id]');
      if (row) select(row.getAttribute('data-id'));
    });
    var search = wrap.querySelector('.shc-search-input');
    search.addEventListener('input', function () {
      S.search = search.value;
      renderList();
    });
    wrap.querySelector('.shc-send').addEventListener('click', send);

    S.onKey = function (e) {
      if (e.key === 'Escape' && S.wrap) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', S.onKey, true);

    showLoading();
    load();
  }

  window.ShareChat = { open: open };
})();
