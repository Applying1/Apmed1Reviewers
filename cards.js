/* =====================================================================
   FLASHCARDS (v98): loaded by the engine the first time the Flashcards page opens. Source: src/cards.js (build_site.py copies it).
   The deck comes from courses/<id>.cards.json (built from the notes, term/definition items and cards_src/). What each card's
   memory is lives in the engine (FC, fcSave, synced as "fc"): [stability, difficulty, due, last review, reps, lapses, state, step],
   times in minutes since 1970, state 1 learning, 2 review, 3 relearning (a new card has no entry yet).
   Scheduling is FSRS-5, ported from py-fsrs 4.1.2 (same formulas, same learning steps); tests/fsrs_ref.json checks it.
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
// Same fuzz as py-fsrs: review intervals of 3+ days move a little, so cards learned together don't stay bunched.
function fuzz(days,max,rand){if(days<2.5)return days;let dl=1;for(const [a,b,f] of [[2.5,7,.15],[7,20,.1],[20,Infinity,.05]])dl+=f*Math.max(Math.min(days,b)-a,0);
 let lo=Math.max(2,Math.round(days-dl)),hi=Math.min(Math.round(days+dl),max);lo=Math.min(lo,hi);return Math.min(Math.round(rand()*(hi-lo+1)+lo),max)}
// Study days start at 4 am local time (like Anki), so a card due "tomorrow" is due all of tomorrow.
const dayNum=t=>Math.floor((t-new Date(t).getTimezoneOffset()*MIN-4*36e5)/DAY);
// One review. k = {s,d,due,last,reps,lapses,st,step} (ms times, s=null for a new card); g = 1 Again, 2 Hard, 3 Good, 4 Easy.
// o = {ret, max (days), rand (null = no fuzz)}. Returns the new k.
function review(k,g,now,o){const c=Object.assign({},k),el=c.last!=null?dayNum(now)-dayNum(c.last):null;let next=0;
 const upd=()=>{if(c.s==null){c.s=S0(g);c.d=D0(g)}else if(el!=null&&el<1){c.s=shortS(c.s,g);c.d=nextD(c.d,g)}
  else{const r=R(el,c.s);c.s=g===1?forgetS(c.d,c.s,r):recallS(c.d,c.s,r,g);c.d=nextD(c.d,g)}};
 const toReview=()=>{c.st=2;c.step=0;let n=ivl(c.s,o.ret,o.max);if(o.rand)n=fuzz(n,o.max,o.rand);next=n*DAY};
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

/* ---------- deck ---------- */
let DECK=null,LOADING=null,ERR=false,CUR=null,LAST='',UNDO=null,DRAG=null;
const now=()=>Cards.clock?Cards.clock():Date.now();
function load(){if(DECK||LOADING)return LOADING;
 LOADING=fetch(CONFIG.cards).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(d=>{DECK=d.cards||[];ERR=false;LOADING=null;if(page==='cards')draw()})
  .catch(()=>{ERR=true;LOADING=null;if(page==='cards')draw()});return LOADING}
const chOrder=()=>Object.keys(CONFIG.chapters||{});
const examChs=e=>e.chapters?e.chapters.map(String):[...new Set((e.sections||[]).map(s=>String(s).split('-')[0]))];
function decks(){const have=new Set(DECK.map(c=>c.c)),ord=chOrder(),chs=[...have].sort((a,b)=>(ord.indexOf(a)+1||999)-(ord.indexOf(b)+1||999)||String(a).localeCompare(b,undefined,{numeric:true})),out=[];
 for(const e of EXAMS){const s=examChs(e).filter(c=>have.has(c));if(s.length)out.push({id:'e:'+e.id,name:e.name+(e.date?' · '+fmtDay(e.date):''),chs:s})}
 if(chs.length>1)out.push({id:'all',name:'All '+unitsW,chs});
 for(const c of chs)out.push({id:'c:'+c,name:(/^\d/.test(c)?UNIT+' '+c+(CH_NAMES[c]?': ':''):'')+(CH_NAMES[c]||(/^\d/.test(c)?'':c)),chs:[c]});
 return out}
// The deck picked here, else the exam chosen under "Studying for", else everything.
function deck(){const D=decks(),p=state.prefs.fcDeck,e=examObj();return D.find(d=>d.id===p)||(e&&D.find(d=>d.id==='e:'+e.id))||D.find(d=>d.id==='all')||D[0]}
function pool(){const s=new Set(deck().chs);return DECK.filter(c=>s.has(c.c))}
const newCap=()=>+state.prefs.fcNew||40,revCap=()=>+state.prefs.fcRev||150;
function dayRoll(){const t=String(dayNum(now()));if(!Array.isArray(FC.day)||FC.day[0]!==t)FC.day=[t,0,0,0]}   // [study day, new, reviews, extra new allowed]
const opts=fz=>({ret:+state.prefs.fcRet||.88,max:365,rand:fz?Math.random:null});
function sortOut(){const t=now(),td=dayNum(t),L=[],Rv=[],N=[],soon=[];
 for(const c of pool()){const a=FC.c[c.i];if(!a){N.push(c);continue}const due=a[2]*MIN;
  if(a[6]===2){if(dayNum(due)<=td)Rv.push(c)}else if(due<=t)L.push(c);else if(due<=t+AHEAD)soon.push([due,c]);}
 dayRoll();return {L,Rv,N,soon,nl:Math.max(0,newCap()+FC.day[3]-FC.day[1]),rl:Math.max(0,revCap()-FC.day[2])}}
function counts(){const o=sortOut();return {lrn:o.L.length+o.soon.length,rev:Math.min(o.Rv.length,o.rl),nw:Math.min(o.N.length,o.nl),newAll:o.N.length,revAll:o.Rv.length}}
// Random order (no position memorizing): learning cards that are due first, then reviews and new cards mixed.
function pick(){const o=sortOut(),rnd=a=>{const b=a.length>1?a.filter(c=>c.i!==LAST):a;return b[Math.floor(Math.random()*b.length)]};
 if(o.L.length)return rnd(o.L);
 const nr=Math.min(o.Rv.length,o.rl),nn=Math.min(o.N.length,o.nl);
 if(nr||nn)return nn&&(!nr||Math.random()<nn/(nn+nr))?rnd(o.N):rnd(o.Rv);
 if(o.soon.length){o.soon.sort((a,b)=>a[0]-b[0]);return o.soon[0][1]}   // learn ahead up to 20 min, like Anki
 return null}

/* ---------- screen ---------- */
const $b=()=>$('fcbody');
function face(c,back){
 if(c.k==='c'){const x=esc(c.x).replace(/\{\{c(\d+)::(.+?)(?:::(.+?))?\}\}/g,(m,i,a,h)=>+i!==c.n?a:back?'<b class="fcz">'+a+'</b>':'<span class="fcz q">['+(h||'…')+']</span>');
  return '<div class="fcq">'+x+'</div>'+(back&&c.b?'<div class="fcx">'+esc(c.b)+'</div>':'')}
 return '<div class="fcq">'+esc(c.f)+'</div>'+(back?'<div class="fca">'+esc(c.b)+'</div>':'')}
function when(ms){const m=Math.max(1,Math.round(ms/MIN));return m<60?m+' min':m<1440?Math.round(m/60)+' h':m<43200?Math.round(m/1440)+' d':(m/43200).toFixed(m<432000?1:0).replace(/\.0$/,'')+' mo'}
function grades(){return state.prefs.fcFour?[[1,'Again'],[2,'Hard'],[3,'Good'],[4,'Easy']]:[[1,'Again'],[3,'Good']]}
function ring(left,done){const tot=left+done,p=tot?done/tot:1,C=2*Math.PI*15;
 return '<span class="fcring" role="img" aria-label="'+left+' left today"><svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="15" class="t"/>'+(p?'<circle cx="19" cy="19" r="15" class="f" stroke-dasharray="'+(C*p).toFixed(1)+' '+C.toFixed(1)+'"/>':'')+'</svg><b>'+left+'</b></span>'}
function draw(){const el=$b();if(!el)return;
 if(!DECK){if(ERR){el.innerHTML='<section class="panel"><h2>The cards could not be loaded</h2><p class="desc">Check your connection, then try again.</p><button class="btn" onclick="Cards.retry()">Try again</button></section>';return}
  if(!el.firstChild)el.innerHTML='<p class="desc">Loading the cards…</p>';load();return}
 if(!DECK.length){el.innerHTML='<section class="panel"><h2>No cards yet</h2><p class="desc">This course has no flashcards yet.</p></section>';return}
 const D=decks(),dk=deck();
 if(CUR&&!pool().some(c=>c.i===CUR.c.i))CUR=null;
 if(!CUR){const c=pick();CUR=c?{c,flip:false}:null}
 const n=counts(),left=n.lrn+n.rev+n.nw,done=FC.day[1]+FC.day[2];
 let h='<div class="fcbar"><label class="fcdeck"><span>Deck</span><select onchange="setPref(\'fcDeck\',this.value)" aria-label="Deck">'+D.map(d=>'<option value="'+esc(d.id)+'"'+(d.id===dk.id?' selected':'')+'>'+esc(d.name)+'</option>').join('')+'</select></label>'+
  '<span class="fcstat"><span class="fccounts"><span class="cn" title="New cards left today">'+n.nw+'<small>new</small></span><span class="cl" title="Learning: seen today, coming back soon">'+n.lrn+'<small>learning</small></span><span class="cr" title="Reviews due today">'+n.rev+'<small>due</small></span></span>'+ring(left,done)+'</span></div>';
 if(!CUR){const t=now(),nx=pool().map(c=>FC.c[c.i]).filter(Boolean).map(a=>a[2]*MIN).filter(d=>d>t).sort((a,b)=>a-b)[0];
  h+='<section class="card fcdone"><h2>'+(done?'All done for today':'Nothing due right now')+'</h2><p class="desc">'+(done?'You studied <b>'+done+'</b> card'+(done===1?'':'s')+' today. ':'')+
   (nx?'The next card comes back '+(dayNum(nx)===dayNum(t)?'in '+when(nx-t):dayNum(nx)===dayNum(t)+1?'tomorrow':'in '+(dayNum(nx)-dayNum(t))+' days')+'.':'')+'</p>'+
   (n.newAll?'<button class="btn" onclick="Cards.more()">Study 10 more new cards</button><p class="fcnote">'+n.newAll+' new card'+(n.newAll===1?'':'s')+' left in this deck. The daily limit ('+newCap()+') is in Personalize.</p>':'')+
   (UNDO?'<button class="link" onclick="Cards.undo()">Undo last card</button>':'')+'</section>';
  $b().innerHTML=h;return}
 const c=CUR.c,k=FC.c[c.i]?unpack(FC.c[c.i]):NEWK,tag=(/^\d/.test(c.c)?UNIT+' '+c.c+' · ':'')+(c.t||'');
 h+='<section class="card fccard'+(CUR.flip?' flip':'')+'" id="fccard" aria-live="polite"'+(CUR.flip?'':' role="button" tabindex="0" aria-label="Show the answer" onclick="Cards.flip()"')+'>'+
  '<div class="fctag">'+esc(tag)+(k.st===0?'<span class="fcpill n">New</span>':k.lapses>=4?'<span class="fcpill l" title="Missed '+k.lapses+' times">Tricky</span>':'')+'</div>'+face(c,CUR.flip)+'</section>';
 if(!CUR.flip)h+='<div class="fcbtns one"><button class="btn primary" onclick="Cards.flip()">Show answer</button></div>';
 else{const t=now();h+='<div class="fcbtns">'+grades().map(([g,l])=>{const nk=review(k,g,t,opts(false));return '<button class="btn fcg g'+g+'" onclick="Cards.grade('+g+')"><b>'+l+'</b><small>'+when(nk.due-t)+'</small></button>'}).join('')+'</div>'}
 h+='<p class="fckeys">'+(CUR.flip?(state.prefs.fcFour?'1 Again · 2 Hard · 3 Good · 4 Easy':'1 Again · 2 or Space Good')+' · or swipe left / right':'Space or tap the card to flip')+(UNDO?' · <button class="link" onclick="Cards.undo()">Undo</button>':'')+'</p>';
 el.innerHTML=h;swipe()}
function flip(){if(!CUR||CUR.flip)return;CUR.flip=true;draw()}
function grade(g){if(!CUR||!CUR.flip)return;const c=CUR.c,old=FC.c[c.i]||null,k=old?unpack(old):NEWK;dayRoll();
 UNDO={id:c.i,old,day:FC.day.slice(),c};
 FC.c[c.i]=pack(review(k,g,now(),opts(true)));if(!old)FC.day[1]++;else if(k.st===2)FC.day[2]++;
 fcSave();if(!old||k.st===2)dailyAdd(1);LAST=c.i;CUR=null;draw()}
function undo(){if(!UNDO)return;const u=UNDO;UNDO=null;if(u.old)FC.c[u.id]=u.old;else delete FC.c[u.id];FC.day=u.day;fcSave();CUR={c:u.c,flip:true};LAST='';draw()}
function more(){dayRoll();FC.day[3]+=10;fcSave();CUR=null;draw()}
// Phones: drag the flipped card left for Again, right for Good.
function swipe(){const el=$('fccard');if(!el||!CUR||!CUR.flip)return;
 el.onpointerdown=e=>{if(e.pointerType==='mouse')return;DRAG={x:e.clientX,y:e.clientY,dx:0}};
 el.onpointermove=e=>{if(!DRAG)return;DRAG.dx=e.clientX-DRAG.x;if(Math.abs(DRAG.dx)>Math.abs(e.clientY-DRAG.y)){el.style.transform='translateX('+DRAG.dx+'px) rotate('+DRAG.dx/40+'deg)';el.classList.toggle('sl',DRAG.dx<-40);el.classList.toggle('sr',DRAG.dx>40)}};
 el.onpointerup=el.onpointercancel=()=>{if(!DRAG)return;const dx=DRAG.dx;DRAG=null;el.style.transform='';el.classList.remove('sl','sr');if(Math.abs(dx)>80)grade(dx<0?1:3)}}
function key(e){const k=e.key;
 if(!CUR)return false;
 if(!CUR.flip){if(k===' '||k==='Enter'){flip();return true}return false}
 if(k===' '||k==='Enter'){grade(3);return true}
 const g={'1':1,'2':state.prefs.fcFour?2:3,'3':3,'4':state.prefs.fcFour?4:0}[k];if(g){grade(g);return true}
 if(k==='u'||k==='U'){undo();return true}
 return false}
window.Cards={draw,key,flip,grade,undo,more,retry:()=>{ERR=false;draw()},review,pack,unpack,dayNum,counts:()=>DECK?counts():null,deck:()=>DECK&&deck(),cur:()=>CUR&&CUR.c,clock:null,W};
})();
