/* ДВИЖОК «Проверка знаний». Вопросы отдельно в data/09-проверка-знаний.js. */
(()=>{
 'use strict';
 const node=document.getElementById('quiz-screen');
 const bank=Array.isArray(window.FSO_QUIZ_QUESTIONS)?window.FSO_QUIZ_QUESTIONS:[];
 if(!node)return;
 const STORE='fso-rmrp-quiz-progress-v1';
 const TITLE={1:'Основы',2:'Применение',3:'Сложные ситуации'};
 let data=load(),session=null;
 function load(){try{const x=JSON.parse(localStorage.getItem(STORE)||'{}');return {history:Array.isArray(x.history)?x.history.slice(-40):[],missed:Array.isArray(x.missed)?x.missed:[],attempts:Number(x.attempts)||0}}catch{return {history:[],missed:[],attempts:0}}}
 function save(){try{localStorage.setItem(STORE,JSON.stringify(data))}catch{}}
 function shuffled(list){const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a}
 function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function el(html){node.innerHTML=html}
 function source(q){return q.source.document==='concept'?'Понятия · '+q.source.article:(q.source.document==='law-25069'?'ФЗ «О ФСО»':'Процессуальный кодекс')+' · ст. '+q.source.article}
 function sourceButton(q){return `<button type="button" class="qz-secondary" data-qz-law="${esc(q.source.document)}" data-qz-article="${esc(q.source.article)}">Читать статью здесь ↗</button>`}
 // Источник открывается поверх тренажёра, не переключая раздел и не сбрасывая ответ.
 const viewer=document.createElement('div');
 viewer.className='qz-source-overlay';viewer.id='qz-source-overlay';
 viewer.hidden=true;viewer.setAttribute('aria-hidden','true');
 viewer.innerHTML=`<div class="qz-source-backdrop" data-qz-close></div>
   <section class="qz-source-dialog" role="dialog" aria-modal="true" aria-labelledby="qz-source-title" tabindex="-1">
     <header class="qz-source-head"><div><small id="qz-source-type"></small><h2 id="qz-source-title"></h2><p id="qz-source-meta"></p></div>
     <button type="button" class="qz-source-close" data-qz-close aria-label="Закрыть статью">×</button></header>
     <div class="qz-source-content" id="qz-source-content"></div>
     <footer class="qz-source-footer"><span>Текст из законодательства памятки</span><button type="button" class="qz-secondary" data-qz-close>Вернуться к проверке</button></footer>
   </section>`;
 document.body.append(viewer);
 let sourceReturnFocus=null,oldBodyOverflow='';
 function sourceOpen(doc,article,origin){
  const container=viewer.querySelector('#qz-source-content');container.replaceChildren();
  const heading=viewer.querySelector('#qz-source-title');
  const type=viewer.querySelector('#qz-source-type');
  const meta=viewer.querySelector('#qz-source-meta');
  if(doc==='concept'){
   const item=(window.FSO_CONCEPTS||[]).find(c=>c.title===article);
   type.textContent='ПОНЯТИЕ';heading.textContent=article;meta.textContent='Объяснение простыми словами';
   const p=document.createElement('p');p.className='qz-source-paragraph';
   p.textContent=item?.body||'Определение отсутствует в базе памятки.';container.append(p);
   viewer.querySelector('.qz-source-footer span').textContent='Определение из раздела «Понятия»';
  }else{
   const catalog=[...(window.FSO_PDF_LAW_CATALOG||[]),...(window.FSO_LAW_CATALOG||[])];
   const item=catalog.find(x=>x.id===doc);
   const title=item?.title||'Нормативный документ';
   const docText=window.FSO_FULL_LAW_DOCS?.[doc];
   const lines=Array.isArray(docText)?docText:String(docText||'').split(/\r?\n/);
   type.textContent='ЗАКОНОДАТЕЛЬСТВО';heading.textContent='Статья '+article;
   meta.textContent=title;
   viewer.querySelector('.qz-source-footer span').textContent='Точный текст из базы законодательства';
   const expected=String(article).trim();
   const isArticle=x=>/^Статья\s+(\d+(?:[.-]\d+)*)\s*(?:[.\s:–—-]|$)/iu.test(x);
   const number=x=>x.match(/^Статья\s+(\d+(?:[.-]\d+)*)\s*(?:[.\s:–—-]|$)/iu)?.[1]||'';
   let active=false,found=false;
   for(const raw of lines){
    for(const part of String(raw).split(/\r?\n/)){
     const line=part.trim();if(!line)continue;
     if(isArticle(line)){
      if(active){active=false;break}
      if(number(line)===expected){active=true;found=true}
     }
     if(!active)continue;
     // Буквальная формулировка без дополнительных пересказов.
     const el=document.createElement(isArticle(line)?'h3':'p');
     el.className=isArticle(line)?'qz-source-article-title':'qz-source-paragraph';
     el.textContent=line;container.append(el);
    }
    if(found&&!active)break;
   }
   if(!found){
    const p=document.createElement('p');p.className='qz-source-error';
    p.textContent='Статья не найдена в сохранённом тексте документа.';container.append(p);
   }
  }
  sourceReturnFocus=origin||document.activeElement;
  oldBodyOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  viewer.hidden=false;viewer.setAttribute('aria-hidden','false');
  viewer.querySelector('.qz-source-content').scrollTop=0;
  viewer.querySelector('.qz-source-close').focus({preventScroll:true});
 }
 function sourceClose(){
  if(viewer.hidden)return;
  viewer.hidden=true;viewer.setAttribute('aria-hidden','true');
  document.body.style.overflow=oldBodyOverflow;
  if(sourceReturnFocus?.isConnected)sourceReturnFocus.focus({preventScroll:true});
 }
 viewer.addEventListener('click',ev=>{if(ev.target.closest('[data-qz-close]'))sourceClose()});
 document.addEventListener('keydown',ev=>{
  if(viewer.hidden)return;
  if(ev.key==='Escape'){ev.preventDefault();sourceClose();return}
  if(ev.key!=='Tab')return;
  const els=[...viewer.querySelectorAll('button:not([disabled]),a[href]')].filter(e=>e.getClientRects().length);
  if(!els.length){ev.preventDefault();return}
  if(ev.shiftKey&&document.activeElement===els[0]){ev.preventDefault();els.at(-1).focus()}
  else if(!ev.shiftKey&&document.activeElement===els.at(-1)){ev.preventDefault();els[0].focus()}
 });
 function home(){session=null;
   let last=data.history.at(-1);
   el(`   <div class="qz-maincard"><div class="qz-label">ВЫБЕРИТЕ ФОРМАТ</div><div class="qz-modes"><button data-qz-start="train" class="qz-mode"><span class="qz-mode-no">01</span><strong>Тренировка</strong><small>9 вопросов. После каждого ответа сразу объяснение и ссылка на закон. По 3 задания каждого уровня.</small><span>Начать тренировку ↗</span></button><button data-qz-start="exam" class="qz-mode"><span class="qz-mode-no">02</span><strong>Экзамен</strong><small>15 вопросов. По 5 заданий на каждый уровень. Правильные ответы раскрываются только в итогах.</small><span>Начать экзамен ↗</span></button><button data-qz-start="mistakes" class="qz-mode" ${data.missed.length?'':'disabled'}><span class="qz-mode-no">03</span><strong>Работа над ошибками</strong><small>${data.missed.length?'Неправильные ответы из прошлых прохождений. От простого к сложному.':'Появится после первого неверного ответа.'}</small><span>${data.missed.length?'Повторить ошибки ↗':'Пока нет ошибок'}</span></button></div></div>
`);
 }
 function start(mode){
  let list;
  if(mode==='mistakes'){
   const ids=new Set(data.missed);list=bank.filter(q=>ids.has(q.id));list=shuffled(list).slice(0,15).sort((a,b)=>a.level-b.level);
  }else{
   const n=mode==='exam'?5:3;
   list=[1,2,3].flatMap(l=>shuffled(bank.filter(q=>q.level===l)).slice(0,n));
  }
  if(!list.length){home();return}
  // Shuffle answers independently every time; do not change the bank.
  list=list.map(q=>{const options=shuffled(q.options.map((text,i)=>({text,i})));return {...q,shown:options,answer:options.findIndex(x=>x.i===q.correct)}});
  session={mode,list,index:0,answers:{},started:Date.now(),done:false};question();
 }
 function progressView(q){const n=session.index;
  return `<div class="qz-trail">${[1,2,3].map(level=>`<span class="${q.level===level?'current':q.level>level?'complete':''}"><i>0${level}</i> ${TITLE[level]}</span>`).join('')}</div><div class="qz-topline"><span>УРОВЕНЬ ${q.level} · ${TITLE[q.level].toUpperCase()}</span><span>ВОПРОС ${n+1} / ${session.list.length}</span></div><div class="qz-meter"><div style="width:${100*n/session.list.length}%"></div></div>`}
 function question(){const q=session.list[session.index],choice=session.answers[q.id],answered=choice!==undefined;
   el(`<div class="qz-play">${progressView(q)}<article class="qz-card"><div class="qz-question-kicker">${q.level===1?'ЗНАНИЕ ПРАВИЛ':q.level===2?'ПРАКТИЧЕСКАЯ ЗАДАЧА':'РАЗБОР СИТУАЦИИ'} <span>${source(q)}</span></div><h2>${esc(q.question)}</h2><div class="qz-answers">${q.shown.map((a,i)=>`<button type="button" class="qz-answer ${answered?(session.mode!=='exam'&&i===q.answer?'is-correct':choice===i?'is-chosen':'') : ''}" data-qz-answer="${i}" ${answered?'disabled':''}><span>${'АБВГ'[i]}</span><b>${esc(a.text)}</b></button>`).join('')}</div>${answered&&session.mode!=='exam'?`<div class="qz-feedback ${choice===q.answer?'good':'bad'}"><strong>${choice===q.answer?'Ответ верный':'Ответ неверный'}</strong><p>${esc(q.explanation)}</p>${sourceButton(q)}</div>`:''}<div class="qz-actions"><button class="qz-secondary" data-qz-home>К выбору режима</button>${answered?`<button class="qz-primary" data-qz-next>${session.index===session.list.length-1?'Завершить проверку':'Следующий вопрос'} →</button>`:'<span class="qz-wait">Выберите один ответ</span>'}</div></article></div>`)
 }
 function answer(index){if(!session || session.done || session.answers[session.list[session.index].id]!==undefined)return;
   const q=session.list[session.index];session.answers[q.id]=index;question();
 }
 function next(){if(!session)return;if(session.index===session.list.length-1){results();return}session.index++;question()}
 function results(){if(!session)return;session.done=true;
  let num=0;const misses=new Set(data.missed);const details=session.list.map(q=>{const choice=session.answers[q.id];const ok=choice===q.answer;if(ok){num++;misses.delete(q.id)}else misses.add(q.id);return{q,choice,ok}});
  data.missed=[...misses];data.attempts+=1;const elapsed=Math.round((Date.now()-session.started)/1000);
  data.history.push({at:new Date().toISOString(),mode:session.mode,score:num,total:session.list.length,secs:elapsed});data.history=data.history.slice(-40);save();
  const lvl=Array.from({length:3},(_,i)=>({level:i+1,questions:details.filter(x=>x.q.level===i+1)})).filter(x=>x.questions.length);
  el(`<div class="qz-final"><div class="qz-kicker">ПРОВЕРКА ЗАВЕРШЕНА</div><h1>Результат <em>${Math.round(100*num/details.length)}%</em></h1><div class="qz-total"><div><strong>${num}<span> / ${details.length}</span></strong><p>Правильных ответов</p></div><div><strong>${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}</strong><p>Время выполнения</p></div></div><div class="qz-level-results">${lvl.map(x=>`<div><span>0${x.level} · ${TITLE[x.level]}</span><b>${x.questions.filter(y=>y.ok).length} / ${x.questions.length}</b></div>`).join('')}</div><div class="qz-actions"><button class="qz-primary" data-qz-home>К выбору режима</button>${data.missed.length?'<button class="qz-secondary" data-qz-start="mistakes">Повторить ошибки</button>':''}</div><h2 class="qz-review-heading">Разбор ответов</h2><div class="qz-review">${details.map((d,i)=>`<details class="qz-review-row"><summary><span class="${d.ok?'ok':'no'}">${d.ok?'✓':'×'}</span><div><small>ВОПРОС ${i+1} · УРОВЕНЬ ${d.q.level}</small><b>${esc(d.q.question)}</b></div><span>⌄</span></summary><div class="qz-review-body"><p><strong>Ваш ответ</strong> ${esc(d.q.shown[d.choice]?.text||'Ответ не выбран')}</p><p><strong>Правильный ответ</strong> ${esc(d.q.shown[d.q.answer].text)}</p><p>${esc(d.q.explanation)}</p><small>${esc(source(d.q))}</small><div>${sourceButton(d.q)}</div></div></details>`).join('')}</div></div>`)
 }
 node.addEventListener('click',ev=>{
  const btn=ev.target.closest('button');if(!btn)return;
  if(btn.hasAttribute('data-qz-start')){start(btn.dataset.qzStart);return}
  if(btn.hasAttribute('data-qz-home')){home();return}
  if(btn.hasAttribute('data-qz-answer')){answer(Number(btn.dataset.qzAnswer));return}
  if(btn.hasAttribute('data-qz-next')){next();return}
  if(btn.hasAttribute('data-qz-law')){
   sourceOpen(btn.dataset.qzLaw,btn.dataset.qzArticle,btn);return;
  }
 });
 // draw only when the section is first opened, keep current test when switching to laws
 document.addEventListener('click',ev=>{const link=ev.target.closest('[data-page="quiz"]');if(link && !session)home()});
 if(location.hash==='#quiz')home();else home();
 window.FSO_QUIZ_TEST={getBank:()=>bank,begin:start,answer,next,results,home,getSession:()=>session,getProgress:()=>data};
})();
