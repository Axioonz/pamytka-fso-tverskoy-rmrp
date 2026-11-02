/* Wiki-style portal interactions; all legal/search content remains in the existing website scripts. */
(()=>{'use strict';
 const header=document.getElementById('rail');
 const menu=document.getElementById('wk-menu-toggle');
 const drop=document.getElementById('wk-dropdown');
 const modal=document.getElementById('wk-search-modal');
 const launch=document.getElementById('wk-search-launch');
 const input=document.getElementById('section-search');
 const closeButton=document.getElementById('wk-search-close');
 if(!header||!menu||!modal||!input)return;
 let lastFocus=null;
 function closeMenu(){header.dataset.menuOpen='false';menu.setAttribute('aria-expanded','false');if(drop)drop.open=false}
 function openSearch(){
  const current=document.getElementById('home-screen');
  if(current?.hidden){document.querySelector('.wk-brand[data-page="home"]')?.click()}
  closeMenu();lastFocus=document.activeElement;
  modal.hidden=false;document.body.classList.add('wk-search-open');
  requestAnimationFrame(()=>input.focus());
 }
 function closeSearch(){
  if(modal.hidden)return;
  modal.hidden=true;document.body.classList.remove('wk-search-open');
  const next=lastFocus;lastFocus=null;
  if(next?.isConnected&&typeof next.focus==='function')next.focus({preventScroll:true});
 }
 launch?.addEventListener('click',openSearch);
 closeButton?.addEventListener('click',closeSearch);
 document.querySelector('[data-wk-search-close]')?.addEventListener('click',closeSearch);
 menu.addEventListener('click',()=>{const open=header.dataset.menuOpen!=='true';header.dataset.menuOpen=String(open);menu.setAttribute('aria-expanded',String(open));if(!open&&drop)drop.open=false});
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeSearch();closeMenu();return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();return}
  if(e.key==='/'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();openSearch();return}
  if(e.key==='Tab'&&!modal.hidden){
   const focusable=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(el=>el.getClientRects().length);
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
 });
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-page],[data-law-id],[data-reference-id]')){
   closeMenu();
   if(!modal.hidden)closeSearch();
  } else if(!header.contains(e.target)&&drop?.open){drop.open=false}
 });
 window.addEventListener('hashchange',()=>{closeMenu();closeSearch()});
})();
