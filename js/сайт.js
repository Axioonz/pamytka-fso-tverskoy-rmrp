// ОСНОВНАЯ ЛОГИКА САЙТА
// Для редактирования текстов законов, ситуаций и понятий используй папку data/.
// Функции здесь менять не требуется.
'use strict';
const sections={
 home:{title:'Главная',keys:[]},
 situations:{title:'Ситуации',description:'Служебные ситуации и действия сотрудника.',keys:['сценарии','ситуация']},
 reference:{title:'Правовой справочник',description:'Правовые основания и точные формулировки.',keys:['статьи','основания','справочник']},
 concepts:{title:'Понятия',description:'Определения из законодательства RMRP.',keys:['значения','понятия','определения']},
 detention:{title:'Порядок задержания',description:'Порядок и основания задержания.',keys:['задержание','процедуры']},
 laws:{title:'Законодательство',description:'Законы и кодексы проекта.',keys:['законы','кодексы']},
 territories:{title:'Территории и объекты',description:'Режимы территорий и доступ.',keys:['территории','кремль','зот','кпп','доступ']},
 escort:{title:'Сопровождение и кортежи',description:'Полномочия на маршруте.',keys:['кортеж','маршрут','сопровождение']},
 posts:{title:'Посты и патрули',description:'Расположение постов, маршруты и доклады.',keys:['посты','патрули','маршруты','дежурство','доклады']},
 favorites:{title:'Личная шпаргалка',description:'Сохранённые материалы.',keys:['избранное','закладки','шпаргалка']},
 quiz:{title:'Проверка знаний',description:'В разработке.',keys:['тест','экзамен','вопросы','аттестация']}
};
const $=id=>document.getElementById(id);
function currentApiUrl(){
 const fromConfig=(window.FSO_API_URL||'').trim();
 try {const fromBrowser=(localStorage.getItem('fso-rmrp-api-url')||'').trim();if(/^https:\/\//i.test(fromBrowser))return fromBrowser;}catch{}
 return fromConfig;
}

// ВАЖНО: в справочнике только пункты с полным текстом в quote; summary - исключительно для обложки.
// Новые статьи добавляются обычной формой «Материалы» в админ-панели.
// Старые пересказы без маркировки точного текста остаются в админке, но не публикуются как цитаты закона.
const embeddedReferences=window.FSO_CURATED_REFS || [];
const localExtraMaterials=[...(window.FSO_CONCEPTS || []),...(window.FSO_DETENTION_MATERIALS || []),...(window.FSO_SITUATIONS || []),...(window.FSO_OTHER_MATERIALS || [])];
let publicMaterials=[...embeddedReferences,...localExtraMaterials];
const referenceLawCache=new Map();
const referenceCategories=Array.isArray(window.FSO_REFERENCE_CATEGORIES)&&window.FSO_REFERENCE_CATEGORIES.length?window.FSO_REFERENCE_CATEGORIES:[{id:'territories',title:'Территории и объекты'},{id:'procedure',title:'Проц. действия'},{id:'escort',title:'Сопровождение'},{id:'criminal',title:'Статьи УК и КоАП'}];
let referenceFilter='all';
let referenceAllMode=false;
const referencePriorityOrder=["ref-exact-fso-10-1-2", "ref-exact-fso-11-1-1", "ref-exact-fso-11-2-all", "ref-exact-fso-10-1-3", "ref-exact-fso-10-1-4", "ref-exact-fso-12-all-1", "ref-exact-fso-12-all-2", "verified-26625-30-1-all", "verified-26625-31-3-1", "verified-26625-31-3-2", "verified-26625-31-3-3", "ref-exact-territories-7-1-all", "ref-exact-territories-9-1-all", "ref-exact-territories-9-2-all", "ref-exact-territories-30-2-all", "ref-exact-fso-7-1-all", "verified-25069-7-2-all", "ref-exact-fso-7-3-2", "ref-exact-fso-7-6-1", "ref-exact-fso-7-8-all", "ref-exact-fso-10-1-6", "ref-exact-fso-10-1-7", "ref-exact-fso-11-1-2", "ref-exact-fso-11-1-3", "ref-exact-fso-11-1-5", "ref-exact-fso-10-1-8", "ref-exact-fso-10-1-19", "ref-exact-fso-10-2-all", "ref-exact-fso-10-1-17", "ref-exact-fso-10-1-18", "ref-exact-fso-9-1-7", "ref-exact-fso-15-3-all", "ref-exact-fso-17-1-all", "verified-58424-6-1-all", "verified-58424-6-2-all", "verified-58424-6-3-all", "verified-58424-7-1-all", "verified-58424-8-1-all", "verified-58424-10-1-all", "verified-58424-10-3-all", "verified-58424-12-1-all", "verified-58424-12-2-all", "verified-58209-62-1-all", "verified-58209-90-3-all", "reviewed-pk-6-4-2026", "reviewed-86-8-1-2026", "reviewed-86-8-2-2026", "reviewed-86-9-7-2026", "reviewed-86-4-3-2026"];

const EXACT_MARKER='ТОЧНЫЙ ТЕКСТ НОРМЫ:';
function getReferenceCitation(item){
 const original=String(item.citation||String(item.body||'').match(/Правовое основание:\s*([^\n]+)/i)?.[1]||'').trim();
 if(!original)return '';
 let raw=original.replace(/ФЗ\s*№?\s*22-ФЗ/i,'ФЗ о ФСО').replace(/ФЗ\s*№?\s*86-ФЗ/i,'ФЗ о территориях');
 raw=raw.replace(/ч\.\s*(\d+)\.1\b/g,'ч. 1');
 raw=raw.replace(/ч\.\s*(\d+)\.(\d+)\b/g,(_,a,b)=>'ч. '+b);
 raw=raw.replace(/[·,]/g,' · ').replace(/\s*·\s*/g,' · ').replace(/(?:\s*·\s*){2,}/g,' · ').trim();
 // Citation might be stored as 'ст. 10 ч. 10.1 п. 2' from older cards.
 raw=raw.replace(/ст\.\s*(\d+)(?:\s*·\s*)ч\.\s*\1\.\s*(\d+)/i,(_,a,b)=>'ст. '+a+' · ч. '+b);
 return raw;
}
function getExactQuote(item){
 if(typeof item.quote==='string'&&item.quote.trim())return item.quote.trim();
 const body=String(item.body||'');
 const idx=body.indexOf(EXACT_MARKER);
 if(idx<0)return '';
 return body.slice(idx+EXACT_MARKER.length).trim();
}
function referenceItems(){return publicMaterials.filter(x=>x.sectionId==='reference'&&hasUsableNorm(x))}
function hasUsableNorm(item){const t=getExactQuote(item);if(t.length<28 || /^(?:справочн|пояснен|текст\s+статьи\s+пока)/iu.test(t))return false;const c=getReferenceCitation(item);const point=c.match(/п\.\s*(\d+)/i);if(point)return t.startsWith(point[1]+')');const article=c.match(/ст\.\s*(\d+(?:\.\d+)*)/i),part=c.match(/ч\.\s*(\d+)/i);if(article&&part)return t.startsWith(article[1]+'.'+part[1]+'.');return true}
function matchingReferences(items){
 const needle=$('reference-search').value.trim().toLocaleLowerCase('ru-RU');
 return items.filter(item=>{
  const cats=Array.isArray(item.categories)?item.categories:[];
  if(referenceFilter!=='all'&&!cats.includes(referenceFilter))return false;
  return !needle||[item.title,item.summary,getReferenceCitation(item),getExactQuote(item)].join(' ').toLocaleLowerCase('ru-RU').includes(needle);
 });
}
function renderReference(){
 const everything=referenceItems();
 const query=$('reference-search').value.trim();
 const all=referenceAllMode||query?everything:everything.filter(x=>x.editorialPriority==='core').sort((a,b)=>referencePriorityOrder.indexOf(a.id)-referencePriorityOrder.indexOf(b.id));
 const filtered=matchingReferences(all),filters=$('reference-filters'),list=$('reference-list');
 $('ref-core').classList.toggle('active',!referenceAllMode);$('ref-all').classList.toggle('active',referenceAllMode);
 filters.replaceChildren();list.replaceChildren();
 for(const cat of [{id:'all',title:'Все'},...referenceCategories]){
  const count=cat.id==='all'?all.length:all.filter(item=>(Array.isArray(item.categories)?item.categories:[]).includes(cat.id)).length;
  const b=document.createElement('button');b.type='button';b.className='reference-filter'+(referenceFilter===cat.id?' active':'');b.setAttribute('aria-pressed',String(referenceFilter===cat.id));
  const label=document.createElement('strong');label.textContent=cat.title;
  const num=document.createElement('span');num.textContent=String(count);b.append(label,num);
  b.addEventListener('click',()=>{referenceFilter=cat.id;renderReference()});filters.append(b);
 }
 $('reference-count').textContent=filtered.length+' из '+all.length+(all.length!==everything.length?' · всего '+everything.length:'');
 if(!filtered.length){const empty=document.createElement('div');empty.className='reference-empty';empty.textContent=all.length?'По запросу ничего не найдено.':'Проверенных оснований пока нет.';list.append(empty);return}
 for(const item of filtered){
  const external=item.status==='source-linked'&&!getExactQuote(item);
  const button=document.createElement('button');
  button.type='button';button.setAttribute('aria-haspopup','dialog');
  button.className='reference-entry'+(external?' reference-entry-summary':'');
  const left=document.createElement('div');left.className='reference-entry-main';
  const heading=document.createElement('b');heading.textContent=item.title||'Основание';
  const desc=document.createElement('span');desc.className='ref-summary';desc.textContent=item.summary||'';
  left.append(heading,desc);
  const citation=document.createElement('span');citation.className='reference-citation';citation.textContent=getReferenceCitation(item);
  button.append(left,citation);button.addEventListener('click',()=>openReference(item,button));list.append(button);
 }
}
function renderReferenceModal(item){
 const wrap=document.createElement('div');
 const title=document.createElement('h2');title.id='reference-modal-title';title.textContent=item.title;wrap.append(title);
 const citation=document.createElement('div');citation.className='ref-citation-line';citation.textContent=item.fullCitation||getReferenceCitation(item);wrap.append(citation);wrap.append(bookmarkButton('ref',item.id,'reference-fav'));
  const norm=document.createElement('div');norm.className='ref-law-text';
  const exact=getExactQuote(item);
  if(exact){norm.textContent=exact;}
  else {
   const label=document.createElement('strong');label.className='reference-editorial-label';label.textContent='Справочное изложение — не текст закона';
   const content=document.createElement('p');content.textContent=item.summary||'Для данного основания нет подтверждённого текста.';
   norm.append(label,content);
  }
  wrap.append(norm);
 if(/^https:\/\/forum\.rmrp\.ru\/threads\//.test(item.sourceUrl||'')){
  const a=document.createElement('a');a.className='ref-source';a.href=item.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Первоисточник на форуме';wrap.append(a);
 }
 return wrap;
}
function openReference(item,trigger){
 const overlay=$('reference-overlay'),body=$('reference-modal-body');if(!overlay||!body)return;
 referencePreviousFocus=trigger||document.activeElement;
 body.replaceChildren(renderReferenceModal(item));
 overlay.hidden=false;overlay.setAttribute('aria-hidden','false');overlay.classList.add('open');document.body.classList.add('reference-dialog-open');
 $('reference-close').focus({preventScroll:true});
}
let referencePreviousFocus=null;
function closeReference(){
 const overlay=$('reference-overlay');if(!overlay||overlay.hidden)return;
 overlay.classList.remove('open');overlay.hidden=true;
 overlay.setAttribute('aria-hidden','true');
 document.body.classList.remove('reference-dialog-open');
 if(referencePreviousFocus?.isConnected)referencePreviousFocus.focus({preventScroll:true});
 referencePreviousFocus=null;
}
$('ref-core').addEventListener('click',()=>{referenceAllMode=false;renderReference()});
$('ref-all').addEventListener('click',()=>{referenceAllMode=true;renderReference()});
$('reference-search').addEventListener('input',renderReference);
$('reference-close').addEventListener('click',closeReference);
$('reference-overlay').addEventListener('click',e=>{ if(e.target===$('reference-overlay')) closeReference(); });
document.addEventListener('keydown',e=>{
 const overlay=$('reference-overlay');if(overlay.hidden)return;
 if(e.key==='Escape'){e.preventDefault();closeReference();return}
 if(e.key==='Tab'){
  const controls=[...overlay.querySelectorAll('button:not([disabled]),a[href]')];
  if(!controls.length)return;
  const first=controls[0],last=controls[controls.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }
});
const nav=$('rail').querySelector('.rail-nav');

function addStepContent(container,item){
 if(!Array.isArray(item.steps))return false;
 const steps=document.createElement('div');steps.className='scenario-native-steps';
 item.steps.forEach((stage,i)=>{
  const box=document.createElement('section');box.className='scenario-native-step';
  const h=document.createElement('h3');h.textContent=(i+1)+'. '+stage.title;box.append(h);
  const a=document.createElement('p');a.className='scenario-native-action';a.textContent='Действие: '+stage.action;box.append(a);
  const e=document.createElement('p');e.className='scenario-native-reason';e.textContent='Основание и смысл: '+stage.explain;box.append(e);
  (stage.norms||[]).forEach(n=>{
   const details=document.createElement('details');details.className='scenario-native-law';
   const summary=document.createElement('summary');summary.textContent=n.citation+' · раскрыть норму';details.append(summary);
   const pre=document.createElement('div');pre.className='scenario-native-verbatim';pre.textContent=n.text;details.append(pre);box.append(details);
  });
  steps.append(box);
 });container.append(steps);return true;
}

const detentionHints={
 'Основание':'Отдельно проверь место, факты и конкретную норму. Не смешивай охранные полномочия с общим правом на задержание.',
 'Проверить вид задержания':'Срок считается с фактического задержания. Ограничение в 60 минут не переносится на предварительное задержание, для которого указан отдельный срок.',
 'Сообщить причину':'Указывай конкретное предполагаемое деяние и статью. Процессуальные действия выполняются только в пределах компетенции.',
 'Обеспечить права':'Проверь, кто проводит процессуальное задержание, где реализуются отдельные права и какая очередность предусмотрена ПК.',
 'Госслужащий или адвокат':'Проверь особый порядок и полномочия органа прежде, чем продолжать процессуальные действия.',
 'Передача':'Сохрани сведения о фактах и доступные материалы, включая видео, чтобы передать их уполномоченному органу.'
};
let detentionObserver=null;
function renderDetention(){
 const list=$('detention-steps'),nav=$('detention-nav'),extra=$('detention-extra');
 list.replaceChildren();nav.replaceChildren();extra.replaceChildren();
 if(detentionObserver){detentionObserver.disconnect();detentionObserver=null;}
 const detItems=publicMaterials.filter(x=>x.sectionId==='detention');
 const guide=detItems.find(x=>Array.isArray(x.steps)&&x.steps.length);
 if(!guide){const empty=document.createElement('p');empty.className='det-step-card';empty.textContent='Этапы задержания пока не добавлены.';list.append(empty);return;}
 const buttons=[];
 (guide.steps||[]).forEach((step,i)=>{
  const section=document.createElement('section');section.className='det-step';section.id='det-step-'+(i+1);
  const number=document.createElement('div');number.className='det-step-index';number.setAttribute('aria-hidden','true');number.textContent=String(i+1).padStart(2,'0');section.append(number);
  const card=document.createElement('article');card.className='det-step-card';
  const kicker=document.createElement('div');kicker.className='det-step-topline';kicker.textContent='Этап '+String(i+1).padStart(2,'0');card.append(kicker);
  const h=document.createElement('h2');h.textContent=step.title;card.append(h);
  const action=document.createElement('p');action.className='det-step-action';action.textContent=step.action||'';card.append(action);
  if(step.explain){const reason=document.createElement('p');reason.className='det-step-reason';reason.textContent=step.explain;card.append(reason)}
  if(detentionHints[step.title]){const hint=document.createElement('div');hint.className='det-hint';const label=document.createElement('b');label.textContent='Подсказка';hint.append(label,document.createTextNode(detentionHints[step.title]));card.append(hint)}
  if(Array.isArray(step.norms)&&step.norms.length){
   const norms=document.createElement('div');norms.className='det-norms';const label=document.createElement('div');label.className='det-norms-heading';label.textContent='Правовое основание · точный текст';norms.append(label);
   step.norms.forEach(n=>{const box=document.createElement('div');box.className='det-norm';const cite=document.createElement('cite');cite.textContent=n.citation||'Норма';const quote=document.createElement('p');quote.className='det-norm-text';quote.textContent=n.text||'';box.append(cite,quote);norms.append(box)});
   card.append(norms);
  }
  section.append(card);list.append(section);
  const btn=document.createElement('button');btn.type='button';btn.className=i===0?'active':'';
  const num=document.createElement('span');num.className='det-nav-num';num.textContent=String(i+1).padStart(2,'0');const text=document.createElement('span');text.textContent=step.title;btn.append(num,text);
  btn.addEventListener('click',()=>{section.scrollIntoView({behavior:'smooth',block:'start'});buttons.forEach(b=>b.classList.remove('active'));btn.classList.add('active')});nav.append(btn);buttons.push(btn);
 });
 if('IntersectionObserver' in window){detentionObserver=new IntersectionObserver((entries)=>{for(const entry of entries){if(entry.isIntersecting){const ix=(guide.steps||[]).findIndex((_,i)=>entry.target.id==='det-step-'+(i+1));if(ix>=0)buttons.forEach((b,j)=>b.classList.toggle('active',j===ix))}}},{rootMargin:'-5% 0px -70% 0px',threshold:0});list.querySelectorAll('.det-step').forEach(x=>detentionObserver.observe(x));}
 const other=detItems.filter(x=>x!==guide);extra.hidden=!other.length;
 for(const item of other){const article=document.createElement('article');const h=document.createElement('h3');h.textContent=item.title;article.append(h);if(item.summary){const p=document.createElement('p');p.textContent=item.summary;article.append(p)}if(Array.isArray(item.steps)){
   for(const stage of item.steps){const title=document.createElement('h4');title.textContent=stage.title;article.append(title);const action=document.createElement('p');action.textContent=stage.action||'';article.append(action);if(stage.explain){const reason=document.createElement('p');reason.textContent=stage.explain;article.append(reason)}for(const n of stage.norms||[]){const norm=document.createElement('div');norm.className='det-norm';const citation=document.createElement('cite');citation.textContent=n.citation||'';const txt=document.createElement('p');txt.className='det-norm-text';txt.textContent=n.text||'';norm.append(citation,txt);article.append(norm)}}
  }else{const p=document.createElement('p');p.textContent=item.body||'';article.append(p)}extra.append(article)}
}
document.addEventListener('click',event=>{
 const shortcut=event.target.closest('[data-det-step]');if(!shortcut)return;
 const step=Number(shortcut.dataset.detStep)+1;go('detention');
 requestAnimationFrame(()=>{$('det-step-'+step)?.scrollIntoView({behavior:'smooth',block:'start'})});
});


// «Понятия». Все определения видны сразу, никаких раскрывающихся карточек.
function renderConcepts(){
 const items=publicMaterials.filter(x=>x.sectionId==='concepts');
 const wrap=$('material-list');
 wrap.replaceChildren();
 wrap.hidden=items.length===0;
 $('empty-panel').hidden=items.length!==0;
 wrap.classList.add('concept-list');
 for(const entry of items){
  const article=document.createElement('article');
  article.className='concept-entry';
  article.id='concept-'+entry.id;
  const title=document.createElement('h2');
  title.className='concept-title';
  title.textContent=entry.title;
  const text=document.createElement('p');
  text.className='concept-text';
  text.textContent=entry.body||'';
  const footer=document.createElement('div');
  footer.className='concept-footer';
  const source=document.createElement('div');
  source.className='concept-source';
  source.textContent=entry.summary||'';
  if(entry.sourceUrl && /^https:\/\//i.test(entry.sourceUrl)){
   const link=document.createElement('a');
   link.href=entry.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';
   link.textContent='Источник';
   if(source.textContent)source.append(' · ');
   source.append(link);
  }
  footer.append(source,bookmarkButton('concept',entry.id));
  article.append(title,text,footer);
  wrap.append(article);
 }
}

function renderMaterials(page){
 const items=publicMaterials.filter(x=>x.sectionId===page),wrap=$('material-list');
 wrap.classList.remove('concept-list');
 wrap.replaceChildren();wrap.hidden=items.length===0;$('empty-panel').hidden=items.length!==0;
 items.forEach(x=>{
  const article=document.createElement('details');article.className='material-card';
  const summary=document.createElement('summary');summary.textContent=x.title;article.append(summary);
  const inner=document.createElement('div');inner.className='material-body';
  if(x.summary){const teaser=document.createElement('p');teaser.className='material-summary';teaser.textContent=x.summary;inner.append(teaser)}
  if(!addStepContent(inner,x)){const body=document.createElement('div');body.className='material-text';body.textContent=x.body||'';inner.append(body);}
  if(x.sourceUrl && /^https:\/\//i.test(x.sourceUrl)){
   const link=document.createElement('a');link.href=x.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.className='material-source';link.textContent='Источник';inner.append(link)
  }
  inner.append(bookmarkButton(page==='situations'?'situation':'concept',x.id));article.append(inner);wrap.append(article);
 });
}
async function loadPublic(){
 const url=currentApiUrl();if(!/^https:\/\//.test(url))return;
 try{
  const response=await fetch(url+'?action=public',{cache:'no-store'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const info=await response.json();if(!info.ok)throw new Error(info.error||'API');
  // Серверные карточки остаются доступны; встроенные проверенные карточки работают всегда.
  const remoteItems=Array.isArray(info.items)?info.items:[];
  const localIds=new Set([...embeddedReferences,...localExtraMaterials].map(x=>x.id));
  const localCitations=new Set(embeddedReferences.map(x=>getReferenceCitation(x).toLocaleLowerCase('ru-RU')));
  publicMaterials=[...embeddedReferences,...localExtraMaterials,
   ...remoteItems.filter(x=>!localIds.has(x.id)&&(x.sectionId!=='reference'||(getExactQuote(x)&&!localCitations.has(getReferenceCitation(x).toLocaleLowerCase('ru-RU')))))];
  renderReference();
  if(location.hash==='#situations')renderScenarioCatalog();
  renderLawList();
  updatePortalStats();
  const allowed=new Set(), homeButton=nav.querySelector('[data-page="home"]');
  // Локальные разделы не должны исчезать, когда сервер возвращает только разделы API.
  const builtInPages=new Set(['home','situations','reference','concepts','detention','territories','escort','favorites','quiz','posts','laws']);
  const sorted=[...(info.sections||[])].filter(s=>s.visible).sort((a,b)=>a.order-b.order);
  for(const item of sorted){
   if(!item.id || !/^[a-z0-9-]{1,80}$/.test(item.id))continue;
   const existing=sections[item.id];
   if(!builtInPages.has(item.id)) sections[item.id]={title:item.title,description:item.description||'',keys:existing?.keys||[]};
   let button=nav.querySelector('[data-page="'+item.id+'"]');
   if(!button){button=document.createElement('button');button.className='rail-button';button.dataset.page=item.id;const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('class','icon');icon.setAttribute('aria-hidden','true');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#i-file');icon.append(use);button.append(icon);const label=document.createElement('span');button.append(label)}
   if(!builtInPages.has(item.id)){button.querySelector('span').textContent=item.title;button.setAttribute('aria-label',item.title);button.title=item.title;nav.append(button)}
   allowed.add(item.id);
  }
  for(const button of [...nav.querySelectorAll('[data-page]')]){if(!builtInPages.has(button.dataset.page)&&!allowed.has(button.dataset.page)){button.remove();delete sections[button.dataset.page]}}
  if(homeButton)nav.prepend(homeButton);
  document.querySelectorAll('.feature[data-page]').forEach(el=>{el.hidden=!allowed.has(el.dataset.page)});
  const page=decodeURIComponent(location.hash.slice(1))||'home';go(page);
 }catch(e){console.warn('Не удалось загрузить материалы памятки:',e.message)}
}
const themeKey='fso-rmrp-theme';
function applyTheme(theme){
 const choice=theme==='light'?'light':'dark';
 document.documentElement.dataset.theme=choice;
 $('theme-meta').content=choice==='light'?'#eef3f8':'#0d1219';
 $('theme-toggle').setAttribute('aria-label',choice==='dark'?'Включить светлую тему':'Включить тёмную тему');
 $('theme-label').textContent=choice==='dark'?'Светлая тема':'Тёмная тема';
 try{localStorage.setItem(themeKey,choice)}catch(e){}
}
let savedTheme='dark';
try{savedTheme=localStorage.getItem(themeKey)||'dark'}catch(e){}
applyTheme(savedTheme);
$('theme-toggle').addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
// Логотип не обязателен: если файла нет, отображается встроенный значок щита.
const probe=new Image();probe.onload=()=>{$('brand-mark').classList.add('has-image')};probe.src='./assets/logo.png';

let scenarioFilter='Все';
function renderScenarioCatalog(){
 const list=$('scenario-list'),filters=$('scenario-categories');
 const all=localExtraMaterials.filter(x=>x.sectionId==='situations'&&Array.isArray(x.steps));
 const cats=['Все',...new Set(all.map(x=>x.category).filter(Boolean))];
 if(!cats.includes(scenarioFilter))scenarioFilter='Все';
 filters.replaceChildren();
 for(const cat of cats){const b=document.createElement('button');b.type='button';b.textContent=cat;
  b.className=cat===scenarioFilter?'active':'';
  b.addEventListener('click',()=>{scenarioFilter=cat;renderScenarioCatalog()});filters.append(b)}
 const text=$('scenario-find').value.trim().toLowerCase();
 const filtered=all.filter(x=>(scenarioFilter==='Все'||x.category===scenarioFilter)&&(!text||[x.title,x.summary,x.context,x.checks,x.avoid,...x.steps.map(z=>z.title+' '+z.action+' '+z.norms.map(n=>n.citation).join(' '))].join(' ').toLowerCase().includes(text)));
 $('scenario-total').textContent=String(all.length);list.replaceChildren();
 if(!filtered.length){const p=document.createElement('p');p.className='reference-empty';p.textContent='По запросу ситуации не найдены.';list.append(p);return}
 for(let i=0;i<filtered.length;i++){
  const x=filtered[i],item=document.createElement('details');item.className='scenario-case';
  const head=document.createElement('summary');const nr=document.createElement('span');nr.className='scenario-num';nr.textContent=String(i+1).padStart(2,'0');
  const main=document.createElement('span'),title=document.createElement('span'),desc=document.createElement('span');title.className='scenario-title';title.textContent=x.title;desc.className='scenario-subtitle';desc.textContent=x.summary;main.append(title,desc);
  head.append(nr,main);item.append(head);
  const body=document.createElement('div');body.className='scenario-body';
  function info(cls,label,content){const box=document.createElement('div');box.className=cls;const strong=document.createElement('strong');strong.textContent=label;const p=document.createElement('span');p.textContent=content||'';box.append(strong,p);return box}
  body.append(info('scenario-context','Что произошло',x.context));
  const infoGrid=document.createElement('div');infoGrid.className='scenario-info-grid';infoGrid.append(info('scenario-info','Что необходимо выяснить',x.checks),info('scenario-info warn','Чего не делать',x.avoid));body.append(infoGrid);
  const lead=document.createElement('h2');lead.className='scenario-subhead';lead.textContent='Порядок действий';body.append(lead);
  const stack=document.createElement('div');stack.className='scenario-steps';
  for(let j=0;j<x.steps.length;j++){
   const step=x.steps[j],row=document.createElement('div');row.className='scenario-stage';const idx=document.createElement('span');idx.className='scenario-stepno';idx.textContent=String(j+1).padStart(2,'0');row.append(idx);
   const panel=document.createElement('div');const h=document.createElement('h3');h.textContent=step.title;panel.append(h);
   const act=document.createElement('p');act.className='scenario-action';act.textContent=step.action;panel.append(act);
   const exp=document.createElement('p');exp.className='scenario-explain';exp.textContent=step.explain;panel.append(exp);
   const norms=document.createElement('div');norms.className='scenario-normline';
   for(const n of step.norms||[]){const d=document.createElement('details');const sum=document.createElement('summary');sum.textContent=n.citation;d.append(sum);
    const quote=document.createElement('blockquote');quote.textContent=n.text;d.append(quote);
    if(/^https:\/\/forum\.rmrp\.ru\/threads\//.test(n.sourceUrl||'')){const a=document.createElement('a');a.href=n.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Сверить с форумом RMRP';d.append(a)}norms.append(d)}
   panel.append(norms);row.append(panel);stack.append(row);
  }
  body.append(stack,info('scenario-result','Итог',x.outcome));
  body.append(bookmarkButton('situation',x.id));item.append(body);list.append(item);
 }
}
$('scenario-find').addEventListener('input',renderScenarioCatalog);

function go(page){
 closeReference();
 if(!Object.prototype.hasOwnProperty.call(sections,page))page='home';
 const home=page==='home',isLaws=page==='laws',isReference=page==='reference',isDetention=page==='detention';
  const custom=['territories','escort','posts','favorites','quiz','situations'];
  $('home-screen').hidden=!home;$('section-screen').hidden=home||isLaws||isReference||isDetention||custom.includes(page);$('law-screen').hidden=!isLaws;$('reference-screen').hidden=!isReference;$('detention-screen').hidden=!isDetention;
  custom.forEach(id=>$(id+'-screen').hidden=page!==id);
  if(isReference){renderReference()}
  else if(page==='situations'){renderScenarioCatalog()}
  else if(isLaws){renderLawList();if(!selectedLaw&&lawCatalog.length)openLaw(lawCatalog[0].id)}
  else if(isDetention){renderDetention()}
  else if(page==='territories'){renderTerritories()}
  else if(page==='escort'){renderEscort()}
  else if(page==='favorites'){renderFavorites()}
  else if(page==='posts'){renderServiceTab('posts')}
  else if(!home){$('section-title').textContent=sections[page].title;$('section-description').textContent=sections[page].description;if(page==='concepts')renderConcepts();else renderMaterials(page)}
 document.querySelectorAll('[data-page]').forEach(el=>{
  const active=el.dataset.page===page;
  el.classList.toggle('active',active);
  if(el.classList.contains('rail-button')){if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')}
 });
 if(location.hash!=='#'+page)history.replaceState(null,'','#'+page);
 document.title=(home?'ФСО / RMRP — Тверской':sections[page].title+' — ФСО / RMRP');
 window.scrollTo({top:0,behavior:'instant'});
 $('search-results').hidden=true;
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(button)go(button.dataset.page)});
function matchingSections(query){
 const q=query.trim().toLocaleLowerCase('ru-RU');
 if(!q)return[];
 return Object.keys(sections).filter(id=>id!=='home'&&[sections[id].title,...sections[id].keys].some(x=>x.toLocaleLowerCase('ru-RU').includes(q)));
}
// Search not only menu headings but the exact norm, title of an actual law and scenario.
function portalSearchIndex(){
 const result=[];
 for(const id of Object.keys(sections))if(id!=='home')result.push({type:'section',title:sections[id].title,subtitle:'Раздел памятки',terms:[sections[id].title,...sections[id].keys].join(' '),id});
 for(const it of publicMaterials){
  const type=it.sectionId==='reference'?'reference':(it.sectionId==='situations'?'situation':(it.sectionId==='concepts'?'concept':'other'));
  if(type==='other')continue;
  const text=type==='reference'?getExactQuote(it):String(it.body||'')+(Array.isArray(it.steps)?it.steps.map(x=>[x.title,x.action].join(' ')).join(' '):'');
  result.push({type,id:it.id,title:it.title,subtitle:type==='reference'?getReferenceCitation(it):sections[it.sectionId]?.title||'',terms:[it.title,it.summary||'',type==='reference'?getReferenceCitation(it):'',text].join(' ').slice(0,20000)});
 }
 for(const doc of lawRecords())result.push({type:'law',id:doc.id,title:doc.title,subtitle:'Полный текст документа',terms:doc.title+' '+(doc.title.includes('Процессуальн')?'ПК ':doc.title.includes('Уголовн')?'УК ':'')});
 return result;
}
function portalSearchHits(query){
 const terms=query.trim().toLocaleLowerCase('ru-RU').split(/\s+/).filter(Boolean);
 if(!terms.length)return[];
 return portalSearchIndex().map(it=>{
  const head=(it.title+' '+it.subtitle).toLocaleLowerCase('ru-RU');
  const hay=it.terms.toLocaleLowerCase('ru-RU');
  if(!terms.every(term=>hay.includes(term)))return null;
  const score=terms.reduce((sum,term)=>sum+(head.includes(term)?5:1),0)+(it.type==='reference'?1:0);
  return {...it,score};
 }).filter(Boolean).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'ru')).slice(0,18);
}
function openPortalHit(it){
 if(it.type==='section'){go(it.id);return}
 if(it.type==='reference'){go('reference');const item=publicMaterials.find(x=>x.id===it.id);if(item)openReference(item);return}
 if(it.type==='law'){go('laws');openLaw(it.id);return}
 if(it.type==='situation'||it.type==='concept'){
  const section=it.type==='situation'?'situations':'concepts';go(section);
  const group=publicMaterials.filter(x=>x.sectionId===section),idx=group.findIndex(x=>x.id===it.id);
  const box=$('material-list').querySelectorAll(section==='concepts'?'.concept-entry':'.material-card')[idx];if(box){if(section!=='concepts')box.open=true;box.scrollIntoView({block:'start',behavior:'smooth'})}
 }
}
function showSearchResults(){
 const query=$('section-search').value,items=portalSearchHits(query),panel=$('search-results');
 panel.replaceChildren();
 if(!query.trim()){panel.hidden=true;$('search-hint').textContent='Поиск по статьям, ситуациям, понятиям, названиям законов и разделам.';return}
 if(!items.length){panel.hidden=true;$('search-hint').textContent='Ничего не найдено. Уточните запрос или попробуйте другое слово.';return}
 $('search-hint').textContent=items.length===18?'Показаны первые 18 результатов. Уточните запрос для более точного поиска.':'Найдено материалов: '+items.length;
 for(const it of items){
  const b=document.createElement('button');b.type='button';
  const head=document.createElement('b');head.textContent=it.title;
  const sub=document.createElement('small');sub.textContent=it.subtitle;
  b.append(head,sub);b.addEventListener('click',()=>openPortalHit(it));panel.append(b);
 }
 panel.hidden=false;
}
$('section-search').addEventListener('input',showSearchResults);
$('section-search-form').addEventListener('submit',event=>{
 event.preventDefault();const items=portalSearchHits($('section-search').value);
 if(items.length===1)openPortalHit(items[0]);else{showSearchResults();if(!items.length)$('section-search').focus()}
});
for(const chip of document.querySelectorAll('[data-search-query]'))chip.addEventListener('click',()=>{
 $('section-search').value=chip.dataset.searchQuery;showSearchResults();$('section-search').focus({preventScroll:true});$('section-search').scrollIntoView({block:'center',behavior:'smooth'});
});
for(const card of document.querySelectorAll('[data-reference-id]'))card.addEventListener('click',()=>{
 const item=publicMaterials.find(x=>x.id===card.dataset.referenceId);if(!item)return;
 go('reference');openReference(item,card);
});
for(const card of document.querySelectorAll('[data-situation-id]'))card.addEventListener('click',()=>openPortalHit({type:'situation',id:card.dataset.situationId}));
for(const card of document.querySelectorAll('[data-law-id]'))card.addEventListener('click',()=>{go('laws');openLaw(card.dataset.lawId)});
function updatePortalStats(){
 $('portal-ref-count').textContent=referenceItems().length;
 $('portal-sit-count').textContent=publicMaterials.filter(it=>it.sectionId==='situations').length;
 $('portal-law-count').textContent=lawRecords().length;
}
document.addEventListener('keydown',event=>{
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
  event.preventDefault();go('home');$('section-search').focus();$('section-search').scrollIntoView({block:'center',behavior:'smooth'});
 }
 if(event.key==='Escape'&&document.activeElement===$('section-search')){$('section-search').blur();$('search-results').hidden=true}
});

const INTERNAL_DOCUMENT_IDS={
 'https://forum.rmrp.ru/threads/federalnyj-zakon-o-federalnoj-sluzhbe-oxrany-no-22-fz.25069/':'law-25069',
 'https://forum.rmrp.ru/threads/federalnyj-zakon-o-gosudarstvennoj-sobstvennosti-zakrytyx-i-oxranjaemyx-territorijax-no-86-fz.26625/':'law-26625',
 'https://forum.rmrp.ru/threads/processualnyj-kodeks-rossijskoj-federacii.58424/':'law-58424',
 'https://forum.rmrp.ru/threads/ugolovnyj-kodeks-rossijskoj-federacii.58209/':'law-58209',
 'https://forum.rmrp.ru/threads/kodeks-ob-administrativnyx-pravonarushenijax-rossijskoj-federacii.58229/':'law-58229'
};
// Prepared read-only collection. Only existing quote fields are presented as verbatim.
function lawIndexMaterials(id){
 return embeddedReferences.filter(x=>INTERNAL_DOCUMENT_IDS[x.sourceUrl]===id);
}
function hasLawSummary(id){return lawIndexMaterials(id).length>0}
const embeddedFullLaws=window.FSO_FULL_LAW_DOCS || {};
for(const [id,txt] of Object.entries(embeddedFullLaws)){
 if(typeof txt==='string' && txt.trim())referenceLawCache.set(id,txt);
}
const pdfLawCatalog=window.FSO_PDF_LAW_CATALOG || [];
const lawCatalog=[...pdfLawCatalog,...(Array.isArray(window.FSO_LAW_CATALOG)?window.FSO_LAW_CATALOG:[]).filter(x=>!pdfLawCatalog.some(d=>d.id===x.id))];
const lawLabels={all:'Все',code:'Кодексы',fkz:'ФКЗ',federal:'ФЗ',charter:'Уставы',order:'Приказы'};
let lawFilter='all',selectedLaw='',lawBody='',lawFind='';
let staticLawManifest={};
async function loadStaticLawManifest(){
 try{
  const result=await fetch('./laws-data/manifest.json',{cache:'no-store'});
  if(!result.ok)throw new Error('Манифест не используется: законы могут быть встроены в HTML');
  const data=await result.json();
  staticLawManifest=(data&&data.documents&&typeof data.documents==='object')?data.documents:{};
  renderLawList();
  if(selectedLaw && lawRecords().some(x=>x.id===selectedLaw)){await openLaw(selectedLaw)}
 }catch(error){console.warn('Каталог локальных законов:',error.message)}
}
function lawRecords(){
 const map=new Map(lawCatalog.filter(x=>referenceLawCache.has(x.id)||!!staticLawManifest[x.id]).map(x=>[x.id,{...x,loaded:true}]));
 for(const it of publicMaterials.filter(x=>x.sectionId==='laws')){
  if(!map.has(it.id) && (referenceLawCache.has(it.id)||!!staticLawManifest[it.id]))map.set(it.id,{id:it.id,title:it.title,category:'federal',sourceUrl:it.sourceUrl,loaded:true});
 }
 return [...map.values()];
}
function renderLawList(){
 const holder=$('law-list'),filters=$('law-filters'),query=$('law-search').value.trim().toLocaleLowerCase('ru-RU');
 filters.replaceChildren();holder.replaceChildren();
 for(const [key,label] of Object.entries(lawLabels)){
  const b=document.createElement('button');b.type='button';b.className='law-filter'+(lawFilter===key?' active':'');b.textContent=label;b.addEventListener('click',()=>{lawFilter=key;renderLawList()});filters.append(b);
 }
 const records=lawRecords().filter(x=>(lawFilter==='all'||x.category===lawFilter)&&(!query||x.title.toLocaleLowerCase('ru-RU').includes(query)));
 $('law-count').textContent=records.length?records.length+' полных документов':'Нет перенесённых полных документов';if(!lawRecords().length){$('law-title').textContent='Полные тексты пока отсутствуют';$('law-note').textContent='В предоставленном index.html нет полного текста ни одного закона. Отдельные пункты из справочника не заменяют законодательство.';$('law-note').hidden=false;}
 for(const x of records){
  const b=document.createElement('button');b.type='button';b.className='law-entry'+(selectedLaw===x.id?' active':'');
  b.dataset.lawId=x.id;
  const title=document.createElement('b');title.textContent=x.title;
  const status=document.createElement('small');status.textContent=x.loaded?'Полный текст':'Нет полного текста';
  b.append(title,status);b.addEventListener('click',()=>openLaw(x.id));holder.append(b);
 }
}
function textMark(target,text,query){
 if(!query){target.textContent=text;return}
 const lower=text.toLocaleLowerCase('ru-RU'),q=query.toLocaleLowerCase('ru-RU');let start=0,pos=0;
 while((pos=lower.indexOf(q,start))!==-1){target.append(document.createTextNode(text.slice(start,pos)));const m=document.createElement('mark');m.textContent=text.slice(pos,pos+query.length);target.append(m);start=pos+query.length}
 target.append(document.createTextNode(text.slice(start)));
}
// Documents are plain text, but displayed semantically: chapters, articles and
// paragraphs. Empty lines are separators, never separate blank DIVs.
function lawTextQuality(text){
 const rows=text.replace(/\r\n?/g,'\n').split('\n').map(s=>s.trim());
 const starts=[];
 rows.forEach((x,i)=>{if(/^Статья\s+\d+(?:[.\-]\d+)*(?:[.\s:–—-]|$)/iu.test(x))starts.push(i)});
 if(!starts.length)return {ok:text.trim().length>=900,articles:0,empty:0};
 let empty=0,volume=0;
 starts.forEach((idx,i)=>{
  const part=rows.slice(idx+1,starts[i+1]??rows.length).filter(s=>!/^Глава\s+|^Раздел\s+/iu.test(s)).join(' ').trim();
  volume+=part.length;
  if(part.length<12)empty++;
 });
 return {ok:text.length>=400 && empty/starts.length<=.12 && volume>=starts.length*32,articles:starts.length,empty};
}
function drawLawText(){
 const nav=$('law-article-nav'),wrap=$('law-document'),term=$('law-text-search').value.trim();
 nav.replaceChildren();wrap.replaceChildren();
 if(!lawBody)return;
 const lines=lawBody.replace(/\r\n?/g,'\n').split('\n');
 let hits=0,serial=0;
 const frag=document.createDocumentFragment();
 let article=null;
 for(const raw of lines){
  const line=raw.trim();
  if(!line)continue;
  const chapter=/^(?:Глава\s+[IVXLC\d]+|Раздел\s+[IVXLC\d]+)(?:[.\s:–—-]|$)/iu.test(line);
  const heading=/^Статья\s+\d+(?:[.\-]\d+)*(?:[.\s:–—-]|$)/iu.test(line);
  if(chapter)article=null;
  let el;
  if(chapter||heading){
   if(heading){article=document.createElement('section');article.className='law-article-block';frag.append(article)}
   el=document.createElement(chapter?'h2':'h3');
   el.className=chapter?'law-chapter':'law-article';
   el.id='law-heading-'+(++serial);
   const btn=document.createElement('button');btn.type='button';btn.textContent=line.slice(0,90);
   btn.title=line;btn.addEventListener('click',()=>el.scrollIntoView({behavior:'smooth',block:'start'}));nav.append(btn);
  }else{
   el=document.createElement('p');el.className='law-paragraph';
   if(/^(?:\d+(?:\.\d+)*[.)]|[а-яё][)])\s+/iu.test(line))el.classList.add('law-point');
  }
  if(term)hits+=line.toLocaleLowerCase('ru-RU').split(term.toLocaleLowerCase('ru-RU')).length-1;
  textMark(el,line,term);
  (heading?article:(article||frag)).append(el);
 }
 wrap.append(frag);
 $('law-match-count').textContent=term?'Совпадений: '+hits:'';
 const q=lawTextQuality(lawBody),note=$('law-note');
 if(!q.ok){
  note.hidden=false;
  note.textContent='Неполная копия: у отдельных статей отсутствует текст. Такой документ нельзя считать полным законом.';
  note.classList.add('law-warning');
 }else{
  note.hidden=true;note.classList.remove('law-warning');
 }
}
async function fetchStaticLaw(id){
 const cached=referenceLawCache.get(id);if(typeof cached==='string'&&cached.trim())return cached;
 const x=staticLawManifest[id];if(!x)throw new Error('Текст не найден в каталоге');
 let path=typeof x==='string'?x:String(x.path||x.file||'');
 if(!/^laws-data\/[a-z0-9_./-]+$/i.test(path)||path.includes('..'))throw new Error('Некорректный путь к документу');
 const res=await fetch('./'+path,{cache:'no-store'});
 if(!res.ok)throw new Error('HTTP '+res.status);
 const txt=await res.text();if(txt.trim().length<100)throw new Error('Файл документа пустой');
 referenceLawCache.set(id,txt);return txt;
}
async function openLaw(id){
 const x=lawRecords().find(i=>i.id===id);if(!x)return;
 selectedLaw=id;renderLawList();lawFind='';$('law-text-search').value='';
 $('law-title').textContent=x.title;
 const meta=$('law-meta');meta.replaceChildren();
 const kind=document.createElement('span');kind.textContent=lawLabels[x.category]||'Документ';meta.append(kind);meta.append(bookmarkButton('law',x.id,'law-fav'));
 if(x.sourceUrl&&/^https:\/\/forum\.rmrp\.ru\/threads\//.test(x.sourceUrl)){
  const a=document.createElement('a');a.href=x.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';a.className='law-source';a.textContent='Открыть на форуме ↗';meta.append(a);
 }
 const note=$('law-note');note.hidden=false;
 $('law-document-tools').hidden=true;$('law-article-nav').replaceChildren();$('law-document').replaceChildren();
  if(!x.loaded){
    lawBody='';note.textContent='Полный текст этого закона ещё не внесён. Отдельные выдержки из правового справочника не подменяют закон целиком.';
    note.classList.add('law-warning');return;
  }
  note.textContent='Загрузка текста…';
 try{
  const body=await fetchStaticLaw(id);
  if(selectedLaw!==id)return;
  lawBody=body;note.hidden=!!lawBody;
  note.textContent=lawBody?'':'Текст документа пуст';$('law-document-tools').hidden=!lawBody;drawLawText();
 }catch(err){note.hidden=false;note.textContent='Не удалось открыть текст: '+err.message}
}
$('law-search').addEventListener('input',renderLawList);
$('law-text-search').addEventListener('input',drawLawText);
$('law-clear-search').addEventListener('click',()=>{$('law-text-search').value='';drawLawText()});


// === Материалы для новых разделов: ссылки только на существующие точные нормы. ===
const territoryGroups=[
 {id:'types',name:'Виды территорий',refs:['ref-exact-territories-1-1-1','ref-exact-territories-1-1-2','ref-exact-territories-7-1-all']},
 {id:'kremlin',name:'Московский Кремль',refs:['ref-exact-territories-9-1-all','ref-exact-territories-9-2-all']},
 {id:'entry',name:'Пропускной режим',refs:['verified-26625-30-1-all','ref-exact-territories-30-2-all','verified-26625-31-3-1','verified-26625-31-3-2','verified-26625-31-3-3']},
 {id:'fso',name:'Полномочия ФСО',refs:['ref-exact-fso-10-1-2','ref-exact-fso-10-1-3','ref-exact-fso-10-1-4','ref-exact-fso-10-1-17']}
];
let territoryFilter='all';
function findRef(id){return publicMaterials.find(it=>it.id===id&&it.sectionId==='reference')}
function btn(text,cls,handler){const b=document.createElement('button');b.type='button';b.className=cls||'';b.textContent=text;b.addEventListener('click',handler);return b}
function normCard(item){
 const card=document.createElement('article');card.className='work-norm';
 const citation=document.createElement('small');citation.textContent=getReferenceCitation(item);
 const head=document.createElement('h3');head.textContent=item.title;
 const desc=document.createElement('p');desc.textContent=item.summary||'Точный текст нормы';
 const actions=document.createElement('div');actions.className='work-norm-actions';
 actions.append(btn('Читать норму ↗','work-primary',()=>openReference(item)),bookmarkButton('ref',item.id));
 card.append(citation,head,desc,actions);return card;
}
function renderTerritories(){
 const root=$('territories-screen');
 if(root.dataset.ready==='true')return;
 root.dataset.ready='true';
 const search=$('tg-object-query'),counter=$('tg-object-count'),groups=[...root.querySelectorAll('.tg-object-group')];
 const filterObjects=()=>{
  const q=search.value.trim().toLocaleLowerCase('ru-RU');let num=0;
  for(const group of groups){let visible=0;
   for(const li of group.querySelectorAll('[data-tg-object]')){
    const match=!q||(li.textContent+' '+li.dataset.tgObject).toLocaleLowerCase('ru-RU').includes(q);
    li.hidden=!match;if(match){num++;visible++}
   }
   group.hidden=visible===0;
  }
  counter.textContent=num+' из 13';
 };
 search.addEventListener('input',filterObjects);
 // Открываем именно встроенный в RMRP закон, без ссылок на статьи из РО.
 root.addEventListener('click',async event=>{
  const refButton=event.target.closest('button[data-territory-ref]');
  if(refButton){const norm=findRef(refButton.dataset.territoryRef);if(norm)openReference(norm,refButton);return}
  const button=event.target.closest('button[data-territory-law]');if(!button)return;
  const article=String(button.dataset.territoryLaw||'1');
  go('laws');await openLaw('law-26625');
  const heads=[...$('law-document').querySelectorAll('.law-article')];
  // В исходном документе перед основным текстом встречается оглавление. Выбираем последнюю подходящую статью.
  const found=heads.filter(x=>new RegExp('^Статья\\s+'+article+'(?![\\d-])(?:\\.|\\s|$)','iu').test(x.textContent.trim())).at(-1);
  if(found)found.scrollIntoView({behavior:'smooth',block:'start'});
  else $('law-title').scrollIntoView({behavior:'smooth',block:'start'});
 });
}
const escortTopics=[
 {name:'Маршрут',short:'Движение и ограничения',title:'Маршрут и движение',summary:'Закон допускает временные ограничения для транспорта и пешеходов на трассах проезда объектов государственной охраны. Отдельно предусмотрено требование остановиться или изменить маршрут.',focus:'Основание связано с трассой проезда объекта государственной охраны. Это не общее разрешение перекрывать любую дорогу.',refs:['ref-exact-fso-10-1-7','ref-exact-fso-11-1-3']},
 {name:'Проход',short:'Доступ при сопровождении',title:'Проход на территорию',summary:'Для исполнения полномочий при сопровождении охраняемого лица закон предусматривает проход на закрытые, охраняемые и частные территории.',focus:'Формулировка закона содержит условие: «в целях выполнения своих полномочий при сопровождении охраняемых лиц».',refs:['ref-exact-fso-10-1-8','ref-exact-fso-10-1-22']},
 {name:'Зона охраны',short:'Ограничение доступа',title:'Охранная зона',summary:'Вокруг охраняемого лица действует охранная зона. Закон определяет её минимальный радиус и отдельные условия временного ограничения доступа.',focus:'Охранная зона устанавливается в радиусе не менее 20 метров. Дополнительные ограничения доступа при угрозе связаны с предусмотренными законом основаниями.',refs:['ref-exact-fso-7-1-all','ref-exact-fso-7-6-3','ref-exact-fso-10-1-17']},
 {name:'Угроза',short:'Условия специальных мер',title:'Действия при угрозе',summary:'Специальные меры при движении кортежа и сопровождении предусмотрены при возникновении угрозы жизни и здоровью охраняемого лица или сотрудников органов государственной охраны.',focus:'Наличие самого кортежа не заменяет установленное законом условие угрозы. Применение силы регулируется законодательством.',refs:['ref-exact-fso-7-6-5','ref-exact-fso-17-1-all']},
 {name:'Материалы',short:'Передача компетентным органам',title:'Материалы о правонарушении',summary:'Если при обеспечении безопасности охраняемого лица выявлено правонарушение, закон разрешает передавать материалы уполномоченным органам для процессуального решения.',focus:'Передача материалов и самостоятельное принятие процессуального решения — разные действия.',refs:['ref-exact-fso-7-8-all']}
];
const escortCases=[
 {title:'Ограничение движения',question:'На трассе проезда нужно временно ограничить движение.',condition:'Речь должна идти именно о трассе проезда объекта государственной охраны.',point:'ФЗ о ФСО предусматривает ограничение движения транспорта и пешеходов, а также требование прекратить движение или изменить маршрут на такой трассе.',limit:'За пределами указанного основания схема не даёт общего права перекрывать дороги.',refs:['ref-exact-fso-10-1-7','ref-exact-fso-11-1-3']},
 {title:'Проход на объект',question:'Во время сопровождения нужно пройти на закрытую территорию.',condition:'Проход необходим для выполнения полномочий при сопровождении охраняемого лица.',point:'ФЗ о ФСО прямо предусматривает проход и нахождение на закрытых, охраняемых и частных территориях при этом условии.',limit:'Право прохода не следует представлять как самостоятельное право беспрепятственного посещения любых объектов вне сопровождения.',refs:['ref-exact-fso-10-1-8']},
 {title:'Охранная зона',question:'Требуется ограничить доступ к охраняемому лицу.',condition:'Закон устанавливает охранную зону. Дополнительное временное ограничение доступа по приведённой норме связано с угрозой безопасности охраняемого лица.',point:'Сопоставьте нормы об охранной зоне и об ограничении доступа при угрозе.',limit:'Не путайте автоматическое существование охранной зоны с основаниями дополнительных ограничений.',refs:['ref-exact-fso-7-1-all','ref-exact-fso-7-6-3']},
 {title:'Угроза при движении',question:'Во время сопровождения возникла угроза охраняемому лицу.',condition:'Применимость специальных мер определяется условиями угрозы, указанными в законе.',point:'ФЗ о ФСО предусматривает специальные средства и специальные манёвры транспорта при возникновении угрозы жизни и здоровью охраняемого лица или сотрудников ФСО.',limit:'Визуальная схема не является инструкцией по применению силы или манёврам; для действий применяются полные нормы законодательства.',refs:['ref-exact-fso-7-6-5','ref-exact-fso-17-1-all']},
 {title:'Выявлено нарушение',question:'При охране лица зафиксировано правонарушение.',condition:'Правонарушение выявлено при исполнении обязанностей по обеспечению безопасности охраняемого лица.',point:'Закон разрешает передать материалы, в том числе видеофиксацию, уполномоченному органу.',limit:'Передача материалов не подменяет процессуальные решения компетентного органа.',refs:['ref-exact-fso-7-8-all']}
];
let escortSelected=0,escortCaseSelected=0;
function escortLawButton(item){
 const b=btn('Открыть статью ↗','work-primary',()=>openReference(item,b));
 b.type='button';return b;
}
function showEscortTopic(index){
 escortSelected=index;
 document.querySelectorAll('#escort-track .escort-stop').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
 const topic=escortTopics[index],root=$('escort-briefing');root.replaceChildren();
 const top=document.createElement('div');top.className='escort-brief-top';
 const tag=document.createElement('span');tag.className='escort-brief-tag';tag.textContent='ТЕМА '+String(index+1).padStart(2,'0');
 const count=document.createElement('span');count.className='escort-brief-count';count.textContent='ФЗ о ФСО · № 22-ФЗ';top.append(tag,count);
 const title=document.createElement('h3');title.textContent=topic.title;
 const summary=document.createElement('p');summary.className='escort-brief-summary';summary.textContent=topic.summary;
 const focus=document.createElement('div');focus.className='escort-focus';const mark=document.createElement('span');mark.textContent='!';
 const focusText=document.createElement('p');focusText.textContent=topic.focus;focus.append(mark,focusText);
 const heading=document.createElement('div');heading.className='escort-reference-head';heading.textContent='Точные нормы';
 const refs=document.createElement('div');refs.className='escort-law-list';
 for(const id of topic.refs){const item=findRef(id);if(!item)continue;
  const box=document.createElement('div');box.className='escort-law-card';
  const header=document.createElement('div');header.className='escort-law-title';
  const title=document.createElement('b');title.textContent=item.title;
  const cite=document.createElement('small');cite.textContent=getReferenceCitation(item);header.append(title,cite);
  const quote=document.createElement('blockquote');quote.textContent=getExactQuote(item)||'Дословный текст не включён в памятку.';
  const actions=document.createElement('div');actions.className='escort-law-actions';actions.append(escortLawButton(item),bookmarkButton('ref',item.id));
  box.append(header,quote,actions);refs.append(box);
 }
 root.append(top,title,summary,focus,heading,refs);
}
function showEscortCase(index){
 escortCaseSelected=index;
 document.querySelectorAll('#escort-case-tabs button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
 const scenario=escortCases[index],root=$('escort-case-result');root.replaceChildren();
 const micro=document.createElement('small');micro.textContent='СИТУАЦИЯ '+String(index+1).padStart(2,'0');
 const title=document.createElement('h3');title.textContent=scenario.question;root.append(micro,title);
 for(const [label,value] of [['Условие',scenario.condition],['Основание',scenario.point],['Ограничение',scenario.limit]]){
  const row=document.createElement('div');row.className='escort-case-line';
  const name=document.createElement('strong');name.textContent=label;const p=document.createElement('p');p.textContent=value;
  row.append(name,p);root.append(row);
 }
 const sources=document.createElement('div');sources.className='escort-case-source';
 for(const id of scenario.refs){const item=findRef(id);if(!item)continue;const b=escortLawButton(item);b.textContent=getReferenceCitation(item)+' ↗';sources.append(b)}root.append(sources);
}
function renderEscort(){
 const track=$('escort-track'),tabs=$('escort-case-tabs');
 if(track.children.length===0){escortTopics.forEach((item,index)=>{
  const b=document.createElement('button');b.type='button';b.className='escort-stop';b.setAttribute('aria-pressed','false');
  const num=document.createElement('span');num.className='escort-stop-dot';num.textContent=String(index+1).padStart(2,'0');
  const title=document.createElement('b');title.textContent=item.name;
  const sub=document.createElement('small');sub.textContent=item.short;b.append(num,title,sub);
  b.addEventListener('click',()=>showEscortTopic(index));track.append(b);
 });}
 if(tabs.children.length===0){escortCases.forEach((item,index)=>{
  const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed','false');
  const label=document.createElement('span');label.textContent=String(index+1).padStart(2,'0');
  b.append(document.createTextNode(item.title),label);b.addEventListener('click',()=>showEscortCase(index));tabs.append(b);
 });}
 showEscortTopic(escortSelected);showEscortCase(escortCaseSelected);
}

// Личная шпаргалка: индивидуальные подборки, заметки и открытие на месте.
const favoriteKey='fso-rmrp-bookmarks-v1';
const cheatStateKey='fso-rmrp-cheat-workspace-v2';
const CHEAT_TYPES=['ref','law','situation','concept'];
let favoriteFallback=[];
function readFavorites(){try{const value=JSON.parse(localStorage.getItem(favoriteKey)||'[]');return Array.isArray(value)?value.filter(x=>x&&CHEAT_TYPES.includes(x.type)&&typeof x.id==='string').slice(0,500):[]}catch{return favoriteFallback}}
function favorites(){return readFavorites()}
function storeFavorites(value){favoriteFallback=value;try{localStorage.setItem(favoriteKey,JSON.stringify(value))}catch{cheatMessage('Браузер не разрешает сохранять изменения. Скачайте резервную копию.',true)}}
function safeCheatState(raw){
 const data=raw&&typeof raw==='object'?raw:{};
 const collections=Array.isArray(data.collections)?data.collections.slice(0,100).filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string').map(x=>({id:x.id.slice(0,80),title:x.title.slice(0,65)})):[];
 const custom=Array.isArray(data.custom)?data.custom.slice(0,500).filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string').map(x=>({id:x.id.slice(0,80),title:x.title.slice(0,180),body:String(x.body||'').slice(0,12000)})):[];
 const meta={};if(data.meta&&typeof data.meta==='object'&&!Array.isArray(data.meta))for(const [key,val] of Object.entries(data.meta).slice(0,1000)){
  if(!val||typeof val!=='object')continue;
  meta[key.slice(0,200)]={pinned:!!val.pinned,note:String(val.note||'').slice(0,12000),clip:String(val.clip||'').slice(0,3000),snapshot:String(val.snapshot||'').slice(0,48),order:Number.isFinite(val.order)?val.order:0,collections:Array.isArray(val.collections)?val.collections.filter(x=>typeof x==='string').slice(0,100):[]};
 }
 return {version:2,collections,custom,meta,mode:data.mode==='detailed'?'detailed':'compact'};
}
let cheatState;
try{cheatState=safeCheatState(JSON.parse(localStorage.getItem(cheatStateKey)||'{}'))}catch{cheatState=safeCheatState({})}
let cheatFilter='all',cheatEditing=null,cheatExpanded='',cheatManaging='',cheatSourceForClip='';
function saveCheat(){try{localStorage.setItem(cheatStateKey,JSON.stringify(cheatState))}catch{cheatMessage('Не удалось сохранить данные в браузере. Скачайте резервную копию.',true)}}
function cheatMessage(value,problem=false){const p=$('cheat-status');if(p){p.textContent=value;p.style.color=problem?'#e2a7a7':'var(--muted)'}}
function cheatUid(){return 'u'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function cheatKey(item){return item.type+':'+item.id}
function cheatMeta(item){const key=cheatKey(item);if(!cheatState.meta[key])cheatState.meta[key]={pinned:false,note:'',clip:'',snapshot:'',order:Date.now(),collections:[]};return cheatState.meta[key]}
function cheatExistingMeta(item){return cheatState.meta[cheatKey(item)]||{pinned:false,note:'',clip:'',snapshot:'',order:0,collections:[]}}
function cheatHash(text){let result=2166136261;for(const ch of String(text||'')){result^=ch.charCodeAt(0);result=Math.imul(result,16777619)}return String(result>>>0)}
function cheatSource(item){
 if(item.type==='ref'){const r=findRef(item.id);return r&&{title:r.title,subtitle:getReferenceCitation(r),summary:r.summary||'',text:getExactQuote(r),sourceUrl:r.sourceUrl||''}}
 if(item.type==='law'){const law=lawRecords().find(x=>x.id===item.id)||lawCatalog.find(x=>x.id===item.id);return law&&{title:law.title,subtitle:'Законодательство',summary:'Текст документа',text:referenceLawCache.get(item.id)||'',sourceUrl:law.sourceUrl||'',law:true}}
 if(item.type==='note'){const n=cheatState.custom.find(x=>x.id===item.id);return n&&{title:n.title,subtitle:'Своя запись',summary:n.body.slice(0,220),text:n.body,sourceUrl:''}}
 const r=publicMaterials.find(x=>x.id===item.id&&x.sectionId===(item.type==='situation'?'situations':'concepts'));
 if(!r)return null;
 let body=String(r.body||'');if(Array.isArray(r.steps))body=r.steps.map((step,i)=>[String(i+1)+'. '+step.title,step.action,step.explain||'',...(step.norms||[]).map(n=>n.citation+'\n'+n.text)].filter(Boolean).join('\n')).join('\n\n');
 return {title:r.title,subtitle:item.type==='situation'?'Ситуация':'Понятие',summary:r.summary||'',text:body||r.summary||'',sourceUrl:r.sourceUrl||''};
}
function cheatItems(){return [...favorites(),...cheatState.custom.map(x=>({type:'note',id:x.id}))]}
function isFavorite(type,id){return favorites().some(x=>x.type===type&&x.id===id)}
function toggleFavorite(type,id){
 const before=favorites(),had=before.some(x=>x.type===type&&x.id===id);
 storeFavorites(had?before.filter(x=>!(x.type===type&&x.id===id)):[...before,{type,id}]);
 if(had)delete cheatState.meta[type+':'+id];
 else {const m=cheatMeta({type,id});const source=cheatSource({type,id});if(source?.text)m.snapshot=cheatHash(source.text)}
 saveCheat();
 document.querySelectorAll('[data-bookmark]').forEach(x=>{if(x.dataset.bookmark===type+':'+id){x.setAttribute('aria-pressed',String(!had));x.textContent=!had?'✓ Сохранено':'☆ В шпаргалку'}});
 if(!$('favorites-screen').hidden)renderFavorites();
}
function bookmarkButton(type,id,cls=''){
 const saved=isFavorite(type,id),b=btn(saved?'✓ Сохранено':'☆ В шпаргалку','fav-button '+cls,()=>toggleFavorite(type,id));
 b.dataset.bookmark=type+':'+id;b.setAttribute('aria-pressed',String(saved));b.setAttribute('aria-label',saved?'Удалить из личной шпаргалки':'Сохранить в личную шпаргалку');return b;
}
function favoriteTarget(item){const src=cheatSource(item);return src&&{...src,open:()=>{go('favorites');cheatExpanded=cheatKey(item);renderFavorites()}}}
function cheatNode(tag,cls,value){const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n}
function cheatCollectionTitle(id){return cheatState.collections.find(c=>c.id===id)?.title||'Подборка'}
function renderCheatCollections(){
 const root=$('cheat-collections');root.replaceChildren();const items=cheatItems();
 const add=(id,title,count,rename)=>{
  const row=cheatNode('div','cheat-collection-row'),b=btn(title+'  · '+count,'cheat-collection-select',()=>{cheatFilter=id;renderFavorites()});b.setAttribute('aria-current',String(cheatFilter===id));row.append(b);
  if(rename){const menu=btn('⋯','cheat-collection-ops',()=>{
   const name=prompt('Новое название подборки',title);if(name===null)return;
   const val=name.trim().slice(0,65);if(!val){alert('Введите название.');return}if(cheatState.collections.some(x=>x.id!==id&&x.title.toLowerCase()===val.toLowerCase())){alert('Подборка с таким названием существует.');return}
   const col=cheatState.collections.find(x=>x.id===id);if(col){col.title=val;saveCheat();renderFavorites()}
  });menu.title='Переименовать подборку';row.append(menu);
  const del=btn('×','cheat-collection-ops',()=>{if(!confirm('Удалить подборку «'+title+'»? Сохранённые материалы останутся в шпаргалке.'))return;
   cheatState.collections=cheatState.collections.filter(c=>c.id!==id);for(const meta of Object.values(cheatState.meta))meta.collections=meta.collections.filter(c=>c!==id);
   if(cheatFilter===id)cheatFilter='all';saveCheat();renderFavorites()});del.title='Удалить подборку';row.append(del)}
  root.append(row);
 };
 add('all','Все материалы',items.length);add('pinned','Закреплённые',items.filter(x=>cheatExistingMeta(x).pinned).length);
 for(const col of cheatState.collections)add(col.id,col.title,items.filter(x=>cheatExistingMeta(x).collections.includes(col.id)).length,true);
 add('none','Без подборки',items.filter(x=>cheatExistingMeta(x).collections.length===0).length);
}
function renderFavorites(){
 const query=$('fav-search').value.trim().toLocaleLowerCase('ru-RU');const items=cheatItems(),sort=(a,b)=>(cheatExistingMeta(a).order||0)-(cheatExistingMeta(b).order||0);
 const visible=items.filter(item=>{
  const m=cheatExistingMeta(item),src=cheatSource(item),searchable=[src?.title,src?.subtitle,src?.summary,m.note,m.clip,...m.collections.map(cheatCollectionTitle)].join(' ').toLocaleLowerCase('ru-RU');
  return (cheatFilter==='all'||(cheatFilter==='pinned'&&m.pinned)||(cheatFilter==='none'&&!m.collections.length)||m.collections.includes(cheatFilter))&&(!query||searchable.includes(query));
 }).sort(sort);
 $('fav-total').textContent=String(items.length);$('fav-pin-count').textContent=String(items.filter(i=>cheatExistingMeta(i).pinned).length);$('fav-collection-count').textContent=String(cheatState.collections.length);
 $('cheat-current-title').textContent=cheatFilter==='all'?'Все материалы':cheatFilter==='pinned'?'Закреплённые':cheatFilter==='none'?'Без подборки':cheatCollectionTitle(cheatFilter);
 $('cheat-list-heading').querySelector('span').textContent=query?'Результаты поиска':cheatFilter==='all'?'Остальные материалы':'Материалы подборки';
 $('cheat-list-count').textContent='Найдено: '+visible.length;
 $('cheat-compact').setAttribute('aria-pressed',String(cheatState.mode==='compact'));$('cheat-detailed').setAttribute('aria-pressed',String(cheatState.mode==='detailed'));
 renderCheatCollections();const pins=$('cheat-pinned-list'),list=$('favorites-list');pins.replaceChildren();list.replaceChildren();
 const pinned=cheatFilter==='all'&&!query?visible.filter(i=>cheatExistingMeta(i).pinned):[];
 $('cheat-pinned-block').hidden=pinned.length===0;
 for(const item of pinned)pins.append(renderCheatCard(item));
 for(const item of visible.filter(i=>!pinned.some(p=>cheatKey(p)===cheatKey(i))))list.append(renderCheatCard(item));
 if(!visible.length){list.append(cheatNode('div','work-empty',query?'По запросу ничего не найдено.':items.length?'В этой подборке пока ничего нет.':'Материалов пока нет. Сохраняйте статьи кнопкой «В шпаргалку» или создайте свою запись.'))}
}
function renderCheatCard(item){
 const meta=cheatExistingMeta(item),src=cheatSource(item),id=cheatKey(item),card=cheatNode('article','cheat-item'+(cheatExpanded===id?' is-open':''));card.dataset.cheatId=id;
 if(!src){const missing=cheatNode('p','cheat-warning','Исходный материал отсутствует в этой версии памятки. Закладка сохранена для восстановления.');card.append(missing,btn('Удалить','work-ghost',()=>toggleFavorite(item.type,item.id)));return card}
 const top=cheatNode('div','cheat-item-head'),main=cheatNode('div','cheat-card-main'),sub=cheatNode('small','cheat-type',src.subtitle);main.append(sub);
 const head=cheatNode('h3','',src.title);head.tabIndex=0;head.setAttribute('role','button');head.setAttribute('aria-label','Открыть материал здесь');head.addEventListener('click',()=>toggleCheatOpen(id));head.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleCheatOpen(id)}});main.append(head);
 if(cheatState.mode==='detailed'){main.append(cheatNode('p','cheat-card-desc',src.summary));if(src.text&&item.type!=='law')main.append(cheatNode('p','cheat-card-desc',src.text.slice(0,360)+(src.text.length>360?'…':'')))}
 if(meta.note)main.append(cheatNode('p','cheat-note-peek',meta.note.slice(0,250)+(meta.note.length>250?'…':'')));
 top.append(main);card.append(top);
 const actions=cheatNode('div','cheat-card-actions');actions.append(btn(cheatExpanded===id?'Свернуть':'Открыть текст','cheat-open',()=>toggleCheatOpen(id)));
 const pin=btn(meta.pinned?'★ Закреплено':'☆ Закрепить','cheat-pin',()=>{const m=cheatMeta(item);m.pinned=!m.pinned;saveCheat();renderFavorites()});pin.setAttribute('aria-pressed',String(meta.pinned));actions.append(pin);
 actions.append(btn(cheatManaging===id?'Скрыть настройки':'Управление','',()=>{cheatManaging=cheatManaging===id?'':id;renderFavorites()}));card.append(actions);
 if(cheatManaging===id){
  const manage=cheatNode('div','cheat-manage');manage.append(cheatNode('h4','', 'Подборки'));
  const groups=cheatNode('div','cheat-memberships');for(const c of cheatState.collections){const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=meta.collections.includes(c.id);box.addEventListener('change',()=>{const m=cheatMeta(item);m.collections=box.checked?[...new Set([...m.collections,c.id])]:m.collections.filter(x=>x!==c.id);saveCheat();renderFavorites()});label.append(box,document.createTextNode(c.title));groups.append(label)}
  if(!cheatState.collections.length)groups.append(cheatNode('p','cheat-hint','Сначала создайте подборку справа. Материал можно включить в несколько подборок.'));
  manage.append(groups);
  const rows=cheatNode('div','cheat-manage-rows');rows.append(btn('↑ Выше','',()=>moveCheat(item,-1)),btn('↓ Ниже','',()=>moveCheat(item,1)));
  if(item.type==='note')rows.append(btn('Редактировать запись','',()=>showCheatEditor(item.id)));
  rows.append(btn('Удалить из шпаргалки','',()=>removeCheatItem(item)));manage.append(rows);card.append(manage);
 }
 if(cheatExpanded===id){const preview=cheatNode('div','cheat-preview');card.append(preview);renderCheatPreview(item,preview,src)}
 return card;
}
function toggleCheatOpen(id){cheatExpanded=cheatExpanded===id?'':id;renderFavorites();if(cheatExpanded){const node=[...document.querySelectorAll('.cheat-item')].find(x=>x.dataset.cheatId===id);node?.scrollIntoView({block:'nearest',behavior:'smooth'})}}
function renderCheatPreview(item,preview,src){
 const info=cheatNode('div','cheat-preview-title');info.append(cheatNode('span','',src.subtitle),cheatNode('span','',item.type==='law'?'Документ':'Материал'));preview.append(info);
 const legal=cheatNode('div','cheat-legal-text');legal.tabIndex=0;legal.textContent=src.text||'Текст отсутствует в локальной копии.';preview.append(legal);
 if(item.type==='law'){
  if(referenceLawCache.has(item.id)){legal.textContent=referenceLawCache.get(item.id)||'Текст не найден.'}
  else {legal.textContent='Загрузка текста документа…';fetchStaticLaw(item.id).then(body=>{if(legal.isConnected)legal.textContent=body||'Текст документа пока не внесён.'}).catch(()=>{if(legal.isConnected)legal.textContent='Полный текст этого документа недоступен в текущей копии памятки.'})}
 }
 const meta=cheatExistingMeta(item);if(meta.snapshot&&item.type==='ref'&&src.text&&cheatHash(src.text)!==meta.snapshot)preview.append(cheatNode('p','cheat-warning','Текст нормы изменился после сохранения. Проверьте актуальную редакцию.'));
 if(meta.clip){preview.append(cheatNode('div','cheat-clip',meta.clip));preview.append(btn('Убрать сохранённый фрагмент','work-ghost',()=>{cheatMeta(item).clip='';saveCheat();renderFavorites()}))}
 if(item.type==='ref'||item.type==='law'){
  const clipInfo=cheatNode('p','cheat-hint','Чтобы сохранить часть нормы, выделите текст выше и нажмите «Сохранить фрагмент». Это копия выбранного текста, не изменяющая оригинал.');preview.append(clipInfo);
  preview.append(btn('Сохранить фрагмент','work-ghost',()=>{
   const selected=String(window.getSelection()?.toString()||'').trim();const origin=legal.textContent||'';
   const norm=t=>String(t).replace(/\s+/g,' ').trim();
   if(selected.length<3||!norm(origin).includes(norm(selected))){cheatMessage('Сначала выделите фрагмент в открытом тексте статьи.',true);return}
   cheatMeta(item).clip=selected.slice(0,3000);cheatMeta(item).snapshot=cheatHash(origin);saveCheat();cheatMessage('Фрагмент сохранён.');renderFavorites();
  }));
 }
 if(src.sourceUrl&&/^https:\/\//.test(src.sourceUrl)){const link=document.createElement('a');link.href=src.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.className='law-source';link.textContent='Первоисточник на форуме ↗';preview.append(link)}
 const label=cheatNode('label','cheat-note-field');label.append(cheatNode('span','',item.type==='note'?'Личный комментарий':'Моя заметка к материалу'));const area=document.createElement('textarea');area.rows=3;area.maxLength=12000;area.value=meta.note||'';area.placeholder='Личная пометка (не является текстом закона)';label.append(area);preview.append(label);
 const row=cheatNode('div','cheat-inline-actions');row.append(btn('Сохранить заметку','',()=>{cheatMeta(item).note=area.value.trim().slice(0,12000);saveCheat();cheatMessage('Заметка сохранена.');renderFavorites()}));if(item.type==='note')row.append(btn('Изменить основную запись','',()=>showCheatEditor(item.id)));preview.append(row);
}
function removeCheatItem(item){if(!confirm('Убрать материал из шпаргалки?'))return;if(item.type==='note'){cheatState.custom=cheatState.custom.filter(x=>x.id!==item.id);delete cheatState.meta[cheatKey(item)];saveCheat();renderFavorites()}else toggleFavorite(item.type,item.id);cheatExpanded='';cheatManaging=''}
function moveCheat(item,direction){const list=cheatItems();const index=list.findIndex(x=>cheatKey(x)===cheatKey(item));const neighbor=list[index+direction];if(!neighbor)return;
 list.forEach((it,i)=>cheatMeta(it).order=i);const a=cheatMeta(item),b=cheatMeta(neighbor);const t=a.order;a.order=b.order;b.order=t;saveCheat();renderFavorites()}
function showCheatEditor(id=null){cheatEditing=id;const src=cheatState.custom.find(x=>x.id===id);$('cheat-edit-panel').hidden=false;$('cheat-edit-heading').textContent=src?'Редактировать запись':'Новая запись';$('cheat-note-title').value=src?.title||'';$('cheat-note-body').value=src?.body||'';$('cheat-edit-error').textContent='';$('cheat-edit-panel').scrollIntoView({block:'nearest',behavior:'smooth'});$('cheat-note-title').focus()}
$('cheat-add-note').addEventListener('click',()=>showCheatEditor());$('cheat-note-cancel').addEventListener('click',()=>{$('cheat-edit-panel').hidden=true;cheatEditing=null});
$('cheat-note-save').addEventListener('click',()=>{
 const title=$('cheat-note-title').value.trim(),body=$('cheat-note-body').value.trim();if(!title||!body){$('cheat-edit-error').textContent='Введите название и текст записи.';return}
 if(cheatEditing){const item=cheatState.custom.find(x=>x.id===cheatEditing);if(item){item.title=title;item.body=body}}
 else{const id=cheatUid();cheatState.custom.push({id,title,body});cheatMeta({type:'note',id});cheatExpanded='note:'+id}
 cheatEditing=null;$('cheat-edit-panel').hidden=true;saveCheat();renderFavorites();cheatMessage('Запись сохранена.');
});
$('fav-search').addEventListener('input',renderFavorites);
$('cheat-compact').addEventListener('click',()=>{cheatState.mode='compact';saveCheat();renderFavorites()});
$('cheat-detailed').addEventListener('click',()=>{cheatState.mode='detailed';saveCheat();renderFavorites()});
$('cheat-new-collection').addEventListener('click',()=>{$('cheat-collection-form').hidden=false;$('cheat-collection-name').value='';$('cheat-collection-name').focus()});
$('cheat-collection-cancel').addEventListener('click',()=>{$('cheat-collection-form').hidden=true});
$('cheat-collection-form').addEventListener('submit',e=>{e.preventDefault();const title=$('cheat-collection-name').value.trim();if(!title)return;
 if(cheatState.collections.some(x=>x.title.toLowerCase()===title.toLowerCase())){alert('Подборка с таким названием существует.');return}
 const id=cheatUid();cheatState.collections.push({id,title});cheatFilter=id;$('cheat-collection-form').hidden=true;saveCheat();renderFavorites();
});
function cheatDownload(name,content,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
function cheatEscape(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')}
function cheatExportEntries(){return cheatItems().map(i=>({item:i,source:cheatSource(i),meta:cheatExistingMeta(i)}))}
function cheatExportHtml(compact=false){const entries=cheatExportEntries(),list=entries.map(({item,source,meta})=>{
 const title=cheatEscape(source?.title||'Недоступный материал'),cit=cheatEscape(source?.subtitle||''),note=cheatEscape(meta.note||''),clip=cheatEscape(meta.clip||''),text=cheatEscape(source?.text||'');
 const groups=cheatEscape(meta.collections.map(cheatCollectionTitle).join(' · '));const main=compact?'':(clip||text.slice(0,12000));return `<article><small>${cit}${groups?' · '+groups:''}</small><h2>${title}</h2>${note?`<p class="note">${note}</p>`:''}${main?`<div class="body">${main}</div>`:''}${source?.sourceUrl?`<a href="${cheatEscape(source.sourceUrl)}">Источник</a>`:''}</article>`}).join('');
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Личная шпаргалка ФСО RMRP</title><style>body{margin:0;background:#f5f7fa;color:#172638;font:14px/1.6 Arial,sans-serif}.page{max-width:870px;margin:26px auto;padding:0 22px}h1{font-size:27px}article{background:#fff;border:1px solid #cbd5e1;border-radius:12px;margin:12px 0;padding:18px;break-inside:avoid}small{color:#3e7197}h2{font-size:17px;margin:7px 0}.body{white-space:pre-wrap;max-height:${compact?'0':'none'};overflow-wrap:anywhere}.note{white-space:pre-wrap;border-left:2px solid #6793b0;padding-left:11px}.subtitle{color:#617489}@media print{body{background:#fff}.page{margin:0 auto}article{border-color:#ddd}}</style></head><body><main class="page"><h1>Личная шпаргалка ФСО RMRP</h1><p class="subtitle">Сформировано ${new Date().toLocaleString('ru-RU')}. Материалов: ${entries.length}. Личные пометки отделены от текста нормативных документов.</p>${list||'<p>Нет материалов.</p>'}</main></body></html>`;
}
function cheatExportTableHtml(){
 const groups=new Map();for(const entry of cheatExportEntries()){
  const key=entry.source?.subtitle?.replace(/\s*·\s*ст\..*$/,'')||'Личные записи';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);
 }
 const rows=[...groups].map(([name,list])=>`<tbody><tr class="group"><th colspan="3">${cheatEscape(name)}</th></tr>${list.map(({source,meta})=>`<tr><td>${cheatEscape(source?.title||'Материал отсутствует')}</td><td>${cheatEscape(source?.subtitle||'')}</td><td>${cheatEscape(meta.note||meta.clip||'')}</td></tr>`).join('')}</tbody>`).join('');
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Таблица шпаргалки ФСО</title><style>body{font:11px/1.5 Arial,sans-serif;color:#1a2633;margin:24px}h1{font-size:20px}.meta{color:#697b8b}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #bac6d0;padding:8px;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}thead th{background:#e9eff4;text-align:left}.group th{background:#dce7ef;color:#23394d;text-align:left}tr{break-inside:avoid}th:nth-child(1){width:38%}th:nth-child(2){width:26%}th:nth-child(3){width:36%}@page{size:A4 portrait;margin:13mm}</style></head><body><h1>Личная шпаргалка ФСО RMRP</h1><p class="meta">${new Date().toLocaleString('ru-RU')} · Материалов: ${cheatItems().length} · Тексты личных заметок не являются нормами закона.</p><table><thead><tr><th>Материал</th><th>Статья / источник</th><th>Личная пометка или фрагмент</th></tr></thead>${rows}</table></body></html>`;
}
function cheatExport(kind){
 const entries=cheatExportEntries();if(!entries.length){cheatMessage('Нет материалов для экспорта.',true);return}
 if(kind==='html'){cheatDownload('ФСО_личная_шпаргалка.html',cheatExportHtml(), 'text/html;charset=utf-8');return}
 if(kind==='pdf'||kind==='compactpdf'){
  const doc=kind==='compactpdf'?cheatExportTableHtml():cheatExportHtml();const win=window.open('','_blank');if(!win){cheatMessage('Браузер заблокировал окно печати. Разрешите всплывающие окна или скачайте HTML.',true);return}
  win.document.open();win.document.write(doc);win.document.close();win.focus();setTimeout(()=>win.print(),350);cheatMessage('В окне печати выберите «Сохранить как PDF».');return;
 }
 const md=kind==='md';const output=[md?'# Личная шпаргалка ФСО RMRP':'Личная шпаргалка ФСО RMRP',''];
 for(const {source,meta} of entries){output.push(md?'## '+(source?.title||'Материал отсутствует'):(source?.title||'Материал отсутствует'),source?.subtitle||'');
 if(meta.collections.length)output.push('Подборки: '+meta.collections.map(cheatCollectionTitle).join(', '));
 if(meta.note)output.push('Моя заметка: '+meta.note);
 if(meta.clip)output.push('Сохранённый фрагмент: '+meta.clip);
 if(source?.text)output.push(source.text.slice(0,12000));if(source?.sourceUrl)output.push('Источник: '+source.sourceUrl);output.push('');}
 cheatDownload('ФСО_личная_шпаргалка.'+(md?'md':'txt'),output.join('\n'),'text/plain;charset=utf-8');
}
document.querySelectorAll('[data-cheat-export]').forEach(b=>b.addEventListener('click',()=>cheatExport(b.dataset.cheatExport)));
$('cheat-backup').addEventListener('click',()=>{
 const payload={kind:'fso-rmrp-cheat-backup',version:2,createdAt:new Date().toISOString(),bookmarks:favorites(),workspace:cheatState};
 cheatDownload('ФСО_RMRP_шпаргалка_резервная_копия.json',JSON.stringify(payload,null,2),'application/json;charset=utf-8');cheatMessage('Резервная копия скачана.');
});
$('cheat-import').addEventListener('click',()=>$('cheat-import-file').click());
$('cheat-import-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>2_000_000)throw new Error('Файл слишком большой. Максимальный размер 2 МБ.');
  const data=JSON.parse(await file.text());if(data?.kind!=='fso-rmrp-cheat-backup'||data?.version!==2||!Array.isArray(data.bookmarks)||!data.workspace||typeof data.workspace!=='object')throw new Error('Это не резервная копия шпаргалки версии 2.');
  if(!confirm('Заменить текущую шпаргалку данными из файла? Текущие заметки и подборки будут перезаписаны.'))return;
  const bookmarks=data.bookmarks.filter(x=>x&&CHEAT_TYPES.includes(x.type)&&typeof x.id==='string').slice(0,500);
  cheatState=safeCheatState(data.workspace);storeFavorites(bookmarks);favoriteFallback=bookmarks;saveCheat();cheatFilter='all';cheatExpanded='';cheatManaging='';renderFavorites();cheatMessage('Шпаргалка восстановлена из резервной копии.');
 }catch(err){cheatMessage('Не удалось импортировать файл: '+err.message,true)}finally{e.target.value=''}
});
// Совместимость с прежней кнопкой экспорта, если она присутствует в старой разметке.
if($('fav-export'))$('fav-export').addEventListener('click',()=>cheatExport('txt'));

// Посты и патрули: карточка содержит изображение и собственный доклад.
const serviceTabIds=['posts','patrols'];
let serviceEntries={posts:[],patrols:[]};
try {
 const loaded=window.FSO_DUTY_ENTRIES || {posts:[],patrols:[]};
 for(const key of serviceTabIds)serviceEntries[key]=Array.isArray(loaded?.[key])?loaded[key]:[];
} catch(error) { console.warn('Не удалось прочитать список постов и патрулей',error); }
function dutyEl(tag,className,txt){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(txt!==undefined)node.textContent=String(txt);
 return node;
}
function dutyEntryCard(entry,type,isEmpty){
 const card=dutyEl('article','duty-card'+(isEmpty?' duty-template':''));
 const photo=dutyEl('div','duty-visual'+(isEmpty?' is-placeholder':''));
 const label=type==='posts'?'Фото поста':'Фото или схема патруля';
 if(entry.image&&!isEmpty){
  const img=document.createElement('img');img.alt='Изображение: '+String(entry.title||label);
  img.loading='lazy';img.src=entry.image;
  img.addEventListener('error',()=>{img.remove();photo.classList.add('is-placeholder');photo.append(dutyEl('span','duty-image-label','Изображение пока недоступно'));});
  photo.append(img);
  photo.append(dutyEl('span','duty-visual-bottom',label));
 }else{
  photo.append(dutyEl('div','duty-picture-icon'),dutyEl('span','duty-image-label',label),dutyEl('span','duty-image-meta',isEmpty?'Здесь будет фотография или схема, которую ты добавишь позже.':'Изображение пока не добавлено'));
 }
 const body=dutyEl('div','duty-copy');
 const meta=dutyEl('div','duty-meta');meta.append(dutyEl('span','',type==='posts'?'ПОСТ':'ПАТРУЛЬ'));
 if(isEmpty)meta.append(dutyEl('span','','МЕСТО ДЛЯ МАТЕРИАЛА'));
 const title=dutyEl('h3','',isEmpty?(type==='posts'?'Название поста':'Название маршрута'):entry.title||'Без названия');
 const loc=dutyEl('dl','duty-location');loc.append(dutyEl('dt','',type==='posts'?'Расположение':'Маршрут / участок'),dutyEl('dd','',isEmpty?'Будет указано после добавления материалов.':entry.location||'Не указано'));
 body.append(meta,title,loc);
 if(entry.details&&!isEmpty)body.append(dutyEl('p','duty-details',entry.details));
 const report=dutyEl('section','duty-report');
 const reportHead=dutyEl('div','duty-report-head');reportHead.append(dutyEl('h4','',type==='posts'?'Доклад с поста':'Доклад патруля'));
 const reportText=String(entry.report||'').trim();
 report.append(reportHead,dutyEl('p','duty-report-text',reportText&&!isEmpty?reportText:'Текст доклада появится здесь вместе с материалом.'));
 const control=dutyEl('div','');const button=dutyEl('button','duty-copy-report','Скопировать доклад');button.type='button';button.disabled=!reportText||isEmpty;
 const state=dutyEl('span','duty-report-status','');state.setAttribute('role','status');
 button.addEventListener('click',async()=>{
  try {
   if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(reportText)}
   else {const ta=document.createElement('textarea');ta.value=reportText;ta.style.position='fixed';ta.style.opacity='0';document.body.append(ta);ta.select();const ok=document.execCommand('copy');ta.remove();if(!ok)throw Error('copy failed')}
   state.textContent='Скопировано';
  }catch(e){state.textContent='Не удалось скопировать';}
 });
 control.append(button,state);report.append(control);body.append(report);card.append(photo,body);
 return card;
}
function renderServiceEntries(){
 serviceTabIds.forEach(type=>{
  const holder=$('service-list-'+type);if(!holder)return;
  holder.replaceChildren();
  const entries=serviceEntries[type];
  if(!entries.length)holder.append(dutyEntryCard({},type,true));
  else for(const entry of entries)holder.append(dutyEntryCard(entry,type,false));
 });
}
function renderServiceTab(id){
 const current=serviceTabIds.includes(id)?id:'posts';
 document.querySelectorAll('[data-service-tab]').forEach(b=>{
  const active=b.dataset.serviceTab===current;
  b.classList.toggle('is-active',active);
  if(active)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');
 });
 serviceTabIds.forEach(name=>{$('service-panel-'+name).hidden=name!==current});
}
document.querySelectorAll('[data-service-tab]').forEach(b=>b.addEventListener('click',()=>renderServiceTab(b.dataset.serviceTab)));
renderServiceEntries();

window.addEventListener('hashchange',()=>go(decodeURIComponent(location.hash.slice(1))));
go(decodeURIComponent(location.hash.slice(1))||'home');
updatePortalStats();

loadPublic();
// Законы встроены в текущий HTML: импорт и manifest не нужны.
