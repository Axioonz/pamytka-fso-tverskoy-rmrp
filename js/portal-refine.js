/* FSO portal refinement. Compact legal list with stable ordinal markers.
   Uses existing reference filtering and modal logic without changing shared scripts. */
(()=>{'use strict';
 const container=document.getElementById('reference-list');
 if(!container)return;
 const enhance=()=>{
  const cards=[...container.children].filter(el=>el.classList.contains('reference-entry'));
  for(let i=0;i<cards.length;i++){
   const card=cards[i];
   let number=card.querySelector(':scope > .nv-ref-index');
   if(!number){
    number=document.createElement('span');
    number.className='nv-ref-index';
    number.setAttribute('aria-hidden','true');
    card.prepend(number);
   }
   number.textContent=String(i+1).padStart(3,'0');
   const title=card.querySelector('.reference-entry-main b')?.textContent?.trim()||'Правовое основание';
   const citation=card.querySelector('.reference-citation')?.textContent?.trim()||'';
   card.setAttribute('aria-label',citation?title+'. '+citation:title);
   if(!card.querySelector(':scope > .nv-ref-arrow')){
    const arrow=document.createElement('span');
    arrow.className='nv-ref-arrow';
    arrow.textContent='↗';
    arrow.setAttribute('aria-hidden','true');
    card.append(arrow);
   }
  }
 };
 new MutationObserver(changes=>{
  if(changes.some(change=>change.type==='childList'))enhance();
 }).observe(container,{childList:true});
 enhance();
})();
