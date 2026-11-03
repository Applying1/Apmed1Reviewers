// emojis.js — Rich Emoji Reactions & Picker for APMed '33 (DMs & Discussions)
// Provides quick reactions bar, expandable categorized emoji palette, and composer emoji insertion.
(function(window){
 'use strict';

 const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '🎉', '💀', '💯', '✨', '👀', '🧠', '👏', '✅'];

 const CATEGORIES = [
  {
   id: 'smileys',
   name: 'Smileys',
   emojis: [
    '😀','😃','😄','😁','😆','😅','😂','🤣','🥹','😊','😇','🙂','😉','😌','😍','🥰','😘','😋','😛','😜','🤪','😎','🥳',
    '😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😮','😯','😲','😳','🤯','🥶','🥵','😱','😨',
    '😰','😥','😓','🤗','🤔','🫣','🤭','🤫','🫡','🫠','🤐','🤨','😐','😑','😶','😬','🙄','😮‍💨','😴','🤤','😪','😵','😵‍💫',
    '🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','🤡','💩','👻','💀','☠️','👽','👾'
   ]
  },
  {
   id: 'gestures',
   name: 'Hands & Love',
   emojis: [
    '👍','👎','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','💪','🦾',
    '✍️','🙏','🤝','👏','🙌','👐','🤲','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞',
    '💓','💗','💖','💘','💝','💟','💌','👀','👁️','🧠','🫀','🫁','🦷','🦴'
   ]
  },
  {
   id: 'study',
   name: 'Study & Med',
   emojis: [
    '🧠','💡','📚','📖','📕','📗','📘','📙','📓','📔','📒','✏️','✒️','🖋️','🖊️','📝','💼','📁','📂','📅','📆','📊','📈',
    '📋','📌','📍','📎','🖇️','📏','📐','🔬','🔭','📡','🩺','💉','🩸','💊','🩹','🧬','🧪','🧫','🎓','💻','🖥️','📱','⏰',
    '⏱️','⏲️','🎯','🔍','🔎','☕','🍵','🧋'
   ]
  },
  {
   id: 'celebrate',
   name: 'Celebration',
   emojis: [
    '🎉','🎊','🥳','🎈','🎂','🍰','🧁','🍕','🍔','🍟','🍩','🍪','🍫','🍬','🍭','🏆','🥇','🥈','🥉','🏅','🎖️','🎫','🎟️',
    '🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎲','🎯','🎳','🎮','🎰'
   ]
  },
  {
   id: 'symbols',
   name: 'Symbols',
   emojis: [
    '🔥','✨','⭐','🌟','💫','💥','💯','💢','💬','💭','💤','🚀','🛸','⚡','☀️','🌙','☁️','🌧️','❄️','🌈','🌸','🌺','🍀',
    '🍁','🍃','✅','✔️','☑️','❌','❎','➕','➖','➗','❓','❗','‼️','⁉️','⚠️','🚫','⛔','🛑','🔔','🔕'
   ]
  }
 ];

 const CSS = `
/* --- Rich Emojis Styling --- */
.emojibtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid var(--line2, rgba(0,0,0,0.12));
  background: var(--surface, #fff);
  color: var(--mute, #666);
  cursor: pointer;
  flex: none;
  transition: background .15s, border-color .15s, color .15s, transform .1s;
}
.emojibtn:hover {
  background: var(--raised, rgba(0,0,0,0.04));
  color: var(--text, #111);
  border-color: var(--accent, #4f46e5);
}
.emojibtn:active {
  transform: scale(0.95);
}

/* Quick Reaction Bar Popover */
.rx-picker, .em-rx-bar {
  position: fixed;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-radius: 99px;
  background: var(--surface, #fff);
  border: 1px solid var(--line2, rgba(0,0,0,0.14));
  box-shadow: 0 10px 28px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08);
  max-width: calc(100vw - 16px);
  box-sizing: border-box;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  animation: emPop .14s cubic-bezier(0.16, 1, 0.3, 1);
}
.rx-picker::-webkit-scrollbar, .em-rx-bar::-webkit-scrollbar { display: none; }

.rx-pick-btn, .em-rx-btn {
  font-size: 21px;
  line-height: 1;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 0;
  flex: none;
  transition: transform .12s, background .15s;
}
.rx-pick-btn:hover, .em-rx-btn:hover {
  transform: scale(1.3);
  background: var(--raised, rgba(0,0,0,0.05));
}
.rx-pick-btn:active, .em-rx-btn:active {
  transform: scale(0.9);
}
.em-rx-more {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px dashed var(--line2, rgba(0,0,0,0.18));
  background: var(--raised, rgba(0,0,0,0.03));
  color: var(--mute, #666);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex: none;
  font-size: 16px;
  margin-left: 2px;
  transition: background .15s, border-color .15s, color .15s;
}
.em-rx-more:hover {
  background: var(--accent-soft, rgba(79,70,229,0.1));
  border-color: var(--accent, #4f46e5);
  color: var(--accent, #4f46e5);
}

/* Full Expanded Emoji Palette Modal/Drawer */
.em-modal {
  position: fixed;
  z-index: 110;
  display: flex;
  flex-direction: column;
  background: var(--surface, #fff);
  border: 1px solid var(--line2, rgba(0,0,0,0.14));
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.25), 0 3px 12px rgba(0,0,0,0.1);
  width: min(340px, calc(100vw - 16px));
  max-height: min(400px, calc(100vh - 80px));
  overflow: hidden;
  animation: emPop .16s cubic-bezier(0.16, 1, 0.3, 1);
}
.em-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 8px;
  border-bottom: 1px solid var(--line, rgba(0,0,0,0.08));
  font-size: 13.5px;
  font-weight: 700;
  color: var(--mute, #666);
}
.em-modal-tabs {
  display: flex;
  gap: 4px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--line, rgba(0,0,0,0.06));
  overflow-x: auto;
  scrollbar-width: none;
  flex: none;
}
.em-modal-tabs::-webkit-scrollbar { display: none; }
.em-tab-btn {
  border: 0;
  background: transparent;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--mute, #777);
  white-space: nowrap;
  cursor: pointer;
  transition: background .12s, color .12s;
}
.em-tab-btn.active {
  background: var(--accent-soft, rgba(79,70,229,0.12));
  color: var(--accent, #4f46e5);
}
.em-grid-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px 12px;
  overscroll-behavior: contain;
}
.em-sec-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--faint, #999);
  margin: 6px 4px 4px;
}
.em-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}
.em-grid-btn {
  font-size: 22px;
  line-height: 1;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 0;
  transition: transform .1s, background .12s;
}
.em-grid-btn:hover {
  background: var(--raised, rgba(0,0,0,0.06));
  transform: scale(1.22);
}
.em-grid-btn:active {
  transform: scale(0.9);
}

@keyframes emPop {
  from { opacity: 0; transform: scale(0.92) translateY(4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

@media (max-width: 480px) {
  .em-rx-btn {
    font-size: 20px;
    width: 32px;
    height: 32px;
  }
  .em-grid-btn {
    font-size: 20px;
  }
  .em-modal {
    width: calc(100vw - 16px);
  }
}
 `;

 function injectStyles() {
  if (document.getElementById('emojis-css')) return;
  const s = document.createElement('style');
  s.id = 'emojis-css';
  s.textContent = CSS;
  document.head.appendChild(s);
 }

 let activeBarEl = null;
 let activeModalEl = null;
 let activeModalMode = null;
 let currentCallback = null;

 function closeAll() {
  if (activeBarEl) {
   activeBarEl.remove();
   activeBarEl = null;
  }
  if (activeModalEl) {
   activeModalEl.remove();
   activeModalEl = null;
  }
  activeModalMode = null;
  currentCallback = null;
  document.querySelectorAll('.emojibtn.active').forEach(b => b.classList.remove('active'));
 }

 function openReactionPicker(opts) {
  closeAll();
  if (window.Stickers && typeof window.Stickers.closePicker === 'function') {
   window.Stickers.closePicker();
  }
  injectStyles();
  const { anchor, onSelect, placement = 'top' } = opts;
  if (!anchor) return;
  currentCallback = onSelect;

  const bar = document.createElement('div');
  bar.id = 'rxPicker';
  bar.className = 'rx-picker em-rx-bar';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Pick emoji reaction');
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  bar.addEventListener('click', e => e.stopPropagation());

  // Quick reactions
  QUICK_REACTIONS.forEach(em => {
   const b = document.createElement('button');
   b.type = 'button';
   b.className = 'rx-pick-btn em-rx-btn';
   b.textContent = em;
   b.onclick = (e) => {
    e.stopPropagation();
    closeAll();
    if (onSelect) onSelect(em);
   };
   bar.appendChild(b);
  });

  // More button (+)
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'em-rx-more';
  more.title = 'More emojis';
  more.setAttribute('aria-label', 'More emojis');
  more.innerHTML = '<svg class="i" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  more.onclick = (e) => {
   e.stopPropagation();
   const anchorRect = bar.getBoundingClientRect();
   closeAll();
   openFullPicker({
    anchorRect,
    onSelect
   });
  };
  bar.appendChild(more);

  document.body.appendChild(bar);
  activeBarEl = bar;

  // Position cleanly inside viewport
  const r = anchor.getBoundingClientRect();
  const bw = bar.offsetWidth || 300;
  const bh = bar.offsetHeight || 44;

  let left = r.left + (r.width / 2) - (bw / 2);
  left = Math.max(8, Math.min(window.innerWidth - bw - 8, left));

  let top = (placement === 'bottom') ? (r.bottom + 8) : (r.top - bh - 8);
  if (top < 50) top = r.bottom + 8;
  if (top + bh > window.innerHeight - 10) top = Math.max(10, r.top - bh - 8);

  bar.style.left = Math.round(left) + 'px';
  bar.style.top = Math.round(top) + 'px';
 }

 function openFullPicker(opts) {
  closeAll();
  if (window.Stickers && typeof window.Stickers.closePicker === 'function') {
   window.Stickers.closePicker();
  }
  injectStyles();
  const { anchorRect, onSelect, mode = 'react' } = opts;
  activeModalMode = mode;
  currentCallback = onSelect;

  const modal = document.createElement('div');
  modal.className = 'em-modal';
  modal.id = 'emModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Emoji catalog');
  modal.addEventListener('pointerdown', e => e.stopPropagation());
  modal.addEventListener('click', e => e.stopPropagation());

  modal.innerHTML = `
   <div class="em-modal-head">
    <span>Pick an Emoji</span>
    <button type="button" class="em-tab-btn" id="emCloseBtn" style="padding:2px 6px">✕</button>
   </div>
   <div class="em-modal-tabs" id="emTabs"></div>
   <div class="em-grid-wrap" id="emGridWrap"></div>
  `;

  const tabsContainer = modal.querySelector('#emTabs');
  const gridWrap = modal.querySelector('#emGridWrap');
  modal.querySelector('#emCloseBtn').onclick = (e) => {
   e.stopPropagation();
   closeAll();
  };

  // Build Tabs & Sections
  CATEGORIES.forEach((cat, idx) => {
   const tabBtn = document.createElement('button');
   tabBtn.type = 'button';
   tabBtn.className = 'em-tab-btn' + (idx === 0 ? ' active' : '');
   tabBtn.textContent = cat.name;
   tabBtn.onclick = (e) => {
    e.stopPropagation();
    modal.querySelectorAll('.em-tab-btn').forEach(b => b.classList.remove('active'));
    tabBtn.classList.add('active');
    const secEl = modal.querySelector('#em-sec-' + cat.id);
    if (secEl) secEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
   };
   tabsContainer.appendChild(tabBtn);

   const sec = document.createElement('div');
   sec.id = 'em-sec-' + cat.id;
   sec.innerHTML = `<div class="em-sec-title">${cat.name}</div><div class="em-grid"></div>`;
   const grid = sec.querySelector('.em-grid');

   cat.emojis.forEach(em => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'em-grid-btn';
    btn.textContent = em;
    btn.title = em;
    btn.onclick = (e) => {
     e.stopPropagation();
     const cb = onSelect;
     closeAll();
     if (cb) cb(em);
    };
    grid.appendChild(btn);
   });

   gridWrap.appendChild(sec);
  });

  document.body.appendChild(modal);
  activeModalEl = modal;

  // Positioning
  const mw = modal.offsetWidth || 330;
  const mh = modal.offsetHeight || 380;
  let left = 8;
  let top = 60;

  if (anchorRect) {
   left = anchorRect.left + (anchorRect.width / 2) - (mw / 2);
   left = Math.max(8, Math.min(window.innerWidth - mw - 8, left));
   top = anchorRect.top - mh - 8;
   if (top < 50) top = anchorRect.bottom + 8;
   if (top + mh > window.innerHeight - 10) {
    top = Math.max(10, window.innerHeight - mh - 10);
   }
  } else {
   left = Math.max(8, (window.innerWidth - mw) / 2);
   top = Math.max(10, (window.innerHeight - mh) / 2);
  }

  modal.style.left = Math.round(left) + 'px';
  modal.style.top = Math.round(top) + 'px';
 }

 function openInsertPicker(opts) {
  const { anchor, inputEl, onInsert } = opts;
  if (activeModalEl && activeModalMode === 'insert') {
   closeAll();
   return;
  }
  const r = anchor ? anchor.getBoundingClientRect() : null;
  openFullPicker({
   anchorRect: r,
   mode: 'insert',
   onSelect: (emoji) => {
    const el = typeof inputEl === 'function' ? inputEl() : inputEl;
    if (el) {
     const start = el.selectionStart != null ? el.selectionStart : el.value.length;
     const end = el.selectionEnd != null ? el.selectionEnd : el.value.length;
     const val = el.value;
     el.value = val.slice(0, start) + emoji + val.slice(end);
     const nextPos = start + emoji.length;
     try {
      el.selectionStart = nextPos;
      el.selectionEnd = nextPos;
     } catch (_) {}
     el.focus();
     el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (onInsert) onInsert(emoji);
   }
  });
  if (anchor) anchor.classList.add('active');
 }

 // Global dismissal on outside click / escape / scroll
 document.addEventListener('pointerdown', (e) => {
  if (activeBarEl && !activeBarEl.contains(e.target) && !e.target.closest('.rx-btn, .rx-trigger, .rx-add-btn')) {
   if (!activeModalEl || !activeModalEl.contains(e.target)) {
    closeAll();
   }
  } else if (activeModalEl && !activeModalEl.contains(e.target) && !e.target.closest('.emojibtn, .em-rx-more')) {
   closeAll();
  }
 });

 window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAll();
 });

 window.Emojis = {
  QUICK: QUICK_REACTIONS,
  CATEGORIES,
  openReactionPicker,
  openFullPicker,
  openInsertPicker,
  close: closeAll
 };
})(window);
