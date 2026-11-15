import {DEFAULT_LAYOUT,validateLayout} from './layout.js';
const clone=value=>JSON.parse(JSON.stringify(value));
const snap=v=>Math.round(v/20)*20;
const STORE='benefits-floor-v2';

export class FloorBuilder {
  constructor(model,view,{toast=()=>{},onDone=()=>{}}={}){
    this.model=model;this.view=view;this.toast=toast;this.onDone=onDone;this.active=false;this.tool='move';this.undo=[];
    this.panel=document.createElement('section');this.panel.id='builder-panel';this.panel.className='hidden';
    this.panel.innerHTML='<div class="panel-heading"><span class="step-label">FLOOR STUDIO</span><span class="small-badge">DESKTOP</span></div><h2>A little room<br>for <em>improvement.</em></h2><p class="intro-copy">Move departments and executive offices. Add furniture. Keep the walkways clear.</p><label class="field-label" for="builder-selection">SELECT A SPACE</label><select id="builder-selection"></select><p id="builder-selected" class="field-hint">Drag a desk or office on the floor.</p><fieldset><legend>FURNITURE & FINISHES</legend><div id="builder-tools" class="builder-tools"><button data-tool="move" class="selected">↖ Move</button><button data-tool="plant">♧ Plant</button><button data-tool="sofa">▱ Sofa</button><button data-tool="cabinet">▤ Cabinet</button><button data-tool="divider">▥ Divider</button></div></fieldset><div class="builder-edit-row"><button id="builder-rotate" class="secondary-button">Rotate furniture</button><button id="builder-remove" class="secondary-button">Remove piece</button></div><fieldset><legend>FLOOR FINISH</legend><div class="floor-swatches"><button data-floor="#f7f3e8" style="background:#f7f3e8" aria-label="Warm ivory floor"></button><button data-floor="#e5eadf" style="background:#e5eadf" aria-label="Soft sage floor"></button><button data-floor="#e7e3db" style="background:#e7e3db" aria-label="Stone floor"></button></div></fieldset><div class="builder-help"><strong>Make it yours.</strong><p>Click a furniture tool, then click the floor to place it. Drag existing spaces to move them. Changes that block a department will be declined.</p></div><p id="builder-feedback" role="status">Every department needs a clear path.</p><button id="builder-save" class="primary-button">Save floor & return <span>↗</span></button><div class="builder-edit-row"><button id="builder-undo" class="text-button">↶ Undo</button><button id="builder-reset" class="text-button">Reset floor</button></div><div class="builder-edit-row"><button id="builder-export" class="text-button">Export floor ↓</button><button id="builder-import" class="text-button">Import floor ↑</button><input id="builder-file" type="file" accept="application/json,.json" hidden></div>';
    document.querySelector('.sidebar').append(this.panel);
    const imageButton=document.createElement('button');imageButton.id='builder-image';imageButton.className='text-button';imageButton.textContent='Save floor image ↓';imageButton.style.marginTop='12px';this.panel.append(imageButton);
    imageButton.onclick=()=>{const a=document.createElement('a');a.download='Benefits-Office-Floor.png';a.href=this.view.canvas.toDataURL('image/png');a.click();};
    this.selection=this.panel.querySelector('select');this.feedback=this.panel.querySelector('#builder-feedback');
    this.selection.addEventListener('change',()=>this.select(this.selection.value));
    this.panel.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>this.setTool(b.dataset.tool)));
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
    canvas.addEventListener('pointercancel',()=>{this.drag=null;this.view.ghost=null;},true);
  }
  loadSaved(){try{const l=JSON.parse(localStorage.getItem(STORE));if(l)this.model.setLayout(l);}catch{}}
  open(){
    this.active=true;this.view.builderMode=true;this.wasPhase=this.model.state.phase;
    this.model.setPaused(true);document.getElementById('lobby-panel').classList.add('hidden');document.getElementById('shift-panel').classList.add('hidden');this.panel.classList.remove('hidden');
    document.body.classList.add('building-floor');this.refresh();this.view.resize();this.toast('Drag departments and offices. Click a furniture tool to add a piece.');
  }
  close(){
    try{localStorage.setItem(STORE,JSON.stringify(this.model.state.layout));}catch{}
    this.active=false;this.view.builderMode=false;this.view.ghost=null;this.view.selectedId=null;this.panel.classList.add('hidden');document.body.classList.remove('building-floor');
    if(this.wasPhase==='playing')this.model.setPaused(false);this.onDone();this.toast('Floor saved. Your next workday will use this layout.');
  }
  refresh(){
    const l=this.model.state.layout;if(!l)return;
    this.selection.replaceChildren();
    for(const st of this.model.stations){const o=document.createElement('option');o.value=st.id;o.textContent=st.label;this.selection.append(o);}
    const counts={};for(const p of l.props){const o=document.createElement('option');o.value='prop:'+p.id;counts[p.type]=(counts[p.type]||0)+1;o.textContent=p.type[0].toUpperCase()+p.type.slice(1)+' '+counts[p.type];this.selection.append(o);}
    if(!this.object(this.selected))this.selected=this.model.stations[0].id;this.select(this.selected);
  }
  select(id){this.selected=id;this.view.selectedId=id;this.selection.value=id;const o=this.object(id);this.panel.querySelector('#builder-selected').textContent=o?(o.label||o.title||o.type)+' · drag to move':'Select a space on the floor.';}
  object(id,layout=this.model.state.layout){if(!id)return null;if(id.startsWith('prop:'))return layout.props.find(p=>p.id===id.slice(5));if(id.startsWith('exec:'))return layout.executives.find(e=>e.id===id.slice(5));return layout.stations.find(s=>s.id===id);}
  setTool(tool){this.tool=tool;this.view.ghost=null;this.panel.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('selected',b.dataset.tool===tool));}
  commit(layout){
    const before=clone(this.model.state.layout);const result=this.model.setLayout(layout);
    if(result?.ok===false){this.feedback.textContent=result.message||'That would block a walkway. Try another spot.';this.toast(this.feedback.textContent);return false;}
    this.undo.push(before);if(this.undo.length>30)this.undo.shift();this.feedback.textContent='All departments reachable. Looking good.';this.refresh();return true;
  }
  editProp(action){if(!this.selected?.startsWith('prop:')){this.toast('Select an added furniture piece first.');return;}const l=clone(this.model.state.layout),p=this.object(this.selected,l);if(!p)return;if(action==='remove')l.props=l.props.filter(v=>v.id!==p.id);else p.rotation=p.rotation?0:1;this.commit(l);}
  point(e){const p=this.view.screenToWorld(e.clientX,e.clientY);return{x:snap(p.x),y:snap(p.y)};}
  down(e){
    if(!this.active)return;e.preventDefault();e.stopImmediatePropagation();if(e.button!==0)return;
    const p=this.point(e);this.view.canvas.setPointerCapture(e.pointerId);
    if(this.tool==='move'){
      let id=this.view.hitTest(e.clientX,e.clientY);if(typeof id!=='string')id=id?.id;
      if(!id||id.startsWith('npc:')){const prop=this.model.state.layout.props.find(o=>Math.hypot(o.x-p.x,o.y-p.y)<45);id=prop?'prop:'+prop.id:null;}
      const object=this.object(id);if(!object)return;this.select(id);this.drag={id,start:p,object:clone(object)};
    }else this.drag={id:'prop:new',start:p,object:{type:this.tool,x:p.x,y:p.y,rotation:0},placing:true};
    this.move(e);
  }
  move(e){
    if(!this.active)return;e.stopImmediatePropagation();const p=this.point(e);
    if(this.drag){const o=this.drag.object,x=snap(o.x+p.x-this.drag.start.x),y=snap(o.y+p.y-this.drag.start.y);this.view.ghost={kind:this.drag.placing||this.drag.id.startsWith('prop:')?'prop':this.drag.id.startsWith('exec:')?'executive':'station',id:this.drag.id,type:o.type,x,y,rotation:o.rotation||0,valid:x>20&&x<this.model.bounds.width-20&&y>20&&y<this.model.bounds.height-20};}
    else if(this.tool!=='move')this.view.ghost={kind:'prop',type:this.tool,x:p.x,y:p.y,valid:p.x>20&&p.x<980&&p.y>20&&p.y<this.model.bounds.height-20,rotation:0};
  }
  up(e){
    if(!this.active)return;e.stopImmediatePropagation();if(!this.drag)return;
    const ghost=this.view.ghost,l=clone(this.model.state.layout),drag=this.drag;this.drag=null;this.view.ghost=null;if(!ghost?.valid){this.toast('Keep furniture inside the floor.');return;}
    if(drag.placing){const id='piece-'+Date.now().toString(36);l.props.push({id,type:drag.object.type,x:ghost.x,y:ghost.y,rotation:0});this.selected='prop:'+id;}
    else{const o=this.object(drag.id,l);if(!o)return;if(o.x===ghost.x&&o.y===ghost.y)return;o.x=ghost.x;o.y=ghost.y;}
    this.commit(l);
  }
}
