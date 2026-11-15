import assert from 'node:assert/strict';
import {OfficeNetwork} from './dist/network.js';
import {GameModel} from './dist/model.js';
const originalFetch=globalThis.fetch,originalStorage=globalThis.sessionStorage;
const values=new Map();globalThis.sessionStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
const fresh=()=>{const model=new GameModel();model.start({name:'Client QA',role:'small'});const n=new OfficeNetwork(model);n.schedule=()=>{};n.session={code:'ABCDEFGH',playerId:'client-qa',token:'test-session-token'};n.active=true;return n;};
const snapshot=n=>({state:structuredClone(n.model.state),room:{code:'ABCDEFGH',playerId:'client-qa',hostId:'client-qa',players:[{id:'client-qa',name:'Client QA',role:'small'}],chat:[]}});
let passed=0;
try{
  for(const status of [401,404]){
    const n=fresh();n.persist();globalThis.fetch=async()=>Response.json({error:status===404?'This office has closed. Create a fresh room.':'Your office session could not be verified.'},{status});
    await assert.rejects(n.sync(),e=>e.status===status);assert.equal(n.active,false);assert.equal(n.savedSession(),null);passed++;
  }
  {
    const n=fresh();const first=n.enqueue('chat',{text:'One'},true),second=n.enqueue('chat',{text:'Two'},true);
    globalThis.fetch=async()=>Response.json({error:'Try again shortly.'},{status:503});
    await assert.rejects(n.sync());assert.equal(n.active,true);assert.equal(n.pending.length,2);
    globalThis.fetch=async(_url,init)=>{const body=JSON.parse(init.body);assert.deepEqual(body.commands.map(c=>c.seq),[1,2]);return Response.json({snapshot:snapshot(n),ack:2,results:[{seq:1,kind:'chat',message:'One delivered'},{seq:2,kind:'chat',message:'Two delivered'}]});};
    await n.sync();const result=await Promise.all([first,second]);assert.equal(result[1].message,'Two delivered');assert.equal(n.pending.length,0);n.stop();passed++;
  }
  {
    const n=fresh();n.sequence=99;n.persist();n.active=false;
    globalThis.fetch=async()=>Response.json({snapshot:snapshot(n),ack:7,results:[]});
    assert.equal(await n.reconnect(),true);assert.equal(n.sequence,7);
    const pending=n.enqueue('chat',{text:'Reconnected'},true);
    globalThis.fetch=async(_url,init)=>{const body=JSON.parse(init.body);assert.equal(body.commands[0].seq,8);return Response.json({snapshot:snapshot(n),ack:8,results:[{seq:8,kind:'chat',message:'Recovered'}]});};
    await n.sync();assert.equal((await pending).message,'Recovered');n.stop();passed++;
  }
  console.log(passed+' client recovery checks passed; 0 failed.');
}finally{globalThis.fetch=originalFetch;if(originalStorage===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=originalStorage;}
