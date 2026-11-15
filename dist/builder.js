import {DEFAULT_LAYOUT} from './layout.js';
const clone=value=>JSON.parse(JSON.stringify(value));
const snap=v=>Math.round(v/20)*20;
const STORE='benefits-floor-v2';

export class FloorBuilder {
  constructor(model,view,{toast=()=>{},onDone=()=>{},onOpen=()=>{},onToolChange=()=>{}}={}){
    this.model=model;this.view=view;this.toast=toast;this.onDone=onDone;this.onOpen=onOpen;this.onToolChange=onToolChange;this.active=false;this.tool='move';this.undo=[];this.editPointers=new Set();this.multiTouch=false;
    this.panel=document.createElement('section');this.panel.id='builder-panel';this.panel.className='hidden';
    this.panel.innerHTML='<div class="panel-heading"><span class="step-label">FLOOR STUDIO</span><span class="small-badge">TOUCH + MOUSE</span></div><h2>A little room<br>for <em>improvement.</em></h2><p class="intro-copy">A larger office, with a desk for everyone. Move departments, employee desks, and executive offices. Keep the walkways clear.</p><label class="field-label" for="builder-selection">SELECT A SPACE</label><select id="builder-selection"></select><p id="builder-selected" class="field-hint">Select a person’s desk or a department, then drag it on the floor.</p><fieldset><legend>FURNITURE & FINISHES</legend><div id="builder-tools" class="builder-tools"><button data-tool="pan">✥ Pan &amp; zoom</button><button data-tool="move" class="selected">↖ Move pieces</button><button data-tool="plant">♧ Plant</button><button data-tool="sofa">▱ Sofa</button><button data-tool="cabinet">▤ Cabinet</button><button data-tool="divider">▥ Divider</button></div></fieldset><p class="field-hint builder-gesture-hint">Choose Pan &amp; zoom to drag the view or pinch. Choose Move pieces to drag furniture. The arrows below move the selected piece one grid step.</p><fieldset class="builder-nudge"><legend>MOVE SELECTED · ONE GRID STEP</legend><div class="builder-nudge-controls"><button data-nudge="0,-1" aria-label="Move selected up">↑</button><button data-nudge="-1,0" aria-label="Move selected left">←</button><button data-nudge="0,1" aria-label="Move selected down">↓</button><button data-nudge="1,0" aria-label="Move selected right">→</button></div></fieldset><div class="builder-edit-row"><button id="builder-rotate" class="secondary-button">Rotate selected</button><button id="builder-remove" class="secondary-button">Remove piece</button></div><fieldset><legend>FLOOR FINISH</legend><div class="floor-swatches"><button data-floor="#f7f3e8" style="background:#f7f3e8" aria-label="Warm ivory floor"></button><button data-floor="#e5eadf" style="background:#e5eadf" aria-label="Soft sage floor"></button><button data-floor="#e7e3db" style="background:#e7e3db" aria-label="Stone floor"></button></div></fieldset><div class="builder-help"><strong>Make it yours.</strong><p>Select an employee desk to move or rotate it. Moving a department also moves its staff desks. Zoom in for a closer view. Keep each standing spot and walkway clear.</p></div><p id="builder-feedback" role="status">Every desk needs a clear standing spot and a connected walkway.</p><button id="builder-save" class="primary-button">Save floor & return <span>↗</span></button><div class="builder-edit-row"><button id="builder-undo" class="text-button">↶ Undo</button><button id="builder-reset" class="text-button">Reset floor</button></div><div class="builder-edit-row"><button id="builder-export" class="text-button">Export floor ↓</button><button id="builder-import" class="text-button">Import floor ↑</button><input id="builder-file" type="file" accept="application/json,.json" hidden></div>';
    document.querySelector('.sidebar').append(this.panel);
    const imageButton=document.createElement('button');imageButton.id='builder-image';imageButton.className='text-button';imageButton.textContent='Save floor image ↓';imageButton.style.marginTop='12px';this.panel.append(imageButton);
    imageButton.onclick=()=>{const a=document.createElement('a');a.download='Benefits-Office-Floor.png';a.href=this.view.canvas.toDataURL('image/png');a.click();};
    this.selection=this.panel.querySelector('select');this.feedback=this.panel.querySelector('#builder-feedback');
    this.selection.addEventListener('change',()=>{this.select(this.selection.value);this.view.recenter?.();});
    this.panel.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>this.setTool(b.dataset.tool)));
    this.panel.querySelectorAll('[data-nudge]').forEach(b=>b.addEventListener('click',()=>this.nudge(...b.dataset.nudge.split(',').map(Number))));
    this.panel.querySelectorAll('[data-floor]').forEach(b=>b.addEventListener('click',()=>{const l=clone(this.model.state.layout);l.floorColor=b.dataset.floor;this.commit(l);}));
    this.panel.querySelector('#builder-rotate').onclick=()=>this.editProp('rotate');
    this.panel.querySelector('#builder-remove').onclick=()=>this.editProp('remove');
    this.panel.querySelector('#builder-undo').onclick=()=>{const l=this.undo.pop();if(l){this.model.setLayout(l);this.refresh();this.toast('Last floor change undone.');}};
    this.panel.querySelector('#builder-reset').onclick=()=>this.commit(clone(DEFAULT_LAYOUT));
    this.panel.querySelector('#builder-save').onclick=()=>this.close();
    this.panel.querySelector('#builder-export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(this.model.state.layout,null,2)],{type:'application/json'}));a.download='benefits-office-floor.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
    this.panel.querySelector('#builder-import').onclick=()=>this.panel.querySelector('#builder-file').click();
    this.panel.querySelector('#builder-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>50000)throw new Error('Choose a floor file smaller than 50 KB.');this.commit(JSON.parse(await file.text()));}catch(error){this.toast(error.message||'That floor file could not be opened.');}e.target.value='';};
    const canvas=view.canvas;
    canvas.addEventListener('pointerdown',e=>this.down(e),true);
    canvas.addEventListener('pointermove',e=>this.move(e),true);
    canvas.addEventListener('pointerup',e=>this.up(e),true);
    canvas.addEventListener('pointercancel',e=>this.cancelPointer(e),true);
    canvas.addEventListener('lostpointercapture',e=>{if(this.editPointers.has(e.pointerId))this.cancelPointer(e);},true);
  }
  loadSaved(){try{const raw=localStorage.getItem(STORE),l=JSON.parse(raw);if(l){const result=this.model.setLayout(l);if(result?.ok&&this.model.state.layout.migrationNotice){if(l.width===1000&&!localStorage.getItem(STORE+'-previous'))localStorage.setItem(STORE+'-previous',raw);this.toast(this.model.state.layout.migrationNotice);}}}catch{}}
  open(){
    this.cancelInteraction();this.active=true;this.view.builderMode=true;this.wasPhase=this.model.state.phase;
    this.setTool(this.view.compact?'pan':'move');
    this.model.setPaused(true);document.getElementById('lobby-panel').classList.add('hidden');document.getElementById('shift-panel').classList.add('hidden');this.panel.classList.remove('hidden');
    document.body.classList.add('building-floor');this.refresh();this.view.resize();this.onOpen?.();this.toast(this.view.compact?'Pan or pinch to look around. Open Tools to select and move a piece.':'Choose a person’s desk to move it. Zoom in to arrange the details.');
  }
  close(){
    try{localStorage.setItem(STORE,JSON.stringify(this.model.state.layout));}catch{}
    this.cancelInteraction();this.active=false;this.view.builderMode=false;this.view.cameraLocked=false;this.view.ghost=null;this.view.selectedId=null;this.panel.classList.add('hidden');document.body.classList.remove('building-floor');
    if(this.wasPhase==='playing')this.model.setPaused(false);this.onDone();this.toast('Floor saved. Your next workday will use this layout.');
  }
  refresh(){
    const l=this.model.state.layout;if(!l)return;
    this.selection.replaceChildren();
    const spaces=document.createElement('optgroup');spaces.label='Departments & shared spaces';this.selection.append(spaces);
    for(const st of this.model.stations){const o=document.createElement('option');o.value=st.id;o.textContent=st.label;spaces.append(o);}
    const desks=document.createElement('optgroup');desks.label='Assigned employee desks';this.selection.append(desks);
    for(const desk of this.model.desks||[]){const o=document.createElement('option');o.value='desk:'+desk.id;o.textContent=desk.ownerName?desk.ownerName+' — desk':desk.label;desks.append(o);}
    const counts={};for(const p of l.props){const o=document.createElement('option');o.value='prop:'+p.id;counts[p.type]=(counts[p.type]||0)+1;o.textContent=p.type[0].toUpperCase()+p.type.slice(1)+' '+counts[p.type];this.selection.append(o);}
    if(!this.object(this.selected))this.selected=this.model.stations[0].id;this.select(this.selected);
  }
  select(id){this.selected=id;this.view.selectedId=id;this.selection.value=id;const o=this.object(id),desk=id?.startsWith('desk:')?(this.model.desks||[]).find(d=>'desk:'+d.id===id):null;this.panel.querySelector('#builder-selected').textContent=o?(desk?.ownerName?desk.ownerName+'’s desk':o.label||o.title||o.type)+' · drag to move':'Select a space on the floor.';this.panel.querySelector('#builder-rotate').disabled=!id?.startsWith('prop:')&&!desk;this.panel.querySelector('#builder-remove').disabled=!id?.startsWith('prop:');}
  object(id,layout=this.model.state.layout){if(!id)return null;if(id.startsWith('prop:'))return layout.props.find(p=>p.id===id.slice(5));if(id.startsWith('desk:'))return layout.desks?.find(p=>p.id===id.slice(5));if(id.startsWith('exec:'))return layout.executives.find(e=>e.id===id.slice(5));return layout.stations.find(s=>s.id===id);}
  setTool(tool){if(!['pan','move','plant','sofa','cabinet','divider'].includes(tool))return;this.cancelInteraction();this.tool=tool;this.panel.querySelectorAll?.('[data-tool]').forEach(b=>{b.classList.toggle('selected',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));});this.onToolChange?.(tool);}
  clearDrag(){this.drag=null;this.view.ghost=null;this.view.cameraLocked=false;}
  cancelInteraction(){this.clearDrag();for(const id of this.editPointers||[]){try{this.view.canvas.releasePointerCapture?.(id);}catch{}}this.editPointers?.clear();this.multiTouch=false;}
  cancelPointer(e){if(!this.active||this.tool==='pan')return;this.editPointers?.delete(e.pointerId);this.clearDrag();this.multiTouch=!!this.editPointers?.size;try{this.view.canvas.releasePointerCapture?.(e.pointerId);}catch{}}
  moveObject(layout,id,dx,dy){const o=this.object(id,layout);if(!o)return false;o.x+=dx;o.y+=dy;if(!id.startsWith('prop:')&&!id.startsWith('desk:')&&!id.startsWith('exec:'))for(const d of layout.desks||[])if(d.kind==='employee'&&d.role===id){d.x+=dx;d.y+=dy;}return true;}
  nudge(dx,dy){if(!this.active||!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(dx)+Math.abs(dy)!==1)return false;this.cancelInteraction();const layout=clone(this.model.state.layout);if(!this.moveObject(layout,this.selected,dx*20,dy*20)){this.toast('Select a desk, department, or furniture piece first.');return false;}return this.commit(layout);}
  commit(layout){
    const before=clone(this.model.state.layout);const result=this.model.setLayout(layout);
    if(result?.ok===false){this.feedback.textContent=result.message||'That would block a walkway. Try another spot.';this.toast(this.feedback.textContent);return false;}
    this.undo.push(before);if(this.undo.length>30)this.undo.shift();this.feedback.textContent=this.model.state.layout.migrationNotice||'All desks and departments reachable. Looking good.';this.refresh();return true;
  }
  editProp(action){const isProp=this.selected?.startsWith('prop:'),isDesk=this.selected?.startsWith('desk:');if(!isProp&&!isDesk){this.toast('Select a desk or furniture piece first.');return;}if(action==='remove'&&isDesk){this.toast('Every employee keeps an assigned desk. Move it to a better spot.');return;}const l=clone(this.model.state.layout),p=this.object(this.selected,l);if(!p)return;if(action==='remove')l.props=l.props.filter(v=>v.id!==p.id);else p.rotation=p.rotation?0:1;this.commit(l);}
  point(e){const p=this.view.screenToWorld(e.clientX,e.clientY);return{x:snap(p.x),y:snap(p.y)};}
  down(e){
    if(!this.active||this.tool==='pan')return;e.preventDefault();e.stopImmediatePropagation();if(e.button!==0)return;
    this.editPointers??=new Set();this.editPointers.add(e.pointerId);try{this.view.canvas.setPointerCapture(e.pointerId);}catch{}
    if(this.editPointers.size>1||this.multiTouch||e.pointerType==='touch'&&e.isPrimary===false){this.multiTouch=true;this.clearDrag();return;}
    const p=this.point(e);
    if(this.tool==='move'){
      let id=this.view.hitTest(e.clientX,e.clientY);if(typeof id!=='string')id=id?.id;
      if(!id||id.startsWith('npc:')){const prop=this.model.state.layout.props.find(o=>Math.hypot(o.x-p.x,o.y-p.y)<45);id=prop?'prop:'+prop.id:null;}
      const object=this.object(id);if(!object)return;this.view.cameraLocked=true;this.select(id);this.drag={id,start:p,object:clone(object),pointerId:e.pointerId};
    }else{this.view.cameraLocked=true;this.drag={id:'prop:new',start:p,object:{type:this.tool,x:p.x,y:p.y,rotation:0},placing:true,pointerId:e.pointerId};}
    this.move(e);
  }
  move(e){
    if(!this.active||this.tool==='pan')return;e.stopImmediatePropagation();if(this.multiTouch||this.drag&&e.pointerId!==this.drag.pointerId)return;const p=this.point(e);
    if(this.drag){const o=this.drag.object,x=o.x+snap(p.x-this.drag.start.x),y=o.y+snap(p.y-this.drag.start.y);this.view.ghost={kind:this.drag.placing||this.drag.id.startsWith('prop:')?'prop':this.drag.id.startsWith('exec:')?'executive':this.drag.id.startsWith('desk:')?'desk':'station',id:this.drag.id,type:o.type,x,y,rotation:o.rotation||0,valid:x>20&&x<this.model.bounds.width-20&&y>20&&y<this.model.bounds.height-20};if(this.view.ghost.kind==='station')this.view.ghost.desks=(this.model.state.layout.desks||[]).filter(d=>d.kind==='employee'&&d.role===this.drag.id).map(d=>({...d,x:d.x+x-o.x,y:d.y+y-o.y}));}
    else if(this.tool!=='move')this.view.ghost={kind:'prop',type:this.tool,x:p.x,y:p.y,valid:p.x>20&&p.x<this.model.bounds.width-20&&p.y>20&&p.y<this.model.bounds.height-20,rotation:0};
  }
  up(e){
    if(!this.active||this.tool==='pan')return;e.stopImmediatePropagation();this.editPointers?.delete(e.pointerId);try{this.view.canvas.releasePointerCapture?.(e.pointerId);}catch{}
    if(this.multiTouch){this.clearDrag();if(!this.editPointers?.size)this.multiTouch=false;return;}if(!this.drag||e.pointerId!==this.drag.pointerId)return;
    const ghost=this.view.ghost,l=clone(this.model.state.layout),drag=this.drag;this.drag=null;this.view.ghost=null;this.view.cameraLocked=false;if(!ghost?.valid){this.toast('Keep furniture inside the floor.');return;}
    if(drag.placing){const id='piece-'+Date.now().toString(36);l.props.push({id,type:drag.object.type,x:ghost.x,y:ghost.y,rotation:0});this.selected='prop:'+id;}
    else{const o=this.object(drag.id,l);if(!o)return;if(o.x===ghost.x&&o.y===ghost.y)return;this.moveObject(l,drag.id,ghost.x-o.x,ghost.y-o.y);}
    this.commit(l);
  }
}
