/* Profiles: display name + avatar for signed-in accounts (profiles table, supabase_profiles.sql).
   Profile.html() draws an avatar, Profile.refresh() reads the account's profile into the saved account
   (reviewer_account: dname, av, gname), Profile.edit() opens the editor, Profile.card() shows a poster's card.
   Avatar values: 'g' = Google photo, 'x:<pic>:<color>' = a built-in picture; 'init' = the first letter.
   Needs auth.js (and Auth.cloud set) for refresh/edit. Uses each page's color tokens. */
(function () {
  const PICS = [['init', '', 'First letter'], ['owl', '🦉', 'Owl'], ['fox', '🦊', 'Fox'], ['cat', '🐱', 'Cat'], ['dog', '🐶', 'Dog'],
    ['panda', '🐼', 'Panda'], ['bunny', '🐰', 'Bunny'], ['bear', '🐻', 'Bear'], ['koala', '🐨', 'Koala'], ['tiger', '🐯', 'Tiger'],
    ['frog', '🐸', 'Frog'], ['penguin', '🐧', 'Penguin'], ['chick', '🐥', 'Chick'], ['turtle', '🐢', 'Turtle'], ['whale', '🐳', 'Whale'],
    ['octopus', '🐙', 'Octopus'], ['unicorn', '🦄', 'Unicorn'], ['brain', '🧠', 'Brain'], ['dna', '🧬', 'DNA'], ['scope', '🔬', 'Microscope'],
    ['steth', '🩺', 'Stethoscope'], ['pill', '💊', 'Pill'], ['books', '📚', 'Books'], ['coffee', '☕', 'Coffee'], ['plant', '🌱', 'Sprout'],
    ['flower', '🌻', 'Sunflower'], ['star', '⭐', 'Star'], ['moon', '🌙', 'Moon'], ['rocket', '🚀', 'Rocket'], ['bolt', '⚡', 'Lightning']];
  const COLORS = ['#fbd5dc', '#fde0c5', '#fbefb3', '#c9efd9', '#c8e6fa', '#d5d9fb', '#e6d5fa', '#dde3ea'];
  const ACC = 'reviewer_account';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const css = '.pfa{display:inline-grid;place-items:center;flex:none;width:var(--s,36px);height:var(--s,36px);border-radius:50%;object-fit:cover;overflow:hidden;' +
    'font:700 calc(var(--s,36px)*.44)/1 var(--sans,system-ui);color:#3b2d4f;background:var(--accent-soft);user-select:none}' +
    '.pfa.e{font-size:calc(var(--s,36px)*.56);font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}' +
    '.pfm{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.45)}.pfm[hidden]{display:none}' +
    '.pfm .pb{width:min(440px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--surface);color:var(--text);border:1px solid var(--line2);border-radius:18px;padding:20px;box-shadow:0 20px 50px #0004}' +
    '.pfm h2{margin:0;font:600 19px/1.3 var(--serif,Georgia,serif)}.pfm .ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}' +
    '.pfm .x{border:0;background:none;color:var(--mute);font-size:22px;line-height:1;cursor:pointer;padding:2px 6px}' +
    '.pfm .pv{display:flex;align-items:center;gap:14px;padding:12px;border-radius:14px;background:var(--raised);border:1px solid var(--line)}' +
    '.pfm .pv b{display:block;font-size:16px;overflow-wrap:anywhere}.pfm .pv>div>span{display:block;color:var(--mute);font-size:13px}' +
    '.pfm label{display:block;margin:16px 0 6px;font-size:13px;font-weight:600;color:var(--mute)}' +
    '.pfm input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:11px;border:1px solid var(--line2);background:var(--bg);color:var(--text);font:15px var(--sans,system-ui);outline:0}.pfm input:focus{border-color:var(--accent)}' +
    '.pfm .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px}' +
    '.pfm .grid button,.pfm .cols button{border:2px solid transparent;background:none;padding:2px;border-radius:50%;cursor:pointer;display:grid;place-items:center}' +
    '.pfm .grid button.on,.pfm .cols button.on{border-color:var(--accent)}.pfm .grid button:focus-visible,.pfm .cols button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}' +
    '.pfm .cols{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;justify-items:center}.pfm .cols i{display:block;width:28px;height:28px;border-radius:50%;box-shadow:inset 0 0 0 1px #0002}' +
    '.pfm .pfnote{margin:8px 0 0;padding:0;border:0;background:none;font-size:12.5px;color:var(--faint)}.pfm .err{color:var(--bad);font-size:13.5px;margin:12px 0 0;min-height:1em}' +
    '.pfm .row{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;flex-wrap:wrap}' +
    '.pfm .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:11px;padding:8px 14px;font:600 14px var(--sans,system-ui);border:1px solid var(--line2);background:var(--surface);color:var(--text);cursor:pointer}' +
    '.pfm .btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink,#fff)}.pfm .btn:disabled{opacity:.55;cursor:default}' +
    '.pfm .mod{font-size:11px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;padding:1px 7px;border-radius:99px;background:var(--accent-soft);color:var(--accent);margin-left:6px;vertical-align:2px}' +
    '.pfm .real{margin:12px 0 0;font-size:14px;color:var(--mute)}.pfm .real b{color:var(--text)}';
  function style() { if (!document.getElementById('pfcss')) { const s = document.createElement('style'); s.id = 'pfcss'; s.textContent = css; document.head.appendChild(s) } }
  style();

  const pic = id => PICS.find(p => p[0] === id);
  function parse(av) { const m = /^x:([a-z0-9]{1,12}):([0-7])$/.exec(av || ''); return m && pic(m[1]) ? { id: m[1], c: +m[2] } : null }
  const initial = n => (String(n || '?').trim().charAt(0) || '?').toUpperCase();
  // o = {av, url, name}; size in px
  function html(o, size, cls) {
    o = o || {}; const s = 'style="--s:' + (size || 36) + 'px', k = 'pfa' + (cls ? ' ' + cls : ''), x = parse(o.av);
    if (x) { const p = pic(x.id); return '<span class="' + k + (p[1] ? ' e' : '') + '" ' + s + ';background:' + COLORS[x.c] + '" aria-hidden="true">' + (p[1] || esc(initial(o.name))) + '</span>' }
    if (o.url) return '<img class="' + k + '" ' + s + '" src="' + esc(o.url) + '" alt="" referrerpolicy="no-referrer" loading="lazy" data-n="' + esc(initial(o.name)) + '" onerror="Profile.broken(this)">';
    return '<span class="' + k + '" ' + s + '" aria-hidden="true">' + esc(initial(o.name)) + '</span>';
  }
  function broken(img) { const sp = document.createElement('span'); sp.className = img.className; sp.style.cssText = img.style.cssText; sp.textContent = img.dataset.n || '?'; sp.setAttribute('aria-hidden', 'true'); img.replaceWith(sp) }

  function acc() { try { return JSON.parse(localStorage.getItem(ACC)) || null } catch (e) { return null } }
  function keep(p) {   // copy a profile_get result into the saved account
    const a = acc(); if (!a || !p) return a;
    a.dname = p.name || ''; a.av = p.avatar || 'g'; a.gname = p.google_name || a.name || '';
    if (p.google_avatar) a.avatar = p.google_avatar;
    a.mod = !!p.mod; a.posts = +p.posts || 0;
    try { localStorage.setItem(ACC, JSON.stringify(a)) } catch (e) {}
    return a;
  }
  // What to show for the saved account: {name, av, url}
  function me(a) { a = a || acc(); if (!a) return null; return { name: a.dname || a.name || a.email || 'Account', av: a.av || 'g', url: a.avatar || '' } }
  async function refresh() { if (typeof Auth === 'undefined' || !Auth.cloud || !Auth.ses()) return null; /* auth.js's const Auth is not on window */ try { return keep(await Auth.rpc('profile_get', {}, true)) } catch (e) { return null } }

  let box = null;
  function modal(inner) {
    style();
    if (!box) { box = document.createElement('div'); box.className = 'pfm'; box.addEventListener('click', e => { if (e.target === box) close() }); document.body.appendChild(box);
      addEventListener('keydown', e => { if (e.key === 'Escape' && box && !box.hidden) close() }) }
    box.innerHTML = '<div class="pb" role="dialog" aria-modal="true" aria-labelledby="pfh">' + inner + '</div>'; box.hidden = false;
  }
  function close() { if (box) box.hidden = true }
  const head = t => '<div class="ph"><h2 id="pfh">' + t + '</h2><button class="x" onclick="Profile.close()" aria-label="Close">×</button></div>';

  // Editor. Resolves with the saved account after a save, or null when closed.
  function edit() {
    const a = acc(); if (!a) return Promise.resolve(null);
    let av = a.av || 'g', x = parse(av), pid = x ? x.id : (a.avatar ? 'g' : 'init'), col = x ? x.c : 5;
    const first = String(a.gname || a.name || '').split(' ')[0];
    return new Promise(res => {
      const draw = () => {
        const cur = pid === 'g' ? { av: 'g', url: a.avatar, name: nameNow() } : { av: 'x:' + pid + ':' + col, name: nameNow() };
        const grid = (a.avatar ? '<button type="button" data-p="g" class="' + (pid === 'g' ? 'on' : '') + '" aria-label="Google photo" title="Google photo">' + html({ url: a.avatar, name: nameNow() }, 38) + '</button>' : '') +
          PICS.map(p => '<button type="button" data-p="' + p[0] + '" class="' + (pid === p[0] ? 'on' : '') + '" aria-label="' + p[2] + '" title="' + p[2] + '">' + html({ av: 'x:' + p[0] + ':' + col, name: nameNow() }, 38) + '</button>').join('');
        modal(head('Your profile') +
          '<div class="pv">' + html(cur, 56) + '<div><b id="pfn">' + esc(nameNow() || 'Your name') + '</b><span>Shown in the discussion</span></div></div>' +
          '<label for="pfin">Display name</label><input id="pfin" maxlength="24" autocomplete="nickname" placeholder="' + esc(first || 'Your name') + '" value="' + esc(typed == null ? (a.dname || '') : typed) + '">' +
          '<p class="pfnote">Leave it empty to use your Google name. Classmates who tap your name can still see your Google account name.</p>' +
          '<label>Picture</label><div class="grid" id="pfgrid">' + grid + '</div>' +
          (pid !== 'g' ? '<label>Color</label><div class="cols" id="pfcols">' + COLORS.map((c, i) => '<button type="button" data-c="' + i + '" class="' + (i === col ? 'on' : '') + '" aria-label="Color ' + (i + 1) + '"><i style="background:' + c + '"></i></button>').join('') + '</div>' : '') +
          '<p class="err" id="pferr" role="alert"></p><div class="row"><button class="btn" onclick="Profile.close()">Cancel</button><button class="btn primary" id="pfsave">Save</button></div>');
        const inp = document.getElementById('pfin');
        inp.oninput = () => { typed = inp.value; const n = document.getElementById('pfn'); n.textContent = nameNow() || 'Your name'; const pv = box.querySelector('.pv .pfa'); if (pv && pv.tagName === 'SPAN' && !pv.classList.contains('e')) pv.textContent = initial(nameNow()) };
        inp.onkeydown = e => { if (e.key === 'Enter') save() };
        box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { pid = b.dataset.p; draw() });
        box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { col = +b.dataset.c; draw() });
        document.getElementById('pfsave').onclick = save;
      };
      let typed = null;
      const nameNow = () => (typed == null ? (a.dname || '') : typed).trim() || String(a.gname || a.name || '');
      async function save() {
        const btn = document.getElementById('pfsave'), err = document.getElementById('pferr');
        btn.disabled = true; btn.textContent = 'Saving…'; err.textContent = '';
        try {
          const p = await Auth.rpc('profile_set', { p_name: (typed == null ? (a.dname || '') : typed).trim(), p_avatar: pid === 'g' ? 'g' : 'x:' + pid + ':' + col }, true);
          const n = keep(p); close(); res(n);
        } catch (e) {
          err.textContent = /JWT|sign in first|401/i.test(e.message) ? 'Your sign-in ended on this device. Sign in again, then try once more.' : (e.message || 'Could not save. Check your connection.');
          btn.disabled = false; btn.textContent = 'Save';
        }
      }
      draw();
      const watch = new MutationObserver(() => { if (box.hidden) { watch.disconnect(); res(null) } });
      watch.observe(box, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  // A discussion poster's card. p = a discussion_list row.
  function card(p, onEdit) {
    modal(head(p.mine ? 'You' : 'Classmate') +
      '<div class="pv">' + html({ av: p.av, url: p.avatar, name: p.author }, 56) + '<div><b>' + esc(p.author) + (p.is_mod ? '<span class="mod">Moderator</span>' : '') + '</b>' +
      '<span>' + (p.mine ? 'This is how classmates see you' : 'Display name') + '</span></div></div>' +
      (p.real_name ? '<p class="real">Google account: <b>' + esc(p.real_name) + '</b></p>' : (p.mine ? '' : '<p class="real">Sign in to see the Google account name.</p>')) +
      '<div class="row">' + (p.mine && onEdit ? '<button class="btn primary" id="pfedit">Edit profile</button>' : '') + '<button class="btn" onclick="Profile.close()">Close</button></div>');
    const b = document.getElementById('pfedit'); if (b) b.onclick = () => { close(); onEdit() };
  }

  window.Profile = { PICS, COLORS, html, broken, acc, me, keep, refresh, edit, card, close, parse };
})();
