import assert from 'node:assert/strict';
import {interactionPoint,DEFAULT_LAYOUT,validateLayout,normalizeLayout,cloneLayout,deskStandingPoint,deskFootprint} from './dist/layout.js';
import {GameModel,ROLES,DIFFICULTIES,STATIONS,OBSTACLES} from './dist/model.js';
let passed=0,failed=0;
const fresh=(role='small',difficulty='casual')=>{const m=new GameModel(20261114);m.start({name:'QA Tester',role,difficulty,outfit:'wizard'});return m;};
const pos=id=>{const s=STATIONS.find(s=>s.id===id);return interactionPoint(s);};
const at=(m,id)=>{Object.assign(m.state.player,pos(id));m.state.route=[];};
const tick=(m,secs)=>{for(let i=0;i<Math.ceil(secs/.05);i++)m.update(.05);};
const valid=m=>{for(const p of [m.state.player,...m.state.npcs]){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=0&&p.x<=m.bounds.width&&p.y>=0&&p.y<=m.bounds.height);}assert.ok(m.state.remaining>=0&&m.state.remaining<=480);for(const n of Object.values(m.state.stats))assert.ok(Number.isFinite(n));};
const test=(name,fn)=>{try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.stack);}};
test('ten roles initialize across all three difficulty settings',()=>{assert.equal(ROLES.length,10);for(const r of ROLES)for(const d of DIFFICULTIES){const m=fresh(r.id,d.id);assert.ok(m.state.tasks.some(t=>t.role===r.id));assert.equal(m.state.phase,'playing');valid(m);}});
test('every desk and shared area is reachable without entering furniture',()=>{for(const st of STATIONS){const m=fresh();const goal=pos(st.id);m.moveTo(goal.x,goal.y);for(let i=0;i<1200&&Math.hypot(m.state.player.x-goal.x,m.state.player.y-goal.y)>15;i++){m.update(1/60);const p=m.state.player;assert.ok(!OBSTACLES.some(o=>p.x>o.x+1&&p.x<o.x+o.w-1&&p.y>o.y+1&&p.y<o.y+o.h-1),'crossed furniture');}assert.ok(Math.hypot(m.state.player.x-goal.x,m.state.player.y-goal.y)<24,'unreachable '+st.id);valid(m);}});
test('all ten role cases complete while paused for choices',()=>{for(const r of ROLES){const m=fresh(r.id);at(m,r.id);const result=m.interact(r.id);assert.equal(result.kind,'task');m.setPaused(true);const t=result.task;const wrong=(t.answers[0]+1)%3;assert.equal(m.advanceTask(wrong).correct,false);assert.equal(t.step,0);for(let i=0;i<3;i++)m.advanceTask(t.answers[t.step]);assert.equal(m.state.stats.completed,1);assert.ok(!m.state.tasks.includes(t));valid(m);}});
test('pause freezes shift, deadlines, event timers and movement',()=>{const m=fresh();m.triggerEvent('printer');m.setPaused(true);const before=JSON.stringify(m.state);tick(m,3);assert.equal(JSON.stringify(m.state),before);});
test('fire starts an evacuation, freezes deadlines, and resolves at assembly',()=>{const m=fresh();const before=m.state.npcs.map(n=>({x:n.x,y:n.y}));m.triggerEvent('fire');const deadlines=m.state.tasks.map(t=>t.deadline);tick(m,2);assert.deepEqual(m.state.tasks.map(t=>t.deadline),deadlines);assert.ok(m.state.npcs.some((n,i)=>Math.hypot(n.x-before[i].x,n.y-before[i].y)>2));at(m,'assembly');m.interact('assembly');assert.equal(m.state.event,null);});
test('all fourteen events have actionable recovery',()=>{for(const type of ['coffee','fire','fight','portal','printer','replyall','mascot','client','phone','music','microwave','milk','crumbs','gym']){const m=fresh();assert.equal(m.triggerEvent(type),true);const e=m.state.event;at(m,e.station);const r=m.interact(e.station);assert.equal(r.kind,'event',type);assert.equal(m.state.event,null,type);valid(m);}});
test('phone and music distract nearby employees and respond to a quiet request',()=>{for(const type of ['phone','music']){const m=fresh();m.triggerEvent(type);const n=m.state.npcs.find(n=>n.id===m.state.event.npcId);assert.equal(n.activity,type);Object.assign(m.state.player,{x:n.x+20,y:n.y});const stress=m.state.player.stress;tick(m,3);assert.ok(m.state.player.stress>stress);const r=m.interact('npc:'+n.id);assert.equal(r.kind,'event');assert.equal(n.activity,null);}});
test('kitchen events change visible state and can be cleaned up',()=>{for(const type of ['microwave','milk','crumbs']){const m=fresh();m.triggerEvent(type);if(type==='microwave')assert.equal(m.state.kitchen.microwave,'beeping');if(type==='milk')assert.equal(m.state.kitchen.milk,false);if(type==='crumbs')assert.equal(m.state.kitchen.crumbs,true);at(m,'kitchen');m.interact('kitchen');assert.deepEqual(m.state.kitchen,{microwave:'idle',milk:true,crumbs:false});}});
test('gym visitor leaves, gym provides relief, and visitor can return',()=>{const m=fresh();assert.equal(m.state.gymBlocked,true);at(m,'gym');m.interact('gym');assert.equal(m.state.gymBlocked,false);m.state.player.stress=60;m.interact('gym');assert.equal(m.state.player.stress,35);m.triggerEvent('gym');assert.equal(m.state.gymBlocked,true);});
test('invalid updates, keyboard movement and malformed saves stay safe',()=>{const m=fresh();for(const dt of [NaN,Infinity,-Infinity,-1,0,1e9]){m.update(dt);valid(m);}for(let i=0;i<1000;i++)m.moveDirection(-1,-1,.05);valid(m);for(const data of [null,undefined,'{',{},[],{version:1,state:{}}]){assert.doesNotThrow(()=>m.restore(data));valid(m);}});
test('save restores player, workday, cases, and event state',()=>{const m=fresh('developers');m.state.stats.completed=3;m.state.remaining=321;m.triggerEvent('music');const n=new GameModel();assert.equal(n.restore(m.serialize()),true);assert.equal(n.state.player.role,'developers');assert.equal(n.state.remaining,321);assert.equal(n.state.stats.completed,3);assert.equal(n.state.event.type,'music');valid(n);});
test('a full shift remains finite and transitions to a new day',()=>{const m=fresh();tick(m,481);assert.equal(m.state.phase,'ended');assert.equal(m.state.remaining,0);valid(m);const day=m.state.day;m.nextDay();assert.equal(m.state.day,day+1);assert.equal(m.state.phase,'playing');assert.equal(m.state.remaining,480);});
test('default floor is valid, normalized, and has all executive offices',()=>{
assert.equal(validateLayout(DEFAULT_LAYOUT).valid,true);
const m=fresh();assert.equal(m.bounds.height,1200);assert.equal(m.stations.length,18);
for(const id of ['ceo','cfo','coo'])assert.ok(m.station('exec:'+id));
assert.equal(m.state.layout.props.length,4);
});
test('builder rejects malformed, overlapping, and blocked floor plans',()=>{
for(const bad of [null,{},[],{...DEFAULT_LAYOUT,width:Infinity},{...DEFAULT_LAYOUT,stations:[]},{...DEFAULT_LAYOUT,props:[{id:'bad',type:'script',x:400,y:700,rotation:0}]}])assert.equal(validateLayout(bad).valid,false);
const l=cloneLayout();l.stations[1].x=l.stations[0].x;assert.equal(validateLayout(l).valid,false);
const n=cloneLayout();n.stations[0].x=NaN;assert.equal(validateLayout(n).valid,false);
const out=cloneLayout();out.executives[0].x=2;assert.equal(validateLayout(out).valid,false);
const blocked=cloneLayout();blocked.props.push({id:'door-block',type:'divider',x:180,y:190,rotation:0});assert.equal(validateLayout(blocked).valid,false);
});
test('builder changes instance geometry without altering another room',()=>{
const first=fresh(),second=fresh(),plan=cloneLayout();plan.stations[0].x+=20;
assert.equal(first.setLayout(plan).ok,true);assert.equal(first.station('small').x,180);
assert.equal(second.station('small').x,160);assert.equal(STATIONS.find(s=>s.id==='small').x,160);
const p=first.point('small');first.moveTo(p.x,p.y);tick(first,15);assert.ok(Math.hypot(first.state.player.x-p.x,first.state.player.y-p.y)<24);
});
test('NPCs actually walk to executive offices and return after the meeting',()=>{
const m=fresh();m.eventClock=999;const n=m.state.npcs[0];const before={x:n.x,y:n.y};
m.triggerSummon(n.id,'ceo');assert.equal(n.activity,'summoned');assert.equal(m.state.executives[0].shouting,true);tick(m,2);
assert.ok(Math.hypot(n.x-before.x,n.y-before.y)>10);tick(m,22);
assert.equal(m.state.summon,null);assert.equal(n.activity,null);assert.equal(m.state.executives[0].shouting,false);
assert.ok(m.state.banter.some(b=>b.kind==='reply'));
});
test('summoned online players can respond using their own player identity',()=>{
const m=fresh();m.state.onlinePlayers=[{id:'guest-123',name:'Guest Colleague'}];m.triggerSummon('guest-123','cfo');
assert.equal(m.state.summon.targetType,'online');m.state.player.id='other-player';at(m,'exec:cfo');m.interact('exec:cfo');assert.ok(m.state.summon);
m.state.player.id='guest-123';const score=m.state.score;const result=m.interact('exec:cfo');
assert.equal(result.kind,'event');assert.equal(m.state.summon,null);assert.ok(m.state.score>=score+75);
});
test('ignored personal executive calls have a recoverable consequence',()=>{
const m=fresh();m.eventClock=999;m.triggerSummon('player','coo');const morale=m.state.stats.morale;tick(m,66);
assert.equal(m.state.summon,null);assert.ok(m.state.stats.morale<morale);assert.ok(m.state.player.stress<100);valid(m);
});
test('NPC conversations require proximity and help cannot farm morale',()=>{
const m=fresh(),n=m.state.npcs[0];Object.assign(m.state.player,{x:950,y:850});
assert.equal(m.talkTo(n.id,'help').kind,'blocked');Object.assign(m.state.player,{x:n.x+20,y:n.y});
n.stress=70;m.state.player.stress=60;const first=m.talkTo(n.id,'help');
assert.equal(first.kind,'chat');assert.equal(n.stress,55);assert.equal(n.relationship,1);
const morale=m.state.stats.morale;m.talkTo(n.id,'help');assert.equal(m.state.stats.morale,morale);
assert.ok(m.state.banter[0].speaker===n.name);
});
test('NPC quiet requests resolve their actual loud-phone event',()=>{
const m=fresh();m.triggerEvent('phone');const n=m.state.npcs.find(n=>n.id===m.state.event.npcId);
Object.assign(m.state.player,{x:n.x+20,y:n.y});const response=m.talkTo(n.id,'quiet');
assert.equal(response.kind,'chat');assert.equal(m.state.event,null);assert.equal(n.activity,null);
});
test('overheard office chatter is shared state, bounded, and uniquely identified',()=>{
const m=fresh();m.eventClock=999;tick(m,22);assert.ok(m.state.banter.some(b=>b.kind==='banter'));
for(let i=0;i<100;i++)m.addBanter('Office','Message '+i,'banter');
assert.equal(m.state.banter.length,40);assert.equal(new Set(m.state.banter.map(b=>b.id)).size,40);
});
test('version-one saves migrate floor positions while retaining unfinished work',()=>{
const m=fresh('accounting'),data=m.serialize();data.version=1;delete data.state.layout;
data.state.player.y=570;data.state.tasks[0].step=1;data.state.remaining=321;data.state.stats.completed=3;
const restored=new GameModel();assert.equal(restored.restore(data),true);
assert.equal(restored.state.layout.height,1200);assert.equal(restored.state.tasks[0].step,1);
assert.equal(restored.state.stats.completed,3);assert.equal(restored.state.remaining,321);valid(restored);
});

test('editing a paused fire drill preserves evacuation and frozen case timers',()=>{
const m=fresh();m.triggerEvent('fire');m.setPaused(true);
const remaining=m.state.event.remaining,deadlines=m.state.tasks.map(t=>t.deadline),plan=cloneLayout(m.state.layout);
plan.stations[0].x+=20;assert.equal(m.setLayout(plan).ok,true);
assert.equal(m.state.phase,'paused');assert.equal(m.state.event.remaining,remaining);
assert.ok(m.state.npcs.some(n=>n.route.length>0),'layout edit discarded evacuation routes');
const positions=m.state.npcs.map(n=>({x:n.x,y:n.y}));tick(m,1);
assert.deepEqual(m.state.npcs.map(n=>({x:n.x,y:n.y})),positions,'paused evacuation moved');
m.setPaused(false);tick(m,1);
assert.ok(m.state.npcs.some((n,i)=>Math.hypot(n.x-positions[i].x,n.y-positions[i].y)>1),'evacuation did not resume');
assert.deepEqual(m.state.tasks.map(t=>t.deadline),deadlines,'fire consumed case deadlines after editing');
assert.equal(m.state.event.type,'fire');assert.ok(m.state.event.remaining<remaining);
});
test('editing a floor restores the same active phone caller and event timer',()=>{
const m=fresh();m.triggerEvent('phone');const id=m.state.event.npcId,remaining=m.state.event.remaining;
m.setPaused(true);const plan=cloneLayout(m.state.layout);plan.floorColor='#e5eadf';
assert.equal(m.setLayout(plan).ok,true);assert.equal(m.state.event.npcId,id);
assert.equal(m.state.event.remaining,remaining);assert.equal(m.state.npcs.find(n=>n.id===id).activity,'phone');
m.setPaused(false);tick(m,1);assert.equal(m.state.npcs.find(n=>n.id===id).activity,'phone');
});
test('restoring active events applies their effects once on the restored floor',()=>{
for(const type of ['coffee','phone','fire']){
const original=fresh();original.triggerEvent(type);const saved=original.serialize(),restored=new GameModel();
let applications=0;const apply=restored.applyEventState.bind(restored);
restored.applyEventState=e=>{applications++;return apply(e);};
assert.equal(restored.restore(saved),true);assert.equal(applications,1,type+' was replayed more than once');
assert.equal(restored.state.event.type,type);assert.equal(restored.state.event.remaining,saved.state.event.remaining);
assert.equal(restored.state.score,saved.state.score);assert.equal(restored.state.stats.morale,saved.state.stats.morale);
if(type==='coffee')assert.equal(restored.state.stats.coffee,0);
if(type==='phone')assert.equal(restored.state.npcs.find(n=>n.id===restored.state.event.npcId).activity,'phone');
if(type==='fire')assert.ok(restored.state.npcs.some(n=>n.route.length>0));
}
});

test('each employee and online player has an individually owned reachable desk',()=>{
const m=fresh();assert.deepEqual(m.bounds,{width:1600,height:1200});assert.equal(m.desks.length,24);
const employees=m.state.npcs.filter(n=>n.role!=='visitor');assert.equal(new Set(employees.map(n=>n.deskId)).size,20);
for(const n of employees){const d=m.desks.find(d=>d.id===n.deskId);assert.equal(d.ownerId,n.id);assert.equal(d.ownerName,n.name);const p=deskStandingPoint(d);assert.deepEqual(n.home,p);assert.ok(m.isFree(p.x,p.y));assert.ok(m.pathTo(m.state.player,p.x,p.y).length>0,'cannot reach '+d.label);}
assert.ok(!m.state.npcs.find(n=>n.role==='visitor').deskId);
m.state.onlinePlayers=[{id:'host-a',name:'Host',deskSlot:0},{id:'guest-b',name:'Guest',deskSlot:1},{id:'guest-c',name:'Third',deskSlot:2},{id:'guest-d',name:'Fourth',deskSlot:3}];
m.state.player.id='guest-b';m.state.player.name='Guest';m.state.player.deskSlot=1;m.state.player.deskId='desk-player-1';
const players=m.desks.filter(d=>d.kind==='player');assert.equal(new Set(players.map(d=>d.ownerId)).size,4);assert.equal(players.find(d=>d.ownerId==='guest-b').id,'desk-player-1');
for(const d of players){const p=m.point('desk:'+d.id);assert.ok(m.isFree(p.x,p.y));assert.ok(m.pathTo(m.state.player,p.x,p.y).length>0);}
});

test('personal desks reject overlaps and blocked standing space, including rotations',()=>{
const overlap=cloneLayout();overlap.desks[1].x=overlap.desks[0].x;assert.equal(validateLayout(overlap).valid,false);
const blocked=cloneLayout();const p=deskStandingPoint(blocked.desks[0]);blocked.props.push({id:'standing-blocker',type:'plant',x:p.x,y:p.y,rotation:0});assert.equal(validateLayout(blocked).valid,false);
const missing=cloneLayout();missing.desks.pop();assert.equal(validateLayout(missing).valid,false);
const rotated=cloneLayout();rotated.desks[0].rotation=1;assert.deepEqual(deskFootprint(rotated.desks[0]),{x:rotated.desks[0].x-26,y:rotated.desks[0].y-44,w:52,h:88,id:rotated.desks[0].id,type:'desk'});
assert.deepEqual(deskStandingPoint(rotated.desks[0]),{x:rotated.desks[0].x+55,y:rotated.desks[0].y});assert.equal(validateLayout(rotated).valid,true);
});

test('coworkers stand near their own desks and return home after a fire or meeting',()=>{
const m=fresh();m.eventClock=999;m.summonClock=999;const n=m.state.npcs[0];
tick(m,30);assert.ok(Math.hypot(n.x-n.home.x,n.y-n.home.y)<40,'idle wander left own desk');
m.triggerSummon(n.id,'ceo');tick(m,28);assert.equal(m.state.summon,null);assert.ok(Math.hypot(n.x-n.home.x,n.y-n.home.y)<40,'meeting did not return to desk');
m.triggerEvent('fire');tick(m,3);m.finishEvent(true);assert.ok(n.route.length>0);const last=n.route.at(-1);assert.ok(Math.hypot(last.x-n.home.x,last.y-n.home.y)<1,'fire return targets wrong desk');
});

test('a personal desk can be approached and identified without starting a department case',()=>{
const m=fresh();const d=m.desks.find(d=>d.ownerId===m.state.player.id),p=m.point('desk:'+d.id);
Object.assign(m.state.player,{x:1500,y:300});const walking=m.interact('desk:'+d.id);assert.equal(walking.kind,'blocked');assert.ok(m.state.route.length>0);
Object.assign(m.state.player,p);m.state.route=[];const response=m.interact('desk:'+d.id);assert.equal(response.kind,'chat');assert.match(response.message,/Your own desk/);assert.equal(m.state.currentTask,null);
});

test('expanded saves retain desk slots and old floor exports migrate safely',()=>{
const m=fresh();m.state.player.deskSlot=2;m.state.player.deskId='desk-player-2';const restored=new GameModel();assert.equal(restored.restore(m.serialize()),true);assert.equal(restored.state.player.deskSlot,2);assert.equal(restored.state.player.deskId,'desk-player-2');
const old=cloneLayout();old.version=2;old.width=1000;old.height=900;delete old.desks;
old.stations.forEach((s,i)=>{if(i<10){s.x=100+(i%5)*200;s.y=i<5?300:560;}});
Object.assign(old.stations.find(s=>s.id==='coffee'),{x:105,y:770});Object.assign(old.stations.find(s=>s.id==='gym'),{x:270,y:770});Object.assign(old.stations.find(s=>s.id==='printer'),{x:430,y:770});Object.assign(old.stations.find(s=>s.id==='kitchen'),{x:680,y:770});Object.assign(old.stations.find(s=>s.id==='assembly'),{x:900,y:780});
old.executives.forEach((e,i)=>{e.x=[180,500,820][i];e.y=90;});old.props=[];
old.stations[0].x+=20;const plan=normalizeLayout(old);assert.equal(plan.width,1600);assert.equal(plan.desks.length,24);assert.equal(plan.stations[0].x,192);assert.equal(validateLayout(plan).valid,true);
assert.equal(plan.stations.find(s=>s.id==='call').label,'Congierge');const fakeOwnership=cloneLayout();fakeOwnership.desks[0].ownerId='someone-else';fakeOwnership.desks[0].label='Spoof';assert.equal(normalizeLayout(fakeOwnership).desks[0].ownerId,'npc-0');
const save=m.serialize();save.version=2;save.state.layout=old;save.state.remaining=240;save.state.tasks[0].step=1;const migrated=new GameModel();assert.equal(migrated.restore(save),true);assert.equal(migrated.state.remaining,240);assert.equal(migrated.state.tasks[0].step,1);assert.equal(migrated.desks.length,24);assert.ok(migrated.isFree(migrated.state.player.x,migrated.state.player.y));
});

console.log(passed+' checks passed; '+failed+' failed.');
if(failed)process.exitCode=1;
