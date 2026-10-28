/* Sound effects for the live quiz, made in the browser with Web Audio (no audio files).
   Sfx.music('lobby'|'q'|null, force, volume)  looping background music (players use a lower volume)     Sfx.countdown(msLeft) / Sfx.stopCount()  ticks that speed up
   Sfx.join() Sfx.go() Sfx.tap() Sfx.reveal() Sfx.correct() Sfx.wrong() Sfx.drumroll() Sfx.fanfare() Sfx.over()
   Sfx.muted() / Sfx.toggle()   remembered on this device. Nothing plays before the first tap (browsers block that);
   on an iPhone the silent switch mutes it, which is what people expect. */
window.Sfx=(function(){
 const KEY='reviewer_quiz_mute';
 let ctx=null,master=null,mute=false,song=null,songName=null,vol=1,timer=null,step=0,nextT=0,ticks=[];
 try{mute=localStorage.getItem(KEY)==='1'}catch(e){}
 const mtof=m=>440*Math.pow(2,(m-69)/12);
 function boot(){if(ctx)return ctx;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  try{ctx=new AC();const comp=ctx.createDynamicsCompressor();master=ctx.createGain();master.gain.value=mute?0:.55;master.connect(comp);comp.connect(ctx.destination)}catch(e){ctx=null}return ctx}
 function unlock(){const c=boot();if(c&&c.state==='suspended')c.resume().catch(()=>{});if(c&&c.state==='running'&&songName&&!timer)music(songName)}
 ['pointerdown','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,unlock,{passive:true}));
 document.addEventListener('visibilitychange',()=>{if(ctx&&document.visibilityState==='hidden'){clearInterval(timer);timer=null}else if(songName&&ctx&&ctx.state==='running'&&!timer)music(songName,true)});
 function tone(f,t,d,type,g,to){if(!ctx||mute)return;const o=ctx.createOscillator(),a=ctx.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+d);
  a.gain.setValueAtTime(0.0001,t);a.gain.exponentialRampToValueAtTime(g||.2,t+.012);a.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(a);a.connect(master);o.start(t);o.stop(t+d+.05)}
 function noise(t,d,g,lo,hi){if(!ctx||mute)return;const n=Math.floor(ctx.sampleRate*d),b=ctx.createBuffer(1,n,ctx.sampleRate),x=b.getChannelData(0);for(let i=0;i<n;i++)x[i]=Math.random()*2-1;
  const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),a=ctx.createGain();s.buffer=b;f.type='bandpass';f.frequency.value=lo||800;f.Q.value=hi||.8;
  a.gain.setValueAtTime(g,t);a.gain.exponentialRampToValueAtTime(0.0001,t+d);s.connect(f);f.connect(a);a.connect(master);s.start(t)}
 // looping music: a step sequencer scheduled a little ahead of the clock
 const SONGS={
  lobby:{bpm:116,mel:[60,64,67,72,67,64,67,64,62,65,69,74,69,65,69,65],bass:[48,0,0,0,48,0,0,0,50,0,0,0,50,0,0,0],wave:'triangle',g:.075},
  q:{bpm:136,mel:[57,60,64,69,64,60,64,60,55,59,62,67,62,59,62,59],bass:[45,0,45,0,45,0,45,0,43,0,43,0,43,0,43,0],wave:'square',g:.04}};
 function music(name,force,v){songName=name||null;if(v!=null)vol=v;if(!name){clearInterval(timer);timer=null;song=null;return}
  if(!boot())return;if(song===SONGS[name]&&timer&&!force)return;clearInterval(timer);song=SONGS[name];step=0;nextT=ctx.currentTime+.08;
  const run=()=>{if(!ctx||ctx.state!=='running')return;const sd=60/song.bpm/2;if(nextT<ctx.currentTime)nextT=ctx.currentTime+.05;
   while(nextT<ctx.currentTime+.4){const i=step%16,m=song.mel[i],b=song.bass[i];
    if(m)tone(mtof(m),nextT,sd*1.6,song.wave,song.g*vol);if(b)tone(mtof(b),nextT,sd*1.8,'sine',.13*vol);
    if(i%4===2)noise(nextT,.04,.025*vol,6000,.5);nextT+=sd;step++}};
  timer=setInterval(run,100);run()}
 function stopCount(){ticks.forEach(clearTimeout);ticks=[]}
 // one tick a second for the last 5 seconds, then two a second for the last 3, higher each time
 function countdown(msLeft){stopCount();if(!boot())return;const at=[];for(let s=5;s>=1;s--)at.push(s*1000);for(let s=2.5;s>=.5;s-=1)at.push(s*1000);
  at.sort((a,b)=>b-a).forEach(t=>{const w=msLeft-t;if(w<0)return;ticks.push(setTimeout(()=>{if(!ctx||ctx.state!=='running')return;const u=1-t/5000;tone(900+u*700,ctx.currentTime,.07,'square',.09+u*.07)},w))})}
 const at=()=>ctx&&ctx.state==='running'?ctx.currentTime:0;
 const play=fn=>{if(!boot()||ctx.state!=='running')return;fn(ctx.currentTime+.01)};
 return {
  music,countdown,stopCount,unlock,
  muted:()=>mute,
  toggle(){mute=!mute;try{localStorage.setItem(KEY,mute?'1':'0')}catch(e){}if(master)master.gain.value=mute?0:.55;if(mute){stopCount()}else if(songName)music(songName,true);return mute},
  join(){play(t=>{tone(660,t,.09,'triangle',.16);tone(990,t+.08,.14,'triangle',.16)})},
  go(){play(t=>{tone(300,t,.25,'sawtooth',.07,900);noise(t,.2,.05,2500,.6)})},
  tap(){play(t=>tone(520,t,.07,'triangle',.14))},
  reveal(){play(t=>{noise(t,.25,.12,1500,.7);tone(523,t+.05,.3,'triangle',.14)})},
  correct(){play(t=>{[523,659,784,1047].forEach((f,i)=>tone(f,t+i*.08,.28,'triangle',.2));tone(1568,t+.32,.45,'sine',.12)})},
  wrong(){play(t=>{tone(220,t,.4,'sawtooth',.13,110);tone(165,t+.05,.4,'square',.07,90)})},
  drumroll(ms){const len=(ms||1700)/1000;play(t=>{let x=t,gap=.11;while(x<t+len){noise(x,.07,.2,350,.9);gap=Math.max(.035,gap*.93);x+=gap}tone(110,t,len,'sine',.1,160)})},
  fanfare(){play(t=>{const n=[[392,0,.16],[392,.18,.16],[392,.36,.16],[523,.54,.5],[440,1.06,.16],[523,1.24,.7]];
   n.forEach(([f,d,l])=>{tone(f,t+d,l+.15,'sawtooth',.09);tone(f*2,t+d,l+.15,'triangle',.07)});tone(131,t+.54,1.4,'triangle',.14)})},
  over(){play(t=>{[392,330,262].forEach((f,i)=>tone(f,t+i*.18,.35,'triangle',.15))})}};
})();
// A small sound on/off button for the page corner
(function(){function add(){if(document.getElementById('sfxbtn'))return;const b=document.createElement('button');b.id='sfxbtn';b.type='button';
 const paint=()=>{const m=Sfx.muted();b.textContent=m?'🔇':'🔊';b.setAttribute('aria-label',m?'Sound is off. Turn sound on':'Sound is on. Turn sound off');b.title=m?'Sound off':'Sound on'};
 b.style.cssText='position:fixed;top:max(10px,env(safe-area-inset-top,0px));right:max(10px,env(safe-area-inset-right,0px));z-index:50;width:40px;height:40px;border-radius:50%;border:1px solid var(--line2);background:var(--surface);color:var(--text);font-size:18px;cursor:pointer;line-height:1';
 b.onclick=()=>{Sfx.unlock();Sfx.toggle();paint()};paint();document.body.appendChild(b)}
 if(document.body)add();else document.addEventListener('DOMContentLoaded',add)})();
