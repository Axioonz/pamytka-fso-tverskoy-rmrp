/* Генератор докладов и общий учёт активных постов. */
(()=>{
'use strict';
const root=document.getElementById('post-duty');
if(!root)return;
const get=id=>document.getElementById(id);
const rank=get('post-duty-rank'),surname=get('post-duty-surname'),post=get('post-duty-post'),condition=get('post-duty-condition'),incident=get('post-duty-incident'),incidentField=get('post-duty-incident-field');
const checkin=get('post-duty-checkin'),checkout=get('post-duty-checkout'),status=get('post-duty-status'),live=get('post-duty-live'),own=get('post-duty-own');
const roster=get('post-duty-roster'),total=get('post-duty-total');
const postNames={'1':'КПП №1','2':'КПП №2','3':'КПП Правительства'};
const reports={start:get('post-duty-report-start'),current:get('post-duty-report-current'),end:get('post-duty-report-end')};
const url='https://lejagyuibxdnvpmxoggy.supabase.co';
const key='sb_publishable_8cdFcw4V8F545924bpdLjg_3yKTHt1d';
const tokenKey='fso_post_duty_device_v1';
const surnameKey='fso_post_duty_surname_v1',rankKey='fso_post_duty_rank_v1';
let db=null,token=null,active=[],mine=null,busy=false,popupPostId=null;
const safe=v=>String(v||'').trim();
const personCount=n=>n+' '+(n%10===1&&n%100!==11?'сотрудник':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'сотрудника':'сотрудников');
const conditionText={stable:'стабильная',attention:'повышенное внимание',violation:'нарушение',emergency:'чрезвычайная ситуация'};
function incidentRequired(){return condition.value==='violation'||condition.value==='emergency'}
function updateIncident(){
  incidentField.hidden=!incidentRequired();
  incident.required=incidentRequired();
}
const postRows=id=>active.filter(row=>row.post_id===id);
function setStatus(value,isError=false){status.textContent=value;status.classList.toggle('is-error',isError)}
function saveInputs(){
  try{localStorage.setItem(surnameKey,safe(surname.value));localStorage.setItem(rankKey,rank.value)}catch{}
}
function loadInputs(){
  try{surname.value=localStorage.getItem(surnameKey)||'';rank.value=localStorage.getItem(rankKey)||''}catch{}
}
function ensureToken(){
  try{
    let value=localStorage.getItem(tokenKey);
    if(value&&/^[a-f0-9]{64}$/.test(value))return value;
    if(!window.crypto?.getRandomValues)throw Error('Браузер не поддерживает безопасную генерацию ключа');
    const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
    value=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(tokenKey,value);
    return value;
  }catch(error){throw Error('Невозможно сохранить отметку: нужен доступ к локальному хранилищу браузера и защищённое соединение.')}
}
function prettyRank(v){
  const t=safe(v);
  return t?t.charAt(0).toUpperCase()+t.slice(1).toLowerCase():'[звание]';
}
function fullName(r,s){return prettyRank(r)+' '+(safe(s)||'[фамилия]')}
function buildReport(type){
  const id=post.value;
  const title=postNames[id]||'КПП №1';
  const name=fullName(rank.value,surname.value);
  const already=!!mine&&mine.post_id===id;
  const count=Math.max(1,postRows(id).length+(already?0:1));
  const state=conditionText[condition.value]||conditionText.stable;
  const verb=type==='start'?'Заступил на '+title+'. ':type==='end'?'Покинул '+title+'. ':title+'. ';
  let result=verb+name+'. Состав: '+personCount(count)+'. Обстановка: '+state+'.';
  const details=incidentRequired()?safe(incident.value).replace(/\s+/g,' '):'';
  if(details)result+=' Описание: '+details+(/[.!?]$/.test(details)?'':'.');
  return result;
}
function updateReports(){for(const type of Object.keys(reports))reports[type].textContent=buildReport(type)}
function setBusy(value){busy=value;checkin.disabled=value||!db||!token;checkout.disabled=value||!db||!token||!mine}
function ownStatus(){
  own.classList.toggle('is-active',!!mine);
  own.textContent=mine?'Вы заступили на '+(postNames[mine.post_id]||'пост')+'. '+fullName(mine.rank,mine.surname)+'.':'Вы пока не заступили на пост.';
  checkin.textContent=mine?'Обновить или сменить пост':'Заступить на пост';
  setBusy(busy);
}
function node(tag,className,value){const el=document.createElement(tag);if(className)el.className=className;if(value!==undefined)el.textContent=value;return el}
function drawRoster(){
  total.textContent=String(active.length);
  const holder=node('div','post-duty-roster-items');
  for(const id of Object.keys(postNames)){
    const people=postRows(id),section=node('div','post-duty-roster-post'),head=node('div','post-duty-roster-post-head');
    head.append(node('span','',postNames[id]),node('small','',people.length?personCount(people.length):'Свободен'));
    section.append(head);
    if(people.length){
      const list=node('ul','');
      for(const row of people)list.append(node('li','',fullName(row.rank,row.surname)));
      section.append(list);
    }
    holder.append(section);
  }
  roster.replaceChildren(holder);
  drawMap();
  updateReports();
}
function drawMap(){
  const layer=get('postmap-post-layer');if(!layer)return;
  const ns='http://www.w3.org/2000/svg';
  for(const el of layer.querySelectorAll('[data-post]')){
    const id=el.dataset.post,count=postRows(id).length;
    el.classList.toggle('has-shift',count>0);
    el.setAttribute('aria-label',postNames[id]+(count?' · '+personCount(count):' · свободен'));
    let badge=el.querySelector('.postmap-count-badge');
    if(!badge){
      badge=document.createElementNS(ns,'g');badge.setAttribute('class','postmap-count-badge');
      const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx','16');circle.setAttribute('cy','-15');circle.setAttribute('r','11');
      const label=document.createElementNS(ns,'text');label.setAttribute('x','16');label.setAttribute('y','-15');
      badge.append(circle,label);el.append(badge);
    }
    badge.hidden=count===0;badge.style.display=count?'':'none';
    badge.querySelector('text').textContent=String(count);
  }
  showPopupRoster();
}
function showPopupRoster(){
  const popup=get('postmap-popup');if(!popup)return;
  let extra=get('postmap-occupancy');
  if(!extra){extra=node('div','postmap-occupancy');extra.id='postmap-occupancy';popup.append(extra)}
  const currentId=popupPostId||post.value;
  const rows=postRows(currentId);
  const heading=node('strong','',rows.length?'На посту: '+personCount(rows.length):'Пост свободен');
  extra.replaceChildren(heading);
  if(rows.length){
    const ul=node('ul','');
    for(const row of rows)ul.append(node('li','',fullName(row.rank,row.surname)));
    extra.append(ul);
  }
}
async function refresh(){
  if(!db)return;
  try{
    const results=await Promise.all([
      db.rpc('fso_post_active'),
      token?db.rpc('fso_post_mine',{p_token:token}):Promise.resolve({data:null,error:null})
    ]);
    if(results[0].error)throw results[0].error;
    if(results[1].error)throw results[1].error;
    active=Array.isArray(results[0].data)?results[0].data:[];
    mine=results[1].data||null;
    live.textContent='Карта обновлена';live.classList.add('is-ok');live.classList.remove('is-error');
    drawRoster();ownStatus();
  }catch(error){
    live.textContent='Не удалось загрузить дежурства';live.classList.remove('is-ok');live.classList.add('is-error');
    console.warn('Посты: синхронизация',error);
  }
}
async function checkIn(){
  if(busy||!db||!token)return;
  const name=safe(surname.value);
  if(!rank.value){setStatus('Выберите звание.',true);rank.focus();return}
  if(!/^[А-Яа-яЁёA-Za-z][А-Яа-яЁёA-Za-z-]{1,49}$/.test(name)){setStatus('Введите фамилию (от 2 до 50 букв).',true);surname.focus();return}
  setBusy(true);setStatus('Сохраняю заступление…');
  try{
    const result=await db.rpc('fso_post_checkin',{p_token:token,p_post_id:post.value,p_rank:rank.value,p_surname:name});
    if(result.error)throw result.error;
    saveInputs();
    mine=result.data;
    setStatus('Вы заступили на '+postNames[post.value]+'.');
    await refresh();
  }catch(err){setStatus('Заступить не удалось. '+(err?.message||'Ошибка связи'),true);console.error(err)}
  finally{setBusy(false)}
}
async function checkOut(){
  if(busy||!db||!token||!mine)return;
  setBusy(true);setStatus('Завершаю дежурство…');
  try{
    const result=await db.rpc('fso_post_checkout',{p_token:token});
    if(result.error)throw result.error;
    mine=null;
    setStatus('Дежурство завершено. Отметка снята с карты.');
    await refresh();
  }catch(err){setStatus('Не удалось снять отметку. '+(err?.message||'Ошибка связи'),true);console.error(err)}
  finally{setBusy(false)}
}
async function copyReport(type,button){
  const text=buildReport(type);
  if(!rank.value||!safe(surname.value)){setStatus('Сначала укажите звание и фамилию.',true);return}
  if(incidentRequired()&&!safe(incident.value)){
    setStatus('Укажите описание происшествия перед копированием доклада.',true);
    incident.focus();
    return;
  }
  try{
    if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);
    else{
      const area=node('textarea','');area.value=text;area.style.cssText='position:fixed;left:-9999px;top:0;';
      document.body.append(area);area.select();
      const ok=document.execCommand('copy');area.remove();if(!ok)throw Error('Ошибка буфера обмена');
    }
    setStatus('Доклад скопирован.');
    const original=button.textContent;button.textContent='Скопировано';
    setTimeout(()=>{if(button.isConnected)button.textContent=original},1800);
  }catch(e){setStatus('Не удалось скопировать доклад.',true)}
}
for(const el of [rank,surname,post,condition]){
  el.addEventListener('change',()=>{if(el===condition)updateIncident();updateReports();if(el===rank||el===surname)saveInputs()});
  if(el===surname)el.addEventListener('input',updateReports);
}
incident.addEventListener('input',updateReports);
checkin.addEventListener('click',checkIn);checkout.addEventListener('click',checkOut);
root.querySelectorAll('[data-post-duty-copy]').forEach(button=>button.addEventListener('click',()=>copyReport(button.dataset.postDutyCopy,button)));
const layer=get('postmap-post-layer');
layer?.addEventListener('pointerup',e=>{
  const el=e.target.closest?.('[data-post]');
  if(el){popupPostId=el.dataset.post;post.value=popupPostId;updateReports();setTimeout(showPopupRoster,0)}
},true);
layer?.addEventListener('keydown',e=>{
  const el=e.target.closest?.('[data-post]');
  if(el&&(e.key==='Enter'||e.key===' ')){popupPostId=el.dataset.post;post.value=popupPostId;updateReports();setTimeout(showPopupRoster,0)}
},true);
post.addEventListener('change',()=>{popupPostId=post.value;showPopupRoster()});
get('postmap-popup-close')?.addEventListener('click',()=>{popupPostId=null});
loadInputs();updateIncident();drawRoster();ownStatus();
(async()=>{
  try{
    token=ensureToken();
    if(!window.supabase?.createClient)throw Error('Не загрузилась библиотека базы данных');
    db=window.supabase.createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:1}}});
    setBusy(false);
    await refresh();
    window.setInterval(()=>{if(!document.hidden)refresh()},15000);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  }catch(error){
    live.textContent='Дежурства недоступны';live.classList.add('is-error');
    setStatus(error.message||'Ошибка инициализации',true);
    setBusy(false);
  }
})();
})();
