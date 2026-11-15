import assert from 'node:assert/strict';
import {OfficeAudio} from './dist/audio.js';
const fixtures=()=>{
  const spoken=[],nodes=[],saved=new Map();let cancelled=0;
  class Param{value=0;setValueAtTime(v,t){assert.ok(Number.isFinite(v)&&Number.isFinite(t));this.value=v;}setTargetAtTime(v,t,k){assert.ok(Number.isFinite(v)&&Number.isFinite(t)&&k>0);this.value=v;}linearRampToValueAtTime(v,t){this.setValueAtTime(v,t);}exponentialRampToValueAtTime(v,t){assert.ok(v>0);this.setValueAtTime(v,t);}}
  class Node{constructor(){for(const p of ['frequency','gain','pan','playbackRate','Q'])this[p]=new Param();nodes.push(this);}connect(){}start(t=0){assert.ok(t>=0&&Number.isFinite(t));this.started=true;}stop(){this.stopped=true;this.onended?.();}}
  class Context{currentTime=0;sampleRate=100;destination={};state='suspended';createGain(){return new Node();}createOscillator(){return new Node();}createBufferSource(){return new Node();}createBiquadFilter(){return new Node();}createStereoPanner(){return new Node();}createBuffer(_n,size){return{getChannelData:()=>new Float32Array(size)};}async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}}
  const host={document:{hidden:false},AudioContext:Context,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:{getVoices:()=>[{voiceURI:'one',lang:'en-US',name:'One'},{voiceURI:'two',lang:'en-GB',name:'Two'}],addEventListener(){},removeEventListener(){},speak:u=>spoken.push(u),cancel:()=>cancelled++}};
  const audio=new OfficeAudio({host,storage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},random:()=>.4});
  const state={phase:'playing',player:{x:800,y:1000,walk:false},npcs:[],managers:[],banter:[],phoneQueue:{waiting:0,ringing:false},layout:{departments:[]}};
  return{audio,state,host,spoken,nodes,saved,get cancelled(){return cancelled;}};
};
let passed=0;
{
  const f=fixtures();assert.equal(f.audio.prefs.enabled,true);f.audio.update(f.state,.05);assert.equal(f.audio.context,null);assert.equal(f.spoken.length,0);f.audio.unlock();f.audio.update(f.state,.05);assert.equal(f.audio.context.state,'running');assert.ok(f.nodes.some(n=>n.started));f.audio.destroy();passed++;
}
{
  const f=fixtures();f.audio.unlock();f.audio.update(f.state,.05);f.state.banter=[{id:'q1',kind:'queue',speaker:'Kit',text:'Can somebody help answer the phones?'}];f.audio.update(f.state,.05);assert.equal(f.spoken.length,1);f.audio.update(structuredClone(f.state),.05);assert.equal(f.spoken.length,1,'Snapshots must not replay voices');
  f.state.banter.unshift({id:'s1',kind:'summon',speaker:'CFO',text:'Alex, could you come to my office?'});f.audio.update(f.state,.05);assert.equal(f.spoken.length,2);assert.equal(f.cancelled,1,'Management can interrupt a lower priority complaint');assert.match(f.spoken[1].text,/Alex/);f.audio.destroy();passed++;
}
{
  const f=fixtures();f.audio.unlock();f.audio.update(f.state,.05);f.audio.set('enabled',false);f.state.banter=[{id:'muted1',kind:'queue',text:'Do not replay this later.'}];f.audio.update(f.state,.05);f.audio.set('enabled',true);f.audio.update(f.state,.05);assert.equal(f.spoken.length,0);f.state.banter.unshift({id:'new1',kind:'queue',text:'A new call!'});f.audio.update(f.state,.05);assert.equal(f.spoken.length,1);f.host.document.hidden=true;f.audio.update(f.state,.05);assert.equal(f.audio.context.state,'suspended');assert.equal(f.audio.utterance,null);assert.equal(f.audio.nodes.size,0);f.audio.destroy();passed++;
}
{
  const f=fixtures();f.audio.unlock();f.audio.update(f.state,.05);let rings=0;f.audio.ring=()=>rings++;f.state.phoneQueue={waiting:2,ringing:true,ringId:'r1'};f.audio.update(f.state,.05);for(let i=0;i<30;i++)f.audio.update(structuredClone(f.state),.05);assert.equal(rings,1,'Rings must not be scheduled on every snapshot');
  f.audio.set('voices',0);assert.equal(f.audio.say('Silent please.',{priority:2}),false);f.audio.set('master',0);assert.equal(f.audio.utterance,null);assert.equal(f.audio.say('Still muted',{priority:3}),false);f.audio.set('master',.25);assert.equal(JSON.parse(f.saved.get('benefits-office-audio-v1')).master,.25);f.audio.destroy();passed++;
}
{
  const f=fixtures();f.state.phase='lobby';f.audio.update(f.state,.05);f.audio.preview();f.audio.update(f.state,.05);assert.equal(f.audio.active,true);assert.equal(f.spoken.length,1);f.audio.update(f.state,.05,{quiet:true});assert.equal(f.audio.active,false);f.audio.destroy();
  const a=new OfficeAudio({host:{document:{}},storage:{getItem(){throw Error('Storage blocked');}},random:()=>.5});a.unlock();a.update({phase:'playing',banter:[],player:{}},.05);assert.equal(a.say('Caption fallback'),false);a.destroy();passed++;
}
console.log(`${passed} audio checks passed (activation, voices, mute, scheduling, and fallbacks).`);
