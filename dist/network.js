const ROOM_KEY = 'benefits-online-session-v2';

export class OfficeNetwork {
  constructor(model, {onChange=()=>{}, onStatus=()=>{}}={}) {
    this.model=model; this.onChange=onChange; this.onStatus=onStatus;
    this.active=false; this.room=null; this.pending=[]; this.waiters=new Map();
    this.sequence=0; this.inflight=false; this.lastInput=0; this.lastMove=0; this.failures=0;
  }
  async request(path, body, authenticated=false) {
    const headers={'Content-Type':'application/json'};
    if(authenticated)headers.Authorization='Bearer '+this.session.token;
    const response=await fetch(path,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
    const data=await response.json().catch(()=>({error:'The office server could not respond.'}));
    if(!response.ok){const error=new Error(data.error?.message||data.error||data.message||'The office could not be reached.');error.status=response.status;throw error;}
    return data;
  }
  async connect(mode,config,layout,code='') {
    this.stop(); this.onStatus('Connecting…');
    const path=mode==='join'?'/api/rooms/'+encodeURIComponent(code.trim().toUpperCase())+'/join':'/api/rooms';
    const data=await this.request(path,{config,layout});
    this.session={code:data.code,playerId:data.playerId,token:data.token};
    this.sequence=data.ack||0;this.active=true;this.apply(data.snapshot);
    this.persist();this.onStatus('Online');this.schedule(250);return data;
  }
  savedSession(){try{return JSON.parse(sessionStorage.getItem(ROOM_KEY));}catch{return null;}}
  async reconnect() {
    const saved=this.savedSession();if(!saved?.token||!saved.code)return false;
    this.session=saved;this.sequence=0;this.active=true;
    try{await this.sync();return true;}catch{this.stop();return false;}
  }
  persist(){try{sessionStorage.setItem(ROOM_KEY,JSON.stringify({...this.session,sequence:this.sequence}));}catch{}}
  schedule(delay=300){clearTimeout(this.timer);if(this.active)this.timer=setTimeout(()=>this.sync().catch(()=>{}),delay);}
  enqueue(type,payload={},wait=false) {
    if(!this.active)return Promise.reject(new Error('Join an office first.'));
    const command={seq:++this.sequence,type,...payload};this.pending.push(command);this.persist();
    if(!wait){if(!this.inflight)this.schedule(0);return Promise.resolve({queued:true});}
    const promise=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.waiters.delete(command.seq);reject(new Error('Still waiting for the office. Check the connection and try again.'));},15000);
      this.waiters.set(command.seq,{resolve,reject,timer});
    });
    if(!this.inflight)this.schedule(0);return promise;
  }
  async sync() {
    if(!this.active||this.inflight)return;this.inflight=true;
    try {
      const commands=this.pending.slice(0,20);
      const data=await this.request('/api/rooms/'+encodeURIComponent(this.session.code)+'/sync',{playerId:this.session.playerId,commands},true);
      if(!this.active)return;
      if(data.snapshot)this.apply(data.snapshot);
      const ack=Number(data.ack)||0;this.sequence=Math.max(this.sequence,ack);this.pending=this.pending.filter(c=>c.seq>ack);
      for(const result of data.results||[]){const waiter=this.waiters.get(result.seq);if(waiter){clearTimeout(waiter.timer);this.waiters.delete(result.seq);waiter.resolve(result.result||result);}}
      this.failures=0;this.onStatus('Online');this.persist();
    } catch(error) {
      this.failures++;this.onStatus(this.failures>2?'Reconnecting…':'Connection interrupted');
      if(error.status===401||error.status===404||/expired|not found|invalid token|unauthorized|no longer|office has closed/i.test(error.message)){
        this.stop();try{sessionStorage.removeItem(ROOM_KEY);}catch{}this.onStatus(error.message);this.onChange({disconnected:true,error:error.message});
      }
      throw error;
    } finally {this.inflight=false;this.schedule(Math.min(4000,300*Math.max(1,this.failures)));}
  }
  apply(snapshot) {
    if(!snapshot?.state)return;
    const previous=this.model.state,next=snapshot.state;
    const oldNPCs=new Map((previous.npcs||[]).map(n=>[n.id,n]));
    for(const npc of next.npcs||[]){const old=oldNPCs.get(npc.id);if(old&&Math.hypot(old.x-npc.x,old.y-npc.y)<90){npc.targetX=npc.x;npc.targetY=npc.y;npc.x=old.x;npc.y=old.y;}}
    if(previous.player?.name===next.player?.name&&performance.now()-this.lastMove<500&&Math.hypot(previous.player.x-next.player.x,previous.player.y-next.player.y)<65){
      next.player.serverX=next.player.x;next.player.serverY=next.player.y;next.player.x=previous.player.x;next.player.y=previous.player.y;
    }
    next.networked=true;this.model.state=next;
    if(Number.isFinite(snapshot.seed))this.model.seed=snapshot.seed;
    if(Number.isFinite(snapshot.elapsed))this.model.elapsed=snapshot.elapsed;
    if(Number.isFinite(snapshot.nextTaskId))this.model.nextTaskId=snapshot.nextTaskId;
    this.room=snapshot.room||this.room;this.onChange({snapshot,room:this.room});
  }
  moveTo(x,y){this.model.moveTo(x,y);this.lastMove=performance.now();this.enqueue('moveTo',{x,y});}
  moveDirection(dx,dy,dt){
    this.model.moveDirection(dx,dy,dt);this.lastMove=performance.now();
    if(performance.now()-this.lastInput>=120){this.lastInput=performance.now();this.enqueue('moveDirection',{dx,dy,duration:.14});}
  }
  step(dt){
    const s=this.model.state;
    if(!s.currentTask)this.model.follow(s.player,s.route,158,dt);
    for(const n of s.npcs||[]){if(Number.isFinite(n.targetX)){const k=Math.min(1,dt*12);n.x+=(n.targetX-n.x)*k;n.y+=(n.targetY-n.y)*k;}}
  }
  async leave(){if(this.active){try{await this.enqueue('leave',{},true);}catch{}}this.stop();try{sessionStorage.removeItem(ROOM_KEY);}catch{}}
  stop(){this.active=false;clearTimeout(this.timer);this.pending=[];for(const w of this.waiters.values()){clearTimeout(w.timer);w.reject(new Error('You left the online office.'));}this.waiters.clear();this.room=null;}
}
