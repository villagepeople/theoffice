import assert from 'node:assert/strict';
import {GameModel} from './dist/model.js';
import {cloneLayout} from './dist/layout.js';

let passed=0,failed=0;
const test=(name,fn)=>{try{fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+error.stack);}};
const tick=(m,seconds)=>{for(let i=0;i<Math.ceil(seconds/.05);i++)m.update(.05);};
const fresh=()=>{const m=new GameModel(19);m.start({name:'Office QA',role:'operations',difficulty:'casual'});m.eventClock=999;m.summonClock=999;m.state.officeRoutines.messClock=999;m.state.phoneQueue.arrivalClock=999;return m;};
const quietRounds=m=>{Object.assign(m.state.officeRoutines,{roundClock:999,coffeeCheckClock:999,staffClock:999});};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('three managers walk on rounds while office anchors remain fixed',()=>{
 const m=fresh(),anchors=m.state.executives.map(e=>({id:e.id,x:e.x,y:e.y}));
 assert.equal(m.state.managers.length,3);tick(m,19);
 assert.ok(m.state.managers.some(a=>distance(a,a.home)>100));
 assert.deepEqual(m.state.executives.map(e=>({id:e.id,x:e.x,y:e.y})),anchors);
 for(const actor of m.state.managers)assert.ok(m.isFree(actor.x,actor.y,10));
});

test('stale coffee is distinct from supply and a manager walks over to brew it',()=>{
 const m=fresh();quietRounds(m);m.state.coffee.age=101;m.state.coffee.status='stale';const supply=m.state.stats.coffee;
 const actor=m.startManagerRound('ceo');assert.equal(actor.activity,'coffee');tick(m,1);
 assert.equal(m.state.coffee.status,'stale');assert.ok(m.state.stats.coffee>supply-1);assert.ok(distance(actor,actor.home)>20);
 tick(m,35);assert.equal(m.state.coffee.status,'fresh');assert.ok(m.state.coffee.age<30);assert.ok(m.state.stats.coffee>95);
 assert.ok(m.state.banter.some(b=>b.kind==='manager'&&b.text.includes('fresh pot')));
});

test('staff coordination moves an actual coworker and helps an unfinished case once',()=>{
 const m=fresh();quietRounds(m);const task=m.state.tasks[0],deadline=task.deadline,manager=m.state.managers[1];
 const coworker=m.assignOfficeSupport(manager,'support',task.id);assert.ok(coworker);const before={x:coworker.x,y:coworker.y};
 tick(m,1);assert.ok(distance(coworker,before)>10);assert.equal(task.managerSupported,undefined);
 tick(m,14);assert.equal(task.managerSupported,true);assert.ok(task.deadline>deadline-5);assert.equal(coworker.officeAssignment,null);
 assert.equal(m.assignOfficeSupport(manager,'support',task.id),false);
});

test('desk cleanup removes the mess and leaves a readable, dismissible personal note',()=>{
 const m=fresh();quietRounds(m);const desk=m.desks.find(d=>d.ownerId===m.state.player.id),mess=m.createDeskMess(desk.id,'crumbs');assert.ok(mess);
 assert.equal(m.startManagerRound('coo').job.messId,mess.id);tick(m,38);assert.equal(m.state.deskMesses.length,0);
 const note=m.state.deskNotes[0];assert.equal(note.ownerId,m.state.player.id);assert.equal(note.read,false);assert.ok(!m.state.banter.some(b=>b.text===note.text));
 const size=m.state.deskNotes.length;m.leaveDeskNote(desk.id,'Manager','Another note too soon.');assert.equal(m.state.deskNotes.length,size);
 Object.assign(m.state.player,m.point('desk:'+desk.id));const result=m.interact('desk:'+desk.id);assert.equal(result.kind,'note');assert.equal(note.read,true);assert.equal(result.note.text,note.text);
 assert.equal(m.dismissNote(note.id).kind,'note-dismissed');assert.equal(m.state.deskNotes.length,0);
});

test('kitchen cleanup tracks the responsible employee and delivers their note',()=>{
 const m=fresh();quietRounds(m);m.triggerEvent('crumbs');const ownerId=m.state.kitchen.crumbsOwnerId,deskId=m.state.kitchen.crumbsDeskId;
 assert.ok(ownerId&&deskId);assert.equal(m.startManagerRound('coo').job.kind,'kitchen');tick(m,55);
 assert.equal(m.state.kitchen.crumbs,false);assert.equal(m.state.event,null);
 const note=m.state.deskNotes.find(n=>n.deskId===deskId);assert.ok(note);assert.equal(note.ownerId,ownerId);assert.ok(note.text.includes('kitchen counter'));
});

test('an unclaimed shared kitchen mess is cleaned without accusing a random employee',()=>{
 const m=fresh();quietRounds(m);m.state.kitchen.crumbs=true;m.startManagerRound('coo');tick(m,30);
 assert.equal(m.state.kitchen.crumbs,false);assert.equal(m.state.deskNotes.length,0);
});

test('ringing calls produce queue complaints and a player can answer them',()=>{
 const m=fresh();quietRounds(m);assert.equal(m.receiveCall(),true);const ringId=m.state.phoneQueue.ringId;m.state.phoneQueue.autoAnswerClock=999;
 tick(m,8);assert.equal(m.state.phoneQueue.waiting,1);assert.equal(m.state.phoneQueue.ringId,ringId);assert.ok(m.state.banter.some(b=>b.kind==='queue'&&b.speaker!=='The gym regular'));
 Object.assign(m.state.player,m.point('call'));const result=m.interact('call');assert.equal(result.kind,'phone');assert.equal(m.state.phoneQueue.answered,1);assert.equal(m.state.phoneQueue.waiting,0);assert.equal(m.state.phoneQueue.ringing,false);
});

test('a queue assignment is answered only after the coworker arrives and handles it',()=>{
 const m=fresh();quietRounds(m);m.receiveCall();m.state.phoneQueue.autoAnswerClock=999;
 const kit=m.state.npcs.find(n=>n.id==='npc-10');Object.assign(kit,{x:900,y:500});const assigned=m.assignOfficeSupport(m.state.managers[0],'queue');assert.equal(assigned.id,kit.id);assert.ok(kit.route.length);
 tick(m,2);assert.equal(m.state.phoneQueue.answered,0);assert.ok(kit.officeAssignment);
 tick(m,29);assert.equal(m.state.phoneQueue.answered,1);assert.equal(kit.officeAssignment,null);
});

test('fire interrupts routines, silences the queue and pauses caller patience',()=>{
 const m=fresh();quietRounds(m);m.state.coffee.age=101;m.state.coffee.status='stale';m.startManagerRound('ceo');m.receiveCall();tick(m,2);
 const patience=m.state.phoneQueue.calls[0].remaining,age=m.state.coffee.age;m.triggerEvent('fire');tick(m,3);
 assert.equal(m.state.phoneQueue.ringing,false);assert.equal(m.state.phoneQueue.calls[0].remaining,patience);assert.equal(m.state.coffee.age,age);
 assert.ok(m.state.managers.every(a=>a.activity==='evacuating'&&!a.job));
 m.finishEvent(true);quietRounds(m);assert.equal(m.state.phoneQueue.ringing,true);tick(m,45);
 assert.ok(m.state.managers.every(a=>a.activity===null&&distance(a,a.home)<1));
});

test('floor edits relocate manager homes and routine destinations safely',()=>{
 const m=fresh(),layout=cloneLayout();layout.executives[0].x+=20;layout.stations.find(s=>s.id==='coffee').x+=20;
 assert.equal(m.setLayout(layout).ok,true);quietRounds(m);m.state.coffee.age=110;m.state.coffee.status='stale';
 const actor=m.startManagerRound('ceo');assert.equal(actor.home.x,300);assert.equal(actor.job.target.x,160);tick(m,35);
 assert.equal(m.state.coffee.status,'fresh');assert.ok(m.isFree(actor.x,actor.y,10));
});

test('save migration preserves notes, queue and freshness with stable new identifiers',()=>{
 const m=fresh();quietRounds(m);const desk=m.desks.find(d=>d.ownerId===m.state.player.id);m.createDeskMess(desk.id,'trash');const note=m.leaveDeskNote(desk.id,'CFO Blair Ledger','Please use the bin.');m.receiveCall();m.state.coffee.age=105;m.state.coffee.status='stale';
 const next=new GameModel();assert.equal(next.restore(m.serialize()),true);assert.equal(next.state.deskNotes[0].text,note.text);assert.equal(next.state.deskMesses.length,1);assert.equal(next.state.phoneQueue.waiting,1);assert.equal(next.state.coffee.status,'stale');
 const ring=next.state.phoneQueue.ringId;next.setPaused(false);next.receiveCall();assert.notEqual(next.state.phoneQueue.ringId,ring);
 const old=m.serialize();for(const key of ['managers','coffee','deskMesses','deskNotes','phoneQueue','officeRoutines'])delete old.state[key];const legacy=new GameModel();assert.equal(legacy.restore(old),true);assert.equal(legacy.state.managers.length,3);assert.equal(legacy.state.phoneQueue.waiting,0);
});

test('the gym outsider walks out to complain about ringing phones and returns without answering',()=>{
 const m=fresh();quietRounds(m);m.receiveCall();m.state.phoneQueue.autoAnswerClock=999;const visitor=m.state.npcs.find(n=>n.id==='gym-visitor'),before={x:visitor.x,y:visitor.y};
 tick(m,2);assert.equal(visitor.activity,'phone-police');assert.ok(distance(visitor,before)>25);tick(m,12);
 assert.ok(m.state.banter.some(b=>b.speaker==='The gym regular'&&b.kind==='queue'&&b.text.includes('actual employees')));assert.equal(m.state.phoneQueue.answered,0);
 tick(m,18);assert.equal(visitor.activity,'gym');assert.equal(visitor.officeOuting,null);assert.equal(m.state.gymBlocked,true);
});

test('evicted gym outsiders stay gone and a fire cancels their phone lecture',()=>{
 const m=fresh();quietRounds(m);m.receiveCall();tick(m,2);const visitor=m.state.npcs.find(n=>n.id==='gym-visitor');m.clearGym();tick(m,25);
 assert.equal(visitor.officeOuting,null);assert.notEqual(visitor.activity,'phone-police');assert.equal(m.state.gymBlocked,false);
 const other=fresh();quietRounds(other);other.receiveCall();tick(other,2);other.triggerEvent('fire');assert.equal(other.state.npcs.find(n=>n.id==='gym-visitor').officeOuting,null);other.finishEvent(true);quietRounds(other);tick(other,30);
 const returned=other.state.npcs.find(n=>n.id==='gym-visitor');assert.equal(returned.activity,'gym');assert.ok(distance(returned,other.station('gym'))<70);
});

test('a fire truck arrives, gives one all-clear and sends coworkers to their own desks',()=>{
 const m=fresh();quietRounds(m);m.triggerEvent('fire');const id=m.state.fireResponse.id,deadlines=m.state.tasks.map(t=>t.deadline);
 tick(m,4);assert.ok(m.state.npcMessages.length);tick(m,5);assert.equal(m.state.fireResponse.stage,'enroute');assert.deepEqual(m.state.tasks.map(t=>t.deadline),deadlines);
 const complaints=m.state.banter.filter(b=>b.kind==='fire'&&b.speaker!=='Office announcement');assert.ok(complaints.length>=1);
 assert.equal(new Set(complaints.map(b=>b.speaker)).size,complaints.length);
 tick(m,2);assert.equal(m.state.fireResponse.stage,'arrived');assert.equal(m.state.fireResponse.progress,1);
 tick(m,14);assert.equal(m.state.event,null);assert.equal(m.state.fireResponse.id,id);assert.equal(m.state.fireResponse.stage,'cleared');assert.equal(m.state.fireResponse.allClearIssued,true);
 const clear=m.state.banter.filter(b=>b.kind==='allclear');assert.equal(clear.length,1);assert.equal(clear[0].text,'All clear. Everyone back to your desks, please.');
 for(const n of m.state.npcs.filter(n=>n.role!=='visitor'&&!n.hidden)){if(n.route.length)assert.ok(distance(n.route.at(-1),m.employeeHome(n))<1);else assert.ok(distance(n,m.employeeHome(n))<50);}
 quietRounds(m);tick(m,8);assert.equal(m.state.fireResponse,null);assert.equal(m.state.banter.filter(b=>b.kind==='allclear').length,1);
 tick(m,40);for(const n of m.state.npcs.filter(n=>n.role!=='visitor'&&!n.hidden))assert.ok(distance(n,m.employeeHome(n))<80);
});

test('early roll call departs from the current truck position and cannot replay a stale all-clear',()=>{
 const m=fresh();quietRounds(m);m.triggerEvent('fire');tick(m,3);const first=m.state.fireResponse.eventId,progress=m.state.fireResponse.progress;
 m.finishEvent(true);assert.equal(m.state.fireResponse.stage,'departing');assert.equal(m.state.fireResponse.departureStartProgress,progress);assert.equal(m.state.fireResponse.allClearIssued,false);
 tick(m,7);assert.equal(m.state.fireResponse,null);assert.equal(m.state.banter.filter(b=>b.kind==='allclear').length,0);
 assert.equal(m.triggerEvent('fire'),true);assert.notEqual(m.state.fireResponse.eventId,first);assert.equal(m.state.fireResponse.complaintIndex,0);assert.equal(m.state.fireResponse.progress,0);
});

test('paused saves and floor edits retain fire truck progress without repeating complaints',()=>{
 const m=fresh();quietRounds(m);m.triggerEvent('fire');tick(m,12);const saved=m.serialize(),next=new GameModel();assert.equal(next.restore(saved),true);
 const before=structuredClone(next.state.fireResponse),ids=next.state.banter.map(b=>b.id);tick(next,3);assert.deepEqual(next.state.fireResponse,before);
 const layout=cloneLayout(next.state.layout);layout.stations.find(s=>s.id==='assembly').x-=20;assert.equal(next.setLayout(layout).ok,true);assert.deepEqual(next.state.fireResponse,before);assert.deepEqual(next.state.banter.map(b=>b.id),ids);
 assert.ok(next.state.managers.every(a=>a.activity==='evacuating'&&a.route.length));for(let i=0;i<5;i++)next.ensureOfficeState();assert.deepEqual(next.state.fireResponse,before);
 next.setPaused(false);quietRounds(next);tick(next,13);assert.equal(next.state.event,null);assert.equal(next.state.banter.filter(b=>b.kind==='allclear').length,1);
 const clear=structuredClone(next.state.fireResponse);for(let i=0;i<5;i++)next.ensureOfficeState();assert.deepEqual(next.state.fireResponse,clear);
});

test('older active-fire saves gain a response at their existing drill age',()=>{
 const m=fresh();quietRounds(m);m.triggerEvent('fire');tick(m,7);const saved=m.serialize();delete saved.state.fireResponse;
 const next=new GameModel();assert.equal(next.restore(saved),true);assert.ok(Math.abs(next.state.fireResponse.elapsed-7)<.1);assert.equal(next.state.fireResponse.stage,'enroute');
 const count=next.state.banter.length;for(let i=0;i<5;i++)next.ensureOfficeState();assert.equal(next.state.banter.length,count);
 next.setPaused(false);quietRounds(next);tick(next,18);assert.equal(next.state.event,null);assert.equal(next.state.banter.filter(b=>b.kind==='allclear').length,1);
});

test('clock-out and event expiry cannot leave an active truck or alarm behind',()=>{
 const m=fresh();quietRounds(m);m.triggerEvent('fire');m.state.remaining=.01;tick(m,.05);assert.equal(m.state.phase,'ended');assert.equal(m.state.fireResponse,null);m.ensureOfficeState();assert.equal(m.state.fireResponse,null);
 const other=fresh();quietRounds(other);other.triggerEvent('fire');other.state.event.remaining=.01;tick(other,.05);assert.equal(other.state.event,null);assert.equal(other.state.fireResponse.stage,'departing');tick(other,7);assert.equal(other.state.fireResponse,null);
});

console.log(passed+' office behavior checks passed; '+failed+' failed.');if(failed)process.exitCode=1;
