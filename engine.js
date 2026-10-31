/* =====================================================================
   ENGINE: no need to edit below this line.
   ===================================================================== */
// Safety net: if the app fails while starting, forget only where you were (section, question, page) and reload once.
// Progress is untouched. __recovered stops a reload loop and is cleared after a good start.
const APP_VERSION='104',APP_DATE='Oct 31, 2026';   // shown in Personalize, so "is the fix there yet?" is easy to check
let BOOTED=false;
let PV=0,PC={v:-1,list:new Map(),prog:new Map()};   // remembered section counts (see inSection)
addEventListener('error',()=>{if(BOOTED)return;try{const k=CONFIG.storageKey,s=JSON.parse(localStorage.getItem(k));if(s&&!s.__recovered){
 Object.assign(s,{section:null,active:null,feedback:null,selected:null,pmatch:null,pass:null,page:'dashboard',exam:s.exam&&!s.exam.done?s.exam:null,__recovered:1});
 localStorage.setItem(k,JSON.stringify(s));location.reload()}}catch(e){}});
/* ---------- question sets added in this browser (Personalize → Question banks → Add a set) ---------- */
// Saved as text under "<storageKey>_sets" as [{id, name, ch, text}]; each set becomes its own bank tab.
const SETS_KEY=CONFIG.storageKey+'_sets',COURSE_SECS=Object.assign({},CONFIG.sections),COURSE_CH=Object.assign({},CONFIG.chapters);
let USER_SETS=[],CHAL=null;try{USER_SETS=JSON.parse(localStorage.getItem(SETS_KEY))||[]}catch(e){}
// Topics that start with a section id of the course ("# 1-2") go into that section; any other topic becomes a
// section of the set's own group (id = a letter, e.g. "A-1").
function userBank(s){const p=parseSet(s.text),secs={},seen={};let n=0;
 const items=p.items.map(it=>{const m=it.topic.match(/^(\S+)/);let sec=m&&COURSE_SECS[m[1]]?m[1]:null;
  if(!sec){const t=it.topic||'All questions';if(!secs[t]){secs[t]=s.ch+'-'+(++n);CONFIG.sections[secs[t]]=t}sec=secs[t]}
  let id=s.id+'_'+stableHash(it.q).toString(36);while(seen[id])id+='x';seen[id]=1;
  return {id,section:sec,kind:'recall',term:it.a.length>60?it.a.slice(0,57)+'…':it.a,q:it.q,a:it.a,d:it.d,why:it.why,hint:it.hint,...(it.ident?{type:'id'}:{})}});
 if(n)CONFIG.chapters[s.ch]=s.name;
 return {id:s.id,name:s.name,desc:'Your set, saved in this browser',items,user:true}}
// Reads "Q: / A: / X:" lines, numbered questions with lettered choices (right one marked with *),
// or a table: CSV, or cells pasted from a spreadsheet. "# Topic" starts a topic.
function parseSet(text){text=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 const out={items:[],problems:[],name:''},lines=text.split('\n'),ne=lines.filter(l=>l.trim()&&!/^\s*(#|\/\/)/.test(l));
 const qish=ne.some(l=>/^\s*((q|question)\s*[:.]|\d+\s*[.)])/i.test(l)),tabbed=ne.length&&ne.every(l=>l.includes('\t'));
 if(tabbed||!qish&&ne.length&&ne.filter(l=>(l.match(/,/g)||[]).length>=2).length>=ne.length*.6)return parseTable(text,tabbed?'\t':',',out);
 const low=x=>String(x).toLowerCase().replace(/\s+/g,' ').trim();let cur=null,topic='',ln=0;
 const fin=()=>{if(!cur)return;const q=cur,where='Line '+q.line+': ';cur=null;let a=q.ans,d=q.d.slice();
  if(q.ch.length){const mk=q.ch.filter(c=>c.right);let r=mk.length===1?mk[0]:null;
   if(mk.length>1){out.problems.push(where+'more than one choice is marked with *.');return}
   if(!r&&q.ans){const L=q.ans.match(/^\(?([a-e])\)?\.?$/i);r=L?q.ch.find(c=>c.l===L[1].toLowerCase()):q.ch.find(c=>low(c.t)===low(q.ans))}
   if(!r){out.problems.push(where+'no right answer. Mark it with * or add an "Answer:" line.');return}
   a=r.t;d=q.ch.filter(c=>c!==r).map(c=>c.t).concat(d)}
  else if(!a){out.problems.push(where+'no answer. Add an "A:" line.');return}
  addItem(out,where,{q:q.q,a,d,why:q.why,hint:q.hint,topic})};
 for(const raw of lines){ln++;const l=raw.trim();let m;if(!l||l.startsWith('//'))continue;
  if(m=l.match(/^#+\s*(.*)$/)){fin();topic=m[1].trim();continue}
  if(!cur&&!out.items.length&&(m=l.match(/^(?:name|set|title)\s*:\s*(.+)$/i))){out.name=m[1].trim();continue}
  if(m=l.match(/^(?:q|question)\s*[:.]\s*(.*)$/i)||l.match(/^\d+\s*[.)]\s*(.+)$/)){fin();cur={q:m[1].trim(),ans:'',d:[],ch:[],why:'',hint:'',last:'q',line:ln};continue}
  if(!cur){out.problems.push('Line '+ln+': “'+l.slice(0,40)+'” is not part of a question. Start each question with Q: or a number.');continue}
  if(m=l.match(/^(?:a|ans|answer|correct(?: answer)?|key)\s*:\s*(.*)$/i)){cur.ans=m[1].replace(/^\*\s*|\s*\*$/g,'').trim();cur.last='';continue}
  if(m=l.match(/^(?:x|w|d|wrong|distractor)\s*:\s*(.*)$/i)){if(m[1].trim())cur.d.push(m[1].trim());cur.last='';continue}
  if(m=l.match(/^(?:why|explanation|because)\s*:\s*(.*)$/i)){cur.why=m[1].trim();cur.last='why';continue}
  if(m=l.match(/^hint\s*:\s*(.*)$/i)){cur.hint=m[1].trim();cur.last='hint';continue}
  if(m=l.match(/^(\*?)\s*\(?([a-e])[.)]\s*(.+)$/i)){let t=m[3].trim(),right=!!m[1];
   if(/(\s\*|\(correct\)|✓)$/i.test(t)){right=true;t=t.replace(/\s*(\*|\(correct\)|✓)$/i,'')}
   cur.ch.push({l:m[2].toLowerCase(),t,right});cur.last='';continue}
  // Any other line continues the question, the explanation or the hint.
  if(cur.last==='q'||cur.last==='why'||cur.last==='hint')cur[cur.last]+=' '+l;
  else out.problems.push('Line '+ln+': “'+l.slice(0,40)+'” was not understood.')}
 fin();out.problems.sort((a,b)=>parseInt(a.match(/\d+/))-parseInt(b.match(/\d+/)));return out}
function parseTable(text,sep,out){const rows=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c}
  else if(c==='"'&&!cell.trim()){q=true;cell=''}
  else if(c===sep){row.push(cell);cell=''}
  else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell=''}
  else cell+=c}
 row.push(cell);rows.push(row);
 const R=rows.map(r=>r.map(x=>x.trim())).filter(r=>r.some(Boolean)&&!/^(#|\/\/)/.test(r[0]));if(!R.length)return out;
 const H=R[0].map(h=>h.toLowerCase().replace(/[^a-z]/g,'')),head=H.includes('question')||H.includes('q');
 const at=re=>H.findIndex(h=>re.test(h)),isOpt=h=>/^([a-e]|option[a-e]?|choice[a-e]?|wrong[a-z]*|distractor[a-z]*|incorrect[a-z]*)$/.test(h);
 let qi=0,ai=1,oi=[2,3,4,5,6],yi=-1,hi=-1,ti=-1,lt=[];
 if(head){qi=at(/^(question|q)$/);ai=at(/^(answer|correct|right|key|ans)/);oi=H.map((h,i)=>isOpt(h)?i:-1).filter(i=>i>=0);
  lt=oi.map(i=>(H[i].match(/^(?:option|choice)?([a-e])$/)||[])[1]||'');yi=at(/^(why|explanation|because|rationale)/);hi=at(/^hint/);ti=at(/^(topic|section|chapter|lesson|unit)/)}
 R.slice(head?1:0).forEach((r,k)=>{const g=i=>i>=0&&i<r.length?r[i]:'';let a=g(ai),d=oi.map(g);
  // An answer like "B" points at the column named B (or Option B).
  const L=a.match(/^\(?([a-e])\)?\.?$/i),li=L?lt.indexOf(L[1].toLowerCase()):-1;if(li>=0){a=d[li];d=d.filter((_,i)=>i!==li)}
  addItem(out,'Row '+(k+(head?2:1))+': ',{q:g(qi),a,d,why:g(yi),hint:g(hi),topic:g(ti)})});
 return out}
function addItem(out,where,it){const low=x=>String(x).toLowerCase().replace(/\s+/g,' ').trim(),q=String(it.q||'').trim(),a=String(it.a||'').trim();
 if(!q){out.problems.push(where+'the question is missing.');return}
 if(!a){out.problems.push(where+'there is no answer.');return}
 let d=it.d.map(x=>String(x||'').trim()).filter((x,i,arr)=>x&&low(x)!==low(a)&&arr.findIndex(y=>low(y)===low(x))===i);
 if(d.length>4){out.problems.push(where+'has more than 5 choices, so only the first 4 wrong ones are kept.');d=d.slice(0,4)}
 out.items.push({q,a,d,ident:!d.length,why:String(it.why||'').trim(),hint:String(it.hint||'').trim(),topic:String(it.topic||'').trim()})}
// The text a set is saved and exported as (any format you paste is turned into this).
function setText(items){let t='',top=null;
 items.forEach(it=>{if(it.topic!==top){const was=top;top=it.topic;if(top||was!==null)t+='\n# '+(top||'All questions')+'\n'}
  t+='\nQ: '+it.q+'\nA: '+it.a+'\n'+it.d.map(x=>'X: '+x+'\n').join('')+(it.why?'Why: '+it.why+'\n':'')+(it.hint?'Hint: '+it.hint+'\n':'')});
 return t.trim()+'\n'}
/* ---------- class questions: suggestions a moderator approved (see "class contributions" further down) ----------
   Cached under "<storageKey>_contrib" as {at, items, gone} and refreshed from the cloud. They join the Main bank in their
   section as kind "class". Ones the moderator later took out stay in "gone" (retired: known, but never asked again). */
// v72: the questions in the course file itself (what the AI explain function can look up): not class questions or your own sets
const FILE_IDS=new Set(FULL_BANK.map(c=>String(c.id)).concat((typeof VARIANTS!=='undefined'?VARIANTS:[]).flatMap(v=>(v.items||[]).map(c=>String(c.id)))));
const CONTRIB_KEY=CONFIG.storageKey+'_contrib';let CONTRIB={at:0,items:[],gone:[]};
try{CONTRIB=Object.assign(CONTRIB,JSON.parse(localStorage.getItem(CONTRIB_KEY)))}catch(e){}
// Wrong choices a class question gets: the course's usual number (3 for A–D).
const CONTRIB_ND=(()=>{const n={};FULL_BANK.forEach(c=>{const k=(c.d||[]).length;if(k)n[k]=(n[k]||0)+1});const k=+Object.keys(n).sort((a,b)=>n[b]-n[a])[0]||3;return Math.min(4,Math.max(2,k))})();
function contribItem(c,retired){if(!c||!/^cc_\d+$/.test(c.id)||!c.q||!c.a||!(c.section in COURSE_SECS))return null;
 const d=(Array.isArray(c.d)?c.d:[]).map(x=>String(x).trim()).filter(Boolean).slice(0,CONTRIB_ND),a=String(c.a),by=String(c.by||'').trim();if(!d.length)return null;
 return {id:c.id,section:c.section,kind:'class',term:a.length>60?a.slice(0,57)+'…':a,q:String(c.q),a,d,
  why:((by?'Suggested by '+by+'.':'Suggested by a classmate.')+' '+String(c.why||'')).trim(),hint:String(c.hint||''),...(retired?{retired:true}:{})}}
if(CONFIG.cloud&&CONFIG.cloud.url){const have=new Set(FULL_BANK.map(c=>c.id));
 [[CONTRIB.items,false],[CONTRIB.gone,true]].forEach(([list,ret])=>(list||[]).forEach(c=>{const it=contribItem(c,ret);if(it&&!have.has(it.id)){have.add(it.id);FULL_BANK.push(it)}}))}
const USER_BANKS=USER_SETS.map(userBank).filter(b=>b.items.length);
const BANKS=[{id:'main',name:'Main',desc:'The full reviewer',items:FULL_BANK}].concat(typeof VARIANTS!=='undefined'?VARIANTS:[],USER_BANKS);
const ALL_ITEMS=BANKS.flatMap(b=>b.items);
const SECTION_NAMES=CONFIG.sections,CH_NAMES=CONFIG.chapters;
const ALL_SECTIONS=Object.keys(SECTION_NAMES),ALL_CHAPTERS=Object.keys(CH_NAMES);
const chOf=s=>String(s).split('-')[0];              // chapter id of a section id like "12-3"
const isCh=s=>String(s).startsWith('CH:');          // "CH:3" = the entire chapter 3 as one quiz
const isX=s=>s==='ALL'||s==='MISSED'||s==='STAR'||s==='DUE'||s==='CLASS'||s==='CRAM'; // modes that mix every chapter
const secCh=s=>isCh(s)?s.slice(3):chOf(s);
const KEY=CONFIG.storageKey;
// v98 flashcards: each card's memory, apart from state.concepts, in "<storageKey>_cards" = {v:1, c:{card id: [stability, difficulty,
// due, last, reps, lapses, state, step]} (times in minutes), day:[study day, new, reviews, extra new], h:{study day:[reviews, again]}}.
// cards.js schedules; sync carries it as "fc" (+ "fcd" today's counts, "fch" the review log).
const FC_KEY=KEY+'_cards';
let FC=(()=>{try{const o=JSON.parse(localStorage.getItem(FC_KEY));if(o&&o.v===1&&o.c&&typeof o.c==='object')return o}catch(e){}return {v:1,c:{},day:['',0,0,0]}})();
// v100: FC.sus = {card id: [1 suspended / 0, time]}. Own cards: "<storageKey>_mycards" = {v:1, c:[{i:'u…', c: chapter, t: topic,
// f/b (basic) or x (cloze text) + b (extra), k: 'b'|'c', at: last change, sug: suggestion id, del: 1 = deleted (kept 60 days for sync)}]}.
const MC_KEY=KEY+'_mycards';
let MYC=(()=>{try{const o=JSON.parse(localStorage.getItem(MC_KEY));if(o&&o.v===1&&Array.isArray(o.c))return o}catch(e){}return {v:1,c:[]}})();
function mcSave(){const cut=Date.now()-60*864e5;MYC.c=MYC.c.filter(m=>!m.del||m.at>cut);try{localStorage.setItem(MC_KEY,JSON.stringify(MYC))}catch(e){STORE_FULL=true;storeWarn()}
 if(syncCode&&!syncHold&&cloudOn()){clearTimeout(syncT);syncT=setTimeout(syncNow,15000)}}
function fcAddMine(card){const m=Object.assign({i:'u'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),at:Date.now()},card);MYC.c.push(m);mcSave();return m}
// Practice: after a wrong answer, "+ Flashcard" turns the question into one of your own cards
function fcMakeHTML(q,fb){if(!pageOn('cards')||fb.correct||fb.lookup||!q.cid||!byId[q.cid])return '';const done=MYC.c.some(m=>m.src===q.cid&&!m.del);
 return '<button class="btn sm fcmk" onclick="fcFromQ(\''+esc(String(q.cid))+'\')"'+(done?' disabled':'')+'>'+(done?'Card added ✓':'+ Flashcard')+'</button>'}
function fcFromQ(cid){const it=byId[cid];if(!it||MYC.c.some(m=>m.src===cid&&!m.del))return;const a=it.q?it.a:it.definition||it.a;
 fcAddMine({c:secCh(it.section),t:SECTION_NAMES[it.section]||'',f:it.q||it.term,b:String(a||'')+(it.why?'\n\n'+it.why:''),k:'b',src:cid});toast('Added to your flashcards (Flashcards → My cards).');draw()}
// Storage missing or full: the cards keep working in memory, and the same warning as for answers comes up.
function fcSave(){const put=()=>{try{localStorage.setItem(FC_KEY,JSON.stringify(FC));return true}catch(e){return false}};let ok=put();if(!ok){freeSpace();ok=put()}
 if(ok===STORE_FULL){STORE_FULL=!ok;storeWarn()}
 if(syncCode&&!syncHold&&cloudOn()){clearTimeout(syncT);syncT=setTimeout(syncNow,15000)}return ok}
// Cloud (optional): CONFIG.cloud = {url, key} turns on class stats and device sync (see "cloud" further down).
const CLOUD=CONFIG.cloud||{},cloudOn=()=>!!(CLOUD.url&&CLOUD.key),SYNC_KEY='reviewer_sync',CLASS_MIN=5,CLASS_TOP=20;
const STATS_RESET=1792717361073; // class stats saved before this moment are refetched at once (bump to force a refresh)
let prefSigLast=null,lastPutSig='',syncBoot=true,CSTATS=null,classMemo={k:'',list:[]},crowdQ=[],crowdT=null,syncCode='',syncT=null,syncBusy=false,syncHold=false,syncEntry=false,syncInfo={at:0,err:''};
try{CSTATS=JSON.parse(localStorage.getItem(KEY+'_class'))}catch(e){}
try{syncCode=(JSON.parse(localStorage.getItem(SYNC_KEY))||{}).code||'';syncInfo.at=+localStorage.getItem(KEY+'_synced')||0}catch(e){}
syncBoot=!!syncCode;
const ITEM=CONFIG.itemWord||'concept',ITEMS=ITEM+'s',Items=ITEMS.charAt(0).toUpperCase()+ITEMS.slice(1);
const UNIT=CONFIG.unit||'Chapter',unitW=UNIT.toLowerCase(),unitsW=unitW+'s';
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
const chLabel=ch=>ch in COURSE_CH?UNIT+' '+ch:'Set '+ch; // a set's own topics are grouped under a letter
const NOTES_DATA=typeof NOTES!=='undefined'&&NOTES.length?NOTES:null;
const MSETS=(typeof MATCHING!=='undefined'?MATCHING:[]).map((m,i)=>({i,ch:String(m[0]),title:m[1],options:m[2],items:m[3]}));
const MIXUP=(typeof CONFUSABLES!=='undefined'?CONFUSABLES:[]).map(([ch,members,sec],i)=>({i,ch:String(ch),sec,members:members.map(([name,cues])=>({name,cues}))})).filter(g=>g.members.length>1);
// Reference charts (e.g. a consonant chart the real exam also provides): [{title, html}]
const CHART_DATA=typeof CHARTS!=='undefined'?CHARTS:[];let chartTab=0;
// Structure drawings: MOLECULES = {key: svg}. An item's fig (a key or [keys], with figsep between) shows under the question;
// a choice written "@m:key" is drawn as that structure. SVGs use currentColor, so they follow light and dark themes.
const MOLS=typeof MOLECULES!=='undefined'&&MOLECULES?MOLECULES:{};
const isMol=t=>typeof t==='string'&&t.startsWith('@m:');
const molq=q=>!!q&&q.choices.length>0&&q.choices.every(x=>isMol(x.label));
function labelHTML(t){return isMol(t)?'<span class="molc" role="img" aria-label="Structure">'+(MOLS[t.slice(3)]||'')+'</span>':esc(t)}
function labelText(t){return isMol(t)?'(structure)':t}
function ansHTML(t){const m=String(t).match(/^([A-E])\. (@m:.+)$/);return m?m[1]+'. <span class="molc sm" role="img" aria-label="Structure">'+(MOLS[m[2].slice(3)]||'')+'</span>':isMol(t)?labelHTML(t).replace('class="molc"','class="molc sm"'):esc(t)}
function figHTML(cid){const c=byId[cid],f=c&&c.fig;if(!f)return '';const ks=[].concat(f);
 return '<figure class="qfig'+(ks.length>1?' two':'')+'" role="img" aria-label="'+esc(c.figlabel||(MATH?'Figure':'Structure'))+'">'+ks.map((k,i)=>(i?'<span class="figsep">'+esc(c.figsep||'and')+'</span>':'')+'<span class="mol"'+molW(k)+'>'+(MOLS[k]||'')+'</span>').join('')+'</figure>'}
function molW(k){const m=/data-w='(\d+)'|viewBox='0 0 ([\d.]+)/.exec(MOLS[k]||'');return m?' style="flex-basis:'+Math.round(+(m[1]||m[2]))+'px"':''}
const GOALS=CONFIG.recallGoals||[1,2];
const MLETTERS='ABCDEFGHIJKL';
/* ---------- math courses (CONFIG.math) ----------
   Write equations as $…$ (inline) or $$…$$ (on their own) in questions, choices, explanations, hints, steps and notes.
   KaTeX renders them after every redraw; without a connection the TeX source stays readable as plain text. */
const MATH=!!CONFIG.math;
function mathBoot(){if(!MATH||window.__mathBoot)return;window.__mathBoot=1;const V='0.16.9',B='https://cdnjs.cloudflare.com/ajax/libs/KaTeX/'+V+'/';
 const l=document.createElement('link');l.rel='stylesheet';l.href=B+'katex.min.css';document.head.appendChild(l);
 const add=(src,cb)=>{const s=document.createElement('script');s.src=src;s.defer=true;s.onload=cb;document.head.appendChild(s)};
 add(B+'katex.min.js',()=>add(B+'contrib/auto-render.min.js',()=>{mathRender();new MutationObserver(ms=>{for(const m of ms){const el=m.type==='characterData'?m.target.parentElement:m.target;if(el&&el.nodeType===1&&!(el.closest&&el.closest('.katex')))mathQ.add(el)}if(mathQ.size&&!mathT)mathT=requestAnimationFrame(mathRender)}).observe(document.body,{childList:true,subtree:true,characterData:true})}))}
// v70: only the elements that changed since the last pass are rendered (it used to scan the whole page after every change)
let mathT=0,mathBusy=false,mathQ=new Set(),mathFirst=true;
function mathRender(){mathT=0;if(mathBusy||typeof renderMathInElement!=='function')return;mathBusy=true;
 const roots=mathFirst?[document.body]:[...mathQ].filter(el=>el.isConnected&&![...mathQ].some(o=>o!==el&&o.contains(el)));mathQ.clear();mathFirst=false;
 const opts={delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'$',right:'$',display:false},{left:'\\(',right:'\\)',display:false}],
  ignoredTags:['script','noscript','style','textarea','pre','code','option','input'],ignoredClasses:['nomath'],throwOnError:false,strict:false};
 for(const r of roots){try{renderMathInElement(r,opts)}catch(e){}}
 // KaTeX's own changes come back through the observer once; that pass finds nothing left to render and stops
 mathBusy=false;if(mathQ.size&&!mathT)mathT=requestAnimationFrame(mathRender)}
mathBoot();
// Numeric answers: an item with "num" accepts any typed number within "tol" (default 1% or 0.005, whichever is bigger).
function numIn(s){s=String(s).replace(/[−–]/g,'-').replace(/(\d)[,\s](?=\d{3}(?!\d))/g,'$1');if(s.includes('='))s=s.slice(s.lastIndexOf('=')+1);
 let m=s.match(/(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)/);if(m&&+m[4])return (m[1]?-1:1)*(+m[2]+(+m[3])/(+m[4]));   // 1 1/2
 m=s.match(/(-?\d*\.?\d+)\s*\/\s*(\d*\.?\d+)/);if(m&&+m[2])return (+m[1])/(+m[2]);                          // 2/3
 m=s.match(/-?\d*\.?\d+(?:e-?\d+)?/i);return m?parseFloat(m[0]):NaN}
function numOK(input,c){if(!c||c.num==null)return false;const v=numIn(input);if(isNaN(v))return false;const tol=c.tol!=null?c.tol:Math.max(.005,Math.abs(c.num)*.01);return Math.abs(v-c.num)<=tol+1e-12}
function stepsHTML(c){return (c&&c.steps&&c.steps.length?'<ol class="steps">'+c.steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol>':'')+(c&&c.solfig&&MOLS[c.solfig]?'<figure class="qfig" role="img" aria-label="'+esc(c.solfiglabel||'Solution graph')+'"><span class="mol"'+molW(c.solfig)+'>'+MOLS[c.solfig]+'</span></figure>':'')}
  // matching drills can have more choices than the A–E answer sheet
const LETTERS='ABCDE',THEME_KEY='reviewer_theme';
const $=id=>document.getElementById(id);
// v70: rebuild a part of the page only when its content changed (the sidebar used to be rebuilt after every answer)
const setHTML=(el,h)=>{if(el&&el._h!==h){el.innerHTML=h;el._h=h}};
const byId=Object.fromEntries(ALL_ITEMS.map(c=>[c.id,c]));
const blank=()=>({right:0,wrong:0,hints:0,lookups:0,seen:0,history:[]});
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const CHEV='<svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const LEFT='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const LAYERS_SM='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>';
const XSVG='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const STAR_PATH='<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>';
const STAR_SVG='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">'+STAR_PATH+'</svg>';
const STAR_SM='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">'+STAR_PATH+'</svg>';
const MISS_SM='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>';
const CLOCK_SM='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const FC_SM='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="13" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3"/></svg>';
const NOTE_SM='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';

/* ---------- saved state ---------- */
const DEFAULT_PREFS={target:GOALS.includes(2)?2:GOALS[0],order:'random',extras:true,notes:true,matching:true,selftest:false,mix:0,charts:true,opt:{},crossout:true,lucky:true,stars:true,missed:true,srs:true,typeMode:false,exam:true,flag:true,scope:null,crowd:true,classmiss:true,hardPractice:false,strict:false,sure:false,blurt:true,missTags:true,cards:true,fcFour:false,fcRet:.88,fcNew:40,fcRev:150,fcDeck:null,fcExam:true,fcEasy:-1};
function fresh(){return {concepts:{},correct:0,wrong:0,lookups:0,hints:0,section:ALL_SECTIONS[0],complete:[],history:[],log:[],active:null,selected:null,feedback:null,bank:'main',prefs:{...DEFAULT_PREFS},match:{sets:0,right:0,total:0,best:{}}}}
let state;
try{state=JSON.parse(localStorage.getItem(KEY))||fresh();if(!state.concepts)state=fresh()}catch(e){state=fresh()}
ALL_ITEMS.forEach(c=>{if(!state.concepts[c.id])state.concepts[c.id]=blank()});
trimState(state,false);
state.prefs=Object.assign({},DEFAULT_PREFS,state.prefs);if(!state.prefs.blurtV75){state.prefs.blurt=true;state.prefs.blurtV75=1}   // v75: Blurt on by default (v74 saved it off for everyone)
if(!GOALS.includes(state.prefs.target))state.prefs.target=DEFAULT_PREFS.target;
state.match=Object.assign({sets:0,right:0,total:0,best:{}},state.match);
state.log=state.log||[];state.complete=state.complete||[];state.history=state.history||[];
delete state.set;delete state.unlocked;
// A renumbered course (CONFIG.sectionRename = {id, map: {old: new}, chapters: {old: new}}) moves saved section keys once.
(function(){const R=CONFIG.sectionRename;if(!R||!R.map||state.renamed===R.id)return;const C=R.chapters||{};
 const m=s=>typeof s!=='string'?s:s.startsWith('CH:')?'CH:'+(C[s.slice(3)]||s.slice(3)):R.map[s]||s;
 state.section=m(state.section);state.complete=(state.complete||[]).map(m);(state.log||[]).forEach(e=>{if(e&&e.sec)e.sec=m(e.sec)});
 if(state.pass&&state.pass.sec)state.pass.sec=m(state.pass.sec);state.renamed=R.id})();
if(!BANKS.some(b=>b.id===state.bank))state.bank='main';
if(state.pmatch&&!MSETS[state.pmatch.i])state.pmatch=null;
// Your name is shared by every course on this device; a course without one takes it.
const NAME_KEY='reviewer_name';
function setName(v){state.name=String(v||'').trim().slice(0,40);save();try{localStorage.setItem(NAME_KEY,state.name)}catch(e){}}
try{const nm=localStorage.getItem(NAME_KEY);if(nm)state.name=nm;else if(state.name&&nm===null)localStorage.setItem(NAME_KEY,state.name)}catch(e){}
if(state.active&&state.active.cid&&!byId[state.active.cid]){state.active=null;state.feedback=null;state.selected=null}
// v67: a question card saved before its wording changed is rebuilt (the card keeps a fingerprint of the question it was made from)
function qsig(c){return c?stableHash((c.q||'')+'|'+(c.a||'')+'|'+(c.d||[]).join('|')):0}
if(state.active&&!state.feedback&&byId[state.active.cid]&&state.active.sig!==qsig(byId[state.active.cid])){state.active=null;state.selected=null}

/* ---------- active question bank: Main, or a variant someone added ---------- */
let BANK=[],sectionKeys=[],chapters=[],AUTHORED=true,NCHOICE=4;
const bankObj=()=>BANKS.find(b=>b.id===state.bank)||BANKS[0];
// Optional topics (CONFIG.optionalSections), e.g. ones not in the current exam: off unless switched on in Personalize.
const OPT=CONFIG.optionalSections||{};
const optOn=k=>state.prefs.opt&&k in state.prefs.opt?!!state.prefs.opt[k]:!!(OPT[k]&&OPT[k].on);
const secOn=k=>!k||!OPT[k]||optOn(k);
// exam:true (v84): hidden from practice unless switched on, but the mock exam and class challenges always use it (Pharma's Eval Cases)
const optExam=k=>!!(OPT[k]&&OPT[k].exam);
/* Exam scope: CONFIG.exams = [{id, name, chapters?, sections?, date?}], CONFIG.activeExam = the next test.
   An exam without chapters or sections covers everything. Students can switch in the sidebar ("All <units>" too);
   when the author changes activeExam (say Midterm → Finals), everyone is moved to it once. */
const EXAMS=(CONFIG.exams||[]).filter(e=>e&&e.id&&e.name);
if(EXAMS.length&&state.prefs.scopeSeen!==CONFIG.activeExam){state.prefs.scope=CONFIG.activeExam||EXAMS[0].id;state.prefs.scopeSeen=CONFIG.activeExam}
function examObj(){if(!EXAMS.length||state.prefs.scope==='all')return null;return EXAMS.find(e=>e.id===state.prefs.scope)||EXAMS.find(e=>e.id===CONFIG.activeExam)||EXAMS[0]}
const examAll=e=>!e.chapters&&!e.sections;
// A set's own topic groups (not course chapters) are always in scope.
const inScopeCh=ch=>{const e=examObj();ch=String(ch);return !e||examAll(e)||!(ch in COURSE_CH)||(e.chapters||[]).map(String).includes(ch)||(e.sections||[]).some(x=>chOf(x)===ch)};
const inScope=sec=>{const e=examObj(),ch=chOf(sec);return !e||examAll(e)||!(ch in COURSE_CH)||(e.chapters||[]).map(String).includes(ch)||(e.sections||[]).includes(sec)};
// xo: exam-only items (e.g. Pharma's VSAs): never in practice, only filling a mock exam's VSA slots (v83)
const bankItems=b=>b.items.filter(c=>!c.retired&&!c.xo&&(state.prefs.extras||!c.extra)&&secOn(c.section)&&inScope(c.section));
function validSection(s){return s==='ALL'||(s==='DUE'&&state.prefs.srs)||(s==='MISSED'&&state.prefs.missed)||(s==='STAR'&&state.prefs.stars)||(s==='CLASS'&&classOn())||(s==='CRAM'&&cramOn())||(isCh(s)?chapters.includes(s.slice(3)):sectionKeys.includes(s))}
function refreshBank(){PV++;const b=bankObj();BANK=bankItems(b);if(!BANK.length)BANK=b.items;
 sectionKeys=ALL_SECTIONS.filter(k=>BANK.some(c=>c.section===k));
 chapters=ALL_CHAPTERS.filter(ch=>sectionKeys.some(k=>chOf(k)===ch));
 AUTHORED=BANK.every(c=>c.q);NCHOICE=BANK.some(c=>!c.q)?5:Math.max(...BANK.map(c=>1+(c.d||[]).length));
 if(!validSection(state.section))state.section=sectionKeys[0]}
refreshBank();

const T=()=>state.prefs.target;                      // correct recalls needed for mastery
const isM=c=>state.concepts[c.id].right>=T();
const isMissedC=c=>{const k=state.concepts[c.id];return k.wrong>0||k.lookups>0}; // ever answered wrong or looked up
const isStar=c=>!!state.concepts[c.id].star;
// Spaced review: mastered items come back after 1, 3, 7, 14 and 30 days.
const DAY=864e5,SRS_DAYS=[1,3,7,14,30];
const isDue=c=>{const k=state.concepts[c.id];return state.prefs.srs&&!!k.srs&&k.srs.due<=Date.now()&&isM(c)};
// Items mastered before spaced review existed get their first review a day from now.
ALL_ITEMS.forEach(c=>{const k=state.concepts[c.id];if(k.right>=T()&&!k.srs)k.srs={lvl:0,due:Date.now()+DAY}});
const TIMES={1:'once',2:'twice',3:'three times'};
const VIEWS={dashboard:'dashView',study:'studyView',cards:'cardsView',notes:'notesView',match:'matchView',exam:'examView',prefs:'prefsView'};
const NOTES_ONLY=!!CONFIG.notesOnly;
function pageOn(p){if(NOTES_ONLY&&p!=='notes'&&p!=='prefs')return false;return p==='notes'?!!NOTES_DATA&&state.prefs.notes:p==='match'?(MSETS.length>0||MIXUP.length>0)&&state.prefs.matching:p==='exam'?!!(state.prefs.exam||CHAL||state.exam&&state.exam.chal):p==='cards'?!!CONFIG.cards&&state.prefs.cards!==false:!!VIEWS[p]}
let page=pageOn(state.page)?state.page:(NOTES_ONLY?'notes':'dashboard');
if(NOTES_ONLY)document.body.classList.add('notesonly');
let view=null;               // index into this section's answer log when reviewing; null = current question
const openCh=new Set(isX(state.section)?[]:[secCh(state.section)]);
let lastCardKey='';

// The summary lets a courses home screen show progress without loading the whole reviewer.
// v70: saved progress stays small (questions never answered aren't stored; logs are capped), and a full browser storage never
// loses answers silently: old logs are trimmed (here, then in the other courses), and if it still doesn't fit, a warning stays up.
const touched=k=>!!k&&!!(k.seen||k.right||k.wrong||k.lookups||k.hints||k.star||k.srs||k.lucky||k.back);
function packState(){const c={};for(const id in state.concepts)if(touched(state.concepts[id]))c[id]=state.concepts[id];return JSON.stringify(Object.assign({},state,{concepts:c}))}
function trimState(st,hard){const n=hard?40:150,h=hard?200:600,kh=hard?2:5;if(st.log&&st.log.length>n)st.log=st.log.slice(-n);if(st.history&&st.history.length>h)st.history=st.history.slice(-h);
 for(const id in st.concepts||{}){const k=st.concepts[id];if(k&&k.history&&k.history.length>kh)k.history=k.history.slice(-kh)}if(hard&&st.exams&&st.exams.length>10)st.exams=st.exams.slice(-10);return st}
// Frees room across the site: class stats caches (downloaded again when needed) and old logs of the other courses.
function freeSpace(){let freed=0;try{const keys=[];for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
 for(const k of keys){const v=localStorage.getItem(k)||'';if(/_class$/.test(k)){freed+=v.length;localStorage.removeItem(k);continue}
  if(k===KEY||v.length<20000||v[0]!=='{')continue;let o;try{o=JSON.parse(v)}catch(e){continue}if(!o||!o.concepts||!Array.isArray(o.log))continue;
  const c={};for(const id in o.concepts)if(touched(o.concepts[id]))c[id]=o.concepts[id];o.concepts=c;const out=JSON.stringify(trimState(o,true));if(out.length<v.length){localStorage.setItem(k,out);freed+=v.length-out.length}}}catch(e){}return freed}
let STORE_FULL=false;
function putState(){try{localStorage.setItem(KEY,packState());return true}catch(e){return false}}
function storeWarn(){let w=$('storewarn');if(!STORE_FULL){if(w)w.remove();return}if(!w){w=document.createElement('div');w.id='storewarn';w.className='storewarn';w.setAttribute('role','alert');document.body.appendChild(w)}
 w.innerHTML='<span><b>This device\'s storage is full.</b> New answers aren\'t being saved'+(cloudOn()?'; sign in or sync to keep a copy online':'')+'.</span><button class="btn sm" onclick="freeUp()">Free up space</button>'}
function freeUp(){const f=freeSpace();save();toast(STORE_FULL?'Still full. Clear other sites\' data in your browser settings, or reset a course you no longer need.':'Freed '+Math.max(.1,f/524288).toFixed(1)+' MB. Your answers are saving again.');if(page==='prefs')drawPrefs()}
function storageUse(){let all=0,mine=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i),n=2*(k.length+(localStorage.getItem(k)||'').length);all+=n;if(k===KEY||k.startsWith(KEY+'_'))mine+=n}}catch(e){}return {all,mine}}
const mbs=n=>(n/1048576).toFixed(n<1048576?2:1)+' MB';
// v70: several save() calls during one action (answer, next question, redraw) write once, at the end of that action and
// before the browser does anything else. flushSave() writes at once (before a reload, or when the app goes to the background).
let saveQ=false;
function save(){PV++;if(state.active&&!state.active.sig&&typeof byId!=='undefined'&&byId[state.active.cid])state.active.sig=qsig(byId[state.active.cid]);const ps=prefSig();if(ps!==prefSigLast){if(prefSigLast!==null)state.prefsAt=Date.now();prefSigLast=ps}
 if(!saveQ){saveQ=true;queueMicrotask(flushSave)}
 if(syncCode&&!syncHold&&cloudOn()){clearTimeout(syncT);syncT=setTimeout(syncNow,15000)}}
function flushSave(){if(!saveQ)return;saveQ=false;
 let ok=putState();if(!ok){trimState(state,true);ok=putState();if(!ok){freeSpace();ok=putState()}}if(ok===STORE_FULL){STORE_FULL=!ok;storeWarn()}
 // v71: on the website the summary also names the course and when its mastered questions come due, so the home page and
 // the daily review reminder (daily.js) can count reviews without opening the course
 try{localStorage.setItem(KEY+'_summary',JSON.stringify(summaryObj()))}catch(e){}
 if(window.Daily)Daily.digestSoon()}
// v72: the summary also keeps mastered/total per section (secs) and which exam the person is studying for (pick, seen), so
// the home page can show the right percent after the course's exam changes, without opening the course. It travels with
// the synced progress too, so a newly signed-in device shows every course's progress on the home page at once.
function summaryObj(){const main=bankItems(BANKS[0]),e=examObj(),id=courseId(),due=[],secs={};
 for(const c of BANKS[0].items){if(c.retired||c.xo||!(state.prefs.extras||!c.extra)||!secOn(c.section))continue;const s=secs[c.section]||(secs[c.section]=[0,0]);s[1]++;if(isM(c))s[0]++}
 if(id&&state.prefs.srs)for(const c of main){const k=state.concepts[c.id];if(k&&k.srs&&isM(c))due.push(k.srs.due)}
 return Object.assign({m:main.filter(isM).length,t:main.length,at:Date.now(),scope:e?e.name:'',secs,pick:state.prefs.scope||'',seen:state.prefs.scopeSeen||''},id?{id,title:CONFIG.title,due:due.sort((a,b)=>a-b).slice(0,400)}:{})}
addEventListener('pagehide',flushSave);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushSave()});
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function stableHash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0}
function shuffle(a,seed){let b=a.slice(),x=seed||1;for(let i=b.length-1;i>0;i--){x^=x<<13;x^=x>>>17;x^=x<<5;let j=(x>>>0)%(i+1);[b[i],b[j]]=[b[j],b[i]]}return b}
// RNG: a seeded source while a class challenge builds its exam, so everyone with the link gets the same questions (v82)
let RNG=null;const rnd=()=>RNG?RNG():((Math.random()*4294967296)>>>0)||1;
// Random order: a new seed every time, so answer letters can't be memorized. In order: stable per attempt.
const seedFor=(c,tag)=>state.prefs.order==='random'?rnd():stableHash(c.id+tag+state.concepts[c.id].seen);
// v70: the questions of a section and its progress are worked out once per change of your progress, not again for every
// place on the screen that shows them (49 sections x 935 questions, several times per redraw, in Chem). PV moves on with
// every save() and redraw, which drops the remembered counts.
const pcache=()=>{if(PC.v!==PV)PC={v:PV,list:new Map(),prog:new Map(),grp:null};return PC};
// plain sections and whole chapters come from one pass over the bank
function secGroups(c){if(c.grp)return c.grp;const g=new Map();for(const x of BANK){for(const k of [x.section,'CH:'+chOf(x.section)]){let a=g.get(k);if(!a)g.set(k,a=[]);a.push(x)}}return c.grp=g}
function inSection(s){const c=pcache();let r=c.list.get(s);if(!r){r=isX(s)?inSectionRaw(s):secGroups(c).get(s)||[];c.list.set(s,r)}return r}
function progress(s){const c=pcache();let r=c.prog.get(s);if(!r){r=progressRaw(s);c.prog.set(s,r)}return {done:r.done,total:r.total}}
function inSectionRaw(s){return s==='ALL'?BANK:s==='DUE'?BANK.filter(c=>isDue(c)||(state.dueDone||[]).includes(c.id)):s==='MISSED'?BANK.filter(isMissedC):s==='STAR'?BANK.filter(isStar):s==='CLASS'?classList():s==='CRAM'?cramList():isCh(s)?BANK.filter(c=>chOf(c.section)===s.slice(3)):BANK.filter(c=>c.section===s)}
function progressRaw(s){const a=inSection(s);if(s==='STAR'||s==='DUE'||s==='CLASS'||s==='CRAM'){const d=(s==='STAR'?state.starDone:s==='CLASS'?state.classDone:s==='CRAM'?state.cramDone:state.dueDone)||[];return {done:a.filter(c=>d.includes(c.id)).length,total:a.length}}return {done:a.filter(isM).length,total:a.length}}
// What is still to be asked: unmastered items, or for starred review the ones not yet seen this round.
// Review pass: every item of the section once, mastered or not. Mastery only drops for the ones you miss.
const onPass=s=>!!state.pass&&state.pass.sec===s;
// Practice again: a free round (state.pass.free) over picked ids; answers never touch mastery.
const freeOn=()=>!!state.pass&&!!state.pass.free&&state.pass.sec===state.section;
let freeOpen=false;
// n items spread evenly over groups (the first groups take the remainder; a small group passes the rest on).
function evenPick(items,n,key){const g={};items.forEach(c=>(g[key(c)]=g[key(c)]||[]).push(c));const ks=Object.keys(g),out={};ks.forEach(k=>out[k]=0);
 let left=Math.min(n,items.length),open=ks.slice();while(left>0&&open.length){const each=Math.floor(left/open.length),extra=left%open.length;let used=0;
  open.forEach((k,i)=>{const t=Math.min(each+(i<extra?1:0),g[k].length-out[k]);out[k]+=t;used+=t});left-=used;open=open.filter(k=>out[k]<g[k].length);if(!used)break}
 return ks.flatMap(k=>shuffle(g[k],rnd()).slice(0,out[k]))}
function freeStart(n){const s=state.section,all=inSection(s),k=Math.max(1,Math.min(all.length,Math.round(+n)||1));state.prefs.freeN=k;
 let ids=(isCh(s)?evenPick(all,k,c=>c.section):shuffle(all,rnd()).slice(0,k)).map(c=>c.id);
 if(all.some(c=>c.case)){const out=[];for(const c of shuffle(all,rnd())){if(out.length>=k)break;if(out.includes(c.id))continue;
  (c.case?all.filter(x=>x.case===c.case).sort((a,b)=>a.part-b.part):[c]).forEach(x=>{if(!out.includes(x.id))out.push(x.id)})}ids=out}
 state.pass={sec:s,done:[],miss:[],free:1,ids,right:0};state.complete=state.complete.filter(x=>x!==s);freeOpen=false;state.active=null;state.feedback=null;state.selected=null;view=null;save();draw();scrollToCard()}
function freeToggle(){freeOpen=!freeOpen;$('card').innerHTML=cardHTML()}
function freeBoxHTML(){const s=state.section,N=inSection(s).length,cur=Math.min(state.prefs.freeN||20,N),opts=[10,20,30].filter(x=>x<N);
 return '<div class="freebox"><p class="fbt"><b>Practice again</b> · nothing here changes your mastery'+(isCh(s)?', and the questions are split evenly across the '+new Set(inSection(s).map(c=>c.section)).size+' sections':'')+'.</p><div class="fchips">'+
  opts.map(x=>'<button class="fchip" onclick="freeStart('+x+')">'+x+' questions</button>').join('')+'<button class="fchip" onclick="freeStart('+N+')">All '+N+'</button>'+
  '<span class="fcust"><input id="freen" class="txt exmin" type="number" min="1" max="'+N+'" value="'+cur+'" aria-label="Number of questions" onkeydown="if(event.key===\'Enter\'){event.preventDefault();freeStart(this.value)}"><button class="btn sm primary" onclick="freeStart($(\'freen\').value)">Start</button></span></div></div>'}
function poolFor(s){if(onPass(s)){const d=state.pass.done,ids=state.pass.ids;return inSection(s).filter(c=>!d.includes(c.id)&&(!ids||ids.includes(c.id)))}if(s==='DUE')return BANK.filter(isDue);const a=inSection(s);if(s==='STAR'||s==='CLASS'||s==='CRAM'){const d=(s==='STAR'?state.starDone:s==='CRAM'?state.cramDone:state.classDone)||[];return a.filter(c=>!d.includes(c.id))}return a.filter(c=>!isM(c))}
function completed(s){const p=progress(s);return p.done===p.total}
const secTitle=s=>s==='ALL'&&state.pass&&state.pass.order&&state.pass.sec==='ALL'?'Mixed look-alikes':s==='DUE'?'Due for review':s==='MISSED'?'Missed '+ITEMS:s==='STAR'?'Starred '+ITEMS:s==='CLASS'?'Class\'s most missed':s==='CRAM'?'Cram mode':s==='ALL'?'All '+unitsW+', shuffled':isCh(s)?CH_NAMES[s.slice(3)]:s+' '+SECTION_NAMES[s];
const navList=s=>isX(s)?[]:isCh(s)?chapters.map(c=>'CH:'+c):sectionKeys;

// fx (class challenges): a fixed seed and item list, so every device builds exactly the same question.
// Look-alike wrong choices (item.dh): always in the Mock exam and challenges; in practice only if turned on.
// "Book only": the fact is in the textbook but not in the class transes (item.src==='book')
const srcTag=cid=>{const c=byId[cid];return c&&c.src==='book'?'<span class="srctag" title="In the book, not in the transes">Book only</span>':''};
let HARD=false;
// From the second correct recall on, an item is asked differently (practice only; challenges stay fixed).
// LONG: exam-style wording (item.xq) in a Harder mock exam. INEX: building a mock exam (round two never applies there).
let LONG=false,INEX=false;
const round2=(c,fx)=>!fx&&!HARD&&!INEX&&state.concepts[c.id]&&state.concepts[c.id].right>=1;
const hardSet=(c,fx)=>c.dh&&c.dh.length>=3&&(HARD||state.prefs.hardPractice||round2(c,fx))?c.dh:c.d;
// "What is X?" flipped: show the definition, pick the term. Wrong choices are the terms whose definitions were its wrong choices.
function reverseQ(c,sd){const src=BANK.filter(x=>x.q&&x.kind==='definition'&&x.id!==c.id&&x.term&&x.term!==c.term);
 const near=src.filter(x=>(c.d||[]).concat(c.dh||[]).includes(x.a)),sec=src.filter(x=>x.section===c.section),chp=src.filter(x=>chOf(x.section)===chOf(c.section));
 // then short term-like answers and choices from the same section (e.g. Neuroticism, Agreeableness), then the chapter
 const low=t=>String(t).toLowerCase(),isTerm=t=>/^[A-Za-z]/.test(t)&&t.length>=8&&t.split(/\s+/).length<=3&&!/[.,;?\d–]| and /.test(t)&&low(t)!==low(c.term);
 const secTerms=[...new Set(BANK.filter(x=>x.q&&x.section===c.section&&x.id!==c.id).flatMap(x=>[x.a,...(x.d||[])]).filter(isTerm).map(t=>t.charAt(0).toUpperCase()+t.slice(1)))];
 const cand=[...shuffle(near,sd('rv1')).map(x=>x.term),...shuffle(sec,sd('rv2')).map(x=>x.term),...shuffle(secTerms,sd('rv4')),...shuffle(chp,sd('rv3')).map(x=>x.term)];
 const terms=[];for(const t of cand)if(terms.length<3&&low(t)!==low(c.term)&&!terms.some(u=>low(u)===low(t)))terms.push(t);
 if(terms.length<3)return null;
 const ch=shuffle([{label:c.term,correct:true},...terms.map(t=>({label:t,correct:false}))],sd('choices'));
 return {cid:c.id,kind:'term',stem:'“'+c.a+'.” Which concept is this?',choices:ch.map((x,i)=>({...x,letter:LETTERS[i]})),
  why:'“'+c.term+'”: '+c.a.charAt(0).toLowerCase()+c.a.slice(1)+'.'+(c.why?' '+c.why:''),hint:c.hint||'',usedHint:false}}
function makeQuestion(c,fx){const src=fx?fx.items:BANK,sd=tag=>fx?stableHash(fx.seed+'|'+c.id+'|'+tag):seedFor(c,tag),stage=fx?sd('kind')%3:state.concepts[c.id].seen%3;
 // Authored question: q (stem), a (answer), d (distractors).
 if(c.q&&c.kind==='definition'&&c.term&&round2(c,fx)){const rv=reverseQ(c,sd);if(rv)return rv}
 if(c.q){const ch=shuffle([{label:c.a,correct:true},...(hardSet(c,fx)||[]).map(x=>({label:x,correct:false}))],sd('choices'));
  if(ch.length===2&&ch.every(x=>x.label==='True'||x.label==='False'))ch.sort((x,y)=>x.label==='True'?-1:1);
  return {cid:c.id,kind:c.kind||'recall',stem:LONG&&c.xq?c.xq:c.q,choices:ch.map((x,i)=>({...x,letter:LETTERS[i]})),why:c.why||'',hint:c.hint||'',usedHint:false}}
 let cand=src.filter(x=>x.section===c.section&&x.id!==c.id&&!x.q);
 if(cand.length<4)cand=src.filter(x=>x.id!==c.id&&!x.q&&chOf(x.section)===chOf(c.section));
 if(cand.length<4)cand=src.filter(x=>x.id!==c.id&&!x.q);
 let others=shuffle(cand,sd('-')).slice(0,4);
 let kind=['definition','scenario','term'][stage];
 let stem,choices,why;
 if(kind==='definition'){stem='Which description best matches the term “'+c.term+'”?';choices=[{label:c.definition,correct:true,owner:c.id},...others.map(x=>({label:x.definition,correct:false,owner:x.id}))];why='“'+c.term+'” means '+c.definition+'.'}
 else if(kind==='scenario'){stem='Which concept does this situation best illustrate? '+c.scenario;choices=[{label:c.term,correct:true,owner:c.id},...others.map(x=>({label:x.term,correct:false,owner:x.id}))];why='The situation illustrates '+c.term+': '+c.definition+'.'}
 else{stem='Which concept is being described? '+c.definition;choices=[{label:c.term,correct:true,owner:c.id},...others.map(x=>({label:x.term,correct:false,owner:x.id}))];why='The description refers to '+c.term+': '+c.definition+'.'}
 choices=shuffle(choices,sd('choices'));
 return {cid:c.id,kind,stem,choices:choices.map((x,i)=>({...x,letter:LETTERS[i]})),why,hint:c.hint,usedHint:false};
}
function chooseNext(){const s=state.section;let pool=poolFor(s);if(!pool.length)return null;
 if(state.pass&&state.pass.order&&state.pass.sec===s){const nx=state.pass.order.find(id=>!state.pass.done.includes(id)&&byId[id]);if(nx)return makeQuestion(byId[nx])}
 const recent=state.history.filter(h=>h.cid).slice(-3).map(h=>h.cid),K=id=>state.concepts[id],qn=state.qn||0;
 // v70: a problem with parts goes on part by part, so your work for part 1 is still fresh for part 2
 const last=secLog().slice(-1)[0],lc=last&&last.q&&byId[last.q.cid];
 if(lc&&lc.case){const nx=pool.filter(c=>c.case===lc.case&&(c.part||0)>(lc.part||0)).sort((a,b)=>a.part-b.part)[0];if(nx)return makeQuestion(nx)}
 // and starts at its first part still to do
 const start=c=>c&&c.case?pool.filter(x=>x.case===c.case).sort((a,b)=>a.part-b.part)[0]||c:c;
 // v70: a question you missed comes back after a few others (relearning), not only after the whole section
 const ready=pool.filter(c=>K(c.id).back&&K(c.id).back<=qn&&!recent.includes(c.id)).sort((a,b)=>K(a.id).back-K(b.id).back);
 if(ready.length)return makeQuestion(start(ready[0]));
 if(pool.some(c=>!(K(c.id).back>qn)))pool=pool.filter(c=>!(K(c.id).back>qn));
 // In order: lecture order, least-seen first (shuffled mode is always random).
 if(state.prefs.order!=='random'&&!isX(s)){const last=recent[recent.length-1],ix=new Map(BANK.map((c,i)=>[c.id,i]));
  pool.sort((a,b)=>(state.concepts[a.id].seen-state.concepts[b.id].seen)||(ix.get(a.id)-ix.get(b.id)));
  return makeQuestion(start(pool.find(x=>x.id!==last)||pool[0]))}
 // Shuffled mode: avoid the sections of the last few questions.
 if(isX(s)){const rs=recent.map(id=>byId[id]?.section),v=pool.filter(c=>!rs.includes(c.section));if(v.length)pool=v}
 // Random: everything comes up once per pass, in a new order each pass.
 const notRecent=pool.filter(c=>!recent.includes(c.id)),from=notRecent.length?notRecent:pool;
 const minSeen=Math.min(...from.map(c=>state.concepts[c.id].seen)),least=from.filter(c=>state.concepts[c.id].seen===minSeen);
 return makeQuestion(start(least[Math.floor(Math.random()*least.length)]))}
function ensure(){
 const ac=state.active&&byId[state.active.cid];
 if(state.active&&(!ac||!inSection(state.section).includes(ac)||(!state.feedback&&!poolFor(state.section).includes(ac)))){state.active=null;state.feedback=null;state.selected=null}
 if(!state.active&&!state.feedback){state.active=chooseNext();state.selected=null;state.curAt=syncBoot?0:Date.now();if(state.active)state.active.typed=canType(state.active)}
 save()}

/* ---------- answer log / back button ---------- */
function secLog(){return state.log.filter(e=>e.sec===state.section)}
function liveIdx(){let n=secLog().length;return state.feedback?n-1:n}
function curIdx(){return view==null?liveIdx():view}
function canBack(){return curIdx()>0}
function goBack(){if(!canBack())return;view=curIdx()-1;draw()}
function goForward(){if(view==null)return;view++;if(view>=liveIdx())view=null;draw()}
function goLive(){view=null;draw()}

/* ---------- rendering ---------- */
try{$('favicon').href=$('logo').src}catch(e){}
const CH_IMGS=CONFIG.images||{};
const CH_IMG=ch=>CH_IMGS[ch]||'';
const FBICON={good:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>',bad:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>',look:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'};
const KIND_NAMES={joke:'★ Bonus question',class:'Class question',statement:'True or false',solving:'Problem solving',structure:'Structures',naming:'IUPAC naming',reaction:'Reactions',concept:'Concept',identification:'Identification',odd:'Odd one out',phonetic:'Phonetic spelling',best:'Best answer',definition:'Concept meaning',scenario:'Application',term:'Identification',recall:'Recall',situational:'Situational',era:'Which era?',civ:'Which civilization?',order:'Timeline'};
const kindName=k=>KIND_NAMES[k]||'Question';
const pips=n=>'<span class="pips" aria-hidden="true">'+Array.from({length:T()},(_,i)=>'<i class="'+(n>i?'on':'')+'"></i>').join('')+'</span>';
const lit=v=>typeof v==='string'?"'"+v+"'":String(v);
function segHTML(fn,opts,cur,label){return '<span class="seg" role="radiogroup" aria-label="'+esc(label)+'">'+opts.map(([v,t])=>'<button role="radio" aria-checked="'+(v===cur)+'" class="'+(v===cur?'on':'')+'" onclick="'+fn+'('+lit(v)+')">'+t+'</button>').join('')+'</span>'}
const goalSeg=()=>segHTML('setGoal',GOALS.map(n=>[n,n+'×']),T(),'Recall goal');

// live = the question being answered now (cross-out only applies there)
function choicesHTML(q,sel,fb,live){
 const canX=live&&!fb&&state.prefs.crossout,struckL=q.struck||[];
 return '<div class="choices'+(canX?' can-x':'')+(molq(q)?' ichoices':'')+'">'+q.choices.map(x=>{
  const struck=canX&&struckL.includes(x.letter);
  let cls=fb?(x.correct?'right':(sel===x.letter?'wrong':'')):(sel===x.letter?'sel':'')+(struck?' struck':'');
  let mark=fb&&x.correct?'✓':fb&&sel===x.letter?'✗':'';
  const btn='<button class="choice '+cls+'" data-l="'+x.letter+'" '+(fb?'disabled':'')+' onclick="answer(\''+x.letter+'\')"'+(canX?' oncontextmenu="strike(\''+x.letter+'\');return false"':'')+'><span class="key">'+x.letter+'</span><span class="lab">'+labelHTML(x.label)+'</span>'+(mark?'<span class="mark" aria-label="'+(x.correct?'correct':'your answer')+'">'+mark+'</span>':'')+'</button>';
  return canX?'<div class="cw">'+btn+'<button class="x" onclick="strike(\''+x.letter+'\')" aria-pressed="'+struck+'" aria-label="'+(struck?'Restore':'Cross out')+' choice '+x.letter+'" title="'+(struck?'Restore':'Cross out')+' (Shift+'+x.letter+')">'+XSVG+'</button></div>':btn}).join('')+'</div>';
}
function feedbackHTML(q,fb,live,ai){   // ai: the AI box also shows on an earlier answer (v79)
 let cls=fb.correct?'good':fb.lookup?'look':'bad';
 let head=fb.correct?'Correct':fb.lookup?'Marked for review':'Not quite';
 let out='<div class="fb '+cls+'"><h3>'+FBICON[cls]+head+'</h3>';
 if(!fb.correct&&!fb.self)out+='<p><b>Answer:</b> '+ansHTML(fb.correctLabel)+'</p>';
 if(q.why)out+='<p>'+esc(q.why)+'</p>';out+=stepsHTML(q.cid&&byId[q.cid]);
 if(fb.wrongExplain)out+='<p><b>Why not your choice:</b> '+esc(fb.wrongExplain)+'</p>';
 if(live)out+=missRowHTML(q,fb)+fcMakeHTML(q,fb);
 {const c=q.cid&&byId[q.cid],ch=c&&chOf(c.section);if(!fb.correct&&ch&&pageOn('notes')&&NOTES_PARSED.some(n=>n.ch===ch))out+='<p><button class="link" onclick="openNotes(\''+ch+'\',\''+esc(q.cid)+'\')">Review the '+esc(unitW)+' '+esc(ch)+' notes →</button></p>'}
 if(q.cid&&discussOn())out+='<p><a class="link qdisc" href="'+discussQ(q.cid)+'" onclick="return openDiscuss(\''+esc(String(q.cid))+'\')">'+CHAT_SM+'Discuss this question'+(DCOUNT[discKey(q.cid)]?'<b>'+DCOUNT[discKey(q.cid)]+'</b>':'')+'<span data-dn="'+esc(discKey(q.cid))+'">'+dnDot(dnUnread(discKey(q.cid)))+'</span></a></p>';
 if((live||ai)&&!fb.self)out+=aiHTML(q,fb);
 const note=fb.correct?(fb.lucky?(fb.sure==='unsure'?'You weren\'t sure, so this '+ITEM+' comes back in a few questions.':'Marked as a lucky guess, so this '+ITEM+' comes back in a few questions.')
  :fb.sure==='sure'?'Counts toward mastering this '+ITEM+'.':fb.hinted?'Right, with a hint. It counts toward mastery once you get it without one.':'Counts toward mastering this '+ITEM+'.'+(live&&state.prefs.lucky?' <button class="link lucky" onclick="luckyGuess()" title="Undo the mastery point for this '+ITEM+'">Lucky guess? Ask me again</button>':''))
  :fb.self&&!fb.lookup?'This '+ITEM+' comes back in a few questions. Look the answer over before moving on.'
  :fb.sure==='sure'&&!fb.lookup?'You were sure of this one. Confident mistakes are the easiest to fix once you see why, so it comes back in a couple of questions.'
  :fb.typed!=null&&!fb.lookup?'This '+ITEM+' comes back in a few questions.'+(live?' <button class="link lucky" onclick="overrideTyped()">I was right, count it</button>':'')
  :'This '+ITEM+' comes back in a few questions, '+(AUTHORED?'with the choices reshuffled':'worded differently')+'.'+(live&&fb.typed?' <button class="link lucky" onclick="overrideTyped()">I was right, count it</button>':'');
 const cr=state.prefs.classmiss&&q.cid?classRate(q.cid):null;out+='<p class="note">'+note+(cr!=null?' <span class="crate">'+cr+'% of the class missed this one.</span>':'')+'</p></div>';
 return out;
}
/* v72: "Check for updates" (Personalize, next to the version). Installed apps on iPad/iPhone have no pull-to-refresh:
   this drops the offline copy of the site's code and pages (never progress, which lives in localStorage), updates the
   offline worker, and reloads with the newest version. */
async function getUpdate(b){if(b){b.disabled=true;b.textContent='Updating…'}flushSave();
 try{const r=await navigator.serviceWorker.getRegistration();if(r)await r.update().catch(()=>{})}catch(e){}
 try{for(const k of await caches.keys())if(k!=='reviewer-meta')await caches.delete(k)}catch(e){}
 location.reload()}
/* ---------- v72: "Explain it differently" (Claude Haiku through the explain Edge Function, see AI_SETUP.md) ----------
   For signed-in classmates on the website, under the feedback of the question on screen. The function only explains the
   reviewer's own questions (it reads them from the course file), 30 a day per person; repeats are served from a cache.
   The button appears once the function answers that it's set up. */
let AI_READY=null;const AIX={};   // AIX[question id|picked choice] = {busy} | {text, left} | {err}
// Explanations you got are kept on this device (KEY_ai, newest 300) and show again by themselves when the same question
// comes back with the same answer picked, so nobody taps (or spends) twice. The server also keeps one copy for everyone.
const AI_SAVE=KEY+'_ai';let AISAVED={};try{AISAVED=JSON.parse(localStorage.getItem(AI_SAVE))||{}}catch(e){}
// the question on screen: the current one, or an earlier answer opened with Back (v79)
function aiCur(){if(view!=null){const e=secLog()[view];return e?{q:e.q,fb:e.fb,sel:e.sel}:{}}return {q:state.active,fb:state.feedback,sel:state.selected}}
function aiPick(q,fb){const sel=aiCur().sel,ch=!fb.correct&&!q.typed&&sel?q.choices.find(x=>x.letter===sel):null;return ch?ch.label:''}
function aiK(q,fb){return String(q.cid)+'|'+(fb.correct?'':aiPick(q,fb))}
function aiSave(k,text){AISAVED[k]={text,at:Date.now()};const ks=Object.keys(AISAVED);if(ks.length>300)ks.sort((a,b)=>AISAVED[a].at-AISAVED[b].at).slice(0,ks.length-300).forEach(x=>delete AISAVED[x]);try{localStorage.setItem(AI_SAVE,JSON.stringify(AISAVED))}catch(e){}}
const SPARK='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4l1.8 4.7L17.5 10.5l-4.7 1.8L11 17l-1.8-4.7L4.5 10.5l4.7-1.8z"/><path d="M19 3v4M21 5h-4M18 17v3M19.5 18.5h-3"/></svg>';
// Only a "ready" answer is remembered (10 min); "not ready" or no connection is asked again a minute later.
let aiNext=0;
function aiCheck(){if(AI_READY===true||!CONFIG.home||!cloudOn()||!/^https?:$/.test(location.protocol)||Date.now()<aiNext)return;aiNext=Date.now()+60000;
 let c=null;try{c=JSON.parse(sessionStorage.getItem('reviewer_ai'))}catch(e){}
 if(c&&c.ok&&Date.now()-c.at<6e5){AI_READY=true;return}
 fetch(CLOUD.url.replace(/\/+$/,'')+'/functions/v1/explain',{headers:{apikey:CLOUD.key},cache:'no-store'}).then(r=>r.ok?r.json():{}).then(j=>{AI_READY=!!j.ok;
  if(AI_READY){try{sessionStorage.setItem('reviewer_ai',JSON.stringify({ok:true,at:Date.now()}))}catch(e){}if(state.feedback)draw()}}).catch(()=>{})}
const aiFmt=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*([^*\n]+)\*/g,'<i>$1</i>').replace(/^\s*[-•]\s+/gm,'• ').replace(/\n+/g,'<br>');
function aiHTML(q,fb){aiCheck();if(!q||!q.cid||!fb)return '';const k=aiK(q,fb),sv=AISAVED[k],x=AIX[k]&&!AIX[k].busy&&!AIX[k].err?AIX[k]:sv?{text:sv.text,saved:1}:AIX[k],on=AI_READY&&FILE_IDS.has(String(q.cid));if(!x&&!on)return '';
 let h;
 if(!x)h='<p><button class="link aibtn" onclick="aiExplain(\''+esc(String(q.cid))+'\')">'+SPARK+'Explain it differently</button></p>';
 else if(x.busy)h='<div class="aibox busy"><p class="note">'+SPARK+'Writing a simpler explanation…</p></div>';
 else if(x.err)h='<div class="aibox"><p class="note">'+x.err+'</p></div>';
 else h='<div class="aibox"><div class="aih">'+SPARK+'Explained differently</div><p>'+aiFmt(x.text)+'</p><p class="note">Written by AI from this question, so it can be wrong. Check your transes'+(x.saved?' · saved on this device':x.cached?' · already written, didn\'t use a try':x.left!=null?' · '+x.left+' left today':'')+'.</p></div>';
 return h+(on?aiFollowHTML(k):'')}
/* v72: follow-up questions. Under the explanation, the student can ask about this question in their own words (up to 3
   per question). Same daily tries as explanations; never cached (each question is the student's own). */
const AIF={};   // AIF[question id|picked choice] = {turns: [{q, a}], busy, err, draft, left}
function aiFollowHTML(k){const f=AIF[k]||{turns:[]};
 let h='<div class="aifu">'+f.turns.map(t=>'<p class="aiq"><b>You asked:</b> '+esc(t.q)+'</p><p class="aia">'+aiFmt(t.a)+'</p>').join('');
 if(f.busy)h+='<p class="note aiwait">'+SPARK+'Thinking about your question…</p>';
 if(f.err)h+='<p class="note">'+f.err+'</p>';
 if(f.turns.length>=3)h+='<p class="note">For more, ask your classmates in <b>Discuss this question</b>.</p>';
 else if(!f.busy)h+='<div class="aiask"><input id="aiask" maxlength="300" autocomplete="off" aria-label="Ask a follow-up about this question" placeholder="'+(f.turns.length?'Ask another follow-up…':'Still confused? Ask about this question…')+'" value="'+esc(f.draft||'')+'" oninput="aiDraft(this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();aiAsk()}"><button class="btn sm" onclick="aiAsk()">Ask</button></div>';
 if(f.turns.length&&f.left!=null&&!f.busy)h+='<p class="note">Written by AI, so it can be wrong · '+f.left+' left today.</p>';
 return h+'</div>'}
function aiDraft(v){const {q,fb}=aiCur();if(!q||!fb)return;const k=aiK(q,fb);(AIF[k]||(AIF[k]={turns:[]})).draft=v}
// one request to the explain function, as the signed-in student (an expired sign-in is refreshed once and retried)
async function aiPost(payload){const tok=typeof Auth!=='undefined'?(Auth.cloud=CLOUD,await Auth.token()):'';if(!tok)return {signin:1};
 const go=t=>fetch(CLOUD.url.replace(/\/+$/,'')+'/functions/v1/explain',{method:'POST',headers:{'Content-Type':'application/json',apikey:CLOUD.key,Authorization:'Bearer '+t},body:JSON.stringify(payload)});
 let r=await go(tok);
 if(r.status===401){try{const s=JSON.parse(localStorage.getItem('reviewer_session'));if(s){s.exp=0;localStorage.setItem('reviewer_session',JSON.stringify(s))}}catch(e){}
  const t2=await Auth.token();if(t2)r=await go(t2)}
 return {r,j:await r.json().catch(()=>({}))}}
function aiErr(o,what){const j=o.j||{},det=s=>' <span class="aidet">('+esc(String(s).slice(0,160))+(o.r?' · '+o.r.status:'')+')</span>';
 if(o.signin)return 'Sign in with Google to use AI '+what+'. <a href="./?signin=1">Sign in</a>';
 return j.error==='limit'?'You\'ve used today\'s '+(j.perDay||30)+' AI tries. More tomorrow.':j.error==='busy'?'Lots of classmates are using this right now. Try again in a bit.'
  :j.error==='sign in'?'Your sign-in has expired. Sign in again to use AI '+what+'. <a href="./?signin=1">Sign in</a>'+(j.detail?det(j.detail):'')
  :'Couldn\'t get an answer just now. Try again in a bit.'+det(j.detail||j.error||j.message||j.msg||'no reason given')}
function aiBase(q,fb){const sel=aiCur().sel,ch=!fb.correct&&!q.typed&&sel?q.choices.find(x=>x.letter===sel):null;return {course:courseId(),qid:String(q.cid),picked:ch?ch.label:'',wrong:!fb.correct}}
async function aiExplain(cid){const {q,fb}=aiCur();if(!q||!fb||String(q.cid)!==String(cid))return;const k=aiK(q,fb);if(AIX[k]&&AIX[k].busy)return;
 AIX[k]={busy:1};draw();
 try{const o=await aiPost(aiBase(q,fb));
  if(o.r&&o.r.ok&&o.j.text){aiSave(k,o.j.text);AIX[k]={text:o.j.text,left:o.j.left,cached:o.j.cached}}else AIX[k]={err:aiErr(o,'explanations')}}
 catch(e){AIX[k]={err:'No connection. Try again when you\'re online.'}}
 if(String((aiCur().q||{}).cid)===String(cid))draw()}
async function aiAsk(){const {q,fb}=aiCur();if(!q||!fb)return;const k=aiK(q,fb),f=AIF[k]||(AIF[k]={turns:[]});if(f.busy||f.turns.length>=3)return;
 const el=$('aiask'),text=((el&&el.value)||f.draft||'').trim();if(text.length<3){if(el)el.focus();return}
 const sv=AISAVED[k],ex=(AIX[k]&&AIX[k].text)||(sv&&sv.text)||'';
 f.draft=text;f.busy=1;f.err='';draw();
 try{const o=await aiPost(Object.assign(aiBase(q,fb),{ask:text,prior:f.turns.slice(-2),explained:ex}));
  if(o.r&&o.r.ok&&o.j.text){f.turns.push({q:text,a:o.j.text});f.draft='';f.left=o.j.left}else f.err=aiErr(o,'follow-ups')}
 catch(e){f.err='No connection. Try again when you\'re online.'}
 f.busy=0;if(String((aiCur().q||{}).cid)===String(q.cid)){draw();setTimeout(()=>{const i=$('aiask');if(i&&f.turns.length<3)i.focus({preventScroll:true})},60)}}
function backBtn(){return '<button class="btn back" onclick="goBack()" '+(canBack()?'':'disabled')+' title="Previous answered question (←)">'+LEFT+'Back</button>'}

function cardHTML(){
 const s=state.section;
 // Reviewing an earlier answer
 if(view!=null){
  const e=secLog()[view];
  const nextIsLive=view+1>=liveIdx();
  return '<div class="review-note"><span>Earlier answer · '+(view+1)+' of '+secLog().length+(isX(s)?' in this '+(s==='ALL'?'shuffle':'review'):isCh(s)?' in this '+unitW:' in this section')+'</span><button class="link" onclick="goLive()">Back to current question</button></div>'+
   '<div class="qhead"><span class="kind">'+kindName(e.q.kind)+'</span><span class="mastery">'+flagBtn("flagQ('log')")+'</span></div>'+
   caseHTML(e.q.cid)+'<p class="prompt">'+stemHTML(e.q.stem)+'</p>'+figHTML(e.q.cid)+(e.fb&&e.fb.self?selfHTML(e.q,e.fb):(e.q.typed||isWr(byId[e.q.cid]))&&e.fb&&e.fb.typed!=null?typedHTML(e.fb,e.q):isWr(byId[e.q.cid])?wrPast(e.q,e.fb):choicesHTML(e.q,e.sel,e.fb))+feedbackHTML(e.q.why!=null?e.q:Object.assign({},e.q,{why:(byId[e.q.cid]||{}).why||''}),e.fb,0,1)+
   '<div class="actions">'+backBtn()+'<span class="aux"></span><button class="btn primary" id="go" onclick="goForward()">'+(nextIsLive?'Return to current':'Forward')+' <kbd>→</kbd></button></div>';
 }
 // A matching set mixed into practice (Personalize → Mix matching into practice)
 if(state.pmatch)return matchCardHTML(state.pmatch,'p');
 // Practice again finished
 if(!state.active&&onPass(s)&&state.pass.free){const P=state.pass,n=P.done.length,r=Math.min(P.right||0,n);
  return '<div class="done-card"><div class="qhead"><span class="kind" style="color:var(--good)">Practice round done</span></div><h2>'+esc(secTitle(s))+'</h2><p><b>'+r+' of '+n+'</b> right ('+(n?Math.round(100*r/n):0)+'%). Your mastery is unchanged.</p>'+(freeOpen?freeBoxHTML():'')+'<div class="row">'+
   (secLog().length?backBtn():'')+'<button class="btn" onclick="freeToggle()" aria-expanded="'+freeOpen+'">Practice again</button><button class="btn primary" id="go" onclick="endPass()">Done <kbd>Enter</kbd></button></div></div>'}
 // Review pass finished
 if(!state.active&&onPass(s)){const P=state.pass,n=P.done.length,miss=P.miss.length,slip=P.miss.filter(id=>byId[id]&&!isM(byId[id])).length;
  return '<div class="done-card"><div class="qhead"><span class="kind" style="color:var(--good)">Review pass complete</span></div><h2>'+esc(secTitle(s))+'</h2><p>'+
   (miss?'You went through '+n+' '+ITEMS+': '+(n-miss)+' still solid, '+miss+' missed. '+(slip?'The '+(slip>1?slip+' you missed go':'one you missed goes')+' back into practice until you master '+(slip>1?'them':'it')+' again.':'')
    :'You went through all '+n+' '+ITEMS+' without a miss. Your mastery is unchanged.')+'</p><div class="row">'+
   (secLog().length?backBtn():'')+'<button class="btn" onclick="extraPractice()">Review again</button><button class="btn primary" id="go" onclick="endPass()">'+(slip?'Practice the '+slip+' you missed':'Done')+' <kbd>Enter</kbd></button></div></div>'}
 // Section finished
 if(!state.active){
  const L=navList(s),last=!L.length||L.indexOf(s)===L.length-1,focus=s==='MISSED'||s==='STAR'||s==='DUE'||s==='CLASS'||s==='CRAM',none=!inSection(s).length;
  const label=s==='ALL'?'Shuffle complete':s==='DUE'?(none?'Nothing due':'All reviewed'):s==='STAR'?(none?'Nothing starred':'Round complete'):s==='MISSED'?'All caught up':s==='CLASS'?(none?'Nothing yet':'Round complete'):s==='CRAM'?'Cram round done':isCh(s)?esc(UNIT)+' complete':'Section complete';
  const text=s==='DUE'?(none?'Nothing is due right now. Mastered '+ITEMS+' come back for review after 1, 3, 7, 14 and 30 days, and sooner when a test is coming up.':'You reviewed everything that was due. Each one is now scheduled further out.'):s==='STAR'?(none?'No starred '+ITEMS+' yet. Tap the star on any question, or press S, to collect it here.':'You went through every starred '+ITEM+'. Go again the night before the exam.')
   :s==='CRAM'?'You went through the '+inSection(s).length+' highest-yield '+ITEMS+'. Go again, or practice the ones you missed under Missed '+ITEMS+'.'
   :s==='CLASS'?(none?'This list fills in once enough classmates have answered these '+ITEMS+'.':'You went through the '+ITEMS+' your class misses most. Go again before the exam.')
   :s==='MISSED'?(none?'Nothing missed yet. '+Items+' you get wrong, or check in your slides, will collect here.':'Every '+ITEM+' you had missed is now mastered.')
   :'You answered every '+ITEM+' here correctly '+(TIMES[T()]||T()+' times')+'. Move on, <b>practice again</b> with as many questions as you like (nothing changes your mastery), or do a <b>review pass</b>: every '+ITEM+' once, and you keep your mastery unless you miss one.';
  const canFree=!focus&&!none&&s!=='DUE';
  return '<div class="done-card"><div class="qhead"><span class="kind" style="color:var(--good)">'+label+'</span></div><h2>'+esc(secTitle(s))+'</h2><p>'+text+'</p>'+(canFree&&freeOpen?freeBoxHTML():'')+'<div class="row">'+
   (secLog().length?backBtn():'')+(canFree?'<button class="btn" onclick="freeToggle()" aria-expanded="'+freeOpen+'" title="Pick how many questions. Nothing changes your mastery.">Practice again</button>':'')+(none||s==='DUE'?'':'<button class="btn" onclick="extraPractice()"'+(s==='STAR'||s==='CLASS'||s==='CRAM'?'':' title="Every '+ITEM+' once. You keep your mastery unless you miss one."')+'>'+(s==='STAR'||s==='CLASS'||s==='CRAM'?'Go again':'Review pass')+'</button>')+
   (focus?'<button class="btn primary" id="go" onclick="setPage(\'dashboard\')">Back to dashboard <kbd>Enter</kbd></button>'
    :'<button class="btn primary" id="go" onclick="advance()">'+(last?'Finish':'Next '+(isCh(s)?unitW:'section'))+' <kbd>Enter</kbd></button>')+'</div></div>';
 }
 // Current question
 const q=state.active,st=state.concepts[q.cid],fb=state.feedback,mixed=isX(s)||isCh(s);
 return '<div class="qhead"><span class="kind">'+(mixed?esc(byId[q.cid].section)+' · ':'')+(isSelf(byId[q.cid])?'Written · check it yourself':isWr(byId[q.cid])?'Written answer':q.typed?'Type the answer':kindName(q.kind))+srcTag(q.cid)+'</span><span class="mastery">'+flagBtn("flagQ('live')")+starBtn(q.cid)+pips(st.right)+(st.right>=T()?'Mastered':'Recall '+st.right+' of '+T())+'</span></div>'+
  caseHTML(q.cid)+casePrev(q.cid)+'<p class="prompt">'+stemHTML(q.stem)+'</p>'+figHTML(q.cid)+(isSelf(byId[q.cid])?selfHTML(q,fb):q.typed?typedHTML(fb):choicesHTML(q,state.selected,fb,true))+
  (q.usedHint&&!fb?'<div class="hint"><b>Hint</b>'+esc(q.hint)+'</div>':'')+
  (fb?feedbackHTML(q,fb,true):'')+
  '<div class="actions">'+backBtn()+'<span class="aux">'+(fb?'':(q.usedHint||!q.hint?'':'<button class="link" onclick="hint()">Show hint</button>')+'<button class="link" onclick="looked()" title="Counts as a review, not a correct recall">I checked my slides</button>')+'</span>'+
  (fb?'<button class="btn primary" id="go" onclick="next()">'+(nextPart(q.cid)?'Next part':'Next question')+' <kbd>Enter</kbd></button>'
     :isSelf(byId[q.cid])?(q.shown?'<button class="btn" id="go2" onclick="selfMark(false)">Missed it</button><button class="btn primary" id="go" onclick="selfMark(true)">Got it <kbd>Enter</kbd></button>':'<button class="btn primary" id="go" onclick="selfShow()">Show answer <kbd>Enter</kbd></button>')
     :sureOn(q)?'<button class="btn" id="go2" onclick="submit(\'unsure\')" '+(state.selected?'':'disabled')+'>Not sure</button><button class="btn primary" id="go" onclick="submit(\'sure\')" '+(state.selected?'':'disabled')+'>Sure <kbd>Enter</kbd></button>'
     :'<button class="btn primary" id="go" onclick="'+(q.typed?'submitTyped()':'submit()')+'" '+(q.typed||state.selected?'':'disabled')+'>Check answer <kbd>Enter</kbd></button>')+'</div>';
}

const SHUFFLE='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>';
function focusNav(study){
 const nDue=state.prefs.srs?BANK.filter(isDue).length:0,dOn=state.section==='DUE'&&study;
 const nMiss=state.prefs.missed?BANK.filter(c=>isMissedC(c)&&!isM(c)).length:0,mOn=state.section==='MISSED'&&study;
 const nStar=state.prefs.stars?BANK.filter(isStar).length:0,sOn=state.section==='STAR'&&study;
 const nClass=classOn()?classList().length:0,cOn=state.section==='CLASS'&&study;
 const b=(id,on,ic,name,ct,tip)=>'<button class="sec special '+(on?'on':'')+'" '+(on?'aria-current="page" ':'')+'onclick="selectSection(\''+id+'\')" title="'+tip+'"><span class="no">'+ic+'</span><span class="nm">'+name+'</span><span class="ct">'+ct+'</span></button>';
 const crOn=state.section==='CRAM'&&study;
 return (cramOn()?b('CRAM',crOn,FLAME_SM,'Cram mode',cramList().length,'Short on time: the highest-yield '+ITEMS+' in one deck'):'')+(nDue||dOn?b('DUE',dOn,CLOCK_SM,'Due for review',nDue,'Mastered '+ITEMS+' that are due for a spaced review'):'')+(nMiss||mOn?b('MISSED',mOn,MISS_SM,'Missed '+ITEMS,nMiss,'Only the '+ITEMS+' you got wrong or checked in your slides, until mastered'):'')+
  (nStar||sOn?b('STAR',sOn,STAR_SM,'Starred',nStar,'Your starred '+ITEMS+', mastered or not'):'')+(nClass||cOn?b('CLASS',cOn,CLASS_SM,'Class\'s most missed',nClass,'The '+ITEMS+' your class misses most right now'):'');
}
// One chapter open at a time keeps the topic list short.
function chToggle(d,ch){if(!d.open){openCh.delete(ch);return}openCh.clear();openCh.add(ch);document.querySelectorAll('#nav details.ch[open]').forEach(x=>{if(x!==d)x.open=false})}
// Chapter filter chips. With many chapters they become short numbers (full name in the tooltip and the headings).
function chChips(keys,cur,fn){if(keys.length<2)return '';const isN=k=>/^\d/.test(k),nums=keys.filter(isN),compact=nums.length>5;
 const b=(k,t,tip,cls)=>'<button class="fchip'+(cls||'')+(k===cur?' on':'')+'" aria-pressed="'+(k===cur)+'"'+(tip?' title="'+tip+'" aria-label="'+tip+'"':'')+' onclick="'+fn+'(\''+k+'\')">'+t+'</button>';
 return b('all','All')+keys.filter(k=>!isN(k)).map(k=>b(k,esc(String(CH_NAMES[k]||k).split(':')[0]),esc(CH_NAMES[k]||''))).join('')+
  (compact?'<span class="chiplbl">'+esc(UNIT)+'</span>'+nums.map(k=>b(k,esc(k),esc(UNIT+' '+k+' · '+(CH_NAMES[k]||'')),' num')).join('')
   :nums.map(k=>b(k,esc(UNIT)+' '+esc(k)+'<span class="chn"> · '+esc(CH_NAMES[k]||'')+'</span>',esc(UNIT+' '+k+' · '+(CH_NAMES[k]||'')),' named')).join(''))}
// A run of underscores in a question is a blank to fill in: draw it as one solid line.
function stemHTML(s){return esc(s).replace(/_{2,}/g,'<span class="blank" role="img" aria-label="blank"></span>')}
// v101: sections built like the real test (CONFIG.testSecs) are tagged; when the timetable's next test for this course is
// 3 days away or less, a box above the lessons points to them and to the mock quiz.
const TEST_SECS=(CONFIG.testSecs||[]).filter(k=>SECTION_NAMES[k]);
function testKind(){const t=nextTest(),nm=String(t&&t.name||'');return /long quiz/i.test(nm)?'long quiz':/quiz/i.test(nm)?'quiz':/eval/i.test(nm)?'evals':/exam/i.test(nm)?'exam':'test'}
function testSoonHTML(){if(!TEST_SECS.length)return '';const t=nextTest();if(!t||t.at-Date.now()>3.5*DAY)return '';const k=testKind();if(k!=='quiz'&&k!=='long quiz')return '';const w=whenAt(t.at);
 return '<div class="tsoon"><b>'+esc(k.charAt(0).toUpperCase()+k.slice(1))+' '+esc(w)+'</b><span>Practice these first: they are built like the '+esc(k)+'.</span>'+
  TEST_SECS.map(sec=>{const p=progress(sec);return '<button class="sec" onclick="selectSection(\''+sec+'\')"><span class="no">'+sec+'</span><span class="nm">'+esc(SECTION_NAMES[sec])+'</span><span class="ct">'+p.done+'/'+p.total+'</span></button>'}).join('')+
  (pageOn('exam')&&EX_PRESETS.length?'<button class="link" onclick="setPage(\'exam\');exPreset(0)">Take a mock '+esc(k)+' →</button>':'')+'</div>'}
function navHTML(){if(NOTES_ONLY)return '';
 const study=page==='study',ap=progress('ALL'),aOn=state.section==='ALL'&&study;
 return testSoonHTML()+'<button class="sec mixed '+(aOn?'on':'')+'" '+(aOn?'aria-current="page" ':'')+'onclick="selectSection(\'ALL\')"><span class="no">'+SHUFFLE+'</span><span class="nm">All '+unitsW+', shuffled</span><span class="ct">'+ap.done+'/'+ap.total+'</span></button>'+focusNav(study)+chapters.map(ch=>{const secs=sectionKeys.filter(k=>chOf(k)===ch),cp=chProgress(ch),wOn=state.section==='CH:'+ch&&study;
  return '<details class="ch'+(secs.some(x=>x.length>4)?' wide':'')+'" '+(openCh.has(ch)?'open':'')+' ontoggle="chToggle(this,\''+ch+'\')"><summary>'+CHEV+'<span class="nm">'+ch+' · '+esc(CH_NAMES[ch])+'</span><span class="ct">'+secs.filter(completed).length+'/'+secs.length+'</span><span class="mini"><i style="width:'+(100*cp.done/cp.total)+'%"></i></span></summary><div class="secs">'+
  '<button class="sec whole '+(wOn?'on ':'')+(cp.done===cp.total?'done':'')+'" '+(wOn?'aria-current="page" ':'')+'onclick="selectSection(\'CH:'+ch+'\')" title="Every '+ITEM+' in this '+unitW+', mixed into one quiz"><span class="no">'+LAYERS_SM+'</span><span class="nm">Entire '+unitW+'</span><span class="ct">'+(cp.done===cp.total?'✓':cp.done+'/'+cp.total)+'</span></button>'+
  secs.map(sec=>{let p=progress(sec),done=p.done===p.total,on=sec===state.section&&study;return '<button class="sec '+(on?'on ':'')+(done?'done':'')+'" '+(on?'aria-current="page" ':'')+'onclick="selectSection(\''+sec+'\')"><span class="no">'+sec+'</span><span class="nm">'+esc(SECTION_NAMES[sec])+(TEST_SECS.includes(sec)?'<span class="tqtag">Like the '+esc(nextTest()?testKind():'test')+'</span>':'')+'</span><span class="ct">'+(done?'✓':p.done+'/'+p.total)+'</span></button>'}).join('')+'</div></details>'}).join('');
}

function drawStudy(){
 ensure();
 const s=state.section,p=progress(s),all=isX(s),ch=isCh(s),L=navList(s),idx=L.indexOf(s),pp=onPass(s)?(state.pass.ids?{done:state.pass.done.length,total:state.pass.ids.length,free:1}:{done:inSection(s).filter(c=>state.pass.done.includes(c.id)).length,total:inSection(s).length}):null;
 const bp=BANKS.length>1&&state.bank!=='main'?'<span class="pill set">'+esc(bankObj().name)+'</span>':'';
 $('crumb').innerHTML=all?bp+(s==='ALL'?'Mixed review':'Focused review'):'<span class="pill">'+esc(chLabel(secCh(s)))+'</span>'+(ch?'Entire '+unitW:esc(CH_NAMES[chOf(s)]))+(bp?' '+bp:'');
 $('title').textContent=secTitle(s);
 const th=$('chthumb'),tk=all?'logo':secCh(s);if(th.dataset.ch!==tk){th.dataset.ch=tk;const src=all?$('logo').src:CH_IMG(secCh(s));if(src)th.src=src;else th.removeAttribute('src')}
 document.title=secTitle(s)+' · '+CONFIG.title;
 const what=ch?unitW:'section';
 $('prevSec').disabled=!L.length||idx<=0;$('nextSec').disabled=!L.length||idx>=L.length-1;
 for(const [id,w] of [['prevSec','Previous '],['nextSec','Next ']]){$(id).title=w+what;$(id).setAttribute('aria-label',w+what)}
 $('notesBtn').hidden=!pageOn('notes');$('chartBtn').hidden=!chartsOn();
 $('mlabel').innerHTML=pp?(pp.free?'Practice round':'Review pass')+' · <b>'+pp.done+'</b> of '+pp.total+' '+ITEMS+' gone through':'<b>'+p.done+'</b> of '+p.total+' '+(s==='STAR'||s==='CLASS'||s==='CRAM'?(s==='STAR'?'starred ':'')+ITEMS+' reviewed this round':s==='DUE'?ITEMS+' reviewed':ITEMS+' mastered');
 $('goal').innerHTML=GOALS.length>1?'<span>Recall goal</span>'+goalSeg():'';
 $('fill').style.width=(100*(pp||p).done/Math.max(1,(pp||p).total))+'%';
 // Dots: in random order they are grouped by progress, so a dot's position never hints at a question.
 const items=inSection(s),rand=state.prefs.order==='random'||ch;
 $('dots').hidden=all||items.length>60;
 if(!$('dots').hidden){let list=items.map(c=>({c,r:Math.min(state.concepts[c.id].right,T())}));if(rand)list.sort((a,b)=>b.r-a.r);
  $('dots').innerHTML=list.map(({c,r})=>'<i class="'+(r>=T()?'full':r>0?'half':'')+(!rand&&state.active&&state.active.cid===c.id&&view==null?' cur':'')+'"></i>').join('')}

 const card=$('card');card.innerHTML=cardHTML();card.classList.toggle('fbnew',!!(state.feedback&&view==null&&Date.now()-(state.feedback.at||0)<900));
 const ck=s+'|'+view+'|'+(state.pmatch?'m'+state.pmatch.i:'')+(state.active?.cid||'done')+'|'+(state.concepts[state.active?.cid]?.seen??'');
 if(ck!==lastCardKey&&!reduceMotion){if(card.animate)card.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:280,easing:'cubic-bezier(.2,.7,.2,1)'});else{card.classList.remove('enter');void card.offsetWidth;card.classList.add('enter')}}   // no forced layout (v70)
 lastCardKey=ck;
 if(state.active&&state.active.typed&&!state.feedback&&view==null&&!state.pmatch){const i=$('typed');if(i)i.focus({preventScroll:true})}

 const att=state.correct+state.wrong;
 $('stats').innerHTML='<span><b>'+state.correct+'</b>correct</span><span><b>'+state.wrong+'</b>wrong</span><span><b>'+Math.round(100*state.correct/Math.max(1,att))+'%</b>accuracy</span><span><b>'+sectionKeys.filter(completed).length+'/'+sectionKeys.length+'</b>sections done</span><span class="keys">A–'+LETTERS[NCHOICE-1]+' or 1–'+NCHOICE+' choose'+(state.prefs.crossout?' · Shift+letter cross out':'')+(state.prefs.stars?' · S star':'')+(state.prefs.flag?' · F flag':'')+' · Enter continue · ← → browse</span>';

 $('ccount').textContent=p.done+'/'+items.length;$('cword').textContent=Items;
 $('concepts').querySelector('summary').childNodes[2].textContent='in this '+(s==='ALL'?'shuffle':all?'review':ch?unitW:'section');
 $('ctip').textContent='Each '+ITEM+' needs '+T()+' correct answer'+(T()>1?'s':'')+'. '+(AUTHORED?'Topic labels':'Names')+' here can give answers away, so open this after you\'ve practiced.';
 if($('concepts').open)drawGrid(items);else if($('grid').firstChild)$('grid').innerHTML='';
}
// v70: the list of every question in the section is drawn only while it's open (it was redrawn after every answer)
function drawGrid(items){$('grid').innerHTML=(items||inSection(state.section)).map(c=>{let r=Math.min(state.concepts[c.id].right,T());return '<div class="chip '+(r>=T()?'done':'')+'"><span>'+esc(c.term)+'</span>'+pips(r)+'</div>'}).join('')}

/* ---------- page switching ---------- */
const PG={
 dashboard:['Dashboard','<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'],
 study:['Practice','<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>'],
 cards:['Flashcards','<rect x="3" y="7" width="13" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3"/>'],
 notes:['Notes','<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'],
 match:['Drills','<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6h7M8.2 7.8l7.6 8.4"/>'],
 exam:['Mock exam','<path d="M9 3h6v4H9z"/><path d="M15 5h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3"/><path d="m9 14 2 2 4-4"/>'],
 prefs:['Personalize','<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>']};
// (A page saved before this version has no #homelink: fall back to a link in the page list.)
let HOME_LINK='';if(CONFIG.home){const h=$('homelink');if(h){h.href=CONFIG.home;h.hidden=false}else HOME_LINK='<a class="page" href="'+esc(CONFIG.home)+'">All courses</a>'}
// v66 bottom tab bar (phones): the first four pages that are on, then More (the side menu with topics and the rest)
const MORE_IC='<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>';
function drawTabbar(){const tb=$('tabbar');if(!tb)return;const exam=state.exam&&!state.exam.done&&page==='exam';   // hidden only on a running exam itself
 const ps=['dashboard','study','notes','exam','match','prefs'].filter(pageOn).slice(0,4);
 const show=ps.length>=2&&!exam;document.body.classList.toggle('tabs',show);if(!show){setHTML(tb,'');return}
 const sv=(d)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
 const nm=p=>p==='dashboard'?'Home':p==='study'?'Practice':p==='exam'?'Mock exam':PG[p][0];
 const dot=$('pages')&&$('pages').querySelector('.dndot,.ndot:not(.q),[data-dn] .dot');
 setHTML(tb,ps.map(p=>'<button class="'+(p===page?'on':'')+'" aria-current="'+(p===page?'page':'false')+'" onclick="setPage(\''+p+'\')">'+sv(PG[p][1])+nm(p)+'</button>').join('')+
  '<button onclick="toggleNav(true)" aria-label="More: topics, discussion, notifications">'+sv(MORE_IC)+'More'+(dot?'<span class="tbdot"></span>':'')+'</button>')}
function drawPages(){setHTML($('pages'),HOME_LINK+Object.keys(VIEWS).filter(pageOn).map(p=>'<button class="page '+(p===page?'on':'')+'" aria-current="'+(p===page?'page':'false')+'" onclick="setPage(\''+p+'\')"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+PG[p][1]+'</svg>'+PG[p][0]+'</button>').join('')+(NOTES_ONLY?'':'<button class="page" onclick="toggleNav(false);openLastLook()"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>Last look</button>')+discussLink()+notifyLink()+toolLinks());drawTabbar()}
// v71: the site's live quiz, opened for this course (the grade calculator waits for the class's grading scheme)
function toolLinks(){if(!CONFIG.home||!courseId())return '';const svg=d=>'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>',c=encodeURIComponent(courseId());
 return '<a class="page" style="text-decoration:none" href="quiz.html?course='+c+'">'+svg('<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>')+'Live quiz</a>'}
// ---- per-question discussion (threads named "<course>:<question id>")
const CHAT_SM='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:6px"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>';
let DCOUNT={};
const courseId=()=>(new URLSearchParams(location.search).get('course')||'').toLowerCase();
function discussOn(){return !!(CONFIG.discussion&&CONFIG.home&&courseId()&&/^https?:$/.test(location.protocol))}
const discKey=cid=>courseId()+':'+String(cid).toLowerCase();
function discussQ(cid){return 'discuss.html?c='+encodeURIComponent(courseId())+'&q='+encodeURIComponent(String(cid).toLowerCase())}
function loadDiscussCounts(redraw){if(!discussOn()||!cloudOn())return;rpc('discussion_counts',{p_course:courseId()}).then(rows=>{const c={};for(const r of rows||[])c[r.thread]=r.n;DCOUNT=c;if(redraw===true&&page==='study'&&state.feedback)draw()}).catch(()=>{})}
// The discussion panel: discuss.html (embed mode) in a frame. Wide screens: right side, the page makes room. Phones: bottom sheet.
function openDiscuss(cid){if(!discussOn())return true;dnRead(cid?discKey(cid):courseId());let d=$('dpanel');
 if(!d){d=document.createElement('aside');d.id='dpanel';d.className='dpanel';d.setAttribute('aria-label','Discussion');
  d.innerHTML='<div class="dph"><b id="dpt">Discussion</b><a class="dpx" id="dpnew" target="_blank" rel="noopener" title="Open in a new tab" aria-label="Open in a new tab"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg></a><button class="dpx" onclick="closeDiscuss()" aria-label="Close discussion"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><iframe id="dpf" title="Discussion"></iframe>';
  const sc=document.createElement('div');sc.id='dpscrim';sc.className='dpscrim';sc.onclick=closeDiscuss;document.body.append(d,sc)}
 const url=(cid?discussQ(cid):'discuss.html?c='+encodeURIComponent(courseId()));
 $('dpt').textContent=cid?'Discuss this question':CONFIG.title+' discussion';$('dpnew').href=url;
 if($('dpf').dataset.u!==url){$('dpf').dataset.u=url;$('dpf').src=url+'&embed=1'}
 void d.offsetWidth;d.classList.add('open');document.body.classList.add('dopen');ovOpen('discuss',closeDiscuss);return false}
function closeDiscuss(){const d=$('dpanel');if(d)d.classList.remove('open');document.body.classList.remove('dopen');ovClosed('discuss');loadDiscussCounts(true);dnPoll()}
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('dopen'))closeDiscuss()});
// back from signing in inside the panel: reopen it (#discuss=<question id>, or #discuss= for the course thread)
addEventListener('load',()=>{const m=location.hash.match(/^#discuss=([\w.-]*)$/);if(m){history.replaceState(history.state,'',location.pathname+location.search);setTimeout(()=>openDiscuss(m[1]||undefined),400)}});
// v71: #due (from the daily review reminder) opens the reviews that are due today, if there are any
function openDue(){if(location.hash!=='#due')return;history.replaceState(history.state,'',location.pathname+location.search);if(state.prefs.srs&&BANK.some(isDue))selectSection('DUE')}
// v91: #preview=<section> (from the home page's Next class strip) starts a 5-question warm-up on a topic that is coming up. A free round: it never changes mastery.
function openPreview(){const m=location.hash.match(/^#preview=([A-Za-z0-9:._-]+)$/);if(!m)return;try{history.replaceState(history.state,'',location.pathname+location.search)}catch(e){}
 const k=m[1];if(!validSection(k)||!inSection(k).length)return;selectSection(k);freeStart(5)}
if(document.readyState==='complete')setTimeout(openPreview,400);else addEventListener('load',()=>setTimeout(openPreview,400));
if(document.readyState==='complete')setTimeout(openDue,300);else addEventListener('load',()=>setTimeout(openDue,300));
// ---- discussion notifications: polls the course's newest posts (discussion_recent). state.dn = {base, seen, read:{thread:id}}.
// base: the newest post when notifications started (older posts never count as unread); seen: newest post already announced.
let DREC=[],dnT=null;
// Settings live in notifications.html (window.Notify) on the site; a single-file reviewer keeps them in its own prefs.
const nPref=k=>window.Notify?Notify.prefs()[k]!==false:state.prefs[k]!==false;
const dnOn=()=>discussOn()&&cloudOn();
function dnS(){return state.dn||(state.dn={base:null,seen:0,read:{}})}
const dnMine=p=>{const a=account();return !!(a&&((a.name&&p.author===a.name)||(a.dname&&p.author===a.dname)))};   // posts show the display name when one is set
// v97: the red dot and the pop-up are only for posts that reply to you, @mention you, or come from a moderator (p.ping,
// computed by the server for the signed-in viewer); other new posts get a quiet gray dot.
const dnNew=thread=>{const S=dnS();return DREC.filter(p=>(thread==null||p.thread===thread)&&p.id>Math.max(S.base||0,S.read[p.thread]||0)&&!dnMine(p))};
function dnUnread(thread){if(!dnOn()||!nPref('ddot'))return 0;return dnNew(thread).filter(p=>p.ping).length}
function dnQuiet(thread){if(!dnOn()||!nPref('ddot'))return 0;return dnNew(thread).filter(p=>!p.ping).length}
const dnDot=(n,q)=>n?'<span class="ndot" aria-label="'+n+' for you">'+(n>9?'9+':n)+'</span>':q?'<span class="ndot q" aria-label="'+q+' new"></span>':'';
function dnWhere(t){const q=t.slice(courseId().length+1);if(!q)return 'the '+CONFIG.title+' discussion';const c=BANK.find(x=>String(x.id).toLowerCase()===q);return c?'a question on “'+c.term+'”':'a question'}
function dnPoll(){if(!dnOn()||document.visibilityState==='hidden')return;const S=dnS();
 const args={p_course:courseId(),p_after:S.base==null?null:S.base},signed=typeof Auth!=='undefined'&&Auth.ses();if(signed)Auth.cloud=Auth.cloud||CLOUD;
 (signed?Auth.rpc('discussion_recent',args,true).catch(()=>rpc('discussion_recent',args)):rpc('discussion_recent',args)).then(rows=>{rows=Array.isArray(rows)?rows:[];
  if(S.base==null){S.base=rows.reduce((m,r)=>Math.max(m,r.id),0);S.seen=S.base;DREC=[];save();dnPaint();return}
  DREC=rows;const fresh=rows.filter(r=>r.ping&&r.id>S.seen&&!dnMine(r)&&r.id>(S.read[r.thread]||0));S.seen=Math.max(S.seen,...rows.map(r=>r.id));save();
  if(fresh.length&&nPref('dpop')&&!(state.exam&&!state.exam.done&&page==='exam'))dnPop(fresh);dnPaint()}).catch(()=>{})}
function dnPaint(){if(typeof drawPages==='function')drawPages();document.querySelectorAll('[data-dn]').forEach(e=>{e.innerHTML=dnDot(dnUnread(e.dataset.dn),dnQuiet(e.dataset.dn))})}
function dnRead(thread){const S=dnS();const ids=DREC.filter(p=>thread==null||p.thread===thread).map(p=>p.id);const top=Math.max(S.seen||0,...ids);
 if(thread==null){DREC.forEach(p=>S.read[p.thread]=top)}else S.read[thread]=top;save();dnPaint()}
function dnPop(fresh){let b=$('dnpop');if(!b){b=document.createElement('div');b.id='dnpop';b.className='dnpop';b.setAttribute('role','status');b.setAttribute('aria-live','polite');document.body.appendChild(b)}
 const p=fresh[0],n=fresh.length;b.dataset.t=p.thread;
 const why={reply:'replied to you',mention:'mentioned you',mod:'posted (moderator)'}[p.ping]||'commented';
 b.innerHTML='<div class="dnh">'+CHAT_SM+'<b>'+(n>1?n+' new for you':p.ping==='mod'?'Moderator post':p.ping==='mention'?'You were mentioned':'New reply to you')+'</b><span>'+esc(CONFIG.title)+'</span><button class="dpx" onclick="dnClose()" aria-label="Dismiss">×</button></div>'+
  '<p class="dnw"><b>'+esc(p.author||'Someone')+'</b> '+why+' on '+esc(dnWhere(p.thread))+'</p><p class="dnb">'+esc(String(p.body||'').slice(0,140))+(String(p.body||'').length>140?'…':'')+'</p>'+
  '<div class="dna"><button class="btn sm primary" onclick="dnOpen()">Open</button>'+(n>1?'<button class="btn sm" onclick="dnRead();dnClose()">Mark all read</button>':'')+'</div>';
 b.hidden=false;void b.offsetWidth;b.classList.add('in');clearTimeout(dnPop.t);dnPop.t=setTimeout(dnClose,15000)}
function dnClose(){const b=$('dnpop');if(b){b.classList.remove('in');setTimeout(()=>{b.hidden=true},250)}}
function dnOpen(){const b=$('dnpop'),t=b&&b.dataset.t;dnClose();if(!t)return;const q=t.slice(courseId().length+1);const c=q&&BANK.find(x=>String(x.id).toLowerCase()===q);openDiscuss(c?c.id:undefined)}
// Site updates (updates.json): sidebar link with an unread dot, and a one-time pop-up for news about this course.
let NFEED=[];
function notifyLink(){if(!window.Notify||!CONFIG.home)return '';const n=nPref('ddot')?Notify.unread(NFEED):0;
 return '<a class="page" style="text-decoration:none" href="notifications.html"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>Notifications'+dnDot(n)+'</a>'}
function notifyStart(){if(!window.Notify||!CONFIG.home||!courseId())return;Notify.load().then(f=>{NFEED=f;drawPages();
 const K='reviewer_notify_pop_'+courseId();let last=null;try{last=JSON.parse(localStorage.getItem(K))}catch(e){}
 // site-wide news pops up once on the whole site (not once per course); course news once in that course
 const G='reviewer_notify_pop_all';let g=null;try{g=JSON.parse(localStorage.getItem(G))}catch(e){}
 if(g==null){g=last;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.indexOf('reviewer_notify_pop_')===0&&k!==G)g=Math.max(g||0,+localStorage.getItem(k)||0)}}catch(e){}}
 const top=Math.max(0,...f.map(u=>u.id));try{localStorage.setItem(K,JSON.stringify(top));localStorage.setItem(G,JSON.stringify(top))}catch(e){}
 if(last==null||!nPref('pop'))return;   // first visit: nothing old pops up
 const seen=Math.max(g||0,Notify.readUpTo());
 const mine=f.filter(u=>Notify.on(u.type)&&(u.course?u.course===courseId()&&u.id>last:u.id>seen)).sort((a,b)=>(!!b.course-!!a.course)||b.id-a.id);if(!mine.length)return;
 setTimeout(()=>{if(state.exam&&!state.exam.done&&page==='exam')return;upPop(mine)},3500)})}
function upPop(items){let b=$('uppop');if(!b){b=document.createElement('div');b.id='uppop';b.className='dnpop up';b.setAttribute('role','status');b.setAttribute('aria-live','polite');document.body.appendChild(b)}
 const u=items[0],n=items.length;
 b.innerHTML='<div class="dnh"><b>'+(n>1?n+' updates':'New')+'</b><span>'+esc(CONFIG.title)+'</span><button class="dpx" onclick="upClose()" aria-label="Dismiss">×</button></div>'+
  '<p class="dnb" style="margin-top:8px"><b>'+esc(u.title)+'</b></p><p class="dnw" style="margin:0 0 10px">'+esc(u.text)+'</p>'+
  '<div class="dna"><a class="btn sm primary" href="notifications.html">See all updates</a><button class="btn sm" onclick="upClose()">Got it</button></div>';
 b.hidden=false;void b.offsetWidth;b.classList.add('in');clearTimeout(upPop.t);upPop.t=setTimeout(upClose,20000)}
function upClose(){const b=$('uppop');if(b){b.classList.remove('in');setTimeout(()=>{b.hidden=true},250)}}
function discussLink(){const id=new URLSearchParams(location.search).get('course');if(!CONFIG.discussion||!CONFIG.home||!id||!/^https?:$/.test(location.protocol))return '';
 return '<a class="page" style="text-decoration:none" href="discuss.html?c='+encodeURIComponent(id)+'" onclick="return openDiscuss()"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/><path d="M8.5 10.5h7M8.5 14h4.5"/></svg>Discussion'+dnDot(dnUnread(),dnQuiet())+'</a>'}
function draw(){
 PV++;
 if(!pageOn(page))page='dashboard';
 navTrack();
 for(const [p,v] of Object.entries(VIEWS))$(v).hidden=p!==page;
 $('main').classList.toggle('wide',page==='dashboard'||page==='notes');
 drawPages();
 setHTML($('nav'),navHTML());
 drawSetSwitch();
 drawTheme();
 drawNewsDot();
 ({dashboard:drawDash,study:drawStudy,cards:drawCards,notes:drawNotes,match:drawMatch,exam:drawExam,prefs:drawPrefs})[page]();
}
// v98: the Flashcards page; cards.js (scheduling + the card screen) loads the first time it opens.
function drawCards(){document.title='Flashcards · '+CONFIG.title;if(window.Cards){Cards.draw();return}
 const el=$('fcbody');if(!el.firstChild)el.innerHTML='<p class="desc">Loading the cards…</p>';if(drawCards.busy)return;drawCards.busy=1;
 const s=document.createElement('script');s.src='cards.js';s.onload=()=>{if(page==='cards'&&window.Cards)Cards.draw()};
 s.onerror=()=>{drawCards.busy=0;s.remove();el.innerHTML='<section class="panel"><h2>The flashcards could not be loaded</h2><p class="desc">Check your connection, then open this page again.</p></section>'};document.body.appendChild(s)}
// cards due today from the saved card memory alone (the deck file isn't needed for the count)
function fcDue(){const t=Date.now(),d=x=>Math.floor((x-new Date(x).getTimezoneOffset()*6e4-144e5)/864e5),td=d(t);let n=0;for(const id in FC.c){const a=FC.c[id];if(a[6]===2?d(a[2]*6e4)<=td:a[2]*6e4<=t)n++}return n}
/* ---------- question banks: Main, plus one tab per extra set (e.g. a friend's) ---------- */
function drawSetSwitch(){const el=$('setsw');el.hidden=BANKS.length<2;el.classList.toggle('many',BANKS.length>3);
 if(BANKS.length>1)setHTML(el,BANKS.map(b=>{const on=b.id===state.bank,n=bankItems(b).length;
  return '<button role="radio" aria-checked="'+on+'" class="'+(on?'on':'')+'" onclick="setBank(\''+b.id+'\')" data-tip="<b>'+esc(b.name)+' · '+n+' '+ITEMS+'</b>'+esc(b.desc||'')+'">'+esc(b.name)+'<span class="num">'+n+'</span></button>'}).join(''));
 $('brandsub').textContent=NOTES_ONLY?'Notes and transes':scopeLabel()+' · '+BANK.length+' '+ITEMS;drawScopeSw();$('brandtitle').textContent=CONFIG.title;
}
function setBank(id){if(id===state.bank)return;state.bank=id;state.pmatch=null;state.pass=null;refreshBank();state.active=null;state.feedback=null;state.selected=null;view=null;save();draw()}
function setPref(k,v){if(state.prefs[k]===v)return;state.prefs[k]=v;
 if(k==='extras'){refreshBank();state.active=null;state.feedback=null;state.selected=null}
 if(k==='typeMode'&&state.active&&!state.feedback)state.active.typed=canType(state.active);
 if(!validSection(state.section)){state.section=sectionKeys[0];state.active=null;state.feedback=null;state.selected=null;state.pmatch=null}
 if(k==='mix'&&!v)state.pmatch=null;
 view=null;save();draw()}
function setGoal(n){setPref('target',n)}
const fcPref=k=>v=>setPref(k,v);   // Personalize → Flashcards buttons
function setOrder(v){setPref('order',v)}
function setTypeMode(v){setPref('typeMode',v)}
function setMix(v){setPref('mix',v)}
function setOpt(k){state.prefs.opt=Object.assign({},state.prefs.opt,{[k]:!optOn(k)});refreshBank();MX=null;
 state.active=null;state.feedback=null;state.selected=null;state.pmatch=null;if(!validSection(state.section))state.section=sectionKeys[0];view=null;save();draw()}
const fmtDay=d=>new Date(d+'T00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
function examWhen(e){if(!e||!e.date)return '';const t=new Date();t.setHours(0,0,0,0);const n=Math.round((new Date(e.date+'T00:00')-t)/864e5);
 return n<0?'':n===0?'today':n===1?'tomorrow':'in '+n+' days'}
function scopeLabel(){const e=examObj();return e?e.name:EXAMS.length?'All '+unitsW:CONFIG.scope}
// The switcher only appears when there is a real choice (one exam that covers everything needs none).
function scopeOpts(){if(!EXAMS.length)return [];const o=EXAMS.map(e=>[e.id,(e.id===CONFIG.activeExam&&EXAMS.length>1?'★ ':'')+e.name+(e.date?' · '+fmtDay(e.date):'')]);
 if(!EXAMS.some(examAll))o.push(['all','All '+unitsW]);return o}  // an exam covering everything already is "all"
function drawScopeSw(){const el=$('scopesw'),o=scopeOpts();el.hidden=o.length<2;if(o.length<2)return;const e=examObj(),cur=e?e.id:'all';
 el.innerHTML='<label><span>Studying for</span><select onchange="setScope(this.value)">'+o.map(([v,t])=>'<option value="'+esc(v)+'"'+(v===cur?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>'}
function setScope(v){const e=examObj();if(v===(e?e.id:'all'))return;state.prefs.scope=v;state.exSetup=null;state.pass=null;refreshBank();M=null;MX=null;notesCh='all';matchCh='all';
 state.active=null;state.feedback=null;state.selected=null;state.pmatch=null;if(!validSection(state.section))state.section=sectionKeys[0];view=null;save();draw()}
function setPage(p){toggleNav(false);if(p===page||!pageOn(p))return;page=p;state.page=p;view=null;save();draw();window.scrollTo(0,0)}

/* ---------- dashboard ---------- */
const ICON={
 target:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
 check:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
 layers:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
 bulb:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>',
 flame:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>'
};
/* ---------- v71: iPhone Safari can erase saved progress ----------
   Safari deletes a site's saved data after 7 days of using Safari without opening it; apps added to the Home Screen are
   exempt. For someone on iPhone Safari who isn't signed in or syncing: a one-time card with Sign in and the Home Screen
   steps. (A Home Screen app starts with empty storage, so signing in comes first.) */
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const STANDALONE=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const BK_KEY='reviewer_backup_card';
function bkShow(){if(!CONFIG.home||!IOS||STANDALONE||syncCode||!cloudOn())return false;try{if(localStorage.getItem(BK_KEY))return false}catch(e){return false}return state.correct+state.wrong+state.lookups>=5}
function bkCard(){let el=$('bkcard');if(!bkShow()){if(el)el.hidden=true;return}
 if(!el){el=document.createElement('section');el.id='bkcard';el.className='bkcard';el.setAttribute('aria-label','Back up your progress');$('hero').before(el)}
 const ic='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>';
 el.innerHTML='<span class="bki">'+ic+'</span><div><h3>Back up your progress</h3><p>On iPhone, Safari erases this site\'s saved progress if you don\'t open it for 7 days. Sign in to keep a copy online, on every device.</p>'+
  (el.dataset.steps?'<ol><li><b>Sign in first</b>, so your progress comes along.</li><li>Tap <b>Share</b> at the bottom of Safari.</li><li>Tap <b>Add to Home Screen</b>.</li><li>Open the app from your Home Screen and sign in there too.</li></ol>':'')+
  '<div class="bkr"><a class="btn sm primary" href="./?signin=1" style="text-decoration:none">Sign in with Google</a>'+(el.dataset.steps?'':'<button class="btn sm" onclick="$(\'bkcard\').dataset.steps=1;bkCard()">Add to Home Screen</button>')+'<button class="btn sm" onclick="bkDone()">Not now</button></div></div>';
 el.hidden=false}
function bkDone(){try{localStorage.setItem(BK_KEY,'1')}catch(e){}bkCard()}
/* ---------- v71: exam-eve "last look" ----------
   One page with the questions you've had the most trouble with in the current scope (missed, looked up, hinted, starred,
   not mastered yet), with their answers, to read the night before. Not enough history yet: the class's most missed, then
   the highest-yield set. "Hide answers" turns it into a quick self-test; it prints cleanly. */
let LL={n:25,hide:false};
function llList(){const sc=c=>{const k=state.concepts[c.id]||{};return 3*(k.wrong||0)+2*(k.lookups||0)+(k.hints||0)+(k.star?2:0)+(isM(c)?0:2)};
 const mine=BANK.filter(c=>{const k=state.concepts[c.id]||{};return k.wrong||k.lookups||k.star||(k.seen&&!isM(c))}).sort((a,b)=>sc(b)-sc(a));
 if(mine.length>=8)return {src:'mine',list:mine};
 const extra=(classOn()?classList():cramOn()?cramList():BANK).filter(c=>!mine.includes(c));
 return {src:mine.length?'mix':classOn()?'class':'yield',list:mine.concat(extra)}}
function openLastLook(){let el=$('lastlook');if(!el){el=document.createElement('div');el.id='lastlook';el.className='llwrap';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Last look');document.body.appendChild(el)}
 drawLastLook();el.hidden=false;document.body.classList.add('llopen');el.scrollTop=0;ovOpen('lastlook',closeLastLook)}
function closeLastLook(){const el=$('lastlook');if(el)el.hidden=true;document.body.classList.remove('llopen');ovClosed('lastlook')}
function llSet(ch){Object.assign(LL,ch);drawLastLook()}
function drawLastLook(){const el=$('lastlook');if(!el)return;const {src,list}=llList(),show=LL.n?list.slice(0,LL.n):list,nt=nextTest(),when=nt?whenAt(nt.at):'';
 const note=src==='mine'?'The '+ITEMS+' you\'ve missed, looked up or starred most, hardest first.':src==='mix'?'Your misses first, then '+(classOn()?'the class\'s most missed':'the highest-yield '+ITEMS)+' (answer more to make this list yours).':src==='class'?'You haven\'t missed enough yet, so these are the class\'s most missed.':'You haven\'t missed enough yet, so these are the highest-yield '+ITEMS+'.';
 const stem=c=>c.q?esc(c.q):c.definition?esc(c.definition):esc(c.term),ans=c=>c.q?ansHTML(c.a):esc(c.term);
 el.innerHTML='<div class="llbox"><div class="llhead"><div><div class="eyebrow">'+esc(CONFIG.title)+' · '+esc(scopeLabel())+(when?' · '+(nt.name===scopeLabel()?'':esc(nt.name)+' ')+when:'')+'</div><h2>Last look</h2><p>'+note+'</p></div>'+
  '<button class="icon llx" onclick="closeLastLook()" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'+
  '<div class="llbar"><span class="seg">'+[15,25,50,0].map(n=>'<button aria-pressed="'+(LL.n===n)+'" onclick="llSet({n:'+n+'})">'+(n||'All '+list.length)+'</button>').join('')+'</span>'+
  '<label class="llhide"><input type="checkbox"'+(LL.hide?' checked':'')+' onchange="llSet({hide:this.checked})"> Hide answers</label><span class="sp"></span><button class="btn sm" onclick="window.print()">Print</button></div>'+
  (show.length?'<ol class="llist'+(LL.hide?' hid':'')+'">'+show.map(c=>{const k=state.concepts[c.id]||{};
   return '<li><p class="llq">'+stem(c)+'</p>'+figHTML(c.id)+'<button class="btn sm llshow" onclick="this.closest(\'li\').classList.add(\'shown\')">Show answer</button><p class="lla">'+ans(c)+'</p>'+(c.why?'<p class="llw">'+esc(c.why)+'</p>':'')+
    (k.wrong||k.lookups?'<span class="llm">missed '+((k.wrong||0)+(k.lookups||0))+'×</span>':'')+'</li>'}).join('')+'</ol>':'<p class="llw">Nothing here yet. Practice a few '+ITEMS+' first.</p>')+
  '</div>'}
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('llopen'))closeLastLook()});
/* ---------- v71: daily goal and streak, across every course on this device (site/daily.js) ---------- */
function dailyAdd(n){if(n&&window.ClassNow&&CONFIG.home&&state.prefs.crowd)ClassNow.ping(courseId());if(!n||!window.Daily||!CONFIG.home)return;try{const g=Daily.add(n);if(g&&!(Daily.hidden&&Daily.hidden()))setTimeout(()=>{toast('Daily goal reached: '+g.goal+' questions'+(g.streak>1?' · '+g.streak+'-day streak':''));celebrate('section')},650)}catch(e){}}
// v104: badges (site/badges.js) count study habits across courses: events here, levels for answers, sections and lessons
function badgeAdd(c,n){if(window.Badges&&CONFIG.home)try{Badges.add(c,n)}catch(e){}}
let badgeT=0;function badgeLevels(now){if(!window.Badges||!CONFIG.home)return;clearTimeout(badgeT);badgeT=setTimeout(()=>{try{const id=courseId();
 Badges.level('answers',id,(state.correct||0)+(state.wrong||0));Badges.level('sections',id,sectionKeys.filter(completed).length);
 Badges.level('lessons',id,chapters.filter(ch=>{const p=chProgress(ch);return p.total&&p.done===p.total}).length)}catch(e){}},now?0:1500)}
// v103: how many classmates answered in this course in the last 3 minutes (only with class stats on; you are not counted)
function cnNow(){if(!window.ClassNow||!CONFIG.home||!state.prefs.crowd)return;ClassNow.now().then(s=>{const h=$('hero');if(!s||!h)return;const id=courseId(),n=(s.by[id]||0)-(s.me&&s.here===id?1:0);let e=$('cnnow');
 if(n<1){if(e)e.remove();return}if(!e){e=document.createElement('p');e.id='cnnow';e.className='cnnow';h.firstElementChild.appendChild(e)}
 e.innerHTML='<i></i>'+n+' classmate'+(n>1?'s are':' is')+' studying this course right now'})}
function dailyTile(tile){const d=window.Daily&&CONFIG.home&&!(Daily.hidden&&Daily.hidden())?Daily.now():null;if(!d)return '';
 return tile(ICON.flame,'Today',d.today+'<small>/'+d.goal+'</small>',d.met?(d.streak>1?d.streak+'-day streak':'Goal done today'):d.streak?d.streak+'-day streak · keep it going':'Daily goal: '+d.goal+' questions')}
function mastered(){return BANK.filter(isM).length}
function chProgress(ch){return progress('CH:'+ch);let a=BANK.filter(c=>chOf(c.section)===String(ch));return {done:a.filter(isM).length,total:a.length}}
function nextSection(){if(!isX(state.section)&&!isCh(state.section)&&!completed(state.section))return state.section;return sectionKeys.find(k=>!completed(k))||sectionKeys[0]}

/* ---------- name (saved with progress in this browser only) ---------- */
const PENCIL='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
// Late-night studying (midnight to 5) still counts as evening.
const hello=()=>{const hr=new Date().getHours();return hr<5?'Good evening':hr<12?'Good morning':hr<18?'Good afternoon':'Good evening'};
function drawGreeting(){
 const n=(state.name||'').trim();
 $('greet').innerHTML=n?hello()+', <button class="namebtn" onclick="editName()" title="Change your name">'+esc(n)+PENCIL+'</button>'
  :hello()+' <button class="namebtn add" onclick="editName()">'+PENCIL+'Add your name</button>';
}
function editName(){
 const h=$('greet');
 h.innerHTML=hello()+', <input class="nameinput" id="nameinput" maxlength="40" placeholder="Your name" aria-label="Your name" autocomplete="given-name">';
 const i=$('nameinput');i.value=state.name||'';i.focus();i.select();
 let done=false;const finish=keep=>{if(done)return;done=true;if(keep){setName(i.value)}drawGreeting()};
 i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish(true)}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false)}});
 i.addEventListener('blur',()=>finish(true));
}

function drawDash(){
 drawGreeting();drawClassPanel();drawMissPanel();drawContribPanel();loadMine();bkCard();const ex=examObj(),nt=nextTest(),when=nt?whenAt(nt.at):'';$('dashcrumb').textContent='Dashboard'+(ex?' · '+ex.name:'');
 document.title='Dashboard · '+CONFIG.title;
 const nMiss=BANK.filter(c=>isMissedC(c)&&!isM(c)).length,nStar=BANK.filter(isStar).length,nDue=state.prefs.srs?BANK.filter(isDue).length:0;
 $('weakgo').hidden=!(state.prefs.missed&&nMiss);$('weakgo').textContent='Practice missed only ('+nMiss+')';
 $('weakdesc').textContent=Items+" you've answered incorrectly and haven't mastered yet.";
 const m=mastered(),pct=Math.round(100*m/Math.max(1,BANK.length)),att=state.correct+state.wrong;
 const secDone=sectionKeys.filter(completed).length,nx=nextSection(),np=progress(nx);
 const bn=BANKS.length>1?esc(bankObj().name)+' · ':'';
 $('hero').innerHTML='<div><div class="big num">'+pct+'%<small>mastered</small></div>'+
  '<p class="sub">'+(when?'<span class="when">'+esc(nt.name)+' '+when+'</span> · ':'')+bn+'<b class="num">'+m+'</b> of <span class="num">'+BANK.length+'</span> '+ITEMS+' mastered '+(ex?'for '+esc(ex.name):'across '+esc(scopeLabel()))+' · <b class="num">'+secDone+'</b> of '+sectionKeys.length+' sections complete</p>'+
  '<div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'" aria-label="Overall mastery"><div class="fill" style="width:'+pct+'%"></div></div></div>'+
  '<div class="next"><div class="eyebrow">'+(secDone===sectionKeys.length?'All done':'Up next')+'</div><div class="t">'+esc(nx+' '+SECTION_NAMES[nx])+'</div><div class="m num">'+np.done+' of '+np.total+' '+ITEMS+' mastered</div>'+(secDone===sectionKeys.length?'<button class="btn primary" onclick="reviewAll()" title="Every '+ITEM+' once, shuffled. You keep your mastery unless you miss one.">Review pass · '+(ex?'all of '+esc(ex.name):'all '+unitsW)+'</button>':'<button class="btn primary" onclick="selectSection(\''+nx+'\')">'+(np.done?'Resume':'Start')+' section</button>')+(nt&&nt.at-Date.now()<4*DAY?'<button class="shuffle-link" onclick="openLastLook()">'+NOTE_SM+esc(nt.name)+' '+when+'? Read your last look</button>':'')+(nDue?'<button class="shuffle-link due" onclick="selectSection(\'DUE\')">'+CLOCK_SM+'Review '+nDue+' due today</button>':'')+(cramOn()?'<button class="shuffle-link cram" onclick="selectSection(\'CRAM\')">'+FLAME_SM+'Short on time? Cram mode · '+cramList().length+' highest-yield '+ITEMS+'</button>':'')+'<button class="shuffle-link" onclick="selectSection(\'ALL\')">'+SHUFFLE+'Or shuffle all '+unitsW+'</button>'+
  (pageOn('cards')?'<button class="shuffle-link" onclick="setPage(\'cards\')">'+FC_SM+'Flashcards'+(fcDue()?' ('+fcDue()+' due)':'')+'</button>':'')+
  (pageOn('notes')?'<button class="shuffle-link" onclick="openNotes(\'all\')">'+NOTE_SM+'Read the high-yield notes</button>':'')+
  (state.prefs.stars&&nStar?'<button class="shuffle-link" onclick="selectSection(\'STAR\')">'+STAR_SM+'Review starred ('+nStar+')</button>':'')+(classOn()?'<button class="shuffle-link" onclick="selectSection(\'CLASS\')">'+CLASS_SM+'Class\'s most missed ('+classList().length+')</button>':'')+'</div>';

 cnNow();badgeLevels(true);
 const tile=(ic,k,v,d)=>'<div class="kpi"><div class="k">'+ic+k+'</div><div class="v">'+v+'</div><div class="d">'+d+'</div></div>';
 $('kpis').innerHTML=
  tile(ICON.target,'Accuracy',Math.round(100*state.correct/Math.max(1,att))+'<small>%</small>',state.correct+' right · '+state.wrong+' wrong')+
  (dailyTile(tile)||tile(ICON.check,'Answered',att+state.lookups,'questions so far'))+
  tile(ICON.layers,'Sections done',secDone+'<small>/'+sectionKeys.length+'</small>',(sectionKeys.length-secDone)+' to go')+
  (MSETS.length&&pageOn('match')?tile(PG.match[1]?'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+PG.match[1]+'</svg>':'','Drills',state.match.total?Math.round(100*state.match.right/state.match.total)+'<small>%</small>':'–',state.match.sets+' set'+(state.match.sets===1?'':'s')+' checked')
   :tile(ICON.bulb,'Hints used',state.hints,state.lookups+' slide checks'));

 $('chcards').innerHTML=chapters.map(ch=>{const p=chProgress(ch),w=Math.round(100*p.done/p.total),secs=sectionKeys.filter(k=>chOf(k)===ch);
  const first=secs.find(k=>!completed(k))||secs[0];
  return '<button class="chcard" onclick="selectSection(\''+first+'\')" aria-label="'+esc(chLabel(ch))+', '+esc(CH_NAMES[ch])+', '+p.done+' of '+p.total+' '+ITEMS+' mastered">'+(CH_IMG(ch)?'<span class="art"><img src="'+CH_IMG(ch)+'" alt="" loading="lazy" width="960" height="720"></span>':'<span class="art noimg"><b>'+esc(ch)+'</b></span>')+
   '<span class="body"><span class="no">'+esc(chLabel(ch))+'</span><span class="nm">'+esc(CH_NAMES[ch])+'</span><span class="track"><span class="fill" style="display:block;width:'+w+'%"></span></span><span class="meta"><span>'+p.done+'/'+p.total+' '+ITEMS+'</span><span>'+w+'%</span></span></span></button>'}).join('');

 const rec=state.history.filter(h=>h.cid).slice(-40);
 $('recentN').textContent=rec.length?'last '+rec.length:'';
 if(!rec.length)$('recent').innerHTML='<p class="empty">No answers yet. Your recent results will show up here.</p>';
 else{const c=rec.filter(h=>h.correct).length,l=rec.filter(h=>h.lookup).length,w=rec.length-c-l;
  $('recent').innerHTML='<div class="recent-sum"><span><b>'+c+'</b>correct</span><span><b>'+w+'</b>wrong</span><span><b>'+l+'</b>slide checks</span><span><b>'+Math.round(100*c/rec.length)+'%</b>hit rate</span></div>'+
   '<div class="strip">'+rec.map(h=>{const st=h.correct?'c':h.lookup?'l':'w',lab=h.correct?'Correct':h.lookup?'Checked slides':'Wrong';
    const c=byId[h.cid]||{};return '<i class="'+st+'" data-tip="<b>'+lab+'</b>'+esc(h.term||c.term||'')+' · '+esc(h.section||c.section||'')+'"></i>'}).join('')+'</div>'+
   '<div class="legend"><span><i style="background:var(--good)"></i>Correct</span><span><i style="background:var(--bad)"></i>Wrong</span><span><i style="background:var(--amber)"></i>Checked slides</span></div>'}

 $('heat').innerHTML=chapters.map(ch=>{const secs=sectionKeys.filter(k=>chOf(k)===ch);
  return '<div class="heat-row"><div class="h"><b>'+ch+'</b>'+esc(CH_NAMES[ch])+'</div><div class="cells">'+secs.map(k=>{const p=progress(k),v=Math.round(100*p.done/p.total);
   return '<button class="cell'+(v>=55?' hi':'')+(k===state.section?' cur':'')+'" style="--p:'+v+'%" onclick="selectSection(\''+k+'\')" aria-label="'+esc(k+' '+SECTION_NAMES[k])+', '+v+' percent mastered" data-tip="<b>'+esc(k+' '+SECTION_NAMES[k])+'</b>'+p.done+' of '+p.total+' mastered ('+v+'%)">'+k+'</button>'}).join('')+'</div></div>'}).join('');

 const weak=BANK.map(c=>({c,k:state.concepts[c.id]})).filter(x=>x.k.wrong>0&&x.k.right<T()).sort((a,b)=>(!!b.k.sure-!!a.k.sure)||(b.k.wrong-b.k.right)-(a.k.wrong-a.k.right)||b.k.wrong-a.k.wrong).slice(0,8);
 $('weak').innerHTML=weak.length?weak.map(({c,k})=>'<li><button onclick="selectSection(\''+c.section+'\')"><span class="t">'+esc(c.term)+'<span>'+c.section+' · '+esc(SECTION_NAMES[c.section])+'</span></span><span class="w">'+(k.sure?'<b class="surew" title="You were sure, but it was wrong">Sure</b> ':'')+missBadge(c.id)+k.wrong+' wrong</span>'+pips(Math.min(k.right,T()))+'</button></li>').join(''):'<li class="empty">Nothing flagged yet. '+Items+' you miss will be listed here so you can go back to them.</li>';
}

/* ---------- notes ---------- */
// NOTES rows look like "Term — what it points to | Term — ..."; " = " and " – " also split a row.
// Rows split on " | " and "Term — cue", but never inside $…$ math (where | and = are part of the formula).
function noteRows(t){const keep=[],hide=x=>x.replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g,m=>{keep.push(m);return '\u0000'+(keep.length-1)+'\u0000'}),back=x=>x.replace(/\u0000(\d+)\u0000/g,(_,i)=>keep[+i]);
 return hide(t).split(/\s*\|\s*/).filter(Boolean).map(p=>{const m=p.match(/^(.+?)\s+[—–=]\s+(.+)$/);return m?[back(m[1]),back(m[2])]:[back(p),'']})}
const NOTES_PARSED=(NOTES_DATA||[]).map(([ch,groups])=>({ch:String(ch),groups:groups.map(([title,txt,sec])=>({title,sec,rows:noteRows(String(txt))}))}));
let notesCh='all',notesQ='';
// A notes section with a non-numeric id (like "W" for a Who's who page) spans every chapter: it is always shown and has no chapter number.
const noteScope=ch=>!/^\d/.test(ch)||inScopeCh(ch);
const noteTag=ch=>(/^\d/.test(ch)?esc(UNIT)+' '+esc(ch)+' · ':'')+esc(CH_NAMES[ch]||'');
function setNotesCh(k){notesCh=k;drawNotes()}
function openNotes(ch,cid){notesCh=ch||(isX(state.section)?'all':secCh(state.section));if(!NOTES_PARSED.some(n=>n.ch===notesCh&&noteScope(n.ch)))notesCh='all';notesQ='';
 if(page==='notes'){draw();window.scrollTo(0,0)}else setPage('notes');if(cid)setTimeout(()=>focusNote(cid),80)}
// Scrolls to the note card that best matches a question: its term and answer in the card, its section name in the title.
function focusNote(cid){const c=byId[cid];if(!c)return;const low=t=>String(t||'').toLowerCase(),term=low(c.term),ans=low(c.a),GEN=/^(theory|theories|perspective|perspectives|stage|stages|chapter|lesson|section|part|introduction|overview|basics|types|kinds)$/,sec=low(SECTION_NAMES[c.section]).split(/\W+/).filter(w=>w.length>3&&!GEN.test(w)),tw=term.split(/\W+/).filter(w=>w.length>3&&!GEN.test(w));
 let best=null,bs=0;document.querySelectorAll('#nbody .ncard').forEach(el=>{const t=low(el.innerText),h=low((el.querySelector('h3')||{}).textContent);
  const sc=(term.length>2&&t.includes(term)?5:0)+(ans.length>2&&ans.length<60&&t.includes(ans)?4:0)+sec.filter(w=>h.includes(w)).length+3*tw.filter(w=>h.includes(w)).length+3*tw.filter(w=>w.length>=5&&!h.includes(w)&&t.includes(w)).length;if(sc>bs){bs=sc;best=el}});
 if(!best||bs<3)return;best.scrollIntoView({block:'center',behavior:reduceMotion?'auto':'smooth'});best.classList.add('flash');setTimeout(()=>best.classList.remove('flash'),1800)}
/* Full documents (e.g. the transes PDF): CONFIG.docs = [{title, file}], file relative to the website.
   The file version opens the website's copy (through CONFIG.shareUrl). */
const DOCS=(CONFIG.docs||[]).filter(d=>d&&d.file);
// On the website, PDFs open in the site's own reader (transes.html); the single-file version links the PDF directly.
function docView(d,u){const id=new URLSearchParams(location.search).get('course');if(!CONFIG.home||!id||!/^https?:$/.test(location.protocol)||!/^courses\/[\w-]+\/[\w.-]+\.pdf$/i.test(d.file))return u;return (d.kind==='slides'||/^slides?\b/i.test(d.title||'')?'slides.html':'transes.html')+'?f='+encodeURIComponent(d.file)+'&t='+encodeURIComponent(d.title||'Full transes')+'&c='+encodeURIComponent(id)}
function docURL(d){if(/^https?:/i.test(d.file)||/^https?:$/.test(location.protocol))return d.file;try{return new URL(d.file,CONFIG.shareUrl).href}catch(e){return ''}}
function drawNotes(){
 $('nChartBtn').hidden=!chartsOn();$('nBlurtBtn').hidden=!state.prefs.blurt||!NOTES_PARSED.some(n=>noteScope(n.ch)&&/^\d/.test(n.ch));
 $('ndocs').innerHTML=DOCS.map(d=>{const u=docURL(d);return u?'<a class="btn sm docbtn" href="'+esc(docView(d,u))+'"'+(docView(d,u)===u?' target="_blank" rel="noopener" title="Opens in a new tab"':'')+'><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>'+esc(d.title||'Full transes')+'</a>':''}).join('');
 document.title='Notes · '+CONFIG.title;
 $('nchips').innerHTML=chChips(NOTES_PARSED.filter(n=>noteScope(n.ch)).map(n=>n.ch),notesCh,'setNotesCh');
 $('selftest').setAttribute('aria-checked',String(!!state.prefs.selftest));$('ntip').hidden=!state.prefs.selftest;
 if($('nq').value!==notesQ)$('nq').value=notesQ;
 drawNotesBody();
}
function hl(s){const t=esc(s),q=notesQ.trim();if(!q)return t;return t.replace(new RegExp('('+esc(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark>$1</mark>')}
let notesOtherW=false;
function drawNotesBody(){
 const q=notesQ.trim().toLowerCase(),body=$('nbody');body.classList.toggle('selftest',!!state.prefs.selftest);
 const out=NOTES_PARSED.filter(n=>noteScope(n.ch)&&(notesCh==='all'||n.ch===notesCh)).map(n=>{
  const gch=g=>{const m=String(g.title).match(/^(\d+)(?:[–-](\d+))?\s*·/);if(!m)return true;for(let c=+m[1];c<=+(m[2]||m[1]);c++)if(inScopeCh(String(c)))return true;return false};
  // Who's who and other unnumbered notes: only the cards for the chapters in scope, the rest behind a link.
  const other=/^\d/.test(n.ch)?[]:n.groups.filter(g=>!gch(g)&&secOn(g.sec)),grs=/^\d/.test(n.ch)?n.groups:n.groups.filter(gch).concat(notesOtherW?other:[]);
  const cards=grs.filter(g=>secOn(g.sec)).map(g=>{const titleHit=q&&g.title.toLowerCase().includes(q);
   const rows=g.rows.filter(([a,b])=>!q||titleHit||(a+' '+b).toLowerCase().includes(q));if(!rows.length)return '';
   return '<article class="ncard"><h3>'+hl(g.title)+'</h3><dl class="nrows">'+rows.map(([a,b])=>'<div class="nrow" onclick="this.classList.toggle(\'show\');syncReveal()"><dt>'+hl(a)+'</dt><dd>'+hl(b)+'</dd></div>').join('')+'</dl></article>'}).join('');
  const more=other.length?'<p class="nmore"><button class="link" onclick="notesOtherW=!notesOtherW;drawNotesBody()">'+(notesOtherW?'Hide the '+other.length+' from other '+unitsW:'Show '+other.length+' more from other '+unitsW)+'</button></p>':'';
  if(!cards&&!more)return '';
  if(blurtCh===n.ch&&state.prefs.blurt)return blurtHTML(n);
  return '<section class="nsec"><div class="nhead"><h2>'+(/^\d/.test(n.ch)?'<span class="pill">'+esc(UNIT)+' '+esc(n.ch)+'</span>':'')+esc(CH_NAMES[n.ch]||'')+'</h2>'+(state.prefs.blurt&&!q?'<button class="bbtn" onclick="startBlurt(\''+esc(n.ch)+'\')" title="Write what you remember, then check it against these notes">'+BLURT_IC+'Blurt this '+esc(unitW)+((state.blurt||{})[n.ch]?' <span class="bscore">'+state.blurt[n.ch].got+'/'+state.blurt[n.ch].total+'</span>':'')+'</button>':'')+(state.prefs.selftest?'<button class="link reveal" onclick="revealSec(this)">Reveal all</button>':'')+(chapters.includes(n.ch)?'<button class="link" onclick="selectSection(\'CH:'+n.ch+'\')">Quiz the entire '+unitW+' →</button>':'')+'</div><div class="ngrid">'+cards+'</div>'+more+'</section>'}).join('');
 body.innerHTML=out||'<p class="empty">No notes match “'+esc(notesQ)+'”.</p>';
}
/* v74 Blurt (Personalize, off by default): write everything you remember about a chapter with its notes hidden, then
   check. Each note row's term is a key point; it's ticked when its main words appear in what you wrote (small typos ok),
   and you can tick or untick by hand. The last score per chapter is kept (state.blurt). */
const BLURT_IC='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
// Notes toolbar button: the chapter on screen, else the one being practiced, else the first one with notes.
function blurtFromBar(){const ok=ch=>NOTES_PARSED.some(n=>n.ch===ch&&noteScope(n.ch)),cur=isX(state.section)?null:secCh(state.section);
 const ch=notesCh!=='all'&&ok(notesCh)?notesCh:cur&&ok(cur)?cur:(NOTES_PARSED.find(n=>noteScope(n.ch)&&/^\d/.test(n.ch))||{}).ch;if(!ch)return;
 if(notesCh!=='all')notesCh=ch;drawNotes();startBlurt(ch)}
let blurtCh=null,blurtText='',blurtRes=null,blurtTopic='all';
// The notes cards of a chapter that are switched on; Blurt can cover all of them or one card (a big lesson has 100+ points).
const BTIP=/^\s*(mnemonics?|memory tip|tip)\s*$/i;   // study tips in the notes are not key points to recall
const blurtGroups=ch=>{const n=NOTES_PARSED.find(x=>x.ch===ch);return n?n.groups.filter(g=>secOn(g.sec)&&g.rows.some(([a])=>String(a).trim())):[]};
function startBlurt(ch,keep){if(!keep||blurtCh!==ch)blurtTopic=blurtGroups(ch).length>4?'0':'all';blurtCh=ch;blurtText='';blurtRes=null;drawNotesBody();const n=document.querySelector('.blurt');if(n)n.scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'});setTimeout(()=>{const t=$('blurtin');if(t)t.focus()},60)}
function setBlurtTopic(v){const t=$('blurtin');if(t)blurtText=t.value;blurtTopic=v;drawNotesBody()}
function endBlurt(){if(blurtRes&&blurtCh){const gs=blurtGroups(blurtCh);state.blurt=state.blurt||{};state.blurt[blurtCh]={at:Date.now(),got:blurtRes.filter(x=>x.ok).length,total:blurtRes.length,topic:blurtTopic==='all'?'':(gs[+blurtTopic]||{}).title||''};save()}blurtCh=null;blurtRes=null;blurtText='';drawNotesBody()}
const BSTOP=new Set('the and for are was but its not has had can may via per with from that this they their than then into also only each have been were when what which whom whose your about between other these those such more most less very used uses using called after before over under like same both either'.split(' '));
function blurtWords(t){return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\$[^$]*\$/g,' ').replace(/\(.*?\)/g,' ').split(/[^a-z0-9]+/).filter(Boolean)}
function blurtLev(a,b){const p=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){let prev=p[0];p[0]=i;for(let j=1;j<=b.length;j++){const t=p[j];p[j]=Math.min(p[j]+1,p[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=t}}return p[b.length]}
// A key point counts as remembered when enough of its content words (the note's text after the dash, or the term when
// there is none) appear in what was written: half of a short point, about a third of a long one. Word forms (cough /
// coughs) and one-letter typos in longer words are accepted.
function blurtHit(term,def,said){const pick=t=>[...new Set(blurtWords(t).filter(w=>w.length>=3&&!BSTOP.has(w)&&!/^\d+$/.test(w)))];let key=pick(def||'');if(!key.length)key=pick(term);if(!key.length)return false;
 const has=w=>said.has(w)||[...said].some(x=>(w.length>=5&&x.length>=5&&(x.startsWith(w.slice(0,Math.max(5,w.length-2)))||w.startsWith(x.slice(0,Math.max(5,x.length-2)))))||(w.length>=6&&Math.abs(x.length-w.length)<=1&&x[0]===w[0]&&blurtLev(x,w)<=1));
 const n=key.filter(has).length;return key.length<=4?n>=Math.ceil(key.length/2):n>=Math.max(2,Math.ceil(key.length*.35))}
function checkBlurt(){const t=$('blurtin');blurtText=t?t.value:blurtText;if(blurtText.trim().length<3){if(t)t.focus();return}
 const said=new Set(blurtWords(blurtText)),gs=blurtGroups(blurtCh);if(!gs.length)return;
 blurtRes=[];gs.filter((g,i)=>blurtTopic==='all'||String(i)===blurtTopic).forEach(g=>g.rows.forEach(([a,b])=>{if(String(a).trim()&&!BTIP.test(a))blurtRes.push({g:g.title,a,b,ok:blurtHit(a,b,said)})}));
 drawNotesBody();const el=document.querySelector('.blurt');if(el)el.scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'})}
function blurtTick(i){if(!blurtRes||!blurtRes[i])return;blurtRes[i].ok=!blurtRes[i].ok;const open=!!document.querySelector('.blurt .bgot[open]');drawNotesBody();const d=document.querySelector('.blurt .bgot');if(d&&open)d.open=true}
function blurtHTML(n){const gs=blurtGroups(n.ch),topic=blurtTopic==='all'?'':(gs[+blurtTopic]||{}).title||'';
 const head='<div class="nhead"><h2>'+(/^\d/.test(n.ch)?'<span class="pill">'+esc(UNIT)+' '+esc(n.ch)+'</span>':'')+'Blurt</h2></div>';
 if(!blurtRes){const npts=g=>g.rows.filter(([a])=>String(a).trim()&&!BTIP.test(a)).length,tot=gs.reduce((s,g)=>s+npts(g),0);
  return '<section class="nsec blurt">'+head+
  (state.blurt&&state.blurt[n.ch]?'':'<p class="bintro">'+BLURT_IC+'<span><b>How it works:</b> without looking at your notes, write all you can remember. The reviewer then shows which key points you missed.</span></p>')+
  '<label class="bpick"><span>Topic</span><select onchange="setBlurtTopic(this.value)">'+gs.map((g,i)=>'<option value="'+i+'"'+(blurtTopic===String(i)?' selected':'')+'>'+esc(g.title)+' ('+npts(g)+')</option>').join('')+
   '<option value="all"'+(blurtTopic==='all'?' selected':'')+'>The whole '+esc(unitW)+' ('+tot+' points)</option></select></label>'+
  '<p class="btip">Write everything you remember about '+(topic?'<b>'+esc(topic)+'</b>':'this '+esc(unitW))+': terms, definitions, lists, examples. No peeking, and spelling doesn\'t matter.</p>'+
  '<textarea id="blurtin" class="blurtin" rows="8" placeholder="Start anywhere…" aria-label="What you remember" oninput="blurtText=this.value">'+esc(blurtText)+'</textarea>'+
  '<div class="bact"><button class="btn" onclick="endBlurt()">Cancel</button><button class="btn primary" onclick="checkBlurt()">Check what I remembered</button></div></section>'}
 const got=blurtRes.filter(x=>x.ok).length,tot=blurtRes.length,pct=tot?Math.round(100*got/tot):0;
 const all=blurtRes.map((x,i)=>Object.assign({i},x)),miss=all.filter(x=>!x.ok),hit=all.filter(x=>x.ok);
 const li=x=>'<li class="'+(x.ok?'ok':'no')+'"><button class="bt" onclick="blurtTick('+x.i+')" aria-pressed="'+x.ok+'" aria-label="'+(x.ok?'Untick ':'I did write ')+esc(x.a)+'">'+(x.ok?'✓':'')+'</button><div><b>'+esc(x.a)+'</b>'+(x.ok||!x.b?'':'<span>'+esc(x.b)+'</span>')+'</div></li>';
 // missed points grouped under their notes card (the card name once, not on every row)
 const byG=[];miss.forEach(x=>{let g=byG.find(y=>y.t===x.g);if(!g)byG.push(g={t:x.g,xs:[]});g.xs.push(x)});
 return '<section class="nsec blurt">'+head+(topic?'<p class="btopic">'+esc(topic)+'</p>':'')+'<p class="bsum"><b class="num">'+got+' of '+tot+'</b> key points ('+pct+'%). '+(pct>=80?'Excellent recall.':pct>=50?'A solid start: read the ones you missed, then blurt again tomorrow.':'Read the missed ones below, then try again later. Each try makes them stick.')+' Tap a box to tick one the checker missed.</p>'+
  (miss.length?'<h3 class="bh">Missed ('+miss.length+')</h3>'+byG.map(g=>(byG.length>1||!topic?'<h4 class="bg">'+esc(g.t)+'</h4>':'')+'<ul class="blist">'+g.xs.map(li).join('')+'</ul>').join(''):'')+
  (hit.length?'<details class="bgot"><summary>Remembered ('+hit.length+')</summary><ul class="blist">'+hit.map(li).join('')+'</ul></details>':'')+
  '<details class="bmine"><summary>What you wrote</summary><p>'+esc(blurtText)+'</p></details>'+
  '<div class="bact"><button class="btn" onclick="startBlurt(\''+esc(n.ch)+'\',true)">Try again</button><button class="btn primary" onclick="endBlurt()">Done</button></div></section>'}
function toggleSelfTest(){state.prefs.selftest=!state.prefs.selftest;save();drawNotes()}
function revealSec(btn){const rows=[...btn.closest('.nsec').querySelectorAll('.nrow')],all=rows.every(r=>r.classList.contains('show'));rows.forEach(r=>r.classList.toggle('show',!all));syncReveal()}
function syncReveal(){document.querySelectorAll('#nbody .nsec').forEach(sec=>{const b=sec.querySelector('.reveal');if(b)b.textContent=[...sec.querySelectorAll('.nrow')].every(r=>r.classList.contains('show'))?'Hide all':'Reveal all'})}
// Self-test: Space (or N) reveals the next hidden answer.
function notesKey(e){if(!state.prefs.selftest||e.target.tagName==='BUTTON')return;if(e.key!==' '&&e.key!=='n'&&e.key!=='N')return;e.preventDefault();
 const r=document.querySelector('#nbody .nrow:not(.show)');if(r){r.classList.add('show');r.scrollIntoView({block:'nearest',behavior:reduceMotion?'auto':'smooth'});syncReveal()}}

/* ---------- matching type ---------- */
let matchCh='all',M=null;
function matchPool(){return MSETS.filter(m=>inScopeCh(m.ch)&&(matchCh==='all'||m.ch===matchCh))}
// One matching set in progress. The Matching page keeps it in M; a set mixed into practice lives in state.pmatch.
function makeMatch(i){const m=MSETS[i],rand=state.prefs.order==='random',o=m.options.map((_,j)=>j),it=m.items.map((_,j)=>j);
 // Random order reshuffles both the items and which letter each choice gets.
 return {i,opt:rand?shuffle(o,rnd()):o,items:rand?shuffle(it,rnd()):it,ans:{},checked:false,cur:0}}
function newMatch(i){M=makeMatch(i)}
// Prefer sets not tried yet, and never the one just shown.
function chooseSet(pool,lastI){const others=pool.filter(m=>m.i!==lastI),src=others.length?others:pool;
 const untried=src.filter(m=>state.match.best[m.title]==null),from=untried.length?untried:src;
 return from[Math.floor(Math.random()*from.length)]}
function pickMatch(){const pool=matchPool();if(!pool.length){M=null;return}newMatch(chooseSet(pool,M?.i).i)}
const getM=ctx=>ctx==='p'?state.pmatch:M;
function redrawMatch(ctx){if(ctx==='p')$('card').innerHTML=cardHTML();else drawMatchCard()}
function setMatchCh(k){matchCh=k;M=null;MX=null;drawMatch()}
let drillTab='match';
function drawMatch(){
 const tabs=[];if(MSETS.length)tabs.push(['match','Matching sets']);if(MIXUP.length)tabs.push(['mix','Don\'t mix up']);
 if(!tabs.some(t=>t[0]===drillTab))drillTab=tabs[0][0];const mix=drillTab==='mix';
 $('dtabs').hidden=tabs.length<2;
 $('dtabs').innerHTML=tabs.map(([k,t])=>'<button role="tab" aria-selected="'+(k===drillTab)+'" class="'+(k===drillTab?'on':'')+'" onclick="setDrillTab(\''+k+'\')">'+t+'</button>').join('');
 $('dtitle').textContent=mix?'Don\'t mix up':'Matching';document.title=(mix?'Don\'t mix up':'Matching')+' · '+CONFIG.title;
 const chs=[...new Set((mix?MIXUP:MSETS).filter(m=>inScopeCh(m.ch)).map(m=>m.ch))];if(matchCh!=='all'&&!chs.includes(matchCh))matchCh='all';
 $('mchips').innerHTML=chChips(chs,matchCh,'setMatchCh');
 $('mcard').hidden=mix;$('msetsPanel').hidden=mix;$('xcard').hidden=!mix;
 if(mix){if(!MX||(matchCh!=='all'&&MIXUP[MX.g].ch!==matchCh))newMix();drawMix();return}
 if(!M||(matchCh!=='all'&&MSETS[M.i].ch!==matchCh))pickMatch();
 drawMatchCard();drawMatchSets();
}
function setDrillTab(k){drillTab=k;drawMatch()}
// ctx 'm' = Matching page, 'p' = a set mixed into practice (same card, different buttons at the bottom).
function matchCardHTML(X,ctx){
 const m=MSETS[X.i],L=X.opt.map((o,k)=>({k,letter:MLETTERS[k],label:m.options[o]})),n=X.items.length,answered=Object.keys(X.ans).length,best=state.match.best[m.title];
 let hits=0;
 const rows=X.items.map((it,r)=>{const [text,correct]=m.items[it],pick=X.ans[r],rightK=X.opt.indexOf(correct),ok=X.checked&&pick===rightK;if(ok)hits++;
  return '<div class="mrow '+(X.checked?(ok?'ok':'bad'):(r===(X.cur??0)?'cur':''))+'"><span class="mn">'+(r+1)+'</span><span class="mt">'+esc(text)+(X.checked&&!ok?'<span class="mfix">Answer: '+MLETTERS[rightK]+' · '+esc(m.options[correct])+'</span>':'')+'</span>'+
   '<span class="seg mseg" role="radiogroup" aria-label="Answer for item '+(r+1)+'">'+L.map(x=>'<button role="radio" aria-checked="'+(pick===x.k)+'" class="'+(pick===x.k?'on':'')+(X.checked&&!ok&&x.k===rightK?' ans':'')+'" '+(X.checked?'disabled':'')+' onclick="matchPick(\''+ctx+'\','+r+','+x.k+')">'+x.letter+'</button>').join('')+'</span></div>'}).join('');
 const p=ctx==='p';
 return '<div class="qhead"><span class="kind">Matching type · '+esc(UNIT)+' '+esc(m.ch)+'</span><span>'+(best!=null?'Best '+best+'/'+n:'New set')+'</span></div>'+
  '<p class="prompt">'+esc(m.title)+'</p><p class="mtip">Match each item with A–'+MLETTERS[L.length-1]+'. A letter can be used more than once.<span class="khint"> Keys: ↑ ↓ or 1–'+n+' pick an item, A–'+MLETTERS[L.length-1]+' answers it, Enter checks.</span></p>'+
  '<div class="mkeys">'+L.map(x=>'<div class="mkey"><span class="lt">'+x.letter+'</span>'+esc(x.label)+'</div>').join('')+'</div>'+
  '<div class="mrows">'+rows+'</div>'+
  (X.checked?'<div class="fb '+(hits===n?'good':'bad')+'" style="margin-top:18px"><h3>'+FBICON[hits===n?'good':'bad']+hits+' of '+n+' correct</h3><p>'+(hits===n?(p?'Clean sweep.':'Clean sweep. Try another set.'):'The right answer is shown under each item you missed.')+'</p></div>':'')+
  '<div class="actions"><span class="aux" style="color:var(--mute)">'+(X.checked?'':answered+' of '+n+' answered')+(p&&!X.checked?' · <button class="link" onclick="skipMix()">Skip set</button>':'')+'</span>'+
  (X.checked?(p?'<button class="btn primary" id="go" onclick="endMix()">Continue practicing <kbd>Enter</kbd></button>'
     :'<button class="btn" onclick="retryMatch()">Try again</button><button class="btn primary" onclick="pickMatch();drawMatchCard();drawMatchSets()">Next set</button>')
   :'<button class="btn primary" '+(p?'id="go" ':'')+'onclick="checkMatch(\''+ctx+'\')" '+(answered<n?'disabled':'')+'>Check answers'+(p?' <kbd>Enter</kbd>':'')+'</button>')+'</div>';
}
function drawMatchCard(){const card=$('mcard');card.innerHTML=M?matchCardHTML(M,'m'):'<p class="empty">No matching sets here yet.</p>'}
function matchPick(ctx,r,k){const X=getM(ctx);if(!X||X.checked)return;X.ans[r]=k;X.cur=nextOpen(X,r);if(ctx==='p')save();redrawMatch(ctx)}
function checkMatch(ctx){const X=getM(ctx);if(!X||X.checked)return;const m=MSETS[X.i],n=X.items.length;if(Object.keys(X.ans).length<n)return;
 const hits=X.items.filter((it,r)=>X.ans[r]===X.opt.indexOf(m.items[it][1])).length;
 X.checked=true;state.match.sets++;state.match.right+=hits;state.match.total+=n;state.match.best[m.title]=Math.max(hits,state.match.best[m.title]??0);save();
 if(ctx==='p')redrawMatch('p');else{drawMatchCard();drawMatchSets()}}
/* Mixed into practice: after every N answered questions, the next card is a matching set from the same scope. */
function mixPool(){const s=state.section;return isX(s)?MSETS.filter(m=>inScopeCh(m.ch)):MSETS.filter(m=>m.ch===secCh(s))}
function maybeMix(){const every=state.prefs.mix;if(!every||(state.sinceMix||0)<every)return;const pool=mixPool();if(!pool.length)return;
 state.pmatch=makeMatch(chooseSet(pool,state.lastMix).i);state.lastMix=state.pmatch.i;state.sinceMix=0}
function endMix(){state.pmatch=null;save();draw();scrollToCard()}
function skipMix(){endMix()}

/* ---------- Don't mix up: one clue, two look-alikes, pick the right one ---------- */
let MX=null;const mixRun={right:0,total:0,streak:0};
function dmPool(){return MIXUP.filter(g=>secOn(g.sec)&&inScopeCh(g.ch)&&(matchCh==='all'||g.ch===matchCh))}
function newMix(){const pool=dmPool();if(!pool.length){MX=null;return}
 const others=pool.filter(g=>!MX||g.i!==MX.g),src=others.length?others:pool,g=src[Math.floor(Math.random()*src.length)];
 const ti=Math.floor(Math.random()*g.members.length);let oi=Math.floor(Math.random()*(g.members.length-1));if(oi>=ti)oi++;
 const cues=g.members[ti].cues;MX={g:g.i,t:ti,opts:Math.random()<.5?[ti,oi]:[oi,ti],cue:cues[Math.floor(Math.random()*cues.length)],pick:null}}
function drawMix(){const card=$('xcard');if(!MX){card.innerHTML='<p class="empty">No look-alikes here yet.</p>';return}
 const g=MIXUP[MX.g],done=MX.pick!=null,ok=done&&MX.pick===MX.t;
 card.innerHTML='<div class="qhead"><span class="kind">Don\'t mix up · '+esc(UNIT)+' '+esc(g.ch)+'</span><span class="num">'+(mixRun.total?mixRun.right+' of '+mixRun.total+' right'+(mixRun.streak>1?' · streak '+mixRun.streak:''):'Which one is it?')+'</span></div>'+
  '<p class="prompt mixcue">'+stemHTML(MX.cue)+'</p>'+
  '<div class="mixopts">'+MX.opts.map((o,k)=>'<button class="mixopt'+(done?(o===MX.t?' right':o===MX.pick?' wrong':''):'')+'" '+(done?'disabled':'')+' onclick="mixPick('+o+')"><span class="key">'+(k+1)+'</span>'+esc(g.members[o].name)+'</button>').join('')+'</div>'+
  (done?'<div class="fb '+(ok?'good':'bad')+'"><h3>'+FBICON[ok?'good':'bad']+(ok?'Correct':'It\'s '+esc(g.members[MX.t].name))+'</h3><p>'+MX.opts.map(o=>'<b>'+esc(g.members[o].name)+':</b> '+esc(g.members[o].cues.join('; '))).join('<br>')+'</p></div>':'')+
  mixGoHTML()+'<div class="actions"><span class="aux"><span class="khint">Keys: 1 or ← picks the left, 2 or → the right'+(done?', Enter goes on':'')+'</span></span>'+
  (done?'<button class="btn primary" onclick="nextMix()">Next <kbd>Enter</kbd></button>':'')+'</div>'}
// A right answer moves on by itself after a moment; a wrong one waits so you can read both clues.
function mixPick(o){if(!MX||MX.pick!=null)return;MX.pick=o;const ok=o===MX.t;mixRun.total++;if(ok){mixRun.right++;mixRun.streak++}else mixRun.streak=0;
 state.mixBest=Math.max(state.mixBest||0,mixRun.streak);save();drawMix();
 if(ok){const cur=MX;setTimeout(()=>{if(MX===cur&&page==='match'&&drillTab==='mix')nextMix()},1200)}}
function nextMix(){newMix();drawMix()}
/* ---------- Mix look-alikes: a practice round that alternates between the members of each Don't mix up group ---------- */
// Questions that name a member of a look-alike group (in the stem or the answer), two per member, taken in turns so the look-alikes land next to each other.
function mixIds(n){const norm=x=>String(x||'').toLowerCase(),pool=inSection('ALL').filter(c=>!c.case&&c.type!=='id'&&c.type!=='self'),
 txt=new Map(pool.map(c=>[c.id,norm([c.q,c.a,c.term,c.definition].join(' '))])),used=new Set(),out=[],
 has=(c,name)=>{const k=norm(name).trim();return k.length>=4&&txt.get(c.id).includes(k)};
 for(const g of shuffle(dmPool(),rnd())){if(out.length>=n)break;
  const lists=g.members.map(m=>shuffle(pool.filter(c=>!used.has(c.id)&&has(c,m.name)),rnd()).slice(0,2));
  if(lists.filter(l=>l.length).length<2)continue;
  for(let k=0;k<2;k++)for(const l of lists){const c=l[k];if(c&&!used.has(c.id)){used.add(c.id);out.push(c.id)}}}
 return out.slice(0,n)}
function mixGoHTML(){const k=mixIds(20).length;return k<4?'':'<div class="mixgo"><p>Want questions on these? A short round that switches between the look-alikes, so you have to tell them apart. It does not change your mastery.</p><button class="btn" onclick="mixStart()">Practice mixed look-alikes ('+k+')</button></div>'}
function mixStart(){const ids=mixIds(20);if(ids.length<4)return;freeRound(ids)}
// a short round of these questions, in this order; it doesn't change mastery
function freeRound(ids){
 state.section='ALL';state.pmatch=null;state.pass={sec:'ALL',done:[],miss:[],free:1,ids,order:ids.slice(),right:0};state.complete=state.complete.filter(x=>x!=='ALL');freeOpen=false;
 state.active=null;state.feedback=null;state.selected=null;view=null;page='study';state.page='study';save();draw();window.scrollTo(0,0)}
function mixKey(e){if(!MX)return false;const k=e.key;
 if(MX.pick==null){if(k==='1'||k==='ArrowLeft'){mixPick(MX.opts[0]);return true}if(k==='2'||k==='ArrowRight'){mixPick(MX.opts[1]);return true}return false}
 if((k==='Enter'||k===' ')&&e.target.tagName!=='BUTTON'){nextMix();return true}return false}

/* ---------- mock exam: no hints or answers until the end ---------- */
const EX_COUNTS=[20,30,50];let exTick=null;
const swHTML=(on,fn,label)=>'<button class="tgl" role="switch" aria-checked="'+on+'" aria-label="'+esc(label)+'" onclick="'+fn+'"><span class="sw"></span></button>';
// One exam question, frozen when the exam starts. ident = typed answer instead of choices.
function exQ(q,vsa){const o={cid:q.cid,kind:q.kind,stem:q.stem,why:q.why,choices:q.choices.map(({letter,label,correct})=>({letter,label,correct}))};if(vsa||isIdent(byId[q.cid])||isWr(byId[q.cid]))o.ident=1;if(isWr(byId[q.cid]))o.wr=1;if(isSelf(byId[q.cid])){o.self=1;delete o.ident}if(vsa)o.vsa=1;return o}
// Can this item be asked as VSA (type the answer)? Short single answers only, and the stem must not lean on the choices.
function vsaOK(c){if(isSelf(c))return false;if(isIdent(c)||(c&&c.num!=null))return true;if(!c.q||!c.a)return false;const a=c.a;if(a.length>32||a.split(/\s+/).length>4||/[,;]| and | or |\d.*\d/.test(a))return false;
 if(isMol(a)||/\bNOT\b|which of these|which (is|are) (correct|true|an? |the )|which statement|which pair|following/i.test(c.q))return false;return true}
function exOK(q,a){if(q.self)return !!((state.exam||{}).marks||{})[q.cid];if(a==null||a==='')return false;if(q.wr){const c=byId[q.cid];return !!c&&wrCheck(a,c.wr).ok}if(q.ident){const t=(q.choices.find(x=>x.correct)||{}).label||'';return ansOK(a,byId[q.cid],t)}return q.choices.some(x=>x.correct&&x.letter===a)}
const PER_ITEM=CONFIG.examMinutesPerItem||1;
const exMinutes=(st,n)=>typeof st.timer==='number'?st.timer:st.timer?Math.round(n*PER_ITEM):0;
const EX_PRESETS=CONFIG.examPresets||[{label:'Paperless · 30 items, split per '+unitW,count:30,split:true,format:'paperless',vsa:0}];
function exSetup(){const st=state.exSetup||(state.exSetup={count:30,chs:chapters.slice(),timer:true});if(st.vsa==null)st.vsa=0;st.chs=st.chs.filter(c=>chapters.includes(c));if(!st.chs.length)st.chs=chapters.slice();return st}
function exPoolOf(items,st){const qs=st.quota&&st.quota.flatMap(q=>q[0]);return items.filter(c=>st.chs.includes(chOf(c.section))&&(!st.secs||st.secs.includes(c.section))&&(!qs||qs.includes(c.section)))}
function exItems(){const b=bankObj();if(b.user)return BANK;const have=new Set(BANK.map(c=>c.id));
 return BANK.concat(b.items.filter(c=>!have.has(c.id)&&!c.retired&&!c.xo&&optExam(c.section)&&inScope(c.section)&&(state.prefs.extras||!c.extra)))}
function exPool(){return exPoolOf(exItems(),exSetup())}
function exLeft(){const ex=state.exam;return ex.limit?ex.start+ex.limit-Date.now():Infinity}
function clock(ms){const t=Math.max(0,Math.ceil(ms/1000));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')}
function drawExam(){const ex=state.exam,C=CHAL||ex&&ex.chal,run=!CHAL&&!!ex&&!ex.done;if(typeof drawTabbar==='function')drawTabbar();$('examView').classList.toggle('running',run);if(run)requestAnimationFrame(()=>{const t=$('examView').querySelector('.top');if(t)$('examView').style.setProperty('--exhead',t.offsetHeight+'px')});$('main').classList.toggle('wide',!CHAL&&!!ex&&!!ex.sheet&&!ex.done);document.title=(C?'Class challenge':'Mock exam')+' · '+CONFIG.title;$('excrumb').textContent=C?'Class challenge':'Mock exam';
 $('exChartBtn').hidden=!chartsOn();clearInterval(exTick);$('extimer').hidden=true;
 if(CHAL)drawChalIntro();else if(ex&&!ex.done)drawExamRun();else if(ex&&ex.done)drawExamResult();else drawExamSetup()}
// Matching type: exam-only sets (CONFIG.examMatch) for a unit, else its matching drills with at most 5 options (A-E).
function exMatchSets(ch){const own=(CONFIG.examMatch||[]).filter(m=>String(m[0])===ch).map(m=>({ch,title:m[1],options:m[2],items:m[3]}));
 return own.length?own:MSETS.filter(m=>m.ch===ch&&m.options.length<=5)}
const matchAvail=()=>exSetup().chs.reduce((t,ch)=>t+exMatchSets(ch).reduce((u,m)=>u+m.items.length,0),0);
function setExMatch(v){const st=exSetup();st.match=Math.max(0,Math.min(Math.min(st.count,matchAvail()),Math.round(+v)||0));save();drawExam()}
// m items split equally over the units that have sets; each group is one set, up to 10 items, options kept in order A-E.
function buildMatch(m){const st=exSetup(),chs=st.chs.filter(ch=>exMatchSets(ch).length),have={},out={};if(!m||!chs.length)return [];
 chs.forEach(ch=>{have[ch]=exMatchSets(ch).reduce((u,s)=>u+s.items.length,0);out[ch]=0});let left=m,open=chs.slice();
 while(left>0&&open.length){const each=Math.floor(left/open.length),extra=left%open.length;let used=0;open.forEach((ch,i)=>{const t=Math.min(each+(i<extra?1:0),have[ch]-out[ch]);out[ch]+=t;used+=t});left-=used;open=open.filter(ch=>out[ch]<have[ch]);if(!used)break}
 const qs=[];let g=0;chs.forEach(ch=>{let need=out[ch];const sets=shuffle(exMatchSets(ch),rnd());
  // groups of about 5-10: spread the need over as few sets as possible
  const nb=Math.max(1,Math.ceil(need/10));let si=0;for(let b=0;need>0&&si<sets.length;b++,si++){const s=sets[si],want=Math.ceil(need/Math.max(1,nb-b)),take=Math.min(s.items.length,need,Math.max(want,1));
   const its=shuffle(s.items.map((x,k)=>[x,k]),rnd()).slice(0,take);g++;need-=take;
   its.forEach(([[clue,ans],k])=>qs.push({cid:'mx:'+ch+':'+s.title+':'+k,mt:1,grp:g,gt:s.title,gopts:s.options,ch,kind:'match',stem:clue,why:'',
    choices:s.options.map((o,i)=>({letter:LETTERS[i],label:o,correct:i===ans}))}))}});
 return qs}
function mgrpHTML(q){return '<section class="card pq mgrp"><div class="pqh"><span class="kind">Matching type · '+esc(q.gt)+'</span></div><p class="mgi">Match each item below with A–E. An option may be used more than once or not at all.</p><ol class="pch">'+q.gopts.map((o,i)=>'<li><b>'+LETTERS[i]+'.</b>'+esc(o)+'</li>').join('')+'</ol></section>'}
const exKind=q=>q.mt?'Matching · '+esc(q.gt):esc(byId[q.cid].section)+' · '+(q.vsa?'VSA · identification':kindName(q.kind));
// Difficulty row: shown when the course has exam-style wording (xq) or look-alike choices (dh).
const hasLevels=()=>BANK.some(c=>c.xq||c.dh);
function setExLevel(v){exSetup().level=v;save();drawExam()}
function drawExamSetup(){const st=exSetup(),pool=exPool(),n=Math.min(st.count,pool.length);$('extitle').textContent='Mock exam';
 const row=(t,d,ctl)=>'<div class="prow"><div class="pl"><b>'+t+'</b><span>'+d+'</span></div><div class="ctl">'+ctl+'</div></div>',srow=(t,d,ctl)=>row(t,d,ctl).replace('class="prow"','class="prow stack"');
 const counts=EX_COUNTS.filter(c=>c<pool.length).map(c=>[c,String(c)]).concat([[9999,'All '+pool.length],['c','Custom']]);
 const curCount=st.customCount?'c':st.count>=pool.length?9999:EX_COUNTS.includes(st.count)?st.count:'c',per=exSplit(n-Math.min(st.match||0,matchAvail(),n));
 const vsaMax=Math.min(n,pool.filter(vsaOK).length),preset=exPresetIdx(st);
 const mAv=matchAvail(),mN=Math.min(st.match||0,mAv,n);
 const past=(state.exams||[]).slice(-5).reverse();
 $('exbody').innerHTML='<p class="lede">A practice run with no hints and no answers until the end. Afterwards you get your score by '+unitW+' and can review every mistake. Wrong answers are added to your Missed '+ITEMS+'; questions you skip are not counted against you.</p>'+
  '<section class="panel" style="margin-top:20px"><h2>Set up</h2>'+
  (EX_PRESETS.length?srow('Presets','Set up like a real test in one tap.','<div class="fchips">'+EX_PRESETS.map((p,i)=>'<button class="fchip '+(i===preset?'on':'')+'" aria-pressed="'+(i===preset)+'" onclick="exPreset('+i+')">'+esc(p.label)+'</button>').join('')+'</div>'):'')+
  row('Questions',pool.length+' '+ITEMS+' in the '+unitsW+' you picked, drawn at random.',segHTML('setExCount',counts,curCount,'Number of questions')+(curCount==='c'?'<input class="txt exmin" type="number" min="1" max="'+pool.length+'" value="'+n+'" onchange="setExCustom(this.value)" aria-label="Number of questions">':''))+
  (st.chs.length>1?row('Split',st.split?'Equal per '+unitW+', grouped like the real test: '+per.map(([ch,k])=>k+' from '+esc(chLabel(ch))).join(', ')+'.':'Drawn at random from all the '+unitsW+' you picked.',segHTML('setExSplit',[[false,'Random'],[true,'Equal per '+unitW]],!!st.split,'Split')):'')+
  row(UNIT+'s','Tap to include or leave out.','<div class="fchips">'+chapters.map(ch=>'<button class="fchip '+(st.chs.includes(ch)?'on':'')+'" aria-pressed="'+st.chs.includes(ch)+'" onclick="toggleExCh(\''+ch+'\')" title="'+esc(CH_NAMES[ch])+'">'+esc(chLabel(ch))+'</button>').join('')+'</div>')+
  (hasLevels()?row('Difficulty',st.level==='easy'?'Easier: the same questions and choices as in practice.':'Harder, like the real test: '+(pool.some(c=>c.xq)?'longer questions with more to read (cases and descriptions instead of just the term)'+(pool.some(c=>c.dh)?', and ':''):'')+(pool.some(c=>c.dh)?'look-alike choices that differ in one detail':'')+'. Same answers.',segHTML('setExLevel',[['hard','Harder'],['easy','Easier']],st.level==='easy'?'easy':'hard','Difficulty')):'')+
  row('Format',st.format==='sheet'?'Answer sheet: the whole test paper on one page and a separate sheet where you shade A–D, like the real exam.':st.format==='paperless'?'Paperless: like the digital exam. One question at a time, no topic labels, and no results until you submit.':'One question at a time.',segHTML('setExFormat',[['one','One at a time'],['sheet','Answer sheet'],['paperless','Paperless']],st.format||'one','Format'))+
  (mAv?row('Matching',(st.format==='paperless'?'Paperless exams have no matching type, so this starts at 0. Set a number only if you want it anyway.':'Matching type after the multiple choice: groups of items that share options A–E (each can be used more than once), answered on the same sheet.')+(mN?' This exam: <strong>'+(n-mN)+' multiple choice + '+mN+' matching</strong>.':''),'<input class="txt exmin" type="number" min="0" max="'+Math.min(mAv,n)+'" value="'+mN+'" onchange="setExMatch(this.value)" aria-label="Number of matching items"><span>of '+n+'</span>'+(mN?'<button class="btn sm" onclick="setExMatch(0)">Set to 0</button>':'')):'')+
  row('VSA','Identification items at the end: you type the answer, no choices.'+(vsaMax<n?' Up to '+vsaMax+' of these '+ITEMS+' work as VSA.':''),'<input class="txt exmin" type="number" min="0" max="'+vsaMax+'" value="'+Math.min(st.vsa||0,vsaMax)+'" onchange="setExVsa(this.value)" aria-label="Number of VSA items"><span>of '+n+'</span>'+(Math.min(st.vsa||0,vsaMax)?'<button class="btn sm" onclick="setExVsa(0)">Set to 0</button>':''))+
  row('Timer',typeof st.timer==='number'?st.timer+' minutes in total. The exam ends when time runs out.':st.timer?Math.round(n*PER_ITEM)+' minutes, '+(PER_ITEM===1?'one':PER_ITEM)+' per question. The exam ends when time runs out.':'No time limit.',
   segHTML('setExTimer',[[false,'Off'],[true,PER_ITEM+' min each'],['c','Custom']],typeof st.timer==='number'?'c':!!st.timer,'Timer')+(typeof st.timer==='number'?'<input class="txt exmin" type="number" min="1" max="300" value="'+st.timer+'" onchange="setExMin(this.value)" aria-label="Minutes"><span>min</span>':''))+
  '<div class="exstart"><button class="btn" onclick="toggleChal()" aria-expanded="'+chalOpen+'" title="A link that gives your group chat the same questions">'+LINK_SM+'Class challenge</button><button class="btn primary" onclick="startExam()" '+(n?'':'disabled')+'>Start exam · '+n+' '+ITEMS+'</button></div>'+(chalOpen?chalBoxHTML():'')+'</section>'+
  (past.length?'<section class="panel" style="margin-top:12px"><h2>Recent exams</h2><ul class="exlist">'+past.map(r=>'<li><b class="num">'+Math.round(100*r.right/r.total)+'%</b><span>'+(100*r.right/r.total>=GRADING.pass?'<b class="gpass">Passed</b>':'<b class="gfail">Not passed</b>')+' · grade '+fmtG(transmute(r.right,r.total))+' · '+r.right+' of '+r.total+' · '+esc(r.date)+' · '+esc(r.time)+(r.chal?' · class challenge':'')+(r.easy?' · easier':'')+'</span></li>').join('')+'</ul></section>':'')}
function setExCount(v){const st=exSetup();if(v==='c'){st.customCount=true;st.count=Math.min(st.count,exPool().length)}else{st.customCount=false;st.count=v}exClampMatch(st);save();drawExam()}
function setExCustom(v){const st=exSetup();st.customCount=true;st.count=Math.max(1,Math.min(exPool().length,Math.round(+v)||1));exClampMatch(st);save();drawExam()}
// Changing the number of questions keeps matching at most half the exam, so a smaller exam is never all matching.
function exClampMatch(st){st.match=Math.min(st.match||0,Math.floor(Math.min(st.count,exPool().length)/2))}
function setExSplit(v){exSetup().split=v;save();drawExam()}
function setExVsa(v){const st=exSetup();st.vsa=Math.max(0,Math.min(Math.min(st.count,exPool().length),Math.round(+v)||0));save();drawExam()}
function exPreset(i){const p=EX_PRESETS[i],st=exSetup();if(!p.keepChs)st.chs=chapters.slice();st.secs=p.secs||null;st.quota=p.quota||null;st.cases=p.cases||null;st.count=p.count;st.customCount=!EX_COUNTS.includes(p.count);st.split=!!p.split;st.format=p.format||'one';st.vsa=p.vsa||0;st.match=p.match||0;if(p.chs)st.chs=chapters.filter(c=>p.chs.includes(c));if(p.timer!=null)st.timer=p.timer;save();drawExam()}
// Equal split: n divided across the chosen units (the first ones take the remainder); a unit with too few items passes the rest on.
function exSplit(n){const st=exSetup(),chs=st.chs.filter(ch=>BANK.some(c=>chOf(c.section)===ch)),have={};chs.forEach(ch=>have[ch]=BANK.filter(c=>chOf(c.section)===ch).length);
 const out={};chs.forEach(ch=>out[ch]=0);let left=n,open=chs.slice();while(left>0&&open.length){const each=Math.floor(left/open.length),extra=left%open.length;let used=0;
  open.forEach((ch,i)=>{const want=each+(i<extra?1:0),take=Math.min(want,have[ch]-out[ch]);out[ch]+=take;used+=take});left-=used;open=open.filter(ch=>out[ch]<have[ch]);if(!used)break}
 return chs.map(ch=>[ch,out[ch]]).filter(x=>x[1])}
function toggleExCh(ch){const st=exSetup(),on=st.chs.includes(ch);st.secs=null;st.quota=null;st.cases=null;if(on&&st.chs.length===1)return;st.chs=on?st.chs.filter(c=>c!==ch):chapters.filter(c=>c===ch||st.chs.includes(c));save();drawExam()}
function setExTimer(v){const st=exSetup(),n=Math.min(st.count,exPool().length);st.timer=v==='c'?(typeof st.timer==='number'?st.timer:Math.max(1,n)):v;save();drawExam()}
// Paperless exams have no matching part: switching to it clears matching (it can still be set by hand).
function setExFormat(v){const st=exSetup();st.format=v;if(v==='paperless')st.match=0;save();drawExam()}
function setExMin(v){exSetup().timer=Math.max(1,Math.min(300,Math.round(+v)||1));save();drawExam()}
// Some question types (e.g. BP categories) fill a lot of the bank but come out only once or twice in the real test:
// CONFIG.examCaps {group: max} limits items with cap:group per mock exam; the freed slots go to other items of the same unit.
// CONFIG.examCapsFormat {format: {group: max}} overrides it for one format (v80: no true/false in Pharma's paperless evals).
function capPick(picked,pool){const caps=Object.assign({},CONFIG.examCaps,(CONFIG.examCapsFormat||{})[exSetup().format||'one']);if(!Object.keys(caps).length)return picked;const capped=c=>c.cap&&caps[c.cap]!=null,cnt={},out=[],drop=[];
 for(const c of picked){if(capped(c)&&(cnt[c.cap]=(cnt[c.cap]||0)+1)>caps[c.cap])drop.push(c);else out.push(c)}
 const spare=shuffle(pool.filter(c=>!picked.includes(c)&&!capped(c)),rnd());
 drop.forEach(d=>{let i=spare.findIndex(c=>chOf(c.section)===chOf(d.section));if(i<0)i=0;if(spare.length)out.push(spare.splice(i,1)[0])});return out}
// which preset the setup matches (-1: none)
function exPresetIdx(st){return EX_PRESETS.findIndex(p=>p.count===st.count&&!!p.split===!!st.split&&(p.format||'one')===(st.format||'one')&&(p.vsa||0)===(st.vsa||0)&&(p.match||0)===(st.match||0)&&(p.secs||[]).join()===(st.secs||[]).join()&&JSON.stringify(p.quota||null)===JSON.stringify(st.quota||null)&&JSON.stringify(p.cases||null)===JSON.stringify(st.cases||null)&&(p.keepChs||(p.chs?st.chs.join()===chapters.filter(c=>p.chs.includes(c)).join():st.chs.length===chapters.length)))}
// the items of a mock exam: matching sets, the picked items, and the VSA ones (typed, at the end). Class challenges reuse it with a seeded RNG.
function exPick(st,pool,n,xo){
 // CONFIG.vsaOwn (v83): VSA slots are filled only from identification items (written to be typed; xo = exam-only ones), which never take a choice slot
 const own=!!CONFIG.vsaOwn,ids=own?(xo&&xo.length?xo:pool).filter(isIdent):[];if(own)pool=pool.filter(c=>!isIdent(c));
 const mq=buildMatch(Math.min(st.match||0,matchAvail(),n)),nm=n-mq.length;
 let picked=st.split&&st.chs.length>1?exSplit(nm).flatMap(([ch,k])=>shuffle(pool.filter(c=>chOf(c.section)===ch),rnd()).slice(0,k)):shuffle(pool,rnd()).slice(0,nm);
 if(st.cases){const used=new Set();picked=st.cases.flatMap(([ss,k])=>{const ids=shuffle([...new Set(pool.filter(c=>c.case&&ss.includes(c.section)).map(c=>c.case))],rnd()).filter(id=>!used.has(id)).slice(0,k);ids.forEach(i=>used.add(i));
  return ids.flatMap(id=>pool.filter(c=>c.case===id).sort((a,b)=>(a.part||0)-(b.part||0)))})}
 else if(st.quota)picked=st.quota.flatMap(([ss,k])=>shuffle(pool.filter(c=>ss.includes(c.section)),rnd()).slice(0,k)).slice(0,nm);
 picked=capPick(picked,pool);
 if(own){const want=Math.min(st.vsa||0,ids.length,nm),vs=shuffle(ids,rnd()).slice(0,want);return {mq,picked:picked.slice(0,nm-vs.length),vs}}
 // VSA: take them from across the picked units and move them to the end, like the real test
 const want=Math.min(st.vsa||0,picked.length),vs=[];if(want){const ok=picked.filter(vsaOK),byU={};ok.forEach(c=>(byU[chOf(c.section)]=byU[chOf(c.section)]||[]).push(c));
  const us=Object.keys(byU);let k=0;while(vs.length<want&&us.some(u=>byU[u].length)){const u=us[k++%us.length];if(byU[u].length)vs.push(byU[u].splice(rnd()%byU[u].length,1)[0])}
  if(vs.length<want){const more=shuffle(pool.filter(c=>vsaOK(c)&&!picked.includes(c)),rnd()).slice(0,want-vs.length);vs.push(...more);picked=picked.filter(c=>!vs.includes(c)).slice(0,nm-vs.length)}else picked=picked.filter(c=>!vs.includes(c))}
 return {mq,picked,vs}}
function startExam(){const st=exSetup(),pool=exPool(),n=Math.min(st.count,pool.length);if(!n)return;const {mq,picked,vs}=exPick(st,pool,n,exPoolOf(bankObj().items.filter(c=>c.xo&&!c.retired),st));
 const easy=st.level==='easy'&&hasLevels();HARD=!easy;LONG=!easy;INEX=true;
 const qsBuilt=picked.map(c=>exQ(makeQuestion(c))).concat(mq,vs.map(c=>exQ(makeQuestion(c),true)));HARD=LONG=INEX=false;
 state.exam={qs:qsBuilt,easy:easy?1:0,
  ans:{},i:0,start:Date.now(),limit:exMinutes(st,n)*60000,done:false,sheet:st.format==='sheet'||undefined,paperless:st.format==='paperless'||undefined};
 save();drawExam();window.scrollTo(0,0)}
function drawExamRun(){const ex=state.exam,q=ex.qs[ex.i],n=ex.qs.length,answered=Object.keys(ex.ans).length;if(q.ident)setTimeout(()=>{const i=$('extyped');if(i)i.focus({preventScroll:true})},0);
 if(ex.limit&&exLeft()<=0){finishExam(true);return}
 $('extitle').textContent='Question '+(ex.i+1)+' of '+n;
 if(ex.limit){const t=$('extimer');t.hidden=false;const tick=()=>{const left=exLeft();t.textContent=clock(left);t.classList.toggle('low',left<60000);if(left<=0)finishExam(true)};tick();exTick=setInterval(tick,1000)}
 if(ex.sheet){$('extitle').textContent=n+' '+ITEMS;$('exbody').innerHTML=sheetHTML(ex);return}
 $('exbody').innerHTML='<div class="meter"><div class="labels"><span><b>'+answered+'</b> of '+n+' answered</span><span>Answers are shown at the end</span></div><div class="track"><div class="fill" style="width:'+(100*answered/n)+'%"></div></div></div>'+
  '<section class="card" id="excard"><div class="qhead"><span class="kind">'+(q.self?'Written · you check it at the end':q.wr?'Written answer'+(byId[q.cid].part?' · part '+byId[q.cid].part+' of '+byId[q.cid].parts:''):ex.paperless?(q.vsa?'VSA · type your answer':q.mt?'Matching type':'Multiple choice'):exKind(q)+srcTag(q.cid))+'</span></div>'+caseHTML(q.cid)+caseMine(ex,ex.i)+'<p class="prompt">'+stemHTML(q.stem)+'</p>'+(q.mt?'<p class="mgi">Options may be used more than once.</p>':'')+figHTML(q.cid)+
  (q.self?'<div class="typein wr"><textarea id="extyped" class="typed wrin" rows="4" placeholder="Write your answer, or work on paper and tap Done on paper" aria-label="Your answer" oninput="exType(this.value)">'+esc(ex.ans[ex.i]&&ex.ans[ex.i]!==ONPAPER?ex.ans[ex.i]:'')+'</textarea><p class="pqid"><button class="link" onclick="exPaper()">'+(ex.ans[ex.i]===ONPAPER?'✓ Done on paper':'Done on paper')+'</button> · You\'ll compare it with the answer on the results page.</p></div>'
  :q.wr?wrBox(byId[q.cid],'extyped',ex.ans[ex.i],' oninput="exType(this.value)" onkeydown="if(event.key===\'Enter\'&&(event.ctrlKey||event.metaKey)){event.preventDefault();'+(ex.i<n-1?'exGo(1)':'finishExam()')+'}"'):q.ident?'<div class="typein"><input id="extyped" class="typed" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="'+(q.vsa?'Type the term':'Type your answer')+'" aria-label="Your answer" value="'+esc(ex.ans[ex.i]||'')+'" oninput="exType(this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();'+(ex.i<n-1?'exGo(1)':'finishExam()')+'}"></div>'
   :'<div class="choices'+(molq(q)?' ichoices':'')+'">'+q.choices.map(x=>'<button class="choice '+(ex.ans[ex.i]===x.letter?'sel':'')+'" onclick="exAnswer(\''+x.letter+'\')"><span class="key">'+x.letter+'</span><span class="lab">'+labelHTML(x.label)+'</span></button>').join('')+'</div>')+
  '<div class="actions"><button class="btn back" onclick="exGo(-1)" '+(ex.i?'':'disabled')+'>'+LEFT+'Back</button><span class="aux"><button class="link" onclick="finishExam()">Finish exam</button> · <button class="link danger" onclick="discardExam()" title="Throw this exam away: nothing from it is saved">Discard</button></span>'+
  '<button class="btn primary" onclick="'+(ex.i<n-1?'exGo(1)':'finishExam()')+'">'+(ex.i<n-1?'Next':'Finish')+' <kbd>Enter</kbd></button></div></section>'+
  '<div class="qnav" aria-label="Jump to a question">'+ex.qs.map((_,j)=>'<button class="'+(ex.ans[j]?'a ':'')+(j===ex.i?'cur':'')+'" onclick="exJump('+j+')" aria-label="Question '+(j+1)+(ex.ans[j]?', answered':'')+'">'+(j+1)+'</button>').join('')+'</div>'}
// Answer sheet format: read on the test paper, shade on the sheet. Shading updates only the sheet, so the paper keeps its place.
function sheetHTML(ex){const n=ex.qs.length,done=Object.keys(ex.ans).length;
 const paper=ex.qs.map((q,j)=>(q.mt&&(!j||ex.qs[j-1].grp!==q.grp)?mgrpHTML(q):'')+'<section class="card pq" id="pq'+j+'" onclick="sheetFocus('+j+')"><div class="pqh"><b>'+(j+1)+'.</b><span class="kind">'+exKind(q)+'</span></div>'+caseHTML(q.cid)+'<p class="prompt">'+stemHTML(q.stem)+'</p>'+figHTML(q.cid)+
  (q.ident||q.self?'<p class="pqid">Write your answer on the answer sheet.</p>':q.mt?'':'<ol class="pch'+(molq(q)?' ich':'')+'">'+q.choices.map(x=>'<li><b>'+x.letter+'.</b>'+labelHTML(x.label)+'</li>').join('')+'</ol>')+'</section>').join('');
 const rows=ex.qs.map((q,j)=>'<div class="brow" id="br'+j+'"><button class="bn" onclick="sheetGo('+j+')" aria-label="Go to question '+(j+1)+'">'+(j+1)+'</button>'+
  (q.ident||q.self?'<input class="txt bt" value="'+esc(ex.ans[j]||'')+'" placeholder="Answer" autocomplete="off" spellcheck="false" aria-label="Answer to question '+(j+1)+'" oninput="sheetType('+j+',this.value)">'
   :[...LETTERS].slice(0,Math.max(5,q.choices.length)).map(l=>'<button class="bub'+(ex.ans[j]===l?' on':'')+'" data-l="'+l+'" onclick="sheetPick('+j+',\''+l+'\')" aria-pressed="'+(ex.ans[j]===l)+'" aria-label="Question '+(j+1)+', '+l+'">'+l+'</button>').join(''))+'</div>').join('');
 return '<div class="sheetwrap"><div class="paper"><p class="lede" style="margin:0 0 14px">Read the questions here and shade your answers on the answer sheet. Tap a question to find its row; tap a shaded bubble again to erase it.</p>'+paper+'</div>'+
  '<aside class="sheet" id="sheet" aria-label="Answer sheet"><button class="sheethead" onclick="$(\'sheet\').classList.toggle(\'open\')"><b>Answer sheet</b><span id="shct">'+done+' of '+n+' shaded</span></button><div class="bubbles">'+rows+'</div>'+
  '<div class="sheetacts"><button class="link danger" onclick="discardExam()">Discard</button><button class="btn primary" onclick="finishExam()">Submit</button></div></aside></div>'}
function sheetCount(){const ex=state.exam,c=$('shct');if(c)c.textContent=Object.keys(ex.ans).length+' of '+ex.qs.length+' shaded'}
function sheetPick(j,l){const ex=state.exam;if(!ex||ex.done)return;if(ex.ans[j]===l)delete ex.ans[j];else ex.ans[j]=l;save();
 document.querySelectorAll('#br'+j+' .bub').forEach(b=>{const on=b.dataset.l===ex.ans[j];b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});sheetCount()}
function sheetType(j,v){const ex=state.exam;if(!ex||ex.done)return;if(v.trim())ex.ans[j]=v;else delete ex.ans[j];save();sheetCount()}
function sheetMark(j){document.querySelectorAll('.brow.cur').forEach(x=>x.classList.remove('cur'));const r=$('br'+j);if(r)r.classList.add('cur');return r}
function sheetFocus(j){const r=sheetMark(j);if(!r)return;$('sheet').classList.add('open');r.scrollIntoView({block:'nearest',behavior:reduceMotion?'auto':'smooth'})}
function sheetGo(j){const p=$('pq'+j);if(!p)return;sheetMark(j);if(innerWidth<=900)$('sheet').classList.remove('open');p.scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'})}
function exType(v){const ex=state.exam;if(!ex||ex.done)return;if(v.trim())ex.ans[ex.i]=v;else delete ex.ans[ex.i];save();
 const b=document.querySelectorAll('.qnav button')[ex.i];if(b)b.classList.toggle('a',!!v.trim())}
// In-page dialogs instead of the browser's confirm/alert/prompt boxes. ask() resolves true (OK) or false (Cancel, Esc, outside click).
function ask(text,o){o=o||{};return new Promise(res=>{let m=$('askbox');if(!m){m=document.createElement('div');m.className='modal';m.id='askbox';m.hidden=true;document.body.appendChild(m)}
 m.innerHTML='<div class="box askbox" role="'+(o.alert?'dialog':'alertdialog')+'" aria-modal="true"'+(o.title?' aria-labelledby="askh"':'')+' aria-describedby="askp">'+(o.title?'<h2 id="askh">'+esc(o.title)+'</h2>':'')+(text?'<p id="askp">'+esc(text)+'</p>':'')+
  (o.copy!=null?'<textarea class="txt askcopy" readonly rows="3" aria-label="Text to copy">'+esc(o.copy)+'</textarea>':'')+
  '<div class="askrow">'+(o.alert?'':'<button class="btn" id="askno">'+esc(o.no||'Cancel')+'</button>')+'<button class="btn '+(o.danger?'danger':'primary')+'" id="askyes">'+esc(o.ok||'OK')+'</button></div></div>';
 const prev=document.activeElement;m.hidden=false;ovOpen('ask',()=>done(false));
 const done=v=>{m.hidden=true;ovClosed('ask');document.removeEventListener('keydown',key,true);try{prev&&prev.focus&&prev.focus({preventScroll:true})}catch(e){}res(v)};
 const key=e=>{if(m.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(false)}else if(e.key==='Enter'){e.preventDefault();e.stopPropagation();const a=document.activeElement;done(a&&a.id==='askno'?false:true)}
  else if(e.key==='Tab'){const b=[...m.querySelectorAll('button,textarea')];const i=b.indexOf(document.activeElement);e.preventDefault();b[(i+(e.shiftKey?b.length-1:1))%b.length].focus()}else e.stopPropagation()};
 document.addEventListener('keydown',key,true);m.onclick=e=>{if(e.target===m)done(false)};$('askyes').onclick=()=>done(true);if($('askno'))$('askno').onclick=()=>done(false);
 setTimeout(()=>{const t=m.querySelector('.askcopy');if(t){t.focus();t.select()}else($(o.danger&&!o.alert?'askno':'askyes')).focus()},0)})}
const tell=(text,o)=>ask(text,Object.assign({alert:1},o||{}));
const copyBox=text=>tell('Your browser blocked copying. Select the text below and copy it.',{title:'Copy this',copy:text,ok:'Done'});
function discardExam(sure){const ex=state.exam;if(!ex||ex.done)return;if(!sure){ask('Nothing from it is saved.',{title:'Discard this '+(ex.chal?'challenge':'exam')+'?',ok:'Discard',danger:1}).then(y=>{if(y)discardExam(true)});return}
 clearInterval(exTick);state.exam=null;save();draw();window.scrollTo(0,0)}
function exAnswer(l){const ex=state.exam;if(!ex||ex.done)return;ex.ans[ex.i]=l;save();drawExam()}
function exGo(d){const ex=state.exam;if(!ex||ex.done)return;ex.i=Math.max(0,Math.min(ex.qs.length-1,ex.i+d));save();drawExam()}
function exJump(j){const ex=state.exam;if(!ex||ex.done)return;ex.i=j;save();drawExam()}
function finishExam(timeUp){const ex=state.exam;if(!ex||ex.done)return;const n=ex.qs.length,open=n-Object.keys(ex.ans).length;
 if(!timeUp&&open===n){ask('You haven\'t answered anything yet.',{title:'Discard this '+(ex.chal?'challenge':'exam')+'?',ok:'Discard',danger:1}).then(y=>{if(y)discardExam(true)});return}
 if(!timeUp&&open&&!finishExam.ok){ask(open+' question'+(open>1?'s are':' is')+' still unanswered. Skipped ones lower your score but are not counted as missed.',{title:'Finish anyway?',ok:'Finish',no:'Keep going'}).then(y=>{if(y){finishExam.ok=1;try{finishExam()}finally{finishExam.ok=0}}});return}
 clearInterval(exTick);ex.done=true;ex.end=Math.min(Date.now(),ex.limit?ex.start+ex.limit:Infinity);ex.timeUp=!!timeUp;let right=0;const byCh={};
 ex.qs.forEach((q,j)=>{const c=byId[q.cid],k=state.concepts[q.cid],a=ex.ans[j],ok=exOK(q,a),ch=q.mt?q.ch:chOf(c.section);
  byCh[ch]=byCh[ch]||[0,0];byCh[ch][1]++;if(ok){right++;byCh[ch][0]++}
  if(a==null||a===''||q.mt||q.self)return;   // written answers count when marked (exMark); skipped (matching items are not bank questions): no effect on mastery, Missed or class stats
  k.seen++;if(ok){state.correct++;masteryUp(k);delete k.back}else{k.wrong++;state.wrong++;masteryDown(k);relearn(k)}
  crowdAdd(q.cid,!ok,!ok&&!q.ident?(q.choices.find(x=>x.letter===a)||{}).label:'');state.history.push({cid:q.cid,correct:ok,lookup:false,mode:'EXAM'})});
 dailyAdd(ex.qs.filter((q,j)=>{const a=ex.ans[j];return !(a==null||a===''||q.mt)}).length);badgeAdd('exams',1);
 ex.right=right;ex.byCh=byCh;if(100*right/n>=(Object.assign({pass:60},CONFIG.grading||{})).pass)setTimeout(()=>celebrate('exam'),380);
 state.exams=(state.exams||[]).concat({right,total:n,date:new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'}),time:clock(ex.end-ex.start),chal:ex.chal?1:0,easy:ex.easy?1:0}).slice(-20);
 // A challenge keeps your first score; later tries are shared as retakes.
 if(ex.chal){state.chalLog=state.chalLog||{};const k=ex.chal.key;ex.retake=!!state.chalLog[k];if(!ex.retake)state.chalLog[k]={right,total:n}}
 save();if(page==='exam'){drawExam();window.scrollTo(0,0)}}
// Transmuted grade (DMSF handbook 8.1): 75 + (RSP - MPL) x 25 / (100 - MPL), MPL 60%. One straight line: 60% = 75, 100% = 100, 0% = 37.5.
const GRADING=Object.assign({pass:60,passGrade:75,floor:37.5},CONFIG.grading||{});
function transmute(r,t){const G=GRADING,p=100*r/t;return p>=G.pass?G.passGrade+(p-G.pass)*(100-G.passGrade)/(100-G.pass):G.floor+p*(G.passGrade-G.floor)/G.pass}
const fmtG=g=>(Math.round(g*100)/100).toFixed(2).replace(/\.?0+$/,'');
function gradeHTML(r,n){const g=transmute(r,n),ok=100*r/n>=GRADING.pass,need=Math.ceil(GRADING.pass*n/100-1e-9);
 return '<div class="grade'+(ok?'':' fail')+'"><div class="verdict">'+(ok?'Passed':'Not passed')+'</div><div class="gnum"><span class="num">'+fmtG(g)+'</span><small>predicted grade</small></div>'+
  '<p class="gsub">Passing is '+GRADING.pass+'% = '+GRADING.passGrade+' ('+need+' of '+n+' right). '+(ok?(r>need?'You cleared it by '+(r-need)+'.':'Right on the line!'):'You needed '+(need-r)+' more right.')+'</p></div>'}
function drawExamResult(){const ex=state.exam,n=ex.qs.length,pct=Math.round(100*ex.right/n);$('extitle').textContent='Results';
 const wrong=ex.qs.map((q,j)=>({q,j,a:ex.ans[j]})).filter(x=>!x.q.self&&!exOK(x.q,x.a));
 const selfs=ex.qs.map((q,j)=>({q,j,a:ex.ans[j]})).filter(x=>x.q.self),marks=ex.marks||{},pend=selfs.filter(x=>!(x.q.cid in marks)).length;
 const chk=selfs.length?'<section class="panel exchk" style="margin-top:12px"><h2>Check your written answers'+(pend?' <small>'+pend+' left</small>':'')+'</h2><p class="lede">Compare each one with the answer and mark it. Your score updates as you go.</p>'+selfs.map(({q,j,a})=>{const c=byId[q.cid],m=marks[q.cid];
  return '<article class="exc"><div class="qhead"><span class="kind">Question '+(j+1)+'</span></div><p class="exq">'+stemHTML(q.stem)+'</p>'+figHTML(q.cid)+
   (a&&a!==ONPAPER?'<div class="typein done"><span class="yl">You wrote</span><b class="wrout">'+esc(a)+'</b></div>':'<p class="pqid">'+(a===ONPAPER?'You answered on paper.':'Not answered.')+'</p>')+selfAnsHTML(c,a===ONPAPER?'':a)+
   '<div class="exmk"><button class="btn'+(m===0?' on':'')+'" onclick="exMark(\''+esc(q.cid)+'\',0)" aria-pressed="'+(m===0)+'">I missed it</button><button class="btn'+(m===1?' on':'')+'" onclick="exMark(\''+esc(q.cid)+'\',1)" aria-pressed="'+(m===1)+'">I got it</button></div></article>'}).join('')+'</section>':'';
 $('exbody').innerHTML='<section class="card hero exres"><div>'+(ex.chal?'<div class="eyebrow">'+esc(ex.chal.label)+(ex.retake?' · retake':'')+'</div>':'')+gradeHTML(ex.right,n)+'<div class="big num">'+pct+'%<small>'+ex.right+' of '+n+' right</small></div>'+(ex.chal&&ex.chal.by&&ex.chal.sc?'<p class="chalbeat">'+(ex.right>ex.chal.sc?'🎉 You beat <b>'+esc(ex.chal.by)+'</b>\'s '+ex.chal.sc+' of '+n+'!':ex.right===ex.chal.sc?'🤝 Tied with <b>'+esc(ex.chal.by)+'</b> at '+ex.chal.sc+' of '+n+(ex.chal.tm&&ex.end-ex.start<ex.chal.tm?', and you were faster!':'.'):'<b>'+esc(ex.chal.by)+'</b>\'s '+ex.chal.sc+' of '+n+' stays on top. Review your mistakes and try again!')+'</p>':'')+'<p class="sub">Time: '+clock(ex.end-ex.start)+(ex.timeUp?' (time ran out)':'')+' · '+(wrong.length?wrong.length+' to review':'no mistakes')+'</p>'+(ex.chal?'<div class="sqrow" role="img" aria-label="Green: right, red: wrong, white: skipped">'+squares(ex)+'</div>':'')+'</div></section>'+
  chk+'<section class="panel" style="margin-top:12px"><h2>By '+unitW+'</h2><div class="bars">'+Object.entries(ex.byCh).map(([ch,[r,t]])=>'<div class="bar-row"><span class="n"><span>'+esc(ch)+'</span>'+esc(CH_NAMES[ch]||'')+'</span><span class="p">'+r+' of '+t+'</span><span class="track"><span class="fill" style="display:block;width:'+(100*r/t)+'%"></span></span></div>').join('')+'</div></section>'+
  '<div class="exacts">'+(ex.chal?'<button class="btn primary" onclick="copyChalScore()">Copy my score</button><button class="btn" onclick="copyChalLink(state.exam.chal)">Copy challenge link</button>':'')+(wrong.length?'<button class="btn'+(ex.chal?'':' primary')+'" onclick="toggleExReview()">'+(ex.review?'Hide my mistakes':'Review my mistakes ('+wrong.length+')')+'</button>':'')+
  (wrong.length&&state.prefs.missed?'<button class="btn" onclick="selectSection(\'MISSED\')">Drill missed '+ITEMS+'</button>':'')+'<button class="btn" onclick="newExam()">'+(ex.chal?'Done':'New exam')+'</button></div>'+
  (ex.review?'<div class="exreview">'+wrong.map(({q,j,a})=>{const ok=q.choices.find(c=>c.correct),mine=q.ident?null:q.choices.find(c=>c.letter===a);
   return '<article class="panel"><div class="qhead"><span class="kind">Question '+(j+1)+' · '+(q.mt?exKind(q):esc(byId[q.cid].section))+'</span><span class="mastery">'+flagBtn("flagQ('ex',"+j+")")+'</span></div>'+caseHTML(q.cid)+'<p class="exq">'+esc(q.stem)+'</p>'+figHTML(q.cid)+(q.wr&&a?wrCheck(a,byId[q.cid].wr).html:'')+
    '<p class="exa bad"'+(q.wr?' style="white-space:pre-line"':'')+'><b>Your answer:</b> '+(q.ident&&a?esc(a):mine?mine.letter+'. '+labelHTML(mine.label):a?esc(a)+' (not one of the choices)':'skipped')+'</p><p class="exa good"><b>Correct:</b> '+(q.ident?(q.wr?ansHTML(ok.label):esc(ok.label)):ok.letter+'. '+labelHTML(ok.label))+'</p>'+(q.why?'<p class="exwhy">'+esc(q.why)+'</p>':'')+(mine&&!mine.correct&&whyNot(q.cid,mine.label)?'<p class="exwhy"><b>Why not your choice:</b> '+esc(whyNot(q.cid,mine.label))+'</p>':'')+stepsHTML(byId[q.cid])+'</article>'}).join('')+'</div>':'')}
function toggleExReview(){state.exam.review=!state.exam.review;save();drawExam()}
function newExam(){state.exam=null;save();draw();window.scrollTo(0,0)}
function examKey(e){const ex=state.exam;if(!ex||ex.done||ex.sheet)return false;const k=e.key;
 if(/^[a-e1-5]$/i.test(k)){if(ex.qs[ex.i].ident||ex.qs[ex.i].self)return false;const l=/^[1-5]$/.test(k)?LETTERS[+k-1]:k.toUpperCase();if(ex.qs[ex.i].choices.some(c=>c.letter===l)){exAnswer(l);return true}return false}
 if(k==='ArrowLeft'){exGo(-1);return true}
 if(k==='ArrowRight'||(k==='Enter'&&e.target.tagName!=='BUTTON')){if(ex.i<ex.qs.length-1)exGo(1);else finishExam();return true}
 return false}
// After answering an item, move to the next unanswered one (or stay put when all are answered).
function nextOpen(X,from){const n=X.items.length;for(let i=1;i<=n;i++){const j=(from+i)%n;if(X.ans[j]==null)return j}return from}
function scrollCur(){const r=document.querySelector('.mrow.cur');if(r)r.scrollIntoView({block:'nearest',behavior:reduceMotion?'auto':'smooth'})}
function matchKey(e,ctx){const X=getM(ctx);if(!X)return false;const k=e.key,n=X.items.length,cur=X.cur??0;
 if(k==='Enter'){if(e.target.tagName==='BUTTON'&&!e.target.closest('.mseg'))return false;
  if(!X.checked){if(Object.keys(X.ans).length===n)checkMatch(ctx)}else if(ctx==='p')endMix();else{pickMatch();drawMatchCard();drawMatchSets()}
  return true}
 if(X.checked)return false;
 if(k==='ArrowDown'||k==='ArrowUp'){X.cur=Math.max(0,Math.min(n-1,cur+(k==='ArrowDown'?1:-1)));redrawMatch(ctx);scrollCur();return true}
 if(/^[1-9]$/.test(k)&&+k<=n){X.cur=+k-1;redrawMatch(ctx);scrollCur();return true}
 const li=k.length===1?MLETTERS.indexOf(k.toUpperCase()):-1;
 if(li>=0&&li<X.opt.length){matchPick(ctx,cur,li);scrollCur();return true}
 return false}
function retryMatch(){newMatch(M.i);drawMatchCard();$('mcard').scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'})}
function openMatch(i){newMatch(i);drawMatchCard();drawMatchSets();$('mcard').scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'})}
function drawMatchSets(){
 $('msum').textContent=state.match.total?state.match.right+' of '+state.match.total+' items right overall':'';
 $('msets').innerHTML=matchPool().map(m=>{const b=state.match.best[m.title];
  return '<button class="mset '+(M&&M.i===m.i?'on':'')+'" onclick="openMatch('+m.i+')"><b>'+esc(m.title)+'</b><span class="'+(b===m.items.length?'ok':'')+'">'+esc(UNIT)+' '+esc(m.ch)+' · '+(b!=null?'best '+b+'/'+m.items.length:'not tried yet')+'</span></button>'}).join('');
}

/* ---------- class challenge: one link, the same questions for everyone ---------- */
// #challenge=<seed>&ch=1,2&n=15, plus &t=1 (timer), &bank=<id>, &o=<optional sections>, &x=0 (no detail items), &v=<pool check>
const CH_COUNTS=[10,15,20];let chalOpen=false,chalSeed='',chalN=15;
const LINK_SM='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>';
function readChallenge(){const h=location.hash.replace(/^#/,'');if(!/^challenge=/.test(h))return null;const p=new URLSearchParams(h),list=k=>(p.get(k)||'').split(',').filter(Boolean);
 const c={by:(p.get('by')||'').slice(0,40),sc:Math.max(0,Math.min(100,+p.get('sc')||0)),tm:Math.max(0,+p.get('tm')||0),seed:(p.get('challenge')||'').slice(0,24),chs:list('ch'),n:Math.max(1,Math.min(100,+p.get('n')||15)),t:p.get('t')==='1'||+p.get('m')>0,m:Math.max(0,Math.min(300,Math.round(+p.get('m'))||0)),bank:p.get('bank')||'main',o:list('o'),x:p.get('x')!=='0',v:p.get('v')||'',pr:/^\d+$/.test(p.get('p')||'')?+p.get('p'):null};
 return c.seed?c:null}
// Opening a challenge link: show its intro, or simply resume it if it is the one in progress.
function takeLink(){const c=readChallenge();if(!c)return false;const ex=state.exam;
 if(ex&&!ex.done&&ex.chal&&ex.chal.key===chalKey(c)){CHAL=null;clearHash()}else CHAL=c;page='exam';return true}
function clearHash(){if(/^#challenge=/.test(location.hash))try{history.replaceState(history.state,'',location.pathname+location.search)}catch(e){location.hash=''}}
function chalRaw(c){const b=BANKS.find(x=>x.id===c.bank);if(!b)return null;
 return b.items.filter(it=>!it.xo&&(!c.chs.length||c.chs.includes(chOf(it.section)))&&(c.x||!it.extra)&&(!OPT[it.section]||optExam(it.section)||c.o.includes(it.section)))}
// v81: CONFIG.challengeSkip {caps, sections} keeps items out of challenges (Pharma: no true/false, nothing he didn't teach).
// A link made before that (its pool check matches the unfiltered pool) keeps its old questions, so everyone still gets the same set.
function chalPool(c){const raw=chalRaw(c);if(!raw)return null;const sk=CONFIG.challengeSkip||{},caps=sk.caps||[],secs=sk.sections||[];
 const f=raw.filter(it=>!caps.includes(it.cap)&&!secs.includes(it.section));return c.v&&c.v!==poolSig(f)&&c.v===poolSig(raw)?raw:f}
const poolSig=pool=>stableHash(pool.map(c=>c.id).join('|')).toString(36).slice(0,5);
const chalKey=c=>[c.seed,c.bank,c.chs.join('.'),c.n,c.o.join('.'),c.x?1:0].join('/')+(c.pr!=null?'/p'+c.pr:'');
function chalLabel(c){const m=c.seed.match(/^(\d{4})(\d{2})(\d{2})(.*)$/);if(!m)return 'Class challenge';
 return 'Class challenge · '+new Date(+m[1],+m[2]-1,+m[3]).toLocaleDateString(undefined,{month:'short',day:'numeric'})+(m[4]?' ('+m[4].toUpperCase()+')':'')}
function chsText(chs){const all=Object.keys(COURSE_CH);if(chs.length>1&&chs.length===all.length&&all.every(c=>chs.includes(c)))return 'all '+unitsW;
 return chs.length===1?chLabel(chs[0]):chs.every(ch=>ch in COURSE_CH)?UNIT+'s '+chs.join(', '):chs.map(chLabel).join(', ')}
// Links point at the website. A file opened from the device uses CONFIG.shareUrl (the same course online) if set.
function shareBase(){if(/^https?:$/.test(location.protocol)){const c=new URLSearchParams(location.search).get('course');return location.origin+location.pathname+(c?'?course='+encodeURIComponent(c):'')}return CONFIG.shareUrl||''}
function chalLink(c){const b=shareBase();if(!b)return '';
 return b+'#challenge='+encodeURIComponent(c.seed)+'&ch='+c.chs.join(',')+'&n='+c.n+(c.m?'&m='+c.m:c.t?'&t=1':'')+(c.bank!=='main'?'&bank='+encodeURIComponent(c.bank):'')+(c.o.length?'&o='+c.o.join(','):'')+(c.x?'':'&x=0')+(c.pr!=null?'&p='+c.pr:'')+'&v='+c.v}
const todaySeed=()=>{const d=new Date();return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')};
// Today's link is the same for anyone who picks the same topics and length; "Different questions" adds a letter.
function chalDraft(){const st=exSetup(),c={seed:chalSeed.startsWith(todaySeed())?chalSeed:todaySeed(),chs:st.chs.slice(),n:chalN,t:!!st.timer,m:typeof st.timer==='number'?st.timer:0,bank:state.bank,o:Object.keys(OPT).filter(optOn),x:!!state.prefs.extras,v:'',pr:null};
 // v82: with a preset picked on the exam page (main bank), the challenge follows that preset's rules and length
 const pi=state.bank==='main'?exPresetIdx(st):-1;if(pi>=0){c.pr=pi;c.n=EX_PRESETS[pi].count}
 const pool=chalPool(c)||[];c.n=Math.min(c.n,pool.length);c.v=poolSig(pool);return c}
function toggleChal(){chalOpen=!chalOpen;drawExam()}
function setChalN(v){chalN=v;drawExam()}
function newChalSeed(){const m=chalDraft().seed.match(/^\d{8}([a-y]?)$/);chalSeed=todaySeed()+(m&&m[1]?String.fromCharCode(m[1].charCodeAt(0)+1):'b');drawExam()}
function chalBoxHTML(){const c=chalDraft(),P=(chalPool(c)||[]).length,link=chalLink(c),ub=bankObj().user;
 const opts=CH_COUNTS.filter(x=>x<P).map(x=>[x,String(x)]);if(P<=CH_COUNTS[CH_COUNTS.length-1])opts.push([P,'All '+P]);
 return '<div class="chalbox"><p class="chalnote" style="margin:0 0 12px">Everyone who opens the link gets the same '+ITEMS+' in the same order, from the '+unitsW+' picked above'+(c.t?', with the timer':'')+'. Finish, copy your score and compare in your group chat.</p>'+
  (link?(c.pr!=null?'<div class="chalrow"><span>Rules</span><span class="chalrules">Same as Take exam with <b>'+esc(EX_PRESETS[c.pr].label)+'</b> ('+c.n+' '+ITEMS+')</span></div>':'<div class="chalrow"><span>Questions</span>'+segHTML('setChalN',opts,c.n,'Challenge length')+'</div>')+
   '<div class="chalbar"><input class="txt chalurl" readonly value="'+esc(link)+'" onclick="this.select()" aria-label="Challenge link"><button class="btn sm" onclick="copyChalLink(chalDraft())">Copy link</button><button class="btn sm primary" onclick="startChallenge(chalDraft())">Take it now</button></div>'+
   '<p class="chalfoot">'+esc(chalLabel(c))+' · <button class="link" onclick="newChalSeed()">Different questions</button></p>'+
   (ub?'<p class="chalwarn">This uses your own set “'+esc(bankObj().name)+'”. Classmates need it too: Export it in Personalize and send them the file.</p>':'')
  :'<p class="chalwarn">Challenge links need the website version of this reviewer. This copy is a file on your device, so a link to it would not open for anyone else.</p>')+'</div>'}
function drawChalIntro(){const c=CHAL,b=BANKS.find(x=>x.id===c.bank),pool=b?chalPool(c):[];$('extitle').textContent='Class challenge';
 const ex=state.exam,busy=ex&&!ex.done,prev=(state.chalLog||{})[chalKey(c)],n=Math.min(c.n,pool.length);
 const box=inner=>'<section class="card hero exres"><div><div class="eyebrow">'+esc(chalLabel(c))+'</div>'+inner+'</div></section>';
 if(!b||!n){$('exbody').innerHTML=box('<p class="chalnote" style="margin-top:0">'+(b?'This challenge has no questions in this version of the reviewer.':'This challenge uses a question set that isn\'t in this browser. Ask whoever sent the link to export the set, then add it in Personalize → Question banks.')+'</p><div class="exacts"><button class="btn" onclick="dismissChallenge()">Close</button></div>');return}
 $('exbody').innerHTML=box('<div class="big num">'+n+'<small>'+ITEMS+'</small></div><p class="sub">'+esc(cap(chsText(c.chs)))+' · '+(c.m?c.m+'-minute timer':c.t?n+'-minute timer':'no timer')+(c.bank!=='main'?' · '+esc(b.name)+' bank':'')+'</p>'+
  '<p class="chalnote">Everyone who opens this link gets the same questions in the same order. Answers are shown at the end; then copy your score into the group chat to compare.</p>'+
  (c.v&&c.v!==poolSig(pool)?'<p class="chalwarn">This reviewer was updated after the link was made, so some of your questions may differ from your classmates\'.</p>':'')+
  (c.by&&c.sc?'<p class="chalbeat">🏆 <b>'+esc(c.by)+'</b> got <b>'+c.sc+' of '+n+'</b>'+(c.tm?' in '+clock(c.tm):'')+'. Can you beat it?</p>':'')+
  (prev?'<p class="chalnote">You already took this one: <b>'+prev.right+' of '+prev.total+'</b>. Another try is shared as a retake.</p>':'')+
  (busy?'<p class="chalwarn">Starting replaces the '+(ex.chal?'challenge':'mock exam')+' you have in progress.</p>':'')+
  '<div class="exacts"><button class="btn primary" onclick="startChallenge(CHAL)">Start challenge</button><button class="btn" onclick="dismissChallenge()">Not now</button></div>')}
function dismissChallenge(){CHAL=null;clearHash();draw();window.scrollTo(0,0)}
function startChallenge(c){const pool=chalPool(c)||[];let n=Math.min(c.n,pool.length);if(!n)return;const fx={seed:c.seed,items:pool};
 // v82: &p=<preset> builds the exam exactly like Take exam with that preset (quota, caps, VSA at the end), seeded by the link.
 // Links without it keep the old pick (a seeded shuffle of the whole pool).
 const P=c.pr!=null&&c.bank==='main'?EX_PRESETS[c.pr]:null;let picked,vs=[];
 if(P){const st={count:c.n,chs:c.chs.filter(ch=>chapters.includes(ch)),secs:P.secs||null,quota:P.quota||null,cases:P.cases||null,split:!!P.split,format:P.format,vsa:P.vsa||0,match:0,timer:true};if(!st.chs.length)st.chs=chapters.slice();
  const ep=exPoolOf(pool,st);n=Math.min(c.n,ep.length);if(!n)return;let i=0;RNG=()=>(stableHash('pick|'+c.seed+'|'+(i++))>>>0)||1;
  const keep=state.exSetup;state.exSetup=st;try{({picked,vs}=exPick(st,ep,n,exPoolOf(BANKS[0].items.filter(c=>c.xo),st)))}finally{state.exSetup=keep;RNG=null}}
 else picked=shuffle(pool,stableHash('order|'+c.seed)).slice(0,n);
 HARD=true;LONG=!!P;const chQs=picked.map(it=>exQ(makeQuestion(it,fx))).concat(vs.map(it=>exQ(makeQuestion(it,fx),true)));HARD=LONG=false;
 state.exam={qs:chQs,
  ans:{},i:0,start:Date.now(),limit:(c.m?c.m:c.t?n:0)*60000,done:false,sheet:(P?P.format:exSetup().format)==='sheet'||undefined,paperless:P&&P.format==='paperless'||undefined,chal:Object.assign({},c,{key:chalKey(c),label:chalLabel(c)})};
 CHAL=null;chalOpen=false;clearHash();page='exam';state.page='exam';save();draw();window.scrollTo(0,0)}
const squares=ex=>ex.qs.map((q,j)=>ex.ans[j]==null||ex.ans[j]===''?'⬜':exOK(q,ex.ans[j])?'🟩':'🟥').join('');
function copyChalScore(){const ex=state.exam,C=ex&&ex.chal;if(!C)return;const n=ex.qs.length,link=chalLink(C);
 copyText((state.name?state.name.trim()+' · ':'')+CONFIG.title+' · '+C.label+'\n'+ex.right+'/'+n+' ('+Math.round(100*ex.right/n)+'%) in '+clock(ex.end-ex.start)+(ex.retake?' · retake':'')+'\n'+squares(ex)+(link?'\nBeat my score: '+link+'&by='+encodeURIComponent((state.name||'A classmate').trim())+'&sc='+ex.right+'&tm='+(ex.end-ex.start):''),'Score copied. Paste it in your group chat.')}
function copyChalLink(c){const link=chalLink(c);if(!link)return;
 copyText(CONFIG.title+' · '+chalLabel(c)+': '+c.n+' '+ITEMS+' from '+chsText(c.chs)+(c.t?', timed':'')+'. Same questions for everyone.\n'+link,'Link copied. Paste it in your group chat.')}

/* ---------- flag a question: copies it, with its ID and answer key, for the group chat ---------- */
const FLAG_SVG='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/></svg>';
function flagBtn(call){return state.prefs.flag?'<button class="starbtn flagbtn" onclick="'+call+'" aria-label="Flag a problem with this '+ITEM+'" title="Something wrong? Copy this '+ITEM+' for your group chat (F)">'+FLAG_SVG+'</button>':''}
function flagQ(where,j){const q=where==='ex'?state.exam&&state.exam.qs[j]:where==='log'?(secLog()[view]||{}).q:state.active;if(!q)return;
 const ok=(q.choices||[]).find(c=>c.correct),c=q.cid&&byId[q.cid];
 const text='['+CONFIG.title+(c?' · '+c.section+' · '+q.cid:'')+'] '+q.stem+(ok?' (Answer key: '+labelText(ok.label)+')':'');
 // Questions of the course go to the moderator; your own sets (and no cloud) keep the copy for the group chat.
 if(contribOn()&&c&&BUILTIN.has(c.id)){openContrib('report',{qid:c.id,section:c.section,q:q.stem,key:ok?labelText(ok.label):'',text});return}
 copyText(text+' — My note: ','Copied. Paste it in your group chat and say what looks wrong.')}

/* ---------- copy and toast ---------- */
function toast(m){const t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true},2800)}
function copyText(text,msg){const done=()=>toast(msg||'Copied');
 const old=()=>{const a=document.createElement('textarea');a.value=text;a.setAttribute('readonly','');a.style.cssText='position:fixed;top:0;opacity:0';document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand('copy')}catch(e){}a.remove();if(ok)done();else copyBox(text)};
 if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(done,old);else old()}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'text/plain'}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

/* ---------- add, edit, export a question set ---------- */
let setEdit=null,setTimer=null;
function openSetEditor(id){const s=id?USER_SETS.find(x=>x.id===id):null;setEdit=s;
 $('seth').textContent=s?'Edit question set':'Add a question set';$('setname').value=s?s.name:'';$('settext').value=s?s.text:'';$('setdel').hidden=!s;
 $('secex').textContent='# '+(ALL_SECTIONS.find(k=>k in COURSE_SECS)||'1-1');
 setPreview();$('setmodal').hidden=false;ovOpen('sets',closeSetEditor);$('setmodal').querySelector('.box').scrollTop=0;(s?$('settext'):$('setname')).focus({preventScroll:true})}
function closeSetEditor(){$('setmodal').hidden=true;setEdit=null;ovClosed('sets')}
function setPreview(){const v=$('settext').value,p=parseSet(v),N=p.items.length,nid=p.items.filter(i=>i.ident).length,tops=new Set(p.items.map(i=>i.topic)).size;
 if(p.name&&!$('setname').value.trim())$('setname').value=p.name.slice(0,30);
 $('setinfo').innerHTML=(N?'<b>'+N+' question'+(N>1?'s':'')+'</b>'+(nid?' ('+nid+' identification)':'')+(tops>1?' in '+tops+' topics':'')+(p.problems.length?', and '+p.problems.length+' to fix:':', ready to save.'):v.trim()?'No questions found yet.':'Paste questions here or upload a file.')+
  (p.problems.length?'<ul class="setprob">'+p.problems.slice(0,6).map(x=>'<li>'+esc(x)+'</li>').join('')+(p.problems.length>6?'<li>and '+(p.problems.length-6)+' more</li>':'')+'</ul>':'');
 $('setsave').disabled=!N;$('setsave').textContent=N&&p.problems.length?'Save '+N+' question'+(N>1?'s':''):'Save set'}
function setUpload(){const i=document.createElement('input');i.type='file';i.accept='.txt,.csv,.tsv,.md,text/plain,text/csv';
 i.onchange=()=>{const f=i.files[0];if(!f)return;f.text().then(t=>{$('settext').value=t;if(!$('setname').value.trim()&&!parseSet(t).name)$('setname').value=f.name.replace(/\.[^.]+$/,'').slice(0,30);setPreview()})};i.click()}
function saveSet(){const p=parseSet($('settext').value);if(!p.items.length)return;const s=setEdit,name=($('setname').value.trim()||p.name||'My set').slice(0,30);
 // A new set's id comes from its name, so classmates who add the same file share challenge links for it.
 const id=s?s.id:'u'+stableHash(name.toLowerCase()).toString(36);
 if(BANKS.some(b=>(b.id===id||b.name.toLowerCase()===name.toLowerCase())&&(!s||b.id!==s.id))){tell('Pick another name, or edit that set.',{title:'There is already a bank called “'+name+'”'});return}
 const used=new Set(Object.keys(COURSE_CH).concat(USER_SETS.map(x=>x.ch)));
 const rec={id,name,ch:s?s.ch:'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('').find(c=>!used.has(c))||'Z',text:setText(p.items)};
 const i=USER_SETS.findIndex(x=>x.id===id);if(i>=0)USER_SETS[i]=rec;else USER_SETS.push(rec);
 try{localStorage.setItem(SETS_KEY,JSON.stringify(USER_SETS))}catch(e){tell('Storage is full or blocked.',{title:'This browser would not save the set'});return}
 if(!s){state.bank=id;state.section='ALL';state.page='study'}state.active=null;state.feedback=null;state.selected=null;state.pmatch=null;save();flushSave();location.reload()}
function deleteSet(sure){const s=setEdit;if(!s)return;if(sure!==true){ask('Its progress in this browser is deleted too.',{title:'Delete the set “'+s.name+'”?',ok:'Delete',danger:1}).then(y=>{if(y)deleteSet(true)});return}
 USER_SETS=USER_SETS.filter(x=>x.id!==s.id);try{localStorage.setItem(SETS_KEY,JSON.stringify(USER_SETS))}catch(e){}
 Object.keys(state.concepts).forEach(k=>{if(k.startsWith(s.id+'_'))delete state.concepts[k]});if(state.bank===s.id)state.bank='main';
 state.active=null;state.feedback=null;state.selected=null;save();flushSave();location.reload()}
function exportSet(id){const s=USER_SETS.find(x=>x.id===id);if(!s)return;
 download((s.name.replace(/[^\w\- ']+/g,'').trim()||'question set')+'.txt','// A question set for '+CONFIG.title+'. To add it: open the reviewer, then Personalize → Question banks → Add a set → Upload file.\nName: '+s.name+'\n\n'+s.text);
 toast('Saved “'+s.name+'”. Send the file to your classmates.')}

/* ---------- cloud (optional, Supabase): class stats and device sync ----------
   CONFIG.cloud = {url:'https://<project>.supabase.co', key:'<publishable / anon key>'}. Without it none of this shows.
   The database exposes only the functions in supabase_setup.sql: record_answers, class_stats, sync_put, sync_get, sync_known.
   The course id in the database is the storageKey, so the file and website versions share class stats. */
const BUILTIN=new Set(BANKS.filter(b=>!b.user).flatMap(b=>b.items.map(c=>c.id)));
const CLASS_SM='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.6a6.5 6.5 0 0 1 3.5 5.4"/></svg>';
function rpc(fn,body,keep){const h={'Content-Type':'application/json',apikey:CLOUD.key};if(/^eyJ/.test(CLOUD.key))h.Authorization='Bearer '+CLOUD.key;
 return fetch(CLOUD.url.replace(/\/+$/,'')+'/rest/v1/rpc/'+fn,{method:'POST',headers:h,body:JSON.stringify(body),keepalive:!!keep})
  .then(r=>r.text().then(t=>{if(!r.ok){let m='';try{m=JSON.parse(t).message||''}catch(e){}throw new Error(m||'cloud '+r.status)}return t?JSON.parse(t):null}))}
// Most missed by the class: questions answered at least CLASS_MIN times, by miss rate, within the current bank and exam scope.
// Cram mode: the highest-yield ~45 in the current scope. Fixed for the day so a round doesn't shift while you answer.
const CRAM_N=45,FLAME_SM='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1.5.6-2.8 1.5-3.8C10 10 11 10.5 11 12c1-2 1-5 1-9z"/><path d="M12 21a7 7 0 0 0 7-7c0-3-1.5-5.5-3-7"/><path d="M5 14a7 7 0 0 0 7 7"/></svg>';
let cramMemo={k:'',list:[]};
function cramOn(){return BANK.length>=CRAM_N+15}
function cramList(){const day=new Date().toDateString(),k=state.bank+'|'+state.prefs.scope+'|'+BANK.length+'|'+day+'|'+(CSTATS&&CSTATS.at||0);if(cramMemo.k===k)return cramMemo.list;
 const out=[],seen=new Set(),add=c=>{if(c&&!seen.has(c.id)&&out.length<CRAM_N){seen.add(c.id);out.push(c)}};
 classList().slice(0,20).forEach(add);
 BANK.filter(c=>isMissedC(c)&&!isM(c)).sort((a,b)=>((state.concepts[b.id]||{}).wrong||0)-((state.concepts[a.id]||{}).wrong||0)).slice(0,10).forEach(add);
 // then each section's most-missed (by the class), else an unmastered one, round by round until the deck is full
 const rank=c=>{const r=classRate(c.id);return (r==null?-1:r)*1000+(isM(c)?0:500)+(stableHash(c.id+day)%400)};
 const bySec=sectionKeys.map(sec=>BANK.filter(c=>c.section===sec).sort((a,b)=>rank(b)-rank(a))).filter(l=>l.length);
 for(let i=0;out.length<CRAM_N&&bySec.some(l=>l.length>i);i++)bySec.forEach(l=>add(l[i]));
 const list=shuffle(out,stableHash('cram|'+day));cramMemo={k,list};return list}
function classList(){if(!CSTATS||!CSTATS.rows)return [];const k=state.bank+'|'+state.prefs.scope+'|'+CSTATS.at+'|'+BANK.length;if(classMemo.k===k)return classMemo.list;
 const list=BANK.map(c=>({c,s:CSTATS.rows[c.id]})).filter(x=>x.s&&x.s[0]>=CLASS_MIN&&x.s[1]>0).sort((a,b)=>b.s[1]/b.s[0]-a.s[1]/a.s[0]||b.s[0]-a.s[0]).slice(0,CLASS_TOP).map(x=>x.c);
 classMemo={k,list};return list}
// Dashboard panel: how the whole class is doing, from the same anonymous counts (current bank and exam scope).
function drawClassPanel(){const el=$('classPanel');if(!el)return;const rows=cloudOn()&&state.prefs.classmiss&&CSTATS&&CSTATS.rows?BANK.filter(c=>BUILTIN.has(c.id)).map(c=>({c,s:CSTATS.rows[c.id]})).filter(x=>x.s):[];
 el.hidden=!rows.length;if(!rows.length)return;
 const pct=(m,a)=>Math.round(100*m/Math.max(1,a)),A=rows.reduce((t,x)=>t+x.s[0],0),Mi=rows.reduce((t,x)=>t+x.s[1],0),all=BANK.filter(c=>BUILTIN.has(c.id)).length,ex=examObj();
 const by={};rows.forEach(({c,s})=>{const b=by[c.section]||(by[c.section]=[0,0]);b[0]+=s[0];b[1]+=s[1]});
 const secs=Object.entries(by).filter(([,b])=>b[0]>=CLASS_MIN&&b[1]>0).sort((x,y)=>y[1][1]/y[1][0]-x[1][1]/x[1][0]||y[1][0]-x[1][0]).slice(0,6),top=classList();
 el.innerHTML='<h2>Class stats<em>updated '+agoShort(CSTATS.at)+'</em></h2><p class="desc">Anonymous right/wrong counts from everyone using this reviewer'+(ex?' (for '+esc(ex.name)+')':'')+'. Refreshes every 30 minutes.</p>'+
  '<div class="recent-sum"><span><b>'+A.toLocaleString()+'</b>answers</span><span><b>'+pct(Mi,A)+'%</b>missed</span><span><b>'+rows.length+'<small style="font-size:13px;color:var(--mute)">/'+all+'</small></b>'+ITEMS+' tried</span></div>'+
  (secs.length?'<h3 class="csub">Hardest sections</h3><div class="bars">'+secs.map(([k,b])=>'<button class="bar-row cbar" onclick="selectSection(\''+k+'\')" title="Practice this section"><span class="n"><span>'+esc(k)+'</span>'+esc(SECTION_NAMES[k]||'')+'</span><span class="p">'+pct(b[1],b[0])+'% missed · '+b[0]+' answers</span><span class="track"><span class="fill" style="display:block;width:'+pct(b[1],b[0])+'%"></span></span></button>').join('')+'</div>':'')+
  (top.length?'<h3 class="csub">Most missed '+ITEMS+'</h3><ol class="ctop">'+top.slice(0,5).map(c=>'<li><b>'+classRate(c.id)+'%</b><span>'+esc(c.q||c.term)+'</span></li>').join('')+'</ol>'+
   '<button class="btn sm" onclick="selectSection(\'CLASS\')">Practice the class\'s most missed ('+top.length+')</button>'
   :'<p class="desc" style="margin:14px 0 0">The most missed list fills in once '+ITEMS+' have '+CLASS_MIN+' or more answers.</p>')}
function classOn(){return cloudOn()&&!!state.prefs.classmiss&&classList().length>0}
function classRate(id){const r=cloudOn()&&CSTATS&&CSTATS.rows&&CSTATS.rows[id];return r&&r[0]>=CLASS_MIN?Math.round(100*r[1]/r[0]):null}
function loadClassStats(){if(!cloudOn()||CSTATS&&CSTATS.at>STATS_RESET&&Date.now()-CSTATS.at<18e5)return;
 rpc('class_stats',{p_course:KEY}).then(rows=>{const r={};(rows||[]).forEach(x=>{r[x.qid]=[x.attempts,x.missed]});CSTATS={at:Date.now(),rows:r};classMemo.k='';
  try{localStorage.setItem(KEY+'_class',JSON.stringify(CSTATS))}catch(e){}
  setHTML($('nav'),navHTML());if(page==='dashboard')drawDash()}).catch(()=>{})}
/* ---------- class contributions (cloud): suggest a question, report a problem ----------
   Everything goes to a moderator's queue (moderate.html on the site, supabase_contrib.sql). Nothing a classmate sends shows
   up until a moderator approves it; approved questions join Main as "Class question", credited if a name was given.
   A random token per device (no account) lets the sender see what the moderator decided. */
const CONTRIB_TOKEN='reviewer_contrib_token',CONTRIB_NAME='reviewer_contrib_name',MINE_KEY=KEY+'_mine';
let MINE={at:0,rows:[],seen:0},cfMode='',cfCtx=null,cfDup='';
try{MINE=Object.assign(MINE,JSON.parse(localStorage.getItem(MINE_KEY)))}catch(e){}
function contribOn(){return cloudOn()&&CONFIG.contrib!==false}
function lsGet(k){try{return localStorage.getItem(k)||''}catch(e){return ''}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function contribToken(make){let t=lsGet(CONTRIB_TOKEN);if(/^[A-Za-z0-9]{24}$/.test(t)||!make)return t;
 const A='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789',r=new Uint8Array(24);crypto.getRandomValues(r);
 t=Array.from(r,x=>A[x%A.length]).join('');lsSet(CONTRIB_TOKEN,t);return t}
function saveMine(){lsSet(MINE_KEY,JSON.stringify(MINE))}
function mineRows(){return (MINE.rows||[]).filter(r=>r.course===KEY)}
const mineNew=()=>mineRows().filter(r=>r.reviewed_at&&Date.parse(r.reviewed_at)>(MINE.seen||0)).length;
// Approved class questions: fetched at every start (and when coming back to the tab), cached for offline use, and
// added to the bank right away. Ones the moderator took out are retired: still known (for old answers), never asked.
function loadContrib(force){if(!contribOn()||!force&&Date.now()-(CONTRIB.at||0)<3e5)return;
 rpc('contrib_approved',{p_course:KEY}).then(rows=>{const items=(rows||[]).map(r=>r.item).filter(c=>c&&c.id),now=new Set(items.map(c=>c.id));
  const gone=(CONTRIB.gone||[]).concat(CONTRIB.items||[]).filter((c,i,a)=>c&&c.id&&!now.has(c.id)&&a.findIndex(x=>x&&x.id===c.id)===i).slice(-200);
  const first=!CONTRIB.at;CONTRIB={at:Date.now(),items,gone};lsSet(CONTRIB_KEY,JSON.stringify(CONTRIB));
  let added=0,changed=false;
  items.forEach(c=>{const it=contribItem(c);if(!it)return;const old=byId[it.id];
   if(!old){FULL_BANK.push(it);ALL_ITEMS.push(it);byId[it.id]=it;BUILTIN.add(it.id);if(!state.concepts[it.id])state.concepts[it.id]=blank();added++;changed=true}
   else if(old.kind==='class'){if(old.retired)added++;delete old.retired;Object.assign(old,it);changed=true}});
  FULL_BANK.forEach(c=>{if(c.kind==='class'&&!c.retired&&!now.has(c.id)){c.retired=true;changed=true}});
  if(!changed)return;refreshBank();setHTML($('nav'),navHTML());if(page==='dashboard')drawDash();
  if(added&&!first)toast(added+' new class question'+(added>1?'s were':' was')+' added by the moderator.')}).catch(()=>{})}
function loadMine(force){const t=contribToken(false);if(!contribOn()||!t||!force&&Date.now()-(MINE.at||0)<3e5)return Promise.resolve();
 return rpc('contrib_mine',{p_token:t}).then(rows=>{MINE.rows=rows||[];MINE.at=Date.now();saveMine();if(page==='dashboard')drawContribPanel();
  if(cfMode==='mine'&&!$('contribmodal').hidden)drawContrib()}).catch(()=>{})}
function drawContribPanel(){let el=$('contribPanel');if(!contribOn()){if(el)el.hidden=true;return}
 if(!el){const after=$('classPanel');if(!after)return;el=document.createElement('section');el.className='panel';el.id='contribPanel';after.after(el)}
 const mine=mineRows(),nw=mineNew(),nc=FULL_BANK.filter(c=>c.kind==='class'&&!c.retired).length;el.hidden=false;
 el.innerHTML='<h2>Help build this reviewer'+(nc?'<em>'+nc+' class question'+(nc>1?'s':'')+' so far</em>':'')+'</h2>'+
  '<p class="desc">Know a question that could come out? Suggest it. A moderator checks every suggestion, and approved ones are added for everyone, with your name if you give it. Spotted a wrong answer key or a typo? Tap the flag on that question.</p>'+
  '<div class="chalbar"><button class="btn sm primary" onclick="openContrib(\'question\')">Suggest a question</button>'+
  (mine.length?'<button class="btn sm" onclick="openContrib(\'mine\')">Your suggestions ('+mine.length+')'+(nw?' · '+nw+' new':'')+'</button>':'')+'</div>'}
function contribModal(){let m=$('contribmodal');if(m)return m;m=document.createElement('div');m.className='modal';m.id='contribmodal';m.hidden=true;
 m.innerHTML='<div class="box setbox" role="dialog" aria-modal="true" aria-labelledby="cfh"></div>';
 m.addEventListener('click',e=>{if(e.target===m)closeContrib()});document.body.appendChild(m);return m}
function openContrib(mode,ctx){if(!contribOn())return;cfMode=mode;if(ctx)cfCtx=ctx;cfDup='';const m=contribModal();drawContrib();m.hidden=false;ovOpen('contrib',closeContrib);m.querySelector('.box').scrollTop=0;
 if(mode==='mine'){loadMine(true);MINE.seen=Date.now();saveMine();if(page==='dashboard')drawContribPanel()}
 const f=m.querySelector(mode==='report'?'#cfnote':'#cfq');if(f)f.focus({preventScroll:true})}
function closeContrib(){const m=$('contribmodal');if(m)m.hidden=true;cfMode='';ovClosed('contrib')}
const cfName=()=>esc(lsGet(CONTRIB_NAME)||state.name||'');
function cfSecOptions(){const cur=state.section in COURSE_SECS?state.section:'',secs=ALL_SECTIONS.filter(k=>k in COURSE_SECS&&inScope(k)&&secOn(k));
 return ALL_CHAPTERS.filter(ch=>ch in COURSE_CH&&secs.some(k=>chOf(k)===ch)).map(ch=>'<optgroup label="'+esc(ch+' · '+COURSE_CH[ch])+'">'+
  secs.filter(k=>chOf(k)===ch).map(k=>'<option value="'+esc(k)+'"'+(k===cur?' selected':'')+'>'+esc(k+' '+COURSE_SECS[k])+'</option>').join('')+'</optgroup>').join('')}
function drawContrib(){const b=$('contribmodal').querySelector('.box'),nm=mineRows().length;
 const acts=(main,extra)=>'<p class="cfmsg" id="cfmsg" role="alert"></p><div class="setacts">'+(extra||'')+'<span></span><button class="btn" onclick="closeContrib()">Cancel</button>'+main+'</div>';
 if(cfMode==='question'){
  b.innerHTML='<h2 id="cfh">Suggest a question</h2><p>A moderator checks every suggestion before it goes in. Approved questions are added to Main as a <b>Class question</b>, credited to the name below.</p>'+
   '<label class="cf"><span>Topic</span><select id="cfsec">'+cfSecOptions()+'</select></label>'+
   '<label class="cf"><span>Question</span><textarea class="txt" id="cfq" rows="3" maxlength="700" placeholder="Write it the way the exam would ask it"></textarea></label>'+
   '<label class="cf"><span>Right answer</span><input class="txt" id="cfa" maxlength="250" autocomplete="off"></label>'+
   '<div class="cf"><span>Wrong choices<em>believable ones, like a real exam</em></span><div class="cfw">'+Array.from({length:CONTRIB_ND},(_,i)=>'<input class="txt cfd" maxlength="250" autocomplete="off" aria-label="Wrong choice '+(i+1)+'">').join('')+'</div></div>'+
   '<label class="cf"><span>Why it is right<em>optional, shown after answering</em></span><textarea class="txt" id="cfwhy" rows="2" maxlength="1200"></textarea></label>'+
   '<label class="cf"><span>Your name<em>optional, for the credit</em></span><input class="txt" id="cfname" maxlength="40" autocomplete="given-name" value="'+cfName()+'"></label>'+
   acts('<button class="btn primary" id="cfsend" onclick="sendContrib()">Send to moderator</button>',nm?'<button class="link" onclick="openContrib(\'mine\')">Your suggestions ('+nm+')</button>':'');return}
 if(cfMode==='report'){const c=cfCtx||{};
  b.innerHTML='<h2 id="cfh">Report a problem</h2><p>This goes to the moderator, who checks it and fixes the '+ITEM+' for everyone.</p>'+
   '<div class="cfquote"><small>'+esc(c.section+' · '+c.qid)+'</small>'+esc(c.q||'')+(c.key?'<br><small style="margin:6px 0 0">Answer key: '+esc(c.key)+'</small>':'')+'</div>'+
   '<label class="cf"><span>What looks wrong?</span><textarea class="txt" id="cfnote" rows="3" maxlength="800" placeholder="For example: the answer should be B, because… / a typo in choice C / this was not discussed"></textarea></label>'+
   '<label class="cf"><span>Your name<em>optional</em></span><input class="txt" id="cfname" maxlength="40" autocomplete="given-name" value="'+cfName()+'"></label>'+
   acts('<button class="btn primary" id="cfsend" onclick="sendReport()">Send to moderator</button>','<button class="link" onclick="copyReport()">Copy for the group chat instead</button>');return}
 const rows=mineRows(),ST={pending:'Waiting for review',approved:'Added',rejected:'Not added',resolved:'Fixed'};
 b.innerHTML='<h2 id="cfh">Your suggestions</h2><p>What you sent from this device, and what the moderator decided.</p><ul class="cmine">'+
  (rows.length?rows.map(r=>{const d=r.data||{},rep=r.kind==='report',st=rep&&r.status==='rejected'?'No change needed':ST[r.status]||r.status;
   return '<li><span class="cst '+esc(r.status)+'">'+esc(st)+'</span> <span class="cm">'+(rep?'Report':r.kind==='card'?'Flashcard':'Question')+' · '+esc(d.section||(d.ch?UNIT+' '+d.ch:''))+' · '+agoShort(Date.parse(r.created_at))+'</span>'+
    '<span class="cq">'+esc(rep?d.note||'':d.q||d.front||'')+'</span>'+(rep&&d.q?'<span class="cm">On: '+esc(d.q.length>110?d.q.slice(0,107)+'…':d.q)+'</span>':'')+
    (r.mod_note?'<span class="cn"><b>Moderator:</b> '+esc(r.mod_note)+'</span>':'')+'</li>'}).join(''):'<li class="empty">Nothing sent from this device yet.</li>')+'</ul>'+
  '<div class="setacts"><span></span><button class="btn" onclick="closeContrib()">Close</button><button class="btn primary" onclick="openContrib(\'question\')">Suggest a question</button></div>'}
function cfMsg(t){const e=$('cfmsg');if(e)e.textContent=t||''}
const cfNorm=t=>String(t).toLowerCase().replace(/[^a-z0-9À-ɏͰ-Ͽ]+/g,' ').trim();
// The closest existing question by shared words, so a classmate sees when theirs is already in the reviewer.
function cfSimilar(q){const w=new Set(cfNorm(q).split(' ').filter(x=>x.length>2));if(w.size<3)return null;let best=null,bs=0;
 FULL_BANK.forEach(c=>{if(!c.q||c.retired)return;const v=new Set(cfNorm(c.q).split(' ').filter(x=>x.length>2));let n=0;w.forEach(x=>{if(v.has(x))n++});
  const sc=n/Math.max(1,new Set([...w,...v]).size);if(sc>bs){bs=sc;best=c}});return bs>=.7?best:null}
function cfSend(kind,data,btn){const name=($('cfname').value||'').trim().slice(0,40);lsSet(CONTRIB_NAME,name);data.name=name;
 btn.disabled=true;btn.textContent='Sending…';
 rpc('contrib_submit',{p_course:KEY,p_kind:kind,p_data:data,p_token:contribToken(true)}).then(id=>{
  MINE.rows=[{id,course:KEY,kind,data,status:'pending',mod_note:null,created_at:new Date().toISOString(),reviewed_at:null}].concat(MINE.rows||[]);saveMine();
  closeContrib();toast(kind==='report'?'Sent. Thanks! The moderator will check it.':'Sent. Thanks! You can follow it under Your suggestions.');if(page==='dashboard')drawContribPanel()})
 .catch(e=>{btn.disabled=false;btn.textContent='Send to moderator';
  cfMsg(/slow down/.test(e.message)?'A lot was sent in the last few minutes. Wait a little, then try again.':/incomplete/.test(e.message)?'Something is missing. Check the fields above.':'Could not send. Check your connection and try again.')})}
function sendContrib(){const v=id=>($(id).value||'').trim(),q=v('cfq'),a=v('cfa'),d=[...document.querySelectorAll('#contribmodal .cfd')].map(x=>x.value.trim()),low=x=>x.toLowerCase().replace(/\s+/g,' ');
 if(q.length<8)return cfMsg('Write the question first.');
 if(!a)return cfMsg('Add the right answer.');
 if(d.some(x=>!x))return cfMsg('Add '+CONTRIB_ND+' wrong choices, so it works like the other questions.');
 const all=[a].concat(d).map(low);if(new Set(all).size<all.length)return cfMsg('Every choice needs to be different.');
 const sim=cfSimilar(q);if(sim&&cfDup!==q){cfDup=q;cfMsg('This looks a lot like a question already in the reviewer: “'+(sim.q.length>140?sim.q.slice(0,137)+'…':sim.q)+'” Send it anyway if it is different.');$('cfsend').textContent='Send anyway';return}
 cfSend('question',{section:$('cfsec').value,q,a,d,why:v('cfwhy')},$('cfsend'))}
function sendReport(){const n=($('cfnote').value||'').trim();if(n.length<3)return cfMsg('Say what looks wrong, so the moderator knows what to check.');
 const c=cfCtx||{};cfSend('report',{qid:c.qid,section:c.section,q:c.q,key:c.key,note:n},$('cfsend'))}
function copyReport(){const c=cfCtx||{},n=(($('cfnote')||{}).value||'').trim();closeContrib();
 copyText(c.text+' — My note: '+n,'Copied. Paste it in your group chat'+(n?'.':' and say what looks wrong.'))}
// Anonymous answers go out in small batches: {q: question id, m: 1 if missed, c: the wrong choice picked (v74, for the
// question check in tools/item_report.py: which wrong choices nobody picks, or more people pick than the answer)}.
// Only built-in banks count.
function crowdAdd(cid,missed,pick){if(!cloudOn()||!state.prefs.crowd||!BUILTIN.has(cid))return;const it={q:cid,m:missed?1:0};if(missed&&pick)it.c=String(pick).slice(0,120);crowdQ.push(it);clearTimeout(crowdT);
 if(crowdQ.length>=10)crowdFlush();else crowdT=setTimeout(crowdFlush,20000)}
function crowdFlush(keep){if(!crowdQ.length)return;const items=crowdQ.splice(0,100);rpc('record_answers',{p_course:KEY,p_items:items},keep).catch(()=>{if(!keep&&crowdQ.length<300)crowdQ=items.concat(crowdQ)})}

// Sync: one private code (saved for every course on this site) links devices. Each sync merges first, then uploads,
// so no device ever loses answers: per question the copy with more answers wins; totals keep the higher count.
const fmtCode=c=>c.replace(/(.{4})(?=.)/g,'$1-');
function agoShort(t){const m=Math.round((Date.now()-t)/6e4);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':new Date(t).toLocaleDateString(undefined,{month:'short',day:'numeric'})}
function newCode(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',b=new Uint8Array(12);crypto.getRandomValues(b);return Array.from(b,x=>A[x%32]).join('')}
// Compact upload: per question [seen, right, wrong, lookups, hints, star, spaced level, due time, lucky].
// Also the settings (newest change wins) and the question on screen (the device used last decides).
function prefSig(){return JSON.stringify([state.prefs,state.exSetup||null])}
function syncPayload(){const c={};for(const id in state.concepts){const k=state.concepts[id];if(k.seen||k.star||k.lookups||k.srs)c[id]=[k.seen||0,k.right||0,k.wrong||0,k.lookups||0,k.hints||0,k.star?1:0,k.srs?k.srs.lvl:0,k.srs?k.srs.due:0,k.lucky||0]}
 let sum=null;try{sum=summaryObj()}catch(e){}
 return {v:2,at:Date.now(),c,sum,tot:{correct:state.correct,wrong:state.wrong,lookups:state.lookups,hints:state.hints},match:state.match,exams:state.exams||[],chalLog:state.chalLog||{},miss:state.missLog||[],name:state.name||'',history:(state.history||[]).slice(-60),sets:USER_SETS,fc:FC.c,fcd:FC.day,fch:FC.h||{},fcs:FC.sus||{},mc:MYC.c,
  prefs:state.prefs,exSetup:state.exSetup||null,prefsAt:state.prefsAt||0,
  cur:state.pmatch?null:{at:state.curAt||0,section:state.section,active:state.active,feedback:state.feedback,selected:state.selected,pass:state.pass||null,starDone:state.starDone||[],dueDone:state.dueDone||[],classDone:state.classDone||[]}}}
function unpack(r){const c={};for(const id in r.c||{}){const x=r.c[id];c[id]={seen:x[0],right:x[1],wrong:x[2],lookups:x[3],hints:x[4],star:!!x[5],srs:x[7]?{lvl:x[6],due:x[7]}:null,lucky:x[8]||0,history:[]}}return Object.assign({},r,{concepts:c})}
function mergeRemote(r){let changed=false,reload=false;if(r&&r.v===2)r=unpack(r);if(!r||!r.concepts)return {changed,reload};const t=r.tot||{},remoteMore=(t.correct||0)+(t.wrong||0)>state.correct+state.wrong;
 for(const id in r.concepts){const a=state.concepts[id],b=r.concepts[id];if(!b)continue;
  if(!a){state.concepts[id]=b;changed=true;continue}
  if((b.seen||0)>(a.seen||0)||(b.seen||0)===(a.seen||0)&&(b.right||0)>(a.right||0)){state.concepts[id]=Object.assign({},b,{history:(a.history||[]).length>(b.history||[]).length?a.history:b.history||[]});changed=true}
  else if(b.star&&!a.star&&(b.seen||0)===(a.seen||0)){a.star=true;changed=true}}
 ['correct','wrong','lookups','hints'].forEach(f=>{if((t[f]||0)>(state[f]||0)){state[f]=t[f];changed=true}});
 if(remoteMore&&(r.history||[]).length){state.history=r.history;changed=true}
 if(r.match&&(r.match.total||0)>(state.match.total||0)){state.match=r.match;changed=true}
 if((r.exams||[]).length>(state.exams||[]).length){state.exams=r.exams;changed=true}
 for(const k in r.chalLog||{})if(!(state.chalLog||{})[k]){state.chalLog=state.chalLog||{};state.chalLog[k]=r.chalLog[k];changed=true}
 if(r.name&&!state.name){state.name=r.name;changed=true}
 // own flashcards: per card, the newer change wins (a deletion is a change too)
 if(Array.isArray(r.mc)){let mc=false;for(const b of r.mc){if(!b||typeof b.i!=='string')continue;const i=MYC.c.findIndex(x=>x.i===b.i);if(i<0){MYC.c.push(b);mc=true}else if((b.at||0)>(MYC.c[i].at||0)){MYC.c[i]=b;mc=true}}
  if(mc){syncHold=true;mcSave();syncHold=false;changed=true}}
 // flashcards: per card, the copy with the newer review wins; today's counts keep the higher number
 if(r.fc&&typeof r.fc==='object'){let fc=false;for(const id in r.fc){const a=FC.c[id],b=r.fc[id];if(Array.isArray(b)&&b.length>=8&&(!a||b[3]>a[3])){FC.c[id]=b;fc=true}}
  if(Array.isArray(r.fcd)&&Array.isArray(FC.day)&&r.fcd[0]===FC.day[0])for(let i=1;i<4;i++)if((r.fcd[i]||0)>(FC.day[i]||0)){FC.day[i]=r.fcd[i];fc=true}
  if(r.fcs&&typeof r.fcs==='object')for(const id in r.fcs){const b=r.fcs[id],a=(FC.sus||{})[id];if(Array.isArray(b)&&(!a||b[1]>a[1])){(FC.sus||(FC.sus={}))[id]=b.slice(0,2);fc=true}}
  if(r.fch&&typeof r.fch==='object')for(const d in r.fch){const b=r.fch[d],a=(FC.h||{})[d];if(Array.isArray(b)&&(!a||b[0]>a[0])){(FC.h||(FC.h={}))[d]=b.slice(0,2);fc=true}}
  if(fc){syncHold=true;fcSave();syncHold=false;changed=true}}
 // "Why did I miss it?" taps: one entry per answer (question + time); both devices' entries are kept
 if(Array.isArray(r.miss)&&r.miss.length){const seen=new Set((state.missLog||[]).map(e=>e[0]+'|'+e[2])),add=r.miss.filter(e=>Array.isArray(e)&&e.length>=3&&!seen.has(e[0]+'|'+e[2]));
  if(add.length){state.missLog=(state.missLog||[]).concat(add).sort((a,b)=>a[2]-b[2]).slice(-MISS_MAX);changed=true}}
 if(r.prefs&&(r.prefsAt||0)>(state.prefsAt||0)){state.prefs=Object.assign({},DEFAULT_PREFS,r.prefs);if(!state.prefs.blurtV75){state.prefs.blurt=true;state.prefs.blurtV75=1}if(r.exSetup)state.exSetup=r.exSetup;state.prefsAt=r.prefsAt;prefSigLast=prefSig();refreshBank();changed=true}
 // Continue on the question the other device showed last, unless you are in the middle of answering one here.
 const C=r.cur,typing=$('typed')&&$('typed').value.trim();
 if(C&&(C.at||0)>(state.curAt||0)&&!(state.selected&&!state.feedback)&&!typing&&!state.pmatch&&validSection(C.section)&&(!C.active||byId[C.active.cid])){
  Object.assign(state,{section:C.section,active:C.active,feedback:C.feedback,selected:C.feedback?C.selected:null,pass:C.pass,starDone:C.starDone,dueDone:C.dueDone,classDone:C.classDone,curAt:C.at});
  view=null;if(!isX(C.section))openCh.add(secCh(C.section));changed=true}
 const used=new Set(Object.keys(COURSE_CH).concat(USER_SETS.map(x=>x.ch)));
 for(const x of r.sets||[])if(x&&x.id&&!USER_SETS.some(y=>y.id===x.id)){const ch=used.has(x.ch)?'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('').find(c=>!used.has(c))||'Z':x.ch;used.add(ch);USER_SETS.push(Object.assign({},x,{ch}));reload=true}
 if(reload)try{localStorage.setItem(SETS_KEY,JSON.stringify(USER_SETS))}catch(e){}
 return {changed,reload}}
function syncNow(){if(!cloudOn()||!syncCode||syncBusy)return Promise.resolve();syncBusy=true;clearTimeout(syncT);syncT=null;
 if(window.Daily&&Daily.sync)Daily.sync(rpc,syncCode);   // site-wide: streak, goal, notification settings
 return rpc('sync_get',{p_code:syncCode,p_course:KEY}).then(rows=>{const row=Array.isArray(rows)?rows[0]:rows,m=row&&row.data?mergeRemote(row.data):{};
   if(m.changed){syncHold=true;save();syncHold=false}
   const data=syncPayload(),sig=JSON.stringify(Object.assign({},data,{at:0,sum:data.sum&&Object.assign({},data.sum,{at:0})})),done=()=>{syncInfo={at:Date.now(),err:''};try{localStorage.setItem(KEY+'_synced',syncInfo.at)}catch(e){}
    if(m.reload){location.reload();return}
    if(m.changed){refreshBank();draw()}else if(page==='prefs')drawPrefs()};
   if(sig===lastPutSig&&!m.changed)return done();   // nothing new on either side: skip the upload
   return rpc('sync_put',{p_code:syncCode,p_course:KEY,p_data:data}).then(()=>{lastPutSig=sig;done()})})
  .catch(()=>{syncInfo.err='Could not reach the sync server. Your progress is safe here and will sync later';if(page==='prefs')drawPrefs()})
  .finally(()=>{syncBusy=false;syncBoot=false})}
function syncStart(){syncCode=newCode();try{localStorage.setItem(SYNC_KEY,JSON.stringify({code:syncCode}))}catch(e){}syncInfo={at:0,err:''};drawPrefs();syncNow()}
function syncLink(){const v=($('synccode').value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(v.length!==12){toast('A sync code has 12 letters and numbers.');return}
 rpc('sync_known',{p_code:v}).then(ok=>{if(!ok){toast('Nothing is saved under that code yet. Check it, or tap Sync now on the other device first.');return}
  syncCode=v;syncEntry=false;state.curAt=0;state.prefsAt=0;try{localStorage.setItem(SYNC_KEY,JSON.stringify({code:v}))}catch(e){}syncInfo={at:0,err:''};drawPrefs();syncNow().then(()=>toast('Linked. Your progress from both devices is combined.'))})
  .catch(()=>toast('Could not reach the sync server. Check your connection.'))}
function syncStop(sure){if(sure!==true){ask('Your progress stays here, and the other device keeps its own.',{title:'Stop syncing this device?',ok:'Stop syncing',danger:1}).then(y=>{if(y)syncStop(true)});return}syncCode='';clearTimeout(syncT);try{localStorage.removeItem(SYNC_KEY);localStorage.removeItem('reviewer_account')}catch(e){}drawPrefs()}
// Google sign-in lives on the home page (it gives this device the account's sync code); here we only show it.
function account(){try{return JSON.parse(localStorage.getItem('reviewer_account'))||null}catch(e){return null}}
const G_ICON='<svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';
function syncRowHTML(row){if(!cloudOn())return '';const t='Sync between devices',acc=account(),site=!!CONFIG.home&&/^https?:$/.test(location.protocol);
 const gBtn=site?'<a class="btn sm" href="'+esc(CONFIG.home)+'?signin=1">'+G_ICON+'Sign in with Google</a>':'';
 if(acc&&syncCode)return row(t,'Signed in as <b>'+esc(acc.name||acc.email||'you')+'</b>'+(acc.email&&acc.name?' ('+esc(acc.email)+')':'')+' · '+(syncInfo.err?esc(syncInfo.err):syncInfo.at?'synced '+agoShort(syncInfo.at):'syncing…')+'. Your progress in every course follows your Google account.',
  '<button class="btn sm" onclick="syncNow()">Sync now</button>'+(site?'<a class="btn sm" href="'+esc(CONFIG.home)+'?sync=1">Account</a>':''));
 if(syncEntry)return row(t,'Type the code shown on your other device under Personalize → Sync between devices.','<input class="txt" id="synccode" maxlength="14" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" onkeydown="if(event.key===\'Enter\')syncLink()"><button class="btn sm primary" onclick="syncLink()">Link</button><button class="btn sm" onclick="syncEntry=false;drawPrefs()">Cancel</button>');
 if(!syncCode)return row(t,site?'Keep the same progress on your phone and laptop, for every course. Sign in with Google, or use a private code you type on the other device.':'Keep the same progress on your phone and laptop. You get a private code to type on the other device; it covers every course here.',gBtn+'<button class="btn sm" onclick="syncStart()">'+(site?'Use a code':'Turn on')+'</button><button class="btn sm" onclick="syncEntry=true;drawPrefs();setTimeout(()=>$(\'synccode\').focus(),0)">I have a code</button>');
 return row(t,'Your code: <b class="code">'+fmtCode(syncCode)+'</b> · '+(syncInfo.err?esc(syncInfo.err):syncInfo.at?'synced '+agoShort(syncInfo.at):'syncing…')+'. Type it on your other device. Anyone with the code can see and change this progress, so keep it to yourself.',
  '<button class="btn sm" onclick="syncNow()">Sync now</button><button class="btn sm" onclick="copyText(fmtCode(syncCode),\'Code copied.\')">Copy code</button><button class="btn sm" onclick="syncStop()">Turn off</button>'+gBtn)}

/* ---------- personalize ---------- */
function drawPrefs(){
 document.title='Personalize · '+CONFIG.title;
 const row=(t,d,ctl)=>'<div class="prow"><div class="pl"><b>'+t+'</b><span>'+d+'</span></div><div class="ctl">'+ctl+'</div></div>';
 const sw=(on,fn,label)=>'<button class="tgl" role="switch" aria-checked="'+on+'" aria-label="'+esc(label)+'" onclick="'+fn+'"><span class="sw"></span></button>';
 const ex=bankObj().items.filter(c=>c.extra).length,rand=state.prefs.order==='random';
 let h='<section class="panel"><h2>Practice</h2>'+
  (GOALS.length>1?row('Recall goal','How many times you must answer a '+ITEM+' correctly before it counts as mastered. You can also switch this on the Practice page.',goalSeg()):'')+
  row('Stricter mastery',state.prefs.strict?'On: a miss takes one recall away (1 of 2 goes back to 0 of 2), and a right answer after Show hint doesn\'t count toward mastery.':'Off: a miss only matters once a '+ITEM+' is mastered, and hints don\'t change anything. Turn on for a stricter "mastered".',sw(state.prefs.strict,"setPref('strict',"+!state.prefs.strict+")",'Stricter mastery'))+
  row('Question order',rand?'Random: '+ITEMS+' come in a new order every pass and the answer letters are reshuffled each time, so you can\'t memorize positions.':'In order: '+ITEMS+' follow the lecture order and keep their answer letters. Easier to follow, but easier to memorize.',segHTML('setOrder',[['random','Random'],['fixed','In order']],state.prefs.order,'Question order'))+
  row('Answer mode',state.prefs.typeMode?'Type the answer: short recall '+ITEMS+' hide the choices and you type the term. Small typos are accepted, and you can count a typed answer as right if the checker missed it.':'Choices: pick the answer from the list. Switch to typing for identification-style practice.',segHTML('setTypeMode',[[false,'Choices'],[true,'Type the answer']],state.prefs.typeMode,'Answer mode'))+
  (MSETS.length?row('Mix matching into practice',state.prefs.mix?'After every '+state.prefs.mix+' '+ITEMS+', the next card is a matching set from the '+unitW+' you are practicing. It counts toward your matching scores, not '+ITEM+' mastery.':'Matching sets stay on their own page. Turn this on to get one now and then while you practice.',segHTML('setMix',[[0,'Off'],[10,'Every 10'],[5,'Every 5']],state.prefs.mix,'Mix matching into practice')):'')+
  Object.keys(OPT).map(k=>row('Include '+esc(OPT[k].name||SECTION_NAMES[k]||k),esc(OPT[k].note||'An optional '+unitW+' section that is not part of the current exam.')+' ('+FULL_BANK.filter(c=>c.section===k).length+' '+ITEMS+')',sw(optOn(k),"setOpt('"+k+"')",'Include '+(OPT[k].name||k)))).join('')+
  (ex?row('Include detail '+ITEMS,ex+' '+ITEMS+' in this bank are marked as extra detail. Turn this off to drill only the core.',sw(state.prefs.extras,"setPref('extras',"+!state.prefs.extras+")",'Include detail '+ITEMS)):'')+
  '</section>';
 h+='<section class="panel"><h2>Study tools</h2>'+
  row('Cross out choices','Rule out answers while you think: right-click a choice, tap its ×, or press Shift + its letter.',sw(state.prefs.crossout,"setPref('crossout',"+!state.prefs.crossout+")",'Cross out choices'))+
  row('Lucky guess button','After a correct answer, undo the mastery point if you were only guessing, so the '+ITEM+' stays in your queue.',sw(state.prefs.lucky,"setPref('lucky',"+!state.prefs.lucky+")",'Lucky guess button'))+
  row('How sure are you?','Answer with <b>Sure</b> or <b>Not sure</b> instead of Check answer. A right guess comes back like a lucky guess; a wrong answer you were sure of comes back sooner and is marked in Needs work. Confident mistakes are the ones you fix best once you see the answer.',sw(state.prefs.sure,"setPref('sure',"+!state.prefs.sure+")",'How sure are you'))+
  row('Why did I miss it?','After a wrong answer, tap why: didn&#39;t know, mixed it up, misread or careless. The dashboard shows what trips you up most and lets you practice your mix-ups.',sw(missOn(),"setPref('missTags',"+!missOn()+")",'Why did I miss it'))+
  (NOTES_PARSED.length?row('Blurt','On the Notes page: write everything you remember about a '+unitW+' with the notes hidden, then check it against the notes. Recalling from a blank page is the strongest kind of practice.',sw(state.prefs.blurt,"setPref('blurt',"+!state.prefs.blurt+")",'Blurt')):'')+
  row('Star '+ITEMS,'Flag tricky '+ITEMS+' with the star or the S key, then review them together, even after they are mastered.',sw(state.prefs.stars,"setPref('stars',"+!state.prefs.stars+")",'Star '+ITEMS))+
  row('Missed '+ITEMS+' drill','A sidebar list and a dashboard button that drill only the '+ITEMS+' you got wrong or checked in your slides, until they are mastered.',sw(state.prefs.missed,"setPref('missed',"+!state.prefs.missed+")",'Missed '+ITEMS+' drill'))+
  row('Spaced review','Mastered '+ITEMS+' come back as Due for review after 1, 3, 7, 14 and 30 days (sooner when a test is coming up), so they stick until the exam. Missing one sends it back to practice.',sw(state.prefs.srs,"setPref('srs',"+!state.prefs.srs+")",'Spaced review'))+
  row('Flag button',contribOn()?'A flag next to the star reports a typo or a wrong answer key to the moderator (or copies it for your group chat).':'A flag next to the star copies the '+ITEM+', its ID and the answer key, so you can paste it in your group chat to point out a typo or a wrong answer.',sw(state.prefs.flag,"setPref('flag',"+!state.prefs.flag+")",'Flag button'))+
  (cloudOn()?row('Class stats','A Class stats panel on the dashboard, a sidebar list of the '+CLASS_TOP+' '+ITEMS+' your class misses most, and how many classmates missed each '+ITEM+' after you answer it. Updates every 30 minutes.',sw(state.prefs.classmiss,"setPref('classmiss',"+!state.prefs.classmiss+")",'Class most missed')):'')+
  '</section>';
 h+='<section class="panel"><h2>Pages</h2>'+
  (CONFIG.cards&&!NOTES_ONLY?row('Flashcards','Ready-made cards from the notes: flip, then tell it if you knew it. Each card comes back just before you would forget it.',sw(state.prefs.cards!==false,"setPref('cards',"+(state.prefs.cards===false)+")",'Show the Flashcards page')):'')+
  (NOTES_DATA?row('Notes','High-yield recognition notes to read before a mock exam, with a self-test mode.',sw(state.prefs.notes,"setPref('notes',"+!state.prefs.notes+")",'Show the Notes page')):'')+
  (MSETS.length||MIXUP.length?row('Drills',[MSETS.length?MSETS.length+' matching-type sets':'',MIXUP.length?MIXUP.length+' Don\'t mix up look-alike drills':''].filter(Boolean).join(' and ')+'.',sw(state.prefs.matching,"setPref('matching',"+!state.prefs.matching+")",'Show the Drills page')):'')+
  (window.Notify&&CONFIG.home?row('Notifications','Choose what you hear about: new courses and content, transes, timetable changes, comment pop-ups, red dots, and push notifications on this device.','<a class="btn" href="notifications.html#settings">Open settings</a>'):'')+
  (dnOn()&&!window.Notify?row('Reply and mention pop-ups','A small pop-up in '+esc(CONFIG.title)+' when someone replies to you, @mentions you, or a moderator posts (never during a mock exam).',sw(state.prefs.dpop!==false,"setPref('dpop',"+(state.prefs.dpop===false)+")",'New comment pop-ups'))+
   row('Unread dots','A red dot on Discussion for replies to you, @mentions and moderator posts; a small gray dot for other new comments.'+(dnUnread()?' <button class="link" onclick="dnRead();draw()">Mark all as read</button>':''),sw(state.prefs.ddot!==false,"setPref('ddot',"+(state.prefs.ddot===false)+");dnPaint()",'Unread dots')):'')+
  (BANK.some(c=>c.dh)?row('Harder choices in practice','The Mock exam always uses look-alike choices, like the real test (e.g. every option about boy/girl and mother/father). Turn this on to get them in practice too.',sw(!!state.prefs.hardPractice,"setPref('hardPractice',"+!state.prefs.hardPractice+")",'Harder choices in practice')):'')+
  (CHART_DATA.length?row('Charts','A Charts button on Practice, Notes and the Mock exam that opens the reference '+(CHART_DATA.length>1?'charts':'chart')+' ('+CHART_DATA.map(c=>c.title.toLowerCase()).join(', ')+').',sw(state.prefs.charts,"setPref('charts',"+!state.prefs.charts+")",'Show the Charts button')):'')+
  row('Mock exam','A timed run with no hints or answers until the end, then your score by '+unitW+' and a review of your mistakes.',sw(state.prefs.exam,"setPref('exam',"+!state.prefs.exam+")",'Show the Mock exam page'))+'</section>';
 if(pageOn('cards'))h+='<section class="panel"><h2>Flashcards</h2>'+
  row('Grade buttons',state.prefs.fcFour?'Again, Hard, Good and Easy, like Anki.':'Again or Good: quick on a phone. Turn on four buttons for Hard and Easy too.',segHTML("fcPref('fcFour')",[[false,'2 buttons'],[true,'4 buttons']],!!state.prefs.fcFour,'Grade buttons'))+
  row('How much to remember','The share of cards you should still know when each one comes back. Higher means more reviews a day.',segHTML("fcPref('fcRet')",[[.85,'85%'],[.88,'88%'],[.9,'90%'],[.95,'95%']],+state.prefs.fcRet||.88,'Target retention'))+
  row('New cards a day','The most new cards a day in this course.',segHTML("fcPref('fcNew')",[[10,'10'],[20,'20'],[40,'40'],[80,'80']],+state.prefs.fcNew||40,'New cards a day'))+
  row('Reviews a day','The most review cards a day in this course; the rest wait for the next day, the most-forgotten first.',segHTML("fcPref('fcRev')",[[100,'100'],[150,'150'],[300,'300']],+state.prefs.fcRev||150,'Reviews a day'))+
  row('Exam pacing',state.prefs.fcExam!==false?'On: before a deck\'s eval, new cards are spread so you see them all about 2 days before it, and every card comes back before the eval.':'Off: new cards follow the daily limit only, and intervals ignore the eval date.',sw(state.prefs.fcExam!==false,"setPref('fcExam',"+(state.prefs.fcExam===false)+")",'Exam pacing'))+
  row('Easy day','Fewer reviews land on this day; the other days take a little more.',segHTML("fcPref('fcEasy')",[[-1,'None'],[6,'Saturday'],[0,'Sunday']],state.prefs.fcEasy==null?-1:+state.prefs.fcEasy,'Easy day'))+'</section>';
 h+='<section class="panel"><h2>Question banks</h2><p class="desc">Main is the full reviewer. Each extra bank is its own question set with its own progress. Sets you add are saved in this browser only; Export one to share it.</p>'+
  BANKS.map(b=>row(esc(b.name)+'<span class="pill set">'+bankItems(b).length+' '+ITEMS+'</span>',esc(b.desc||''),(b.user?'<button class="btn sm" onclick="openSetEditor(\''+b.id+'\')">Edit</button><button class="btn sm" onclick="exportSet(\''+b.id+'\')">Export</button>':'')+(b.id===state.bank?'<span class="pill">In use</span>':'<button class="btn sm" onclick="setBank(\''+b.id+'\')">Use</button>'))).join('')+
  row('Add a question set','Paste questions or upload a .txt or .csv file, like a set a classmate exported or one your group wrote in Google Sheets.','<button class="btn sm" onclick="openSetEditor()">Add a set</button>')+'</section>';
 h+='<section class="panel"><h2>Appearance and you</h2>'+
  row('Theme','System follows your device setting.',segHTML('setThemeMode',[['system','System'],['light','Light'],['dark','Dark']],themeMode(),'Theme'))+
  row('Colors','Classic indigo, the APMed \'33 palette, or a popular theme. Each has a light and a dark version that follows Dark mode. Applies to every course and the home page on this device.',palHTML(document.documentElement.dataset.palette||'classic')).replace('class="prow"','class="prow stack"')+(CONFIG.home?row('Welcome animation','Play the intro on the home page again.','<button class="btn sm" onclick="replayIntro()">Replay</button>'):'')+
  row('Your name','Used to greet you on the dashboard. Saved only in this browser.','<input class="txt" id="pname" maxlength="40" placeholder="Your name" aria-label="Your name" autocomplete="given-name" value="'+esc(state.name||'')+'" onchange="setName(this.value)">')+'</section>';
 h+='<section class="panel"><h2>Your data</h2>'+syncRowHTML(row)+
  (cloudOn()?row('Share anonymous answer stats','Sends only which '+ITEMS+' were answered right or wrong, with no name and no device ID, so the class can see its most missed '+ITEMS+'. It also adds you to the class\'s "studying now" number (a random code for this device, kept 1 hour, never a name).',sw(state.prefs.crowd,"setPref('crowd',"+!state.prefs.crowd+")",'Share anonymous answer stats')):'')+
  (()=>{const u=storageUse();return row('Storage on this device','This course uses '+mbs(u.mine)+'; all courses together '+mbs(u.all)+' of about 5 MB.'+(STORE_FULL?' <b>Full: new answers aren\'t being saved.</b>':''),'<button class="btn sm" onclick="freeUp()">Free up space</button>')})()+
  row('Export progress','Download a backup of your answers as a JSON file.','<button class="btn sm" onclick="exportProgress()">Export</button>')+
  row('Import progress','Load a file you exported, for example to move your answers from the file version to the website or to another browser. It replaces the progress saved here.','<button class="btn sm" onclick="importProgress()">Import</button>')+
  row('Reset progress','Erase every saved answer in this browser. This can\'t be undone.','<button class="btn sm danger" onclick="resetAll()">Reset</button>')+'</section>';
 // Tabs: All, or one section at a time (remembered on this device).
 const parts=h.split('<section class="panel">').filter(Boolean).map(x=>'<section class="panel">'+x),names=parts.map(x=>(x.match(/<h2>(.*?)<\/h2>/)||[])[1]||'');
 let tab='all';try{tab=localStorage.getItem('reviewer_prefs_tab')||'all'}catch(e){}if(!names.includes(tab))tab='all';
 $('prefs').innerHTML=parts.filter((_,i)=>tab==='all'||names[i]===tab).join('')+'<p class="appver">App version '+APP_VERSION+' · '+APP_DATE+((CONFIG.home&&'serviceWorker' in navigator)?' · <button class="link" onclick="getUpdate(this)">Check for updates</button>':'')+'</p>';
 let t=$('ptabs');if(!t){t=document.createElement('div');t.id='ptabs';t.className='fchips ptabs';t.setAttribute('role','tablist');$('prefs').before(t)}
 t.innerHTML=['all'].concat(names).map(n=>'<button class="fchip'+(n===tab?' on':'')+'" role="tab" aria-selected="'+(n===tab)+'" onclick="setPrefTab(\''+esc(n).replace(/'/g,'&#39;')+'\')">'+(n==='all'?'All':esc(n.replace(/ and you$/,'')))+'</button>').join('')}
function setPrefTab(n){try{localStorage.setItem('reviewer_prefs_tab',n)}catch(e){}drawPrefs();window.scrollTo(0,0)}

/* ---------- what's new: changes to how the app works (not to the questions) ---------- */
const CHANGELOG=[
 {v:'103',date:'Oct 31, 2026',title:'Study together',items:[
  'The dashboard shows how many classmates are studying this course right now (just a number, never names).',
  'On the home page, the new Class card shows how many answers the class has sent before the next test, the next milestone, and who is studying now. Start a 25-minute focus timer there; a small chip shows the time left while you study.',
  'Turning off Share anonymous answer stats in Personalize also keeps you out of these counts.']},
 {v:'102',date:'Oct 30, 2026',title:'Quiz box only for quizzes',items:[
  'The box that points to the quiz-style sections now shows only before quizzes, not before exams or evals.']},
 {v:'101',date:'Oct 29, 2026',title:'Clearer problem solving',items:[
  'Problem text is larger, and every part of a written problem shows the <b>whole worked solution</b>: variables, objective, constraints, intercepts, shading, how each corner is solved, and the value at every corner.',
  'Going back to an earlier written answer shows what you wrote, never multiple choice.',
  'Sections built like the real quiz are tagged <b>Like the quiz</b>, and in the days before it a box at the top of the lessons points to them.']},
 {v:'100',date:'Oct 29, 2026',title:'Your own flashcards',items:[
  '<b>My cards:</b> write your own flashcards in Flashcards → My cards. Type {{c1::word}} to make a fill-in-the-blank card.',
  'After a wrong answer in Practice, tap <b>+ Flashcard</b> to turn that question into a card.',
  'Share a good card with the class: <b>Suggest to class</b> sends it to the moderator, and approved cards join everyone\'s deck.',
  'Cards you keep missing get a note with <b>Explain it differently</b>, a link to the notes, and <b>Suspend</b> to set them aside.',
  'Diagram cards: some cards hide a label on a picture; say what is under the box, then flip.']},
 {v:'99',date:'Oct 29, 2026',title:'Flashcards: exam pacing, cram and stats',items:[
  '<b>Exam pacing:</b> before an eval, new cards are spread over the days left so you see every card about 2 days before it, and each card comes back before the eval.',
  'Reviews are spread evenly across days, and after a break the most-forgotten cards come first instead of a pile of hundreds.',
  '<b>Cram</b> runs through the whole deck, weakest cards first, without changing your schedule. <b>Stats</b> shows how ready you are for the eval and your last 30 days.',
  'New in Personalize → Flashcards: Exam pacing and an Easy day.']},
 {v:'98',date:'Oct 29, 2026',title:'Flashcards',items:[
  'A new <b>Flashcards</b> page in each course, with cards made from the notes. It starts with the deck for your next exam.',
  'Flip a card, then tap <b>Again</b> or <b>Good</b> (or swipe left or right). Each card comes back just before you would forget it.',
  'Up to 40 new cards and 150 reviews a day. Change the limits, or turn on Hard and Easy buttons, in Personalize → Flashcards.',
  'Your cards sync across devices when you are signed in.']},
 {v:'97',date:'Oct 29, 2026',title:'Replies and @mentions',items:[
  'Tap <b>Reply</b> under a post in the discussion: your post shows a quote of the one you answered.',
  'Type <b>@</b> to tag a classmate. They get a notification, and the post is highlighted for them.',
  'The red dot and the pop-up are now only for <b>replies to you</b>, <b>@mentions</b> and <b>moderator posts</b>. Other new comments show a small gray dot, so you aren\u2019t pinged for every message.']},
 {v:'96',date:'Oct 29, 2026',title:'Missed a class?',items:[
  'Open <b>My attendance</b> after a day you missed (Absent or Excused): the class secretary\'s summary of that day is right there, with deadlines, exam hints and what the teacher stressed.',
  'You can ask the class secretary up to 5 questions about that day, on the day and the 2 days after. Only the two of you see the chat, and it\'s deleted after that.',
  'Turn on <b>Attendance alerts</b> on that page to get a notification when the summary is posted or you get a reply.',
  '<b>What happened in class</b> (a tab on My attendance) lists every class-day summary, for every linked classmate.']},
 {v:'95',date:'Oct 29, 2026',title:'Your profile',items:[
  'Pick a <b>display name</b> and a <b>picture</b> for the discussion: tap your picture at the top of the home page, then <b>Edit</b>. Classmates who tap your name can still see your Google account name.',
  'The home page shows just your picture on phones, so the top bar is less crowded. Your account menu also has quick links to attendance, notifications and privacy.',
  'If your sign-in ends on a device, the home page now says so and offers <b>Sign in again</b>, instead of quietly hiding My attendance. A dropped connection no longer signs you out.']},
 {v:'94',date:'Oct 28, 2026',title:'Why did I miss it?',items:[
  'After a wrong answer, tap <b>why</b> you missed it: <b>Didn&#39;t know</b>, <b>Mixed it up</b>, <b>Misread</b> or <b>Careless</b>. One tap, and you can skip it.',
  'The dashboard then shows <b>Why you miss</b>: what trips you up most, a tip for it, and your mix-ups side by side with a <b>Practice your mix-ups</b> round. Turn it off in Personalize.',
  '<b>Explain it differently</b> now builds on the same &quot;Why not your choice&quot; line you see, so the AI and the notes agree.']},
 {v:'93',date:'Oct 28, 2026',title:'Daily crossword',items:[
  'New on the home page: a <b>Daily crossword</b>. Every day there is one short puzzle mixing the courses with the nearest evals (until Nov 4: Psychology and Botany, with a tag on each clue). Tap a square and type; <b>Hints</b> can check or reveal letters. Your streak counts the days you solve it.']},
 {v:'92',date:'Oct 28, 2026',title:'Tidier color picker',items:[
  'The <b>Colors</b> picker is now an even grid of equal tiles instead of ragged pills, on the home page and in Personalize.']},
 {v:'91',date:'Oct 28, 2026',title:'Mix look-alikes and a slide viewer',items:[
  'On <b>Drills → Don&#39;t mix up</b> there is now a <b>Practice mixed look-alikes</b> button: a short round that switches between the look-alikes in turn, so you have to tell them apart. It does not change your mastery.',
  'Slides now open as a real <b>slide viewer</b>: one slide at a time, swipe or arrow keys, pinch to zoom, a strip of all slides, full screen on laptops, and it remembers where you stopped. <b>Read</b> in the viewer opens the same file as pages you can search.']},
 {v:'90',date:'Oct 28, 2026',title:'Ocean, Lavender and Coffee colors',items:[
  'Three new color themes: <b>Ocean</b> (blue), <b>Lavender</b> (purple) and <b>Coffee</b> (warm brown). Each has a light and a dark version.',
  'You can now pick colors on the <b>home page</b> too, under the course list. It applies to every course on this device.']},
 ...(FULL_BANK.some(c=>c.type==='self')?[{v:'36',date:'Oct 25, 2026',title:'Written quiz practice',items:[
  'For written quizzes: <b>type the name</b> of a structure (checked strictly: every number counts), and <b>draw, predict products or explain</b> on paper, then show the answer and mark yourself.',
  'A <b>Mock quiz (written)</b> preset: true or false, identification and naming, drawing and reactions, then an essay. Written answers are checked on the results page.',
 ]}]:[]),
 {v:'35',date:'Oct 24, 2026',title:'Learn from your wrong answers',items:[
  ...(FULL_BANK.some(c=>c.dw)?['<b>Why not your choice</b>: after a wrong answer, a line says why the choice you picked is wrong (also in the mock exam review).']:[]),
  'Optional, in Personalize: <b>How sure are you?</b> Answer with Sure or Not sure. Wrong answers you were sure of come back sooner and go first in Needs work.',
  ...(NOTES_PARSED.length?['<b>Blurt</b> on the Notes page (turn it off in Personalize). Write all you remember about a '+unitW+', then see which key points you missed.']:[]),
 ]},
 ...(CONFIG.home?[{v:'34',date:'Oct 24, 2026',title:'Daily goal, last look and live quiz',items:[
  '<b>Last look</b>: the night before a test, one page with the '+ITEMS+' you missed most and their answers. Hide the answers to test yourself, or print it. In the menu, and on your dashboard when a test is near.',
  'A <b>daily goal</b> and <b>streak</b>: every answer in any course counts. Track it on the home page and in <b>Today</b> on your dashboard.',
  '<b>Live quiz</b>: host a quiz for your study group from this course, and everyone joins on their phone with a code. Find it in the menu.',
 ]}]:[]),
 {v:'33',date:'Oct 24, 2026',title:'Smarter practice',items:[
  'A question you miss now comes back after a few others, while the explanation is still fresh, instead of at the end of the section.',
  ...(BANK.some(c=>c.case)?['Problems with parts go <b>part by part</b>, and your earlier parts stay on the card as an answer key.']:[]),
  'Your next quiz or exam comes from the <b>timetable</b>, and reviews of what you mastered are timed to land before it.',
  'Right answers in a <b>mock exam</b> now count toward mastery. Want a stricter "mastered"? <b>Personalize → Stricter mastery</b>.',
  'The phone\'s <b>Back</b> button goes to the previous page instead of leaving the course. Courses open instantly from your phone, and an <b>Update ready</b> banner appears when there\'s something new.']},
 {v:'32',date:'Oct 21, 2026',title:'Notifications page',items:[
  'A new <b>Notifications</b> page (bell on the home page, and in the sidebar of every course) lists what\'s new: courses, questions, transes, timetable changes and site updates.',
  'Something new for the course you have open shows once as a pop-up. Choose what you hear about in <b>Notifications → Settings</b>.']},
 {v:'31',date:'Oct 21, 2026',title:'Comment notifications',items:[
  'When a classmate comments in the course you have open, a small <b>pop-up</b> shows who and where, with a button to open it (not during a mock exam).',
  'A <b>red dot</b> on Discussion and on “Discuss this question” counts comments you have not opened yet.',
  'Both can be turned off in <b>Personalize</b>. Also new: confirmations (like discarding an exam) now appear inside the page instead of the browser\'s pop-up box.']},
 {v:'30',date:'Oct 21, 2026',title:'Practice again',items:[
  'After a section or '+unitW+' is complete, <b>Practice again</b> lets you pick how many questions to redo. A whole '+unitW+' is split evenly across its sections.',
  'It never changes your mastery, Missed '+ITEMS+' or review schedule, so you can practice as much as you like.']},
 {v:'29',date:'Oct 20, 2026',title:'Matching type in the Mock exam',items:[
  'The Mock exam can now include a <b>matching</b> part after the multiple choice: groups of items that share options A–E, each usable more than once, shaded on the same answer sheet.',
  'Psychology has presets for the real format: <b>60 items, 30 multiple choice + 30 matching</b>, on an answer sheet.']},
 {v:'28',date:'Oct 20, 2026',title:'Harder or easier mock exams',items:[
  'Mock exam setup has a new <b>Difficulty</b> switch. <b>Harder</b> asks questions the way the real test does: longer, with a case or a description to read instead of just “What is X?”, plus look-alike choices. <b>Easier</b> uses the same questions as practice.',
  'Practice itself is unchanged.']},
 {v:'27',date:'Oct 20, 2026',title:'Predicted grade',items:[
  'Mock exam results now show a big <b>Passed</b> or <b>Not passed</b> and your <b>predicted transmuted grade</b>: 75 + (score% − 60) × 25 ÷ 40, as in the student handbook: 60% right = 75 (passing), 100% = 100, 0% = 37.5. It also tells you how many more right you needed, or how far you cleared it. Recent exams show it too.']},
 {v:'26',date:'Oct 19, 2026',title:'Round two is different',items:[
  'With the recall goal at <b>2×</b>, the second time you see a question it is asked differently: “What is X?” questions flip (you get the definition and pick the term), and questions with look-alike choices use them. Round one stays as written.']},
 {v:'25',date:'Oct 19, 2026',title:'Harder mock exams',items:[
  'The <b>Mock exam</b> now uses <b>look-alike choices</b> where a course has them, like the real test: every option shares the same pieces with one swapped (boy/girl, mother/father, first/second stage). Practice keeps the easier choices while you learn.',
  'Want the hard ones in practice too? <b>Personalize → Harder choices in practice</b>.']},
 {v:'24',date:'Oct 19, 2026',title:'Mock exam like the real one',items:[
  '<b>Equal split:</b> in <b>Mock exam</b>, choose <b>Split → Equal per '+unitW+'</b> to get the same number from each '+unitW+', grouped like the real test (80 items = 20 per '+unitW+' with 4 '+unitsW+'). Pick any number with <b>Questions → Custom</b>.',
  '<b>Paperless format:</b> one question at a time, no topic labels, and no results until you submit, like the digital exam.',
  '<b>VSA:</b> add identification items at the end, where you type the answer instead of choosing.',
  '<b>Presets</b> set everything up in one tap'+(CONFIG.examPresets?': '+CONFIG.examPresets.map(p=>p.label).join(', '):'')+'.']},
 {v:'23',date:'Oct 19, 2026',title:'Cram mode and Beat my score',items:[
  '<b>Short on time?</b> Tap <b>Cram mode</b> on the dashboard (or in the menu): about 45 of the highest-yield '+ITEMS+': what the class misses most, what you missed, and one key '+ITEM+' from every section.',
  'Challenge links now carry your score. When a classmate opens yours, they see what you got and find out at the end if they beat it. Make one in <b>Mock exam → Challenge</b>, then <b>Copy my score</b>.']},
 {v:'22',date:'Oct 18, 2026',title:'APMed \'33 colors',items:[
  'A new <b>APMed \'33</b> color palette (cream, teal and mustard, from the batch\'s logo). Turn it on in <b>Personalize → Appearance → Colors</b>. It works in light and dark mode and applies to every course.']},
 {v:'21',date:'Oct 18, 2026',title:'Less clutter',items:[
  '<b>Personalize</b> has tabs (Practice, Study tools, Pages, and so on), so you can open just the settings you need. <b>All</b> still shows everything.',
  'With many '+unitsW+', the '+unitW+' filters on <b>Notes</b> and <b>Drills</b> are short numbers. Hover or long-press one to see its name.']},
 {v:'20',date:'Oct 18, 2026',title:'Tidier sidebar and What\'s new',items:[
  'In the sidebar, opening a '+unitW+' closes the others, and the theme switch and What\'s new <b>stay in view</b> at the bottom.',
  'After a wrong answer, <b>Review the '+unitW+' notes</b> takes you to the notes for that '+unitW+'.',
  '<b>What\'s new</b> now shows only what changed since your last look, with an <b>X</b> to close it. Older changes are one tap away.']},
 ...(contribOn()?[{v:'19',date:'Oct 17, 2026',title:'Suggest questions',items:[
  '<b>Suggest a question</b> (on the dashboard): write a question that could come out, with its answer and wrong choices. A moderator checks every one; approved questions are added for everyone as a <b>Class question</b>, with your name if you give it.',
  '<b>The flag</b> on a question now reports a typo or a wrong answer key straight to the moderator. You can still copy it for the group chat instead.',
  '<b>Your suggestions</b> shows what the moderator decided, and any note they left you.']}]:[]),
 ...(Object.keys(MOLS).length?[{v:'18',date:'Oct 17, 2026',title:'Chemical structures',items:['Questions can show <b>structures</b> (drawn sharp at any size, in light and dark mode), and some answer choices are structures, laid out two by two. They appear in practice, in the mock exam and on the answer sheet.']}]:[]),
 ...(CHART_DATA.length?[{v:'17',date:'Oct 17, 2026',title:'Floating charts',items:['<b>Charts → Float:</b> the chart becomes a window you can drag anywhere (by its top bar) and resize (from the corner), and you can keep answering underneath, even during a mock exam. It remembers where you left it. <b>Dock</b> puts it back.']}]:[]),
 ...(DOCS.length?[{v:'16',date:'Oct 17, 2026',title:'Full transes',items:['<b>Notes → Full transes</b> opens the complete transes (PDF) in a new tab, to read or download.']}]:[]),
 {v:'15',date:'Oct 17, 2026',title:'Answer sheet exams',items:[
  '<b>Mock exam → Format → Answer sheet:</b> like the real exam. The whole test paper is on one page and you shade A–E on a separate answer sheet (every row has A–E, like a printed sheet) (beside the paper on a computer, a slide-up drawer on a phone). Tap a question to find its row; tap a shaded bubble again to erase it.']},
 ...(cloudOn()?[{v:'14',date:'Oct 16, 2026',title:'Smoother sync',items:[
  'Sync now runs when you switch back to the tab or app, so there is no need to reload.',
  'Your devices continue on the <b>same question</b>: whichever you used last decides.',
  'Your <b>settings</b> (recall goal, question order, study tools and the rest) sync too; the most recent change wins. Light or dark theme stays per device.']}]:[]),
 {v:'13',date:'Oct 16, 2026',title:'Fairer mock exams',items:[
  '<b>Custom timer:</b> the Mock exam timer can be Off, 1 minute per question, or any number of minutes you choose.',
  '<b>Skipped questions</b> no longer count as missed: they lower that exam\'s score, but don\'t touch your mastery or your Missed list. Finishing with nothing answered just discards the exam.',
  '<b>Discard</b> (next to Finish exam) throws away an exam you started by accident.',
  'Ready for <b>identification</b> questions mixed with multiple choice: they are answered by typing, in practice and in the mock exam.']},
 ...(cloudOn()?[{v:'12',date:'Oct 16, 2026',title:'Class stats and sync',items:[
  '<b>Class\'s most missed:</b> a sidebar list of the '+CLASS_TOP+' '+ITEMS+' the class gets wrong most, and after each answer how many classmates missed it. It is built from anonymous right/wrong counts (no names); you can stop sharing yours in Personalize.',
  '<b>Sync between devices</b> (Personalize → Your data): turn it on, then type the code on your phone or laptop. Progress from both devices is combined, not overwritten.']}]:[]),
 {v:'11',date:'Oct 16, 2026',title:'Exam scope and review passes',items:[
  '<b>Exam scope:</b> a course can list its tests (quizzes, midterm, finals). Pick one under <b>Studying for</b> in the sidebar and the dashboard, '+unitsW+', notes, drills and the mock exam show only what that test covers. The next test is picked for you.',
  '<b>Review pass</b> replaces "Practice again": every '+ITEM+' once, and you <b>keep your mastery</b> unless you miss one. Missed ones go back into practice. When everything is mastered, the dashboard offers a review pass of all '+unitsW+'.',
  'A <b>lucky guess</b> on an already mastered '+ITEM+' now really sends it back into practice.']},
 {v:'10',date:'Oct 16, 2026',title:'Class challenges and your own sets',items:[
  '<b>Class challenge</b> (Mock exam → Class challenge): a link for your group chat. Everyone who opens it gets the same '+ITEMS+' in the same order. At the end, <b>Copy my score</b> gives your score and a row of 🟩🟥 to paste and compare.',
  '<b>Add a question set</b> (Personalize → Question banks): paste questions or upload a .txt or .csv file (Google Sheets works). It gets its own tab with its own progress, and <b>Export</b> saves it as a file classmates can add.',
  '<b>Flag a question:</b> the flag next to the star (or the F key) copies the '+ITEM+' with its ID and answer key, so you can paste it in the group chat and say what looks wrong.']},
 {v:'9',date:'Oct 16, 2026',title:'Optional topics',items:[
  'A course can mark topics as <b>optional</b>, for example ones that are not in the current exam. They stay hidden until you switch them on in <b>Personalize</b>, together with their notes and drills.']},
 {v:'8',date:'Oct 16, 2026',title:'Reference charts',items:[
  'Courses with reference charts (like a consonant or vowel chart) now have a <b>Charts</b> button on Practice, Notes and the Mock exam, the way the real exam hands you the table.',
  'New question styles: <b>Odd one out</b>, <b>Phonetic spelling</b> and <b>Best answer</b>.']},
 {v:'7',date:'Oct 15, 2026',title:'Exam prep',items:[
  '<b>Mock exam</b> page: choose how many '+ITEMS+' and which '+unitsW+', with an optional timer. No hints or answers until the end, then your score by '+unitW+' and <b>Review my mistakes</b>.',
  '<b>Don\'t mix up</b> drill: one clue and two look-alikes side by side; pick which one it is.',
  '<b>Due for review:</b> mastered '+ITEMS+' come back after 1, 3, 7, 14 and 30 days so they stick. Missing one sends it back to practice.',
  '<b>Type the answer</b> (Personalize → Answer mode): short recall '+ITEMS+' hide the choices so you type the term. Small typos are accepted.',
  'The Matching page is now <b>Drills</b>: Matching sets and Don\'t mix up in one place.']},
 {v:'6',date:'Oct 15, 2026',title:'Website and import',items:[
  '<b>Import progress</b> (Personalize → Your data): bring in answers you exported, for example from the file version to the website or between browsers.',
  'The reviewers can now run as a <b>website</b> with an All courses home screen. It can be added to your phone\'s home screen and works offline once opened.']},
 {v:'5',date:'Oct 15, 2026',title:'Study tools',items:[
  '<b>Missed '+ITEMS+':</b> drill only the '+ITEMS+' you got wrong or checked in your slides, from the sidebar or the dashboard\'s Needs attention panel.',
  '<b>Cross out choices</b> you have ruled out: right-click a choice, tap its ×, or press Shift + its letter.',
  '<b>Lucky guess?</b> After a correct answer, send the '+ITEM+' back into your queue if you were only guessing.',
  '<b>Star</b> tricky '+ITEMS+' (the star or the S key) and review them together, even after they are mastered.',
  '<b>Matching by keyboard:</b> ↑ ↓ or number keys pick an item, A–D answers it, Enter checks.',
  '<b>Notes self-test:</b> Reveal all / Hide all for each '+unitW+', and Space reveals the next answer.',
  'Each tool can be turned off in Personalize. Also: '+unitW+' cards and the section map now fill the width, and the theme choice is shared by all your reviewers.']},
 {v:'4',date:'Oct 14, 2026',title:'Matching inside practice',items:[
  '<b>Mix matching into practice</b> (Personalize): after every 10 or 5 questions, the next card can be a matching set from the '+unitW+' you are practicing. It can be skipped and does not affect mastery.',
  'This <b>What\'s new</b> list. It pops up once whenever something changes; after that it stays under the sidebar link.']},
 {v:'3',date:'Oct 14, 2026',title:'Notes, matching and personalization',items:[
  '<b>Question banks:</b> the High-yield / Complete switch is gone. <b>Main</b> holds every question, and anyone else\'s set (a friend\'s, for example) gets its own tab with its own progress.',
  '<b>Entire '+unitW+':</b> the first item under each '+unitW+' quizzes all of it at once instead of one section at a time.',
  '<b>Recall goal:</b> choose how many correct answers master a question (1× or 2×), on the Practice page or in Personalize.',
  '<b>Random order</b> by default: a new order every pass and reshuffled answer letters, so positions can\'t be memorized. Progress dots are grouped by mastery for the same reason.',
  '<b>Notes</b> page with search and a self-test mode that hides answers until tapped.',
  '<b>Matching</b> page: A–D sets graded per item, with your best score saved.',
  '<b>Personalize</b> page for all settings, including leaving out detail questions, hiding pages, theme, name, export and reset.']},
 {v:'2',date:'Oct 14, 2026',title:'Written questions',items:[
  'Banks can hold <b>written multiple-choice questions</b> with an explanation and a hint, not only generated ones.',
  'Answer choices are reshuffled each time a question comes back.']},
 {v:'1',date:'Oct 13, 2026',title:'Dashboard and redesign',items:[
  'New <b>Dashboard</b>: overall mastery, what to study next, recent answers, most-missed questions and a section map.',
  '<b>All '+unitsW+', shuffled</b> mode, a <b>Back</b> button to review earlier answers, hints and "I checked my slides".',
  'Greeting with <b>your name</b>, '+unitW+' pictures, a logo, and <b>light and dark</b> themes.']}
];
const NEWS_KEY='reviewer_news_seen';
function newsSeen(){let g=0;try{g=+localStorage.getItem(NEWS_KEY)||0}catch(e){}return Math.max(g,+state.seenNews||0)>=+CHANGELOG[0].v}
function drawNewsDot(){$('newsBtn').classList.toggle('dot',!newsSeen())}
const newsRel=r=>'<section class="rel"><h3>'+esc(r.title)+'<span>'+esc(r.date)+'</span></h3><ul>'+r.items.map(i=>'<li>'+i+'</li>').join('')+'</ul></section>';
function newsLast(){let g=0;try{g=+localStorage.getItem(NEWS_KEY)||0}catch(e){}return Math.max(g,+state.seenNews||0)}
// Shows what changed since your last look (at most 3; only the newest on a first visit); older entries fold away.
function openNews(){toggleNav(false);const last=newsLast(),box=$('news').querySelector('.box');
 if(!box.querySelector('.newshead')){const h=document.createElement('div');h.className='newshead';box.insertBefore(h,box.firstChild);h.appendChild($('newsh'));
  h.insertAdjacentHTML('beforeend','<button class="newsx" onclick="closeNews()" aria-label="Close">'+XSVG+'</button>');const intro=box.querySelector('p');if(intro)intro.remove()}
 let n=last?CHANGELOG.filter(r=>+r.v>last).length:1;n=Math.min(3,Math.max(1,n));
 $('newsbody').innerHTML=CHANGELOG.slice(0,n).map(newsRel).join('')+(CHANGELOG.length>n?'<button class="link older" onclick="this.outerHTML=CHANGELOG.slice('+n+').map(newsRel).join(\'\')">Earlier changes ('+(CHANGELOG.length-n)+')</button>':'');
 $('news').hidden=false;ovOpen('news',closeNews);state.seenNews=CHANGELOG[0].v;try{localStorage.setItem(NEWS_KEY,String(Math.max(+CHANGELOG[0].v,+localStorage.getItem(NEWS_KEY)||0)))}catch(e){}save();drawNewsDot();const bx=$('news').querySelector('.box');bx.scrollTop=0;bx.querySelector('.btn').focus({preventScroll:true})}
function closeNews(){$('news').hidden=true;ovClosed('news')}

/* ---------- reference charts ---------- */
// v77: a chart may name its chapters (ch); it's shown only when one of them is in the test you're studying for.
const chartList=()=>{const L=CHART_DATA.filter(c=>!c.ch||[].concat(c.ch).some(inScopeCh));return L.length?L:CHART_DATA};
function chartsOn(){return CHART_DATA.length>0&&state.prefs.charts}
function drawCharts(){const CL=chartList();if(chartTab>=CL.length)chartTab=0;$('chtabs').hidden=CL.length<2;
 $('chtabs').innerHTML=CL.map((c,i)=>'<button role="tab" aria-selected="'+(i===chartTab)+'" class="'+(i===chartTab?'on':'')+'" onclick="chartTab='+i+';drawCharts()">'+esc(c.title)+'</button>').join('');
 $('chbody').innerHTML=CL[chartTab].html;$('chh').textContent=CL.length<2?CL[0].title:'Charts'}
function openCharts(){if(!CHART_DATA.length)return;drawCharts();cwApply();$('charts').hidden=false;ovOpen('charts',closeCharts);if(!(CW&&CW.on))$('charts').querySelector('.close').focus({preventScroll:true})}
/* Floating charts: drag the title bar to move, the corner to resize; the page underneath stays usable.
   Position, size and floating on/off are remembered on this device (shared by all courses). */
const CWKEY='reviewer_chartwin';let CW=null;try{CW=JSON.parse(localStorage.getItem(CWKEY))}catch(e){}
function cwSave(){try{localStorage.setItem(CWKEY,JSON.stringify(CW))}catch(e){}}
function cwDefault(){const m=innerWidth<640,w=m?innerWidth-16:Math.min(560,innerWidth-32),h=Math.min(m?280:380,innerHeight-130);const L=($('main')||document.body).getBoundingClientRect().left;return {x:m?8:Math.max(16,Math.min(L+24,innerWidth-w-20)),y:m?84:innerHeight-h-20,w,h}}
// Keep the title bar reachable: at least 120px of the window stays on screen sideways, and the bar never leaves the top/bottom.
function cwClamp(){CW.w=Math.max(240,Math.min(CW.w,innerWidth-8));CW.h=Math.max(150,Math.min(CW.h,innerHeight-8));CW.x=innerWidth<640?Math.max(4,Math.min(CW.x,innerWidth-CW.w-4)):Math.max(120-CW.w,Math.min(CW.x,innerWidth-120));CW.y=Math.max(0,Math.min(CW.y,innerHeight-48))}
function cwApply(){const b=$('charts').querySelector('.chartbox'),on=!!(CW&&CW.on),p=$('chpin');$('charts').classList.toggle('floating',on);
 p.textContent=on?'Dock':'Float';p.setAttribute('aria-pressed',on);p.title=on?'Back to a normal pop-up':'Float: move and resize the chart, and keep answering underneath';
 if(!on){b.style.left=b.style.top=b.style.width=b.style.height='';return}cwClamp();b.style.left=CW.x+'px';b.style.top=CW.y+'px';b.style.width=CW.w+'px';b.style.height=CW.h+'px'}
function toggleChartFloat(){if(CW&&CW.on)CW.on=false;else{const first=!(CW&&CW.hinted);CW=Object.assign(cwDefault(),CW&&CW.w?{x:CW.x,y:CW.y,w:CW.w,h:CW.h}:{},{on:true,hinted:1});
  if(first)toast('Drag the top bar to move the chart and the corner to resize it. You can keep answering underneath.')}
 cwSave();cwApply();if(!CW.on)$('charts').querySelector('.close').focus({preventScroll:true})}
(function(){let mode=null,sx=0,sy=0,o=null;const head=document.querySelector('#charts .chhead'),grip=$('chgrip');
 const down=(e,m)=>{if(!(CW&&CW.on)||(m==='move'&&e.target.closest('button,input,a')))return;mode=m;sx=e.clientX;sy=e.clientY;o=Object.assign({},CW);try{e.currentTarget.setPointerCapture(e.pointerId)}catch(x){}e.preventDefault()};
 const move=e=>{if(!mode)return;const dx=e.clientX-sx,dy=e.clientY-sy;if(mode==='move'){CW.x=o.x+dx;CW.y=o.y+dy}else{CW.w=o.w+dx;CW.h=o.h+dy}cwApply()};
 const up=()=>{if(mode){mode=null;cwSave()}};
 head.addEventListener('pointerdown',e=>down(e,'move'));grip.addEventListener('pointerdown',e=>down(e,'size'));
 for(const el of [head,grip]){el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)}
 addEventListener('resize',()=>{if(CW&&CW.on&&!$('charts').hidden)cwApply()})})();
function closeCharts(){$('charts').hidden=true;ovClosed('charts')}

/* ---------- tooltip ---------- */
(function(){const tip=$('tip');let cur=null;
 function show(el,x,y){cur=el;tip.innerHTML=esc(el.dataset.tip).replace(/&lt;(\/?)b&gt;/g,'<$1b>');tip.classList.add('on');place(x,y)}
 function place(x,y){const r=tip.getBoundingClientRect();let L=Math.min(Math.max(8,x-r.width/2),innerWidth-r.width-8),T=y-r.height-12;if(T<8)T=y+18;tip.style.left=L+'px';tip.style.top=T+'px'}
 function hide(){cur=null;tip.classList.remove('on')}
 document.addEventListener('pointerover',e=>{const el=e.target.closest('[data-tip]');if(el)show(el,e.clientX,e.clientY);else if(cur)hide()});
 document.addEventListener('pointermove',e=>{if(cur)place(e.clientX,e.clientY)});
 document.addEventListener('focusin',e=>{const el=e.target.closest('[data-tip]');if(el){const r=el.getBoundingClientRect();show(el,r.left+r.width/2,r.top)}else if(cur)hide()});
 document.addEventListener('scroll',hide,true);
})();

/* ---------- theme ---------- */
function curTheme(){return document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}
// Colors picker: a chip per palette with its swatch (page, accent, second accent)
const PALS=[['classic','Classic',['#f6f4ef','#4f46e5','#7c3aed']],['apmed','APMed \'33',['#f5eedb','#1d7a80','#e3a21a']],['catppuccin','Catppuccin',['#1e1e2e','#cba6f7','#89b4fa']],['tokyo','Tokyo Night',['#1a1b26','#7aa2f7','#bb9af7']],['rosepine','Rosé Pine',['#191724','#ebbcba','#9ccfd8']],['sakura','Sakura',['#fdf2f6','#c2185b','#f48fb1']],['matcha','Matcha',['#f2f5ef','#2d6a4f','#85d1a0']],['ocean','Ocean',['#eef5fa','#0a6c9e','#5cc0ef']],['lavender','Lavender',['#f5f2fb','#6b46c1','#b9a2f5']],['coffee','Coffee',['#f6f0e8','#8a4b22','#e0a574']]];
function palHTML(cur){return '<span class="pals" role="radiogroup" aria-label="Colors">'+PALS.map(([v,t,c])=>'<button role="radio" aria-checked="'+(v===cur)+'" class="'+(v===cur?'on':'')+'" onclick="setPalette(\''+v+'\')"><i style="background:linear-gradient(135deg,'+c[0]+' 0 50%,'+c[1]+' 50% 75%,'+c[2]+' 75%)"></i>'+t+'</button>').join('')+'</span>'}
function replayIntro(){try{localStorage.removeItem('reviewer_intro_v1')}catch(e){}location.href=CONFIG.home||'./'}
function setPalette(p){if(p==='classic'){delete document.documentElement.dataset.palette;try{localStorage.removeItem('reviewer_palette')}catch(e){}}else{document.documentElement.dataset.palette=p;try{localStorage.setItem('reviewer_palette',p)}catch(e){}}if(page==='prefs')drawPrefs()}
function themeMode(){return document.documentElement.dataset.theme||'system'}
function drawTheme(){const d=curTheme()==='dark';$('themeBtn').innerHTML=(d?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>Light mode':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>Dark mode')}
function setThemeMode(m){if(m==='system'){delete document.documentElement.dataset.theme;try{localStorage.removeItem(THEME_KEY);localStorage.removeItem('psych_theme')}catch(e){}}else{document.documentElement.dataset.theme=m;try{localStorage.setItem(THEME_KEY,m)}catch(e){}}draw()}
function toggleTheme(){setThemeMode(curTheme()==='dark'?'light':'dark')}

/* ---------- actions ---------- */
function answer(l){if(view!=null||state.pmatch||state.feedback||!state.active||state.active.typed)return;state.selected=l;
 if(state.active.struck?.includes(l)){state.active.struck=state.active.struck.filter(x=>x!==l);save();$('card').innerHTML=cardHTML();return}
 save();
 document.querySelectorAll('#card .choice').forEach(b=>{let on=b.dataset.l===l;b.classList.toggle('sel',on)});
 const g=$('go');if(g)g.disabled=false;const g2=$('go2');if(g2)g2.disabled=false}
// Cross out a choice you have ruled out (right-click, the × button, or Shift + letter).
function strike(l){if(view!=null||state.pmatch||state.feedback||!state.active||state.active.typed||!state.prefs.crossout)return;const s=state.active.struck||[];
 state.active.struck=s.includes(l)?s.filter(x=>x!==l):s.concat(l);if(state.selected===l)state.selected=null;save();$('card').innerHTML=cardHTML()}
// Correct, but only a guess: take the mastery point back so the question stays in the queue.
function luckyGuess(){const fb=state.feedback;if(view!=null||!fb||!fb.correct||fb.lucky||!state.active)return;
 if(freeOn()){fb.lucky=true;state.pass.right=Math.max(0,(state.pass.right||0)-1);const l=state.log[state.log.length-1];if(l&&l.fb)l.fb.lucky=true;save();draw();return}
 const k=state.concepts[state.active.cid];if(fb.prev){k.right=fb.prev.right;k.srs=fb.prev.srs}else k.right=Math.max(0,k.right-1);k.lucky=(k.lucky||0)+1;fb.lucky=true;relearn(k);if(k.right>=T())masteryDown(k);if(onPass(state.section)&&!state.pass.miss.includes(state.active.cid))state.pass.miss.push(state.active.cid);
 const last=state.log[state.log.length-1];if(last&&last.fb)last.fb.lucky=true;save();draw()}
function starBtn(cid){if(!state.prefs.stars)return '';const on=!!state.concepts[cid].star;
 return '<button class="starbtn'+(on?' on':'')+'" onclick="toggleStar()" aria-pressed="'+on+'" aria-label="'+(on?'Remove star':'Star this '+ITEM)+'" title="'+(on?'Starred · click to remove':'Star this '+ITEM+' to review it later')+' (S)">'+STAR_SVG+'</button>'}
function toggleStar(){if(view!=null||state.pmatch||!state.active||!state.prefs.stars)return;const k=state.concepts[state.active.cid];k.star=!k.star;save();draw()}
function hint(){if(view!=null||state.pmatch||state.feedback||!state.active||!state.active.hint)return;if(!state.active.usedHint){state.active.usedHint=true;state.hints++;state.concepts[state.active.cid].hints++}save();draw()}
function looked(){if(view!=null||state.pmatch||state.feedback||!state.active)return;record(false,true)}
function submit(conf){if(view!=null||state.pmatch||!state.selected||state.feedback)return;const ok=state.active.choices.find(x=>x.letter===state.selected).correct;
 record(ok,false,sureOn(state.active)?conf||'sure':null);
 if(state.feedback&&state.feedback.sure==='unsure'&&ok)luckyGuess()}
/* v74 "How sure are you?" (Personalize): Sure / Not sure replace Check answer on multiple-choice practice questions.
   Right but not sure = a lucky guess (comes back). Wrong but sure = comes back after 2-3 questions instead of 4-6, and is
   counted (k.sure) so the dashboard's Needs work list puts it first: confident errors are corrected best right after
   feedback (the hypercorrection effect). */
const sureOn=q=>!!state.prefs.sure&&!!q&&!q.typed&&!state.pmatch&&!isSelf(byId[q.cid]);
// Reaching the recall goal schedules the first review in a day; each on-time correct review moves it further out.
function masteryUp(k){const before=k.right,now=Date.now();k.right++;
 if(before<T()&&k.right>=T())k.srs={lvl:0,due:now+srsGap(0)};
 else if(before>=T()&&k.srs&&k.srs.due<=now){k.srs.lvl=Math.min(k.srs.lvl+1,SRS_DAYS.length-1);k.srs.due=now+srsGap(k.srs.lvl)}}
/* ---------- v70: reviews timed to the next test ----------
   Review gaps follow the 1, 3, 7, 14, 30-day ladder but shrink to about a third of the time left before the next test
   (spacing research: the best gap is roughly 20-40% of the time until a test a week away). Reviews already scheduled for
   after the test are spread over the days before it, once per test. The next test is the sooner of the course's exam
   date and, on the website, the course's next quiz, evals or exam on the timetable. */
let NEXT_TEST=null;
function nextTest(){const e=examObj(),now=Date.now(),c=e&&e.date?{name:e.name,at:+new Date(e.date+'T08:00')}:null,a=c&&c.at>now?c:null,b=NEXT_TEST&&NEXT_TEST.at>now?NEXT_TEST:null;return a&&b?(b.at<a.at?b:a):a||b}
function daysToTest(){const t=nextTest();return t?(t.at-Date.now())/DAY:null}
function srsGap(lvl){let d=SRS_DAYS[lvl];const left=daysToTest();if(left!=null&&left>1.5)d=Math.min(d,Math.max(1,Math.round(left*.35)));return d*DAY}
function srsPull(){const t=nextTest();if(!t)return;const left=(t.at-Date.now())/DAY,key=t.name+'|'+t.at;if(left<=1.5||state.srsFor===key)return;let n=0;
 for(const c of BANK){const k=state.concepts[c.id];if(k&&k.srs&&isM(c)&&k.srs.due>t.at){k.srs.due=Date.now()+DAY*(1+(stableHash(c.id+key)%1000)/1000*(left-1.5));n++}}
 state.srsFor=key;save()}
const whenAt=at=>{const t=new Date();t.setHours(0,0,0,0);const d=new Date(at);d.setHours(0,0,0,0);const n=Math.round((d-t)/DAY);return n<0?'':n===0?'today':n===1?'tomorrow':'in '+n+' days'};
// CONFIG.timetable === false: the course's next timetable test isn't covered by the reviewer yet, so it isn't used.
function loadTimetable(){if(CONFIG.timetable===false||!CONFIG.home||!/^https?:$/.test(location.protocol)||!window.Notify)return;
 const add=(src,ok,cb)=>{if(ok())return cb();const el=document.createElement('script');el.src=src;el.onload=cb;el.onerror=()=>{};document.head.appendChild(el)};
 add('schedule-core.js',()=>typeof Sched!=='undefined',()=>add('reminders-core.js',()=>!!window.Remind,()=>{if(typeof Sched==='undefined'||!window.Remind)return;
  Sched.load().then(()=>{const subj=Sched.data.subjects||{},id=courseId(),t=Remind.list(6).find(a=>(subj[a.subject]||{}).course===id);
   NEXT_TEST=t?{name:t.label,at:+t.from}:null;srsPull();if(TEST_SECS.length)setHTML($('nav'),navHTML());if(page==='dashboard')drawDash()}).catch(()=>{})}))}
// Missing a mastered item sends it back to practice: one more correct answer masters it again.
function masteryDown(k){if(k.right>=T()){k.right=T()-1;k.srs=null}else if(state.prefs.strict)k.right=Math.max(0,(k.right||0)-1)}
// v70: a missed question comes back after 4-6 other questions in practice
function relearn(k){k.back=(state.qn||0)+4+Math.floor(Math.random()*3)}

/* ---------- v68 written answers (math) and case problems ---------- */
// wr items are always typed and checked by meaning: objective (max/min + coefficients), constraints (any order, any equivalent
// multiple, x, y >= 0 optional), corner points (any order, fractions ok), optimum (value, and the point if one is given).
const isWr=c=>!!c&&!!c.wr;
const WR_PH={obj:'e.g.  Maximize P = 50x + 40y',cons:'One per line, e.g.\nx + y <= 10\n2x + y <= 16',pts:'e.g.  (0, 0), (8, 0), (6, 4), (0, 10)',opt:'e.g.  P = 460 at (6, 4)'};
const WR_TIP={obj:'Start with Maximize or Minimize.',cons:'One per line. Type <= and >= (or tap ≤ ≥). x, y ≥ 0 is optional here.',pts:'All the corner points, in any order.',opt:'The best value, and where it happens.'};
function wrNum(s){s=String(s).replace(/\s+/g,'');const f=s.match(/^(-?\d*\.?\d+)\/(\d*\.?\d+)$/);return f?(+f[1])/(+f[2]):(s===''?NaN:+s)}
function wrClean(s){return String(s).replace(/[−–—]/g,'-').replace(/[×·*]/g,'').replace(/[₱$]/g,'').replace(/≤|=<|⩽/g,'<=').replace(/≥|=>|⩾/g,'>=')}
function wrLin(s){s=String(s).replace(/\s+/g,'').replace(/(\d),(?=\d{3}(?!\d))/g,'$1');if(!s)return null;const r={x:0,y:0,k:0},ts=s.match(/[+-]?[^+-]+/g);if(!ts||ts.join('')!==s)return null;
 for(const t of ts){const m=t.match(/^([+-]?)(\d*\.?\d*(?:\/\d*\.?\d+)?)([xy]?)$/i);if(!m||(!m[2]&&!m[3]))return null;let v=m[2]===''?1:wrNum(m[2]);if(isNaN(v))return null;if(m[1]==='-')v=-v;if(m[3])r[m[3].toLowerCase()]+=v;else r.k+=v}return r}
function wrIneq(line){const s=wrClean(line),m=s.match(/^(.*?)(<=|>=|<|>|=)(.*)$/);if(!m)return null;const L=wrLin(m[1]),R=wrLin(m[3]);if(!L||!R)return null;
 return [L.x-R.x,L.y-R.y,m[2]==='<'?'<=':m[2]==='>'?'>=':m[2],R.k-L.k]}
// the same constraint up to a nonzero factor (a negative factor flips the inequality)
function wrSame(u,e){const big=[0,1,3].reduce((b,i)=>Math.abs(e[i])>Math.abs(e[b])?i:b,0);if(!e[big]||!u[big])return false;const l=u[big]/e[big];
 if(![0,1,3].every(i=>Math.abs(u[i]-l*e[i])<=1e-6*Math.max(1,Math.abs(u[i]))))return false;return u[2]===(l>0?e[2]:({'<=':'>=','>=':'<=','=':'='})[e[2]])}
const wrNonneg=u=>u[3]===0&&((u[0]>0&&!u[1]&&u[2]==='>=')||(!u[0]&&u[1]>0&&u[2]==='>=')||(u[0]<0&&!u[1]&&u[2]==='<=')||(!u[0]&&u[1]<0&&u[2]==='<='));
// v70: what students write around the math: a label ("Prep: …"), units ("10 hours"), a note in parentheses ("(oven)")
function wrStrip(s){return String(s).replace(/^\s*[a-z][a-z0-9 '’-]{0,30}:\s*/i,'').replace(/\(([^()]*)\)/g,(m,x)=>/\d|(?:^|[^a-z])[xy](?![a-z])/i.test(x)?m:' ').replace(/\b(?![xy]\b)[a-z][a-z'’]+\b/gi,' ')}
// "2 <= x <= 8" is two constraints, and so is "x+y<=10 2x+y<=16" typed on one line
function wrSplit(p){if((p.match(/<=|>=|<|>|=/g)||[]).length<2)return [p];
 const m=p.match(/^\s*(-?[\d.\/]+)\s*(<=|>=|<|>)\s*(.+?)\s*(<=|>=|<|>)\s*(-?[\d.\/]+)\s*$/);if(m)return [m[1]+m[2]+m[3],m[3]+m[4]+m[5]];
 const q=p.replace(/(\d)\s+(?=[-+]?\s*\d*\.?\d*\s*[xy])/gi,'$1\n').split('\n');return q.length>1?q:[p]}
function wrLines(s){return wrClean(s).replace(/\bx\s*,\s*y\s*>=\s*0/gi,'x>=0;y>=0').replace(/\band\b/gi,';').split(/[\n;]+/)
 .flatMap(p=>(p.match(/<=|>=|<|>|=/g)||[]).length>1?p.split(','):[p]).map(p=>wrStrip(p).trim()).filter(Boolean).flatMap(wrSplit).map(p=>p.trim()).filter(Boolean)}
function wrPts(s){const out=[],re=/\(\s*([^(),;]+?)\s*[,;]\s*([^(),;]+?)\s*\)/g;let m;s=wrClean(s);while((m=re.exec(s)))out.push([wrNum(m[1]),wrNum(m[2])]);return out.filter(p=>!isNaN(p[0])&&!isNaN(p[1]))}
const wrNear=(a,b)=>Math.abs(a-b)<=Math.max(.011,Math.abs(b)*.002),wrSamePt=(p,q)=>wrNear(p[0],q[0])&&wrNear(p[1],q[1]);
const wrFmt=v=>Math.abs(v-Math.round(v))<1e-9?String(Math.round(v)):String(Math.round(v*100)/100);
const wrLi=(ok,t)=>'<li class="'+(ok?'y':'n')+'">'+(ok?'✓ ':'✗ ')+t+'</li>';
function wrCheck(input,wr){const s=String(input||''),L=[];let ok=false;
 if(wr.t==='obj'){const t=wrClean(s),sense=/max/i.test(t)?'max':/min/i.test(t)?'min':'';
  const ex=t.includes('=')?t.slice(t.lastIndexOf('=')+1):t.replace(/^\s*(maximi[sz]e|minimi[sz]e|max|min)\s*[a-wz]?\s*:?/i,''),e=wrLin(wrStrip(ex).replace(/:/g,' '));
  const sOK=sense===wr.sense,cOK=!!e&&wrNear(e.x,wr.c[0])&&wrNear(e.y,wr.c[1])&&Math.abs(e.k)<1e-9;ok=sOK&&cOK;
  L.push(wrLi(sOK,sense?(sOK?'Correctly '+(sense==='max'?'maximized':'minimized'):'This one should be '+(wr.sense==='max'?'maximized':'minimized')):'Say whether to maximize or minimize'));
  L.push(wrLi(cOK,e?(cOK?'Coefficients match':'Coefficients don\'t match (got '+wrFmt(e.x)+'x + '+wrFmt(e.y)+'y)'):'Couldn\'t read the expression, e.g. P = 50x + 40y'))}
 else if(wr.t==='cons'){const exp=wr.cons,hit=exp.map(()=>false);let bad=0,non=false;
  for(const line of wrLines(s)){const u=wrIneq(line);if(!u){bad++;L.push(wrLi(false,'Couldn\'t read: '+esc(line)));continue}
   if(wrNonneg(u)){non=true;continue}const i=exp.findIndex((e,j)=>!hit[j]&&wrSame(u,e));if(i>=0){hit[i]=true;L.push(wrLi(true,esc(line)))}else{bad++;L.push(wrLi(false,esc(line)+' isn\'t one of the constraints'))}}
  const miss=hit.filter(h=>!h).length;if(miss)L.push(wrLi(false,miss+' constraint'+(miss>1?'s':'')+' missing'));ok=!miss&&!bad;
  if(ok&&!non)L.push('<li class="tip">On paper, also write x, y ≥ 0.</li>')}
 else if(wr.t==='pts'){const got=wrPts(s),exp=wr.pts,uniq=got.filter((p,i)=>got.findIndex(q=>wrSamePt(p,q))===i);
  const found=exp.filter(e=>uniq.some(p=>wrSamePt(p,e))).length,extra=uniq.filter(p=>!exp.some(e=>wrSamePt(p,e)));ok=found===exp.length&&!extra.length&&uniq.length>0;
  if(!uniq.length)L.push(wrLi(false,'Write points like (6, 4)'));else{L.push(wrLi(found===exp.length,'Found '+found+' of '+exp.length+' corner points'));
   if(extra.length)L.push(wrLi(false,'Not corners: '+extra.map(p=>'('+wrFmt(p[0])+', '+wrFmt(p[1])+')').join(', ')))}}
 else if(wr.t==='opt'){const c=wrClean(s).replace(/(\d),(?=\d{3}(?!\d))/g,'$1'),pts=wrPts(c),mx=c.match(/\bx\s*=\s*(-?\d*\.?\d+(?:\/\d+)?)/i),my=c.match(/\by\s*=\s*(-?\d*\.?\d+(?:\/\d+)?)/i);
  if(!pts.length&&mx&&my)pts.push([wrNum(mx[1]),wrNum(my[1])]);
  // the value: after the last "=" (so "P = 50(6) + 40(4) = 460" reads 460), else the first number that isn't part of the point
  const rest=c.replace(/\([^)]*\)/g,' ').replace(/\b[xy]\s*=\s*-?\d*\.?\d+(?:\/\d+)?/gi,' '),eq=rest.lastIndexOf('='),m=(eq>=0?rest.slice(eq+1):rest).match(/-?\d*\.?\d+(?:\/\d*\.?\d+)?/)||rest.match(/-?\d*\.?\d+(?:\/\d*\.?\d+)?/),v=m?wrNum(m[0]):NaN;
  const vOK=!isNaN(v)&&Math.abs(v-wr.v)<=Math.max(.005,Math.abs(wr.v)*.005),pOK=!pts.length||!wr.pt||wrSamePt(pts[0],wr.pt);ok=vOK&&pOK;
  L.push(wrLi(vOK,isNaN(v)?'Give the value, e.g. P = 460':vOK?'Value is right':'Value isn\'t the '+(wr.sense==='min'?'minimum':'maximum')));
  if(pts.length)L.push(wrLi(pOK,pOK?'Point is right':'Wrong point'));else if(wr.pt)L.push('<li class="tip">Also say where: at ('+wrFmt(wr.pt[0])+', '+wrFmt(wr.pt[1])+').</li>')}
 return {ok,html:'<ul class="wrn">'+L.join('')+'</ul>'}}
function wrKeys(){return '<div class="wrkeys" aria-label="Symbols">'+['≤','≥','(',')',',','/'].map(k=>'<button type="button" onmousedown="event.preventDefault()" onclick="wrIns(\''+k+'\')">'+k+'</button>').join('')+'</div>'}
function wrIns(k){const t=document.querySelector('textarea.wrin, input.wrin');if(!t)return;const a=t.selectionStart??t.value.length,b=t.selectionEnd??a;t.value=t.value.slice(0,a)+k+t.value.slice(b);t.selectionStart=t.selectionEnd=a+k.length;t.focus();t.dispatchEvent(new Event('input'))}
function wrBox(c,id,val,extra){const multi=c.wr.t==='cons'||c.wr.t==='pts';
 return '<div class="typein wr"><textarea id="'+id+'" class="typed wrin" rows="'+(c.wr.t==='cons'?4:2)+'" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="'+esc(WR_PH[c.wr.t])+'" aria-label="Your answer"'+(extra||'')+'>'+esc(val||'')+'</textarea>'+
  '<div class="wrfoot"><span>'+esc(WR_TIP[c.wr.t])+(multi?' Ctrl+Enter checks it.':'')+'</span>'+wrKeys()+'</div></div>'}
// v70: the earlier parts of a problem stay in view: the answer key for each, marked with how you did on it just now
// v101: an earlier written answer saved without its text shows the answer key, never A/B/C
function wrPast(q,fb){const a=(q.choices.find(x=>x.correct)||{}).label||'';return '<div class="typein done wr '+(fb&&fb.correct?'ok':'bad')+'"><span class="yl">Answer</span><b class="wrout">'+ansHTML(a)+'</b></div>'}
const partTitle=p=>p.wr?({obj:'Objective function',cons:'Constraints',pts:'Corner points',opt:'Optimal value'})[p.wr.t]:(String(p.q).match(/·\s*([^.?,(]+)/)||[])[1]||p.term;
function casePrev(cid){const c=byId[cid];if(!c||!c.case||!(c.part>1))return '';const parts=ALL_ITEMS.filter(x=>x.case===c.case&&x.part<c.part).sort((a,b)=>a.part-b.part);if(!parts.length)return '';
 const lastOf=id=>{for(let i=state.log.length-1;i>=0&&i>=state.log.length-12;i--){const e=state.log[i];if(e&&e.q&&e.q.cid===id)return e}return null};
 return '<div class="cprev"><div class="cph">Earlier parts · answer key</div>'+parts.map(p=>{const e=lastOf(p.id),tag=e&&e.fb?(e.fb.correct?'<span class="cpy" aria-label="you got it">✓</span>':'<span class="cpn" aria-label="you missed it">✗</span>'):isM(p)?'<span class="cpm">mastered</span>':'';
  return '<div class="cprow"><span class="cpl">Part '+p.part+' · '+esc(partTitle(p))+tag+'</span><span class="cpa">'+ansHTML(p.a)+'</span></div>'}).join('')+'</div>'}
// in a mock exam: your own earlier answers to the same problem (no answer key)
function caseMine(ex,i){const c=byId[ex.qs[i].cid];if(!c||!c.case||!(c.part>1))return '';const rows=ex.qs.map((x,j)=>({j,p:byId[x.cid]})).filter(o=>o.j!==i&&o.p&&o.p.case===c.case&&o.p.part<c.part).sort((a,b)=>a.p.part-b.p.part);if(!rows.length)return '';
 return '<div class="cprev"><div class="cph">Your earlier parts</div>'+rows.map(o=>'<div class="cprow"><span class="cpl">Part '+o.p.part+' · '+esc(partTitle(o.p))+'</span><span class="cpa mine">'+(ex.ans[o.j]?esc(ex.ans[o.j]):'<i>not answered yet</i>')+'</span></div>').join('')+'</div>'}
const nextPart=cid=>{const c=byId[cid];return !!c&&!!c.case&&poolFor(state.section).some(x=>x.case===c.case&&(x.part||0)>(c.part||0))};
function caseHTML(cid){const c=byId[cid];return c&&c.cstem?'<div class="cstem"><span class="ck">'+esc(c.clabel||'Problem')+'</span>'+stemHTML(c.cstem)+'</div>':''}

// v69 (3) confetti for milestones: a short burst of the theme's colors (skipped with reduced motion)
function celebrate(kind){if(reduceMotion)return;const big=kind!=='section',n=big?90:60,box=document.createElement('div');box.className='confetti';box.setAttribute('aria-hidden','true');
 const cs=['var(--accent)','var(--accent-2)','var(--good)','#f2c14e','#ff8fab','#5ec8e5'];let h='';
 for(let i=0;i<n;i++){const w=6+Math.round(Math.random()*6);h+='<i style="left:'+(Math.random()*100).toFixed(1)+'%;--dx:'+Math.round(Math.random()*180-90)+'px;--r:'+Math.round(Math.random()*900-450)+'deg;width:'+w+'px;height:'+Math.round(w*1.5)+'px;background:'+cs[i%cs.length]+';animation-duration:'+(.95+Math.random()*.7).toFixed(2)+'s;animation-delay:'+(Math.random()*.3).toFixed(2)+'s'+(i%3?'':';border-radius:50%')+'"></i>'}
 box.innerHTML=h;document.body.appendChild(box);setTimeout(()=>box.remove(),2400);
 const t=document.querySelector(kind==='exam'?'.exres':'.done-card');if(t){t.classList.remove('cel');void t.offsetWidth;t.classList.add('cel')}}
// v69 (2) a short vibration on phones that allow it (Android); iPhones ignore it
function buzz(ok){if(reduceMotion||!navigator.vibrate)return;try{navigator.vibrate(ok?12:[16,50,16])}catch(e){}}
/* ---------- type the answer (identification) ---------- */
// Short recall answers only; definitions and long answers keep their choices.
// Identification items ("type":"id") are always typed, in practice and in the mock exam; "alt" lists other accepted answers.
const isIdent=c=>!!c&&c.type==='id';
const isSelf=c=>!!c&&c.type==='self';
/* ---------- v76 written practice (chemistry-style quizzes) ----------
   Names (item.nm): typed names are checked strictly. Case, spaces and the kind of dash don't matter, but every number
   (locant), comma and hyphen must match; a one-letter slip is forgiven only in a long name whose numbers are all right.
   Self-checked items (type 'self'): draw, predict or explain on paper or in the box, show the model answer (item.a, the
   structures in item.afig, the key points in item.pts), then mark it yourself. In a mock exam they're checked on the
   results page, and the score updates as they're marked. */
const nmNorm=s=>String(s||'').toLowerCase().replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,'').replace(/\.$/,'');
function nameOK(input,answers){const t=nmNorm(input);if(!t)return false;const lt=x=>x.replace(/[^a-z]/g,''),nl=x=>x.replace(/[a-z]/g,'');
 return answers.some(a=>{const n=nmNorm(a);return t===n||(nl(t)===nl(n)&&lt(n).length>=8&&dlev(lt(t),lt(n))<=1)})}
function ansOK(val,c,label){if(c&&c.nm)return nameOK(val,[label].concat(c.alt||[]));return typedOK(val,label)||((c||{}).alt||[]).some(x=>typedOK(val,x))||numOK(val,c)}
const ONPAPER='(on paper)';
function afigHTML(c){const ks=[].concat(c&&c.afig||[]);if(!ks.length)return '';
 return '<figure class="qfig'+(ks.length>1?' two':'')+'" role="img" aria-label="Answer structures">'+ks.map((k,i)=>(i?'<span class="figsep">'+esc(c.afigsep||'+')+'</span>':'')+'<span class="mol"'+molW(k)+'>'+(MOLS[k]||'')+'</span>').join('')+'</figure>'}
function ptsHits(c,mine){const pts=c&&c.pts||[];if(!pts.length)return null;const said=new Set(blurtWords(mine||''));return pts.map(p=>({p,ok:!!mine&&blurtHit(p,'',said)}))}
function selfAnsHTML(c,mine){const hits=ptsHits(c,mine);
 return '<div class="selfans"><div class="sah">Answer</div>'+(c.a?'<p class="saa">'+esc(c.a)+'</p>':'')+afigHTML(c)+
  (hits?'<div class="sah">Key points</div><ul class="sapts">'+hits.map(h=>'<li class="'+(h.ok?'ok':'')+'">'+esc(h.p)+'</li>').join('')+'</ul>'+(mine?'<p class="sanote">'+hits.filter(h=>h.ok).length+' of '+hits.length+' key points spotted in what you wrote. That is only a rough check, so judge it yourself.</p>':''):'')+'</div>'}
function selfHTML(q,fb){const c=byId[q.cid],mine=fb?fb.mine:q.mine;
 if(!fb&&!q.shown)return '<div class="typein wr"><textarea id="selfin" class="typed wrin" rows="3" placeholder="'+(c&&c.pts?'Write your answer here':'Work it out on paper (or type it here)')+', then show the answer." aria-label="Your answer" oninput="state.active.mine=this.value">'+esc(q.mine||'')+'</textarea></div>';
 return (mine?'<div class="typein done"><span class="yl">You wrote</span><b class="wrout">'+esc(mine)+'</b></div>':'')+selfAnsHTML(c,mine)}
function selfShow(){const q=state.active;if(view!=null||!q||state.feedback)return;const el=$('selfin');if(el)q.mine=el.value;q.shown=true;save();draw()}
function selfMark(ok){const q=state.active;if(view!=null||!q||state.feedback||!q.shown)return;state.selected=ok?q.choices[0].letter:null;record(ok,false);
 state.feedback.self=1;state.feedback.mine=q.mine||'';const l=state.log[state.log.length-1];if(l)l.fb=state.feedback;save();draw()}
function exPaper(){const ex=state.exam;if(!ex||ex.done)return;ex.ans[ex.i]=ONPAPER;save();drawExam()}
// Marking a written answer on the results page: counts once for mastery and class stats; changing your mind only moves mastery.
function exMark(cid,ok){const ex=state.exam;if(!ex||!ex.done)return;ex.marks=ex.marks||{};const v=ok?1:0,prev=ex.marks[cid];if(prev===v)return;ex.marks[cid]=v;
 const k=state.concepts[cid];if(k){if(prev==null){k.seen++;if(ok)state.correct++;else{k.wrong++;state.wrong++}crowdAdd(cid,!ok,'');state.history.push({cid,correct:!!ok,lookup:false,mode:'EXAM'})}
  if(ok){masteryUp(k);delete k.back}else{masteryDown(k);relearn(k)}}
 let right=0;const byCh={};ex.qs.forEach((q,j)=>{const ch=q.mt?q.ch:chOf(byId[q.cid].section),y=exOK(q,ex.ans[j]);byCh[ch]=byCh[ch]||[0,0];byCh[ch][1]++;if(y){right++;byCh[ch][0]++}});
 ex.right=right;ex.byCh=byCh;const last=(state.exams||[])[(state.exams||[]).length-1];if(last&&last.total===ex.qs.length&&!ex.chal)last.right=right;save();drawExam()}
function canType(q){if(!q||isSelf(byId[q.cid]))return false;if(isWr(byId[q.cid]))return true;if(q.choices.some(x=>isMol(x.label)))return false;if(isIdent(byId[q.cid]))return true;if(!state.prefs.typeMode)return false;if(byId[q.cid]&&byId[q.cid].num!=null)return true;const c=byId[q.cid],ans=(q.choices.find(x=>x.correct)||{}).label||'';
 if(c.q?q.kind!=='recall':q.kind==='definition')return false;return ans.length<=40&&ans.split(/\s+/).length<=5&&!/[,;]| to | and /.test(ans)&&!/^(as|in|by|for|to|of|on|at|with|from|through)\b/i.test(ans)&&(ans.match(/\d+/g)||[]).length<=1}
function normAns(s){return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\(.*?\)/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\b(the|a|an)\b/g,' ').replace(/\s+/g,' ').trim()}
function lev(a,b){let p=Array.from({length:b.length+1},(_,j)=>j);for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[b.length]}
// v70: typed answers. Small slips still count (a letter dropped, doubled, swapped or wrong), but a different real term never
// does: numbers and Roman numerals must match (Article 3 = Article III, but not Section 4 = Section 5), a word that is itself a
// term of this course is not a typo of another one, and neither are opposite prefixes (hyper/hypo, in/ex, un-…).
// Either side of "A / B" or "A or B" is accepted, as before.
let LEXICON=null;
const normNum=s=>normAns(String(s).replace(/(\d)[,\s](?=\d{3}(?!\d))/g,'$1')).replace(/([a-z])(?=\d)/g,'$1 ').replace(/(\d)(?=[a-z])/g,'$1 ');
function lexicon(){if(LEXICON)return LEXICON;const W=new Set(),add=t=>{if(t==null||isMol(t))return;normNum(String(t).replace(/\$[^$]*\$/g,' ')).split(' ').forEach(w=>{if(w)W.add(w)})};
 for(const c of ALL_ITEMS){['q','a','why','hint','term','definition','scenario','xq','cstem'].forEach(f=>add(c[f]));(c.d||[]).forEach(add);(c.dh||[]).forEach(add);(c.alt||[]).forEach(add)}
 (NOTES_DATA||[]).forEach(n=>(n[1]||[]).forEach(g=>{add(g[0]);add(g[1])}));MSETS.forEach(m=>{m.options.forEach(add);m.items.forEach(x=>add(x[0]))});
 MIXUP.forEach(g=>g.members.forEach(m=>{add(m.name);(m.cues||[]).forEach(add)}));return LEXICON=W}
const ROMAN=/^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)$/;
function romanVal(w){const V={i:1,v:5,x:10};let n=0;for(let k=0;k<w.length;k++){const v=V[w[k]];n+=k+1<w.length&&V[w[k+1]]>v?-v:v}return n}
const numTok=w=>/^\d+$/.test(w)?String(+w):ROMAN.test(w)?String(romanVal(w)):/\d/.test(w)?w:null;
const numToks=ws=>ws.map(numTok).filter(x=>x!=null).join(' ');
function pluralEq(x,y){if(x===y)return true;for(const [a,b] of [[x,y],[y,x]])if(a===b+'s'||a===b+'es'||b.endsWith('y')&&a===b.slice(0,-1)+'ies'||b.endsWith('um')&&a===b.slice(0,-2)+'a'||b.endsWith('us')&&a===b.slice(0,-2)+'i')return true;return false}
const NEG=['un','non','in','im','il','ir','dis','de','mis','an','a','anti','counter'];
const PREF=[['hyper','hypo'],['inter','intra'],['endo','exo'],['ana','cata'],['af','ef'],['ab','ad'],['pre','post'],['sub','supra'],['sub','super'],['macro','micro'],['brady','tachy'],['hetero','homo'],['mono','poly'],['uni','multi'],['pro','anti'],['in','ex'],['im','ex'],['poly','oligo']];
function contrast(x,y){for(const n of NEG)if(x===n+y||y===n+x||x.startsWith(n)&&pluralEq(x.slice(n.length),y)||y.startsWith(n)&&pluralEq(y.slice(n.length),x))return true;
 for(const [p,q] of PREF)for(const [a,b] of [[x,y],[y,x]])if(a.startsWith(p)&&b.startsWith(q)&&lev(a.slice(p.length),b.slice(q.length))<=1)return true;return false}
// edit distance where two swapped neighboring letters count as one slip
function dlev(a,b){const d=[];for(let i=0;i<=a.length;i++){d[i]=[i];for(let j=1;j<=b.length;j++)d[i][j]=i?0:j}
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1)}
 return d[a.length][b.length]}
function typedOK(input,answer){const t=normNum(input);if(!t)return false;
 const vs=[answer].concat(String(answer).split(/\s*\/\s*|\s+or\s+/));if(vs.some(v=>normNum(v)===t))return true;
 const tw=t.split(' '),lex=lexicon();
 return vs.some(v=>{const a=normNum(v);if(!a)return false;const aw=a.split(' '),budget=a.length<=4?0:a.length<=8?1:2;
  if(numToks(tw)!==numToks(aw))return false;
  if(tw.length===aw.length){let cost=0;for(let k=0;k<tw.length;k++){const x=tw[k],y=aw[k];if(x===y||pluralEq(x,y)||numTok(x)!=null&&numTok(x)===numTok(y))continue;
    if(lex.has(x)||contrast(x,y))return false;cost+=dlev(x,y);if(cost>budget)return false}return true}
  // a word more or less: only a small slip, and never a meaningful word added or dropped
  if(dlev(t,a)>budget)return false;const ts=new Set(tw),as=new Set(aw),extra=tw.filter(w=>!as.has(w)).concat(aw.filter(w=>!ts.has(w)));
  return !extra.some(w=>/^(not|no|non|un|anti)$/.test(w)||w.length>1&&lex.has(w)&&!(ts.has(w)?aw:tw).some(z=>pluralEq(w,z)||dlev(w,z)<=1))})}
function typedHTML(fb,q){q=q||state.active;const wc=q&&byId[q.cid];
 if(isWr(wc)){if(!fb)return wrBox(wc,'typed','',' onkeydown="if(event.key===\'Enter\'&&(event.ctrlKey||event.metaKey||'+(wc.wr.t==='cons'||wc.wr.t==='pts'?'false':'true')+')){event.preventDefault();submitTyped()}"');
  return '<div class="typein done wr '+(fb.correct?'ok':'bad')+'"><span class="yl">You wrote</span><b class="wrout">'+esc(fb.typed||'')+'</b>'+(fb.override?'<span class="ov">counted as right</span>':'')+(fb.wrnote||'')+'</div>'}
 if(!fb)return '<div class="typein"><input id="typed" class="typed" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type your answer, then press Enter" aria-label="Your answer" onkeydown="if(event.key===\'Enter\'){event.preventDefault();submitTyped()}"></div>';
 return '<div class="typein done '+(fb.correct?'ok':'bad')+'"><span class="yl">You typed</span><b>'+esc(fb.typed||'')+'</b>'+(fb.override?'<span class="ov">counted as right</span>':'')+'</div>'}
function submitTyped(){const q=state.active;if(view!=null||state.pmatch||state.feedback||!q||!q.typed)return;const el=$('typed'),val=(el&&el.value||'').trim();if(!val){if(el)el.focus();return}
 const wrc=byId[q.cid],wres=isWr(wrc)?wrCheck(val,wrc.wr):null,target=q.choices.find(x=>x.correct),ok=wres?wres.ok:ansOK(val,byId[q.cid],target.label);state.selected=ok?target.letter:null;record(ok,false);
 state.feedback.typed=val;state.feedback.correctLabel=target.label;if(wres)state.feedback.wrnote=wres.html;const last=state.log[state.log.length-1];if(last)last.fb=state.feedback;save();draw()}
// A typed answer marked wrong that was really right (a spelling the checker did not accept).
function overrideTyped(){const fb=state.feedback;if(view!=null||!fb||fb.correct||!fb.typed||!state.active)return;
 if(freeOn()){state.wrong=Math.max(0,state.wrong-1);state.correct++;state.pass.right=(state.pass.right||0)+1;fb.correct=true;fb.override=true;const l=state.log[state.log.length-1];if(l)l.fb=fb;save();draw();return}
 const k=state.concepts[state.active.cid];delete k.back;k.wrong=Math.max(0,k.wrong-1);state.wrong=Math.max(0,state.wrong-1);if(fb.prev){k.right=fb.prev.right;k.srs=fb.prev.srs}
 fb.prev={right:k.right,srs:k.srs?{...k.srs}:null};masteryUp(k);state.correct++;fb.correct=true;fb.override=true;if(onPass(state.section))state.pass.miss=state.pass.miss.filter(x=>x!==state.active.cid);
 const h=state.history[state.history.length-1];if(h&&h.cid===state.active.cid)h.correct=true;const kh=k.history[k.history.length-1];if(kh)kh.correct=true;
 const last=state.log[state.log.length-1];if(last)last.fb=fb;save();draw()}

function record(correct,lookup,conf){
 const q=state.active,k=state.concepts[q.cid],lastTry=k&&k.history&&k.history[k.history.length-1],choice=q.choices.find(x=>x.letter===state.selected),target=q.choices.find(x=>x.correct);
 k.seen++;crowdAdd(q.cid,!correct,!correct&&!lookup&&choice&&!q.typed?choice.label:'');if(state.section==='CLASS'){state.classDone=state.classDone||[];if(!state.classDone.includes(q.cid))state.classDone.push(q.cid)}
 if(state.section==='CRAM'){state.cramDone=state.cramDone||[];if(!state.cramDone.includes(q.cid))state.cramDone.push(q.cid)}
 if(onPass(state.section)){const P=state.pass;if(!P.done.includes(q.cid))P.done.push(q.cid);if(!correct&&!P.miss.includes(q.cid))P.miss.push(q.cid)}
 if(state.section==='STAR'){state.starDone=state.starDone||[];if(!state.starDone.includes(q.cid))state.starDone.push(q.cid)}
 if(state.section==='DUE'){state.dueDone=state.dueDone||[];if(!state.dueDone.includes(q.cid))state.dueDone.push(q.cid)}
 const prev={right:k.right,srs:k.srs?{...k.srs}:null};
 const free=freeOn(),c0=byId[q.cid],secAll=c0?BANK.filter(c=>c.section===c0.section):[],chAll=c0?BANK.filter(c=>chOf(c.section)===chOf(c0.section)):[],wasSec=secAll.every(isM),wasCh=chAll.every(isM);if(free&&correct)state.pass.right=(state.pass.right||0)+1;
 state.sinceMix=(state.sinceMix||0)+1;if(free){if(correct)state.correct++;else if(lookup)state.lookups++;else state.wrong++}
 if(!free)state.qn=(state.qn||0)+1;
 const hinted=correct&&!free&&state.prefs.strict&&q.usedHint;   // stricter mastery: right with a hint is practice, not a recall
 if(!free)if(correct){if(!hinted)masteryUp(k);state.correct++;delete k.back}else{if(lookup){k.lookups++;state.lookups++}else{k.wrong++;state.wrong++}masteryDown(k);relearn(k)}
 if(!lookup)buzz(correct);
 if(correct&&!free&&c0&&!wasSec&&secAll.every(isM))setTimeout(()=>celebrate(!wasCh&&chAll.every(isM)?'lesson':'section'),280);
 const own=choice&&!choice.correct&&choice.owner?byId[choice.owner]:null,dw=choice&&!choice.correct?whyNot(q.cid,choice.label):'';
 state.feedback={at:Date.now(),correct,lookup,prev,hinted,correctLabel:target.letter+'. '+target.label,wrongExplain:dw||(own&&own.definition?'“'+own.term+'” refers to '+own.definition.charAt(0).toLowerCase()+own.definition.slice(1)+'.':'')};
 if(conf){state.feedback.sure=conf;if(!correct&&!lookup&&conf==='sure'&&!free){k.sure=(k.sure||0)+1;k.back=(state.qn||0)+2+Math.floor(Math.random()*2)}}
 if(lookup)state.selected=null;
 if(!free){k.history.push({correct,lookup,kind:q.kind});if(k.history.length>5)k.history.splice(0,k.history.length-5)}
 state.history.push({cid:q.cid,correct,lookup,mode:state.section});dailyAdd(1);
 if(correct&&!lookup&&!free&&lastTry&&!lastTry.correct&&!lastTry.lookup)badgeAdd('fixes',1);badgeLevels();
 if(state.history.length>600)state.history=state.history.slice(-600);
 state.log.push({sec:state.section,sel:state.selected,fb:state.feedback,q:{cid:q.cid,kind:q.kind,stem:q.stem,why:q.why===((byId[q.cid]||{}).why||'')?undefined:q.why,choices:q.choices.map(({letter,label,correct})=>({letter,label,correct}))}});
 if(state.log.length>150)state.log=state.log.slice(-150);
 save();draw();
 requestAnimationFrame(()=>{const f=document.querySelector('#card .fb'),r=f?.getBoundingClientRect();if(r&&r.bottom>innerHeight)f.scrollIntoView({block:'nearest',behavior:reduceMotion?'auto':'smooth'})});
}
/* ---------- v94: "Why did I miss it?" (Personalize: missTags, on by default) ----------
   After a wrong answer in practice, one optional tap says why: didn't know, mixed it up (with the choice picked),
   misread, careless. state.missLog = [[question id, tag, answer time, picked label]], the last MISS_MAX, synced and merged
   per answer. The dashboard's "Why you miss" panel sums the last 40 with a tip for the most common reason, lists the
   mix-ups and practices both sides of each (a free round: mastery doesn't change). */
const MISS_TAGS=[['d','Didn\'t know'],['m','Mixed it up'],['r','Misread'],['c','Careless']],MISS_MAX=150;
const missOn=()=>state.prefs.missTags!==false;
function missRowHTML(q,fb){if(!missOn()||fb.correct||fb.lookup||fb.self||!q.cid||!fb.at)return '';
 return '<div class="misstag" role="group" aria-label="Why did you miss it?"><span>Why did you miss it?</span>'+MISS_TAGS.map(([t,l])=>'<button class="mt'+(fb.tag===t?' on':'')+'" aria-pressed="'+(fb.tag===t)+'" onclick="missTag(\''+t+'\')">'+l+'</button>').join('')+'</div>'}
// one tag per answer: another tap changes it, the same tap clears it
function missTag(t){const fb=state.feedback;if(view!=null||!fb||fb.correct||fb.lookup||!state.active||!fb.at)return;
 const cid=state.active.cid,log=state.missLog||(state.missLog=[]),i=log.findIndex(e=>e[0]===cid&&e[2]===fb.at);
 if(fb.tag===t){fb.tag='';if(i>=0)log.splice(i,1)}
 else{fb.tag=t;const ch=state.selected&&(state.active.choices||[]).find(x=>x.letter===state.selected),e=[cid,t,fb.at,t==='m'&&ch&&!ch.correct?String(ch.label):''];
  if(i>=0)log[i]=e;else log.push(e);if(log.length>MISS_MAX)log.splice(0,log.length-MISS_MAX)}
 save();draw()}
const ansOf=c=>String(c&&(c.q?c.a:c.term)||'');
// the mix-ups, newest first: [{cid, a: the right answer, b: what was picked, other: the question whose answer that is}]
function mixups(){const out=[],seen=new Set(),byAns=new Map();BANK.forEach(c=>{const k=ansOf(c).toLowerCase();if(k&&!byAns.has(k))byAns.set(k,c.id)});
 // shown by name: a long answer (a definition) shows its term; a picked definition shows the term it belongs to
 const short=(c,t)=>t.length>40&&c&&c.term?c.term:t.length>60?t.slice(0,57)+'…':t;
 for(const e of (state.missLog||[]).slice().reverse()){if(e[1]!=='m'||!byId[e[0]])continue;const c=byId[e[0]],b=e[3]||'',o=byAns.get(b.toLowerCase()),other=o&&o!==e[0]?o:null;
  const as=short(c,ansOf(c)),bs=b?short(other&&byId[other],b):'',key=(as+'|'+bs).toLowerCase();if(seen.has(key))continue;seen.add(key);
  out.push({cid:e[0],a:as,b:bs,other})}
 return out}
function mixupIds(){const ids=[];for(const m of mixups())for(const id of [m.cid,m.other])if(id&&!ids.includes(id)&&ids.length<20)ids.push(id);return ids}
function mixupStart(){const ids=mixupIds();if(ids.length)freeRound(shuffle(ids,rnd()))}
function missBadge(cid){if(!missOn())return '';const e=(state.missLog||[]).filter(x=>x[0]===cid).pop();return e?'<b class="mtw">'+esc(MISS_TAGS.find(t=>t[0]===e[1])[1])+'</b> ':''}
function drawMissPanel(){const el=$('missPanel');if(!el)return;const last=(state.missLog||[]).filter(e=>byId[e[0]]).slice(-40);
 el.hidden=!missOn()||last.length<3;if(el.hidden)return;
 const n={d:0,m:0,r:0,c:0};last.forEach(e=>{if(e[1]in n)n[e[1]]++});const top=MISS_TAGS.map(t=>t[0]).sort((a,b)=>n[b]-n[a])[0];
 const TIP={d:'Most of your misses are things you hadn\'t learned yet. Read the notes for those sections first, then practice them.',
  m:'Most of your misses are mix-ups. Practice them side by side below, and look for the one detail that tells each pair apart.',
  r:'Most of your misses come from misreading. Read the whole question before the choices, and watch for NOT, EXCEPT and the exact term asked.',
  c:'Most of your misses are slips. Slow down a little: cross out the choices you rule out, or turn on "How sure are you?" in Personalize.'};
 const mx=mixups(),ids=mixupIds();
 el.innerHTML='<h2>Why you miss<em>last '+last.length+' tagged</em></h2><p class="desc">From your "Why did you miss it?" taps after wrong answers.</p><div class="bars">'+
  MISS_TAGS.map(([t,l])=>{const p=Math.round(100*n[t]/last.length);return '<div class="bar-row"><span class="n">'+l+'</span><span class="p">'+n[t]+' · '+p+'%</span><span class="track"><span class="fill" style="display:block;width:'+p+'%"></span></span></div>'}).join('')+'</div>'+
  '<p class="desc misstip">'+TIP[top]+'</p>'+
  (mx.some(m=>m.b)?'<h3 class="csub">Your mix-ups</h3><ul class="mixups">'+mx.filter(m=>m.b).slice(0,6).map(m=>'<li><b>'+labelHTML(m.a)+'</b><span>not</span><b>'+labelHTML(m.b)+'</b></li>').join('')+'</ul>':'')+
  (ids.length?'<button class="btn sm" onclick="mixupStart()" title="A short round of these and the questions they got mixed up with. It does not change your mastery.">Practice your mix-ups ('+ids.length+')</button>':'')}
// v74: authored items may carry dw = {wrong choice: why it's wrong}, shown as "Why not your choice" in practice and the exam review.
function whyNot(cid,label){const c=byId[cid];return c&&c.dw&&c.dw[label]||''}
function next(){if(!state.feedback)return;state.feedback=null;state.active=null;state.selected=null;maybeMix();if(completed(state.section)&&!state.complete.includes(state.section))state.complete.push(state.section);save();draw();scrollToCard()}
function goSection(sec){if(sec===state.section)return;state.section=sec;state.pmatch=null;state.pass=null;state.active=null;state.feedback=null;state.selected=null;view=null;if(!isX(sec))openCh.add(secCh(sec));if(sec==='STAR'&&completed('STAR'))state.starDone=[];if(sec==='CLASS'&&completed('CLASS'))state.classDone=[];if(sec==='CRAM'&&completed('CRAM'))state.cramDone=[];if(sec==='DUE')state.dueDone=[];save();draw();window.scrollTo({top:0,behavior:reduceMotion?'auto':'smooth'})}
function selectSection(sec){toggleNav(false);if(page!=='study'){page='study';state.page=page;if(sec===state.section){save();draw();window.scrollTo(0,0);return}}goSection(sec)}
function stepSection(d){const L=navList(state.section),i=L.indexOf(state.section)+d;if(i>=0&&i<L.length)goSection(L[i])}
function advance(){const L=navList(state.section),i=L.indexOf(state.section);if(!L.length||i===L.length-1){$('modalbody').textContent=completed('ALL')?'You have mastered all '+BANK.length+' '+ITEMS+(examObj()?' for '+examObj().name:' across '+scopeLabel())+'. Keep practicing any section to stay sharp.':'You reached the end. '+(BANK.length-mastered())+' '+ITEMS+' are still waiting elsewhere, so check the dashboard for what is left.';$('dialog').hidden=false;ovOpen('dialog',closeDialog);return}goSection(L[i+1])}
// Starred review restarts its round; everything else starts a review pass (mastery is kept unless you miss).
function extraPractice(){if(state.section==='STAR')state.starDone=[];else if(state.section==='CLASS')state.classDone=[];else if(state.section==='CRAM')state.cramDone=[];else state.pass={sec:state.section,done:[],miss:[]};state.complete=state.complete.filter(x=>x!==state.section);state.active=null;state.feedback=null;state.selected=null;view=null;save();draw();scrollToCard()}
function endPass(){state.pass=null;state.active=null;state.feedback=null;state.selected=null;view=null;save();draw();scrollToCard()}
function reviewAll(){selectSection('ALL');extraPractice()}
function scrollToCard(){const r=$('card').getBoundingClientRect();if(r.top<0)$('card').scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'})}
/* ---------- v70: the Back button ----------
   Each page change in a course is one step back (Practice -> Dashboard), and an open panel (menu, discussion, What's new,
   charts, a dialog) is closed by Back before anything else. On the first page, Back leaves the course as before. */
const NAV={shown:null,pop:false,skip:false,ov:[]};
function navTrack(){if(page===NAV.shown)return;try{if(NAV.shown==null)history.replaceState(Object.assign({},history.state,{rv:1,pg:page}),'');
 else if(!NAV.pop){const st=history.state;if(st&&st.ov&&!NAV.ov.some(o=>o.name===st.ov))history.replaceState({rv:1,pg:page},'');else history.pushState({rv:1,pg:page},'')}}catch(e){}NAV.shown=page}
function ovOpen(name,close){if(NAV.pop||NAV.ov.some(o=>o.name===name))return;NAV.ov.push({name,close});try{history.pushState({rv:1,pg:page,ov:name},'')}catch(e){}}
function ovClosed(name){const i=NAV.ov.findIndex(o=>o.name===name);if(i<0)return;NAV.ov.splice(i,1);if(NAV.pop)return;
 setTimeout(()=>{const st=history.state;if(st&&st.ov===name&&!NAV.ov.some(o=>o.name===name)){NAV.skip=true;history.back()}},0)}
addEventListener('popstate',e=>{if(NAV.skip){NAV.skip=false;return}const st=e.state||{};NAV.pop=true;
 try{if(NAV.ov.length){NAV.ov.pop().close();return}if(st.rv&&st.pg&&st.pg!==page&&pageOn(st.pg))setPage(st.pg)}finally{NAV.pop=false}});
function toggleNav(open){const was=$('app').classList.contains('nav-open');$('app').classList.toggle('nav-open',open);if(open&&!was&&innerWidth<=920)ovOpen('nav',()=>toggleNav(false));else if(!open&&was)ovClosed('nav')}
function closeDialog(){$('dialog').hidden=true;ovClosed('dialog')}
function resetAll(sure){if(sure!==true){ask('This erases all saved answers in this browser.',{title:'Start over?',ok:'Erase and start over',danger:1}).then(y=>{if(y)resetAll(true)});return}try{localStorage.removeItem(KEY)}catch(e){}location.reload()}
function importProgress(){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';
 i.onchange=()=>{const f=i.files[0];if(!f)return;f.text().then(t=>{let d;try{d=JSON.parse(t)}catch(e){tell('That file is not a progress export.');return}
  const st=d&&d.state?d.state:d;if(!st||!st.concepts){tell('That file is not a progress export from a reviewer.');return}
  const known=Object.keys(st.concepts).filter(id=>byId[id]).length;if(!known){tell('That progress file belongs to a different reviewer.');return}
  ask('It has answers for '+known+' '+ITEMS+'.',{title:'Replace the progress saved in this browser with this file?',ok:'Replace',danger:1}).then(y=>{if(!y)return;
  try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){tell('This browser would not save the file.');return}location.reload()})})};
 i.click()}
function exportProgress(){let b=new Blob([JSON.stringify({exported:new Date().toISOString(),state},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=KEY+'-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

document.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 if(!$('setmodal').hidden)return;
 {const cm=$('contribmodal');if(cm&&!cm.hidden){if(e.key==='Escape'){closeContrib();e.preventDefault()}return}}
 if(!$('charts').hidden&&!(CW&&CW.on)){if(e.key==='Escape'){closeCharts();e.preventDefault()}return}
 if(!$('charts').hidden&&e.key==='Escape'){closeCharts();e.preventDefault();return}
 if(!$('news').hidden){if(e.key==='Escape'){closeNews();e.preventDefault()}return}
 if(!$('dialog').hidden){if(e.key==='Escape'||e.key==='Enter'){closeDialog();e.preventDefault()}return}
 if(e.key==='Escape'){toggleNav(false);return}
 const t=e.target;if(t.closest&&t.closest('input,textarea,select'))return;
 if(page==='match'){if(drillTab==='mix'?mixKey(e):M&&matchKey(e,'m'))e.preventDefault();return}
 if(page==='exam'){if(examKey(e))e.preventDefault();return}
 if(page==='notes'){notesKey(e);return}
 if(page==='cards'){if(window.Cards&&Cards.key(e))e.preventDefault();return}
 if(page!=='study')return;
 const k=e.key;
 if(view==null&&state.pmatch){if(matchKey(e,'p'))e.preventDefault();return}
 if(k==='Enter'){if(t.tagName==='BUTTON'&&!t.classList.contains('choice'))return;if(t.tagName==='SUMMARY')return;const g=$('go');if(g&&!g.disabled){g.click();e.preventDefault()}return}
 if(k==='ArrowLeft'){if(canBack()){goBack();e.preventDefault()}return}
 if(k==='ArrowRight'){if(view!=null){goForward();e.preventDefault()}return}
 const live=view==null&&!state.pmatch&&state.active;
 if(e.shiftKey&&(/^[a-e]$/i.test(k)||/^Digit[1-5]$/.test(e.code))&&live&&!state.feedback&&state.prefs.crossout){const l=/^Digit[1-5]$/.test(e.code)?LETTERS[+e.code.slice(-1)-1]:k.toUpperCase();if(state.active.choices.some(c=>c.letter===l)){strike(l);e.preventDefault()}return}
 if((k==='f'||k==='F')&&state.prefs.flag&&(view!=null||live)){flagQ(view!=null?'log':'live');e.preventDefault();return}
 if((k==='s'||k==='S')&&live&&state.prefs.stars){toggleStar();e.preventDefault();return}
 if(/^[a-e1-5]$/i.test(k)&&view==null&&!state.pmatch&&state.active&&!state.feedback){const l=/^[1-5]$/.test(k)?LETTERS[+k-1]:k.toUpperCase();if(state.active.choices.some(c=>c.letter===l)){answer(l);e.preventDefault()}return}
 if((k==='h'||k==='H')&&view==null&&!state.pmatch&&state.active&&!state.feedback)hint();
});
takeLink();
$('concepts').addEventListener('toggle',()=>{if($('concepts').open&&page==='study')drawGrid()});
addEventListener('hashchange',()=>{if(takeLink()){toggleNav(false);draw();window.scrollTo(0,0)}});
draw();
notifyStart();
srsPull();loadTimetable();
if(cloudOn()){loadClassStats();loadContrib(true);loadDiscussCounts();setTimeout(dnPoll,1500);dnT=setInterval(dnPoll,60000);
 if(window.Live&&dnOn())Live.listen(CLOUD,'course:'+courseId(),()=>setTimeout(()=>{dnPoll();loadDiscussCounts()},400),()=>dnPoll());if(syncCode)syncNow();
 const back=()=>{try{const c=(JSON.parse(localStorage.getItem(SYNC_KEY))||{}).code||'';if(c!==syncCode){syncCode=c;syncInfo={at:0,err:''};lastPutSig='';if(c){syncNow();return}}}catch(e){}
  if(syncCode&&Date.now()-syncInfo.at>4000)syncNow()};
 addEventListener('storage',e=>{if(e.key===SYNC_KEY)back()});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){crowdFlush(true);if(syncT)syncNow()}else{loadClassStats();loadContrib();loadMine();loadDiscussCounts();dnPoll();if(page==='dashboard'&&!$('nameinput'))drawGreeting();back()}});
 addEventListener('focus',back)}
else syncBoot=false;
// Show What's new once: on the first visit, and again only when a newer entry is added to CHANGELOG (not over a challenge).
if(!newsSeen()&&!CHAL)setTimeout(openNews,350);
BOOTED=true;if(state.__recovered){delete state.__recovered;save()}
