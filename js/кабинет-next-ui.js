/* Preview-only interaction details; no Supabase/auth/roster overrides. */
(()=>{'use strict';
 const root=document.getElementById('main');
 if(!root)return;
 const isTyping=()=>['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;
 const setScreen=()=>{
  let view='loading';
  if(root.querySelector('#login-form'))view='login';
  else if(root.querySelector('nav.tabs')){
   view=root.querySelector('nav.tabs .active')?.dataset.tab||'roster';
  }else if(root.querySelector('[id^="cadet"]'))view='cadet';
  root.dataset.cbView=view;
 };
 const watcher=new MutationObserver(()=>requestAnimationFrame(setScreen));
 watcher.observe(root,{subtree:false,childList:true});
 setScreen();
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||isTyping())return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
   const field=root.querySelector('input[type="search"]');
   if(field){event.preventDefault();field.focus({preventScroll:true});field.scrollIntoView({block:'center',behavior:'smooth'})}
  }
 });
})();
