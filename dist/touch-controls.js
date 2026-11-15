const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;

export function gestureGeometry(points){
  const [a,b]=Array.from(points.values?points.values():points);
  if(!a)return null;
  if(!b)return{x:a.x,y:a.y,distance:0};
  return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(b.x-a.x,b.y-a.y)};
}

// A tap walks only after release. A drag or a pinch never issues a walk command.
export class TouchControls {
  constructor(canvas,view,{onTap=()=>{},enabled=()=>true,onChange=()=>{}}={}){
    this.canvas=canvas;this.view=view;this.onTap=onTap;this.enabled=enabled;this.onChange=onChange;
    this.pointers=new Map();this.multi=false;this.dragging=false;this.gesture=null;
    this.handlers={pointerdown:e=>this.down(e),pointermove:e=>this.move(e),pointerup:e=>this.up(e),pointercancel:()=>this.cancel(),lostpointercapture:e=>{if(this.pointers.has(e.pointerId))this.cancel();}};
    for(const [name,handler]of Object.entries(this.handlers))canvas.addEventListener(name,handler,{passive:false});
    this.resetHandler=()=>this.cancel();
    for(const name of ['resize','orientationchange','blur'])globalThis.window?.addEventListener(name,this.resetHandler);
  }
  down(event){
    if(!this.enabled()||event.button>0)return;
    event.preventDefault?.();
    const point={x:finite(event.clientX),y:finite(event.clientY),startX:finite(event.clientX),startY:finite(event.clientY)};
    this.pointers.set(event.pointerId,point);
    try{this.canvas.setPointerCapture(event.pointerId);}catch{}
    if(this.pointers.size>1){this.multi=true;this.dragging=true;this.gesture=gestureGeometry(this.pointers);}
  }
  move(event){
    const point=this.pointers.get(event.pointerId);if(!point)return;
    if(!this.enabled()){this.cancel();return;}
    event.preventDefault?.();
    const x=finite(event.clientX,point.x),y=finite(event.clientY,point.y),dx=x-point.x,dy=y-point.y;
    point.x=x;point.y=y;
    if(this.pointers.size>1){
      const next=gestureGeometry(this.pointers),old=this.gesture;
      if(old&&next){this.view.panBy(next.x-old.x,next.y-old.y);if(old.distance>2&&next.distance>2)this.view.zoomAt(this.view.zoom*next.distance/old.distance,next.x,next.y);this.onChange({zoom:this.view.zoom});}
      this.gesture=next;return;
    }
    if(!this.dragging&&Math.hypot(x-point.startX,y-point.startY)>7)this.dragging=true;
    if(this.dragging){this.view.panBy(dx,dy);this.onChange({zoom:this.view.zoom});}
  }
  up(event){
    const point=this.pointers.get(event.pointerId);if(!point)return;
    event.preventDefault?.();
    const x=finite(event.clientX,point.x),y=finite(event.clientY,point.y);
    const tap=this.enabled()&&this.pointers.size===1&&!this.multi&&!this.dragging&&Math.hypot(x-point.startX,y-point.startY)<=7;
    this.pointers.delete(event.pointerId);
    try{this.canvas.releasePointerCapture(event.pointerId);}catch{}
    this.gesture=this.pointers.size>1?gestureGeometry(this.pointers):null;
    if(!this.pointers.size){this.multi=false;this.dragging=false;}
    if(tap)this.onTap(x,y);
  }
  cancel(){
    const ids=[...this.pointers.keys()];this.pointers.clear();this.multi=false;this.dragging=false;this.gesture=null;
    for(const id of ids){try{this.canvas.releasePointerCapture(id);}catch{}}
  }
  destroy(){this.cancel();for(const [name,handler]of Object.entries(this.handlers))this.canvas.removeEventListener(name,handler);for(const name of ['resize','orientationchange','blur'])globalThis.window?.removeEventListener(name,this.resetHandler);}
}
