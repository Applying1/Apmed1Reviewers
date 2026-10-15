/* =====================================================================
   ENGINE: no need to edit below this line.
   ===================================================================== */
const BANKS=[{id:'main',name:'Main',desc:'The full reviewer',items:FULL_BANK}].concat(typeof VARIANTS!=='undefined'?VARIANTS:[]);
const ALL_ITEMS=BANKS.flatMap(b=>b.items);
const SECTION_NAMES=CONFIG.sections,CH_NAMES=CONFIG.chapters;
const ALL_SECTIONS=Object.keys(SECTION_NAMES),ALL_CHAPTERS=Object.keys(CH_NAMES);
const chOf=s=>String(s).split('-')[0];              // chapter id of a section id like "12-3"
const isCh=s=>String(s).startsWith('CH:');          // "CH:3" = the entire chapter 3 as one quiz
const isX=s=>s==='ALL'||s==='MISSED'||s==='STAR'; // modes that mix every chapter
const secCh=s=>isCh(s)?s.slice(3):chOf(s);
const KEY=CONFIG.storageKey;
const ITEM=CONFIG.itemWord||'concept',ITEMS=ITEM+'s',Items=ITEMS.charAt(0).toUpperCase()+ITEMS.slice(1);
const UNIT=CONFIG.unit||'Chapter',unitW=UNIT.toLowerCase(),unitsW=unitW+'s';
const NOTES_DATA=typeof NOTES!=='undefined'&&NOTES.length?NOTES:null;
const MSETS=(typeof MATCHING!=='undefined'?MATCHING:[]).map((m,i)=>({i,ch:String(m[0]),title:m[1],options:m[2],items:m[3]}));
const GOALS=CONFIG.recallGoals||[1,2];
const LETTERS='ABCDE',THEME_KEY='reviewer_theme';
const $=id=>document.getElementById(id);
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
const NOTE_SM='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';

/* ---------- saved state ---------- */
const DEFAULT_PREFS={target:GOALS.includes(2)?2:GOALS[0],order:'random',extras:true,notes:true,matching:true,selftest:false,mix:0,crossout:true,lucky:true,stars:true,missed:true};
function fresh(){return {concepts:{},correct:0,wrong:0,lookups:0,hints:0,section:ALL_SECTIONS[0],complete:[],history:[],log:[],active:null,selected:null,feedback:null,bank:'main',prefs:{...DEFAULT_PREFS},match:{sets:0,right:0,total:0,best:{}}}}
let state;
try{state=JSON.parse(localStorage.getItem(KEY))||fresh();if(!state.concepts)state=fresh()}catch(e){state=fresh()}
ALL_ITEMS.forEach(c=>{if(!state.concepts[c.id])state.concepts[c.id]=blank()});
state.prefs=Object.assign({},DEFAULT_PREFS,state.prefs);if(!GOALS.includes(state.prefs.target))state.prefs.target=DEFAULT_PREFS.target;
state.match=Object.assign({sets:0,right:0,total:0,best:{}},state.match);
state.log=state.log||[];state.complete=state.complete||[];state.history=state.history||[];
delete state.set;delete state.unlocked;
if(!BANKS.some(b=>b.id===state.bank))state.bank='main';
if(state.pmatch&&!MSETS[state.pmatch.i])state.pmatch=null;

/* ---------- active question bank: Main, or a variant someone added ---------- */
let BANK=[],sectionKeys=[],chapters=[],AUTHORED=true,NCHOICE=4;
const bankObj=()=>BANKS.find(b=>b.id===state.bank)||BANKS[0];
const bankItems=b=>state.prefs.extras?b.items:b.items.filter(c=>!c.extra);
function validSection(s){return s==='ALL'||(s==='MISSED'&&state.prefs.missed)||(s==='STAR'&&state.prefs.stars)||(isCh(s)?chapters.includes(s.slice(3)):sectionKeys.includes(s))}
function refreshBank(){const b=bankObj();BANK=bankItems(b);if(!BANK.length)BANK=b.items;
 sectionKeys=ALL_SECTIONS.filter(k=>BANK.some(c=>c.section===k));
 chapters=ALL_CHAPTERS.filter(ch=>sectionKeys.some(k=>chOf(k)===ch));
 AUTHORED=BANK.every(c=>c.q);NCHOICE=BANK.some(c=>!c.q)?5:Math.max(...BANK.map(c=>1+c.d.length));
 if(!validSection(state.section))state.section=sectionKeys[0]}
refreshBank();

const T=()=>state.prefs.target;                      // correct recalls needed for mastery
const isM=c=>state.concepts[c.id].right>=T();
const isMissedC=c=>{const k=state.concepts[c.id];return k.wrong>0||k.lookups>0}; // ever answered wrong or looked up
const isStar=c=>!!state.concepts[c.id].star;
const TIMES={1:'once',2:'twice',3:'three times'};
const VIEWS={dashboard:'dashView',study:'studyView',notes:'notesView',match:'matchView',prefs:'prefsView'};
function pageOn(p){return p==='notes'?!!NOTES_DATA&&state.prefs.notes:p==='match'?MSETS.length>0&&state.prefs.matching:!!VIEWS[p]}
let page=pageOn(state.page)?state.page:'dashboard';
let view=null;               // index into this section's answer log when reviewing; null = current question
const openCh=new Set(isX(state.section)?[]:[secCh(state.section)]);
let lastCardKey='';

// The summary lets a courses home screen show progress without loading the whole reviewer.
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));const main=BANKS[0].items;localStorage.setItem(KEY+'_summary',JSON.stringify({m:main.filter(isM).length,t:main.length,at:Date.now()}))}catch(e){}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function stableHash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0}
function shuffle(a,seed){let b=a.slice(),x=seed||1;for(let i=b.length-1;i>0;i--){x^=x<<13;x^=x>>>17;x^=x<<5;let j=(x>>>0)%(i+1);[b[i],b[j]]=[b[j],b[i]]}return b}
const rnd=()=>((Math.random()*4294967296)>>>0)||1;
// Random order: a new seed every time, so answer letters can't be memorized. In order: stable per attempt.
const seedFor=(c,tag)=>state.prefs.order==='random'?rnd():stableHash(c.id+tag+state.concepts[c.id].seen);
function inSection(s){return s==='ALL'?BANK:s==='MISSED'?BANK.filter(isMissedC):s==='STAR'?BANK.filter(isStar):isCh(s)?BANK.filter(c=>chOf(c.section)===s.slice(3)):BANK.filter(c=>c.section===s)}
function progress(s){const a=inSection(s);if(s==='STAR'){const d=state.starDone||[];return {done:a.filter(c=>d.includes(c.id)).length,total:a.length}}return {done:a.filter(isM).length,total:a.length}}
// What is still to be asked: unmastered items, or for starred review the ones not yet seen this round.
function poolFor(s){const a=inSection(s);if(s==='STAR'){const d=state.starDone||[];return a.filter(c=>!d.includes(c.id))}return a.filter(c=>!isM(c))}
function completed(s){const p=progress(s);return p.done===p.total}
const secTitle=s=>s==='MISSED'?'Missed '+ITEMS:s==='STAR'?'Starred '+ITEMS:s==='ALL'?'All '+unitsW+', shuffled':isCh(s)?CH_NAMES[s.slice(3)]:s+' '+SECTION_NAMES[s];
const navList=s=>isX(s)?[]:isCh(s)?chapters.map(c=>'CH:'+c):sectionKeys;

function makeQuestion(c){let st=state.concepts[c.id],stage=st.seen%3;
 // Authored question: q (stem), a (answer), d (distractors).
 if(c.q){const ch=shuffle([{label:c.a,correct:true},...c.d.map(x=>({label:x,correct:false}))],seedFor(c,'choices'));
  return {cid:c.id,kind:c.kind||'recall',stem:c.q,choices:ch.map((x,i)=>({...x,letter:LETTERS[i]})),why:c.why||'',hint:c.hint||'',usedHint:false}}
 let cand=BANK.filter(x=>x.section===c.section&&x.id!==c.id&&!x.q);
 if(cand.length<4)cand=BANK.filter(x=>x.id!==c.id&&!x.q&&chOf(x.section)===chOf(c.section));
 if(cand.length<4)cand=BANK.filter(x=>x.id!==c.id&&!x.q);
 let others=shuffle(cand,seedFor(c,'-')).slice(0,4);
 let kind=['definition','scenario','term'][stage];
 let stem,choices,why;
 if(kind==='definition'){stem='Which description best matches the term “'+c.term+'”?';choices=[{label:c.definition,correct:true,owner:c.id},...others.map(x=>({label:x.definition,correct:false,owner:x.id}))];why='“'+c.term+'” means '+c.definition+'.'}
 else if(kind==='scenario'){stem='Which concept does this situation best illustrate? '+c.scenario;choices=[{label:c.term,correct:true,owner:c.id},...others.map(x=>({label:x.term,correct:false,owner:x.id}))];why='The situation illustrates '+c.term+': '+c.definition+'.'}
 else{stem='Which concept is being described? '+c.definition;choices=[{label:c.term,correct:true,owner:c.id},...others.map(x=>({label:x.term,correct:false,owner:x.id}))];why='The description refers to '+c.term+': '+c.definition+'.'}
 choices=shuffle(choices,seedFor(c,'choices'));
 return {cid:c.id,kind,stem,choices:choices.map((x,i)=>({...x,letter:LETTERS[i]})),why,hint:c.hint,usedHint:false};
}
function chooseNext(){const s=state.section;let pool=poolFor(s);if(!pool.length)return null;
 const recent=state.history.filter(h=>h.cid).slice(-3).map(h=>h.cid);
 // In order: lecture order, least-seen first (shuffled mode is always random).
 if(state.prefs.order!=='random'&&!isX(s)){const last=recent[recent.length-1],ix=new Map(BANK.map((c,i)=>[c.id,i]));
  pool.sort((a,b)=>(state.concepts[a.id].seen-state.concepts[b.id].seen)||(ix.get(a.id)-ix.get(b.id)));
  return makeQuestion(pool.find(x=>x.id!==last)||pool[0])}
 // Shuffled mode: avoid the sections of the last few questions.
 if(isX(s)){const rs=recent.map(id=>byId[id]?.section),v=pool.filter(c=>!rs.includes(c.section));if(v.length)pool=v}
 // Random: everything comes up once per pass, in a new order each pass.
 const notRecent=pool.filter(c=>!recent.includes(c.id)),from=notRecent.length?notRecent:pool;
 const minSeen=Math.min(...from.map(c=>state.concepts[c.id].seen)),least=from.filter(c=>state.concepts[c.id].seen===minSeen);
 return makeQuestion(least[Math.floor(Math.random()*least.length)])}
function ensure(){
 const ac=state.active&&byId[state.active.cid];
 if(state.active&&(!ac||!inSection(state.section).includes(ac)||(!state.feedback&&!poolFor(state.section).includes(ac)))){state.active=null;state.feedback=null;state.selected=null}
 if(!state.active&&!state.feedback){state.active=chooseNext();state.selected=null}
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
const KIND_NAMES={definition:'Concept meaning',scenario:'Application',term:'Identification',recall:'Recall',situational:'Situational',era:'Which era?',civ:'Which civilization?',order:'Timeline'};
const kindName=k=>KIND_NAMES[k]||'Question';
const pips=n=>'<span class="pips" aria-hidden="true">'+Array.from({length:T()},(_,i)=>'<i class="'+(n>i?'on':'')+'"></i>').join('')+'</span>';
const lit=v=>typeof v==='string'?"'"+v+"'":String(v);
function segHTML(fn,opts,cur,label){return '<span class="seg" role="radiogroup" aria-label="'+esc(label)+'">'+opts.map(([v,t])=>'<button role="radio" aria-checked="'+(v===cur)+'" class="'+(v===cur?'on':'')+'" onclick="'+fn+'('+lit(v)+')">'+t+'</button>').join('')+'</span>'}
const goalSeg=()=>segHTML('setGoal',GOALS.map(n=>[n,n+'×']),T(),'Recall goal');

// live = the question being answered now (cross-out only applies there)
function choicesHTML(q,sel,fb,live){
 const canX=live&&!fb&&state.prefs.crossout,struckL=q.struck||[];
 return '<div class="choices'+(canX?' can-x':'')+'">'+q.choices.map(x=>{
  const struck=canX&&struckL.includes(x.letter);
  let cls=fb?(x.correct?'right':(sel===x.letter?'wrong':'')):(sel===x.letter?'sel':'')+(struck?' struck':'');
  let mark=fb&&x.correct?'✓':fb&&sel===x.letter?'✗':'';
  const btn='<button class="choice '+cls+'" data-l="'+x.letter+'" '+(fb?'disabled':'')+' onclick="answer(\''+x.letter+'\')"'+(canX?' oncontextmenu="strike(\''+x.letter+'\');return false"':'')+'><span class="key">'+x.letter+'</span><span class="lab">'+esc(x.label)+'</span>'+(mark?'<span class="mark" aria-label="'+(x.correct?'correct':'your answer')+'">'+mark+'</span>':'')+'</button>';
  return canX?'<div class="cw">'+btn+'<button class="x" onclick="strike(\''+x.letter+'\')" aria-pressed="'+struck+'" aria-label="'+(struck?'Restore':'Cross out')+' choice '+x.letter+'" title="'+(struck?'Restore':'Cross out')+' (Shift+'+x.letter+')">'+XSVG+'</button></div>':btn}).join('')+'</div>';
}
function feedbackHTML(q,fb,live){
 let cls=fb.correct?'good':fb.lookup?'look':'bad';
 let head=fb.correct?'Correct':fb.lookup?'Marked for review':'Not quite';
 let out='<div class="fb '+cls+'"><h3>'+FBICON[cls]+head+'</h3>';
 if(!fb.correct)out+='<p><b>Answer:</b> '+esc(fb.correctLabel)+'</p>';
 if(q.why)out+='<p>'+esc(q.why)+'</p>';
 if(fb.wrongExplain)out+='<p><b>Why not your choice:</b> '+esc(fb.wrongExplain)+'</p>';
 const note=fb.correct?(fb.lucky?'Marked as a lucky guess, so this '+ITEM+' stays in your queue.':'Counts toward mastering this '+ITEM+'.'+(live&&state.prefs.lucky?' <button class="link lucky" onclick="luckyGuess()" title="Undo the mastery point for this '+ITEM+'">Lucky guess? Ask me again</button>':''))
  :'This '+ITEM+' will come back later, '+(AUTHORED?'with the choices reshuffled':'worded differently')+'.';
 out+='<p class="note">'+note+'</p></div>';
 return out;
}
function backBtn(){return '<button class="btn back" onclick="goBack()" '+(canBack()?'':'disabled')+' title="Previous answered question (←)">'+LEFT+'Back</button>'}

function cardHTML(){
 const s=state.section;
 // Reviewing an earlier answer
 if(view!=null){
  const e=secLog()[view];
  const nextIsLive=view+1>=liveIdx();
  return '<div class="review-note"><span>Earlier answer · '+(view+1)+' of '+secLog().length+(isX(s)?' in this '+(s==='ALL'?'shuffle':'review'):isCh(s)?' in this '+unitW:' in this section')+'</span><button class="link" onclick="goLive()">Back to current question</button></div>'+
   '<div class="qhead"><span class="kind">'+kindName(e.q.kind)+'</span></div>'+
   '<p class="prompt">'+esc(e.q.stem)+'</p>'+choicesHTML(e.q,e.sel,e.fb)+feedbackHTML(e.q,e.fb)+
   '<div class="actions">'+backBtn()+'<span class="aux"></span><button class="btn primary" id="go" onclick="goForward()">'+(nextIsLive?'Return to current':'Forward')+' <kbd>→</kbd></button></div>';
 }
 // A matching set mixed into practice (Personalize → Mix matching into practice)
 if(state.pmatch)return matchCardHTML(state.pmatch,'p');
 // Section finished
 if(!state.active){
  const L=navList(s),last=!L.length||L.indexOf(s)===L.length-1,focus=s==='MISSED'||s==='STAR',none=!inSection(s).length;
  const label=s==='ALL'?'Shuffle complete':s==='STAR'?(none?'Nothing starred':'Round complete'):s==='MISSED'?'All caught up':isCh(s)?esc(UNIT)+' complete':'Section complete';
  const text=s==='STAR'?(none?'No starred '+ITEMS+' yet. Tap the star on any question, or press S, to collect it here.':'You went through every starred '+ITEM+'. Go again the night before the exam.')
   :s==='MISSED'?(none?'Nothing missed yet. '+Items+' you get wrong, or check in your slides, will collect here.':'Every '+ITEM+' you had missed is now mastered.')
   :'You answered every '+ITEM+' here correctly '+(TIMES[T()]||T()+' times')+'. Move on, or run through it again for extra practice.';
  return '<div class="done-card"><div class="qhead"><span class="kind" style="color:var(--good)">'+label+'</span></div><h2>'+esc(secTitle(s))+'</h2><p>'+text+'</p><div class="row">'+
   (secLog().length?backBtn():'')+(none?'':'<button class="btn" onclick="extraPractice()">'+(s==='STAR'?'Go again':'Practice again')+'</button>')+
   (focus?'<button class="btn primary" id="go" onclick="setPage(\'dashboard\')">Back to dashboard <kbd>Enter</kbd></button>'
    :'<button class="btn primary" id="go" onclick="advance()">'+(last?'Finish':'Next '+(isCh(s)?unitW:'section'))+' <kbd>Enter</kbd></button>')+'</div></div>';
 }
 // Current question
 const q=state.active,st=state.concepts[q.cid],fb=state.feedback,mixed=isX(s)||isCh(s);
 return '<div class="qhead"><span class="kind">'+(mixed?esc(byId[q.cid].section)+' · ':'')+kindName(q.kind)+'</span><span class="mastery">'+starBtn(q.cid)+pips(st.right)+(st.right>=T()?'Mastered':'Recall '+st.right+' of '+T())+'</span></div>'+
  '<p class="prompt">'+esc(q.stem)+'</p>'+choicesHTML(q,state.selected,fb,true)+
  (q.usedHint&&!fb?'<div class="hint"><b>Hint</b>'+esc(q.hint)+'</div>':'')+
  (fb?feedbackHTML(q,fb,true):'')+
  '<div class="actions">'+backBtn()+'<span class="aux">'+(fb?'':(q.usedHint||!q.hint?'':'<button class="link" onclick="hint()">Show hint</button>')+'<button class="link" onclick="looked()" title="Counts as a review, not a correct recall">I checked my slides</button>')+'</span>'+
  (fb?'<button class="btn primary" id="go" onclick="next()">Next question <kbd>Enter</kbd></button>'
     :'<button class="btn primary" id="go" onclick="submit()" '+(state.selected?'':'disabled')+'>Check answer <kbd>Enter</kbd></button>')+'</div>';
}

const SHUFFLE='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>';
function focusNav(study){
 const nMiss=state.prefs.missed?BANK.filter(c=>isMissedC(c)&&!isM(c)).length:0,mOn=state.section==='MISSED'&&study;
 const nStar=state.prefs.stars?BANK.filter(isStar).length:0,sOn=state.section==='STAR'&&study;
 const b=(id,on,ic,name,ct,tip)=>'<button class="sec special '+(on?'on':'')+'" '+(on?'aria-current="page" ':'')+'onclick="selectSection(\''+id+'\')" title="'+tip+'"><span class="no">'+ic+'</span><span class="nm">'+name+'</span><span class="ct">'+ct+'</span></button>';
 return (nMiss||mOn?b('MISSED',mOn,MISS_SM,'Missed '+ITEMS,nMiss,'Only the '+ITEMS+' you got wrong or checked in your slides, until mastered'):'')+
  (nStar||sOn?b('STAR',sOn,STAR_SM,'Starred',nStar,'Your starred '+ITEMS+', mastered or not'):'');
}
function navHTML(){
 const study=page==='study',ap=progress('ALL'),aOn=state.section==='ALL'&&study;
 return '<button class="sec mixed '+(aOn?'on':'')+'" '+(aOn?'aria-current="page" ':'')+'onclick="selectSection(\'ALL\')"><span class="no">'+SHUFFLE+'</span><span class="nm">All '+unitsW+', shuffled</span><span class="ct">'+ap.done+'/'+ap.total+'</span></button>'+focusNav(study)+chapters.map(ch=>{const secs=sectionKeys.filter(k=>chOf(k)===ch),cp=chProgress(ch),wOn=state.section==='CH:'+ch&&study;
  return '<details class="ch" '+(openCh.has(ch)?'open':'')+' ontoggle="this.open?openCh.add(\''+ch+'\'):openCh.delete(\''+ch+'\')"><summary>'+CHEV+'<span class="nm">'+ch+' · '+esc(CH_NAMES[ch])+'</span><span class="ct">'+secs.filter(completed).length+'/'+secs.length+'</span><span class="mini"><i style="width:'+(100*cp.done/cp.total)+'%"></i></span></summary><div class="secs">'+
  '<button class="sec whole '+(wOn?'on ':'')+(cp.done===cp.total?'done':'')+'" '+(wOn?'aria-current="page" ':'')+'onclick="selectSection(\'CH:'+ch+'\')" title="Every '+ITEM+' in this '+unitW+', mixed into one quiz"><span class="no">'+LAYERS_SM+'</span><span class="nm">Entire '+unitW+'</span><span class="ct">'+(cp.done===cp.total?'✓':cp.done+'/'+cp.total)+'</span></button>'+
  secs.map(sec=>{let p=progress(sec),done=p.done===p.total,on=sec===state.section&&study;return '<button class="sec '+(on?'on ':'')+(done?'done':'')+'" '+(on?'aria-current="page" ':'')+'onclick="selectSection(\''+sec+'\')"><span class="no">'+sec+'</span><span class="nm">'+esc(SECTION_NAMES[sec])+'</span><span class="ct">'+(done?'✓':p.done+'/'+p.total)+'</span></button>'}).join('')+'</div></details>'}).join('');
}

function drawStudy(){
 ensure();
 const s=state.section,p=progress(s),all=isX(s),ch=isCh(s),L=navList(s),idx=L.indexOf(s);
 const bp=BANKS.length>1&&state.bank!=='main'?'<span class="pill set">'+esc(bankObj().name)+'</span>':'';
 $('crumb').innerHTML=all?bp+(s==='ALL'?'Mixed review':'Focused review'):'<span class="pill">'+esc(UNIT)+' '+esc(secCh(s))+'</span>'+(ch?'Entire '+unitW:esc(CH_NAMES[chOf(s)]))+(bp?' '+bp:'');
 $('title').textContent=secTitle(s);
 const th=$('chthumb'),tk=all?'logo':secCh(s);if(th.dataset.ch!==tk){th.dataset.ch=tk;const src=all?$('logo').src:CH_IMG(secCh(s));if(src)th.src=src;else th.removeAttribute('src')}
 document.title=secTitle(s)+' · '+CONFIG.title;
 const what=ch?unitW:'section';
 $('prevSec').disabled=!L.length||idx<=0;$('nextSec').disabled=!L.length||idx>=L.length-1;
 for(const [id,w] of [['prevSec','Previous '],['nextSec','Next ']]){$(id).title=w+what;$(id).setAttribute('aria-label',w+what)}
 $('notesBtn').hidden=!pageOn('notes');
 $('mlabel').innerHTML='<b>'+p.done+'</b> of '+p.total+' '+(s==='STAR'?'starred '+ITEMS+' reviewed this round':ITEMS+' mastered');
 $('goal').innerHTML=GOALS.length>1?'<span>Recall goal</span>'+goalSeg():'';
 $('fill').style.width=(100*p.done/Math.max(1,p.total))+'%';
 // Dots: in random order they are grouped by progress, so a dot's position never hints at a question.
 const items=inSection(s),rand=state.prefs.order==='random'||ch;
 $('dots').hidden=all||items.length>60;
 if(!$('dots').hidden){let list=items.map(c=>({c,r:Math.min(state.concepts[c.id].right,T())}));if(rand)list.sort((a,b)=>b.r-a.r);
  $('dots').innerHTML=list.map(({c,r})=>'<i class="'+(r>=T()?'full':r>0?'half':'')+(!rand&&state.active&&state.active.cid===c.id&&view==null?' cur':'')+'"></i>').join('')}

 const card=$('card');card.innerHTML=cardHTML();
 const ck=s+'|'+view+'|'+(state.pmatch?'m'+state.pmatch.i:'')+(state.active?.cid||'done')+'|'+(state.concepts[state.active?.cid]?.seen??'');
 if(ck!==lastCardKey&&!reduceMotion){card.classList.remove('enter');void card.offsetWidth;card.classList.add('enter')}
 lastCardKey=ck;

 const att=state.correct+state.wrong;
 $('stats').innerHTML='<span><b>'+state.correct+'</b>correct</span><span><b>'+state.wrong+'</b>wrong</span><span><b>'+Math.round(100*state.correct/Math.max(1,att))+'%</b>accuracy</span><span><b>'+sectionKeys.filter(completed).length+'/'+sectionKeys.length+'</b>sections done</span><span class="keys">A–'+LETTERS[NCHOICE-1]+' choose'+(state.prefs.crossout?' · Shift+letter cross out':'')+(state.prefs.stars?' · S star':'')+' · Enter continue · ← → browse</span>';

 $('ccount').textContent=p.done+'/'+items.length;$('cword').textContent=Items;
 $('concepts').querySelector('summary').childNodes[2].textContent='in this '+(s==='ALL'?'shuffle':all?'review':ch?unitW:'section');
 $('ctip').textContent='Each '+ITEM+' needs '+T()+' correct answer'+(T()>1?'s':'')+'. '+(AUTHORED?'Topic labels':'Names')+' here can give answers away, so open this after you\'ve practiced.';
 $('grid').innerHTML=items.map(c=>{let r=Math.min(state.concepts[c.id].right,T());return '<div class="chip '+(r>=T()?'done':'')+'"><span>'+esc(c.term)+'</span>'+pips(r)+'</div>'}).join('');
}

/* ---------- page switching ---------- */
const PG={
 dashboard:['Dashboard','<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'],
 study:['Practice','<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>'],
 notes:['Notes','<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'],
 match:['Matching','<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6h7M8.2 7.8l7.6 8.4"/>'],
 prefs:['Personalize','<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>']};
const HOME_LINK=CONFIG.home?'<a class="page" href="'+esc(CONFIG.home)+'"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg>All courses</a>':'';
function drawPages(){$('pages').innerHTML=HOME_LINK+Object.keys(VIEWS).filter(pageOn).map(p=>'<button class="page '+(p===page?'on':'')+'" aria-current="'+(p===page?'page':'false')+'" onclick="setPage(\''+p+'\')"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+PG[p][1]+'</svg>'+PG[p][0]+'</button>').join('')}
function draw(){
 if(!pageOn(page))page='dashboard';
 for(const [p,v] of Object.entries(VIEWS))$(v).hidden=p!==page;
 $('main').classList.toggle('wide',page==='dashboard'||page==='notes');
 drawPages();
 $('nav').innerHTML=navHTML();
 drawSetSwitch();
 drawTheme();
 drawNewsDot();
 ({dashboard:drawDash,study:drawStudy,notes:drawNotes,match:drawMatch,prefs:drawPrefs})[page]();
}
/* ---------- question banks: Main, plus one tab per extra set (e.g. a friend's) ---------- */
function drawSetSwitch(){const el=$('setsw');el.hidden=BANKS.length<2;
 if(BANKS.length>1)el.innerHTML=BANKS.map(b=>{const on=b.id===state.bank,n=bankItems(b).length;
  return '<button role="radio" aria-checked="'+on+'" class="'+(on?'on':'')+'" onclick="setBank(\''+b.id+'\')" data-tip="<b>'+esc(b.name)+' · '+n+' '+ITEMS+'</b>'+esc(b.desc||'')+'">'+esc(b.name)+'<span class="num">'+n+'</span></button>'}).join('');
 $('brandsub').textContent=CONFIG.scope+' · '+BANK.length+' '+ITEMS;$('brandtitle').textContent=CONFIG.title;
}
function setBank(id){if(id===state.bank)return;state.bank=id;state.pmatch=null;refreshBank();state.active=null;state.feedback=null;state.selected=null;view=null;save();draw()}
function setPref(k,v){if(state.prefs[k]===v)return;state.prefs[k]=v;
 if(k==='extras'){refreshBank();state.active=null;state.feedback=null;state.selected=null}
 if(!validSection(state.section)){state.section=sectionKeys[0];state.active=null;state.feedback=null;state.selected=null;state.pmatch=null}
 if(k==='mix'&&!v)state.pmatch=null;
 view=null;save();draw()}
function setGoal(n){setPref('target',n)}
function setOrder(v){setPref('order',v)}
function setMix(v){setPref('mix',v)}
function setPage(p){toggleNav(false);if(p===page||!pageOn(p))return;page=p;state.page=p;view=null;save();draw();window.scrollTo(0,0)}

/* ---------- dashboard ---------- */
const ICON={
 target:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
 check:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
 layers:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
 bulb:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>'
};
function mastered(){return BANK.filter(isM).length}
function chProgress(ch){let a=BANK.filter(c=>chOf(c.section)===String(ch));return {done:a.filter(isM).length,total:a.length}}
function nextSection(){if(!isX(state.section)&&!isCh(state.section)&&!completed(state.section))return state.section;return sectionKeys.find(k=>!completed(k))||sectionKeys[0]}

/* ---------- name (saved with progress in this browser only) ---------- */
const PENCIL='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const hello=()=>{const hr=new Date().getHours();return hr<12?'Good morning':hr<18?'Good afternoon':'Good evening'};
function drawGreeting(){
 const n=(state.name||'').trim();
 $('greet').innerHTML=n?hello()+', <button class="namebtn" onclick="editName()" title="Change your name">'+esc(n)+PENCIL+'</button>'
  :hello()+' <button class="namebtn add" onclick="editName()">'+PENCIL+'Add your name</button>';
}
function editName(){
 const h=$('greet');
 h.innerHTML=hello()+', <input class="nameinput" id="nameinput" maxlength="40" placeholder="Your name" aria-label="Your name" autocomplete="given-name">';
 const i=$('nameinput');i.value=state.name||'';i.focus();i.select();
 let done=false;const finish=keep=>{if(done)return;done=true;if(keep){state.name=i.value.trim().slice(0,40);save()}drawGreeting()};
 i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish(true)}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false)}});
 i.addEventListener('blur',()=>finish(true));
}

function drawDash(){
 drawGreeting();
 document.title='Dashboard · '+CONFIG.title;
 const nMiss=BANK.filter(c=>isMissedC(c)&&!isM(c)).length,nStar=BANK.filter(isStar).length;
 $('weakgo').hidden=!(state.prefs.missed&&nMiss);$('weakgo').textContent='Practice missed only ('+nMiss+')';
 $('weakdesc').textContent=Items+" you've answered incorrectly and haven't mastered yet.";
 const m=mastered(),pct=Math.round(100*m/Math.max(1,BANK.length)),att=state.correct+state.wrong;
 const secDone=sectionKeys.filter(completed).length,nx=nextSection(),np=progress(nx);
 const bn=BANKS.length>1?esc(bankObj().name)+' · ':'';
 $('hero').innerHTML='<div><div class="big num">'+pct+'%<small>mastered</small></div>'+
  '<p class="sub">'+bn+'<b class="num">'+m+'</b> of <span class="num">'+BANK.length+'</span> '+ITEMS+' mastered across '+esc(CONFIG.scope)+' · <b class="num">'+secDone+'</b> of '+sectionKeys.length+' sections complete</p>'+
  '<div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'" aria-label="Overall mastery"><div class="fill" style="width:'+pct+'%"></div></div></div>'+
  '<div class="next"><div class="eyebrow">'+(secDone===sectionKeys.length?'All done':'Up next')+'</div><div class="t">'+esc(nx+' '+SECTION_NAMES[nx])+'</div><div class="m num">'+np.done+' of '+np.total+' '+ITEMS+' mastered</div><button class="btn primary" onclick="selectSection(\''+nx+'\')">'+(np.done?'Resume':'Start')+' section</button><button class="shuffle-link" onclick="selectSection(\'ALL\')">'+SHUFFLE+'Or shuffle all '+unitsW+'</button>'+
  (pageOn('notes')?'<button class="shuffle-link" onclick="openNotes(\'all\')">'+NOTE_SM+'Read the high-yield notes</button>':'')+
  (state.prefs.stars&&nStar?'<button class="shuffle-link" onclick="selectSection(\'STAR\')">'+STAR_SM+'Review starred ('+nStar+')</button>':'')+'</div>';

 const tile=(ic,k,v,d)=>'<div class="kpi"><div class="k">'+ic+k+'</div><div class="v">'+v+'</div><div class="d">'+d+'</div></div>';
 $('kpis').innerHTML=
  tile(ICON.target,'Accuracy',Math.round(100*state.correct/Math.max(1,att))+'<small>%</small>',state.correct+' right · '+state.wrong+' wrong')+
  tile(ICON.check,'Answered',att+state.lookups,'questions so far')+
  tile(ICON.layers,'Sections done',secDone+'<small>/'+sectionKeys.length+'</small>',(sectionKeys.length-secDone)+' to go')+
  (MSETS.length&&pageOn('match')?tile(PG.match[1]?'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+PG.match[1]+'</svg>':'','Matching',state.match.total?Math.round(100*state.match.right/state.match.total)+'<small>%</small>':'–',state.match.sets+' set'+(state.match.sets===1?'':'s')+' checked')
   :tile(ICON.bulb,'Hints used',state.hints,state.lookups+' slide checks'));

 $('chcards').innerHTML=chapters.map(ch=>{const p=chProgress(ch),w=Math.round(100*p.done/p.total),secs=sectionKeys.filter(k=>chOf(k)===ch);
  const first=secs.find(k=>!completed(k))||secs[0];
  return '<button class="chcard" onclick="selectSection(\''+first+'\')" aria-label="'+esc(UNIT)+' '+ch+', '+esc(CH_NAMES[ch])+', '+p.done+' of '+p.total+' '+ITEMS+' mastered">'+(CH_IMG(ch)?'<span class="art"><img src="'+CH_IMG(ch)+'" alt="" loading="lazy" width="960" height="720"></span>':'<span class="art noimg"><b>'+esc(ch)+'</b></span>')+
   '<span class="body"><span class="no">'+esc(UNIT)+' '+ch+'</span><span class="nm">'+esc(CH_NAMES[ch])+'</span><span class="track"><span class="fill" style="display:block;width:'+w+'%"></span></span><span class="meta"><span>'+p.done+'/'+p.total+' '+ITEMS+'</span><span>'+w+'%</span></span></span></button>'}).join('');

 const rec=state.history.filter(h=>h.cid).slice(-40);
 $('recentN').textContent=rec.length?'last '+rec.length:'';
 if(!rec.length)$('recent').innerHTML='<p class="empty">No answers yet. Your recent results will show up here.</p>';
 else{const c=rec.filter(h=>h.correct).length,l=rec.filter(h=>h.lookup).length,w=rec.length-c-l;
  $('recent').innerHTML='<div class="recent-sum"><span><b>'+c+'</b>correct</span><span><b>'+w+'</b>wrong</span><span><b>'+l+'</b>slide checks</span><span><b>'+Math.round(100*c/rec.length)+'%</b>hit rate</span></div>'+
   '<div class="strip">'+rec.map(h=>{const st=h.correct?'c':h.lookup?'l':'w',lab=h.correct?'Correct':h.lookup?'Checked slides':'Wrong';
    return '<i class="'+st+'" data-tip="<b>'+lab+'</b>'+esc(h.term)+' · '+esc(h.section)+'"></i>'}).join('')+'</div>'+
   '<div class="legend"><span><i style="background:var(--good)"></i>Correct</span><span><i style="background:var(--bad)"></i>Wrong</span><span><i style="background:var(--amber)"></i>Checked slides</span></div>'}

 $('heat').innerHTML=chapters.map(ch=>{const secs=sectionKeys.filter(k=>chOf(k)===ch);
  return '<div class="heat-row"><div class="h"><b>'+ch+'</b>'+esc(CH_NAMES[ch])+'</div><div class="cells">'+secs.map(k=>{const p=progress(k),v=Math.round(100*p.done/p.total);
   return '<button class="cell'+(v>=55?' hi':'')+(k===state.section?' cur':'')+'" style="--p:'+v+'%" onclick="selectSection(\''+k+'\')" aria-label="'+esc(k+' '+SECTION_NAMES[k])+', '+v+' percent mastered" data-tip="<b>'+esc(k+' '+SECTION_NAMES[k])+'</b>'+p.done+' of '+p.total+' mastered ('+v+'%)">'+k+'</button>'}).join('')+'</div></div>'}).join('');

 const weak=BANK.map(c=>({c,k:state.concepts[c.id]})).filter(x=>x.k.wrong>0&&x.k.right<T()).sort((a,b)=>(b.k.wrong-b.k.right)-(a.k.wrong-a.k.right)||b.k.wrong-a.k.wrong).slice(0,8);
 $('weak').innerHTML=weak.length?weak.map(({c,k})=>'<li><button onclick="selectSection(\''+c.section+'\')"><span class="t">'+esc(c.term)+'<span>'+c.section+' · '+esc(SECTION_NAMES[c.section])+'</span></span><span class="w">'+k.wrong+' wrong</span>'+pips(Math.min(k.right,T()))+'</button></li>').join(''):'<li class="empty">Nothing flagged yet. '+Items+' you miss will be listed here so you can go back to them.</li>';
}

/* ---------- notes ---------- */
// NOTES rows look like "Term — what it points to | Term — ..."; " = " and " – " also split a row.
const NOTES_PARSED=(NOTES_DATA||[]).map(([ch,groups])=>({ch:String(ch),groups:groups.map(([title,txt])=>({title,rows:String(txt).split(/\s*\|\s*/).filter(Boolean).map(p=>{const m=p.match(/^(.+?)\s+[—–=]\s+(.+)$/);return m?[m[1],m[2]]:[p,'']})}))}));
let notesCh='all',notesQ='';
function openNotes(ch){notesCh=ch||(isX(state.section)?'all':secCh(state.section));if(!NOTES_PARSED.some(n=>n.ch===notesCh))notesCh='all';notesQ='';
 if(page==='notes'){draw();window.scrollTo(0,0)}else setPage('notes')}
function drawNotes(){
 document.title='Notes · '+CONFIG.title;
 const chips=[['all','All']].concat(NOTES_PARSED.map(n=>[n.ch,esc(UNIT)+' '+esc(n.ch)+' · '+esc(CH_NAMES[n.ch]||'')]));
 $('nchips').innerHTML=chips.map(([k,t])=>'<button class="fchip '+(k===notesCh?'on':'')+'" aria-pressed="'+(k===notesCh)+'" onclick="notesCh=\''+k+'\';drawNotes()">'+t+'</button>').join('');
 $('selftest').setAttribute('aria-checked',String(!!state.prefs.selftest));$('ntip').hidden=!state.prefs.selftest;
 if($('nq').value!==notesQ)$('nq').value=notesQ;
 drawNotesBody();
}
function hl(s){const t=esc(s),q=notesQ.trim();if(!q)return t;return t.replace(new RegExp('('+esc(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark>$1</mark>')}
function drawNotesBody(){
 const q=notesQ.trim().toLowerCase(),body=$('nbody');body.classList.toggle('selftest',!!state.prefs.selftest);
 const out=NOTES_PARSED.filter(n=>notesCh==='all'||n.ch===notesCh).map(n=>{
  const cards=n.groups.map(g=>{const titleHit=q&&g.title.toLowerCase().includes(q);
   const rows=g.rows.filter(([a,b])=>!q||titleHit||(a+' '+b).toLowerCase().includes(q));if(!rows.length)return '';
   return '<article class="ncard"><h3>'+hl(g.title)+'</h3><dl class="nrows">'+rows.map(([a,b])=>'<div class="nrow" onclick="this.classList.toggle(\'show\');syncReveal()"><dt>'+hl(a)+'</dt><dd>'+hl(b)+'</dd></div>').join('')+'</dl></article>'}).join('');
  if(!cards)return '';
  return '<section class="nsec"><div class="nhead"><h2><span class="pill">'+esc(UNIT)+' '+esc(n.ch)+'</span>'+esc(CH_NAMES[n.ch]||'')+'</h2>'+(state.prefs.selftest?'<button class="link reveal" onclick="revealSec(this)">Reveal all</button>':'')+(chapters.includes(n.ch)?'<button class="link" onclick="selectSection(\'CH:'+n.ch+'\')">Quiz the entire '+unitW+' →</button>':'')+'</div><div class="ngrid">'+cards+'</div></section>'}).join('');
 body.innerHTML=out||'<p class="empty">No notes match “'+esc(notesQ)+'”.</p>';
}
function toggleSelfTest(){state.prefs.selftest=!state.prefs.selftest;save();drawNotes()}
function revealSec(btn){const rows=[...btn.closest('.nsec').querySelectorAll('.nrow')],all=rows.every(r=>r.classList.contains('show'));rows.forEach(r=>r.classList.toggle('show',!all));syncReveal()}
function syncReveal(){document.querySelectorAll('#nbody .nsec').forEach(sec=>{const b=sec.querySelector('.reveal');if(b)b.textContent=[...sec.querySelectorAll('.nrow')].every(r=>r.classList.contains('show'))?'Hide all':'Reveal all'})}
// Self-test: Space (or N) reveals the next hidden answer.
function notesKey(e){if(!state.prefs.selftest||e.target.tagName==='BUTTON')return;if(e.key!==' '&&e.key!=='n'&&e.key!=='N')return;e.preventDefault();
 const r=document.querySelector('#nbody .nrow:not(.show)');if(r){r.classList.add('show');r.scrollIntoView({block:'nearest',behavior:reduceMotion?'auto':'smooth'});syncReveal()}}

/* ---------- matching type ---------- */
let matchCh='all',M=null;
function matchPool(){return MSETS.filter(m=>matchCh==='all'||m.ch===matchCh)}
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
function setMatchCh(k){matchCh=k;M=null;drawMatch()}
function drawMatch(){
 document.title='Matching · '+CONFIG.title;
 const chs=[...new Set(MSETS.map(m=>m.ch))];
 $('mchips').innerHTML=[['all','All']].concat(chs.map(c=>[c,esc(UNIT)+' '+esc(c)+' · '+esc(CH_NAMES[c]||'')])).map(([k,t])=>'<button class="fchip '+(k===matchCh?'on':'')+'" aria-pressed="'+(k===matchCh)+'" onclick="setMatchCh(\''+k+'\')">'+t+'</button>').join('');
 if(!M||(matchCh!=='all'&&MSETS[M.i].ch!==matchCh))pickMatch();
 drawMatchCard();drawMatchSets();
}
// ctx 'm' = Matching page, 'p' = a set mixed into practice (same card, different buttons at the bottom).
function matchCardHTML(X,ctx){
 const m=MSETS[X.i],L=X.opt.map((o,k)=>({k,letter:LETTERS[k],label:m.options[o]})),n=X.items.length,answered=Object.keys(X.ans).length,best=state.match.best[m.title];
 let hits=0;
 const rows=X.items.map((it,r)=>{const [text,correct]=m.items[it],pick=X.ans[r],rightK=X.opt.indexOf(correct),ok=X.checked&&pick===rightK;if(ok)hits++;
  return '<div class="mrow '+(X.checked?(ok?'ok':'bad'):(r===(X.cur??0)?'cur':''))+'"><span class="mn">'+(r+1)+'</span><span class="mt">'+esc(text)+(X.checked&&!ok?'<span class="mfix">Answer: '+LETTERS[rightK]+' · '+esc(m.options[correct])+'</span>':'')+'</span>'+
   '<span class="seg mseg" role="radiogroup" aria-label="Answer for item '+(r+1)+'">'+L.map(x=>'<button role="radio" aria-checked="'+(pick===x.k)+'" class="'+(pick===x.k?'on':'')+(X.checked&&!ok&&x.k===rightK?' ans':'')+'" '+(X.checked?'disabled':'')+' onclick="matchPick(\''+ctx+'\','+r+','+x.k+')">'+x.letter+'</button>').join('')+'</span></div>'}).join('');
 const p=ctx==='p';
 return '<div class="qhead"><span class="kind">Matching type · '+esc(UNIT)+' '+esc(m.ch)+'</span><span>'+(best!=null?'Best '+best+'/'+n:'New set')+'</span></div>'+
  '<p class="prompt">'+esc(m.title)+'</p><p class="mtip">Match each item with A–'+LETTERS[L.length-1]+'. A letter can be used more than once.<span class="khint"> Keys: ↑ ↓ or 1–'+n+' pick an item, A–'+LETTERS[L.length-1]+' answers it, Enter checks.</span></p>'+
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
function mixPool(){const s=state.section;return isX(s)?MSETS:MSETS.filter(m=>m.ch===secCh(s))}
function maybeMix(){const every=state.prefs.mix;if(!every||(state.sinceMix||0)<every)return;const pool=mixPool();if(!pool.length)return;
 state.pmatch=makeMatch(chooseSet(pool,state.lastMix).i);state.lastMix=state.pmatch.i;state.sinceMix=0}
function endMix(){state.pmatch=null;save();draw();scrollToCard()}
function skipMix(){endMix()}
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
 const li=k.length===1?LETTERS.indexOf(k.toUpperCase()):-1;
 if(li>=0&&li<X.opt.length){matchPick(ctx,cur,li);scrollCur();return true}
 return false}
function retryMatch(){newMatch(M.i);drawMatchCard();$('mcard').scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'})}
function openMatch(i){newMatch(i);drawMatchCard();drawMatchSets();$('mcard').scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'})}
function drawMatchSets(){
 $('msum').textContent=state.match.total?state.match.right+' of '+state.match.total+' items right overall':'';
 $('msets').innerHTML=matchPool().map(m=>{const b=state.match.best[m.title];
  return '<button class="mset '+(M&&M.i===m.i?'on':'')+'" onclick="openMatch('+m.i+')"><b>'+esc(m.title)+'</b><span class="'+(b===m.items.length?'ok':'')+'">'+esc(UNIT)+' '+esc(m.ch)+' · '+(b!=null?'best '+b+'/'+m.items.length:'not tried yet')+'</span></button>'}).join('');
}

/* ---------- personalize ---------- */
function drawPrefs(){
 document.title='Personalize · '+CONFIG.title;
 const row=(t,d,ctl)=>'<div class="prow"><div class="pl"><b>'+t+'</b><span>'+d+'</span></div><div class="ctl">'+ctl+'</div></div>';
 const sw=(on,fn,label)=>'<button class="tgl" role="switch" aria-checked="'+on+'" aria-label="'+esc(label)+'" onclick="'+fn+'"><span class="sw"></span></button>';
 const ex=bankObj().items.filter(c=>c.extra).length,rand=state.prefs.order==='random';
 let h='<section class="panel"><h2>Practice</h2>'+
  (GOALS.length>1?row('Recall goal','How many times you must answer a '+ITEM+' correctly before it counts as mastered. You can also switch this on the Practice page.',goalSeg()):'')+
  row('Question order',rand?'Random: '+ITEMS+' come in a new order every pass and the answer letters are reshuffled each time, so you can\'t memorize positions.':'In order: '+ITEMS+' follow the lecture order and keep their answer letters. Easier to follow, but easier to memorize.',segHTML('setOrder',[['random','Random'],['fixed','In order']],state.prefs.order,'Question order'))+
  (MSETS.length?row('Mix matching into practice',state.prefs.mix?'After every '+state.prefs.mix+' '+ITEMS+', the next card is a matching set from the '+unitW+' you are practicing. It counts toward your matching scores, not '+ITEM+' mastery.':'Matching sets stay on their own page. Turn this on to get one now and then while you practice.',segHTML('setMix',[[0,'Off'],[10,'Every 10'],[5,'Every 5']],state.prefs.mix,'Mix matching into practice')):'')+
  (ex?row('Include detail '+ITEMS,ex+' '+ITEMS+' in this bank are marked as extra detail. Turn this off to drill only the core.',sw(state.prefs.extras,"setPref('extras',"+!state.prefs.extras+")",'Include detail '+ITEMS)):'')+
  '</section>';
 h+='<section class="panel"><h2>Study tools</h2>'+
  row('Cross out choices','Rule out answers while you think: right-click a choice, tap its ×, or press Shift + its letter.',sw(state.prefs.crossout,"setPref('crossout',"+!state.prefs.crossout+")",'Cross out choices'))+
  row('Lucky guess button','After a correct answer, undo the mastery point if you were only guessing, so the '+ITEM+' stays in your queue.',sw(state.prefs.lucky,"setPref('lucky',"+!state.prefs.lucky+")",'Lucky guess button'))+
  row('Star '+ITEMS,'Flag tricky '+ITEMS+' with the star or the S key, then review them together, even after they are mastered.',sw(state.prefs.stars,"setPref('stars',"+!state.prefs.stars+")",'Star '+ITEMS))+
  row('Missed '+ITEMS+' drill','A sidebar list and a dashboard button that drill only the '+ITEMS+' you got wrong or checked in your slides, until they are mastered.',sw(state.prefs.missed,"setPref('missed',"+!state.prefs.missed+")",'Missed '+ITEMS+' drill'))+
  '</section>';
 if(NOTES_DATA||MSETS.length)h+='<section class="panel"><h2>Pages</h2>'+
  (NOTES_DATA?row('Notes','High-yield recognition notes to read before a mock exam, with a self-test mode.',sw(state.prefs.notes,"setPref('notes',"+!state.prefs.notes+")",'Show the Notes page')):'')+
  (MSETS.length?row('Matching',MSETS.length+' matching-type sets in the A–D format, graded per item.',sw(state.prefs.matching,"setPref('matching',"+!state.prefs.matching+")",'Show the Matching page')):'')+'</section>';
 if(BANKS.length>1)h+='<section class="panel"><h2>Question bank</h2><p class="desc">Main is the full reviewer. Each extra bank is its own question set with its own progress.</p>'+
  BANKS.map(b=>row(esc(b.name)+'<span class="pill set">'+bankItems(b).length+' '+ITEMS+'</span>',esc(b.desc||''),b.id===state.bank?'<span class="pill">In use</span>':'<button class="btn sm" onclick="setBank(\''+b.id+'\')">Use</button>')).join('')+'</section>';
 h+='<section class="panel"><h2>Appearance and you</h2>'+
  row('Theme','System follows your device setting.',segHTML('setThemeMode',[['system','System'],['light','Light'],['dark','Dark']],themeMode(),'Theme'))+
  row('Your name','Used to greet you on the dashboard. Saved only in this browser.','<input class="txt" id="pname" maxlength="40" placeholder="Your name" aria-label="Your name" autocomplete="given-name" value="'+esc(state.name||'')+'" onchange="state.name=this.value.trim().slice(0,40);save()">')+'</section>';
 h+='<section class="panel"><h2>Your data</h2>'+
  row('Export progress','Download a backup of your answers as a JSON file.','<button class="btn sm" onclick="exportProgress()">Export</button>')+
  row('Import progress','Load a file you exported, for example to move your answers from the file version to the website or to another browser. It replaces the progress saved here.','<button class="btn sm" onclick="importProgress()">Import</button>')+
  row('Reset progress','Erase every saved answer in this browser. This can\'t be undone.','<button class="btn sm danger" onclick="resetAll()">Reset</button>')+'</section>';
 $('prefs').innerHTML=h;
}

/* ---------- what's new: changes to how the app works (not to the questions) ---------- */
const CHANGELOG=[
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
function drawNewsDot(){$('newsBtn').classList.toggle('dot',state.seenNews!==CHANGELOG[0].v)}
function openNews(){toggleNav(false);$('newsbody').innerHTML=CHANGELOG.map(r=>'<section class="rel"><h3>'+esc(r.title)+'<span>'+esc(r.date)+'</span></h3><ul>'+r.items.map(i=>'<li>'+i+'</li>').join('')+'</ul></section>').join('');
 $('news').hidden=false;state.seenNews=CHANGELOG[0].v;save();drawNewsDot();const bx=$('news').querySelector('.box');bx.scrollTop=0;bx.querySelector('.btn').focus({preventScroll:true})}
function closeNews(){$('news').hidden=true}

/* ---------- tooltip ---------- */
(function(){const tip=$('tip');let cur=null;
 function show(el,x,y){cur=el;tip.innerHTML=el.dataset.tip;tip.classList.add('on');place(x,y)}
 function place(x,y){const r=tip.getBoundingClientRect();let L=Math.min(Math.max(8,x-r.width/2),innerWidth-r.width-8),T=y-r.height-12;if(T<8)T=y+18;tip.style.left=L+'px';tip.style.top=T+'px'}
 function hide(){cur=null;tip.classList.remove('on')}
 document.addEventListener('pointerover',e=>{const el=e.target.closest('[data-tip]');if(el)show(el,e.clientX,e.clientY);else if(cur)hide()});
 document.addEventListener('pointermove',e=>{if(cur)place(e.clientX,e.clientY)});
 document.addEventListener('focusin',e=>{const el=e.target.closest('[data-tip]');if(el){const r=el.getBoundingClientRect();show(el,r.left+r.width/2,r.top)}else if(cur)hide()});
 document.addEventListener('scroll',hide,true);
})();

/* ---------- theme ---------- */
function curTheme(){return document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}
function themeMode(){return document.documentElement.dataset.theme||'system'}
function drawTheme(){const d=curTheme()==='dark';$('themeBtn').innerHTML=(d?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>Light mode':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>Dark mode')}
function setThemeMode(m){if(m==='system'){delete document.documentElement.dataset.theme;try{localStorage.removeItem(THEME_KEY);localStorage.removeItem('psych_theme')}catch(e){}}else{document.documentElement.dataset.theme=m;try{localStorage.setItem(THEME_KEY,m)}catch(e){}}draw()}
function toggleTheme(){setThemeMode(curTheme()==='dark'?'light':'dark')}

/* ---------- actions ---------- */
function answer(l){if(view!=null||state.pmatch||state.feedback||!state.active)return;state.selected=l;
 if(state.active.struck?.includes(l)){state.active.struck=state.active.struck.filter(x=>x!==l);save();$('card').innerHTML=cardHTML();return}
 save();
 document.querySelectorAll('#card .choice').forEach(b=>{let on=b.dataset.l===l;b.classList.toggle('sel',on)});
 const g=$('go');if(g)g.disabled=false}
// Cross out a choice you have ruled out (right-click, the × button, or Shift + letter).
function strike(l){if(view!=null||state.pmatch||state.feedback||!state.active||!state.prefs.crossout)return;const s=state.active.struck||[];
 state.active.struck=s.includes(l)?s.filter(x=>x!==l):s.concat(l);if(state.selected===l)state.selected=null;save();$('card').innerHTML=cardHTML()}
// Correct, but only a guess: take the mastery point back so the question stays in the queue.
function luckyGuess(){const fb=state.feedback;if(view!=null||!fb||!fb.correct||fb.lucky||!state.active)return;
 const k=state.concepts[state.active.cid];k.right=Math.max(0,k.right-1);k.lucky=(k.lucky||0)+1;fb.lucky=true;
 const last=state.log[state.log.length-1];if(last&&last.fb)last.fb.lucky=true;save();draw()}
function starBtn(cid){if(!state.prefs.stars)return '';const on=!!state.concepts[cid].star;
 return '<button class="starbtn'+(on?' on':'')+'" onclick="toggleStar()" aria-pressed="'+on+'" aria-label="'+(on?'Remove star':'Star this '+ITEM)+'" title="'+(on?'Starred · click to remove':'Star this '+ITEM+' to review it later')+' (S)">'+STAR_SVG+'</button>'}
function toggleStar(){if(view!=null||state.pmatch||!state.active||!state.prefs.stars)return;const k=state.concepts[state.active.cid];k.star=!k.star;save();draw()}
function hint(){if(view!=null||state.pmatch||state.feedback||!state.active||!state.active.hint)return;if(!state.active.usedHint){state.active.usedHint=true;state.hints++;state.concepts[state.active.cid].hints++}save();draw()}
function looked(){if(view!=null||state.pmatch||state.feedback||!state.active)return;record(false,true)}
function submit(){if(view!=null||state.pmatch||!state.selected||state.feedback)return;record(state.active.choices.find(x=>x.letter===state.selected).correct,false)}
function record(correct,lookup){
 const q=state.active,k=state.concepts[q.cid],choice=q.choices.find(x=>x.letter===state.selected),target=q.choices.find(x=>x.correct);
 k.seen++;if(state.section==='STAR'){state.starDone=state.starDone||[];if(!state.starDone.includes(q.cid))state.starDone.push(q.cid)}
 state.sinceMix=(state.sinceMix||0)+1;if(correct){k.right++;state.correct++}else if(lookup){k.lookups++;state.lookups++}else{k.wrong++;state.wrong++}
 const own=choice&&!choice.correct&&choice.owner?byId[choice.owner]:null;
 state.feedback={correct,lookup,correctLabel:target.letter+'. '+target.label,wrongExplain:own&&own.definition?'“'+own.term+'” refers to '+own.definition.charAt(0).toLowerCase()+own.definition.slice(1)+'.':''};
 if(lookup)state.selected=null;
 k.history.push({correct,lookup,kind:q.kind});
 state.history.push({cid:q.cid,correct,lookup,term:byId[q.cid].term,section:byId[q.cid].section,mode:state.section});
 if(state.history.length>2000)state.history=state.history.slice(-2000);
 state.log.push({sec:state.section,sel:state.selected,fb:state.feedback,q:{kind:q.kind,stem:q.stem,why:q.why,choices:q.choices.map(({letter,label,correct})=>({letter,label,correct}))}});
 if(state.log.length>400)state.log=state.log.slice(-400);
 save();draw();
 requestAnimationFrame(()=>{const f=document.querySelector('#card .fb'),r=f?.getBoundingClientRect();if(r&&r.bottom>innerHeight)f.scrollIntoView({block:'nearest',behavior:reduceMotion?'auto':'smooth'})});
}
function next(){if(!state.feedback)return;state.feedback=null;state.active=null;state.selected=null;maybeMix();if(completed(state.section)&&!state.complete.includes(state.section))state.complete.push(state.section);save();draw();scrollToCard()}
function goSection(sec){if(sec===state.section)return;state.section=sec;state.pmatch=null;state.active=null;state.feedback=null;state.selected=null;view=null;if(!isX(sec))openCh.add(secCh(sec));if(sec==='STAR'&&completed('STAR'))state.starDone=[];save();draw();window.scrollTo({top:0,behavior:reduceMotion?'auto':'smooth'})}
function selectSection(sec){toggleNav(false);if(page!=='study'){page='study';state.page=page;if(sec===state.section){save();draw();window.scrollTo(0,0);return}}goSection(sec)}
function stepSection(d){const L=navList(state.section),i=L.indexOf(state.section)+d;if(i>=0&&i<L.length)goSection(L[i])}
function advance(){const L=navList(state.section),i=L.indexOf(state.section);if(!L.length||i===L.length-1){$('modalbody').textContent=completed('ALL')?'You have mastered all '+BANK.length+' '+ITEMS+' across '+CONFIG.scope+'. Keep practicing any section to stay sharp.':'You reached the end. '+(BANK.length-mastered())+' '+ITEMS+' are still waiting elsewhere, so check the dashboard for what is left.';$('dialog').hidden=false;return}goSection(L[i+1])}
function extraPractice(){if(state.section==='STAR')state.starDone=[];else inSection(state.section).forEach(c=>{let k=state.concepts[c.id];k.right=Math.min(k.right,T()-1)});state.complete=state.complete.filter(x=>x!==state.section);state.active=null;state.feedback=null;state.selected=null;view=null;save();draw()}
function scrollToCard(){const r=$('card').getBoundingClientRect();if(r.top<0)$('card').scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'})}
function toggleNav(open){$('app').classList.toggle('nav-open',open)}
function closeDialog(){$('dialog').hidden=true}
function resetAll(){if(!confirm('Start over? This erases all saved answers in this browser.'))return;try{localStorage.removeItem(KEY)}catch(e){}location.reload()}
function importProgress(){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';
 i.onchange=()=>{const f=i.files[0];if(!f)return;f.text().then(t=>{let d;try{d=JSON.parse(t)}catch(e){alert('That file is not a progress export.');return}
  const st=d&&d.state?d.state:d;if(!st||!st.concepts){alert('That file is not a progress export from a reviewer.');return}
  const known=Object.keys(st.concepts).filter(id=>byId[id]).length;if(!known){alert('That progress file belongs to a different reviewer.');return}
  if(!confirm('Replace the progress saved in this browser with this file? It has answers for '+known+' '+ITEMS+'.'))return;
  try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){alert('This browser would not save the file.');return}location.reload()})};
 i.click()}
function exportProgress(){let b=new Blob([JSON.stringify({exported:new Date().toISOString(),state},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=KEY+'-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

document.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 if(!$('news').hidden){if(e.key==='Escape'){closeNews();e.preventDefault()}return}
 if(!$('dialog').hidden){if(e.key==='Escape'||e.key==='Enter'){closeDialog();e.preventDefault()}return}
 if(e.key==='Escape'){toggleNav(false);return}
 const t=e.target;if(t.closest&&t.closest('input,textarea,select'))return;
 if(page==='match'){if(M&&matchKey(e,'m'))e.preventDefault();return}
 if(page==='notes'){notesKey(e);return}
 if(page!=='study')return;
 const k=e.key;
 if(view==null&&state.pmatch){if(matchKey(e,'p'))e.preventDefault();return}
 if(k==='Enter'){if(t.tagName==='BUTTON'&&!t.classList.contains('choice'))return;if(t.tagName==='SUMMARY')return;const g=$('go');if(g&&!g.disabled){g.click();e.preventDefault()}return}
 if(k==='ArrowLeft'){if(canBack()){goBack();e.preventDefault()}return}
 if(k==='ArrowRight'){if(view!=null){goForward();e.preventDefault()}return}
 const live=view==null&&!state.pmatch&&state.active;
 if(e.shiftKey&&/^[a-e]$/i.test(k)&&live&&!state.feedback&&state.prefs.crossout){const l=k.toUpperCase();if(state.active.choices.some(c=>c.letter===l)){strike(l);e.preventDefault()}return}
 if((k==='s'||k==='S')&&live&&state.prefs.stars){toggleStar();e.preventDefault();return}
 if(/^[a-e]$/i.test(k)&&view==null&&!state.pmatch&&state.active&&!state.feedback){const l=k.toUpperCase();if(state.active.choices.some(c=>c.letter===l)){answer(l);e.preventDefault()}return}
 if((k==='h'||k==='H')&&view==null&&!state.pmatch&&state.active&&!state.feedback)hint();
});
draw();
// Show What's new once: on the first visit, and again only when a newer entry is added to CHANGELOG.
if(state.seenNews!==CHANGELOG[0].v)setTimeout(openNews,350);
