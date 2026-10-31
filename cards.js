/* =====================================================================
   FLASHCARDS (v98, step 2 in v99): loaded by the engine the first time the Flashcards page opens. Source: src/cards.js
   (build_site.py copies it). The deck comes from courses/<id>.cards.json (built from the notes, term/definition items and
   cards_src/). Each card's memory lives in the engine (FC, fcSave, synced as "fc"): [stability, difficulty, due, last review,
   reps, lapses, state, step], times in minutes since 1970, state 1 learning, 2 review, 3 relearning (a new card has no entry).
   FC.h = {study day: [reviews, again]} for the retention stat.
   Scheduling is FSRS-5, ported from py-fsrs 4.1.2 (same formulas, same learning steps); tests/fsrs_ref.json checks it.
   v99 adds: exam pacing (new cards spread so all are seen ~2 days before the deck's eval; no review lands after it),
   a load balancer (a review goes to the lightest day its fuzz allows; optional easy day), the most-forgotten reviews first
   when there are more than the daily limit, cram mode (weakest first, changes no schedule) and a stats panel.
   v100 adds: class cards (approved suggestions, contrib_cards), own cards (engine MYC, "My cards" screen, suggest to class),
   diagram cards (k 'o': a picture with boxes, one hidden label per card), leeches (missed 4+ times: explain differently,
   the notes, suspend; FC.sus).
   ===================================================================== */
(function(){
const W=[0.40255,1.18385,3.173,15.69105,7.1949,0.5345,1.4604,0.0046,1.54575,0.1192,1.01925,1.9395,0.11,0.29605,2.2698,0.2315,2.9898,0.51655,0.6621];
const DECAY=-0.5,FACTOR=19/81,MIN=6e4,DAY=864e5,LEARN=[MIN,10*MIN],RELEARN=[10*MIN],AHEAD=20*MIN;
const clampD=d=>Math.min(10,Math.max(1,d)),S0=g=>Math.max(W[g-1],.1),D0=g=>clampD(W[4]-Math.exp(W[5]*(g-1))+1);
const R=(t,s)=>Math.pow(1+FACTOR*Math.max(0,t)/s,DECAY);
const ivl=(s,ret,max)=>Math.min(max,Math.max(1,Math.round(s/FACTOR*(Math.pow(ret,1/DECAY)-1))));
const shortS=(s,g)=>s*Math.exp(W[17]*(g-3+W[18]));
function nextD(d,g){const dd=-W[6]*(g-3);return clampD(W[7]*D0(4)+(1-W[7])*(d+(10-d)*dd/9))}
function forgetS(d,s,r){return Math.min(W[11]*Math.pow(d,-W[12])*(Math.pow(s+1,W[13])-1)*Math.exp((1-r)*W[14]),s/Math.exp(W[17]*W[18]))}
function recallS(d,s,r,g){return s*(1+Math.exp(W[8])*(11-d)*Math.pow(s,-W[9])*(Math.exp((1-r)*W[10])-1)*(g===2?W[15]:1)*(g===4?W[16]:1))}
// Same fuzz range as py-fsrs: review intervals of 3+ days may move a little, so cards learned together don't stay bunched.
function fuzzRange(days,max){if(days<2.5)return null;let dl=1;for(const [a,b,f] of [[2.5,7,.15],[7,20,.1],[20,Infinity,.05]])dl+=f*Math.max(Math.min(days,b)-a,0);
 let lo=Math.max(2,Math.round(days-dl)),hi=Math.min(Math.round(days+dl),max);return [Math.min(lo,hi),hi]}
// Study days start at 4 am local time (like Anki), so a card due "tomorrow" is due all of tomorrow.
const dayNum=t=>Math.floor((t-new Date(t).getTimezoneOffset()*MIN-4*36e5)/DAY);
// One review. k = {s,d,due,last,reps,lapses,st,step} (ms times, s=null for a new card); g = 1 Again, 2 Hard, 3 Good, 4 Easy.
// o = {ret, max (days), rand (random fuzz) or pick(lo, hi) (the load balancer chooses the day), neither = no fuzz}.
function review(k,g,now,o){const c=Object.assign({},k),el=c.last!=null?dayNum(now)-dayNum(c.last):null;let next=0;
 const upd=()=>{if(c.s==null){c.s=S0(g);c.d=D0(g)}else if(el!=null&&el<1){c.s=shortS(c.s,g);c.d=nextD(c.d,g)}
  else{const r=R(el,c.s);c.s=g===1?forgetS(c.d,c.s,r):recallS(c.d,c.s,r,g);c.d=nextD(c.d,g)}};
 const toReview=()=>{c.st=2;c.step=0;let n=ivl(c.s,o.ret,o.max);const fr=o.rand||o.pick?fuzzRange(n,o.max):null;
  if(fr)n=o.pick?o.pick(fr[0],fr[1]):Math.min(Math.round(o.rand()*(fr[1]-fr[0]+1)+fr[0]),o.max);next=n*DAY};
 const steps=a=>{if(c.step>a.length)return toReview();if(g===1){c.step=0;next=a[0]}else if(g===2)next=c.step===0?(a.length===1?a[0]*1.5:(a[0]+a[1])/2):a[c.step];
  else if(g===3){if(c.step+1>=a.length)toReview();else{c.step++;next=a[c.step]}}else toReview()};
 if(c.st===2){upd();if(g===1){c.st=3;c.step=0;c.lapses=(c.lapses||0)+1;next=RELEARN[0]}else toReview()}
 else if(c.st===3){upd();steps(RELEARN)}
 else{upd();c.st=1;steps(LEARN)}
 c.reps=(c.reps||0)+1;c.last=now;c.due=now+next;return c}
const r3=x=>Math.round(x*1000)/1000;
const pack=k=>[r3(k.s),r3(k.d),Math.round(k.due/MIN),Math.round(k.last/MIN),k.reps,k.lapses||0,k.st,k.step||0];
const unpack=a=>({s:a[0],d:a[1],due:a[2]*MIN,last:a[3]*MIN,reps:a[4],lapses:a[5],st:a[6],step:a[7]});
const NEWK={s:null,d:null,due:0,last:null,reps:0,lapses:0,st:0,step:0};
// how likely the card is remembered on study day `day` (0 = never studied, learning cards count as fragile)
function recall(a,day){if(!a)return 0;const k=unpack(a);return k.st===2?R(day-dayNum(k.last),k.s):.3}

/* ---------- deck ---------- */
let DECK=null,LOADING=null,ERR=false,CUR=null,LAST='',UNDO=null,DRAG=null,CRAM=null,STATS=false,CLASSC=[],VIEW=null,EDIT=null,AIC={};
const now=()=>Cards.clock?Cards.clock():Date.now();
function load(){if(DECK||LOADING)return LOADING;
 LOADING=fetch(CONFIG.cards).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(d=>{DECK=d.cards||[];ERR=false;LOADING=null;if(page==='cards')draw()})
  .catch(()=>{ERR=true;LOADING=null;if(page==='cards')draw()});loadClass();return LOADING}
// Class cards: approved suggestions (contrib_cards), kept for offline use
const CC_KEY=KEY+'_classcards',clozeNs=x=>[...new Set([...String(x).matchAll(/\{\{c(\d+)::/g)].map(m=>+m[1]))];
function classCard(it){if(!it||!it.id||!it.front)return [];const base={c:String(it.ch||''),t:it.topic||'Class card',by:it.by||'',cls:1};
 return /\{\{c\d+::/.test(it.front)?clozeNs(it.front).map(n=>Object.assign({i:it.id+'_'+n,x:it.front,n,b:it.back||'',k:'c'},base)):[Object.assign({i:it.id,f:it.front,b:it.back||'',k:'b'},base)]}
function loadClass(){try{CLASSC=JSON.parse(localStorage.getItem(CC_KEY))||[]}catch(e){CLASSC=[]}if(!cloudOn())return;
 rpc('contrib_cards',{p_course:KEY}).then(rows=>{CLASSC=(rows||[]).flatMap(r=>classCard(r.item));try{localStorage.setItem(CC_KEY,JSON.stringify(CLASSC))}catch(e){}if(page==='cards'&&DECK)draw()}).catch(()=>{})}
// Own cards (engine MYC); a cloze card makes one card per blank
function mineCards(){const out=[];for(const m of MYC.c){if(m.del)continue;const base={c:String(m.c||''),t:m.t||'',mine:m.i};
 if(m.k==='c')clozeNs(m.x).forEach(n=>out.push(Object.assign({i:m.i+'_'+n,x:m.x,n,b:m.b||'',k:'c'},base)));else out.push(Object.assign({i:m.i,f:m.f,b:m.b||'',k:'b'},base))}return out}
const allCards=()=>DECK.concat(CLASSC,mineCards()),live=c=>!(FC.sus&&FC.sus[c.i]&&FC.sus[c.i][0]);
const chOrder=()=>Object.keys(CONFIG.chapters||{});
const examChs=e=>e.chapters?e.chapters.map(String):[...new Set((e.sections||[]).map(s=>String(s).split('-')[0]))];
function decks(){const have=new Set(allCards().map(c=>c.c).filter(Boolean)),ord=chOrder(),chs=[...have].sort((a,b)=>(ord.indexOf(a)+1||999)-(ord.indexOf(b)+1||999)||String(a).localeCompare(b,undefined,{numeric:true})),out=[];
 for(const e of EXAMS){const s=examChs(e).filter(c=>have.has(c));if(s.length)out.push({id:'e:'+e.id,name:e.name+(e.date?' · '+fmtDay(e.date):''),chs:s})}
 if(chs.length>1)out.push({id:'all',name:'All '+unitsW,chs});
 for(const c of chs)out.push({id:'c:'+c,name:(/^\d/.test(c)?UNIT+' '+c+(CH_NAMES[c]?': ':''):'')+(CH_NAMES[c]||(/^\d/.test(c)?'':c)),chs:[c]});
 const mine=mineCards();if(mine.length)out.push({id:'mine',name:'My cards ('+MYC.c.filter(m=>!m.del).length+')',chs:[...new Set(mine.map(c=>c.c))],mine:1});
 return out}
// The deck picked here, else the exam chosen under "Studying for", else everything.
function deck(){const D=decks(),p=state.prefs.fcDeck,e=examObj();return D.find(d=>d.id===p)||(e&&D.find(d=>d.id==='e:'+e.id))||D.find(d=>d.id==='all')||D[0]}
function pool(){const dk=deck();if(dk.mine)return mineCards().filter(live);const s=new Set(dk.chs);return allCards().filter(c=>s.has(c.c)&&live(c))}
// The deck's next eval: an exam deck's own date, or the nearest dated exam that covers one of the deck's chapters.
function exam(dk){const td=dayNum(now());let best=null;
 for(const e of EXAMS){if(!e.date)continue;if(dk.id.slice(0,2)==='e:'?'e:'+e.id!==dk.id:!examChs(e).some(c=>dk.chs.includes(c)))continue;
  const left=dayNum(new Date(e.date+'T12:00').getTime())-td;if(left>=0&&(!best||left<best.left))best={name:e.name,left}}
 return best}
const pacing=()=>state.prefs.fcExam!==false&&DECK?exam(deck()):null;
const newCap=()=>+state.prefs.fcNew||40,revCap=()=>+state.prefs.fcRev||150;
function dayRoll(){const t=String(dayNum(now()));if(!Array.isArray(FC.day)||FC.day[0]!==t)FC.day=[t,0,0,0]}   // [study day, new, reviews, extra new allowed]
// New cards today: the daily limit, and with an eval coming, just enough to see every card by ~2 days before it.
function newAllow(unseen){dayRoll();const cap=Math.max(0,newCap()+FC.day[3]-FC.day[1]),e=pacing();if(!e||e.left<=2)return cap;
 return Math.min(cap,Math.max(0,Math.ceil((unseen+FC.day[1])/(e.left-1))-FC.day[1]+FC.day[3]))}
// Load balancer: among the days a review may move to, the one with the fewest reviews already due (the easy day counts triple).
function balancer(){const td=dayNum(now()),cnt={},easy=state.prefs.fcEasy==null?-1:+state.prefs.fcEasy;
 for(const id in FC.c){const a=FC.c[id];if(a[6]===2){const d=dayNum(a[2]*MIN)-td;cnt[d]=(cnt[d]||0)+1}}
 return (lo,hi)=>{let best=lo,bs=Infinity;for(let d=lo;d<=hi;d++){const wd=new Date(now()+d*DAY).getDay(),sc=(cnt[d]||0)*(wd===easy?3:1)+Math.random()*.5;if(sc<bs){bs=sc;best=d}}return best}}
// Intervals stop at the day before the eval, so every card comes back before it.
function opts(live){const e=pacing();return {ret:+state.prefs.fcRet||.88,max:e?Math.max(1,e.left-1):365,...(live?{pick:balancer()}:{})}}
function sortOut(){const t=now(),td=dayNum(t),L=[],N=[],soon=[];let Rv=[];
 for(const c of pool()){const a=FC.c[c.i];if(!a){N.push(c);continue}const due=a[2]*MIN;
  if(a[6]===2){if(dayNum(due)<=td)Rv.push(c)}else if(due<=t)L.push(c);else if(due<=t+AHEAD)soon.push([due,c]);}
 dayRoll();const rl=Math.max(0,revCap()-FC.day[2]),all=Rv.length;
 if(Rv.length>rl)Rv=Rv.map(c=>[recall(FC.c[c.i],td),c]).sort((a,b)=>a[0]-b[0]).slice(0,rl).map(x=>x[1]);   // a backlog: the most-forgotten first, the rest wait
 return {L,Rv,N,soon,nl:newAllow(N.length),rl,revAll:all}}
function counts(){const o=sortOut();return {lrn:o.L.length+o.soon.length,rev:Math.min(o.Rv.length,o.rl),nw:Math.min(o.N.length,o.nl),newAll:o.N.length,revAll:o.revAll}}
// Random order (no position memorizing): learning cards that are due first, then reviews and new cards mixed.
function pick(){const o=sortOut(),rnd=a=>{const b=a.length>1?a.filter(c=>c.i!==LAST):a;return b[Math.floor(Math.random()*b.length)]};
 if(o.L.length)return rnd(o.L);
 const nr=Math.min(o.Rv.length,o.rl),nn=Math.min(o.N.length,o.nl);
 if(nr||nn)return nn&&(!nr||Math.random()<nn/(nn+nr))?rnd(o.N):rnd(o.Rv);
 if(o.soon.length){o.soon.sort((a,b)=>a[0]-b[0]);return o.soon[0][1]}   // learn ahead up to 20 min, like Anki
 return null}

/* ---------- cram: the whole deck, weakest first; Again sends a card 3 back; nothing is rescheduled ---------- */
function cram(on){if(!on){CRAM=null;CUR=null;draw();return}const td=dayNum(now());
 CRAM={q:pool().map(c=>[recall(FC.c[c.i],td),Math.random(),c]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(x=>x[2]),done:0,seen:new Set()};CUR=null;draw()}

/* ---------- stats ---------- */
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function statsHTML(){const t=now(),td=dayNum(t),e=exam(deck()),P=pool(),at=e?td+e.left:td;let seen=0,ready=0,rv=0,ag=0;
 for(const c of P){const a=FC.c[c.i];if(!a)continue;seen++;if(a[6]===2&&recall(a,at)>=.8)ready++}
 for(let d=td-6;d<=td;d++){const x=(FC.h||{})[d];if(x){rv+=x[0];ag+=x[1]}}
 const days=window.Daily?Daily.data().days:{},cells=[];let mx=1;for(let i=29;i>=0;i--){const d=new Date(t);d.setDate(d.getDate()-i);const n=days[ymd(d)]||0;mx=Math.max(mx,n);cells.push([ymd(d),n])}
 const pct=P.length?Math.round(100*ready/P.length):0;
 return '<section class="panel fcstats"><h2>Your cards</h2><div class="fckpi">'+
  '<div><b>'+pct+'%</b><span>'+(e?'ready for '+esc(e.name):'you would recall today')+'</span><small>'+ready+' of '+P.length+' cards</small></div>'+
  '<div><b>'+(rv?Math.round(100*(rv-ag)/rv)+'%':'–')+'</b><span>remembered this week</span><small>'+rv+' review'+(rv===1?'':'s')+'</small></div>'+
  '<div><b>'+seen+'</b><span>cards started</span><small>'+(P.length-seen)+' still new</small></div></div>'+
  (Object.values(FC.sus||{}).some(x=>x[0])?'<p class="fcnote">'+Object.values(FC.sus).filter(x=>x[0]).length+' suspended card(s) are left out. <button class="link" onclick="Cards.unsuspend()">Turn them back on</button></p>':'')+
  '<p class="fchl">Last 30 days (questions and cards, every course)</p><div class="fcheat" role="img" aria-label="Activity in the last 30 days">'+cells.map(([d,n])=>'<i title="'+d+': '+n+'" style="--a:'+(n?(.25+.75*n/mx).toFixed(2):0)+'"></i>').join('')+'</div></section>'}

/* ---------- screen ---------- */
const $b=()=>$('fcbody');
const box=b=>'left:'+b[0]+'%;top:'+b[1]+'%;width:'+b[2]+'%;height:'+b[3]+'%';
function face(c,back){
 if(c.k==='o')return '<div class="fcio"><img src="'+esc(c.img)+'" alt="'+esc(c.t||'Diagram')+'">'+(c.bx||[]).map((b,i)=>'<i class="'+(i!==c.n?'m':back?'a':'q')+'" style="'+box(b)+'">'+(i===c.n&&!back?'?':'')+'</i>').join('')+'</div>'+
  (back?'<div class="fca">'+esc(c.b)+'</div>':'<div class="fcx">What is under the highlighted box?</div>');
 if(c.k==='c'){const x=esc(c.x).replace(/\{\{c(\d+)::(.+?)(?:::(.+?))?\}\}/g,(m,i,a,h)=>+i!==c.n?a:back?'<b class="fcz">'+a+'</b>':'<span class="fcz q">['+(h||'…')+']</span>');
  return '<div class="fcq">'+x+'</div>'+(back&&c.b?'<div class="fcx">'+esc(c.b)+'</div>':'')}
 return '<div class="fcq">'+esc(c.f)+'</div>'+(back?'<div class="fca">'+esc(c.b)+'</div>':'')}
function when(ms){const m=Math.max(1,Math.round(ms/MIN));return m<60?m+' min':m<1440?Math.round(m/60)+' h':m<43200?Math.round(m/1440)+' d':(m/43200).toFixed(m<432000?1:0).replace(/\.0$/,'')+' mo'}
function grades(){return state.prefs.fcFour?[[1,'Again'],[2,'Hard'],[3,'Good'],[4,'Easy']]:[[1,'Again'],[3,'Good']]}
function ring(left,done){const tot=left+done,p=tot?done/tot:1,C=2*Math.PI*15;
 return '<span class="fcring" role="img" aria-label="'+left+' left today"><svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="15" class="t"/>'+(p?'<circle cx="19" cy="19" r="15" class="f" stroke-dasharray="'+(C*p).toFixed(1)+' '+C.toFixed(1)+'"/>':'')+'</svg><b>'+left+'</b></span>'}
function cardHTML(c,flip,k){const tag=(/^\d/.test(c.c)?UNIT+' '+c.c+' · ':'')+(c.t||'')+(c.cls?' · Class card'+(c.by?' by '+c.by:''):c.mine?' · My card':'');
 return '<section class="card fccard'+(flip?' flip':'')+'" id="fccard" aria-live="polite"'+(flip?'':' role="button" tabindex="0" aria-label="Show the answer" onclick="Cards.flip()"')+'>'+
  '<div class="fctag">'+esc(tag)+(k.st===0?'<span class="fcpill n">New</span>':k.lapses>=4?'<span class="fcpill l" title="Missed '+k.lapses+' times">Tricky</span>':'')+'</div>'+face(c,flip)+'</section>'}
function draw(){const el=$b();if(!el)return;
 if(!DECK){if(ERR){el.innerHTML='<section class="panel"><h2>The cards could not be loaded</h2><p class="desc">Check your connection, then try again.</p><button class="btn" onclick="Cards.retry()">Try again</button></section>';return}
  if(!el.firstChild)el.innerHTML='<p class="desc">Loading the cards…</p>';load();return}
 if(!DECK.length){el.innerHTML='<section class="panel"><h2>No cards yet</h2><p class="desc">This course has no flashcards yet.</p></section>';return}
 if(CRAM){drawCram(el);return}
 if(VIEW==='mine'){el.innerHTML=mineHTML();return}
 const D=decks(),dk=deck(),e=pacing();
 if(CUR&&!pool().some(c=>c.i===CUR.c.i))CUR=null;
 if(!CUR){const c=pick();CUR=c?{c,flip:false}:null}
 const n=counts(),left=n.lrn+n.rev+n.nw,done=FC.day[1]+FC.day[2];
 let h='<div class="fcbar"><label class="fcdeck"><span>Deck</span><select onchange="setPref(\'fcDeck\',this.value)" aria-label="Deck">'+D.map(d=>'<option value="'+esc(d.id)+'"'+(d.id===dk.id?' selected':'')+'>'+esc(d.name)+'</option>').join('')+'</select></label>'+
  '<span class="fcstat"><span class="fccounts"><span class="cn" title="New cards left today">'+n.nw+'<small>new</small></span><span class="cl" title="Learning: seen today, coming back soon">'+n.lrn+'<small>learning</small></span><span class="cr" title="Reviews due today">'+n.rev+'<small>due</small></span></span>'+ring(left,done)+'</span></div>'+
  '<div class="fcmeta"><span>'+(e?'<b>'+esc(e.name)+' '+(e.left===0?'today':e.left===1?'tomorrow':'in '+e.left+' days')+'</b>'+(n.newAll&&e.left>2?' · about '+Math.ceil((n.newAll+FC.day[1])/(e.left-1))+' new a day to see them all in time':''):'')+
   (n.revAll>n.rev?(e?' · ':'')+(n.revAll-n.rev)+' more due, coming back over the next days':'')+'</span>'+
   '<button class="link" onclick="Cards.mine(true)">My cards</button><button class="link" onclick="Cards.cram(true)">Cram</button><button class="link" onclick="Cards.stats()" aria-expanded="'+STATS+'">Stats</button></div>';
 if(!CUR){const t=now(),nx=pool().map(c=>FC.c[c.i]).filter(Boolean).map(a=>a[2]*MIN).filter(d=>d>t).sort((a,b)=>a-b)[0];
  h+='<section class="card fcdone"><h2>'+(done?'All done for today':'Nothing due right now')+'</h2><p class="desc">'+(done?'You studied <b>'+done+'</b> card'+(done===1?'':'s')+' today. ':'')+
   (nx?'The next card comes back '+(dayNum(nx)===dayNum(t)?'in '+when(nx-t):dayNum(nx)===dayNum(t)+1?'tomorrow':'in '+(dayNum(nx)-dayNum(t))+' days')+'.':'')+'</p>'+
   (n.newAll?'<button class="btn" onclick="Cards.more()">Study 10 more new cards</button><p class="fcnote">'+n.newAll+' new card'+(n.newAll===1?'':'s')+' left in this deck. '+(e&&e.left>2?'New cards are spread over the days before '+esc(e.name)+'.':'The daily limit ('+newCap()+') is in Personalize.')+'</p>':'')+
   (e&&e.left<=3?'<button class="btn" onclick="Cards.cram(true)">Cram the deck</button>':'')+
   (UNDO?'<button class="link" onclick="Cards.undo()">Undo last card</button>':'')+'</section>'+(STATS?statsHTML():'');
  el.innerHTML=h;return}
 const c=CUR.c,k=FC.c[c.i]?unpack(FC.c[c.i]):NEWK;
 h+=cardHTML(c,CUR.flip,k);
 if(CUR.flip&&k.lapses>=4)h+=leechHTML(c,k);
 if(!CUR.flip)h+='<div class="fcbtns one"><button class="btn primary" onclick="Cards.flip()">Show answer</button></div>';
 else{const t=now();h+='<div class="fcbtns">'+grades().map(([g,l])=>{const nk=review(k,g,t,opts(false));return '<button class="btn fcg g'+g+'" onclick="Cards.grade('+g+')"><b>'+l+'</b><small>'+when(nk.due-t)+'</small></button>'}).join('')+'</div>'}
 h+='<p class="fckeys">'+(CUR.flip?(state.prefs.fcFour?'1 Again · 2 Hard · 3 Good · 4 Easy':'1 Again · 2 or Space Good')+' · or swipe left / right':'Space or tap the card to flip')+(UNDO?' · <button class="link" onclick="Cards.undo()">Undo</button>':'')+'</p>'+(STATS?statsHTML():'');
 el.innerHTML=h;swipe()}
// A card missed 4+ times: another angle (AI, built-in cards only), the notes, or set it aside
function leechHTML(c,k){const ai=AIC[c.i]||{},canAI=cloudOn()&&!c.cls&&!c.mine&&typeof aiPost==='function';
 return '<div class="fcleech"><b>You keep missing this one</b> (missed '+k.lapses+' times). Try a different angle, or set it aside for now.'+
  '<div class="fclr">'+(canAI&&!ai.text?'<button class="btn sm" onclick="Cards.explain()"'+(ai.busy?' disabled':'')+'>'+(ai.busy?'Thinking…':'Explain it differently')+'</button>':'')+
  (pageOn('notes')&&/^\d/.test(c.c)?'<button class="btn sm" onclick="openNotes(\''+esc(c.c)+'\')">Read the notes</button>':'')+
  '<button class="btn sm" onclick="Cards.suspend()">Suspend card</button></div>'+(ai.text?'<div class="fcai">'+esc(ai.text)+'</div>':ai.err?'<div class="fcai err">'+ai.err+'</div>':'')+'</div>'}
async function explain(){if(!CUR)return;const c=CUR.c;if(AIC[c.i]&&AIC[c.i].busy)return;AIC[c.i]={busy:1};draw();
 try{const o=await aiPost({course:courseId(),card:c.i});AIC[c.i]=o.r&&o.r.ok&&o.j.text?{text:o.j.text}:{err:aiErr(o,'explanations')}}catch(e){AIC[c.i]={err:'No connection. Try again when you\'re online.'}}
 if(CUR&&CUR.c.i===c.i)draw()}
function suspend(){if(!CUR)return;const id=CUR.c.i;(FC.sus||(FC.sus={}))[id]=[1,Date.now()];fcSave();CUR=null;toast('Card suspended. Turn it back on under Stats.');draw()}
function unsuspendAll(){for(const id in FC.sus||{})FC.sus[id]=[0,Date.now()];fcSave();draw()}

/* ---------- My cards: write, edit, delete, suggest to the class ---------- */
function mineHTML(){const list=MYC.c.filter(m=>!m.del).slice().reverse(),ed=EDIT&&MYC.c.find(m=>m.i===EDIT),chs=chOrder().filter(c=>/^\d/.test(c));
 const cur=ed?String(ed.c):(deck().chs||[])[0]||chs[chs.length-1]||'';
 return '<section class="panel fcmine"><h2>'+(ed?'Edit your card':'My cards')+'</h2><p class="desc">Your cards are saved with your progress and sync when you are signed in. Type <b>{{c1::word}}</b> on the front to make a fill-in-the-blank card (c2, c3 … for more blanks, each its own card).</p>'+
  '<div class="fcform"><label><span>'+esc(UNIT)+'</span><select id="fcmch">'+chs.map(c=>'<option value="'+esc(c)+'"'+(c===cur?' selected':'')+'>'+esc(UNIT+' '+c+(CH_NAMES[c]?': '+CH_NAMES[c]:''))+'</option>').join('')+'</select></label>'+
  '<label><span>Front</span><textarea id="fcmf" rows="2" maxlength="500" placeholder="A question, a term, or a sentence with {{c1::a blank}}">'+esc(ed?ed.k==='c'?ed.x:ed.f:'')+'</textarea></label>'+
  '<label><span>Back</span><textarea id="fcmb" rows="2" maxlength="800" placeholder="The answer (optional for fill-in-the-blank cards)">'+esc(ed?ed.b||'':'')+'</textarea></label>'+
  '<div class="fcfa"><span id="fcmmsg" class="fcnote"></span>'+(ed?'<button class="btn" onclick="Cards.mineEdit(null)">Cancel</button>':'')+'<button class="btn primary" onclick="Cards.mineSave()">'+(ed?'Save changes':'Add card')+'</button></div></div>'+
  (list.length?'<ul class="fclist">'+list.map(m=>'<li><div><b>'+esc((m.k==='c'?m.x:m.f).replace(/\{\{c\d+::(.+?)(::.+?)?\}\}/g,'[$1]'))+'</b>'+(m.b?'<span>'+esc(m.b.split('\n')[0])+'</span>':'')+
   '<small>'+esc(UNIT+' '+m.c)+(m.src?' · from a missed question':'')+(m.sug?' · suggested to the class':'')+'</small></div>'+
   '<span class="fcla"><button class="link" onclick="Cards.mineEdit(\''+m.i+'\')">Edit</button><button class="link" onclick="Cards.mineDel(\''+m.i+'\')">Delete</button>'+
   (contribOn()&&!m.sug?'<button class="link" onclick="Cards.mineSuggest(\''+m.i+'\')">Suggest to class</button>':'')+'</span></li>').join('')+'</ul>':'<p class="fcnote">No cards yet. You can also tap <b>+ Flashcard</b> after a wrong answer in Practice.</p>')+
  '<button class="btn" onclick="Cards.mine(false)">Back to studying</button></section>'}
function mineSave(){const f=($('fcmf').value||'').trim(),b=($('fcmb').value||'').trim(),ch=$('fcmch').value,cl=/\{\{c\d+::.+?\}\}/.test(f),msg=t=>{$('fcmmsg').textContent=t};
 if(f.length<3)return msg('Write the front first.');if(!cl&&!b)return msg('Add the answer on the back, or make a blank with {{c1::word}}.');
 const card=cl?{c:ch,k:'c',x:f,b,f:undefined}:{c:ch,k:'b',f,b,x:undefined},ed=EDIT&&MYC.c.find(m=>m.i===EDIT);
 if(ed){Object.assign(ed,card,{at:Date.now()});mcSave();EDIT=null;toast('Card saved.')}else{fcAddMine(card);toast('Card added.')}draw()}
function mineDel(id){ask('It is removed from your deck on every device.',{title:'Delete this card?',ok:'Delete',danger:1}).then(y=>{if(!y)return;const m=MYC.c.find(x=>x.i===id);if(m){Object.assign(m,{del:1,at:Date.now()});mcSave()}if(EDIT===id)EDIT=null;draw()})}
function mineSuggest(id){const m=MYC.c.find(x=>x.i===id);if(!m||m.sug)return;
 rpc('contrib_submit',{p_course:KEY,p_kind:'card',p_data:{ch:String(m.c||''),topic:m.t||'',front:m.k==='c'?m.x:m.f,back:m.b||'',name:lsGet(CONTRIB_NAME)||''},p_token:contribToken(true)})
  .then(sid=>{m.sug=sid;m.at=Date.now();mcSave();MINE.rows=[{id:sid,course:KEY,kind:'card',data:{ch:m.c,front:m.k==='c'?m.x:m.f},status:'pending',mod_note:null,created_at:new Date().toISOString(),reviewed_at:null}].concat(MINE.rows||[]);saveMine();
   toast('Sent to the moderator. Approved cards join everyone\'s deck.');draw()})
  .catch(e=>toast(/slow down/.test(e.message)?'A lot was sent just now. Try again in a few minutes.':'Could not send. Check your connection.'))}
function drawCram(el){const c=CRAM.q[0];
 let h='<div class="fcbar fccram"><span><b>Cram</b> · '+CRAM.q.length+' left · weakest first. Your schedule doesn\'t change.</span><button class="btn sm" onclick="Cards.cram(false)">Done cramming</button></div>';
 if(!c){h+='<section class="card fcdone"><h2>Deck crammed</h2><p class="desc">You went through all '+CRAM.done+' cards. Good luck!</p><button class="btn" onclick="Cards.cram(false)">Back to the deck</button></section>';el.innerHTML=h;return}
 if(!CUR||CUR.c!==c)CUR={c,flip:false};
 h+=cardHTML(c,CUR.flip,FC.c[c.i]?unpack(FC.c[c.i]):NEWK);
 h+=CUR.flip?'<div class="fcbtns"><button class="btn fcg g1" onclick="Cards.grade(1)"><b>Again</b><small>a few cards later</small></button><button class="btn fcg g3" onclick="Cards.grade(3)"><b>Good</b><small>done</small></button></div>'
  :'<div class="fcbtns one"><button class="btn primary" onclick="Cards.flip()">Show answer</button></div>';
 el.innerHTML=h;swipe()}
function flip(){if(!CUR||CUR.flip)return;CUR.flip=true;draw()}
function grade(g){if(!CUR||!CUR.flip)return;const c=CUR.c;
 if(CRAM){CRAM.q.shift();if(g===1)CRAM.q.splice(Math.min(3,CRAM.q.length),0,c);else CRAM.done++;if(!CRAM.seen.has(c.i)){CRAM.seen.add(c.i);dailyAdd(1)}CUR=null;draw();return}
 const old=FC.c[c.i]||null,k=old?unpack(old):NEWK;dayRoll();
 UNDO={id:c.i,old,day:FC.day.slice(),h:FC.h?JSON.stringify(FC.h):null,c};
 FC.c[c.i]=pack(review(k,g,now(),opts(true)));if(!old)FC.day[1]++;
 else if(k.st===2){FC.day[2]++;const td=dayNum(now()),H=FC.h||(FC.h={}),x=H[td]||(H[td]=[0,0]);x[0]++;if(g===1)x[1]++;for(const d in H)if(+d<td-60)delete H[d]}
 fcSave();if(!old||k.st===2)dailyAdd(1);if(typeof badgeAdd==='function')badgeAdd('cards',1);LAST=c.i;CUR=null;draw()}
function undo(){if(!UNDO)return;const u=UNDO;UNDO=null;if(u.old)FC.c[u.id]=u.old;else delete FC.c[u.id];FC.day=u.day;if(u.h)FC.h=JSON.parse(u.h);else delete FC.h;fcSave();CUR={c:u.c,flip:true};LAST='';draw()}
function more(){dayRoll();FC.day[3]+=10;fcSave();CUR=null;draw()}
// Phones: drag the flipped card left for Again, right for Good.
function swipe(){const el=$('fccard');if(!el||!CUR||!CUR.flip)return;
 el.onpointerdown=e=>{if(e.pointerType==='mouse')return;DRAG={x:e.clientX,y:e.clientY,dx:0}};
 el.onpointermove=e=>{if(!DRAG)return;DRAG.dx=e.clientX-DRAG.x;if(Math.abs(DRAG.dx)>Math.abs(e.clientY-DRAG.y)){el.style.transform='translateX('+DRAG.dx+'px) rotate('+DRAG.dx/40+'deg)';el.classList.toggle('sl',DRAG.dx<-40);el.classList.toggle('sr',DRAG.dx>40)}};
 el.onpointerup=el.onpointercancel=()=>{if(!DRAG)return;const dx=DRAG.dx;DRAG=null;el.style.transform='';el.classList.remove('sl','sr');if(Math.abs(dx)>80)grade(dx<0?1:3)}}
function key(e){const k=e.key;
 if(!CUR||VIEW)return false;
 if(!CUR.flip){if(k===' '||k==='Enter'){flip();return true}return false}
 if(k===' '||k==='Enter'){grade(3);return true}
 const g={'1':1,'2':state.prefs.fcFour&&!CRAM?2:3,'3':3,'4':state.prefs.fcFour&&!CRAM?4:0}[k];if(g){grade(g);return true}
 if((k==='u'||k==='U')&&!CRAM){undo();return true}
 return false}
window.Cards={draw,key,flip,grade,undo,more,cram,explain,suspend,unsuspend:unsuspendAll,
 mine:on=>{VIEW=on?'mine':null;EDIT=null;CUR=null;draw()},mineEdit:id=>{EDIT=id;draw();const f=$('fcmf');if(f)f.focus()},mineSave,mineDel,mineSuggest,stats:()=>{STATS=!STATS;draw()},retry:()=>{ERR=false;draw()},review,pack,unpack,dayNum,
 counts:()=>DECK?counts():null,pool:()=>DECK?pool():[],deck:()=>DECK&&deck(),exam:()=>DECK&&exam(deck()),opts,cur:()=>CUR&&CUR.c,cramming:()=>!!CRAM,clock:null,W};
})();
