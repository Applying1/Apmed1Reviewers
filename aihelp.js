// AI helper for the notes reader: explain the page on screen, explain a highlighted part, or answer a question about it.
// Standalone: transes.html calls AIHelp.init({...}) once the PDF is loaded; everything else lives here.
(function () {
  'use strict';

  var RESTING = 'AI is resting right now. The written notes are still here.';
  var NO_TEXT = 'This page has no text to explain.';
  var started = false;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cut(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n) : s;
  }
  // Escape first, then turn **bold** into <b>, "• "/"- " lines into list items and the other newlines into <br>.
  function render(text) {
    var html = escapeHtml(text).replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>');
    var lines = html.split('\n'), out = [], list = [];
    function flush() {
      if (!list.length) return;
      out.push('<ul class="aih-list">' + list.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>');
      list = [];
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s*(?:•|-)\s+/.test(line)) {
        list.push(line.replace(/^\s*(?:•|-)\s+/, ''));
      } else {
        flush();
        out.push(line);
      }
    }
    flush();
    return out.join('<br>');
  }

  var CSS =
    '.aih-btn{gap:6px}' +
    '.aih-btn svg{flex:none}' +
    '.aih-panel{position:fixed;left:0;right:0;bottom:0;z-index:1000;width:100%;max-width:460px;margin:0 auto;max-height:70vh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--surface,#fff);color:var(--text,#111);border:1px solid var(--line,#ddd);border-bottom:0;border-radius:18px 18px 0 0;box-shadow:0 -10px 34px rgba(0,0,0,.28);font:15px/1.5 var(--sans,system-ui,sans-serif)}' +
    '.aih-panel[hidden]{display:none}' +
    '.aih-panel *{box-sizing:border-box}' +
    '.aih-panel,.aih-pill{box-sizing:border-box}' +
    '.aih-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--surface,#fff);border-bottom:1px solid var(--line,#ddd)}' +
    '.aih-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:700}' +
    '.aih-close{flex:none;width:32px;height:32px;padding:0;border:0;border-radius:9px;background:var(--raised,#f1f1f1);color:var(--text,#111);font-size:21px;line-height:30px;cursor:pointer}' +
    '.aih-close:hover{filter:brightness(.96)}' +
    '.aih-main{padding:12px 14px 4px}' +
    '.aih-main[hidden]{display:none}' +
    '.aih-explain{width:100%}' +
    '.aih-answer{margin-top:10px}' +
    '.aih-answer:empty{display:none}' +
    '.aih-answer,.aih-a,.aih-q{overflow-wrap:anywhere;word-break:break-word}' +
    '.aih-list{margin:5px 0;padding-left:20px}' +
    '.aih-list li{margin:2px 0}' +
    '.aih-thinking{color:var(--mute,#666);font-size:14px}' +
    '.aih-model{margin-top:6px;color:var(--mute,#666);font-size:12px}' +
    '.aih-err{padding:9px 11px;border-radius:10px;background:var(--raised,#f1f1f1);font-size:14px}' +
    '.aih-chatlog:empty{display:none}' +
    '.aih-turn{margin-top:10px;padding:9px 11px;border-radius:12px;font-size:14.5px}' +
    '.aih-q{background:var(--raised,#f1f1f1);font-weight:600}' +
    '.aih-a{padding-left:0;background:transparent}' +
    '.aih-chat{display:flex;align-items:center;gap:8px;margin:12px 0 4px}' +
    '.aih-input{flex:1;min-width:0;padding:9px 11px;border-radius:10px;border:1px solid var(--line2,#ccc);background:var(--bg,#fff);color:var(--text,#111);font:inherit;font-size:15px;outline:0}' +
    '.aih-input:focus{border-color:var(--accent,#4f46e5)}' +
    '.aih-send{flex:none}' +
    '.aih-foot{padding:2px 14px 12px;color:var(--mute,#666);font-size:12.5px;min-height:1em}' +
    '.aih-foot[hidden]{display:none}' +
    '.aih-signin{padding:20px 16px;text-align:center}' +
    '.aih-signin p{margin:0 0 12px;color:var(--mute,#666)}' +
    '.aih-signin[hidden]{display:none}' +
    '.aih-pill{position:fixed;z-index:1001;display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:99px;border:1px solid var(--line2,#ccc);background:var(--surface,#fff);color:var(--text,#111);box-shadow:0 4px 16px rgba(0,0,0,.22);font-size:13.5px;font-weight:700;white-space:nowrap;cursor:pointer}' +
    '.aih-pill[hidden]{display:none}' +
    '@media (max-width:520px){.aih-panel{border-radius:16px 16px 0 0}}';

  var SPARKLE = '<svg class="i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>' +
    '<path d="M19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z"/></svg>';

  function addStyle() {
    if (document.getElementById('aih-style')) return;
    var style = document.createElement('style');
    style.id = 'aih-style';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function init(options) {
    if (started) return;
    if (!options || !options.course) return;
    if (storageGet('reviewer_aihelp') === '0') return;
    if (typeof Auth === 'undefined') return;
    started = true;

    var state = {
      opts: options, prior: [], page: 0, left: null, busy: false, pendingSel: '',
      btn: null, pill: null, panel: null, title: null, close: null, main: null, signinEl: null,
      answer: null, chatlog: null, input: null, explainBtn: null, sendBtn: null, foot: null
    };

    addStyle();
    (async function () {
      try {
        var list = await (await fetch('courses.json')).json();
        var first = list.find(function (c) { return c && c.cloud && c.cloud.url; });
        if (first && first.cloud) Auth.cloud = first.cloud;
      } catch (e) { /* keep whatever auth.js already has */ }
      build();
    })();

    function build() {
      var bar = document.querySelector('.bar');
      if (!bar) return;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn aih-btn';
      btn.setAttribute('aria-label', 'AI helper');
      btn.innerHTML = SPARKLE + '<span class="lbl">AI</span>';
      btn.addEventListener('click', function () { openPanel(); });
      bar.appendChild(btn);
      state.btn = btn;

      if (state.opts.root) {
        var pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'btn aih-pill';
        pill.textContent = 'Explain';
        pill.setAttribute('aria-label', 'Explain the selected text');
        pill.hidden = true;
        pill.addEventListener('mousedown', function (e) { e.preventDefault(); });
        pill.addEventListener('click', function () {
          var sel = state.pendingSel;
          hidePill();
          openPanel(sel);
        });
        document.body.appendChild(pill);
        state.pill = pill;
      }

      var panel = document.createElement('div');
      panel.className = 'aih-panel';
      panel.addEventListener('keydown', function (e) { e.stopPropagation(); });
      panel.hidden = true;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'AI helper');
      panel.innerHTML =
        '<div class="aih-head"><b class="aih-title">AI helper</b>' +
        '<button type="button" class="aih-close" aria-label="Close AI helper">×</button></div>' +
        '<div class="aih-signin" hidden><p>Sign in with Google to use the AI helper.</p>' +
        '<button type="button" class="btn aih-signinbtn">Sign in with Google</button></div>' +
        '<div class="aih-main">' +
        '<button type="button" class="btn aih-explain">Explain this page</button>' +
        '<div class="aih-answer" aria-live="polite"></div>' +
        '<div class="aih-chatlog" aria-live="polite"></div>' +
        '<form class="aih-chat">' +
        '<input class="aih-input" type="text" placeholder="Ask about this page…" maxlength="300" autocomplete="off" aria-label="Ask about this page">' +
        '<button type="submit" class="btn aih-send">Send</button>' +
        '</form></div>' +
        '<div class="aih-foot" hidden></div>';
      document.body.appendChild(panel);
      state.panel = panel;
      state.title = panel.querySelector('.aih-title');
      state.close = panel.querySelector('.aih-close');
      state.main = panel.querySelector('.aih-main');
      state.signinEl = panel.querySelector('.aih-signin');
      state.answer = panel.querySelector('.aih-answer');
      state.chatlog = panel.querySelector('.aih-chatlog');
      state.input = panel.querySelector('.aih-input');
      state.explainBtn = panel.querySelector('.aih-explain');
      state.sendBtn = panel.querySelector('.aih-send');
      state.foot = panel.querySelector('.aih-foot');

      state.close.addEventListener('click', closePanel);
      state.explainBtn.addEventListener('click', function () { sendSlide(null); });
      panel.querySelector('.aih-signinbtn').addEventListener('click', function () {
        try { Auth.signIn(); } catch (e) { /* nothing else we can do */ }
      });
      panel.querySelector('.aih-chat').addEventListener('submit', function (e) {
        e.preventDefault();
        if (state.busy) return;
        var ask = String(state.input.value || '').trim();
        if (!ask) return;
        state.input.value = '';
        sendChat(ask);
      });

      if (state.opts.root) setupSelection();
    }

    function closePanel() {
      if (state.panel) state.panel.hidden = true;
      hidePill();
    }

    function hidePill() {
      if (state.pill) state.pill.hidden = true;
      state.pendingSel = '';
    }

    function setupSelection() {
      var timer = 0;
      document.addEventListener('selectionchange', function () {
        clearTimeout(timer);
        timer = setTimeout(checkSelection, 250);
      });
    }

    function checkSelection() {
      if (!state.pill) return;
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed) { hidePill(); return; }
      var text = String(sel.toString() || '').trim();
      if (text.length < 3 || text.length > 600) { hidePill(); return; }
      var range;
      try { range = sel.getRangeAt(0); } catch (e) { hidePill(); return; }
      if (!range || !state.opts.root || !state.opts.root.contains(range.commonAncestorContainer)) { hidePill(); return; }
      var rect = range.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) { hidePill(); return; }

      state.pendingSel = text;
      state.pill.hidden = false;
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var w = state.pill.offsetWidth || 82;
      var h = state.pill.offsetHeight || 32;
      var left = rect.left + rect.width / 2 - w / 2;
      left = Math.max(8, Math.min(left, vw - w - 8));
      var top = rect.top - h - 8;
      if (top < 8) top = rect.bottom + 8;
      top = Math.max(8, Math.min(top, vh - h - 8));
      state.pill.style.left = left + 'px';
      state.pill.style.top = top + 'px';
    }

    function syncPage() {
      var page = 1;
      try { page = +state.opts.getPage() || 1; } catch (e) { /* keep page 1 */ }
      if (page !== state.page) {
        state.page = page;
        state.prior = [];
      }
      if (state.title) state.title.textContent = 'AI helper · page ' + state.page;
      return state.page;
    }

    async function token() {
      try { return await Auth.token(); } catch (e) { return ''; }
    }

    async function pageText(page) {
      try { return String((await state.opts.getText(page)) || ''); } catch (e) { return ''; }
    }

    function showSignIn() {
      if (!state.panel) return;
      state.signinEl.hidden = false;
      state.main.hidden = true;
      state.foot.hidden = true;
    }

    function showSignedIn() {
      if (!state.panel) return;
      state.signinEl.hidden = true;
      state.main.hidden = false;
      state.foot.hidden = state.left == null;
      state.foot.textContent = state.left == null ? '' : state.left + ' AI tries left today';
    }

    function setBusy(busy) {
      state.busy = busy;
      if (state.explainBtn) state.explainBtn.disabled = busy;
      if (state.sendBtn) state.sendBtn.disabled = busy;
    }

    function thinking(target) {
      target.innerHTML = '<div class="aih-thinking">Thinking…</div>';
    }
    function showText(target, text, model) {
      target.innerHTML = render(text);
      var note = document.createElement('div');
      note.className = 'aih-model';
      note.textContent = (model ? 'Answered by ' + model + ' · ' : '') + 'AI can be wrong, check your transes';
      target.appendChild(note);
    }
    function showError(target, message) {
      target.innerHTML = '';
      var div = document.createElement('div');
      div.className = 'aih-err';
      div.textContent = message;
      target.appendChild(div);
    }
    function setLeft(left) {
      if (typeof left !== 'number' || !isFinite(left)) return;
      state.left = left;
      if (!state.foot) return;
      state.foot.hidden = false;
      state.foot.textContent = left + ' AI tries left today';
    }

    async function readJson(res) {
      try { return await res.json(); } catch (e) { return null; }
    }

    function failed(res, data, target) {
      if (res.status === 401) { showSignIn(); return; }
      if (res.status === 429 && data) {
        if (data.error === 'limit') {
          var perDay = data.perDay;
          showError(target, perDay
            ? "You've used today's " + perDay + ' AI tries. More tomorrow.'
            : "You've used today's AI tries. More tomorrow.");
          setLeft(typeof data.left === 'number' ? data.left : 0);
          return;
        }
        if (data.error === 'busy') {
          showError(target, 'The AI is busy right now. Try again in a minute.');
          return;
        }
      }
      showError(target, RESTING);
    }

    async function openPanel(sel) {
      hidePill();
      syncPage();
      state.panel.hidden = false;
      var tok = await token();
      if (state.panel.hidden) return;
      if (!tok) { showSignIn(); return; }
      showSignedIn();
      if (sel != null && String(sel).trim()) sendSlide(String(sel).trim());
    }

    async function sendSlide(sel) {
      if (state.busy) return;
      var page = syncPage();
      var tok = await token();
      if (!tok) { showSignIn(); return; }
      var full = await pageText(page);
      showSignedIn();
      if (full.trim().length < 20) {
        state.answer.innerHTML = '';
        showError(state.answer, NO_TEXT);
        return;
      }
      var payload = { course: state.opts.course, mode: 'slide', doc: state.opts.doc || '', page: page, text: cut(full, 4000) };
      if (sel) payload.sel = cut(sel, 600);

      setBusy(true);
      state.answer.innerHTML = '';
      thinking(state.answer);
      try {
        var res = await fetch(Auth.base() + '/functions/v1/explain', {
          method: 'POST', headers: Auth.headers(tok), body: JSON.stringify(payload)
        });
        var data = await readJson(res);
        if (res.status === 401) { showSignIn(); return; }
        if (res.ok && data && typeof data.text === 'string') {
          showText(state.answer, data.text, data.model);
          setLeft(data.left);
        } else {
          failed(res, data, state.answer);
        }
      } catch (e) {
        showError(state.answer, RESTING);
      } finally {
        setBusy(false);
      }
    }

    async function sendChat(ask) {
      if (state.busy) return;
      var page = syncPage();
      var tok = await token();
      if (!tok) { showSignIn(); return; }
      var full = await pageText(page);
      showSignedIn();
      if (full.trim().length < 20) {
        state.answer.innerHTML = '';
        showError(state.answer, NO_TEXT);
        return;
      }

      var q = document.createElement('div');
      q.className = 'aih-turn aih-q';
      q.textContent = ask;
      var a = document.createElement('div');
      a.className = 'aih-turn aih-a';
      state.chatlog.appendChild(q);
      state.chatlog.appendChild(a);

      var payload = {
        course: state.opts.course, mode: 'chat', doc: state.opts.doc || '', page: page,
        text: cut(full, 3000), ask: ask, prior: state.prior.slice(-4)
      };
      setBusy(true);
      thinking(a);
      try {
        var res = await fetch(Auth.base() + '/functions/v1/explain', {
          method: 'POST', headers: Auth.headers(tok), body: JSON.stringify(payload)
        });
        var data = await readJson(res);
        if (res.status === 401) { showSignIn(); return; }
        if (res.ok && data && typeof data.text === 'string') {
          showText(a, data.text, data.model);
          setLeft(data.left);
          state.prior.push({ q: ask, a: data.text });
          if (state.prior.length > 4) state.prior = state.prior.slice(-4);
        } else {
          failed(res, data, a);
        }
      } catch (e) {
        showError(a, RESTING);
      } finally {
        setBusy(false);
      }
    }
  }

  window.AIHelp = { init: init };
})();
