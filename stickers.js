// stickers.js — Class Sticker Engine for APMed '33 Reviews & Discussions
// Provides shop sticker catalogs, sticker picker drawer, rendering, and zoom modal.
(function(window){
 'use strict';

 const CATALOGS = [
  { id: 7, name: 'Chiikawa in STEM', short: 'Chiikawa' },
  { id: 8, name: 'When in Med', short: 'Med' },
  { id: 9, name: 'EPIC the Musical', short: 'EPIC' },
  { id: 10, name: '20th Century Girl', short: '20th Century' },
  { id: 11, name: 'Zooa', short: 'Zooa' },
  { id: 12, name: 'Jam Sesh', short: 'Jam Sesh' }
 ];

 const ITEMS = [
  { id: 6, name: 'Hard Hat Momonga', image: 'items/b2181a8dbf7d482e.webp', catalog: 7 },
  { id: 7, name: 'Momonga Calc', image: 'items/365cb349eeed4161.webp', catalog: 7 },
  { id: 33, name: 'Shisa & Usagi', image: 'items/7264a523-4af1-4496-ae08-c22917275dec.webp', catalog: 7 },
  { id: 34, name: 'Kurimanju', image: 'items/4d7efb94-d70a-4682-ac75-f06bfa7397ae.webp', catalog: 7 },
  { id: 35, name: 'Rakko', image: 'items/19adc4dd-94de-4db2-8208-5cd6a4328cff.webp', catalog: 7 },
  { id: 8, name: 'APMed Pantone', image: 'items/6eec6673b54f465d.webp', catalog: 8 },
  { id: 9, name: 'Apple a Day', image: 'items/1aac9ae725594b5e.webp', catalog: 8 },
  { id: 36, name: 'Achievement: Psych', image: 'items/614a813f-c179-4c74-8e9f-5879bdbc1f4c.webp', catalog: 8 },
  { id: 37, name: 'Achievement: Chem', image: 'items/44ac2b42-1dff-4172-aee2-d3536811f098.webp', catalog: 8 },
  { id: 38, name: 'Nametag', image: 'items/229252a8-3252-4e58-91f1-e1af08c421bc.webp', catalog: 8 },
  { id: 10, name: 'Open Arms (lore accurate)', image: 'items/86511eaa6e13455c.webp', catalog: 9 },
  { id: 11, name: 'Open Arms (pink lotus)', image: 'items/522194a3107c49b0.webp', catalog: 9 },
  { id: 12, name: 'Luck Runs Out', image: 'items/3b11c06508ca44e5.webp', catalog: 9 },
  { id: 13, name: 'Would You Fall in Love with Me Again (olives)', image: 'items/19436f04f8f84f5e.webp', catalog: 9 },
  { id: 14, name: 'Would You Fall in Love with Me Again', image: 'items/9a32c84fd93f4841.webp', catalog: 9 },
  { id: 15, name: 'Just a Man', image: 'items/fef77e250ab7441a.webp', catalog: 9 },
  { id: 16, name: 'No Longer You', image: 'items/9c2f7c775bf74ecc.webp', catalog: 9 },
  { id: 17, name: 'How Could I Forget?', image: 'items/35f97f4df3194f0f.webp', catalog: 10 },
  { id: 18, name: 'Pager', image: 'items/11bbcae9bb8841d7.webp', catalog: 10 },
  { id: 19, name: 'Forget You Now', image: 'items/2d8c38a2080d480f.webp', catalog: 10 },
  { id: 20, name: 'Writing to You', image: 'items/81c1f83c798d458b.webp', catalog: 10 },
  { id: 21, name: 'My Heart Hurts a Little', image: 'items/a29a1b3d734a40f0.webp', catalog: 10 },
  { id: 22, name: 'Hold On a Bit Longer', image: 'items/a2750dfa9d1d4bc7.webp', catalog: 10 },
  { id: 23, name: 'I Think I Like You', image: 'items/47716f5d81a8457d.webp', catalog: 10 },
  { id: 24, name: 'Sacabambaspis', image: 'items/7bd6b7b247314ca2.webp', catalog: 11 },
  { id: 25, name: 'Duckling', image: 'items/7a9e7f5907564454.webp', catalog: 11 },
  { id: 26, name: 'Chubby Seal', image: 'items/72b0f680f7714a87.webp', catalog: 11 },
  { id: 27, name: 'Waving Seal', image: 'items/f9b8a7419ea2450e.webp', catalog: 11 },
  { id: 39, name: 'Shark', image: 'items/34b88c96-8784-4277-9046-f931ce70212c.webp', catalog: 11 },
  { id: 40, name: 'Sea Lion', image: 'items/ff5828d4-80ed-4d27-ade0-ba118d9b787b.webp', catalog: 11 },
  { id: 44, name: 'Greedy Beaver', image: 'items/7c362d83-075d-490d-8f78-ad1e1644c3c5.webp', catalog: 11 },
  { id: 45, name: 'Duck probably', image: 'items/8b1846f5-e3e1-490e-92f9-258149a77cca.webp', catalog: 11 },
  { id: 28, name: 'Gabriela', image: 'items/f31309cf6faf4b84.webp', catalog: 12 },
  { id: 29, name: 'Pinky Up', image: 'items/46d01d9f8d684d1d.webp', catalog: 12 },
  { id: 30, name: 'Expectations (Adored)', image: 'items/d7294fc78a1d46f5.webp', catalog: 12 },
  { id: 31, name: 'Picture You', image: 'items/b611d797406843e0.webp', catalog: 12 },
  { id: 32, name: 'Expectations (Passive)', image: 'items/01cb861bf9e94e7d.webp', catalog: 12 }
 ];

 const STICKER_REGEX = /\[sticker:(\d+)(?::([a-zA-Z0-9_\/.-]+))?(?::([^\]]+))?\]/g;

 const CSS = `
/* --- Stickers Styling --- */
.stkbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 10px;
  border: 1px solid var(--line, rgba(0,0,0,0.1));
  background: var(--surface, #fff);
  color: var(--mute, #666);
  cursor: pointer;
  transition: all 0.16s ease;
  flex-shrink: 0;
}
.stkbtn:hover {
  color: var(--accent, #0070f3);
  border-color: var(--accent, #0070f3);
  background: var(--raised, #f6f8fa);
  transform: translateY(-1px);
}
.stkbtn.active {
  background: var(--accent-soft, rgba(0,112,243,0.12));
  color: var(--accent, #0070f3);
  border-color: var(--accent, #0070f3);
}

/* Standalone Sticker in Messages */
.stk-standalone {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 4px;
  position: relative;
  user-select: none;
}
.stk-img {
  width: 140px;
  height: 140px;
  max-width: 48vw;
  max-height: 48vw;
  object-fit: contain;
  filter: drop-shadow(0 3px 6px rgba(0,0,0,0.16));
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: block;
}
.stk-standalone:hover .stk-img {
  transform: scale(1.08) rotate(1.2deg);
}
.stk-caption {
  position: absolute;
  bottom: 0px;
  left: 50%;
  transform: translate(-50%, 6px);
  background: color-mix(in srgb, var(--surface, #fff) 92%, var(--text, #000) 8%);
  color: var(--text, #111);
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 99px;
  border: 1px solid var(--line2, rgba(0,0,0,0.12));
  box-shadow: 0 4px 12px rgba(0,0,0,0.14);
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
  z-index: 10;
}
.stk-standalone:hover .stk-caption {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* Inline Sticker (Sticker + Text) */
.stk-inline-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stk-thumb {
  cursor: pointer;
  display: inline-block;
}
.stk-thumb-img {
  width: 100px;
  height: 100px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.14));
  transition: transform 0.18s ease;
  display: block;
}
.stk-thumb:hover .stk-thumb-img {
  transform: scale(1.06);
}
.stk-text {
  font-size: inherit;
  line-height: inherit;
  word-break: break-word;
}

/* Sticker Drawer / Popover */
.stk-drawer {
  position: absolute;
  z-index: 1000;
  width: 360px;
  max-width: calc(100vw - 24px);
  background: var(--surface, #fff);
  border: 1px solid var(--line2, rgba(0,0,0,0.14));
  border-radius: 18px;
  box-shadow: 0 12px 36px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: stkFadeIn 0.18s ease-out;
}
@keyframes stkFadeIn {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.stk-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--line, #eee);
  gap: 10px;
}
.stk-head-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text, #111);
  display: flex;
  align-items: center;
  gap: 6px;
}
.stk-shop-link {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--accent, #0070f3);
  text-decoration: none;
  background: var(--accent-soft, rgba(0,112,243,0.08));
  padding: 2px 8px;
  border-radius: 99px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.stk-shop-link:hover {
  filter: brightness(0.95);
}
.stk-close {
  background: none;
  border: none;
  color: var(--mute, #888);
  font-size: 18px;
  line-height: 1;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 6px;
}
.stk-close:hover {
  background: var(--raised, #eee);
  color: var(--text, #111);
}

.stk-tabs {
  display: flex;
  overflow-x: auto;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line, #eee);
  background: var(--raised, #fafafa);
  scrollbar-width: none;
}
.stk-tabs::-webkit-scrollbar { display: none; }
.stk-tab {
  background: none;
  border: 1px solid transparent;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 600;
  color: var(--mute, #666);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.14s ease;
}
.stk-tab:hover {
  background: var(--surface, #fff);
  color: var(--text, #111);
}
.stk-tab.active {
  background: var(--surface, #fff);
  color: var(--accent, #0070f3);
  border-color: var(--accent-line, rgba(0,112,243,0.3));
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.stk-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 12px;
  max-height: 280px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
@media (max-width: 480px) {
  .stk-grid {
    grid-template-columns: repeat(3, 1fr);
    max-height: 250px;
  }
}
.stk-item {
  background: none;
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.16s ease;
}
.stk-item:hover {
  background: var(--raised, #f5f5f5);
  border-color: var(--line, #ddd);
  transform: translateY(-2px);
}
.stk-item img {
  width: 58px;
  height: 58px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.12));
  transition: transform 0.16s ease;
}
.stk-item:hover img {
  transform: scale(1.12);
}
.stk-item span {
  font-size: 10px;
  font-weight: 600;
  color: var(--mute, #777);
  text-align: center;
  max-width: 68px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Zoom Modal */
.stk-zoom-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: stkZoomFade 0.16s ease-out;
}
@keyframes stkZoomFade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.stk-zoom-card {
  background: var(--surface, #fff);
  border: 1px solid var(--line2, rgba(255,255,255,0.1));
  border-radius: 20px;
  padding: 24px;
  max-width: 340px;
  width: 100%;
  text-align: center;
  box-shadow: 0 16px 40px rgba(0,0,0,0.3);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: stkZoomPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes stkZoomPop {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}
.stk-zoom-img {
  width: 180px;
  height: 180px;
  object-fit: contain;
  filter: drop-shadow(0 8px 16px rgba(0,0,0,0.18));
  margin-bottom: 12px;
}
.stk-zoom-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--text, #111);
  margin: 0 0 4px;
}
.stk-zoom-cat {
  font-size: 13px;
  color: var(--mute, #888);
  margin: 0 0 16px;
}
.stk-zoom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px 16px;
  border-radius: 12px;
  background: var(--accent, #0070f3);
  color: var(--accent-ink, #fff);
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,112,243,0.25);
  transition: opacity 0.16s ease;
}
.stk-zoom-btn:hover {
  opacity: 0.92;
}
.stk-zoom-x {
  position: absolute;
  top: 10px;
  right: 12px;
  background: none;
  border: none;
  color: var(--mute, #888);
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}
`;

 function injectStyles() {
  if (document.getElementById('stkStyles')) return;
  const style = document.createElement('style');
  style.id = 'stkStyles';
  style.textContent = CSS;
  document.head.appendChild(style);
 }

 const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
 }[c]));

 const Stickers = {
  CATALOGS: CATALOGS.slice(),
  ITEMS: ITEMS.slice(),
  currentDrawer: null,

  init() {
   injectStyles();
   this.syncCatalog();
  },

  async syncCatalog() {
   try {
    if (window.Auth && typeof Auth.rpc === 'function') {
     const cat = await Auth.rpc('shop_catalog', {}, false);
     if (cat && Array.isArray(cat.items) && cat.items.length) {
      const liveItems = cat.items.filter(i => i.image).map(i => ({
       id: i.id,
       name: i.name,
       image: i.image,
       catalog: i.catalog
      }));
      if (liveItems.length >= 10) {
       this.ITEMS = liveItems;
      }
      if (Array.isArray(cat.catalogs) && cat.catalogs.length) {
       this.CATALOGS = cat.catalogs.map(c => ({
        id: c.id,
        name: c.name,
        short: c.name.split(' ')[0]
       }));
      }
     }
    }
   } catch (e) {
    // keep fallback built-ins on error or offline
   }
  },

  imgUrl(p) {
   if (!p) return '';
   const base = (window.Auth && typeof Auth.base === 'function')
    ? Auth.base()
    : 'https://olvjhdxmdrtuktfxgjsu.supabase.co';
   return base + '/storage/v1/object/public/shop/' + p.split('/').map(encodeURIComponent).join('/');
  },

  get(id) {
   return this.ITEMS.find(it => it.id === +id) || null;
  },

  getCatName(catId) {
   const c = this.CATALOGS.find(cat => cat.id === +catId);
   return c ? c.name : 'Stickers';
  },

  parse(body) {
   if (!body || typeof body !== 'string') return null;
   const str = body.trim();
   const matches = [...str.matchAll(STICKER_REGEX)];
   if (!matches.length) return null;

   const m0 = matches[0];
   const id = +m0[1];
   let it = this.get(id);
   const img = m0[2] || (it ? it.image : '');
   const name = m0[3] || (it ? it.name : `Sticker #${id}`);

   // Check if pure sticker message
   const pure = str === m0[0];
   const cleanText = str.replace(STICKER_REGEX, '').trim();

   return {
    isPure: pure,
    id,
    image: img,
    name,
    cleanText,
    all: matches.map(m => {
     const i = +m[1];
     const found = this.get(i);
     return {
      id: i,
      image: m[2] || (found ? found.image : ''),
      name: m[3] || (found ? found.name : `Sticker #${i}`)
     };
    })
   };
  },

  cleanSnippet(body) {
   if (!body || typeof body !== 'string') return '';
   return body.replace(STICKER_REGEX, (match, id, img, name) => {
    const it = Stickers.get(+id);
    const n = name || (it ? it.name : 'Sticker');
    return `🎨 Sticker: ${n}`;
   }).trim();
  },

  render(body, textFormatter) {
   if (!body) return '';
   const p = this.parse(body);
   if (!p) {
    return textFormatter ? textFormatter(body) : esc(body);
   }

   const url = this.imgUrl(p.image);

   if (p.isPure) {
    return `<div class="stk-standalone" onclick="Stickers.zoom(${p.id})" role="button" title="${esc(p.name)}">` +
      `<img class="stk-img" src="${esc(url)}" alt="${esc(p.name)}" loading="lazy">` +
      `<span class="stk-caption">${esc(p.name)}</span>` +
     `</div>`;
   }

   const formattedRemainder = textFormatter ? textFormatter(p.cleanText) : esc(p.cleanText);

   return `<div class="stk-inline-block">` +
     `<div class="stk-thumb" onclick="Stickers.zoom(${p.id})" role="button" title="${esc(p.name)}">` +
      `<img class="stk-thumb-img" src="${esc(url)}" alt="${esc(p.name)}" loading="lazy">` +
     `</div>` +
     (formattedRemainder ? `<div class="stk-text">${formattedRemainder}</div>` : '') +
    `</div>`;
  },

  zoom(id) {
   const it = this.get(id);
   const name = it ? it.name : `Sticker #${id}`;
   const img = it ? this.imgUrl(it.image) : '';
   const catName = it ? this.getCatName(it.catalog) : 'Class Sticker Shop';

   const el = document.createElement('div');
   el.className = 'stk-zoom-overlay';
   el.innerHTML = `
    <div class="stk-zoom-card" onclick="event.stopPropagation()">
     <button class="stk-zoom-x" onclick="this.closest('.stk-zoom-overlay').remove()" aria-label="Close">✕</button>
     <img class="stk-zoom-img" src="${esc(img)}" alt="${esc(name)}">
     <h3 class="stk-zoom-name">${esc(name)}</h3>
     <p class="stk-zoom-cat">${esc(catName)} · Class fund</p>
     <a class="stk-zoom-btn" href="shop.html" target="_blank" rel="noopener">
      View in Sticker Shop (₱5) →
     </a>
    </div>
   `;
   el.onclick = () => el.remove();
   const onKey = e => { if (e.key === 'Escape') { el.remove(); document.removeEventListener('keydown', onKey); } };
   document.addEventListener('keydown', onKey);
   document.body.appendChild(el);
  },

  togglePicker(opts) {
   if (this.currentDrawer) {
    this.closePicker();
    return;
   }
   this.openPicker(opts);
  },

  openPicker(opts) {
   const { anchor, onSelect } = opts;
   injectStyles();

   if (this.currentDrawer) this.closePicker();

   const drawer = document.createElement('div');
   drawer.className = 'stk-drawer';
   drawer.id = 'stkDrawer';

   const tabsHtml = [
    `<button class="stk-tab active" data-cat="all">All</button>`
   ].concat(this.CATALOGS.map(c =>
    `<button class="stk-tab" data-cat="${c.id}">${esc(c.short || c.name)}</button>`
   )).join('');

   drawer.innerHTML = `
    <div class="stk-head">
     <span class="stk-head-title">
      <svg class="i" width="16" height="16" style="vertical-align:text-bottom"><use href="icons.svg#i-sticker"/></svg>
      Stickers
      <a class="stk-shop-link" href="shop.html" target="_blank" rel="noopener" title="Visit Diary of a Stickerholic shop">Shop ₱5 ↗</a>
     </span>
     <button class="stk-close" id="stkCloseBtn" type="button" aria-label="Close picker">✕</button>
    </div>
    <div class="stk-tabs" id="stkTabs">${tabsHtml}</div>
    <div class="stk-grid" id="stkGrid"></div>
   `;

   const renderGrid = catId => {
    drawer.querySelectorAll('.stk-tab').forEach(b => {
     b.classList.toggle('active', b.dataset.cat === String(catId));
    });

    const filtered = catId === 'all'
     ? this.ITEMS
     : this.ITEMS.filter(it => it.catalog === +catId);

    const grid = drawer.querySelector('#stkGrid');
    grid.innerHTML = filtered.map(it => `
     <button class="stk-item" data-id="${it.id}" type="button" title="${esc(it.name)}">
      <img src="${esc(this.imgUrl(it.image))}" alt="${esc(it.name)}" loading="lazy">
      <span>${esc(it.name)}</span>
     </button>
    `).join('');

    grid.querySelectorAll('.stk-item').forEach(b => {
     b.onclick = () => {
      const id = +b.dataset.id;
      const item = Stickers.get(id);
      if (item && onSelect) {
       onSelect(item);
      }
      Stickers.closePicker();
     };
    });
   };

   renderGrid('all');

   drawer.querySelector('#stkCloseBtn').onclick = () => this.closePicker();
   drawer.querySelectorAll('.stk-tab').forEach(b => {
    b.onclick = () => renderGrid(b.dataset.cat);
   });
   drawer.addEventListener('click', e => e.stopPropagation());

   // Positioning above anchor
   document.body.appendChild(drawer);
   this.currentDrawer = drawer;

   if (anchor) {
    anchor.classList.add('active');
    const r = anchor.getBoundingClientRect();
    const dW = drawer.offsetWidth || 360;
    const dH = drawer.offsetHeight || 340;

    let left = r.left;
    if (left + dW > window.innerWidth - 12) {
     left = window.innerWidth - dW - 12;
    }
    if (left < 12) left = 12;

    let top = r.top - dH - 8;
    if (top < 10) {
     top = r.bottom + 8;
    }

    drawer.style.left = `${Math.round(left)}px`;
    drawer.style.top = `${Math.round(top)}px`;
   } else {
    drawer.style.position = 'fixed';
    drawer.style.bottom = '80px';
    drawer.style.left = '50%';
    drawer.style.transform = 'translateX(-50%)';
   }

   const onDocClick = e => {
    if (!drawer.contains(e.target) && (!anchor || !anchor.contains(e.target))) {
     Stickers.closePicker();
     document.removeEventListener('click', onDocClick);
    }
   };
   setTimeout(() => document.addEventListener('click', onDocClick), 20);

   const onEsc = e => {
    if (e.key === 'Escape') {
     Stickers.closePicker();
     document.removeEventListener('keydown', onEsc);
    }
   };
   document.addEventListener('keydown', onEsc);
  },

  closePicker() {
   if (this.currentDrawer) {
    this.currentDrawer.remove();
    this.currentDrawer = null;
   }
   document.querySelectorAll('.stkbtn.active').forEach(b => b.classList.remove('active'));
  }
 };

 if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Stickers.init());
 } else {
  Stickers.init();
 }

 window.Stickers = Stickers;
})(window);
