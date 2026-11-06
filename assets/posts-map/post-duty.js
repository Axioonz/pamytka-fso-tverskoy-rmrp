/* Общая карта постов, генератор докладов и авторизация через служебный кабинет. */
(()=>{
'use strict';
const root=document.getElementById('post-duty');
if(!root)return;
const get=id=>document.getElementById(id);
const gate=get('post-duty-gate'),gateMessage=get('post-duty-gate-message'),authorized=get('post-duty-authorized');
const identityLabel=get('post-duty-identity');
const post=get('post-duty-post'),condition=get('post-duty-condition'),incident=get('post-duty-incident'),incidentField=get('post-duty-incident-field');
const checkin=get('post-duty-checkin'),checkout=get('post-duty-checkout'),status=get('post-duty-status'),live=get('post-duty-live'),own=get('post-duty-own');
const roster=get('post-duty-roster'),total=get('post-duty-total');
const reports={start:get('post-duty-report-start'),current:get('post-duty-report-current'),end:get('post-duty-report-end')};
const postNames={'1':'КПП №1','2':'КПП №2','3':'КПП Правительства'};
const conditionText={stable:'стабильная',attention:'повышенное внимание',violation:'нарушение',emergency:'чрезвычайная ситуация'};
const url='https://lejagyuibxdnvpmxoggy.supabase.co';
const key='sb_publishable_8cdFcw4V8F545924bpdLjg_3yKTHt1d';
let db=null,identity=null,mine=null,active=[],counts={'1':0,'2':0,'3':0};
let busy=false,popupPostId=null,authSerial=0,refreshSerial=0;
const safe=v=>String(v??'').trim();
const personCount=n=>n+' '+(n%10===1&&n%100!==11?'сотрудник':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'сотрудника':'сотрудников');
const node=(tag,className,value)=>{const el=document.createElement(tag);if(className)el.className=className;if(value!==undefined)el.textContent=value;return el};
const postCount=id=>Number(counts[id]||0);
const postRows=id=>active.filter(x=>x.post_id===id);
const incidentRequired=()=>condition.value==='violation'||condition.value==='emergency';
const publicName=x=>safe(x.rank)+' '+safe(x.surname)+(x.first_name?' '+x.first_name.charAt(0)+'.':'')+(x.employee_number?' · №'+x.employee_number:'');
const reportName=x=>safe(x.rank)+' '+safe(x.surname);
function setStatus(value,bad=false){status.textContent=value;status.classList.toggle('is-error',bad)}
function setLive(value,bad=false){live.textContent=value;live.classList.toggle('is-error',bad);live.classList.toggle('is-ok',!bad)}
function setBusy(value){
  busy=value;
  checkin.disabled=value||!identity||!db;
  checkout.disabled=value||!identity||!db||!mine;
}
function setLocked(message){
  identity=null;mine=null;active=[];
  gate.hidden=false;authorized.hidden=true;
  gateMessage.textContent=message;
  identityLabel.textContent='';
  setBusy(false);
  for(const el of Object.values(reports))el.textContent='';
  drawRoster();
}
function setReady(details){
  identity=details;
  gate.hidden=true;authorized.hidden=false;
  identityLabel.textContent=publicName(details)+' · Личный кабинет подтверждён';
  updateReports();setBusy(false);
}
function updateIncident(){incidentField.hidden=!incidentRequired();incident.required=incidentRequired()}
function buildReport(type){
  if(!identity)return '';
  const id=post.value,title=postNames[id]||postNames['1'];
  const count=Math.max(1,postCount(id)+(!mine||mine.post_id!==id?1:0));
  const prefix=type==='start'?'Заступил на '+title+'. ':type==='end'?'Покинул '+title+'. ':title+'. ';
  let result=prefix+reportName(identity)+'. Состав: '+personCount(count)+'. Обстановка: '+(conditionText[condition.value]||conditionText.stable)+'.';
  const explanation=incidentRequired()?safe(incident.value).replace(/\s+/g,' '):'';
  if(explanation)result+=' Описание: '+explanation+(/[.!?]$/.test(explanation)?'':'.');
  return result;
}
function updateReports(){
  if(!identity)return;
  for(const type of Object.keys(reports))reports[type].textContent=buildReport(type);
}
function ownStatus(){
  own.classList.toggle('is-active',!!mine);
  own.textContent=mine?'Вы заступили на '+(postNames[mine.post_id]||'пост')+'. '+publicName(identity)+'.':'Вы пока не заступили на пост.';
  checkin.textContent=mine?'Обновить или сменить пост':'Заступить на пост';
  setBusy(busy);
}
function drawRoster(){
  total.textContent=String(Object.values(counts).reduce((sum,n)=>sum+Number(n||0),0));
  const holder=node('div','post-duty-roster-items');
  for(const id of Object.keys(postNames)){
    const count=postCount(id),people=postRows(id);
    const block=node('div','post-duty-roster-post'),head=node('div','post-duty-roster-post-head');
    head.append(node('span','',postNames[id]),node('small','',count?personCount(count):'Свободен'));
    block.append(head);
    if(identity&&people.length){
      const list=node('ul','');
      for(const row of people)list.append(node('li','',publicName(row)));
      block.append(list);
    }
    holder.append(block);
  }
  roster.replaceChildren(holder);
  drawMap();
  updateReports();
}
function drawMap(){
  const layer=get('postmap-post-layer');
  if(!layer)return;
  const ns='http://www.w3.org/2000/svg';
  for(const marker of layer.querySelectorAll('[data-post]')){
    const id=marker.dataset.post,count=postCount(id);
    marker.classList.toggle('has-shift',count>0);
    marker.setAttribute('aria-label',postNames[id]+(count?' · '+personCount(count):' · свободен'));
    let badge=marker.querySelector('.postmap-count-badge');
    if(!badge){
      badge=document.createElementNS(ns,'g');badge.setAttribute('class','postmap-count-badge');
      const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx','16');circle.setAttribute('cy','-15');circle.setAttribute('r','11');
      const text=document.createElementNS(ns,'text');text.setAttribute('x','16');text.setAttribute('y','-15');
      badge.append(circle,text);marker.append(badge);
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
  const id=popupPostId||post.value||'1',count=postCount(id);
  const heading=node('strong','',count?'На посту: '+personCount(count):'Пост свободен');
  extra.replaceChildren(heading);
  if(identity){
    const list=postRows(id);
    if(list.length){
      const ul=node('ul','');
      for(const row of list)ul.append(node('li','',publicName(row)));
      extra.append(ul);
    }
  }else if(count){
    extra.append(node('p','','Состав доступен после входа в личный кабинет.'));
  }
}
function recalcCountsFromRoster(){
  counts={'1':0,'2':0,'3':0};
  for(const row of active)if(Object.prototype.hasOwnProperty.call(counts,row.post_id))counts[row.post_id]++;
}
async function refreshCounts(){
  if(!db)return;
  const serial=++refreshSerial;
  try{
    const r=await db.rpc('fso_post_counts');
    if(r.error)throw r.error;
    if(serial!==refreshSerial||identity)return;
    counts={'1':0,'2':0,'3':0};
    for(const row of Array.isArray(r.data)?r.data:[]){
      if(Object.prototype.hasOwnProperty.call(counts,row.post_id))counts[row.post_id]=Number(row.count)||0;
    }
    drawRoster();
    setLive('Карта обновлена');
  }catch(error){if(serial===refreshSerial)setLive('Не удалось загрузить карту',true)}
}
async function refresh(){
  if(!db)return;
  if(!identity){await refreshCounts();return}
  const serial=++refreshSerial,auth=authSerial;
  try{
    const [all,ownResponse]=await Promise.all([db.rpc('fso_post_active'),db.rpc('fso_post_mine')]);
    if(all.error)throw all.error;
    if(ownResponse.error)throw ownResponse.error;
    if(serial!==refreshSerial||auth!==authSerial||!identity)return;
    active=Array.isArray(all.data)?all.data:[];
    mine=ownResponse.data||null;
    recalcCountsFromRoster();
    drawRoster();ownStatus();
    setLive('Карта обновлена');
  }catch(error){
    if(serial!==refreshSerial)return;
    console.warn('Посты: ошибка синхронизации',error);
    setLive('Не удалось загрузить дежурства',true);
  }
}
async function syncAuth(){
  if(!db)return;
  const serial=++authSerial;
  try{
    const response=await db.auth.getUser();
    if(serial!==authSerial)return;
    const user=response.data?.user;
    if(response.error||!user){
      setLocked('Для заступления на пост и копирования докладов необходимо войти в личный кабинет.');
      await refreshCounts();
      return;
    }
    const identityResponse=await db.rpc('fso_post_identity');
    if(serial!==authSerial)return;
    if(identityResponse.error)throw identityResponse.error;
    if(!identityResponse.data){
      setLocked('Вы вошли в систему, но действующая карточка сотрудника не связана с аккаунтом либо не заполнены звание и служебный номер. Обратитесь к руководству.');
      await refreshCounts();
      return;
    }
    setReady(identityResponse.data);
    await refresh();
  }catch(error){
    if(serial!==authSerial)return;
    setLocked('Не удалось проверить доступ к личному составу. Перезагрузите страницу или обратитесь к руководству.');
    setLive('Ошибка авторизации',true);
    await refreshCounts();
  }
}
async function checkIn(){
  if(busy||!db||!identity)return;
  setBusy(true);setStatus('Отмечаю заступление…');
  try{
    const response=await db.rpc('fso_post_checkin',{p_post_id:post.value});
    if(response.error)throw response.error;
    mine=response.data;
    setStatus('Вы заступили на '+postNames[post.value]+'.');
    await refresh();
  }catch(error){
    setStatus('Не удалось заступить: '+(error?.message||'ошибка сервера'),true);
    console.error(error);
  }finally{setBusy(false)}
}
async function checkOut(){
  if(busy||!db||!identity||!mine)return;
  setBusy(true);setStatus('Завершаю дежурство…');
  try{
    const response=await db.rpc('fso_post_checkout');
    if(response.error)throw response.error;
    mine=null;
    setStatus('Пост покинут. Отметка снята с карты.');
    await refresh();
  }catch(error){setStatus('Не удалось покинуть пост: '+(error?.message||'ошибка сервера'),true)}
  finally{setBusy(false)}
}
async function copyReport(type,button){
  if(!identity){setStatus('Для докладов требуется авторизация.',true);return}
  if(incidentRequired()&&!safe(incident.value)){
    setStatus('Укажите описание происшествия перед копированием.',true);incident.focus();return;
  }
  const text=buildReport(type);
  if(!text)return;
  try{
    if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);
    else{
      const area=node('textarea','');area.value=text;area.style.cssText='position:fixed;left:-9999px;top:0;';
      document.body.append(area);area.select();
      const ok=document.execCommand('copy');area.remove();if(!ok)throw Error('Буфер обмена недоступен');
    }
    setStatus('Доклад скопирован.');
    const original=button.textContent;button.textContent='Скопировано';
    window.setTimeout(()=>{if(button.isConnected)button.textContent=original},1800);
  }catch(error){setStatus('Не удалось скопировать доклад.',true)}
}
post.addEventListener('change',()=>{popupPostId=post.value;updateReports();showPopupRoster()});
condition.addEventListener('change',()=>{updateIncident();updateReports()});
incident.addEventListener('input',updateReports);
checkin.addEventListener('click',checkIn);checkout.addEventListener('click',checkOut);
root.querySelectorAll('[data-post-duty-copy]').forEach(button=>button.addEventListener('click',()=>copyReport(button.dataset.postDutyCopy,button)));
const layer=get('postmap-post-layer');
layer?.addEventListener('pointerup',event=>{
  const marker=event.target.closest?.('[data-post]');
  if(marker){popupPostId=marker.dataset.post;post.value=popupPostId;updateReports();window.setTimeout(showPopupRoster,0)}
},true);
layer?.addEventListener('keydown',event=>{
  const marker=event.target.closest?.('[data-post]');
  if(marker&&(event.key==='Enter'||event.key===' ')){popupPostId=marker.dataset.post;post.value=popupPostId;updateReports();window.setTimeout(showPopupRoster,0)}
},true);
get('postmap-popup-close')?.addEventListener('click',()=>{popupPostId=null});
updateIncident();
setLocked('Проверка авторизации…');
(async()=>{
  try{
    if(!window.supabase?.createClient)throw Error('Не загрузилась библиотека Supabase');
    db=window.supabase.createClient(url,key,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    db.auth.onAuthStateChange(event=>{
      if(event==='SIGNED_OUT'){
        ++authSerial;
        setLocked('Для заступления на пост и копирования докладов необходимо войти в личный кабинет.');
        refreshCounts();
      }else if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'){
        window.setTimeout(syncAuth,0);
      }
    });
    await syncAuth();
    window.setInterval(()=>{if(!document.hidden)refresh()},15000);
    window.addEventListener('focus',syncAuth);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncAuth()});
  }catch(error){
    setLocked('Система дежурств временно недоступна. Проверьте соединение с интернетом.');
    setLive('Ошибка подключения',true);
    console.warn('Посты:',error);
  }
})();
})();
