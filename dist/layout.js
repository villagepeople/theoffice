// Pure floor-plan data and validation shared by the client and room server.
const ROLE_DATA=[
['small','Small benefits','#75a78a'],['large','Large benefits','#6e91aa'],
['retirement','Retirement','#c29a60'],['flex','Flex','#af8aa5'],['cobra','COBRA','#cd8875'],
['call','Concierge','#8c91b3'],['accounting','Accounting','#7da69c'],['helpdesk','MIS Helpdesk','#839ab3'],
['developers','MIS Developers','#a38bb4'],['operations','Operations','#b3a06f']
];
export const DEFAULT_LAYOUT={
version:2,width:1000,height:900,floorColor:'#f7f3e8',
stations:[...ROLE_DATA.map(([id,label,color],i)=>({id,label,color,x:100+(i%5)*200,y:i<5?300:560})),
{id:'coffee',label:'Coffee & calm',x:105,y:770,color:'#b9916e'},
{id:'gym',label:'Office gym',x:270,y:770,color:'#88a085'},
{id:'printer',label:'Print & support',x:430,y:770,color:'#8ba6a0'},
{id:'kitchen',label:'Kitchen',x:680,y:770,color:'#b5a17e'},
{id:'assembly',label:'Assembly point',x:900,y:780,color:'#8ba6a0'}],
executives:[
{id:'ceo',name:'Pat Sterling',title:'CEO',x:180,y:90,color:'#b99768'},
{id:'cfo',name:'Blair Ledger',title:'CFO',x:500,y:90,color:'#8199a7'},
{id:'coo',name:'Jordan Rush',title:'COO',x:820,y:90,color:'#9a89a6'}
],props:[{id:'plant-nw',type:'plant',x:60,y:230,rotation:0},{id:'plant-ne',type:'plant',x:940,y:230,rotation:0},{id:'plant-sw',type:'plant',x:40,y:700,rotation:0},{id:'plant-se',type:'plant',x:960,y:700,rotation:0}]
};
const clone=value=>JSON.parse(JSON.stringify(value));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const cleanText=(value,max=32)=>String(value??'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,max);
export function interactionPoint(station){return{x:station.interactX??station.x,y:station.interactY??(station.y+(String(station.id).startsWith('exec:')?100:65))};}
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
export function layoutStations(layout=DEFAULT_LAYOUT){
return[...layout.stations.map(s=>({...s,interactX:s.x,interactY:s.y+65})),
...layout.executives.map(e=>({id:'exec:'+e.id,label:e.title+' office',x:e.x,y:e.y,color:e.color,kind:'executive',executiveId:e.id,interactX:e.x,interactY:e.y+100}))];
}
export function layoutObstacles(layout=DEFAULT_LAYOUT){
const obstacles=[];
for(const s of layout.stations){
if(s.id==='kitchen'){obstacles.push({x:s.x-55,y:s.y-25,w:130,h:35},{x:s.x+83,y:s.y-30,w:29,h:37});}
else {const f=stationFootprint(s);obstacles.push({x:f.x,y:f.y,w:f.w,h:f.h});}
}
for(const e of layout.executives)obstacles.push(
{x:e.x-98,y:e.y-74,w:8,h:148},{x:e.x+90,y:e.y-74,w:8,h:148},
{x:e.x-98,y:e.y-74,w:196,h:8},{x:e.x-98,y:e.y+66,w:72,h:8},
{x:e.x+26,y:e.y+66,w:72,h:8},{x:e.x-50,y:e.y-20,w:100,h:50});
for(const p of layout.props){const f=propFootprint(p);obstacles.push({x:f.x,y:f.y,w:f.w,h:f.h});}
return obstacles;
}
export function layoutFurniture(layout=DEFAULT_LAYOUT){
return[...layoutStations(layout).map(stationFootprint),...layout.props.map(propFootprint)];
}
function overlap(a,b,pad=12){return a.x-pad<b.x+b.w&&a.x+a.w+pad>b.x&&a.y-pad<b.y+b.h&&a.y+a.h+pad>b.y;}
function free(x,y,layout,obstacles,r=13){
return x>=22&&x<=layout.width-22&&y>=25&&y<=layout.height-25&&!obstacles.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h);
}
function reachable(layout,obstacles){
const cols=50,rows=45,key=(x,y)=>y*cols+x;
const open=[],seen=new Set();
const spawn={x:505,y:730};
let start=null;
for(let radius=0;radius<=200&&!start;radius+=20)for(let angle=0;angle<16&&!start;angle++){
const x=Math.floor((spawn.x+Math.cos(angle*Math.PI/8)*radius)/20),y=Math.floor((spawn.y+Math.sin(angle*Math.PI/8)*radius)/20);
if(free(x*20+10,y*20+10,layout,obstacles))start={x,y};
}
if(!start)return['The floor needs a clear employee arrival area.'];
open.push(start);seen.add(key(start.x,start.y));
for(let i=0;i<open.length;i++){
const cur=open[i];
for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
const x=cur.x+dx,y=cur.y+dy,k=key(x,y);
if(x<1||x>=cols-1||y<1||y>=rows-1||seen.has(k)||!free(x*20+10,y*20+10,layout,obstacles))continue;
seen.add(k);open.push({x,y});
}
}
const errors=[];
for(const st of layoutStations(layout)){
const p=interactionPoint(st);
if(!free(p.x,p.y,layout,obstacles)) {errors.push(st.label+' needs clear space in front.');continue;}
let accessible=false;
for(let dx=-1;dx<=1&&!accessible;dx++)for(let dy=-1;dy<=1&&!accessible;dy++){
const x=Math.floor(p.x/20)+dx,y=Math.floor(p.y/20)+dy;
if(seen.has(key(x,y))&&Math.hypot(x*20+10-p.x,y*20+10-p.y)<35)accessible=true;
}
if(!accessible)errors.push('Employees cannot reach '+st.label+'. Leave a connected walkway.');
}
return errors;
}
export function validateLayout(input){
const errors=[];
if(!input||typeof input!=='object'||Array.isArray(input))return{valid:false,errors:['Choose a valid floor plan.']};
if(input.width!==1000||input.height!==900)errors.push('Use a floor plan exported by this game.');
if(!/^#[0-9a-f]{6}$/i.test(input.floorColor||''))errors.push('Choose a valid floor color.');
if(!Array.isArray(input.stations)||input.stations.length!==15)errors.push('Keep all ten departments and five shared areas.');
if(!Array.isArray(input.executives)||input.executives.length!==3)errors.push('Keep the CEO, CFO, and COO offices.');
if(!Array.isArray(input.props)||input.props.length>40)errors.push('A floor can have up to forty decorations.');
if(errors.length)return{valid:false,errors};
const ids=input.stations.map(s=>s?.id),execIds=input.executives.map(e=>e?.id);
if(new Set(ids).size!==15||DEFAULT_LAYOUT.stations.some(s=>!ids.includes(s.id)))errors.push('Department and facility IDs must be complete and unique.');
if(new Set(execIds).size!==3||DEFAULT_LAYOUT.executives.some(e=>!execIds.includes(e.id)))errors.push('Executive offices must have unique valid IDs.');
for(const item of [...input.stations,...input.executives,...input.props]){
if(!item||typeof item!=='object'||!finite(item.x)||!finite(item.y))errors.push('Every item needs a finite position.');
}
const propIds=new Set();
for(const p of input.props){
if(!p||!['plant','sofa','cabinet','divider'].includes(p.type)||![0,1].includes(p.rotation)||typeof p.id!=='string'||!/^[-a-zA-Z0-9_]{1,60}$/.test(p.id)||propIds.has(p.id))errors.push('A decoration has an invalid type, rotation, or ID.');
propIds.add(p?.id);
}
if(errors.length)return{valid:false,errors:[...new Set(errors)]};
const furniture=layoutFurniture(input),names=new Map(layoutStations(input).map(s=>[s.id,s.label]));
for(const p of input.props)names.set(p.id,p.type);
for(const f of furniture)if(f.x<12||f.y<12||f.x+f.w>input.width-12||f.y+f.h>input.height-25)errors.push('Keep the '+(names.get(f.id)||'furniture')+' inside the floor.');
for(let i=0;i<furniture.length;i++)for(let j=i+1;j<furniture.length;j++)if(overlap(furniture[i],furniture[j]))errors.push('Leave more space between '+(names.get(furniture[i].id)||'these items')+' and '+(names.get(furniture[j].id)||'the furniture')+'.');
if(errors.length)return{valid:false,errors:[...new Set(errors)].slice(0,8)};
errors.push(...reachable(input,layoutObstacles(input)));
return{valid:errors.length===0,errors:[...new Set(errors)].slice(0,8)};
}
export function normalizeLayout(input=DEFAULT_LAYOUT){
const validation=validateLayout(input);
if(!validation.valid)throw new Error(validation.errors[0]);
return{
version:2,width:1000,height:900,floorColor:input.floorColor.toLowerCase(),
stations:DEFAULT_LAYOUT.stations.map(base=>{const s=input.stations.find(x=>x.id===base.id);return{...base,x:s.x,y:s.y};}),
executives:DEFAULT_LAYOUT.executives.map(base=>{const e=input.executives.find(x=>x.id===base.id);return{...base,name:cleanText(e.name,28)||base.name,x:e.x,y:e.y};}),
props:input.props.map(p=>({id:cleanText(p.id,60),type:p.type,x:p.x,y:p.y,rotation:p.rotation}))
};
}
export function cloneLayout(layout=DEFAULT_LAYOUT){return clone(layout);}
