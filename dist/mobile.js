export const COMPACT_QUERY='(max-width:1100px), (max-height:600px), (pointer:coarse)';

// Compact play keeps the floor in view; the same task and builder controls move
// into a dialog rather than being duplicated or losing their event handlers.
export class MobileOffice {
  constructor({model,view,chat,builder,network,onWalk,onZoom,onRecenter,onBlocking=()=>{}}){
    Object.assign(this,{model,view,chat,builder,network,onWalk,onZoom,onRecenter,onBlocking});
    this.media=window.matchMedia(COMPACT_QUERY);this.compact=this.media.matches;
    this.bar=document.createElement('div');this.bar.className='mobile-gamebar';
    this.bar.innerHTML='<button id="mobile-tasks" type="button" aria-label="Open tasks">☷ <span>Tasks</span></button><div class="mobile-game-title"><strong>benefits</strong><small id="mobile-clock"></small></div><button id="mobile-menu" type="button" aria-label="Open office menu">☰ <span>Menu</span></button>';
    document.querySelector('.office-board').prepend(this.bar);
    this.dock=document.createElement('nav');this.dock.className='mobile-dock';this.dock.setAttribute('aria-label','Office view controls');
    this.dock.innerHTML='<button id="mobile-directory" type="button">⌕ <span>Directory</span></button><button id="mobile-zoom-out" type="button" aria-label="Zoom office out">−</button><button id="mobile-recenter" type="button" aria-label="Center view on your character">◎ <span>Me</span></button><button id="mobile-zoom-in" type="button" aria-label="Zoom office in">+</button><button id="mobile-chat" type="button">☷ <span>Chat</span></button>';
    document.querySelector('.office-board').append(this.dock);
    this.backdrop=document.createElement('button');this.backdrop.id='mobile-backdrop';this.backdrop.className='hidden';this.backdrop.setAttribute('aria-label','Close office chat');document.body.append(this.backdrop);
    this.sheet=document.createElement('dialog');this.sheet.id='mobile-sheet';this.sheet.className='mobile-sheet modal';this.sheet.setAttribute('aria-labelledby','mobile-sheet-title');
    this.sheet.innerHTML='<div class="mobile-sheet-header"><h2 id="mobile-sheet-title">Your office</h2><button id="mobile-sheet-close" type="button" aria-label="Close panel">×</button></div><div id="mobile-sheet-content"></div>';
    document.body.append(this.sheet);this.content=this.sheet.querySelector('#mobile-sheet-content');
    this.sheet.querySelector('#mobile-sheet-close').onclick=()=>this.closeSheet();this.sheet.addEventListener('cancel',e=>{e.preventDefault();this.closeSheet();});this.sheet.addEventListener('close',()=>{if(!this.sheet.open)this.releaseSheet();});
    this.sheet.addEventListener('click',e=>{if(e.target===this.sheet){const r=this.sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.closeSheet();}});
    this.backdrop.onclick=()=>this.chat.close();
    document.getElementById('mobile-tasks').onclick=()=>this.builder.active?this.openBuilderTools():this.openTasks();
    document.getElementById('mobile-menu').onclick=()=>{if(this.builder.active){this.closeSheet();this.builder.close();}else this.openMenu();};
    document.getElementById('mobile-directory').onclick=()=>this.builder.active?this.openBuilderTools():this.openDirectory();
    document.getElementById('mobile-zoom-out').onclick=()=>this.onZoom(-.25);
    document.getElementById('mobile-zoom-in').onclick=()=>this.onZoom(.25);
    document.getElementById('mobile-recenter').onclick=()=>this.onRecenter();
    document.getElementById('mobile-chat').onclick=()=>{if(this.builder.active){this.view.recenter({fit:true});return;}this.chat.open(this.network.active?'team':'overheard');};
    this.chat.onVisibility=()=>this.syncChat();
    this.chat.node.addEventListener('keydown',e=>{if(!this.compact||this.chat.node.classList.contains('hidden'))return;if(e.key==='Escape'){e.preventDefault();this.chat.close();return;}if(e.key==='Tab'){const nodes=[...this.chat.node.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(n=>n.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
    this.resizeHandler=()=>{if(this.resizePending)return;this.resizePending=requestAnimationFrame(()=>{this.resizePending=null;this.onBlocking();this.builder.cancelInteraction?.();this.setViewport();this.sync();this.view.resize();});};
    window.addEventListener('resize',this.resizeHandler);window.visualViewport?.addEventListener('resize',this.resizeHandler);window.visualViewport?.addEventListener('scroll',()=>this.setViewport());
    document.addEventListener('focusin',()=>this.setViewport());document.addEventListener('focusout',()=>requestAnimationFrame(()=>this.setViewport()));
    this.media.addEventListener?.('change',this.resizeHandler);this.setViewport();this.sync();
  }
  get blocking(){return this.sheet.open||(this.compact&&!this.chat.node.classList.contains('hidden'));}
  setViewport(){const height=Math.max(160,Math.round(window.visualViewport?.height||window.innerHeight));document.documentElement.style.setProperty('--office-vh',height+'px');const editing=['INPUT','TEXTAREA'].includes(document.activeElement?.tagName);document.body.classList.toggle('mobile-keyboard-open',editing&&height<window.innerHeight*.8);}
  sync(force=false){
    const next=this.media.matches,changed=next!==this.compact;this.compact=next;document.body.classList.toggle('compact-ui',next);
    if(changed||force){this.closeSheet();this.chat.close();this.onBlocking();this.view.setCompact(next);this.view.resize();}
    else if(this.view.compact!==next)this.view.setCompact(next);
    if(!['playing','paused','ended'].includes(this.model.state.phase)&&!this.builder.active)this.closeAll();
    this.bar.querySelector('#mobile-tasks span').textContent=this.builder.active?'Tools':'Tasks';this.bar.querySelector('#mobile-tasks').setAttribute('aria-label',this.builder.active?'Open floor tools':'Open tasks');
    this.bar.querySelector('#mobile-menu span').textContent=this.builder.active?'Done':'Menu';this.bar.querySelector('#mobile-menu').setAttribute('aria-label',this.builder.active?'Save floor and return':'Open office menu');
    this.dock.querySelector('#mobile-directory span').textContent=this.builder.active?'Tools':'Directory';this.dock.querySelector('#mobile-chat span').textContent=this.builder.active?'Fit':'Chat';this.dock.querySelector('#mobile-recenter span').textContent=this.builder.active?'Focus':'Me';this.dock.querySelector('#mobile-recenter').setAttribute('aria-label',this.builder.active?'Center view on the selected space':'Center view on your character');
    this.syncChat();this.update();
  }
  update(){
    const clock=document.querySelector('#time-label span');document.getElementById('mobile-clock').textContent=this.builder.active?'Floor studio':clock?.textContent||'Your office';
    const zoom=document.getElementById('zoom-level');if(zoom)zoom.textContent=this.view.zoom<=1?'Fit':Math.round(this.view.zoom*100)+'%';
    document.body.classList.toggle('has-office-event',!!this.model.state.event);document.body.classList.toggle('has-office-summon',!!this.model.state.summon);
  }
  syncChat(){const open=this.compact&&!this.chat.node.classList.contains('hidden'),opening=open&&!this.chatWasOpen;this.chatWasOpen=open;this.backdrop.classList.toggle('hidden',!open);document.body.classList.toggle('mobile-chat-open',open);document.getElementById('mobile-chat').setAttribute('aria-expanded',String(open));document.querySelector('.office-board').inert=open;if(open){this.chat.node.setAttribute('role','dialog');this.chat.node.setAttribute('aria-modal','true');if(opening){this.closeSheet();this.onBlocking();this.chat.node.querySelector('#chat-close').focus({preventScroll:true});}}else{this.chat.node.removeAttribute('role');this.chat.node.removeAttribute('aria-modal');}}
  openSheet(title,mode){
    if(!this.compact)return false;this.closeSheet();this.chat.close();this.onBlocking();
    this.mode=mode;this.wasPlaying=!this.network.active&&this.model.state.phase==='playing';if(this.wasPlaying)this.model.setPaused(true);
    this.sheet.querySelector('#mobile-sheet-title').textContent=title;this.content.replaceChildren();this.sheet.showModal();document.body.classList.add('mobile-sheet-open');return true;
  }
  movePanel(panel){this.moved={panel,parent:panel.parentNode,next:panel.nextSibling};this.content.append(panel);}
  releaseSheet(){
    if(this.moved){const {panel,parent,next}=this.moved;parent.insertBefore(panel,next?.parentNode===parent?next:null);this.moved=null;}
    if(this.wasPlaying&&!this.network.active&&this.model.state.phase==='paused')this.model.setPaused(false);this.wasPlaying=false;this.mode=null;document.body.classList.remove('mobile-sheet-open');this.onBlocking();
  }
  closeSheet(){this.releaseSheet();if(this.sheet.open)this.sheet.close();}
  closeAll(){this.closeSheet();this.chat.close();}
  beforeWalk(){if(this.compact){this.closeAll();this.view.recenter();}}
  openTasks(){if(this.openSheet('Your shift','tasks'))this.movePanel(document.getElementById('shift-panel'));}
  openBuilderTools(){if(this.openSheet('Floor tools','builder'))this.movePanel(this.builder.panel);}
  onBuilderOpen(){this.sync(true);if(this.compact){this.view.recenter();this.openBuilderTools();}}
  onBuilderDone(){this.closeAll();this.sync(true);}
  openDirectory(){
    if(!this.openSheet('Find a desk or department','directory'))return;
    const label=document.createElement('label');label.className='field-label';label.htmlFor='mobile-directory-select';label.textContent='WHERE WOULD YOU LIKE TO GO?';
    const source=document.getElementById('department-nav'),select=source.cloneNode(true);select.id='mobile-directory-select';select.removeAttribute('aria-label');select.value='';
    const go=document.createElement('button');go.type='button';go.className='primary-button';go.textContent='Walk there ↗';go.disabled=true;select.onchange=()=>go.disabled=!select.value;go.onclick=()=>{const id=select.value;this.closeSheet();this.onWalk(id);};
    const hint=document.createElement('p');hint.className='field-hint';hint.textContent='Tap the floor to walk. Drag to look around, or use two fingers to zoom.';this.content.append(label,select,hint,go);
  }
  menuButton(label,action,{disabled=false}={}){const b=document.createElement('button');b.type='button';b.className='mobile-menu-action';b.textContent=label;b.disabled=disabled;b.onclick=()=>{this.closeSheet();action();};this.content.append(b);}
  openMenu(){
    if(!this.openSheet('Your office','menu'))return;
    const click=id=>document.getElementById(id).click();
    if(this.network.active){const room=document.createElement('p');room.className='mobile-room-summary';room.textContent='Room '+this.network.room.code+' · '+this.network.room.players.length+' online';this.content.append(room);this.menuButton('Copy office invite',()=>click('copy-invite'));}
    this.menuButton('Show the whole office',()=>this.view.recenter({fit:true}));
    this.menuButton('My desk',()=>click('my-desk-go'));this.menuButton('Coffee break',()=>click('coffee-go'));this.menuButton('Sound mixer',()=>click('sound-settings'));this.menuButton('How to play',()=>click('help-btn'));this.menuButton('Take a break',()=>click('pause-btn'));
    this.menuButton('End shift',()=>click('end-btn'),{disabled:document.getElementById('end-btn').disabled});this.menuButton(this.network.active?'Leave online office':'Return to character setup',()=>click(this.network.active?'leave-room':'pause-restart'));
  }
}
