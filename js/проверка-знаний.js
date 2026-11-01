/* ДВИЖОК «Проверка знаний». Вопросы отдельно в data/09-проверка-знаний.js. */
(()=>{
 'use strict';
 const node=document.getElementById('quiz-screen');
 const bank=Array.isArray(window.FSO_QUIZ_QUESTIONS)?window.FSO_QUIZ_QUESTIONS:[];
 if(!node)return;
 const STORE='fso-rmrp-quiz-progress-v1';
 const TITLE={1:'Основы',2:'Применение',3:'Сложные ситуации'};
 const DESCR={1:'Термины, назначения и прямые правила.',2:'Применение одной нормы на практике.',3:'Несколько норм, исключения и границы полномочий.'};
 let data=load(),session=null;
 function load(){try{const x=JSON.parse(localStorage.getItem(STORE)||'{}');return {history:Array.isArray(x.history)?x.history.slice(-40):[],missed:Array.isArray(x.missed)?x.missed:[],attempts:Number(x.attempts)||0}}catch{return {history:[],missed:[],attempts:0}}}
 function save(){try{localStorage.setItem(STORE,JSON.stringify(data))}catch{}}
 function shuffled(list){const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a}
 function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function el(html){node.innerHTML=html}
 function source(q){return q.source.document==='concept'?'Понятия · '+q.source.article:(q.source.document==='law-25069'?'ФЗ «О ФСО»':'Процессуальный кодекс')+' · ст. '+q.source.article}
 function sourceButton(q){return `<button type="button" class="qz-secondary" data-qz-law="${esc(q.source.document)}" data-qz-article="${esc(q.source.article)}">Открыть источник ↗</button>`}
 function home(){session=null;
   let last=data.history.at(-1);
   el(`<div class="qz-heading"><div class="qz-kicker">ФСО / СЛУЖЕБНАЯ ПОДГОТОВКА <span>01 / KNOWLEDGE</span></div><h1>Проверка <em>знаний</em></h1><p>Не заучивание номеров статей, а проверка того, понимаете ли вы полномочия, ограничения и порядок действий. Сложность растёт от простых правил до ситуаций, где нужно учитывать несколько условий.</p></div>
   <div class="qz-stages">${[1,2,3].map(n=>`<div class="qz-stage"><div class="qz-stage-idx">0${n}<span> / УРОВЕНЬ</span></div><b>${TITLE[n]}</b><p>${DESCR[n]}</p><span class="qz-stage-tag">${bank.filter(x=>x.level===n).length} вопросов в базе</span></div>`).join('')}</div>
   <div class="qz-maincard"><div class="qz-label">ВЫБЕРИТЕ ФОРМАТ</div><div class="qz-modes"><button data-qz-start="train" class="qz-mode"><span class="qz-mode-no">01</span><strong>Тренировка</strong><small>9 вопросов. После каждого ответа сразу объяснение и ссылка на закон. По 3 задания каждого уровня.</small><span>Начать тренировку ↗</span></button><button data-qz-start="exam" class="qz-mode"><span class="qz-mode-no">02</span><strong>Экзамен</strong><small>15 вопросов. По 5 заданий на каждый уровень. Правильные ответы раскрываются только в итогах.</small><span>Начать экзамен ↗</span></button><button data-qz-start="mistakes" class="qz-mode" ${data.missed.length?'':'disabled'}><span class="qz-mode-no">03</span><strong>Работа над ошибками</strong><small>${data.missed.length?'Неправильные ответы из прошлых прохождений. От простого к сложному.':'Появится после первого неверного ответа.'}</small><span>${data.missed.length?'Повторить ошибки ↗':'Пока нет ошибок'}</span></button></div></div>
   <div class="qz-foot"><div>Банк заданий <b>${bank.length}</b> · Генерация вопросов <b>не используется</b></div><div>Пройдено проверок <b>${data.attempts}</b>${last?' · Последний результат <b>'+last.score+'/'+last.total+'</b>':''}</div></div>
   <div class="qz-disclaimer">Вопросы подготовлены по текстам законов, включённым в памятку. Перед применением нормы в службе сверяйте её действующую редакцию.</div>`);
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
   const doc=btn.dataset.qzLaw;
   if(doc==='concept'){go('concepts');return}
   go('laws');
   if(typeof openLaw==='function')Promise.resolve(openLaw(doc)).then(()=>{
    const n=btn.dataset.qzArticle;
    const h=[...document.querySelectorAll('#law-document .law-article')].find(e=>e.textContent.trim().startsWith('Статья '+n+'.')||e.textContent.trim().startsWith('Статья '+n+' '));
    if(h)h.scrollIntoView({behavior:'smooth',block:'start'});
   }).catch(()=>{});
  }
 });
 // draw only when the section is first opened, keep current test when switching to laws
 document.addEventListener('click',ev=>{const link=ev.target.closest('[data-page="quiz"]');if(link && !session)home()});
 if(location.hash==='#quiz')home();else home();
 window.FSO_QUIZ_TEST={getBank:()=>bank,begin:start,answer,next,results,home,getSession:()=>session,getProgress:()=>data};
})();
