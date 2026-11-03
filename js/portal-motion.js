/* Portal motion: state-aware transitions and scroll reveal.
   No scroll hijacking; normal browser scrolling and existing data functions are preserved. */
(()=>{'use strict';
 const root=document.documentElement;
 const screens=['home-screen','section-screen','situations-screen','detention-screen','territories-screen','escort-screen','posts-screen','favorites-screen','departments-screen','quiz-screen','reference-screen','law-screen'];
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const selectors={
  'home-screen':['.nv-utility','.nv-section-title','.nv-main-module','.nv-service-links>button','.nv-library-intro','.nv-library-list','.nv-library-list>button','.nv-legal-list>button','.nv-workspace','.nv-roadmap'],
  'territories-screen':['.tg-regime','.tg-part-head','.tg-object-card','.tg-regime-grid','.tg-part'],
  'detention-screen':['.det-quick','.det-stat','.det-step','.det-aside-box'],
  'reference-screen':['.ref-mode','.reference-controls','.reference-entry'],
  'law-screen':['.law-sidebar','.law-reader'],
  'escort-screen':['.escort-section-heading','.escort-track','.escort-briefing','.escort-future-item'],
  'posts-screen':['.service-tabs','.service-panel','.duty-card','.duty-item']
 };
 const progress=document.createElement('div');
 progress.className='nv-reading-progress';
 progress.setAttribute('aria-hidden','true');
 const top=document.createElement('button');
 top.className='nv-back-top';
 top.type='button';
 top.setAttribute('aria-label','Вернуться наверх');
 top.innerHTML='<span aria-hidden="true">↑</span> Наверх';
 top.addEventListener('click',()=>window.scrollTo({top:0,behavior:reduced.matches?'instant':'smooth'}));
 document.body.append(progress,top);
 let raf=false;
 function renderProgress(){
  raf=false;
  const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
  const percent=max>0?Math.max(0,Math.min(1,window.scrollY/max)):0;
  progress.style.transform='scaleX('+percent.toFixed(4)+')';
  top.classList.toggle('is-visible',window.scrollY>650);
 }
 function scheduleProgress(){if(raf)return;raf=true;requestAnimationFrame(renderProgress)}
 window.addEventListener('scroll',scheduleProgress,{passive:true});
 window.addEventListener('resize',scheduleProgress,{passive:true});
 scheduleProgress();
 // Reveal only visible content; hidden tabs are untouched until they are actually displayed.
 let observer=null;
 const supported=typeof IntersectionObserver!=='undefined'&&!reduced.matches;
 if(supported)observer=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(entry.isIntersecting){
    entry.target.classList.add('nv-visible');
    observer.unobserve(entry.target);
   }
  }
 },{root:null,rootMargin:'0px 0px -20px 0px',threshold:0.055});
 function activeScreen(){
  return screens.map(id=>document.getElementById(id)).find(el=>el&&!el.hidden)||null;
 }
 function showImmediately(el){
  const box=el.getBoundingClientRect();
  return box.top<window.innerHeight*.91&&box.bottom>=0;
 }
 function registerScreen(){
  const current=activeScreen();
  if(!current)return;
  if(!supported){current.querySelectorAll('.nv-reveal').forEach(el=>el.classList.add('nv-visible'));return}
  const targets=(selectors[current.id]||['.work-header','.material-card','.section']).flatMap(s=>[...current.querySelectorAll(s)]);
  let n=0;
  for(const el of new Set(targets)){
   if(el.classList.contains('nv-reveal'))continue;
   if(el.closest('[hidden]'))continue;
   el.classList.add('nv-reveal');
   el.style.setProperty('--nv-stagger',((n++%4)*64)+'ms');
   if(showImmediately(el))el.classList.add('nv-visible');
   else observer.observe(el);
  }
  root.classList.add('nv-motion-ready');
  scheduleProgress();
 }
 registerScreen();
 // Dynamically generated legal entries and duty cards appear after async section loads.
 let pending=false;
 const refresh=()=>{
  if(pending)return;
  pending=true;
  requestAnimationFrame(()=>{pending=false;registerScreen()});
 };
 const contentObserver=new MutationObserver(changes=>{
  const updates=changes.some(x=>x.type==='childList'||(x.type==='attributes'&&x.attributeName==='hidden'));
  if(!updates)return;
  for(const change of changes){
   if(change.type!=='attributes'||change.attributeName!=='hidden')continue;
   const screen=change.target;
   if(screen.hidden||!screens.includes(screen.id)||reduced.matches)continue;
   screen.dataset.nvEnter='1';
   const end=()=>{delete screen.dataset.nvEnter};
   screen.addEventListener('animationend',end,{once:true});
   window.setTimeout(end,900);
  }
  refresh();
 });
 for(const id of screens){
  const element=document.getElementById(id);
  if(element)contentObserver.observe(element,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
 }
 // Readability highlight in the detention timeline, including clicking its existing chapter navigation.
 const stepObserver=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{
  for(const entry of entries)entry.target.classList.toggle('nv-step-in-view',entry.isIntersecting);
 },{rootMargin:'-18% 0px -46% 0px',threshold:0.05}):null;
 function refreshSteps(){
  if(!stepObserver)return;
  document.querySelectorAll('#detention-steps .det-step:not([data-nv-step-watched])').forEach(el=>{
   el.dataset.nvStepWatched='1';
   stepObserver.observe(el);
  });
 }
 refreshSteps();
 const stepList=document.getElementById('detention-steps');
 if(stepList)new MutationObserver(refreshSteps).observe(stepList,{childList:true,subtree:false});
 // Navigation is synchronous. Screen-enter animation happens AFTER the
 // original screen switch, so hash/reload and tests always see the new page.
 // The original go() handler is never intercepted or replayed.
 // Avoid motion if a visitor chooses reduced animation while the page stays open.
 reduced.addEventListener?.('change',()=>{
  root.classList.toggle('nv-motion-ready',!reduced.matches);
  if(reduced.matches){
   observer?.disconnect();
   document.querySelectorAll('.nv-reveal').forEach(el=>el.classList.add('nv-visible'));
  }else registerScreen();
 });
})();
