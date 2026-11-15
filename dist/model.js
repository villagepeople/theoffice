import {DEFAULT_LAYOUT,normalizeLayout,validateLayout,layoutStations,layoutObstacles,interactionPoint,cloneLayout,layoutDesks,deskStandingPoint,EMPLOYEE_NAMES} from './layout.js';
export const ROLES=[
{id:'small',label:'Small benefits',short:'Small benefits',color:'#75a78a',description:'Big help for small businesses.',taskTitle:'A little company. A big renewal.',steps:['Clarify the need','Compare the options','Deliver the renewal']},
{id:'large',label:'Large benefits',short:'Large benefits',color:'#6e91aa',description:'Bring specialists, budgets, and approvals together.',taskTitle:'The very large renewal',steps:['Check the data','Balance priorities','Confirm approval']},
{id:'retirement',label:'Retirement',short:'Retirement',color:'#c29a60',description:'Make the future feel a little less complicated.',taskTitle:'Future-you says thank you',steps:['Prepare the workshop','Explain clearly','Arrange follow-up']},
{id:'flex',label:'Flex accounts',short:'Flex',color:'#af8aa5',description:'Untangle receipts and reimbursement questions.',taskTitle:'The missing receipt mystery',steps:['Review the file','Find the missing detail','Resolve the request']},
{id:'cobra',label:'COBRA',short:'COBRA',color:'#cd8875',description:'Keep notices, elections, and billing organized.',taskTitle:'Continuity, with confidence',steps:['Verify details','Track the workflow','Confirm the handoff']},
{id:'call',label:'Congierge',short:'Congierge',color:'#8c91b3',description:'Be the calm voice in an increasingly dramatic queue.',taskTitle:'You are caller number…',steps:['Listen carefully','Find the specialist','Make a warm handoff']},
{id:'accounting',label:'Accounting',short:'Accounting',color:'#7da69c',description:'Reconcile the numbers before the numbers revolt.',taskTitle:'The ledger has questions',steps:['Find the mismatch','Check the source','Reconcile the ledger']},
{id:'helpdesk',label:'MIS Helpdesk',short:'MIS Helpdesk',color:'#839ab3',description:'Rescue coworkers from very personal technology crises.',taskTitle:'Have you tried understanding it?',steps:['Understand the issue','Test the fix','Confirm recovery']},
{id:'developers',label:'MIS Developers',short:'MIS Developers',color:'#a38bb4',description:'Turn mysterious bugs into reliable office tools.',taskTitle:'It worked on somebody’s machine',steps:['Reproduce the bug','Make a focused fix','Verify the result']},
{id:'operations',label:'Operations',short:'Operations',color:'#b3a06f',description:'Keep the whole office functioning against all odds.',taskTitle:'Please keep the office standing',steps:['Assess the problem','Coordinate a response','Check the outcome']}
];
export const DIFFICULTIES=[{id:'casual',label:'Casual Friday',description:'Forgiving deadlines and room to breathe.'},{id:'normal',label:'Open Enrollment',description:'A busy office and a healthy amount of drama.'},{id:'hard',label:'Renewal Apocalypse',description:'More pressure. Less chill.'}];
export const OUTFITS=[{id:'disco',label:'Disco executive',color:'#9a72ad'},{id:'flamingo',label:'Flamingo Friday',color:'#e28c9e'},{id:'wizard',label:'Spreadsheet wizard',color:'#688ba8'},{id:'power',label:'Power blazer',color:'#5d8c72'}];
export const STATIONS=layoutStations(DEFAULT_LAYOUT);
export const OBSTACLES=layoutObstacles(DEFAULT_LAYOUT);
const SETTINGS={casual:{deadline:230,gap:75},normal:{deadline:185,gap:55},hard:{deadline:140,gap:39}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clean=(v,max=28)=>String(v??'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,max);

const CONTENT={
small:[['A client is hiring quickly. What should you clarify first?','Their team needs and budget','The most expensive plan','The brochure color'],['What belongs in a useful comparison?','Cost, coverage, and tradeoffs','Only the lowest price','Every acronym we know'],['The renewal is ready. What next?','Explain the choices and confirm approval','Guess their preference','Send a mysterious spreadsheet']],
large:[['The renewal file is incomplete. Where do you start?','Request and verify the missing data','Invent the missing numbers','Skip the analysis'],['Finance and HR want different things. What helps?','Show options with clear tradeoffs','Choose whoever is louder','Schedule nine more meetings'],['What completes the project?','Document the decision and coordinate delivery','Leave it on a desk','Assume everybody knows']],
retirement:[['What makes a useful workshop starting point?','Ask what participants want to understand','Count the slides','Order snacks first'],['How should the education session feel?','Clear, approachable, and relevant','Full of unexplained jargon','Like a competitive game show'],['People still have questions. What next?','Offer resources and appropriate follow-up','Promise guaranteed returns','Hide behind the projector']],

flex:[['A fictional claim is missing information. First step?','Review the plan rules and case details','Approve without checking','Recycle the paperwork'],['What should you request?','The specific missing documentation','Their entire filing cabinet','A handwritten apology'],['The file is complete. What closes the case?','Record the resolution and notify them','Close it silently','Send it around the office']],
cobra:[['A new fictional case arrives. What comes first?','Verify the event and participant details','Guess the dates','Wait for a complaint'],['What makes this workflow reliable?','Track required steps and game deadlines','Keep everything in your head','Sort by attractiveness'],['What should a handoff include?','Records, status, and the next responsible person','Only the font size','A shrug']],
call:[['A frustrated caller has an unclear question. What helps?','Listen and clarify the actual problem','Transfer immediately','Talk louder'],['The issue needs specialist help. What next?','Find the right team and share the context','Pick a random desk','Tell them to call tomorrow'],['How do you finish a good transfer?','Confirm the next step and ownership','Hang up mid-sentence','Sing the hold music']],
accounting:[['A billing total does not match. Where do you start?','Compare the ledger with source records','Change the total at random','Ignore the difference'],['You found an unfamiliar entry. What helps?','Verify its documentation and ownership','Delete it immediately','Assume it is lunch'],['The numbers now agree. What closes the task?','Record the reconciliation and notify the owner','Hide the worksheet','Erase the audit trail']],
helpdesk:[['A coworker says the computer is broken. First step?','Ask what happened and reproduce the symptom','Replace everything','Blame the keyboard'],['You have a likely fix. How should you proceed?','Try the smallest safe change and check it','Change every setting at once','Unplug the entire office'],['The service is back. What next?','Confirm with the user and record the fix','Leave without checking','Celebrate before testing']],
developers:[['A bug report says sometimes weird. What helps first?','Find clear reproduction steps','Rewrite the whole application','Close the report'],['You found the cause. What is the best fix?','A focused change addressing that cause','A mysterious unrelated workaround','Remove the useful feature'],['What makes the fix ready?','Verify the bug and related behavior','Trust a lucky first try','Skip review and testing']],
operations:[['Several office problems arrive at once. First move?','Assess urgency, impact, and who needs help','Pick the loudest complaint','Take a long unexplained walk'],['The issue crosses departments. What helps?','Assign clear owners and coordinate the response','Tell everybody to do everything','Start another rumor'],['How do you know the response worked?','Check the outcome with the people affected','Assume silence means success','Hide the request board']]
};
const EVENTS={
coffee:{title:'The coffee situation is critical.',description:'The pot is empty. Refill it before morale follows.',station:'coffee',actionLabel:'Refill the coffee',duration:65},
fire:{title:'Fire drill. Everybody out!',description:'Go to the assembly point. Case deadlines pause during the evacuation.',station:'assembly',actionLabel:'Complete the roll call',duration:80},
fight:{title:'A very unproductive disagreement.',description:'The stolen-lunch debate has become a cartoon scuffle. Operations can restore the peace.',station:'operations',actionLabel:'Restore the peace',duration:65},
portal:{title:'Carrier portal: absolutely offline.',description:'Visit MIS Helpdesk for a temporary workaround.',station:'helpdesk',actionLabel:'Set up the workaround',duration:70},
printer:{title:'Printer jam. Extra confetti.',description:'An ambitious print job has defeated the printer.',station:'printer',actionLabel:'Unjam the printer',duration:60},
replyall:{title:'Someone replied to everybody.',description:'Congierge needs help finding the useful message in the lunch debate.',station:'call',actionLabel:'Tame the reply-all storm',duration:65},
mascot:{title:'The wellness mascot has escaped.',description:'Retrieve the inflatable dinosaur at the assembly point.',station:'assembly',actionLabel:'Wrangle the mascot',duration:70},
client:{title:'Surprise! The client is here.',description:'Help large benefits pull the presentation together.',station:'large',actionLabel:'Welcome the client',duration:75},
phone:{title:'A VERY personal phone call.',description:'An overheard cell-phone saga is distracting nearby coworkers. Ask the caller to quiet down, or visit Operations.',station:'operations',actionLabel:'Restore a little quiet',duration:70},
music:{title:'Headphones. Office-wide volume.',description:'Everyone can hear the playlist. Ask the listener to turn it down, or visit Operations.',station:'operations',actionLabel:'Turn down the soundtrack',duration:70},
microwave:{title:'The microwave has been beeping forever.',description:'Someone forgot their food. Head to the kitchen to stop the beeping.',station:'kitchen',actionLabel:'Rescue the abandoned lunch',duration:65},
milk:{title:'One sip left. An empty carton.',description:'Someone used the last milk and left the carton behind. Coffee is less restorative until it is replaced.',station:'kitchen',actionLabel:'Replace the milk',duration:70},

crumbs:{title:'The counter is a crumb landscape.',description:'Someone made toast and left every crumb behind. A quick kitchen cleanup would help.',station:'kitchen',actionLabel:'Clean the counter',duration:70},
gym:{title:'The gym has a very fragrant visitor.',description:'The recurring outsider is monopolizing the equipment. Politely ask them to move on, or ask Operations.',station:'gym',actionLabel:'Reclaim the office gym',duration:75}
};


export class GameModel{
constructor(seed=20261114){this.seed=seed>>>0;this.nextTaskId=1;this.nextBanterId=1;this.elapsed=0;this.eventClock=35;this.projectileClock=10;this.summonClock=25;this.banterClock=12;this.state=this.initialState();this.rehomeNPCs();this.ensureOfficeState();}
random(){let t=this.seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
pick(a){return a[Math.floor(this.random()*a.length)];}
initialState(){return{phase:'lobby',layout:cloneLayout(DEFAULT_LAYOUT),executives:DEFAULT_LAYOUT.executives.map(e=>({...e,shouting:false,shout:''})),summon:null,onlinePlayers:[],npcMessages:[],banter:[],player:{id:'player',deskSlot:0,deskId:'desk-player-0',x:800,y:1040,name:'New colleague',role:'small',outfit:'disco',skin:'#d6a17c',stress:10,walk:false,heading:1},npcs:this.createNPCs(),stats:{completed:0,satisfaction:90,morale:85,coffee:100},remaining:480,total:480,tasks:[],event:null,log:[],route:[],day:1,projectiles:[],fx:[],currentTask:null,difficulty:'normal',score:0,kitchen:{microwave:'idle',milk:true,crumbs:false},gymBlocked:true};}
createNPCs(){const names=EMPLOYEE_NAMES,traits=['helpful','dramatic','meticulous','competitive','patient','grumpy'],skins=['#d6a17c','#99633f','#ecc2a0','#67482f','#b67e5b'];const result=names.map((name,i)=>{const st=this.stations[Math.floor(i/2)],desk=(this.state?.layout?.desks||DEFAULT_LAYOUT.desks).find(d=>d.id==='desk-npc-'+i),home=deskStandingPoint(desk);return{id:'npc-'+i,name,deskId:desk.id,home:{...home},x:home.x,y:home.y,color:ROLES[Math.floor(i/2)].color,mood:i%5===0?'grumpy':'calm',trait:traits[i%6],role:st.id,outfit:OUTFITS[i%4].id,skin:skins[i%5],stress:12+i*2,relationship:0,lastTalk:-100,walk:false,heading:i%2?1:-1,route:[],idle:4+i,activity:null};});result.push({id:'gym-visitor',name:'The gym regular',x:this.station('gym').x,y:this.station('gym').y+40,color:'#c4cc47',mood:'busy',trait:'oblivious',role:'visitor',outfit:'flamingo',skin:'#b67e5b',stress:0,walk:false,heading:1,route:[],idle:999,activity:'gym',hidden:false});return result;}
start(config={}){const day=this.state.day||1,layout=normalizeLayout(config.layout||this.state.layout||DEFAULT_LAYOUT);this.state=this.initialState();this.setLayout(layout);const s=this.state,p=s.player;p.id=clean(config.id,64)||'player';p.deskSlot=clamp(Math.floor(num(config.deskSlot)),0,3);p.deskId='desk-player-'+p.deskSlot;Object.assign(p,this.nearestFree(...Object.values(this.point('desk:'+p.deskId))));p.name=clean(config.name)||'New colleague';p.role=ROLES.some(r=>r.id===config.role)?config.role:'small';p.outfit=OUTFITS.some(o=>o.id===config.outfit)?config.outfit:'disco';p.skin=/^#[0-9a-f]{6}$/i.test(config.skin||'')?config.skin:'#d6a17c';s.difficulty=SETTINGS[config.difficulty]?config.difficulty:'normal';s.day=day;s.phase='playing';this.elapsed=0;this.eventClock=35;this.projectileClock=10;this.summonClock=25;this.banterClock=12;this.addTask(p.role);while(s.tasks.length<3)this.addTask();this.log('Welcome, '+p.name+'. Your first case is waiting in '+ROLES.find(r=>r.id===p.role).short+'.','good');this.log('Click to walk. Visit a department counter to open a case, or stop by an employee’s desk.','info');return s;}
addTask(roleId){const s=this.state,used=s.tasks.map(t=>t.role),pool=ROLES.filter(r=>!used.includes(r.id));const role=ROLES.find(r=>r.id===roleId)||this.pick(pool.length?pool:ROLES),content=CONTENT[role.id],deadline=SETTINGS[s.difficulty].deadline+this.random()*25;const choices=content.map(a=>{const rotate=Math.floor(this.random()*3);return[0,1,2].map(i=>a[1+(i+rotate)%3]);});const task={id:'task-'+this.nextTaskId++,role:role.id,title:role.taskTitle,client:this.pick(['Juniper Studio','Orbit Bakery','Good Egg Labs','Moss & Co.','Cloud Nine Group','Little Giant Co.']),steps:content.map(a=>a[0]),choices,answers:choices.map((a,i)=>a.indexOf(content[i][1])),step:0,deadline,totalDeadline:deadline,misses:0};s.tasks.push(task);return task;}
log(text,tone='info'){this.state.log.unshift({text:clean(text,220),tone,time:this.elapsed});this.state.log=this.state.log.slice(0,20);}
isFree(x,y,r=12){return Number.isFinite(x)&&Number.isFinite(y)&&x>=22&&x<=this.bounds.width-22&&y>=25&&y<=this.bounds.height-25&&!this.obstacles.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h);}
nearestFree(x,y){x=clamp(num(x,800),25,this.bounds.width-25);y=clamp(num(y,1040),30,this.bounds.height-30);if(this.isFree(x,y))return{x,y};for(let radius=20;radius<400;radius+=20)for(let a=0;a<16;a++){const nx=x+Math.cos(a*Math.PI/8)*radius,ny=y+Math.sin(a*Math.PI/8)*radius;if(this.isFree(nx,ny))return{x:nx,y:ny};}return{x:800,y:1040};}
segmentFree(a,b){const n=Math.max(1,Math.ceil(dist(a,b)/7));for(let i=1;i<=n;i++)if(!this.isFree(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,13))return false;return true;}

pathTo(from,x,y){const end=this.nearestFree(x,y),cols=Math.ceil(this.bounds.width/20),rows=Math.ceil(this.bounds.height/20);const cell=p=>({c:clamp(Math.floor(p.x/20),1,cols-2),r:clamp(Math.floor(p.y/20),1,rows-2)}),valid=(c,r)=>c>=1&&c<cols-1&&r>=1&&r<rows-1&&this.isFree(c*20+10,r*20+10,13),key=(c,r)=>r*cols+c;const start=cell(from);let finish=cell(end);if(!valid(finish.c,finish.r)){let f=null;for(let d=1;d<8&&!f;d++)for(let dc=-d;dc<=d&&!f;dc++)for(let dr=-d;dr<=d&&!f;dr++)if(valid(finish.c+dc,finish.r+dr))f={c:finish.c+dc,r:finish.r+dr};if(!f)return[];finish=f;}const sk=key(start.c,start.r),gk=key(finish.c,finish.r),open=[{...start,k:sk,g:0,f:0}],came=new Map(),scores=new Map([[sk,0]]),closed=new Set();let found=null,attempts=0;while(open.length&&attempts++<cols*rows*2){open.sort((a,b)=>a.f-b.f);const cur=open.shift();if(closed.has(cur.k))continue;if(cur.k===gk){found=cur.k;break;}closed.add(cur.k);for(const[dc,dr]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const c=cur.c+dc,r=cur.r+dr;if(!valid(c,r)||dc&&dr&&(!valid(cur.c+dc,cur.r)||!valid(cur.c,cur.r+dr)))continue;const k=key(c,r),g=cur.g+(dc&&dr?1.414:1);if(g>=(scores.get(k)??Infinity))continue;scores.set(k,g);came.set(k,cur.k);open.push({c,r,k,g,f:g+Math.hypot(finish.c-c,finish.r-r)});}}if(found===null)return[];const raw=[];let k=found;while(k!==sk&&raw.length<cols*rows){raw.unshift({x:(k%cols)*20+10,y:Math.floor(k/cols)*20+10});k=came.get(k);if(k===undefined)return[];}if(this.segmentFree(raw.length?raw[raw.length-1]:from,end))raw.push(end);const route=[];let cur=from,i=0;while(i<raw.length){let far=i;for(let j=i+1;j<raw.length;j++){if(this.segmentFree(cur,raw[j]))far=j;else break;}route.push(raw[far]);cur=raw[far];i=far+1;}return route;}
moveTo(x,y){const s=this.state;if(!['playing','lobby'].includes(s.phase)||s.currentTask)return false;s.route=this.pathTo(s.player,x,y);return s.route.length>0;}
moveDirection(dx,dy,dt){const s=this.state;if(s.phase!=='playing'||s.currentTask)return;dt=clamp(num(dt),0,.05);const length=Math.hypot(dx,dy);if(!length)return;s.route=[];const p=s.player,speed=158*(p.stress>85?.83:1),mx=dx/length*speed*dt,my=dy/length*speed*dt;if(this.isFree(p.x+mx,p.y))p.x+=mx;if(this.isFree(p.x,p.y+my))p.y+=my;p.walk=true;p.heading=dx<0?-1:dx>0?1:p.heading;}
follow(entity,route,speed,dt){if(!route?.length){entity.walk=false;return;}const dest=route[0],d=dist(entity,dest),step=speed*dt;if(d<=step+.2){entity.x=dest.x;entity.y=dest.y;route.shift();entity.walk=route.length>0;}else{const nx=entity.x+(dest.x-entity.x)/d*step,ny=entity.y+(dest.y-entity.y)/d*step;if(this.isFree(nx,ny,10)){entity.heading=nx<entity.x?-1:1;entity.x=nx;entity.y=ny;entity.walk=true;}else{route.length=0;entity.walk=false;}}}
update(dt){dt=clamp(num(dt),0,.05);const s=this.state;if(!dt||s.phase==='paused'||s.phase==='ended')return;this.elapsed+=dt;const p=s.player;this.follow(p,s.route,158*(p.stress>85?.83:1),dt);for(const npc of s.npcs){if(npc.hidden)continue;this.follow(npc,npc.route,52,dt);if(npc.leaving&&!npc.route.length){npc.hidden=true;npc.leaving=false;continue;}if(npc.role==='visitor')continue;this.updateMeeting(npc,dt);npc.idle-=dt;if(!npc.route.length&&npc.idle<=0&&!npc.activity){const home=this.employeeHome(npc),dest=s.event?.type==='fire'?this.assemblyScatter():dist(npc,home)>75?home:this.nearestFree(home.x+(this.random()-.5)*42,home.y+(this.random()-.5)*24);npc.route=this.pathTo(npc,dest.x,dest.y);npc.idle=8+this.random()*15;}npc.mood=npc.stress>65?'grumpy':npc.stress>38?'busy':'calm';}
s.npcMessages=s.npcMessages.filter(f=>{f.remaining-=dt;return f.remaining>0;});s.fx=s.fx.filter(f=>{f.remaining-=dt;return f.remaining>0;});for(const q of s.projectiles){q.age+=dt;q.x=q.fromX+(q.toX-q.fromX)*Math.min(1,q.age/q.duration);q.y=q.fromY+(q.toY-q.fromY)*Math.min(1,q.age/q.duration);if(q.age>=q.duration&&!q.hit){q.hit=true;if(dist(p,q)<65&&s.phase==='playing'){p.stress=clamp(p.stress+3,0,100);this.log('A paper ball has entered the conversation.','warn');}}}s.projectiles=s.projectiles.filter(q=>q.age<q.duration+.18);if(s.phase==='lobby')return;this.updateOffice(dt);this.updateExecutive(dt);
s.remaining=Math.max(0,s.remaining-dt);const fire=s.event?.type==='fire';if(!fire){for(const t of s.tasks)t.deadline-=dt;for(const t of s.tasks.filter(t=>t.deadline<=0)){s.tasks=s.tasks.filter(q=>q.id!==t.id);if(s.currentTask===t.id)s.currentTask=null;s.stats.satisfaction=clamp(s.stats.satisfaction-8,0,100);p.stress=clamp(p.stress+7,0,100);this.log(t.client+' needed more attention. A case timed out.','warn');this.addTask();}}
s.stats.coffee=Math.max(0,s.stats.coffee-dt*.14);s.stats.morale=clamp(s.stats.morale+dt*(s.stats.coffee>10?.006:-.065),0,100);p.stress=clamp(p.stress-dt*.11,0,100);this.eventClock-=dt;if(!s.event&&this.eventClock<=0)this.triggerEvent();const event=s.event;if(event){event.remaining-=dt;if(event.type==='coffee')s.stats.morale=Math.max(0,s.stats.morale-dt*.08);if(event.type==='phone'||event.type==='music'){const noisy=s.npcs.find(n=>n.id===event.npcId);if(noisy){if(dist(p,noisy)<160)p.stress=clamp(p.stress+dt*.9,0,100);for(const n of s.npcs)if(n.id!==noisy.id&&dist(n,noisy)<160)n.stress=clamp(n.stress+dt*.7,0,100);}s.stats.morale=clamp(s.stats.morale-dt*.035,0,100);}if(event.type==='microwave'){const k=this.station('kitchen');if(dist(p,k)<190)p.stress=clamp(p.stress+dt*.8,0,100);for(const n of s.npcs)if(dist(n,k)<190)n.stress=clamp(n.stress+dt*.6,0,100);}if(event.type==='crumbs')s.stats.morale=clamp(s.stats.morale-dt*.045,0,100);if(event.remaining<=0)this.finishEvent(false);}

this.projectileClock-=dt;if(this.projectileClock<=0&&!fire){this.projectileClock=12+this.random()*12;const npc=this.pick(s.npcs.filter(n=>n.role==='call')),target=this.pick(s.npcs.filter(n=>n.role!=='call'&&n.role!=='visitor'));if(npc&&target)s.projectiles.push({id:'paper-'+this.elapsed,fromX:npc.x,fromY:npc.y,toX:target.x,toY:target.y,x:npc.x,y:npc.y,age:0,duration:1.15});}
if(s.remaining<=0){s.phase='ended';s.currentTask=null;s.route=[];s.score=Math.round(s.stats.completed*150+s.stats.satisfaction*5+s.stats.morale*3+(100-p.stress)*2);this.log('Shift complete. You survived the benefits business.','good');}}
interact(stationId){const s=this.state;if(s.phase!=='playing')return{kind:'none'};if(stationId.startsWith('npc:')){const npc=s.npcs.find(n=>n.id===stationId.slice(4));if(!npc||npc.hidden)return{kind:'none'};if(dist(s.player,npc)>110)return{kind:'blocked',message:'Get a little closer to '+npc.name+'.'};if(s.event?.npcId===npc.id){this.finishEvent(true);return{kind:'event',message:'A polite request. A quieter office. Everybody wins.'};}return this.talkTo(npc.id,'greet');}
if(stationId.startsWith('desk:'))return this.interactDesk(stationId.slice(5));if(stationId.startsWith('exec:'))return this.interactExecutive(stationId.slice(5));const st=this.station(stationId);if(!st)return{kind:'none'};if(dist(s.player,this.point(stationId))>110){this.moveTo(this.point(stationId).x,this.point(stationId).y);return{kind:'blocked',message:'Walking to '+st.label+'…'};}if(s.event&&(s.event.station===stationId||stationId==='operations'&&['phone','music','gym','microwave','milk','crumbs','fight'].includes(s.event.type))){const label=s.event.actionLabel;this.finishEvent(true);return{kind:'event',message:label+' — done!'};}if(s.event?.type==='fire')return{kind:'blocked',message:'Head to the assembly point for the fire drill.'};
if(stationId==='gym'){if(s.gymBlocked){this.clearGym();s.stats.morale=clamp(s.stats.morale+5,0,100);this.log('The visitor moved on. Your office gym belongs to the office again.','good');return{kind:'event',message:'The gym regular has moved on. You can finally use the equipment.'};}s.player.stress=clamp(s.player.stress-25,0,100);this.log('A quick workout. Stress −25.','good');return{kind:'coffee',message:'A little movement, a clearer head. Stress reduced.'};}
if(stationId==='call'&&s.phoneQueue?.waiting>0)return this.answerQueuedCall();
if(stationId==='kitchen'){s.kitchen={microwave:'idle',milk:true,crumbs:false};s.stats.morale=clamp(s.stats.morale+3,0,100);return{kind:'chat',message:'A clean counter, fresh milk, and a quiet microwave. Beautiful.'};}if(stationId==='coffee'){const milk=s.kitchen.milk,stale=s.coffee?.status==='stale';if(s.stats.coffee<45||stale){this.brewFreshCoffee();s.stats.morale=clamp(s.stats.morale+5,0,100);}const relief=milk?22:10;s.player.stress=clamp(s.player.stress-relief,0,100);this.log(milk?'A fresh coffee and a deep breath. Stress −22.':'Black coffee it is. The empty milk carton is not helping.','good');return{kind:'coffee',message:stale?'You replaced the stale pot. Fresh coffee, fresh start.':milk?'Coffee restored. You feel considerably more employable.':'Coffee helps, but fresh milk would help more. Visit the kitchen.'};}if(stationId==='printer')return{kind:'chat',message:'The printer is behaving. Suspicious, but welcome.'};if(stationId==='assembly')return{kind:'chat',message:'A quiet moment outside. Nothing is on fire.'};if(s.event?.type==='portal'&&stationId==='large')return{kind:'blocked',message:'The portal is offline. MIS Helpdesk can find a workaround.'};const task=s.tasks.find(t=>t.role===stationId);if(task){s.currentTask=task.id;s.route=[];return{kind:'task',task};}s.player.stress=clamp(s.player.stress-3,0,100);return{kind:'chat',message:'No active cases here. Your coworkers appreciate the check-in.'};}
advanceTask(choiceIndex){const s=this.state,t=s.tasks.find(t=>t.id===s.currentTask);if(!t||!['playing','paused'].includes(s.phase))return{complete:false,message:'Choose a case at its department desk first.'};if(choiceIndex!==undefined&&Number(choiceIndex)!==t.answers[t.step]){t.misses++;s.player.stress=clamp(s.player.stress+4,0,100);t.deadline=Math.max(8,t.deadline-5);return{complete:false,correct:false,message:'That creates more work. Try the choice that helps the client.'};}t.step++;s.player.stress=clamp(s.player.stress+2,0,100);if(t.step<t.steps.length)return{complete:false,correct:true,message:'Good call. On to the next step.'};const bonus=t.role===s.player.role;s.stats.completed++;s.stats.satisfaction=clamp(s.stats.satisfaction+(bonus?5:3),0,100);s.stats.morale=clamp(s.stats.morale+2,0,100);s.player.stress=clamp(s.player.stress-(bonus?8:4),0,100);s.score+=bonus?180:150;for(const n of s.npcs)if(n.role===t.role)n.stress=Math.max(0,n.stress-12);this.log(t.client+' is sorted. '+(bonus?'Department expertise bonus!':'Another happy client.'),'good');s.fx.push({type:'success',x:s.player.x,y:s.player.y,remaining:1.8,text:'+1 case'});s.tasks=s.tasks.filter(q=>q.id!==t.id);s.currentTask=null;this.addTask();return{complete:true,correct:true,message:bonus?'Case closed. Expertise bonus earned!':'Case closed. Nicely handled.'};}
closeTask(){this.state.currentTask=null;}
setPaused(value){if(value&&this.state.phase==='playing')this.state.phase='paused';else if(!value&&this.state.phase==='paused')this.state.phase='playing';return this.state.phase;}
clearGym(){const s=this.state;s.gymBlocked=false;const n=s.npcs.find(n=>n.id==='gym-visitor');if(n){n.activity=null;n.officeOuting=null;n.leaving=true;n.route=this.pathTo(n,this.station('assembly').x+55,this.station('assembly').y+40);if(!n.route.length)n.hidden=true;}}

applyEventState(e){const s=this.state;if(e.type==='coffee')s.stats.coffee=0;if(e.type==='microwave')s.kitchen.microwave='beeping';if(e.type==='milk')s.kitchen.milk=false;if(e.type==='crumbs'){s.kitchen.crumbs=true;const owner=s.npcs.find(n=>n.id===e.ownerId)||this.pick(s.npcs.filter(n=>n.role!=='visitor'));e.ownerId=owner.id;s.kitchen.crumbsOwnerId=owner.id;s.kitchen.crumbsDeskId=owner.deskId;}if(e.type==='gym'){s.gymBlocked=true;const n=s.npcs.find(n=>n.id==='gym-visitor');if(n){n.hidden=false;n.leaving=false;n.x=this.station('gym').x;n.y=this.station('gym').y+40;n.route=[];n.activity='gym';}}if(e.type==='phone'||e.type==='music'){let n=s.npcs.find(n=>n.id===e.npcId&&n.role!=='visitor');if(!n)n=this.pick(s.npcs.filter(n=>n.role!=='visitor'));e.npcId=n.id;n.activity=e.type;n.route=[];n.walk=false;}if(e.type==='fight'){const a=s.npcs.filter(n=>n.role==='operations');e.npcIds=a.map(n=>n.id);for(const n of a){n.activity='fight';n.route=[];n.stress=80;}}if(e.type==='fire'){this.interruptOfficeForFire();if(s.summon)this.finishSummon(null);s.currentTask=null;s.route=[];for(const n of s.npcs){if(n.hidden)continue;const p=this.assemblyScatter();n.route=this.pathTo(n,p.x,p.y);n.idle=100;}}}
triggerEvent(type){const s=this.state;if(s.phase!=='playing'||s.event)return false;const key=EVENTS[type]?type:this.pick(Object.keys(EVENTS)),def=EVENTS[key];s.event={id:'event-'+Math.floor(this.elapsed*1000),type:key,...def,remaining:def.duration};for(const n of s.npcs)if(n.role!=='visitor')n.stress=clamp(n.stress+8,0,100);this.applyEventState(s.event);this.log(def.title,'warn');this.addBanter('Office announcement',def.title,'event');return true;}
finishEvent(success){const s=this.state,e=s.event;if(!e)return;if(success){s.stats.morale=clamp(s.stats.morale+9,0,100);s.stats.satisfaction=clamp(s.stats.satisfaction+2,0,100);s.player.stress=clamp(s.player.stress-12,0,100);s.score+=75;for(const n of s.npcs)n.stress=Math.max(0,n.stress-15);this.log('Crisis handled: '+e.title,'good');s.fx.push({type:'success',x:s.player.x,y:s.player.y,remaining:1.8,text:'+teamwork'});}else{s.stats.morale=clamp(s.stats.morale-7,0,100);s.player.stress=clamp(s.player.stress+5,0,100);this.log('The office muddled through. A little help would have gone a long way.','warn');}if(e.type==='coffee'){s.stats.coffee=s.kitchen.milk?(success?100:40):(success?65:30);if(s.coffee){s.coffee.age=success?0:80;s.coffee.status='fresh';s.coffee.brewId++;}}if(e.type==='microwave')s.kitchen.microwave='idle';if(e.type==='milk')s.kitchen.milk=true;if(e.type==='crumbs'){s.kitchen.crumbs=false;delete s.kitchen.crumbsOwnerId;delete s.kitchen.crumbsDeskId;}if(e.type==='gym'&&success)this.clearGym();for(const n of s.npcs){if(n.activity==='phone'||n.activity==='music'||n.activity==='fight')n.activity=null;}if(e.type==='fire')for(const n of s.npcs){if(n.role==='visitor'||n.hidden)continue;const p=this.employeeHome(n);n.route=this.pathTo(n,p.x,p.y);n.idle=12;}s.event=null;if(e.type==='fire')this.resumeOfficeAfterFire();this.eventClock=SETTINGS[s.difficulty].gap+this.random()*20;}
nextDay(){const p={...this.state.player},difficulty=this.state.difficulty,layout=this.state.layout;this.state.day++;return this.start({id:p.id,name:p.name,role:p.role,outfit:p.outfit,skin:p.skin,deskSlot:p.deskSlot,difficulty,layout});}
serialize(){return{version:3,nextBanterId:this.nextBanterId,summonClock:this.summonClock,banterClock:this.banterClock,seed:this.seed,nextTaskId:this.nextTaskId,elapsed:this.elapsed,eventClock:this.eventClock,projectileClock:this.projectileClock,state:JSON.parse(JSON.stringify(this.state))};}

_restoreLegacy(data){try{if(typeof data==='string')data=JSON.parse(data);if(![1,2,3].includes(data?.version)||!data.state||typeof data.state!=='object')return false;const r=data.state;if(!ROLES.some(x=>x.id===r.player?.role)||!['playing','paused','ended'].includes(r.phase)||!SETTINGS[r.difficulty])return false;const s=this.initialState();s.phase=r.phase==='ended'?'ended':'paused';s.day=clamp(Math.floor(num(r.day,1)),1,999);s.difficulty=r.difficulty;s.player={...s.player,name:clean(r.player.name)||'New colleague',role:r.player.role,outfit:OUTFITS.some(x=>x.id===r.player.outfit)?r.player.outfit:'disco',skin:/^#[0-9a-f]{6}$/i.test(r.player.skin||'')?r.player.skin:s.player.skin,stress:clamp(num(r.player.stress),0,100),deskSlot:clamp(Math.floor(num(r.player.deskSlot)),0,3),deskId:'desk-player-'+clamp(Math.floor(num(r.player.deskSlot)),0,3),...this.nearestFree(r.player.x,r.player.y)};s.remaining=clamp(num(r.remaining,480),0,480);s.total=480;s.score=clamp(num(r.score),0,9999999);for(const k of ['completed','satisfaction','morale','coffee'])s.stats[k]=clamp(num(r.stats?.[k],s.stats[k]),0,k==='completed'?9999:100);s.tasks=Array.isArray(r.tasks)?r.tasks.filter(t=>ROLES.some(x=>x.id===t.role)).slice(0,3).map((t,i)=>{const role=ROLES.find(x=>x.id===t.role),c=CONTENT[t.role];return{id:'task-restored-'+i,role:t.role,title:role.taskTitle,client:clean(t.client,40)||'Juniper Studio',steps:c.map(a=>a[0]),choices:c.map(a=>a.slice(1)),answers:[0,0,0],step:clamp(Math.floor(num(t.step)),0,2),deadline:clamp(num(t.deadline,150),5,300),totalDeadline:clamp(num(t.totalDeadline,185),5,300),misses:clamp(num(t.misses),0,999)};}):[];s.log=Array.isArray(r.log)?r.log.slice(0,15).map(l=>({text:clean(l.text,220),tone:['info','good','warn'].includes(l.tone)?l.tone:'info',time:num(l.time)})):[];s.gymBlocked=r.gymBlocked!==false;const visitor=s.npcs.find(n=>n.id==='gym-visitor');visitor.hidden=!s.gymBlocked;if(r.kitchen&&typeof r.kitchen==='object')s.kitchen={microwave:r.kitchen.microwave==='beeping'?'beeping':'idle',milk:r.kitchen.milk!==false,crumbs:r.kitchen.crumbs===true};this.state=s;this.seed=num(data.seed,20261114)>>>0;this.nextTaskId=clamp(Math.floor(num(data.nextTaskId,100)),1,999999);this.elapsed=clamp(num(data.elapsed),0,100000);this.eventClock=clamp(num(data.eventClock,35),5,120);this.projectileClock=10;if(r.event&&EVENTS[r.event.type]){const e=EVENTS[r.event.type];s.event={id:'restored-event',type:r.event.type,...e,remaining:clamp(num(r.event.remaining,e.duration),1,e.duration),npcId:clean(r.event.npcId,30)};this.applyEventState(s.event);}while(s.tasks.length<3)this.addTask();this.log('Your shift is saved. Take a breath, then resume.','info');return true;}catch{return false;}}

get stations(){const l=this.state?.layout||DEFAULT_LAYOUT;if(this._stationLayout!==l){this._stationLayout=l;this._stations=layoutStations(l);}return this._stations;}
get obstacles(){const l=this.state?.layout||DEFAULT_LAYOUT;if(this._obstacleLayout!==l){this._obstacleLayout=l;this._obstacles=layoutObstacles(l);}return this._obstacles;}
get desks(){
const s=this.state,layout=s?.layout||DEFAULT_LAYOUT,players=s?[...(s.onlinePlayers||[]),...(s.otherPlayers||[]),s.player].filter(Boolean):[];
return layoutDesks(layout).map(d=>{const owner=d.kind==='employee'?s?.npcs?.find(n=>n.id===d.ownerId):players.find(p=>Number(p.deskSlot??0)===Number(d.id.slice(-1)));const ownerName=owner?.name||null;return{...d,ownerId:owner?.id||null,ownerName,label:ownerName?ownerName+'\u2019s desk':d.label};});
}
employeeHome(npc){const desk=this.desks.find(d=>d.id===(npc.deskId||'desk-'+npc.id));if(desk){const p=deskStandingPoint(desk);return this.nearestFree(p.x,p.y);}const st=this.station(npc.role);return st?this.nearestFree(st.x,st.y+85):this.nearestFree(800,1040);}
interactDesk(id){const desk=this.desks.find(d=>d.id===id);if(!desk)return{kind:'none'};const p=deskStandingPoint(desk);if(dist(this.state.player,p)>95){this.moveTo(p.x,p.y);return{kind:'blocked',message:'Walking to '+desk.label+'\u2026'};}this.state.route=[];const note=(this.state.deskNotes||[]).find(n=>n.deskId===id&&this.canReadDeskNote(n));if(note){note.read=true;return{kind:'note',note:{...note},deskId:id,message:'A note from '+note.author+'.'};}return{kind:'chat',message:desk.ownerId===this.state.player.id?'Your own desk. A little room to collect your thoughts.':desk.ownerName?desk.ownerName+'\u2019s desk. Leave room for them to work and stand.':'An open desk, ready for another teammate.',deskId:id};}
get bounds(){const l=this.state?.layout||DEFAULT_LAYOUT;return{width:l.width,height:l.height};}
station(id){if(String(id).startsWith('desk:')){const d=this.desks.find(d=>d.id===id.slice(5));return d?{...d,id:'desk:'+d.id,label:d.label}:undefined;}return this.stations.find(s=>s.id===id);}
point(id){if(String(id).startsWith('desk:')){const d=this.desks.find(d=>d.id===id.slice(5));return d?deskStandingPoint(d):null;}const s=this.station(id);return s?interactionPoint(s):null;}
executive(id){return this.state.executives.find(e=>e.id===String(id).replace('exec:',''));}
assemblyScatter(){const a=this.station('assembly');return this.nearestFree(a.x-70+this.random()*140,a.y-20+this.random()*65);}
rehomeNPCs(){
const s=this.state;for(const n of s.npcs){const st=this.station(n.role==='visitor'?'gym':n.role);if(!st)continue;if(n.role!=='visitor')n.deskId='desk-'+n.id;const p=n.role==='visitor'?this.nearestFree(st.x,st.y+40):this.employeeHome(n);if(n.role!=='visitor')n.home={...p};Object.assign(n,p);n.route=[];n.walk=false;n.activity=n.role==='visitor'&&s.gymBlocked?'gym':null;}
Object.assign(s.player,this.nearestFree(s.player.x,s.player.y));s.route=[];
}
setLayout(input){
const result=validateLayout(input);if(!result.valid)return{ok:false,message:result.errors[0],errors:result.errors};
this.state.layout=normalizeLayout(input);this.state.executives=this.state.layout.executives.map(e=>({...e,shouting:false,shout:''}));this.state.summon=null;this.state.currentTask=null;this.state.npcMessages=[];this.rehomeNPCs();this.ensureOfficeState(true);if(this.state.event)this.applyEventState(this.state.event);this.summonClock=25;
return{ok:true,message:this.state.layout.migrationNotice||'Floor plan saved. Every desk, office, and shared area is reachable.',layout:cloneLayout(this.state.layout)};
}
addBanter(speaker,text,kind='banter'){
const s=this.state;s.banter.unshift({id:'banter-'+this.nextBanterId++,speaker:clean(speaker,40),text:clean(text,240),time:this.elapsed,kind:['banter','summon','event','reply','manager','queue'].includes(kind)?kind:'banter'});s.banter=s.banter.slice(0,40);return s.banter[0];
}
updateExecutive(dt){
const s=this.state,fire=s.event?.type==='fire';
if(!fire){if(s.summon){s.summon.remaining-=dt;if(s.summon.remaining<=0)this.finishSummon(false);}else{this.summonClock-=dt;if(this.summonClock<=0)this.triggerSummon();}}
this.banterClock-=dt;if(this.banterClock<=0){this.banterClock=12+this.random()*8;const n=this.pick(s.npcs.filter(n=>n.role!=='visitor'&&!n.hidden));const lines=['Does anyone know whose lunch has been in the microwave since Tuesday?','The last sip of milk does not count as a full carton.','Quick question: how quick is a quick question allowed to be?','I think the printer has developed a personal opinion about me.','I am going to the gym. Has our mystery member left yet?','Those headphones come with a volume button, right?','Can we rename the deadline to a polite suggestion?','Someone replied all to the reply-all warning.','The coffee machine is our most important infrastructure.','I have three monitors and somehow zero answers.','There is a meeting about reducing meetings at eleven.','Who moved my ergonomically questionable chair?'];if(n)this.addBanter(n.name,this.pick(lines),'banter');}
}
triggerSummon(targetId,executiveId){
const s=this.state;if(s.phase!=='playing'||s.summon||s.event?.type==='fire')return false;
const requested=s.npcs.find(n=>n.id===targetId);if(requested?.officeAssignment)this.finishOfficeAssignment(requested);const requestedManager=s.managers?.find(m=>m.id===executiveId);if(requestedManager?.activity){if(requestedManager.job?.kind==='coffee'&&s.coffee.status==='brewing')s.coffee.status='stale';this.returnManagerHome(requestedManager);}const available=s.executives.filter(e=>!s.managers?.find(m=>m.id===e.id)?.activity),e=executiveId?s.executives.find(e=>e.id===executiveId):this.pick(available);if(!e){this.summonClock=5;return false;}const employees=s.npcs.filter(n=>n.role!=='visitor'&&!n.hidden&&!n.activity),online=Array.isArray(s.onlinePlayers)?s.onlinePlayers.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'):[],players=online.length?online:[{...s.player,id:s.player.id||'player'}];
let target=employees.find(n=>n.id===targetId)||players.find(p=>p.id===targetId);if(!target)target=this.random()<.36?this.pick(players):this.pick(employees.length?employees:players);
const type=employees.some(n=>n.id===target.id)?'npc':online.some(p=>p.id===target.id)?'online':'player',shout=clean(target.name,28).toUpperCase()+'! MY OFFICE. NOW!';
s.summon={id:'summon-'+Math.floor(this.elapsed*1000),executiveId:e.id,targetId:target.id,targetName:clean(target.name,28),targetType:type,remaining:65,duration:65,station:'exec:'+e.id,shout,title:e.title+' needs attention',description:e.name+' is calling '+clean(target.name,28)+' into the '+e.title+' office.'};e.shouting=true;e.shout=shout;
if(type==='npc'){target.activity='summoned';target.route=this.pathTo(target,e.x,e.y+100);target.idle=90;}
this.log(e.title+': “'+shout+'”','warn');this.addBanter(e.title+' '+e.name,shout,'summon');return s.summon;
}
updateMeeting(n,dt){
const s=this.state;
if(n.activity==='summoned'&&!n.route.length){const p=this.point('exec:'+s.summon?.executiveId);if(s.summon?.targetId===n.id&&p&&dist(n,p)<45&&!s.managers?.find(m=>m.id===s.summon.executiveId)?.activity){n.activity='meeting';n.meetingRemaining=4;this.addBanter(n.name,'I am here. Which entirely urgent spreadsheet are we discussing?','reply');}}
if(n.activity==='meeting'){n.meetingRemaining-=dt;if(n.meetingRemaining<=0)this.finishSummon(true);}
}
finishSummon(success){
const s=this.state,call=s.summon;if(!call)return;const e=this.executive(call.executiveId);if(e){e.shouting=false;e.shout='';}const npc=s.npcs.find(n=>n.id===call.targetId);
if(npc&&['summoned','meeting'].includes(npc.activity)){npc.activity=null;const h=this.employeeHome(npc);npc.route=this.pathTo(npc,h.x,h.y);npc.idle=12;}
if(success===true){s.stats.morale=clamp(s.stats.morale+(call.targetType==='npc'?2:5),0,100);if(call.targetType!=='npc'){s.score+=75;s.player.stress=clamp(s.player.stress-8,0,100);}this.log(call.targetName+' handled the '+e.title+' request. It was marked extremely urgent.','good');this.addBanter(e.title,'Thank you, '+call.targetName+'. That was all. Extremely urgent.','reply');}
else if(success===false){s.stats.morale=clamp(s.stats.morale-3,0,100);if(call.targetId===(s.player.id||'player'))s.player.stress=clamp(s.player.stress+8,0,100);if(npc)npc.stress=clamp(npc.stress+10,0,100);this.log(e.title+' is still looking for '+call.targetName+'. Someone has scheduled a meeting about it.','warn');this.addBanter(e.title,call.targetName+'? Has anyone seen '+call.targetName+'?','summon');}
else this.log('The fire drill has postponed all executive demands.','info');
s.summon=null;this.summonClock=45+this.random()*30;
}
interactExecutive(id){
const s=this.state,e=this.executive(id);if(!e)return{kind:'none'};const p=this.point('exec:'+e.id);
if(dist(s.player,p)>110){this.moveTo(p.x,p.y);return{kind:'blocked',message:'Walk closer to the '+e.title+' office.'};}
const call=s.summon;if(call?.executiveId===e.id&&call.targetId===(s.player.id||'player')){this.finishSummon(true);return{kind:'event',message:e.name+': “Excellent. That was the urgent matter. You may go.”'};}
return{kind:'chat',npcId:'exec:'+e.id,name:e.name,message:e.name+': '+(call?.executiveId===e.id?'“I am waiting for '+call.targetName+'. Please send them in.”':'“My door is always open. Except when it is closed.”')};
}
talkTo(id,choice='greet'){
const s=this.state,n=s.npcs.find(n=>n.id===String(id).replace(/^npc:/,''));
if(!n||n.hidden)return{kind:'none',message:'That coworker is not here right now.'};
if(!['playing','paused'].includes(s.phase)||dist(s.player,n)>110)return{kind:'blocked',message:'Walk closer to '+n.name+' to talk.'};
if(!['greet','help','quiet'].includes(choice))return{kind:'blocked',message:'Choose a conversation option.'};
const warm={helpful:'“Need a hand? We can get through this queue together.”',dramatic:'“Everything is absolutely fine, except for literally everything.”',meticulous:'“I have organized my to-do list by urgency and paper weight.”',competitive:'“I closed three cases before my first coffee. Just saying.”',patient:'“One case at a time. We have this.”',grumpy:'“If one more person says quick question, I may become a plant.”',oblivious:'“Oh, this gym is for employees? That explains the name badges.”'};
let message=warm[n.trait]||warm.patient;const cooldown=this.elapsed-num(n.lastTalk,-100)<12,helpCooldown=this.elapsed-num(n.lastHelp,-100)<12;
if(choice==='help'){message=helpCooldown?'“Thanks. Give me a minute to finish this, then I will find you.”':n.trait==='competitive'?'“A team effort? Fine. But I am still keeping score.”':'“Thank you. That takes a real weight off my workload.”';if(!helpCooldown){n.stress=clamp(n.stress-15,0,100);n.relationship=clamp(num(n.relationship)+1,-10,10);s.stats.morale=clamp(s.stats.morale+2,0,100);s.player.stress=clamp(s.player.stress-4,0,100);n.lastHelp=this.elapsed;}}
else if(choice==='quiet'){if(s.event?.npcId===n.id&&['phone','music'].includes(s.event.type)){this.finishEvent(true);message='“Sorry! I did not realize everyone could hear that.”';n.relationship=clamp(num(n.relationship)+1,-10,10);}else if(n.role==='visitor'&&s.gymBlocked){this.clearGym();message='“Right. I will find a gym I actually belong to.”';}else message=n.trait==='grumpy'?'“I was already quiet. I can be quieter and grumpier.”':'“Of course. I will keep it down.”';}
else if(!cooldown){s.player.stress=clamp(s.player.stress-2,0,100);n.lastTalk=this.elapsed;}
const text=n.name+': '+message;s.npcMessages=[{npcId:n.id,name:n.name,text:message,remaining:6},...s.npcMessages].slice(0,4);this.log(text,'info');this.addBanter(n.name,message,'reply');
return{kind:'chat',message:text,npcId:n.id,name:n.name,trait:n.trait,relationship:num(n.relationship),options:[{id:'greet',label:'Say hello'},{id:'help',label:'Offer a hand'},{id:'quiet',label:'Ask for quiet'}]};
}
ensureOfficeState(resetManagers=false){
const s=this.state,desks=this.desks,deskIds=new Set(desks.map(d=>d.id));
const old=s.officeRoutines||{};
s.officeRoutines={serial:clamp(Math.floor(num(old.serial,1)),1,99999999),roundClock:clamp(num(old.roundClock,8),0,60),messClock:clamp(num(old.messClock,28),0,90),coffeeCheckClock:clamp(num(old.coffeeCheckClock,12),0,90),staffClock:clamp(num(old.staffClock,16),0,90),cursor:clamp(Math.floor(num(old.cursor)),0,2),cleaned:Math.max(0,num(old.cleaned)),coordinated:Math.max(0,num(old.coordinated)),gymCallCooldown:clamp(num(old.gymCallCooldown),0,120),noteCooldowns:old.noteCooldowns&&typeof old.noteCooldowns==='object'?old.noteCooldowns:{}};
const coffee=s.coffee||{};s.coffee={age:clamp(num(coffee.age,48),0,9999),status:['fresh','stale','brewing'].includes(coffee.status)?coffee.status:'fresh',brewId:Math.max(0,Math.floor(num(coffee.brewId))),checkedAt:num(coffee.checkedAt,-100)};
if(s.coffee.age>=100&&s.coffee.status==='fresh')s.coffee.status='stale';
s.deskMesses=(Array.isArray(s.deskMesses)?s.deskMesses:[]).filter(m=>m&&deskIds.has(m.deskId)&&['trash','crumbs'].includes(m.kind)).slice(0,8).map(m=>({id:clean(m.id,64),deskId:m.deskId,ownerId:clean(m.ownerId,64)||null,kind:m.kind,createdAt:num(m.createdAt)}));
s.deskNotes=(Array.isArray(s.deskNotes)?s.deskNotes:[]).filter(n=>n&&deskIds.has(n.deskId)).slice(0,32).map(n=>({id:clean(n.id,64),deskId:n.deskId,ownerId:clean(n.ownerId,64)||null,author:clean(n.author,60)||'Upper management',text:clean(n.text,360),read:n.read===true,createdAt:num(n.createdAt)}));
const queue=s.phoneQueue||{},calls=Array.isArray(queue.calls)?queue.calls.filter(c=>c&&typeof c.id==='string').slice(0,4).map(c=>({id:clean(c.id,64),remaining:clamp(num(c.remaining,62),0,90)})):[];
if(!calls.length&&num(queue.waiting)>0)for(let i=0;i<Math.min(4,Math.floor(queue.waiting));i++)calls.push({id:'call-'+s.officeRoutines.serial++,remaining:62});
s.phoneQueue={calls,waiting:calls.length,answered:Math.max(0,Math.floor(num(queue.answered))),missed:Math.max(0,Math.floor(num(queue.missed))),ringId:clean(queue.ringId,64)||null,ringing:calls.length>0&&s.event?.type!=='fire',ringAge:clamp(num(queue.ringAge),0,120),arrivalClock:clamp(num(queue.arrivalClock,13),0,90),complaintClock:clamp(num(queue.complaintClock,6),0,45),autoAnswerClock:clamp(num(queue.autoAnswerClock,15),0,45)};
for(const entry of [...s.deskNotes,...s.deskMesses,...calls]){const suffix=Number(String(entry.id).match(/-(\d+)$/)?.[1]);if(Number.isFinite(suffix))s.officeRoutines.serial=Math.max(s.officeRoutines.serial,suffix+1);}
const previous=Array.isArray(s.managers)?s.managers:[];
s.managers=s.executives.map((e,i)=>{const existing=!resetManagers&&previous.find(m=>m.id===e.id),home=this.nearestFree(e.x,e.y+48);if(existing&&this.isFree(existing.x,existing.y,10)){return{...existing,id:e.id,name:e.name,title:e.title,home,route:Array.isArray(existing.route)?existing.route:[],status:clean(existing.status,60)||'Available in office'};}return{id:e.id,name:e.name,title:e.title,...home,home,route:[],walk:false,heading:1,outfit:['power','wizard','disco'][i],skin:['#d6a17c','#99633f','#ecc2a0'][i],activity:null,status:'Available in office',remaining:0,cooldown:8+i*9,job:null};});
if(resetManagers)for(const n of s.npcs){if(n.officeAssignment){n.officeAssignment=null;if(['queue','support'].includes(n.activity))n.activity=null;}if(n.officeOuting){n.officeOuting=null;if(n.activity==='phone-police')n.activity=s.gymBlocked?'gym':null;}}
return s;
}
officeId(prefix){return prefix+'-'+this.state.officeRoutines.serial++;}
createDeskMess(deskId,kind='crumbs'){
const s=this.state,desk=this.desks.find(d=>d.id===deskId);if(!desk?.ownerId||!['crumbs','trash'].includes(kind)||s.deskMesses.length>=8)return null;
const existing=s.deskMesses.find(m=>m.deskId===deskId&&m.kind===kind);if(existing)return existing;
const mess={id:this.officeId('mess'),deskId,ownerId:desk.ownerId,kind,createdAt:this.elapsed};s.deskMesses.push(mess);return mess;
}
leaveDeskNote(deskId,author,text){
const s=this.state,desk=this.desks.find(d=>d.id===deskId);if(!desk?.ownerId)return null;
if(num(s.officeRoutines.noteCooldowns[deskId],-100)<this.elapsed-45){const note={id:this.officeId('note'),deskId,ownerId:desk.ownerId,author:clean(author,60)||'Upper management',text:clean(text,360),read:false,createdAt:this.elapsed};s.deskNotes.unshift(note);s.deskNotes=s.deskNotes.slice(0,32);s.officeRoutines.noteCooldowns[deskId]=this.elapsed;return note;}
return s.deskNotes.find(n=>n.deskId===deskId&&n.ownerId===desk.ownerId)||null;
}
canReadDeskNote(note,playerId=this.state.player.id){
if(!note)return false;const desk=this.desks.find(d=>d.id===note.deskId);if(!desk||!desk.ownerId||desk.ownerId!==note.ownerId)return false;return desk.kind==='employee'||note.ownerId===playerId;
}
dismissNote(noteId){
const s=this.state,note=s.deskNotes.find(n=>n.id===noteId);if(!note||!this.canReadDeskNote(note))return{kind:'blocked',message:'That note belongs to another colleague.'};
const point=this.point('desk:'+note.deskId);if(!['playing','paused'].includes(s.phase)||!point||dist(s.player,point)>95)return{kind:'blocked',message:'Return to the desk to put this note away.'};
s.deskNotes=s.deskNotes.filter(n=>n.id!==note.id);return{kind:'note-dismissed',message:'Note filed. The crumbs remain on notice.'};
}
brewFreshCoffee(){
const s=this.state;s.coffee.age=0;s.coffee.status='fresh';s.coffee.brewId++;s.stats.coffee=s.kitchen.milk?100:65;
if(s.event?.type==='coffee')this.finishEvent(true);
}
receiveCall(){
const s=this.state,q=s.phoneQueue;if(s.phase!=='playing'||s.event?.type==='fire'||q.calls.length>=4)return false;
q.calls.push({id:this.officeId('call'),remaining:62});q.waiting=q.calls.length;q.ringId=this.officeId('ring');q.ringing=true;
if(q.waiting===1){q.ringAge=0;q.complaintClock=4+this.random()*3;q.autoAnswerClock=16;}
return true;
}
answerQueuedCall(employee=null){
const s=this.state,q=s.phoneQueue;if(s.event?.type==='fire'||!q.calls.length)return{kind:'chat',message:'The phone queue is clear. A rare and beautiful silence.'};
q.calls.shift();q.waiting=q.calls.length;q.answered++;q.ringing=q.waiting>0;q.ringAge=0;s.stats.satisfaction=clamp(s.stats.satisfaction+1,0,100);s.stats.morale=clamp(s.stats.morale+1,0,100);
const name=employee?.name||s.player.name;this.log(name+' answered a Congierge call. '+(q.waiting?q.waiting+' still waiting.':'The queue is clear.'),'good');
if(!employee){s.score+=25;s.player.stress=clamp(s.player.stress-3,0,100);}
return{kind:'phone',message:q.waiting?'Call handled. '+q.waiting+' caller'+(q.waiting===1?' is':'s are')+' still waiting.':'Call handled. The queue is clear. Your coworkers may now exhale.'};
}
assignOfficeSupport(manager=null,kind='queue',taskId=null){
const s=this.state;if(s.event?.type==='fire')return false;
if(s.npcs.some(n=>n.officeAssignment?.kind===kind))return false;
const task=kind==='support'?s.tasks.find(t=>t.id===taskId&&!t.managerSupported):null;
if(kind==='queue'&&!s.phoneQueue.waiting||kind==='support'&&!task)return false;
const pool=s.npcs.filter(n=>n.role!=='visitor'&&!n.hidden&&!n.activity&&!n.officeAssignment);
pool.sort((a,b)=>kind==='queue'?(a.role==='call'?0:1)-(b.role==='call'?0:1)||a.stress-b.stress:(a.role===task?.role?0:1)-(b.role===task?.role?0:1)||a.stress-b.stress);
const npc=pool[0];if(!npc)return false;
const target=kind==='queue'?this.employeeHome(npc):this.nearestFree(this.point(task.role).x+40,this.point(task.role).y+24),route=this.pathTo(npc,target.x,target.y);
if(!route.length&&dist(npc,target)>32)return false;
npc.activity=kind;npc.route=route;npc.idle=35;npc.officeAssignment={kind,taskId:task?.id||null,target,remaining:kind==='queue'?6:8,elapsed:0,managerId:manager?.id||null};
if(manager){s.officeRoutines.coordinated++;this.addBanter(manager.title+' '+manager.name,kind==='queue'?npc.name+', please help with the phone queue. The hold music needs a break.':npc.name+', please help '+ROLES.find(r=>r.id===task.role).short+' with that deadline. You have backup.','manager');}
return npc;
}
updateOfficeAssignments(dt){
const s=this.state;
for(const npc of s.npcs){const assignment=npc.officeAssignment;if(!assignment)continue;
assignment.elapsed+=dt;
if(s.event?.type==='fire'||npc.activity!==assignment.kind||assignment.elapsed>55||assignment.kind==='queue'&&!s.phoneQueue.waiting){this.finishOfficeAssignment(npc);continue;}
if(npc.route.length)continue;
if(dist(npc,assignment.target)>36){this.finishOfficeAssignment(npc);continue;}
assignment.remaining-=dt;if(assignment.remaining>0)continue;
if(assignment.kind==='queue')this.answerQueuedCall(npc);
else{const task=s.tasks.find(t=>t.id===assignment.taskId);if(task&&!task.managerSupported){task.managerSupported=true;task.deadline=Math.min(task.totalDeadline+20,task.deadline+16);for(const colleague of s.npcs)if(colleague.role===task.role)colleague.stress=clamp(colleague.stress-9,0,100);s.stats.morale=clamp(s.stats.morale+2,0,100);this.log(npc.name+' helped '+ROLES.find(r=>r.id===task.role).short+' organize the case. A little breathing room earned.','good');}}
this.finishOfficeAssignment(npc);
}
}
finishOfficeAssignment(npc){
const old=npc.officeAssignment;npc.officeAssignment=null;if(old&&npc.activity===old.kind)npc.activity=null;
if(this.state.event?.type!=='fire'){const home=this.employeeHome(npc);npc.route=this.pathTo(npc,home.x,home.y);npc.idle=12;}
}
managerDestination(manager,target){
const destination=this.nearestFree(target.x,target.y),route=this.pathTo(manager,destination.x,destination.y);
if(!route.length&&dist(manager,destination)>36)return false;manager.route=route;manager.job.target=destination;return true;
}
startManagerRound(managerId){
const s=this.state,r=s.officeRoutines,m=s.managers.find(m=>m.id===managerId)||s.managers.find(m=>!m.activity&&m.cooldown<=0);
if(!m||m.activity||s.phase!=='playing'||s.event?.type==='fire'||s.summon?.executiveId===m.id)return false;
const reserved=kind=>s.managers.some(other=>other.job?.kind===kind),mess=s.deskMesses.find(d=>!s.managers.some(other=>other.job?.messId===d.id));
let job,status,target;
if((s.coffee.status==='stale'||s.stats.coffee<10||r.coffeeCheckClock<=0)&&!reserved('coffee')){job={kind:'coffee',stage:'travel',remaining:2,elapsed:0};target=this.point('coffee');status='Checking coffee';r.coffeeCheckClock=50;}
else if(s.kitchen.crumbs&&!reserved('kitchen')){job={kind:'kitchen',stage:'travel',remaining:3,elapsed:0,ownerId:s.kitchen.crumbsOwnerId||null,deskId:s.kitchen.crumbsDeskId||null};target=this.point('kitchen');status='Cleaning kitchen crumbs';}
else if(mess){job={kind:'desk',stage:'travel',remaining:3,elapsed:0,messId:mess.id,deskId:mess.deskId,ownerId:mess.ownerId,messKind:mess.kind};target=this.point('desk:'+mess.deskId);status='Cleaning '+mess.kind;}
else if(r.staffClock<=0&&!reserved('coordinate')&&!s.npcs.some(n=>n.officeAssignment)){const task=[...s.tasks].filter(t=>!t.managerSupported).sort((a,b)=>a.deadline-b.deadline)[0];if(!s.phoneQueue.waiting&&!task)return false;job={kind:'coordinate',stage:'travel',remaining:2,elapsed:0,taskId:task?.id||null,supportKind:s.phoneQueue.waiting?'queue':'support'};target=this.point(s.phoneQueue.waiting?'call':task.role);status='Coordinating staff';r.staffClock=35;}
if(!job)return false;m.job=job;m.activity=job.kind;m.status=status;m.remaining=job.remaining;
if(!this.managerDestination(m,target)){this.returnManagerHome(m);return false;}r.cursor=(s.managers.indexOf(m)+1)%3;return m;
}
returnManagerHome(m){
m.activity='returning';m.status='Returning to office';m.job={kind:'return',stage:'travel',target:m.home,elapsed:0,remaining:0};m.route=this.pathTo(m,m.home.x,m.home.y);m.cooldown=16+this.random()*15;
}
completeManagerJob(m){
const s=this.state,job=m.job;if(!job)return;
if(job.kind==='coffee'){
s.coffee.checkedAt=this.elapsed;
if((s.coffee.status==='stale'||s.stats.coffee<10)&&job.stage!=='brewing'){s.coffee.status='brewing';s.coffee.brewId++;job.stage='brewing';job.remaining=5;m.status='Brewing fresh coffee';this.addBanter(m.title+' '+m.name,'This coffee has been here long enough to request benefits. I am making a fresh pot.','manager');return;}
if(job.stage==='brewing'){this.brewFreshCoffee();s.stats.morale=clamp(s.stats.morale+4,0,100);this.log(m.title+' made a fresh pot of coffee. Management has delivered a tangible benefit.','good');}
}else if(job.kind==='desk'){
const mess=s.deskMesses.find(d=>d.id===job.messId);if(mess){s.deskMesses=s.deskMesses.filter(d=>d.id!==mess.id);s.officeRoutines.cleaned++;s.stats.morale=clamp(s.stats.morale+2,0,100);const desk=this.desks.find(d=>d.id===mess.deskId);if(desk?.ownerId===mess.ownerId)this.leaveDeskNote(mess.deskId,m.title+' '+m.name,mess.kind==='crumbs'?'I cleared the crumbs. Your keyboard has declined the remaining snacks. Please give the counter the same consideration.':'Trash handled. The bin is accepting new submissions all afternoon. Please send your next contribution there.');}
}else if(job.kind==='kitchen'){
if(s.kitchen.crumbs){s.kitchen.crumbs=false;delete s.kitchen.crumbsOwnerId;delete s.kitchen.crumbsDeskId;s.officeRoutines.cleaned++;s.stats.morale=clamp(s.stats.morale+3,0,100);if(s.event?.type==='crumbs')this.finishEvent(true);const owner=this.desks.find(d=>d.id===job.deskId&&d.ownerId===job.ownerId);if(owner){job.kind='deliver';job.stage='travel';job.remaining=1;job.text='The kitchen counter is clean again. Please let it enjoy a brief retirement before your next toast adventure.';m.activity='delivering';m.status='Leaving a desk note';if(this.managerDestination(m,this.point('desk:'+owner.id)))return;}else this.log(m.title+' cleaned the shared kitchen counter. Its next visitor has a fresh start.','good');}
}else if(job.kind==='deliver'){
const desk=this.desks.find(d=>d.id===job.deskId);if(desk?.ownerId===job.ownerId)this.leaveDeskNote(job.deskId,m.title+' '+m.name,job.text);
}else if(job.kind==='coordinate')this.assignOfficeSupport(m,s.phoneQueue.waiting?'queue':job.supportKind,job.taskId);
this.returnManagerHome(m);
}
interruptOfficeForFire(){
const s=this.state;if(!s.managers)this.ensureOfficeState();
for(const n of s.npcs){if(n.officeAssignment){n.officeAssignment=null;if(['queue','support'].includes(n.activity))n.activity=null;}if(n.officeOuting){n.officeOuting=null;if(n.activity==='phone-police')n.activity=s.gymBlocked?'gym':null;}}
for(const m of s.managers){m.job=null;m.activity='evacuating';m.status='Heading to assembly';const target=this.assemblyScatter();m.route=this.pathTo(m,target.x,target.y);}
if(s.coffee.status==='brewing')s.coffee.status=s.coffee.age>=100?'stale':'fresh';s.phoneQueue.ringing=false;
}
resumeOfficeAfterFire(){
for(const m of this.state.managers)this.returnManagerHome(m);const visitor=this.state.npcs.find(n=>n.id==='gym-visitor');if(visitor&&!visitor.hidden&&!visitor.leaving&&this.state.gymBlocked){const gym=this.station('gym'),home=this.nearestFree(gym.x,gym.y+45);visitor.route=this.pathTo(visitor,home.x,home.y);visitor.activity='gym';visitor.officeOuting=null;}this.state.phoneQueue.ringing=this.state.phoneQueue.waiting>0;this.state.officeRoutines.roundClock=8;
}
updateGymPhonePolice(dt){
const s=this.state,r=s.officeRoutines,n=s.npcs.find(n=>n.id==='gym-visitor');r.gymCallCooldown=Math.max(0,r.gymCallCooldown-dt);
if(!n||n.hidden||n.leaving||!s.gymBlocked){if(n)n.officeOuting=null;return;}
const outing=n.officeOuting;
if(!outing){if(s.phoneQueue.waiting&&r.gymCallCooldown<=0&&n.activity==='gym'){const call=this.point('call'),target=this.nearestFree(call.x+125,call.y+35),route=this.pathTo(n,target.x,target.y);if(route.length){n.route=route;n.activity='phone-police';n.officeOuting={stage:'out',target,remaining:5,elapsed:0};r.gymCallCooldown=85;}}return;}
outing.elapsed+=dt;
const goBack=()=>{const gym=this.station('gym'),target=this.nearestFree(gym.x,gym.y+45);n.route=this.pathTo(n,target.x,target.y);outing.stage='back';outing.target=target;};
if(outing.stage==='out'&&(!s.phoneQueue.waiting||outing.elapsed>30)){goBack();return;}
if(n.route.length)return;
if(outing.stage==='out'){
if(dist(n,outing.target)>45){goBack();return;}
outing.stage='lecture';this.addBanter(n.name,'Could one of you actual employees pick up the phone? Some of us are trying to work out.','queue');s.npcMessages=[{npcId:n.id,name:n.name,text:'Could one of you actual employees pick up the phone?',remaining:6},...s.npcMessages].slice(0,4);
}else if(outing.stage==='lecture'){outing.remaining-=dt;if(outing.remaining<=0||!s.phoneQueue.waiting)goBack();}
else{n.officeOuting=null;n.activity='gym';n.walk=false;}
}
updateOffice(dt){
const s=this.state;if(!s.officeRoutines)this.ensureOfficeState();const r=s.officeRoutines,q=s.phoneQueue,fire=s.event?.type==='fire';
for(const m of s.managers){this.follow(m,m.route,78,dt);if(fire)continue;m.cooldown=Math.max(0,num(m.cooldown)-dt);const job=m.job;if(!job)continue;job.elapsed+=dt;if(job.kind==='return'){if(!m.route.length){Object.assign(m,m.home);m.job=null;m.activity=null;m.status='Available in office';m.walk=false;}continue;}if(job.elapsed>85){if(s.coffee.status==='brewing'&&job.kind==='coffee')s.coffee.status='stale';this.returnManagerHome(m);continue;}if(m.route.length)continue;if(dist(m,job.target)>40){this.returnManagerHome(m);continue;}job.remaining-=dt;m.remaining=Math.max(0,job.remaining);if(job.remaining<=0)this.completeManagerJob(m);}
if(fire)return;
s.coffee.age+=dt;if(s.coffee.age>=100&&s.coffee.status==='fresh')s.coffee.status='stale';
if(s.coffee.status==='stale')s.stats.morale=clamp(s.stats.morale-dt*.012,0,100);
if(s.deskMesses.length)s.stats.morale=clamp(s.stats.morale-dt*.006*s.deskMesses.length,0,100);
r.roundClock-=dt;r.messClock-=dt;r.coffeeCheckClock-=dt;r.staffClock-=dt;
if(r.roundClock<=0){r.roundClock=7;for(let i=0;i<3;i++){const m=s.managers[(r.cursor+i)%3];if(!m.activity&&m.cooldown<=0&&this.startManagerRound(m.id))break;}}
if(r.messClock<=0){r.messClock=38+this.random()*22;const desk=this.pick(this.desks.filter(d=>d.ownerId));if(desk)this.createDeskMess(desk.id,this.random()<.6?'crumbs':'trash');}
q.arrivalClock-=dt;if(q.arrivalClock<=0){q.arrivalClock=24+this.random()*16;this.receiveCall();}
if(q.waiting){q.ringAge+=dt;q.complaintClock-=dt;q.autoAnswerClock-=dt;for(const call of q.calls)call.remaining-=dt;
const expired=q.calls.filter(call=>call.remaining<=0);if(expired.length){q.calls=q.calls.filter(call=>call.remaining>0);q.missed+=expired.length;q.waiting=q.calls.length;s.stats.satisfaction=clamp(s.stats.satisfaction-expired.length,0,100);this.log('A caller left the queue. Congierge could use another pair of hands.','warn');}
if(q.complaintClock<=0&&q.waiting){q.complaintClock=22+this.random()*10;const speaker=this.pick(s.npcs.filter(n=>n.role==='call'));this.addBanter(speaker.name,this.pick(['Could someone join the phone queue? My headset and I would like separate lunch breaks.','Can somebody get into the queue? I answered the last one, and the one before that.','There are callers waiting! Please log into the queue before the hold music files a complaint.','Who is available for the phone queue? I can hear everyone pretending not to hear it.']),'queue');}
if(q.autoAnswerClock<=0&&q.waiting){q.autoAnswerClock=16;this.assignOfficeSupport(null,'queue');}}
q.ringing=q.waiting>0;this.updateOfficeAssignments(dt);this.updateGymPhonePolice(dt);
}
restore(input){
const previous=this.state;
try{
const data=typeof input==='string'?JSON.parse(input):input;
if(![1,2,3].includes(data?.version)||!data.state)return false;
const layout=normalizeLayout(data.state.layout||DEFAULT_LAYOUT),oldVersion=!data.state.layout||data.state.layout.width===1000,savedEvent=data.state.event;
const restoreInput=savedEvent?{...data,state:{...data.state,event:null}}:data;
if(!this._restoreLegacy(restoreInput))return false;
const player={...this.state.player};
this.setLayout(layout);
this.state.player.id=clean(data.state.player.id,64)||'player';
const restoredPoint=oldVersion?this.point('desk:'+this.state.player.deskId):player;Object.assign(this.state.player,this.nearestFree(restoredPoint.x,restoredPoint.y));
this.state.banter=Array.isArray(data.state.banter)?data.state.banter.slice(0,40).filter(b=>b&&typeof b==='object').map(b=>({id:clean(b.id,64),speaker:clean(b.speaker,40),text:clean(b.text,240),time:num(b.time),kind:['banter','summon','event','reply','manager','queue'].includes(b.kind)?b.kind:'banter'})):[];
if(savedEvent&&EVENTS[savedEvent.type]){const definition=EVENTS[savedEvent.type];this.state.event={id:clean(savedEvent.id,64)||'restored-event',type:savedEvent.type,...definition,remaining:clamp(num(savedEvent.remaining,definition.duration),1,definition.duration),npcId:clean(savedEvent.npcId,64)};this.applyEventState(this.state.event);}
for(const key of ['coffee','deskMesses','deskNotes','phoneQueue','officeRoutines'])if(data.state[key]&&typeof data.state[key]==='object')this.state[key]=JSON.parse(JSON.stringify(data.state[key]));this.ensureOfficeState(true);if(this.state.coffee.status==='brewing')this.state.coffee.status=this.state.coffee.age>=100?'stale':'fresh';
this.nextBanterId=clamp(num(data.nextBanterId,100),1,9999999);this.summonClock=clamp(num(data.summonClock,25),5,90);this.banterClock=clamp(num(data.banterClock,12),1,25);return true;
}catch{this.state=previous;return false;}
}

}


