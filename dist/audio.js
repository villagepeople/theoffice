// A small, self-contained office soundscape. No recordings, services, or microphones.
const PREF_KEY='benefits-office-audio-v1';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
const hash=text=>[...String(text)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
export class OfficeAudio {
  constructor({host=globalThis,storage,onChange=()=>{},random=Math.random}={}){
    this.host=host;this.random=random;this.onChange=onChange;this.storage=storage;
    this.prefs={enabled:true,master:.7,ambience:.42,effects:.65,voices:.8,readBanter:false,voiceURI:''};
    try{this.storage??=host.localStorage;const saved=JSON.parse(this.storage?.getItem(PREF_KEY)||'null');if(saved){for(const k of ['master','ambience','effects','voices'])if(Number.isFinite(saved[k]))this.prefs[k]=clamp(saved[k]);for(const k of ['enabled','readBanter'])if(typeof saved[k]==='boolean')this.prefs[k]=saved[k];if(typeof saved.voiceURI==='string')this.prefs.voiceURI=saved.voiceURI;}}catch{}
    this.context=null;this.unlocked=false;this.active=false;this.nodes=new Set();this.tagged=new Map();this.seen=new Set();this.queue=[];this.time=0;this.lastSpoken=-30;this.timers={typing:.3,paper:4,printer:12,chairs:7,steps:.35,ring:0,cell:0,microwave:0,music:0,alarm:0,siren:0};
    this.voices=[];this.refreshVoices=()=>{this.voices=(this.host.speechSynthesis?.getVoices()||[]).filter(v=>/^en\b/i.test(v.lang));this.onChange(this);};
    this.host.speechSynthesis?.addEventListener?.('voiceschanged',this.refreshVoices);this.refreshVoices();
  }
  set(key,value){if(['master','ambience','effects','voices'].includes(key))value=clamp(value);else if(['enabled','readBanter'].includes(key))value=!!value;else if(key!=='voiceURI')return;this.prefs[key]=value;try{this.storage?.setItem(PREF_KEY,JSON.stringify(this.prefs));}catch{}this.applyVolumes();if(!this.prefs.enabled||!this.prefs.voices||!this.prefs.master)this.stopSpeech();if(!this.prefs.enabled){this.stopTransient();this.context?.suspend()?.catch(()=>{});}this.onChange(this);}
  unlock(){
    this.unlocked=true;
    try{
      if(!this.context){const AudioContext=this.host.AudioContext||this.host.webkitAudioContext;if(AudioContext){const c=this.context=new AudioContext();this.master=c.createGain();this.master.connect(c.destination);this.lanes={};for(const name of ['ambience','effects']){const gain=c.createGain();gain.connect(this.master);this.lanes[name]=gain;}this.noiseBuffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate);this.roomBuffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const data=this.noiseBuffer.getChannelData(0),room=this.roomBuffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){const white=this.random()*2-1;last=(last+.025*white)/1.025;data[i]=white*.65;room[i]=last*8;}this.startRoomTone();}}
      if(this.prefs.enabled)this.context?.resume()?.catch(()=>{});this.applyVolumes();
    }catch{this.context=null;}
    this.onChange(this);
  }
  applyVolumes(){const c=this.context;if(!c)return;const t=c.currentTime;this.master.gain.setTargetAtTime(this.prefs.enabled&&this.active?this.prefs.master:0,t,.08);for(const k of ['ambience','effects'])this.lanes[k].gain.setTargetAtTime(this.prefs[k],t,.05);}
  setActive(active){active=!!active;if(active===this.active)return;this.active=active;if(!active){this.stopSpeech();this.stopTransient();this.context?.suspend()?.catch(()=>{});}else if(this.unlocked&&this.prefs.enabled)this.context?.resume()?.catch(()=>{});this.applyVolumes();}
  startRoomTone(){const c=this.context,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.roomBuffer;source.loop=true;filter.type='lowpass';filter.frequency.value=440;gain.gain.value=.035;source.connect(filter);filter.connect(gain);gain.connect(this.lanes.ambience);source.start();this.air=source;}
  route(node,lane,pan=0){if(this.context.createStereoPanner){const p=this.context.createStereoPanner();p.pan.value=clamp(pan,-1,1);node.connect(p);p.connect(this.lanes[lane]);return p;}node.connect(this.lanes[lane]);return null;}
  track(source,end,chain=[],tag=null){this.nodes.add(source);if(tag){if(!this.tagged.has(tag))this.tagged.set(tag,new Set());this.tagged.get(tag).add(source);}source.onended=()=>{this.nodes.delete(source);if(tag)this.tagged.get(tag)?.delete(source);source.disconnect?.();for(const node of chain)node?.disconnect?.();};source.stop(end);}
  tone(freq,duration=.08,{volume=.04,type='sine',lane='effects',delay=0,pan=0,endFreq,tag=null}={}){
    if(!this.context||!this.active||!this.prefs.enabled||!this.unlocked)return;
    const c=this.context,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(endFreq,t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);const panner=this.route(g,lane,pan);o.start(t);this.track(o,t+duration+.02,[g,panner],tag);
  }
  noise(duration,{volume=.04,freq=1600,band=1,lane='ambience',pan=0,delay=0,rate=1}={}){
    if(!this.context||!this.active||!this.prefs.enabled||!this.unlocked)return;
    const c=this.context,t=c.currentTime+delay,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noiseBuffer;s.playbackRate.value=rate;s.loop=duration>1;f.type='bandpass';f.frequency.value=freq;f.Q.value=band;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(volume,t+Math.min(.025,duration/4));g.gain.exponentialRampToValueAtTime(.0001,t+duration);s.connect(f);f.connect(g);const panner=this.route(g,lane,pan);s.start(t,this.random());this.track(s,t+duration+.02,[f,g,panner]);
  }
  pan(point,state){return point&&state?.player?clamp(((point.x-state.player.x)-(point.y-state.player.y))/1050,-.8,.8):0;}
  keyboard(){const pan=this.random()*1.6-.8,count=3+Math.floor(this.random()*7);for(let i=0;i<count;i++){const delay=i*(.045+this.random()*.065);this.noise(.025,{freq:1100+this.random()*2100,volume:.13,pan,delay,rate:1.7});this.tone(140+this.random()*100,.018,{volume:.025,lane:'ambience',pan,delay});}this.noise(.018,{volume:.2,freq:4200,delay:.65,pan});}
  printer(){const pan=this.random()*1.2-.6;this.tone(90,1.7,{volume:.026,type:'sawtooth',lane:'ambience',pan,endFreq:125});for(let i=0;i<3;i++)this.noise(.6,{freq:650,volume:.19,band:.6,delay:i*.75,pan});this.tone(510,.07,{volume:.018,lane:'ambience',delay:2.3,pan});}
  ring(pan=0,cell=false){if(cell){for(let i=0;i<4;i++)this.tone(i%2?880:660,.12,{volume:.055,delay:i*.16,pan});return;}for(const delay of [0,.27,.85,1.12])for(const freq of [440,480])this.tone(freq,.22,{volume:.055,delay,pan});}
  fireAlarm(){const duck=this.utterance?.officeKind==='fire'?.52:1;for(const delay of [0,.35,.7]){this.tone(1800,.23,{volume:.065*duck,type:'square',delay,tag:'alarm'});this.tone(2400,.23,{volume:.026*duck,type:'triangle',delay,tag:'alarm'});}}
  truckSiren(response,state){const volume=.012+.035*clamp(response.progress),assembly=state.layout?.stations?.find(s=>s.id==='assembly'),pan=this.pan(assembly,state);this.tone(500,.55,{volume,type:'triangle',endFreq:1050,pan,tag:'truck'});this.tone(1050,.55,{volume,type:'triangle',endFreq:500,delay:.55,pan,tag:'truck'});}
  stopTagged(tag){const sources=this.tagged.get(tag);if(sources)for(const n of sources){try{n.stop();}catch{}this.nodes.delete(n);}this.tagged.delete(tag);}
  stopTransient(){for(const n of this.nodes){try{n.stop();}catch{}}this.nodes.clear();this.tagged.clear();}
  stopSpeech(){this.queue=[];this.speechGeneration=(this.speechGeneration||0)+1;if(this.utterance)this.host.speechSynthesis?.cancel();this.utterance=null;}
  say(text,{speaker='Office',kind='banter',priority=0,preview=false}={}){
    if(!text||!this.unlocked||!this.prefs.enabled||!this.prefs.voices||!this.prefs.master||(!this.active&&!preview)||!this.host.speechSynthesis||!this.host.SpeechSynthesisUtterance)return false;
    if(priority>1&&this.utterance&&this.utterancePriority<priority)this.stopSpeech();
    this.queue=this.queue.filter(x=>x.expires>this.time);if(this.queue.length>=3){if(!priority)return false;this.queue.pop();}
    this.queue.push({text:String(text).slice(0,240),speaker,kind,priority,preview,expires:this.time+14});this.queue.sort((a,b)=>b.priority-a.priority);this.flushSpeech();return true;
  }
  flushSpeech(){
    const synth=this.host.speechSynthesis;if(this.utterance||!synth||!this.queue.length||!this.prefs.enabled||!this.prefs.voices||!this.prefs.master)return;
    const entry=this.queue.shift();if(entry.expires<=this.time)return;const u=new this.host.SpeechSynthesisUtterance(entry.text),n=hash(entry.speaker),selected=this.voices.find(v=>v.voiceURI===this.prefs.voiceURI);
    u.voice=selected||this.voices[n%Math.max(1,this.voices.length)]||null;u.lang=u.voice?.lang||'en-US';u.rate=entry.kind==='allclear'?.94:entry.kind==='summon'?1.01:1.02+(n%4)*.025;u.pitch=.91+(n%5)*.055;u.officeKind=entry.kind;u.volume=this.prefs.master*this.prefs.voices*(entry.kind==='banter'?.38:.83);
    const generation=this.speechGeneration||0;this.utterance=u;this.utterancePriority=entry.priority;this.lastSpoken=this.time;this.speechDeadline=this.time+Math.min(20,3+entry.text.length/9);
    const finish=()=>{if(generation!==(this.speechGeneration||0)||this.utterance!==u)return;this.utterance=null;this.flushSpeech();};u.onend=finish;u.onerror=finish;try{synth.speak(u);}catch{finish();}
  }
  resetSession(key,banter=[]){if(key===this.sessionKey)return;this.sessionKey=key;this.seen=new Set(banter.map(b=>b.id));this.stopSpeech();this.lastBrew=null;this.timers.ring=0;}
  discardHistory(banter=[]){this.seen=new Set(banter.map(b=>b.id));this.stopSpeech();}
  update(state,dt,{quiet=false,sessionKey='solo'}={}){
    this.time+=Math.min(.1,Math.max(0,dt||0));this.resetSession(sessionKey,state.banter||[]);
    const active=(state.phase==='playing'||this.time<(this.previewUntil||0))&&!quiet&&!this.host.document?.hidden;this.setActive(active);
    // Mark even muted/background messages seen, so returning never replays a backlog.
    const fresh=[...(state.banter||[])].reverse().filter(e=>!this.seen.has(e.id));for(const e of state.banter||[])this.seen.add(e.id);if(this.seen.size>250)this.seen=new Set((state.banter||[]).map(e=>e.id));
    const fire=state.event?.type==='fire',response=state.fireResponse;
    if(fire&&state.event.id!==this.fireId){this.stopTransient();this.stopSpeech();this.timers.alarm=0;this.timers.siren=0;this.fireId=state.event.id;}
    if(!fire&&this.fireId){this.stopTagged('alarm');if(this.utterance?.officeKind==='fire')this.stopSpeech();else this.queue=this.queue.filter(e=>e.kind!=='fire');Object.assign(this.timers,{typing:.6,paper:4,printer:12,chairs:7});this.fireId=null;}
    if(response?.stage!=='enroute')this.stopTagged('truck');
    if(!this.active||!this.unlocked||!this.prefs.enabled)return;
    for(const entry of fresh){const kind=entry.kind||'banter';if(fire&&!['fire','allclear'].includes(kind)||!fire&&kind==='fire')continue;const priority=kind==='allclear'?5:kind==='fire'?4:kind==='summon'?3:kind==='queue'?2:kind==='manager'?1:0;if(priority||this.prefs.readBanter||this.time-this.lastSpoken>16){if(!this.prefs.readBanter&&!priority&&kind!=='banter')continue;this.say(entry.text,{speaker:entry.speaker||entry.name,kind,priority});}}
    if(this.utterance&&this.time>this.speechDeadline){this.stopSpeech();this.lastSpoken=this.time;}this.flushSpeech();
    for(const key of Object.keys(this.timers))this.timers[key]-=dt;
    if(!fire&&this.timers.typing<=0){this.keyboard();this.timers.typing=.8+this.random()*2.4;}
    if(!fire&&this.timers.paper<=0){this.noise(.45,{freq:2100,volume:.11,pan:this.random()*1.4-.7,band:.5});this.timers.paper=9+this.random()*15;}
    if(!fire&&this.timers.printer<=0){this.printer();this.timers.printer=24+this.random()*24;}
    if(!fire&&this.timers.chairs<=0){this.tone(290,.3,{volume:.013,type:'triangle',lane:'ambience',endFreq:170,pan:this.random()-.5});this.noise(.18,{volume:.14,freq:420});this.timers.chairs=11+this.random()*15;}
    const walkers=[state.player,...(state.managers||[]),...(state.npcs||[])].filter(p=>p.walk&&!p.hidden);if(walkers.length&&this.timers.steps<=0){const who=walkers[Math.floor(this.random()*walkers.length)];this.noise(.065,{volume:who===state.player?.22:.1,freq:230,band:.6,pan:this.pan(who,state)});this.timers.steps=.28+this.random()*.15;}
    const call=(state.layout?.stations||[]).find(d=>d.id==='call');if(state.phoneQueue?.ringing&&state.phoneQueue.waiting>0&&state.event?.type!=='fire'&&this.timers.ring<=0){this.ring(this.pan(call,state));this.timers.ring=4.5;}
    const e=state.event;if(e?.type==='phone'&&this.timers.cell<=0){this.ring(-.35,true);this.timers.cell=8;}
    if(e?.type==='microwave'&&this.timers.microwave<=0){for(const delay of [0,.22,.44])this.tone(1600,.09,{volume:.033,delay,pan:.6});this.timers.microwave=7;}
    if(e?.type==='music'&&this.timers.music<=0){for(let i=0;i<4;i++)this.tone([110,146.8,130.8,98][i],.16,{volume:.038,type:'triangle',delay:i*.32,pan:-.5});this.timers.music=1.6;}
    if(fire&&this.timers.alarm<=0){this.fireAlarm();this.timers.alarm=1.65;}
    if(response?.stage==='enroute'&&this.timers.siren<=0){this.truckSiren(response,state);this.timers.siren=1.2;}
    const coffee=state.coffee;if(coffee?.status==='brewing'&&coffee.brewId!==this.lastBrew){this.lastBrew=coffee.brewId;this.noise(3,{volume:.17,freq:750,band:.4,lane:'effects',pan:.45});for(let i=0;i<6;i++)this.tone(160+i*20,.08,{volume:.02,delay:.35*i,lane:'effects',pan:.45});}
  }
  preview(){this.unlock();this.previewUntil=this.time+10;this.setActive(true);this.keyboard();this.ring(.3);this.say('Could someone help with the phone queue, please? Upper management needs a little teamwork.',{speaker:'Jordan Rush',kind:'summon',priority:3,preview:true});}
  destroy(){this.stopSpeech();this.stopTransient();this.host.speechSynthesis?.removeEventListener?.('voiceschanged',this.refreshVoices);try{this.air?.stop();}catch{}this.context?.close();}
}
