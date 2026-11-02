/* Navigation and search enhancements for the standalone v2 preview. */
(()=>{'use strict';
 const header=document.getElementById('rail');
 const menu=document.getElementById('v2-menu-toggle');
 const nav=document.getElementById('v2-main-nav');
 const dropdown=document.getElementById('v2-nav-dropdown');
 const search=document.getElementById('section-search');
 if(!header||!menu||!nav||!search)return;
 const close=()=>{header.dataset.menuOpen='false';menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Открыть меню');if(dropdown)dropdown.open=false};
 menu.addEventListener('click',()=>{
  const open=header.dataset.menuOpen!=='true';
  header.dataset.menuOpen=String(open);
  menu.setAttribute('aria-expanded',String(open));
  menu.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');
  if(!open&&dropdown)dropdown.open=false;
 });
 function focusSearch(){
  document.querySelector('#v2-main-nav [data-page="home"]')?.click();
  requestAnimationFrame(()=>{search.scrollIntoView({block:'center',behavior:'smooth'});search.focus({preventScroll:true})});
 }
 document.getElementById('v2-quick-search')?.addEventListener('click',focusSearch);
 document.addEventListener('keydown',event=>{
  const tag=document.activeElement?.tagName;
  if(event.key==='Escape'){close();return}
  if(event.key==='/'&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!['INPUT','TEXTAREA'].includes(tag)){
   event.preventDefault();focusSearch();
  }
 });
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-page]'))close();
  else if(!header.contains(event.target)&&dropdown?.open)dropdown.open=false;
 });
 document.querySelectorAll('.v2-dropdown-content .rail-button').forEach(button=>{
  button.addEventListener('click',()=>{close()});
 });
})();
