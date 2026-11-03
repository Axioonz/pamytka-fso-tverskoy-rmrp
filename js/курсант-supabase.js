(()=>{'use strict';
const endpoint='https://lejagyuibxdnvpmxoggy.supabase.co/functions/v1/fso-cadet-exam';
const root=document.getElementById('main'),KEY='fso_exam_code_session';
let code='',state=null,index=0,busy=false,timer=null;
let serverClock=NaN,serverClockAt=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=s=>s?new Date(s).toLocaleString('ru-RU'):'';
const badge=(i,answered)=>'<span class="tag '+(answered?'good':'')+'">'+(answered?'✓ ':'')+'Вопрос '+(i+1)+'</span>';
function stopTimer(){if(timer){clearInterval(timer);timer=null}}
function errorBox(err){root.querySelector('#cadet-error')?.replaceChildren(document.createTextNode(err.message||String(err)))}
async function call(action,extra={}){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,code,...extra}),cache:'no-store'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Ошибка подключения к серверу');
 // Use the server clock, not the trainee's device date/time.
 // performance.now() is monotonic and unaffected by local clock changes.
 const timestamp=Date.parse(result.server_now||'');
 if(Number.isFinite(timestamp)){serverClock=timestamp;serverClockAt=performance.now()}
 return result;
}
function renderLogin(message=''){
 stopTimer();root.innerHTML='<div class="auth-layout">'+
 '<div class="eyebrow">FSO / АТТЕСТАЦИЯ</div><h1>Для курсантов</h1>'+
 '<p class="lead">Введите индивидуальный код, выданный руководством. По нему откроется только назначенный вам экзамен. Памятка остаётся общедоступной.</p>'+
 '<section class="section"><h2>Вход по коду</h2>'+(message?'<div class="message error">'+esc(message)+'</div>':'')+
 '<form id="cadet-login"><label>Индивидуальный код<input id="cadet-code" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="FSO-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" value="'+esc(code)+'"></label>'+
 '<div class="actions"><button class="btn primary" type="submit">Открыть экзамен</button><a class="btn" href="./кабинет.html">Не курсант?</a></div></form>'+
 '<div class="foot">Не передавайте свой код другим пользователям. Он даёт доступ к вашей попытке.</div></section></div>';
 document.getElementById('cadet-login').onsubmit=async e=>{e.preventDefault();const input=document.getElementById('cadet-code');const entered=input.value.trim().toUpperCase();
  if(!/^FSO-[0-9A-F]{32}$/.test(entered)){renderLogin('Проверьте код. Он должен содержать FSO- и 32 символа.');return}
  code=entered;sessionStorage.setItem(KEY,code);await load('start');
 };
}
async function load(action,extra={}){
 if(busy)return;busy=true;
 root.innerHTML='<div class="section">Соединение с сервером аттестации...</div>';
 try{state=await call(action,extra);render()}
 catch(err){if(action==='start'){sessionStorage.removeItem(KEY);code='';renderLogin(err.message)}else{render();const box=document.getElementById('cadet-error');if(box)box.textContent=err.message}}
 finally{busy=false}
}
function render(){
 stopTimer();if(!state){renderLogin();return}
 if(state.status==='completed'){renderResult();return}
 const items=state.questions||[];if(!items.length){renderLogin('В экзамене нет вопросов');return}
 index=Math.max(0,Math.min(index,items.length-1));
 const item=items[index],answers=state.answers||{}, chosen=answers[item.ordinal]?.[0];
 const answered=Object.values(answers).filter(a=>Array.isArray(a)&&a.length).length;
 root.innerHTML='<div class="eyebrow">FSO / ИНДИВИДУАЛЬНЫЙ ЭКЗАМЕН</div><h1>'+esc(state.title)+'</h1>'+
 '<p class="head-subtitle">'+esc(state.member)+' · Попытка '+esc(state.attempts_used)+' из '+esc(state.max_attempts)+'</p>'+
 '<div class="row between"><div class="tag">Отвечено '+answered+' / '+items.length+'</div><div class="tag" id="cadet-clock">Осталось времени</div></div>'+
 '<div class="progress"><div style="width:'+Math.round(answered/items.length*100)+'%"></div></div>'+
 '<section class="section"><div class="row between">'+badge(index,chosen!==undefined)+'<span class="subtle">Вопрос '+(index+1)+' из '+items.length+'</span></div>'+
 '<div class="question"><h2>'+esc(item.prompt)+'</h2>'+
 item.options.map((x,i)=>'<button class="option '+(chosen===i?'selected':'')+'" type="button" data-answer="'+i+'"><b>'+String.fromCharCode(65+i)+'</b><span>'+esc(x)+'</span></button>').join('')+
 '</div><div class="row between"><div class="actions"><button class="btn" id="cadet-prev" '+(!index?'disabled':'')+'>Назад</button>'+
 '<button class="btn" id="cadet-next" '+(index>=items.length-1?'disabled':'')+'>Дальше</button></div>'+
 '<button class="btn primary" id="cadet-finish">Завершить экзамен</button></div><div id="cadet-error" class="text-danger" role="alert"></div></section>';
 document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>answer(item.ordinal,Number(b.dataset.answer)));
 document.getElementById('cadet-prev').onclick=()=>{index--;render()};
 document.getElementById('cadet-next').onclick=()=>{index++;render()};
 document.getElementById('cadet-finish').onclick=()=>{
  if(answered===0){
   document.getElementById('cadet-error').textContent='Сначала ответьте хотя бы на один вопрос.';
   return;
  }
  if(confirm('Завершить экзамен и отправить ответы на проверку?'))load('finish',{confirmed:true});
 };
 startTimer();
}
async function answer(ordinal,chosen){
 if(busy)return;busy=true;
 document.querySelectorAll('[data-answer]').forEach(b=>b.disabled=true);
 try{state=await call('answer',{ordinal,chosen});render()}
 catch(err){render();const box=document.getElementById('cadet-error');if(box)box.textContent=err.message}
 finally{busy=false}
}
function startTimer(){
 const el=document.getElementById('cadet-clock');if(!el)return;
 const tick=()=>{
  if(!state||state.status==='completed')return;
  if(!state.deadline_at){el.textContent='Без ограничения времени';return}
  if(!Number.isFinite(serverClock)){
   el.textContent='Синхронизация времени с сервером';
   return;
  }
  const monotonicNow=serverClock+(performance.now()-serverClockAt);
  const left=Math.max(0,Math.ceil((Date.parse(state.deadline_at)-monotonicNow)/1000));
  const min=Math.floor(left/60),sec=String(left%60).padStart(2,'0');
  el.textContent='Осталось '+min+':'+sec;
  if(left===0&&!busy){
   // Only the server decides whether the deadline has actually expired.
   stopTimer();load('start');
  }
 };
 tick();timer=setInterval(tick,1000);
}
function renderResult(){
 const r=state.result||{correct:0,total:0,percent:0,passed:false};
 root.innerHTML='<div class="eyebrow">FSO / РЕЗУЛЬТАТ АТТЕСТАЦИИ</div>'+
 '<h1>'+esc(r.passed?'Экзамен сдан':'Экзамен не сдан')+'</h1>'+
 '<p class="head-subtitle">'+esc(state.member)+' · '+esc(state.title)+'</p>'+
 '<div class="cards"><div class="metric"><b>'+esc(r.correct)+' / '+esc(r.total)+'</b><span>Верных ответов</span></div>'+
 '<div class="metric"><b>'+esc(r.percent)+'%</b><span>Ваш результат</span></div>'+
 '<div class="metric"><b>'+esc(state.pass_percent)+'%</b><span>Проходной балл</span></div></div>'+
 '<section class="section"><div class="'+(r.passed?'message good':'message error')+'">'+
 (r.passed?'Результат сохранён. Окончательное решение о зачислении принимает руководство.':'Результат сохранён. Руководство увидит его в личном кабинете.')+
 '</div><p class="hint">Осталось попыток · '+esc(state.retries_remaining)+'</p>'+
 '<div class="actions">'+(state.retries_remaining>0?'<button class="btn primary" id="cadet-retry">Начать пересдачу</button>':'')+
 '<button class="btn" id="cadet-close">Выйти</button></div><div id="cadet-error" role="alert" class="text-danger"></div></section>';
 const retry=document.getElementById('cadet-retry');if(retry)retry.onclick=()=>{if(confirm('Начать новую попытку?')){index=0;load('retry')}};
 document.getElementById('cadet-close').onclick=()=>{stopTimer();sessionStorage.removeItem(KEY);code='';state=null;renderLogin()};
}
async function open(){
 stopTimer();code=sessionStorage.getItem(KEY)||'';
 if(code){await load('start')}else renderLogin();
}
window.FSO_CADET={open};
})();