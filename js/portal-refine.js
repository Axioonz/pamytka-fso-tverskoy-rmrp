/* Display existing article summaries and citations, without ordinal markers. */
(()=>{'use strict';
 const container=document.getElementById('reference-list');
 if(!container)return;
 const enhance=()=>{
  for(const card of [...container.children].filter(el=>el.classList.contains('reference-entry'))){
   card.querySelector(':scope > .nv-ref-index')?.remove();
   const title=card.querySelector('.reference-entry-main b')?.textContent?.trim()||'Правовое основание';
   const excerpt=card.querySelector('.ref-summary')?.textContent?.trim()||'';
   const citation=card.querySelector('.reference-citation')?.textContent?.trim()||'';
   card.setAttribute('aria-label',[title,excerpt,citation].filter(Boolean).join('. '));
   if(!card.querySelector(':scope > .nv-ref-arrow')){
    const arrow=document.createElement('span');
    arrow.className='nv-ref-arrow';
    arrow.textContent='↗';
    arrow.setAttribute('aria-hidden','true');
    card.append(arrow);
   }
  }
 };
 new MutationObserver(changes=>{if(changes.some(change=>change.type==='childList'))enhance()})
  .observe(container,{childList:true});
 enhance();
})();
