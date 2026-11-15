import assert from 'node:assert/strict';
import {GameModel} from './dist/model.js';
import {OfficeView} from './dist/renderer.js';
import {TouchControls,gestureGeometry} from './dist/touch-controls.js';

const originalObserver=globalThis.ResizeObserver;
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
let drawingCalls=0;
const context=()=>new Proxy({font:'12px sans-serif',measureText(text){const size=Number(this.font.match(/([\d.]+)px/)?.[1])||12;return{width:String(text).length*size*.55};},createLinearGradient(){return{addColorStop(){}};}},{get(target,key){if(key in target)return target[key];return(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),'Non-finite Canvas '+key);drawingCalls++;};}});
class Canvas{
  rect={left:13,top:19,width:390,height:650};listeners=new Map();captured=new Set();
  getContext(){return this.ctx??=context();}getBoundingClientRect(){return this.rect;}
  addEventListener(name,handler){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(handler);}
  removeEventListener(name,handler){this.listeners.get(name)?.delete(handler);}
  setPointerCapture(id){this.captured.add(id);}releasePointerCapture(id){this.captured.delete(id);}
  send(type,{id=1,x=120,y=130,...extra}={}){const event={pointerId:id,clientX:x,clientY:y,button:0,pointerType:'touch',preventDefault(){this.prevented=true;},...extra};for(const handler of this.listeners.get(type)||[])handler(event);return event;}
}
const fixture=()=>{const canvas=new Canvas(),model=new GameModel(19);model.start({name:'Touch QA',role:'small'});const view=new OfficeView(canvas,model);view.setCompact(true);const taps=[];let enabled=true;const touch=new TouchControls(canvas,view,{onTap:(x,y)=>taps.push({x,y}),enabled:()=>enabled});return{canvas,model,view,touch,taps,disable:()=>enabled=false};};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} differs from ${b}`);
let passed=0;
try{
  {
    const f=fixture();f.canvas.send('pointerdown');assert.equal(f.taps.length,0);f.canvas.send('pointermove',{x:123,y:132});f.canvas.send('pointerup',{x:123,y:132});assert.equal(f.taps.length,1);assert.equal(f.canvas.captured.size,0);assert.equal(f.view.cameraCenter,null);f.touch.destroy();passed++;
  }
  {
    const f=fixture(),before=f.view.ox;f.canvas.send('pointerdown');f.canvas.send('pointermove',{x:155,y:145});f.canvas.send('pointerup',{x:155,y:145});assert.equal(f.taps.length,0);assert.ok(f.view.ox>before);const center={...f.view.cameraCenter};f.model.state.player.x-=200;for(let i=0;i<8;i++)f.view.updateCamera();assert.deepEqual(f.view.cameraCenter,center,'Manual panning must not snap back to the player');f.touch.destroy();passed++;
  }
  {
    const f=fixture(),start=f.view.zoom,anchor=f.view.screenToWorld(185,180);f.canvas.send('pointerdown',{id:1,x:120,y:180});f.canvas.send('pointerdown',{id:2,x:250,y:180});f.canvas.send('pointermove',{id:1,x:100,y:180});f.canvas.send('pointermove',{id:2,x:270,y:180});const after=f.view.screenToWorld(185,180);near(anchor.x,after.x);near(anchor.y,after.y);assert.ok(f.view.zoom>start);f.canvas.send('pointerup',{id:1,x:100,y:180});f.canvas.send('pointermove',{id:2,x:280,y:185});f.canvas.send('pointerup',{id:2,x:280,y:185});assert.equal(f.taps.length,0,'Lifting the final pinch finger must not walk');assert.equal(f.canvas.captured.size,0);f.touch.destroy();passed++;
  }
  {
    const f=fixture();f.canvas.send('pointerdown');f.canvas.send('pointercancel');f.canvas.send('pointerup');assert.equal(f.taps.length,0);assert.equal(f.canvas.captured.size,0);f.canvas.send('pointerdown');f.disable();f.canvas.send('pointermove',{x:180});assert.equal(f.touch.pointers.size,0);f.touch.destroy();for(const handlers of f.canvas.listeners.values())assert.equal(handlers.size,0);passed++;
  }
  {
    const f=fixture();for(const [width,height]of [[390,650],[844,240],[1024,600]]){
      f.canvas.rect={left:13,top:19,width,height};f.view.resize();f.view.recenter();
      const x=13+width/2+16,y=19+height/2-12,anchor=f.view.screenToWorld(x,y);f.view.zoomAt(Math.min(5,f.view.zoom*1.15),x,y);const after=f.view.screenToWorld(x,y);near(anchor.x,after.x);near(anchor.y,after.y);
      for(const zoom of [1,2.8,6]){f.view.zoomAt(zoom);f.view.render(1);for(const r of f.view.labelRects){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width&&r.y+r.h<=height);const p=f.view.worldToScreen(800,700),w=f.view.screenToWorld(p.x,p.y);near(w.x,800);near(w.y,700);}for(let i=0;i<f.view.labelRects.length;i++)for(let j=i+1;j<f.view.labelRects.length;j++){const a=f.view.labelRects[i],b=f.view.labelRects[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'Compact labels overlap');}}
    }f.view.recenter({fit:true});assert.equal(f.view.zoom,1);f.view.setCompact(false);assert.equal(f.view.maxZoom,2.6);f.view.render(2);f.touch.destroy();passed++;
  }
  assert.deepEqual(gestureGeometry([{x:0,y:0},{x:6,y:8}]),{x:3,y:4,distance:10});
  console.log(`${passed} touch/camera checks passed (${drawingCalls} finite drawing calls).`);
}finally{globalThis.ResizeObserver=originalObserver;}
