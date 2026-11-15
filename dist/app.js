import {GameModel,ROLES,DIFFICULTIES,OUTFITS,STATIONS} from './model.js';
import {OfficeView} from './renderer.js';
import {OfficeNetwork} from './network.js';
import {FloorBuilder} from './builder.js';
import {OfficeChat} from './office-chat.js';
import {interactionPoint,deskStandingPoint} from './layout.js';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>'<svg aria-hidden="true"><use href="#i-'+name+'"/></svg>';
const outfitArt='<svg viewBox="0 0 32 38" aria-hidden="true"><path d="m10 11-6 4-3 10 5 2 3-7v15h14V20l3 7 5-2-3-10-6-4" fill="currentColor" opacity=".65"/><circle cx="16" cy="6" r="5" fill="#d2a486"/><path d="M11 4q5-7 10 0" fill="#425040"/><path d="m13 12 3 4 3-4" fill="#fcf8dd"/><path d="m16 17-2 10 2 3 2-3Z" fill="#c8a157"/></svg>';
const model=new GameModel();
const canvas=$('office-canvas');
const view=new OfficeView(canvas,model);
const SAVE_KEY='benefits-bedlam-shift-v1';
let builder,chat,networkDay=0,actionBusy=false;
const net=new OfficeNetwork(model,{onStatus:status=>{const el=document.getElementById('room-status');if(el)el.textContent=status;},onChange:info=>{
  if(info.disconnected){toast(info.error||'The office disconnected. Rejoin using the room code.');lobby();return;}
  if(chat)chat.render(net.room);
  if(info.snapshot&&model.state.phase==='playing'&&resultsShown&&model.state.day!==networkDay){document.getElementById('results-dialog').close();showShift();}
  networkDay=model.state.day;updateRoom();
}});
const walk=(x,y)=>net.active?net.moveTo(x,y):model.moveTo(x,y);
async function action(type,payload={}){
  if(net.active)return net.enqueue(type,payload,true);
  if(type==='interact')return model.interact(payload.stationId);
  if(type==='answer')return model.advanceTask(payload.choiceIndex);
  if(type==='talk')return model.talkTo(payload.npcId,payload.choice);
  if(type==='closeTask'){model.closeTask();return{kind:'none'};}
  if(type==='nextDay')return model.nextDay();
  if(type==='endShift'){model.state.remaining=0;model.update(.01);return{};}
}
function updateRoom(){
  const room=net.room;document.getElementById('room-ribbon').classList.toggle('hidden',!net.active);
  if(room){document.getElementById('room-code').textContent=room.code;document.getElementById('room-players').textContent=room.players.map(p=>p.name).join(' · ');}
  document.getElementById('builder-open').disabled=net.active;
  const host=!net.active||room?.hostId===net.session?.playerId;
  document.getElementById('end-btn').disabled=!host;document.getElementById('next-day-btn').disabled=!host;
  document.getElementById('online-results-note').classList.toggle('hidden',!net.active);
}
let directoryKey='';
const deskName=desk=>desk.ownerName?desk.ownerName+'’s desk':desk.label||'Available employee desk';
function refreshDirectory(){
  const desks=model.desks||[],key=model.stations.map(s=>s.id+':'+s.label).join('|')+'#'+desks.map(d=>d.id+':'+d.ownerId+':'+d.ownerName).join('|');if(key===directoryKey)return;directoryKey=key;
  const select=document.getElementById('department-nav'),current=select.value;select.replaceChildren();
  const initial=document.createElement('option');initial.value='';initial.textContent='Find a department or desk…';select.append(initial);
  const spaces=document.createElement('optgroup');spaces.label='Departments & shared spaces';select.append(spaces);
  for(const station of model.stations){const o=document.createElement('option');o.value=station.id;o.textContent=station.label;spaces.append(o);}
  const people=document.createElement('optgroup');people.label='Employee desks';select.append(people);
  for(const desk of desks){const o=document.createElement('option');o.value='desk:'+desk.id;o.textContent=deskName(desk);people.append(o);}select.value=current;
}
let chosenRole=ROLES[0].id,chosenOutfit=OUTFITS[0].id,chosenDifficulty=DIFFICULTIES[0].id;
let selectedTaskId=null,taskRenderKey='',taskListKey='',lastEventId=null,lastLog='',lastSave=0,lastUI=0;
let soundEnabled=false,audio=null,toastTimer=null,simulationTime=0,lastFrame=performance.now(),lastNoise=0;
let keys=new Set(),mobileDirection=null,resultsShown=false,manualPause=false;
function option(container,group,item,label,style,cls,checked){
  const wrap=document.createElement('div');wrap.className='choice';
  const input=document.createElement('input');input.type='radio';input.name=group;input.id=group+'-'+item.id;input.value=item.id;input.checked=checked;
  const text=document.createElement('label');text.htmlFor=input.id;text.className=cls;text.setAttribute('style',style||'');text.innerHTML=label;
  wrap.append(input,text);container.append(wrap);return input;
}
ROLES.forEach((r,i)=>option($('role-options'),'role',r,'<i class="role-dot"></i>'+esc(r.short||r.label),'--role-color:'+r.color,'role-choice',i===0).addEventListener('change',()=>{chosenRole=r.id;$('role-description').textContent=r.description;}));
OUTFITS.forEach((o,i)=>option($('outfit-options'),'outfit',o,outfitArt,'--outfit-color:'+o.color,'outfit-choice',i===0).addEventListener('change',()=>{chosenOutfit=o.id;$('outfit-label').textContent=o.label;}));
$('outfit-options').querySelectorAll('label').forEach((el,i)=>{el.title=OUTFITS[i].label;el.setAttribute('aria-label',OUTFITS[i].label);});
DIFFICULTIES.forEach((d,i)=>option($('difficulty-options'),'difficulty',d,esc(d.label),'','difficulty-choice',i===0).addEventListener('change',()=>{chosenDifficulty=d.id;$('difficulty-description').textContent=d.description;}));
$('role-description').textContent=ROLES[0].description;
$('outfit-label').textContent=OUTFITS[0].label;
$('difficulty-description').textContent=DIFFICULTIES[0].description;
function toast(text){if(!text)return;$('toast').textContent=text;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),3400);}
function tone(freq=520,duration=.12){if(!soundEnabled)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}
function save(){if(net.active||model.state.phase==='lobby')return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(model.serialize()));}catch{}}
function saved(){try{let v=JSON.parse(localStorage.getItem(SAVE_KEY));if(typeof v==='string')v=JSON.parse(v);return v;}catch{return null;}}
$('continue-btn').classList.toggle('hidden',!saved());
const onlineContinue=document.createElement('button');onlineContinue.id='continue-online-btn';onlineContinue.type='button';onlineContinue.className='continue-button';onlineContinue.textContent='Return to online office ↗';onlineContinue.classList.toggle('hidden',!net.savedSession());$('continue-btn').after(onlineContinue);
onlineContinue.onclick=async()=>{onlineContinue.disabled=true;try{if(await net.reconnect()){networkDay=model.state.day;showShift();chat.open('team');toast('Your online office is still here.');}else{onlineContinue.classList.add('hidden');toast('That office has closed. Join a new room or open your own.');}}catch(error){toast(error.message);}finally{onlineContinue.disabled=false;}};
function showShift(){
  $('lobby-panel').classList.add('hidden');$('shift-panel').classList.remove('hidden');$('pause-btn').classList.remove('hidden');document.body.classList.add('in-shift');
  $('page-title').innerHTML='Another day. <em>Beautifully under control.</em>';
  $('employee-name').textContent=model.state.player.name;
  $('employee-role').textContent=ROLES.find(r=>r.id===model.state.player.role)?.label||'Office employee';
  $('employee-avatar').innerHTML=outfitArt;
  $('employee-avatar').style.color=OUTFITS.find(o=>o.id===model.state.player.outfit)?.color||'#a8b495';
  taskListKey='';resultsShown=false;view.resize();refreshDirectory();updateRoom();updateUI();if(window.innerWidth>700)window.scrollTo({top:0,behavior:'auto'});else document.getElementById('canvas-wrap').scrollIntoView({block:'center',behavior:'smooth'});canvas.focus({preventScroll:true});
}
$('character-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;
  const config={name:$('player-name').value.trim()||'New Hire',role:chosenRole,difficulty:chosenDifficulty,outfit:chosenOutfit,skin:'#d4a181',layout:model.state.layout};
  const mode=document.querySelector('input[name="play-mode"]:checked').value;
  try{if(mode==='solo'){await net.leave();model.start(config);}else{await net.connect(mode,config,model.state.layout,$('join-code').value);networkDay=model.state.day;}
    selectedTaskId=model.state.tasks[0]?.id;showShift();save();tone(540);chat.open(mode==='solo'?'overheard':'team');toast(mode==='solo'?'Welcome aboard. Pick a case to get started.':'Your team shares this office. Invite coworkers with the room code.');
  }catch(error){toast(error.message);}finally{button.disabled=false;}
});
$('continue-btn').addEventListener('click',()=>{try{const data=saved();if(!data)throw Error('No saved shift');const result=model.restore(data);if(result===false)throw Error('Invalid save');model.setPaused(false);showShift();toast('Your desk is just how you left it.');}catch{toast('That shift could not be restored. Start a fresh workday.');}});
function stationPoint(st){return interactionPoint(st);}
function deskApproach(desk){const home=deskStandingPoint(desk);if(!desk.ownerId||desk.ownerId===model.state.player.id)return home;const people=[...(model.state.npcs||[]),...(model.state.otherPlayers||[])].filter(p=>!p.hidden);for(const [dx,dy]of[[48,24],[-48,24],[0,54]]){const p={x:home.x+dx,y:home.y+dy};if(model.isFree(p.x,p.y)&&people.every(n=>Math.hypot(n.x-p.x,n.y-p.y)>32))return p;}return model.nearestFree(home.x,home.y+54);}
function goTo(id){
  if(builder?.active){if(builder.object(id)){builder.select(id);view.resize();}return;}
  if(model.state.phase!=='playing'){if(model.state.phase==='lobby')toast('Clock in first. Your desk is waiting.');return;}
  if(id?.startsWith('npc:')){const n=model.state.npcs.find(n=>'npc:'+n.id===id);if(n)walk(n.x+30,n.y+20);return;}
  if(id?.startsWith('desk:')){const desk=(model.desks||[]).find(d=>'desk:'+d.id===id);if(desk){const p=deskApproach(desk);view.selectedId=id;walk(p.x,p.y);toast('Heading to '+deskName(desk)+'.');tone(380,.05);}return;}
  const st=model.stations.find(s=>s.id===id);if(st){const p=stationPoint(st);view.selectedId=id;walk(p.x,p.y);tone(380,.05);}
}
function nearest(){
  if(model.state.phase!=='playing')return null;const p=model.state.player,e=model.state.event;
  if(e?.npcId){const n=model.state.npcs.find(n=>n.id===e.npcId);if(n&&Math.hypot(n.x-p.x,n.y-p.y)<100)return{id:'npc:'+n.id,label:e.type==='phone'?'Ask for a quieter call':e.type==='music'?'Ask to turn the music down':e.type==='gym'?'Ask the visitor to leave':'Speak with '+n.name};}
  const candidates=model.stations.map(st=>({st,d:Math.hypot(stationPoint(st).x-p.x,stationPoint(st).y-p.y)})).filter(o=>o.d<90);
  for(const desk of model.desks||[]){const spot=deskStandingPoint(desk),d=Math.hypot(spot.x-p.x,spot.y-p.y);if(d<72)candidates.push({st:{id:'desk:'+desk.id,kind:'desk',label:desk.ownerId===p.id?'Check your desk':'Visit '+deskName(desk)},d});}candidates.sort((a,b)=>a.d-b.d);
  if(!candidates.length)return null;
  const st=candidates[0].st;
  if(st.kind==='desk')return{id:st.id,label:st.label};
  const task=model.state.tasks.find(t=>t.role===st.id);
  let label=task?'Work on '+st.label:st.label;
  if(st.id==='coffee')label=model.state.stats.coffee>5?'Take a coffee break':'Restock the coffee';
  if(st.id==='kitchen')label=e?.station==='kitchen'?(e.actionLabel||'Restore kitchen peace'):'Check the kitchen';
  if(st.id==='gym')label=model.state.gymBlocked?'Ask the visitor to leave':'Take a gym break';
  if(e&&(e.station===st.id||st.id==='operations'&&e.type!=='fire'))label=e.actionLabel||'Help resolve '+e.title.toLowerCase();
  if(st.id==='assembly'&&e?.type==='fire')label='Check in at assembly';
  return{id:st.id,label};
}
async function interact(){
  const n=nearest();if(!n){toast('Walk closer to a desk or shared area first.');return;}
  if(actionBusy)return;actionBusy=true;let result;try{result=await action('interact',{stationId:n.id})||{};}catch(error){toast(error.message);return;}finally{actionBusy=false;}
  if(result.kind==='task'){
    selectedTaskId=result.task?.id||model.state.currentTask;
    taskRenderKey='';renderTask(result.task);if(!net.active)model.setPaused(true);if(!$('task-dialog').open)$('task-dialog').showModal();keys.clear();
  }else{toast(result.message||'All set.');tone(result.kind==='event'?660:420,.1);}
  updateUI();save();
}
$('interact-button').addEventListener('click',interact);
function currentTask(){return model.state.tasks.find(t=>t.id===model.state.currentTask)||model.state.tasks.find(t=>t.id===selectedTaskId);}
function renderTask(provided){
  const task=provided||currentTask();if(!task){closeTask();return;}
  const role=ROLES.find(r=>r.id===task.role);const step=task.step||0;
  $('task-department').textContent=role?.label||'Office case';$('task-title').textContent=task.title;
  $('task-dialog').querySelector('.modal-note').textContent=net.active?'Your online office keeps running while you review this case. Your coworkers can handle other work.':'Take a breath. The shift pauses while you review this case.';
  $('task-steps').innerHTML=task.steps.map((_,i)=>'<span class="'+(i<step?'done':i===step?'current':'')+'"></span>').join('');
  const detail=task.steps[step];
  $('task-question').textContent=typeof detail==='string'?detail:detail?.question||'Choose the best next step.';
  const choices=task.choices?.[step]||detail?.choices||['Review the details and complete this step'];
  $('task-choices').replaceChildren();
  choices.forEach((choice,i)=>{const b=document.createElement('button');b.className='answer-button';b.innerHTML='<span>'+String.fromCharCode(65+i)+'</span>'+esc(typeof choice==='string'?choice:choice.label||choice.text);
    b.addEventListener('click',async()=>{if(actionBusy)return;actionBusy=true;b.disabled=true;let result;try{result=await action('answer',{taskId:task.id,choiceIndex:i,step:step})||{};}catch(error){toast(error.message);return;}finally{actionBusy=false;b.disabled=false;}if(result.complete){tone(780,.15);closeTask();toast(result.message||'Case closed. Beautifully handled.');}else{renderTask();$('task-feedback').textContent=result.message||'';tone(result.correct===false?240:540,.08);}save();updateUI();});
    $('task-choices').append(b);});
  $('task-feedback').textContent='';
}
function closeTask(){if(net.active){net.enqueue('closeTask').catch(()=>{});}model.closeTask();if($('task-dialog').open)$('task-dialog').close();if(!net.active&&model.state.phase==='paused')model.setPaused(false);updateUI();save();canvas.focus({preventScroll:true});}
$('task-close').addEventListener('click',closeTask);
$('task-dialog').addEventListener('cancel',e=>{e.preventDefault();closeTask();});
function pause(){if(model.state.phase!=='playing'||$('pause-dialog').open)return;keys.clear();mobileDirection=null;if(!net.active)model.setPaused(true);manualPause=true;$('pause-explanation').textContent=net.active?'You are taking a break. Your online office keeps running.':'Your shift is paused and saved.';save();$('pause-dialog').showModal();}
function resume(){if($('pause-dialog').open)$('pause-dialog').close();manualPause=false;if(!net.active)model.setPaused(false);lastFrame=performance.now();canvas.focus({preventScroll:true});updateUI();}
$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',resume);
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
async function lobby(){save();if(net.active)await net.leave();document.querySelectorAll('dialog[open]').forEach(d=>d.close());model.state.phase='lobby';keys.clear();$('lobby-panel').classList.remove('hidden');$('shift-panel').classList.add('hidden');$('pause-btn').classList.add('hidden');$('continue-btn').classList.toggle('hidden',!saved());document.body.classList.remove('in-shift');$('page-title').innerHTML='Good benefits. <em>Questionable coworkers.</em>';taskListKey='';resultsShown=false;updateRoom();refreshDirectory();view.resize();}
$('pause-restart').addEventListener('click',lobby);$('new-character-btn').addEventListener('click',lobby);
function showInfo(id){const d=$(id);d.dataset.resume=model.state.phase==='playing'?'yes':'no';if(!net.active&&model.state.phase==='playing')model.setPaused(true);keys.clear();d.showModal();}
['help-dialog','about-dialog'].forEach(id=>$(id).addEventListener('close',()=>{if(!net.active&&$(id).dataset.resume==='yes'&&model.state.phase==='paused')model.setPaused(false);canvas.focus({preventScroll:true});}));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
$('help-btn').addEventListener('click',()=>showInfo('help-dialog'));$('about-btn').addEventListener('click',()=>showInfo('about-dialog'));
$('sound-btn').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound-btn').setAttribute('aria-pressed',String(soundEnabled));$('sound-btn').querySelector('span').textContent=soundEnabled?'Sound on':'Sound off';if(soundEnabled)tone(600,.1);});
$('coffee-go').addEventListener('click',()=>goTo('coffee'));
$('my-desk-go').addEventListener('click',()=>{const desk=(model.desks||[]).find(d=>d.ownerId===model.state.player.id);if(desk)goTo('desk:'+desk.id);else toast('Clock in to claim your own desk.');});
$('event-go').addEventListener('click',()=>{const e=model.state.event;if(e)goTo(e.npcId?'npc:'+e.npcId:e.station||'operations');});
$('end-btn').addEventListener('click',async()=>{if(model.state.phase==='playing'){try{await action('endShift');updateUI();save();}catch(error){toast(error.message);}}});
$('next-day-btn').addEventListener('click',async()=>{try{const result=await action('nextDay');if(result?.kind==='blocked'){toast(result.message);return;}$('results-dialog').close();model.setPaused(false);showShift();save();}catch(error){toast(error.message);}});
function showResults(){if(resultsShown)return;resultsShown=true;const s=model.state.stats;$('result-cases').textContent=s.completed;$('result-happiness').textContent=Math.round(s.satisfaction)+'%';$('result-morale').textContent=Math.round(s.morale)+'%';$('result-subtitle').textContent=model.state.player.name+', you survived day '+model.state.day+'. Your coworkers are mostly still speaking to you.';$('result-award').textContent=s.completed>=5?'✳ The Golden Stapler — outstanding service under absurd conditions.':s.completed>=2?'✳ The Steady Hand — a little kindness goes a long way.':'✳ The Survivor — showing up was the first achievement.';document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('results-dialog').showModal();tone(740,.2);save();}
$('results-dialog').addEventListener('cancel',e=>e.preventDefault());
function updateTasks(){
 const tasks=model.state.tasks;const key=tasks.map(t=>[t.id,t.step,Math.ceil(t.deadline/10),t.id===selectedTaskId].join(':')).join('|');
 if(key===taskListKey)return;taskListKey=key;$('task-count').textContent=tasks.length+' OPEN';$('task-list').replaceChildren();
 tasks.forEach(t=>{const r=ROLES.find(r=>r.id===t.role);const b=document.createElement('button');b.className='task-card'+(t.id===selectedTaskId?' selected':'');b.style.setProperty('--role-color',r?.color||'#a7b28d');
 const d=Math.max(0,Math.ceil(t.deadline||0));const due=Math.floor(d/60)+':'+String(d%60).padStart(2,'0');
 b.innerHTML='<div class="task-meta"><span><i class="role-dot"></i>'+esc(r?.short||r?.label||t.role)+'</span><span class="task-deadline">'+due+'</span></div><h4>'+esc(t.title)+'</h4><span class="task-stage">'+(t.step||0)+' / '+t.steps.length+' steps complete</span><span class="task-arrow">↗</span>';
 b.addEventListener('click',()=>{selectedTaskId=t.id;goTo(t.role);taskListKey='';updateTasks();toast('Heading to '+(r?.label||t.role)+'. Press E when you arrive.');});$('task-list').append(b);});
}
function updateUI(){
 const s=model.state,p=s.player,stats=s.stats;
 $('stat-completed').innerHTML=stats.completed+' <small>/ '+(stats.completed?'nicely done':'Let’s get started')+'</small>';
 $('stat-happiness').innerHTML=Math.round(stats.satisfaction)+'<small>%</small>';$('stat-morale').innerHTML=Math.round(stats.morale)+'<small>%</small>';
 $('stat-coffee').textContent=stats.coffee>65?'Fully caffeinated':stats.coffee>20?'Running a little low':'Caffeine emergency';
 $('stress-label').textContent=Math.round(p.stress||0)+'%';$('stress-meter').style.width=Math.min(100,p.stress||0)+'%';$('stress-meter').style.background=p.stress>70?'#c68d70':'#a7b47f';$('stress-hint').textContent=p.stress>70?'Time for a coffee break. Or a very deep breath.':p.stress>35?'A little hectic. A little coffee might help.':"Deep breaths. You've got this.";
 $('day-label').textContent='DAY '+String(s.day||1).padStart(2,'0');
 if(s.phase!=='lobby'){const remain=Math.max(0,Math.ceil(s.remaining));const elapsed=s.total-s.remaining;const clock=8*60+30+Math.floor(elapsed/60*30);const hour=Math.floor(clock/60)%12||12;const minute=String(clock%60).padStart(2,'0');$('time-label').querySelector('span').textContent=hour+':'+minute+' '+(clock>=720?'PM':'AM')+' · '+Math.floor(remain/60)+':'+String(remain%60).padStart(2,'0')+' left';updateTasks();}
 const e=s.event;$('event-banner').classList.toggle('hidden',!e);
 if(e){$('event-title').textContent=e.title;$('event-description').textContent=e.description;$('event-go').textContent=(e.type==='fire'?'To assembly':e.type==='phone'||e.type==='music'?'Ask for quiet':e.actionLabel||'Handle it')+' ↗';if(lastEventId!==e.id){lastEventId=e.id;tone(460,.2);}}
 const n=builder?.active?null:nearest();$('interact-prompt').classList.toggle('hidden',!n);if(n)$('interact-label').textContent=n.label;
 const entry=s.log?.[0];if(entry){const text=typeof entry==='string'?entry:entry.text;if(text&&text!==lastLog){$('activity-message').textContent=text;lastLog=text;}}
 if(chat)chat.render(net.active?net.room:null);refreshDirectory();updateRoom();updateSummon();if($('task-dialog').open&&net.active&&!model.state.currentTask)closeTask();
 if(s.phase==='ended')showResults();
}
canvas.addEventListener('pointerdown',e=>{if(builder?.active||e.button!==0)return;canvas.focus({preventScroll:true});if(model.state.phase!=='playing'){if(model.state.phase==='lobby')toast('Create your office alter ego, then clock in.');return;}const id=view.hitTest(e.clientX,e.clientY);if(id){const target=typeof id==='string'?id:id.id;goTo(target);if(target.startsWith('npc:')){chat.open('talk');chat.npcSelect.value=target.slice(4);}}else{const p=view.screenToWorld(e.clientX,e.clientY);if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))walk(p.x,p.y);}});
canvas.addEventListener('pointermove',e=>{if(builder?.active)return;const id=view.hitTest(e.clientX,e.clientY);view.hovered=typeof id==='string'?id:id?.id||null;canvas.style.cursor=id?'pointer':'crosshair';const st=model.stations.find(s=>s.id===view.hovered),desk=(model.desks||[]).find(d=>'desk:'+d.id===view.hovered);const tip=$('walk-tooltip');tip.classList.toggle('hidden',!st&&!desk);if(st||desk){const box=canvas.getBoundingClientRect();tip.textContent=(desk?deskName(desk):st.label)+' · Click to walk';tip.style.left=Math.max(8,Math.min(box.width-180,e.clientX-box.left+12))+'px';tip.style.top=Math.max(20,e.clientY-box.top-30)+'px';}});
canvas.addEventListener('pointerleave',()=>{view.hovered=null;$('walk-tooltip').classList.add('hidden');});
const movementKeys=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
window.addEventListener('keydown',e=>{
 const tag=document.activeElement?.tagName;if(['INPUT','TEXTAREA','SELECT'].includes(tag)||builder?.active)return;const key=e.key.toLowerCase();
 if(document.querySelector('dialog[open]'))return;if(key==='t'){e.preventDefault();chat.open('talk');return;}if(key==='enter'&&net.active){chat.open('team');$('chat-input').focus();e.preventDefault();return;}
 if(movementKeys.includes(key)){if(model.state.phase==='playing'){keys.add(key);e.preventDefault();}}
 if((key==='e'||key===' ')&&model.state.phase==='playing'){e.preventDefault();if(!e.repeat){if(key==='e')interact();else pause();}}
 if(key==='escape'&&model.state.phase==='playing'){e.preventDefault();pause();}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();mobileDirection=null;});
document.querySelectorAll('[data-dir]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);mobileDirection=b.dataset.dir.split(',').map(Number);});['pointerup','pointercancel','lostpointercapture'].forEach(event=>b.addEventListener(event,()=>mobileDirection=null));});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(!net.active&&model.state.phase==='playing')pause();save();}});
window.addEventListener('beforeunload',save);
function frame(now){
 const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;simulationTime+=dt;
 if(model.state.phase==='playing'&&!builder?.active&&!document.querySelector('dialog[open]')){let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);if(mobileDirection)[dx,dy]=mobileDirection;
 if(dx||dy){const wx=(dx+dy)*.7071,wy=(dy-dx)*.7071;if(net.active)net.moveDirection(wx,wy,dt);else model.moveDirection(wx,wy,dt);}}
 if(net.active)net.step(dt);else model.update(dt);view.render(simulationTime);
 if(now-lastUI>180){updateUI();lastUI=now;}
 if(now-lastSave>5000){save();lastSave=now;}
 const event=model.state.event;if(soundEnabled&&event&&now-lastNoise>4000){if(event.type==='phone'){tone(680,.08);setTimeout(()=>tone(800,.08),140);}if(event.type==='music'){tone(330,.11);setTimeout(()=>tone(440,.11),150);}if(event.type==='microwave')tone(1000,.08);lastNoise=now;}
 requestAnimationFrame(frame);
}
builder=new FloorBuilder(model,view,{toast,onDone:()=>{if(model.state.phase==='lobby'){$('lobby-panel').classList.remove('hidden');}else{$('shift-panel').classList.remove('hidden');}refreshDirectory();}});
builder.loadSaved();
chat=new OfficeChat(model,{toast,onSend:async text=>{const result=await net.enqueue('chat',{text},true);if(result.kind==='blocked')throw Error(result.message);},onTalk:(npcId,choice)=>action('talk',{npcId,choice}),onWalk:id=>goTo('npc:'+id)});
$('chat-toggle').onclick=()=>chat.open('overheard');
$('builder-open').onclick=()=>{if(net.active){toast('Choose a floor before opening an online office.');return;}builder.open();};
$('department-nav').onchange=e=>{if(e.target.value)goTo(e.target.value);};
$('name-display').onchange=e=>{view.labelMode=e.target.value;};
function zoom(delta){view.zoom=Math.max(1,Math.min(view.maxZoom||2.6,(view.zoom||1)+delta));view.resize();$('zoom-level').textContent=view.zoom<=1?'Fit':Math.round(view.zoom*100)+'%';}
$('zoom-out').onclick=()=>zoom(-.2);$('zoom-in').onclick=()=>zoom(.2);
document.querySelectorAll('input[name="play-mode"]').forEach(input=>input.addEventListener('change',()=>{const mode=input.value;$('join-code-field').classList.toggle('hidden',mode!=='join');$('mode-help').textContent=mode==='solo'?'A little peace and quiet. Relatively speaking.':mode==='host'?'Open a shared office for up to four players. Your floor plan comes with you.':'Join your coworkers using their eight-character room code.';}));
$('copy-invite').onclick=async()=>{const url=new URL(location.href);url.search='room='+net.room.code;try{await navigator.clipboard.writeText(url.href);toast('Office invite copied.');}catch{toast('Share this room code: '+net.room.code);}};
$('leave-room').onclick=()=>lobby();
const summonNode=document.createElement('div');summonNode.className='summon-banner hidden';summonNode.innerHTML='<div><strong id="summon-title"></strong><p id="summon-description"></p></div><button id="summon-go">Go to the office ↗</button>';$('canvas-wrap').append(summonNode);
$('summon-go').onclick=()=>{if(model.state.summon)goTo(model.state.summon.station||'exec:'+model.state.summon.executiveId);};
function updateSummon(){const call=model.state.summon;summonNode.classList.toggle('hidden',!call||builder?.active);if(call){$('summon-title').textContent=call.title||'Upper management needs attention';$('summon-description').textContent=call.description||call.shout;}}
const invite=new URL(location.href).searchParams.get('room');if(invite){$('join-code').value=invite.trim().toUpperCase().slice(0,8);const join=document.querySelector('input[name="play-mode"][value="join"]');join.checked=true;join.dispatchEvent(new Event('change'));}
refreshDirectory();updateUI();requestAnimationFrame(frame);




