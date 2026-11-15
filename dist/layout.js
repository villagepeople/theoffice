// Pure floor-plan data and validation shared by the client and room server.
const ROLE_DATA=[
['small','Small benefits','#75a78a'],['large','Large benefits','#6e91aa'],
['retirement','Retirement','#c29a60'],['flex','Flex','#af8aa5'],['cobra','COBRA','#cd8875'],
['call','Congierge','#8c91b3'],['accounting','Accounting','#7da69c'],['helpdesk','MIS Helpdesk','#839ab3'],
['developers','MIS Developers','#a38bb4'],['operations','Operations','#b3a06f']
];
export const EMPLOYEE_NAMES=['Maya','Theo','Jules','Priya','Robin','Ezra','Noor','Frankie','Morgan','Bea','Kit','Drew','Alex','Sasha','Remy','Lee','Casey','Sam','Ari','Charlie'];
const clone=value=>JSON.parse(JSON.stringify(value));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const cleanText=(value,max=32)=>String(value??'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,max);
function defaultDesks(stations){return[
...EMPLOYEE_NAMES.map((name,i)=>{const role=ROLE_DATA[Math.floor(i/2)],station=stations.find(s=>s.id===role[0]);return{id:'desk-npc-'+i,ownerId:'npc-'+i,role:role[0],kind:'employee',label:name+'’s desk',color:role[2],x:station.x+(i%2?78:-78),y:station.y+120,rotation:0};}),
...[600,760,920,1080].map((x,i)=>({id:'desk-player-'+i,ownerId:null,role:null,kind:'player',label:'Open desk '+(i+1),color:'#77968b',x,y:970,rotation:0}))
];}
export const DEFAULT_LAYOUT={
version:3,width:1600,height:1200,floorColor:'#f7f3e8',
stations:[...ROLE_DATA.map(([id,label,color],i)=>({id,label,color,x:160+(i%5)*320,y:i<5?340:700})),
{id:'coffee',label:'Coffee & calm',x:140,y:1080,color:'#b9916e'},
{id:'gym',label:'Office gym',x:380,y:1080,color:'#88a085'},
{id:'printer',label:'Print & support',x:600,y:1080,color:'#8ba6a0'},
{id:'kitchen',label:'Kitchen',x:1120,y:1080,color:'#b5a17e'},
{id:'assembly',label:'Assembly point',x:1460,y:1090,color:'#8ba6a0'}],
executives:[
{id:'ceo',name:'Pat Sterling',title:'CEO',x:280,y:110,color:'#b99768'},
{id:'cfo',name:'Blair Ledger',title:'CFO',x:800,y:110,color:'#8199a7'},
{id:'coo',name:'Jordan Rush',title:'COO',x:1320,y:110,color:'#9a89a6'}
],props:[{id:'plant-nw',type:'plant',x:60,y:250,rotation:0},{id:'plant-ne',type:'plant',x:1540,y:250,rotation:0},{id:'plant-sw',type:'plant',x:40,y:980,rotation:0},{id:'plant-se',type:'plant',x:1560,y:980,rotation:0}],desks:[]
};
DEFAULT_LAYOUT.desks=defaultDesks(DEFAULT_LAYOUT.stations);
export function interactionPoint(station){return{x:station.interactX??station.x,y:station.interactY??(station.y+(String(station.id).startsWith('exec:')?100:65))};}
export function deskFootprint(desk){const [w,h]=desk.rotation===1?[52,88]:[88,52];return{x:desk.x-w/2,y:desk.y-h/2,w,h,id:desk.id,type:'desk'};}
export function deskStandingPoint(desk){return desk.rotation===1?{x:desk.x+55,y:desk.y}:{x:desk.x,y:desk.y+55};}
export function layoutDesks(layout=DEFAULT_LAYOUT){return(layout.desks||[]).map(d=>({...d,interactX:deskStandingPoint(d).x,interactY:deskStandingPoint(d).y}));}
export function propFootprint(prop){
let [w,h]=({plant:[24,24],sofa:[90,40],cabinet:[48,28],divider:[120,12]})[prop.type]||[0,0];
if(prop.rotation===1)[w,h]=[h,w];
return{x:prop.x-w/2,y:prop.y-h/2,w,h,id:prop.id,type:prop.type};
}
export function stationFootprint(s){
if(String(s.id).startsWith('exec:'))return{x:s.x-98,y:s.y-74,w:196,h:148,id:s.id,type:'executive'};
const offsets={coffee:[-61,-28,122,48],gym:[-55,-23,110,55],printer:[-31,-25,62,46],kitchen:[-58,-30,170,71],assembly:[-8,-9,16,16]};
const [dx,dy,w,h]=offsets[s.id]||[-60,-35,120,70];
return{x:s.x+dx,y:s.y+dy,w,h,id:s.id,type:'station'};
}
export function layoutStations(layout=DEFAULT_LAYOUT){return[...layout.stations.map(s=>({...s,interactX:s.x,interactY:s.y+65})),...layout.executives.map(e=>({id:'exec:'+e.id,label:e.title+' office',x:e.x,y:e.y,color:e.color,kind:'executive',executiveId:e.id,interactX:e.x,interactY:e.y+100}))];}
export function layoutObstacles(layout=DEFAULT_LAYOUT){
const obstacles=[];
for(const s of layout.stations){if(s.id==='kitchen')obstacles.push({x:s.x-55,y:s.y-25,w:130,h:35},{x:s.x+83,y:s.y-30,w:29,h:37});else{const f=stationFootprint(s);obstacles.push({x:f.x,y:f.y,w:f.w,h:f.h});}}
for(const e of layout.executives)obstacles.push({x:e.x-98,y:e.y-74,w:8,h:148},{x:e.x+90,y:e.y-74,w:8,h:148},{x:e.x-98,y:e.y-74,w:196,h:8},{x:e.x-98,y:e.y+66,w:72,h:8},{x:e.x+26,y:e.y+66,w:72,h:8},{x:e.x-50,y:e.y-20,w:100,h:50});
for(const p of layout.props){const f=propFootprint(p);obstacles.push({x:f.x,y:f.y,w:f.w,h:f.h});}for(const d of layout.desks||[]){const f=deskFootprint(d);obstacles.push({x:f.x,y:f.y,w:f.w,h:f.h});}
return obstacles;
}
export function layoutFurniture(layout=DEFAULT_LAYOUT){return[...layoutStations(layout).map(stationFootprint),...layout.props.map(propFootprint),...(layout.desks||[]).map(deskFootprint)];}
function overlap(a,b,pad=12){return a.x-pad<b.x+b.w&&a.x+a.w+pad>b.x&&a.y-pad<b.y+b.h&&a.y+a.h+pad>b.y;}
function free(x,y,layout,obstacles,r=13){return x>=22&&x<=layout.width-22&&y>=25&&y<=layout.height-25&&!obstacles.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h);}
function reachable(layout,obstacles){
const cols=Math.ceil(layout.width/20),rows=Math.ceil(layout.height/20),key=(x,y)=>y*cols+x;
const open=[],seen=new Set(),spawn=layout.width===1000?{x:505,y:730}:{x:800,y:1040};let start=null;
for(let radius=0;radius<=200&&!start;radius+=20)for(let angle=0;angle<16&&!start;angle++){const x=Math.floor((spawn.x+Math.cos(angle*Math.PI/8)*radius)/20),y=Math.floor((spawn.y+Math.sin(angle*Math.PI/8)*radius)/20);if(free(x*20+10,y*20+10,layout,obstacles))start={x,y};}
if(!start)return['The floor needs a clear employee arrival area.'];
open.push(start);seen.add(key(start.x,start.y));
for(let i=0;i<open.length;i++){const cur=open[i];for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=cur.x+dx,y=cur.y+dy,k=key(x,y);if(x<1||x>=cols-1||y<1||y>=rows-1||seen.has(k)||!free(x*20+10,y*20+10,layout,obstacles))continue;seen.add(k);open.push({x,y});}}
const errors=[],targets=[...layoutStations(layout).map(s=>({label:s.label,point:interactionPoint(s)})),...(layout.desks||[]).map(d=>({label:d.label,point:deskStandingPoint(d)}))];
for(const target of targets){const p=target.point;if(!free(p.x,p.y,layout,obstacles)){errors.push(target.label+' needs clear standing space in front.');continue;}let accessible=false;for(let dx=-1;dx<=1&&!accessible;dx++)for(let dy=-1;dy<=1&&!accessible;dy++){const x=Math.floor(p.x/20)+dx,y=Math.floor(p.y/20)+dy;if(seen.has(key(x,y))&&Math.hypot(x*20+10-p.x,y*20+10-p.y)<35)accessible=true;}if(!accessible)errors.push('Employees cannot reach '+target.label+'. Leave a connected walkway.');}
return errors;
}
function validateCurrent(input,legacy=false){
const errors=[];
if(!input||typeof input!=='object'||Array.isArray(input))return{valid:false,errors:['Choose a valid floor plan.']};
if(input.width!==(legacy?1000:1600)||input.height!==(legacy?900:1200))errors.push('Use a floor plan exported by this game.');
if(!/^#[0-9a-f]{6}$/i.test(input.floorColor||''))errors.push('Choose a valid floor color.');
if(!Array.isArray(input.stations)||input.stations.length!==15)errors.push('Keep all ten departments and five shared areas.');
if(!Array.isArray(input.executives)||input.executives.length!==3)errors.push('Keep the CEO, CFO, and COO offices.');
if(!Array.isArray(input.props)||input.props.length>40)errors.push('A floor can have up to forty decorations.');
if(!legacy&&(!Array.isArray(input.desks)||input.desks.length!==24))errors.push('Keep all twenty employee desks and four player desks.');
if(errors.length)return{valid:false,errors};
const ids=input.stations.map(s=>s?.id),execIds=input.executives.map(e=>e?.id);
if(new Set(ids).size!==15||DEFAULT_LAYOUT.stations.some(s=>!ids.includes(s.id)))errors.push('Department and facility IDs must be complete and unique.');
if(new Set(execIds).size!==3||DEFAULT_LAYOUT.executives.some(e=>!execIds.includes(e.id)))errors.push('Executive offices must have unique valid IDs.');
for(const item of [...input.stations,...input.executives,...input.props,...(legacy?[]:input.desks)])if(!item||typeof item!=='object'||!finite(item.x)||!finite(item.y))errors.push('Every item needs a finite position.');
const propIds=new Set();for(const p of input.props){if(!p||!['plant','sofa','cabinet','divider'].includes(p.type)||![0,1].includes(p.rotation)||typeof p.id!=='string'||!/^[-a-zA-Z0-9_]{1,60}$/.test(p.id)||propIds.has(p.id)||DEFAULT_LAYOUT.desks.some(d=>d.id===p.id))errors.push('A decoration has an invalid type, rotation, or ID.');propIds.add(p?.id);}
if(!legacy){const deskIds=new Set();for(const d of input.desks){if(!d||!DEFAULT_LAYOUT.desks.some(base=>base.id===d.id)||deskIds.has(d.id)||![0,1].includes(d.rotation))errors.push('Every employee needs one unique valid desk.');deskIds.add(d?.id);}}
if(errors.length)return{valid:false,errors:[...new Set(errors)]};
const furniture=layoutFurniture(input),names=new Map(layoutStations(input).map(s=>[s.id,s.label]));for(const p of input.props)names.set(p.id,p.type);for(const d of input.desks||[])names.set(d.id,d.label||'personal desk');
for(const f of furniture)if(f.x<12||f.y<12||f.x+f.w>input.width-12||f.y+f.h>input.height-25)errors.push('Keep the '+(names.get(f.id)||'furniture')+' inside the floor.');
for(let i=0;i<furniture.length;i++)for(let j=i+1;j<furniture.length;j++)if(overlap(furniture[i],furniture[j]))errors.push('Leave more space between '+(names.get(furniture[i].id)||'these items')+' and '+(names.get(furniture[j].id)||'the furniture')+'.');
if(errors.length)return{valid:false,errors:[...new Set(errors)].slice(0,8)};
errors.push(...reachable(input,layoutObstacles(input)));return{valid:errors.length===0,errors:[...new Set(errors)].slice(0,8)};
}
function upgradeLegacy(input){
const legacy=validateCurrent({...input,desks:[]},true);if(!legacy.valid)throw new Error(legacy.errors[0]);
const oldStations=[...ROLE_DATA.map((r,i)=>({id:r[0],x:100+(i%5)*200,y:i<5?300:560})),{id:'coffee',x:105,y:770},{id:'gym',x:270,y:770},{id:'printer',x:430,y:770},{id:'kitchen',x:680,y:770},{id:'assembly',x:900,y:780}],oldExecutives=[{id:'ceo',x:180,y:90},{id:'cfo',x:500,y:90},{id:'coo',x:820,y:90}],oldProps=[{id:'plant-nw',x:60,y:230},{id:'plant-ne',x:940,y:230},{id:'plant-sw',x:40,y:700},{id:'plant-se',x:960,y:700}];
const plan=clone(DEFAULT_LAYOUT);plan.floorColor=input.floorColor;
const move=(item,old,base)=>({...base,x:Math.round(base.x+(item.x-old.x)*1.6),y:Math.round(base.y+(item.y-old.y)*4/3)});
plan.stations=plan.stations.map(base=>move(input.stations.find(s=>s.id===base.id),oldStations.find(s=>s.id===base.id),base));
plan.executives=plan.executives.map(base=>{const e=input.executives.find(e=>e.id===base.id);return{...move(e,oldExecutives.find(s=>s.id===base.id),base),name:cleanText(e.name,28)||base.name};});
plan.props=input.props.map(p=>{const old=oldProps.find(b=>b.id===p.id),base=DEFAULT_LAYOUT.props.find(b=>b.id===p.id);return old&&base?{...p,...move(p,old,base)}:{...p,x:Math.round(p.x*1.6),y:Math.round(p.y*4/3)};});
plan.desks=defaultDesks(plan.stations);
if(!validateCurrent(plan).valid){const fallback=clone(DEFAULT_LAYOUT);fallback.floorColor=input.floorColor;fallback.migrationNotice='Your older floor was expanded to give everyone a clear personal desk. The original floor export can still be kept separately.';return fallback;}
plan.migrationNotice='Your floor was expanded with twenty employee desks and four player desks.';return plan;
}
export function validateLayout(input){try{return validateCurrent(input?.width===1000&&input?.height===900?upgradeLegacy(input):input);}catch(error){return{valid:false,errors:[error.message||'Choose a valid floor plan.']};}}
export function normalizeLayout(input=DEFAULT_LAYOUT){
const plan=input?.width===1000&&input?.height===900?upgradeLegacy(input):input,validation=validateCurrent(plan);if(!validation.valid)throw new Error(validation.errors[0]);
return{version:3,width:1600,height:1200,floorColor:plan.floorColor.toLowerCase(),
stations:DEFAULT_LAYOUT.stations.map(base=>{const s=plan.stations.find(x=>x.id===base.id);return{...base,x:s.x,y:s.y};}),
executives:DEFAULT_LAYOUT.executives.map(base=>{const e=plan.executives.find(x=>x.id===base.id);return{...base,name:cleanText(e.name,28)||base.name,x:e.x,y:e.y};}),
props:plan.props.map(p=>({id:cleanText(p.id,60),type:p.type,x:p.x,y:p.y,rotation:p.rotation})),
desks:DEFAULT_LAYOUT.desks.map(base=>{const d=plan.desks.find(x=>x.id===base.id);return{...base,x:d.x,y:d.y,rotation:d.rotation};}),
...(plan.migrationNotice?{migrationNotice:cleanText(plan.migrationNotice,200)}:{})};
}
export function cloneLayout(layout=DEFAULT_LAYOUT){return clone(layout);}
