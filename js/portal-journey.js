/* Additional interaction patterns for FSO portal, isolated from active index.html.
 * Progressive enhancement: when JS is unavailable, documents remain navigable.
 */
(()=>{'use strict';
 const root=document.documentElement;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const home=document.getElementById('home-screen');
 const territories=document.getElementById('territories-screen');
 const detention=document.getElementById('detention-screen');
 const laws=document.getElementById('law-screen');
 if(!home||!territories||!detention||!laws)return;

 const homeBlocks=[
  {selector:'.nv-hero',label:'Начало'},
  {selector:'.nv-service-index',label:'Служба'},
  {selector:'.nv-library',label:'Справочник'},
  {selector:'.nv-legal',label:'Документы'},
  {selector:'.nv-workspace',label:'Кабинет'}
 ].map(x=>({...x,element:home.querySelector(x.selector)})).filter(x=>x.element);
 const chapters=document.createElement('nav');
 chapters.className='nv-chapters';
 chapters.setAttribute('aria-label','Навигация по главной странице');
 chapters.hidden=true;
 for(let i=0;i<homeBlocks.length;i++){
  const item=homeBlocks[i],b=document.createElement('button');
  b.type='button';b.className='nv-chapter';
  b.setAttribute('aria-label','Перейти к разделу '+item.label);
  const marker=document.createElement('span');marker.className='nv-chapter-dot';marker.setAttribute('aria-hidden','true');
  const label=document.createElement('span');label.className='nv-chapter-label';label.textContent=item.label;
  b.append(marker,label);
  b.addEventListener('click',()=>{
   item.element.scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'start'});
  });
  chapters.append(b);
 }
 document.body.append(chapters);

 const territoryParts=[...territories.querySelectorAll('.tg-part[id]')].filter(el=>el.querySelector('h2'));
 const territoryJump=document.createElement('nav');
 territoryJump.className='nv-territory-jump';
 territoryJump.setAttribute('aria-label','Оглавление раздела территорий');
 const jumpLabel=document.createElement('strong');jumpLabel.textContent='РАЗДЕЛЫ';
 territoryJump.append(jumpLabel);
 for(let i=0;i<territoryParts.length;i++){
  const el=territoryParts[i];
  const button=document.createElement('button');
  button.type='button';button.textContent=el.querySelector('h2')?.textContent?.trim()||'Раздел '+(i+1);
  button.setAttribute('aria-label','Перейти к '+button.textContent);
  button.addEventListener('click',()=>el.scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'start'}));
  territoryJump.append(button);
 }
 territories.querySelector('.tg-header')?.insertAdjacentElement('afterend',territoryJump);

 const head=laws.querySelector('.law-top');
 const focus=document.createElement('button');
 focus.type='button';
 focus.className='nv-reader-toggle';
 focus.setAttribute('aria-pressed','false');
 focus.textContent='Режим чтения';
 function switchFocus(force){
  const on=typeof force==='boolean'?force:!laws.classList.contains('nv-reader-focused');
  laws.classList.toggle('nv-reader-focused',on);
  focus.setAttribute('aria-pressed',String(on));
  focus.textContent=on?'Показать список документов':'Режим чтения';
 }
 focus.addEventListener('click',()=>switchFocus());
 head?.append(focus);
 // Escape returns the document catalogue, unless a dialog is open.
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!laws.classList.contains('nv-reader-focused'))return;
  if(document.querySelector('[role="dialog"]:not([hidden])'))return;
  switchFocus(false);focus.focus();
 });

 const live=document.createElement('p');
 live.className='nv-det-step-position';live.setAttribute('aria-live','off');
 const navBox=detention.querySelector('.det-aside-box');
 navBox?.querySelector('.det-aside-title')?.insertAdjacentElement('afterend',live);

 const geometryIndex=(elements,cutoff)=>{
  let current=0;
  for(let i=0;i<elements.length;i++){
   const rect=elements[i].getBoundingClientRect();
   if(rect.top<=cutoff)current=i;
  }
  return current;
 };
 function markCurrent(buttons,index){
  for(let i=0;i<buttons.length;i++){
   const current=i===index;
   buttons[i].classList.toggle('nv-current',current);
   if(current)buttons[i].setAttribute('aria-current','location');
   else buttons[i].removeAttribute('aria-current');
  }
 }
 let raf=0;
 function update(){
  raf=0;
  const onHome=!home.hidden;
  chapters.hidden=!onHome||window.innerWidth<1200;
  if(onHome&&homeBlocks.length){
   const i=geometryIndex(homeBlocks.map(x=>x.element),window.innerHeight*.42);
   markCurrent([...chapters.querySelectorAll('button')],i);
  }
  if(!territories.hidden&&territoryParts.length){
   const i=geometryIndex(territoryParts,window.innerHeight*.43);
   markCurrent([...territoryJump.querySelectorAll('button')],i);
  }
  if(!detention.hidden){
   const steps=[...detention.querySelectorAll('#detention-steps .det-step')];
   if(steps.length){
    const i=geometryIndex(steps,window.innerHeight*.44);
    const formatted=String(i+1).padStart(2,'0');
    live.textContent='Этап '+formatted+' / '+String(steps.length).padStart(2,'0');
   }else{
    live.textContent='';
   }
  }
 }
 const schedule=()=>{if(raf)return;raf=requestAnimationFrame(update)};
 window.addEventListener('scroll',schedule,{passive:true});
 window.addEventListener('resize',schedule,{passive:true});
 const visibility=new MutationObserver(schedule);
 for(const screen of [home,territories,detention,laws]){
  visibility.observe(screen,{attributes:true,attributeFilter:['hidden']});
 }
 const steps=document.getElementById('detention-steps');
 if(steps)new MutationObserver(schedule).observe(steps,{childList:true});
 // A chapter jump should update the state even if the browser scrolls instantly.
 schedule();
})();
