/* Isolated blue portal interactions. The shared legal data and screen handlers remain unchanged. */
(()=>{'use strict';
 const header=document.getElementById('rail');
 const menu=document.getElementById('nv-menu-button');
 const dropdown=document.getElementById('nv-more');
 const modal=document.getElementById('nv-search-modal');
 const launch=document.getElementById('nv-search-open');
 const input=document.getElementById('section-search');
 const closeButton=document.getElementById('nv-search-close');
 if(!header||!menu||!modal||!input)return;
 let lastFocus=null;
 const closeMenu=()=>{
  header.dataset.menuOpen='false';
  menu.setAttribute('aria-expanded','false');
  menu.setAttribute('aria-label','Открыть меню');
  if(dropdown)dropdown.open=false;
 };
 const openSearch=()=>{
  closeMenu();
  lastFocus=document.activeElement;
  modal.hidden=false;
  document.body.classList.add('nv-search-open');
  requestAnimationFrame(()=>input.focus());
 };
 const closeSearch=()=>{
  if(modal.hidden)return;
  modal.hidden=true;
  document.body.classList.remove('nv-search-open');
  const previous=lastFocus;
  lastFocus=null;
  if(previous?.isConnected&&typeof previous.focus==='function')previous.focus({preventScroll:true});
 };
 launch?.addEventListener('click',openSearch);
 closeButton?.addEventListener('click',closeSearch);
 document.querySelector('[data-nv-search-close]')?.addEventListener('click',closeSearch);
 menu.addEventListener('click',()=>{
  const open=header.dataset.menuOpen!=='true';
  header.dataset.menuOpen=String(open);
  menu.setAttribute('aria-expanded',String(open));
  menu.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');
  if(!open&&dropdown)dropdown.open=false;
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){closeSearch();closeMenu();return;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
   event.preventDefault();openSearch();return;
  }
  if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){
   event.preventDefault();openSearch();return;
  }
  if(event.key==='Tab'&&!modal.hidden){
   const focusable=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(el=>el.getClientRects().length);
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
 });
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-page],[data-law-id],[data-reference-id]')){
   closeMenu();
   closeSearch();
  }else if(!header.contains(event.target)&&dropdown?.open){
   dropdown.open=false;
  }
 });
})();
