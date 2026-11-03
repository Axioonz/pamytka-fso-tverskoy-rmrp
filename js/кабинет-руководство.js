/* FSO leadership workspace. Data comes from Supabase, never from local storage. */
(()=>{'use strict';
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=x=>x?new Date(String(x).slice(0,10)+'T12:00:00').toLocaleDateString('ru-RU'):'Не указана';
const when=x=>x?new Date(x).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Не указано';
const day=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())};
const manager=r=>['admin','hr'].includes(r);
const officer=r=>['admin','hr','examiner'].includes(r);
const active=m=>m&&['active','cadet'].includes(m.status);
const name=m=>m?m.first_name+' '+m.last_name:'Сотрудник не найден';
const types={leave:'Отпуск',promotion:'Повышение',transfer:'Перевод',reinstatement:'Восстановление',other:'Другое обращение'};
const states={pending:'На рассмотрении',approved:'Одобрено',rejected:'Отклонено'};
const eventsTitles={joined:'Приём в подразделение',rank_changed:'Изменение звания',position_changed:'Изменение должности',
 status_changed:'Изменение статуса службы',request_submitted:'Рапорт подан',request_approved:'Рапорт одобрен',
 request_rejected:'Отказ по рапорту',leave_approved:'Отпуск оформлен',leave_finished:'Выход из отпуска',
 leave_cancelled:'Отпуск отменён',account_linked:'Привязка учётной записи'};
const rankGroups=[
 ['Высшие офицеры','Генерал-майор'],
 ['Старшие офицеры','Полковник','Подполковник','Майор'],
 ['Младшие офицеры','Капитан','Старший лейтенант','Лейтенант','Младший лейтенант'],
 ['Прапорщики','Старший прапорщик','Прапорщик'],
 ['Солдаты и сержанты','Старшина','Старший сержант','Сержант','Младший сержант','Ефрейтор','Рядовой']
];
let data={events:[],requests:[],leaves:[],profiles:[],pendingAccess:0,error:''};
function personOpt(m){return '<option value="'+safe(m.id)+'">'+safe(m.employee_number+' · '+name(m))+'</option>'}
function personSelect(id,members,picked,onlyActive=true){
 const list=members.filter(m=>!onlyActive||active(m));
 return '<label>Сотрудник<select id="'+safe(id)+'" required>'+list.map(m=>'<option value="'+safe(m.id)+'" '+(m.id===picked?'selected':'')+'>'+safe(m.employee_number+' · '+name(m))+'</option>').join('')+'</select></label>';
}
function actor(id){const p=data.profiles.find(x=>x.user_id===id);
 return id?(p?.display_name?.trim()||'Руководитель (имя не указано)'):'Не указан';
}
function leaveState(l){
 if(l.status==='cancelled')return 'Отменён';
 if(l.status==='completed')return 'Завершён';
 const today=day();
 if(l.date_to<today)return 'Требует проверки';
 if(l.date_from>today)return 'Запланирован';
 return 'В отпуске';
}
function leaveFor(memberId){
 return data.leaves.find(l=>l.member_id===memberId&&l.status==='approved'&&leaveState(l)==='В отпуске')
 ||data.leaves.find(l=>l.member_id===memberId&&leaveState(l)==='Требует проверки');
}
function notice(text,wrong=false){
 const t=document.getElementById('toast');if(!t)return;
 t.textContent=text;t.style.background=wrong?'#502129':'#15354b';t.classList.add('show');
 setTimeout(()=>t.classList.remove('show'),5500);
}
async function action(api,rpc,args,refresh,button){
 if(button)button.disabled=true;
 try{
  const {data:result,error}=await api.rpc(rpc,args);
  if(error)throw error;
  await refresh();
  notice('Изменение сохранено');
  return result;
 }catch(error){notice(error.message||'Операция не выполнена',true)}
 finally{if(button?.isConnected)button.disabled=false}
}
async function load(api,role){
 const queue=[
  api.from('fso_service_events').select('id,member_id,event_type,actor_id,old_value,new_value,reason,occurred_at').order('occurred_at',{ascending:false}).limit(900),
  api.from('fso_service_requests').select('id,member_id,kind,statement,date_from,date_to,submitted_by,submitted_at,status,reviewed_by,reviewed_at,review_note').order('submitted_at',{ascending:false}).limit(600),
  api.from('fso_service_leaves').select('id,member_id,request_id,date_from,date_to,reason,status,approved_by,approved_at,closed_by,closed_at,closure_reason').order('date_to',{ascending:false}).limit(600)
 ];
 if(officer(role))queue.push(api.from('fso_profiles').select('user_id,display_name,role'));
 if(role==='admin')queue.push(api.rpc('fso_access_list'));
 const responses=await Promise.all(queue);
 const failing=responses.slice(0,3).find(x=>x.error);
 data.error=failing?'Не удалось загрузить кадровые данные: '+failing.error.message:'';
 data.events=responses[0].data||[];
 data.requests=responses[1].data||[];
 data.leaves=responses[2].data||[];
 data.profiles=officer(role)?responses[3].data||[]:[];
 data.pendingAccess=role==='admin'&&Array.isArray(responses.at(-1).data)?
  responses.at(-1).data.filter(x=>x.self_registered&&!x.has_profile&&x.confirmed).length:0;
}
function errorBanner(){return data.error?'<p class="message error">'+safe(data.error)+'</p>':''}
function dashboard(ctx){
 const current=ctx.members.filter(active);
 const cadets=current.filter(m=>m.status==='cadet');
 const archived=ctx.members.filter(m=>!active(m));
 const pending=data.requests.filter(r=>r.status==='pending');
 const onLeave=data.leaves.filter(l=>leaveState(l)==='В отпуске');
 const returns=data.leaves.filter(l=>leaveState(l)==='Требует проверки');
 const incomplete=ctx.assignments.filter(a=>!ctx.attempts.some(t=>t.assignment_id===a.id&&t.completed_at));
 const last30=new Date();last30.setDate(last30.getDate()-30);
 const fired=archived.filter(m=>m.dismissed_on&&new Date(m.dismissed_on+'T12:00:00')>=last30).length;
 const high= current.filter(m=>ctx.actions.filter(a=>a.member_id===m.id&&a.status==='active'&&a.kind==='reprimand').length>=2);
 const count=(n,label,to)=>'<button type="button" class="lead-stat" data-lead-go="'+to+'"><b>'+n+'</b><span>'+label+'</span></button>';
 const tasks=[
  ['Рапорты на рассмотрении',pending.length,'requests'],
  ['Не подтверждён выход из отпуска',returns.length,'leaves'],
  ['Сотрудники с двумя и более выговорами',high.length,'roster'],
  ['Незавершённые назначения экзаменов',ctx.role==='hr'?0:incomplete.length,'exams']
 ].filter(x=>x[1]>0);
 if(ctx.role==='admin'&&data.pendingAccess)tasks.unshift(['Заявки на доступ',data.pendingAccess,'access']);
 const recent=data.events.slice(0,8).map(ev=>'<div class="lead-feed-row"><span class="lead-feed-date">'+safe(when(ev.occurred_at))+'</span>'+
 '<strong>'+safe(eventsTitles[ev.event_type]||ev.event_type)+'</strong><span>'+safe(name(ctx.members.find(m=>m.id===ev.member_id)))+'</span>'+
 '<button type="button" class="btn small" data-lead-member="'+safe(ev.member_id)+'">Личное дело</button></div>').join('');
 return '<div class="eyebrow">FSO / КАБИНЕТ РУКОВОДСТВА</div><h1>Обзор подразделения</h1>'+
 '<p class="head-subtitle">Кадровые сведения и решения, требующие внимания руководства.</p>'+errorBanner()+
 '<div class="lead-stats">'+count(current.length,'Действующий состав','roster')+
 count(cadets.length,'Курсанты','roster')+count(fired,'Уволено за 30 дней','archive')+
 count(pending.length,'Рапорты на рассмотрении','requests')+
 count(onLeave.length,'В отпуске','leaves')+count(returns.length,'Проверить возвращение','leaves')+'</div>'+
 '<section class="section lead-tasks"><div class="section-heading"><div><h2>Требуют внимания</h2></div></div>'+
 (tasks.length?tasks.map(([title,num,to])=>'<button class="lead-task" data-lead-go="'+to+'"><b>'+num+'</b><span>'+safe(title)+'</span><i>Открыть</i></button>').join(''):
 '<p class="hint">Сейчас нет заявок и кадровых событий, требующих проверки.</p>')+'</section>'+
 '<section class="section"><div class="section-heading"><div><h2>Последние кадровые события</h2></div>'+
 '<button type="button" class="btn small" data-lead-go="history">Вся история</button></div>'+
 (recent||'<p class="hint">Новые кадровые действия будут появляться здесь.</p>')+'</section>';
}
function memberEvents(member){
 const items=data.events.filter(x=>x.member_id===member.id);
 return '<section class="section lead-history"><div class="section-heading"><div><h2>История службы</h2></div></div>'+
 '<div class="lead-baseline"><small>Дата вступления из личного дела</small><b>'+safe(short(member.joined_on))+'</b>'+
 '<p class="hint">История изменений фиксируется с момента запуска кадрового журнала. Старые изменения не восстанавливаются автоматически.</p></div>'+
 (items.length?items.map(ev=>{
  const prior=ev.old_value||{},now=ev.new_value||{};
  const detail=ev.event_type==='rank_changed'?safe((prior.rank||'Не указано')+' → '+(now.rank||'Не указано')):
   ev.event_type==='position_changed'?safe((prior.position||'Не указана')+' → '+(now.position||'Не указана')):
   ev.event_type==='status_changed'?safe((prior.status||'Не указан')+' → '+(now.status||'Не указан')):'';
  return '<div class="lead-event"><time>'+safe(when(ev.occurred_at))+'</time>'+
   '<div><strong>'+safe(eventsTitles[ev.event_type]||ev.event_type)+'</strong>'+
   (detail?'<p>'+detail+'</p>':'')+
   (ev.reason?'<p>'+safe(ev.reason)+'</p>':'')+
   (ev.actor_id?'<small>Исполнитель · '+safe(actor(ev.actor_id))+'</small>':'')+'</div></div>';
 }).join(''):'<p class="hint">Записанных изменений пока нет.</p>')+'</section>';
}
function historyPage(ctx,chosen){
 const candidates=officer(ctx.role)?ctx.members:ctx.members.filter(m=>m.user_id===ctx.userId);
 const m=candidates.find(m=>m.id===chosen)||candidates[0];
 if(!m)return '<h1>История службы</h1><div class="section">Нет доступного личного дела.</div>';
 return '<div class="eyebrow">FSO / КАДРОВЫЙ УЧЁТ</div><h1>История службы</h1>'+
 '<p class="head-subtitle">Изменения звания, должности, статуса и решений руководства.</p>'+
 (officer(ctx.role)?'<div class="member-toolbar">'+personSelect('lead-history-person',candidates,m.id,false)+'</div>':'')+
 '<h2>'+safe(name(m))+'</h2>'+memberEvents(m);
}
function accountPanel(member,role){
 if(role!=='admin'||!active(member))return '';
 return '<section class="section lead-account"><h2>Связь с учётной записью</h2>'+
 '<p class="hint">Для самостоятельной подачи рапортов личное дело необходимо привязать к подтверждённой учётной записи. Пользователю предварительно выдают роль в «Управлении доступом».</p>'+
 '<form id="lead-account-form"><label>Электронная почта аккаунта<input type="email" id="lead-account-email" placeholder="user@example.com" required></label>'+
 '<div class="actions"><button class="btn primary" type="submit">Привязать аккаунт</button>'+
 (member.user_id?'<button class="btn" id="lead-account-unlink" type="button">Отвязать</button>':'')+'</div></form>'+
 '<p class="hint">Сейчас · '+(member.user_id?'Аккаунт привязан':'Аккаунт не привязан')+'</p></section>';
}
function decisionPage(ctx,chosen){
 if(!manager(ctx.role))return '<div class="message error">Недостаточно полномочий.</div>';
 const members=ctx.members.filter(active),person=members.find(m=>m.id===chosen)||members[0];
 if(!person)return '<h1>Кадровые решения</h1><p>В действующем составе нет сотрудников.</p>';
 const options=rankGroups.map(([title,...ranks])=>'<optgroup label="'+safe(title)+'">'+ranks.map(r=>'<option value="'+safe(r)+'" '+(person.rank===r?'selected':'')+'>'+safe(r)+'</option>').join('')+'</optgroup>').join('');
 return '<div class="eyebrow">FSO / КАДРОВОЕ РЕШЕНИЕ</div><h1>Повышения и назначения</h1>'+
 '<p class="head-subtitle">Отдельное оформление изменения звания и должности с обязательным основанием. Решение сохраняется в истории службы.</p>'+
 '<section class="section"><form id="lead-decision-form" class="lead-form">'+
 personSelect('lead-person',members,person.id)+
 '<div class="lead-current"><span>Текущее звание · <b>'+safe(person.rank||'Не указано')+'</b></span>'+
 '<span>Текущая должность · <b>'+safe(person.position||'Не указана')+'</b></span></div>'+
 '<div class="fields"><label>Новое звание<select id="lead-rank">'+options+'</select></label>'+
 '<label>Новая должность<input id="lead-position" maxlength="200" value="'+safe(person.position||'')+'"></label></div>'+
 '<label>Основание решения<textarea id="lead-decision-reason" required minlength="5" maxlength="2000" placeholder="Причина повышения, понижения или кадрового назначения"></textarea></label>'+
 '<div class="actions"><button type="submit" class="btn primary">Оформить решение</button></div></form></section>'+memberEvents(person);
}
function requestPage(ctx){
 const self=!officer(ctx.role);
 const eligible=self?ctx.members.filter(m=>m.user_id===ctx.userId&&active(m)):ctx.members;
 const isManager=manager(ctx.role);
 const rows=data.requests.map(r=>{
  const m=ctx.members.find(x=>x.id===r.member_id);
  return '<article class="lead-request"><div class="lead-request-head"><strong>'+safe(types[r.kind]||r.kind)+'</strong>'+
   '<span class="lead-status lead-'+safe(r.status)+'">'+safe(states[r.status])+'</span></div>'+
   '<div class="lead-request-meta">'+safe(name(m))+' · '+safe(when(r.submitted_at))+' · Подал '+safe(actor(r.submitted_by))+'</div>'+
   (r.date_from?'<p>Период · '+safe(short(r.date_from))+' – '+safe(short(r.date_to))+'</p>':'')+
   '<p>'+safe(r.statement)+'</p>'+
   (r.reviewed_at?'<p class="lead-review-note">Рассмотрел · '+safe(actor(r.reviewed_by))+' · '+safe(when(r.reviewed_at))+
    (r.review_note?' · '+safe(r.review_note):'')+'</p>':'')+
   (isManager&&r.status==='pending'?'<details class="lead-review"><summary>Рассмотреть рапорт</summary>'+
    '<label>Комментарий руководителя<textarea class="lead-review-text" maxlength="2000" placeholder="Причина отказа или комментарий к решению"></textarea></label>'+
    '<div class="actions"><button class="btn primary" type="button" data-lead-review="'+safe(r.id)+'" data-decision="approved">Одобрить</button>'+
    '<button class="btn danger" type="button" data-lead-review="'+safe(r.id)+'" data-decision="rejected">Отклонить</button></div>'+
    '<p class="hint">Одобрение отпуска автоматически создаст запись. Повышение и перевод требуют отдельного кадрового решения. Восстановление сотрудника оформляется отдельно.</p></details>':'')+'</article>';
 }).join('');
 const form=eligible.length?'<section class="section"><h2>Подать рапорт</h2>'+
 '<form id="lead-request-form" class="lead-form">'+
 (self?'<p class="hint">Личное дело · '+safe(name(eligible[0]))+'</p>':personSelect('lead-request-member',eligible,eligible[0]?.id,false))+
 '<label>Вид рапорта<select id="lead-request-kind">'+
 Object.entries(types).map(([key,t])=>'<option value="'+key+'">'+safe(t)+'</option>').join('')+'</select></label>'+
 '<div class="lead-date-pair" id="lead-request-dates" hidden><label>Начало отпуска<input id="lead-request-from" type="date"></label>'+
 '<label>Конец отпуска<input id="lead-request-to" type="date"></label></div>'+
 '<label>Текст рапорта<textarea id="lead-request-text" minlength="10" maxlength="3000" required placeholder="Содержание обращения и основания"></textarea></label>'+
 '<div class="actions"><button type="submit" class="btn primary">Отправить рапорт</button></div></form></section>':
 '<section class="section"><h2>Подача рапорта</h2><p class="hint">Личное дело пока не привязано к вашему аккаунту. Обратитесь к администратору.</p></section>';
 return '<div class="eyebrow">FSO / ОБРАЩЕНИЯ</div><h1>Рапорты и заявки</h1>'+
 '<p class="head-subtitle">Подача, рассмотрение и история решений по рапортам сотрудников.</p>'+errorBanner()+
 form+'<section class="section"><h2>Реестр рапортов</h2><div class="lead-request-list">'+
 (rows||'<p class="hint">Рапортов пока нет.</p>')+'</div></section>';
}
function leavePage(ctx){
 const isManager=manager(ctx.role),self=!officer(ctx.role);
 const candidates=ctx.members.filter(active);
 const form=isManager&&candidates.length?'<section class="section"><h2>Оформить отпуск</h2>'+
 '<form id="lead-leave-form" class="lead-form">'+personSelect('lead-leave-member',candidates,candidates[0].id)+
 '<div class="lead-date-pair"><label>С<input id="lead-leave-from" type="date" required></label>'+
 '<label>По<input id="lead-leave-to" type="date" required></label></div>'+
 '<label>Основание<textarea id="lead-leave-reason" minlength="5" maxlength="3000" required></textarea></label>'+
 '<button type="submit" class="btn primary">Оформить отпуск</button></form></section>':'';
 const rows=data.leaves.map(l=>{
  const status=leaveState(l);
  return '<tr><td>'+safe(name(ctx.members.find(m=>m.id===l.member_id)))+'</td>'+
   '<td>'+safe(short(l.date_from))+' – '+safe(short(l.date_to))+'</td>'+
   '<td><span class="lead-status">'+safe(status)+'</span></td><td>'+safe(l.reason)+'</td>'+
   '<td>'+safe(actor(l.approved_by))+'</td><td>'+
   (isManager&&l.status==='approved'?'<div class="actions">'+
    (status==='Требует проверки'?'<button class="btn small primary" type="button" data-lead-leave="'+safe(l.id)+'" data-leave-action="completed">Подтвердить возвращение</button>':'')+
    '<button class="btn danger small" type="button" data-lead-leave="'+safe(l.id)+'" data-leave-action="cancelled">Отменить</button></div>':'')+'</td></tr>';
 }).join('');
 return '<div class="eyebrow">FSO / ОТСУТСТВИЕ</div><h1>Отпуска и неактивность</h1>'+
 '<p class="head-subtitle">Периоды отсутствия, запланированные отпуска и возвращения, требующие подтверждения.</p>'+
 errorBanner()+form+'<section class="section"><h2>'+ (self?'Мои отпуска':'Учёт отпусков')+'</h2>'+
 '<div class="table-wrap"><table class="lead-table"><thead><tr><th>Сотрудник</th><th>Период</th><th>Состояние</th><th>Основание</th><th>Оформил</th><th></th></tr></thead>'+
 '<tbody>'+ (rows||'<tr><td colspan="6">Отпусков пока нет.</td></tr>')+'</tbody></table></div>'+
 '<p class="hint">После окончания периода отпуск помечается «Требует проверки» до подтверждения возвращения руководителем.</p></section>';
}
function bind(ctx,api,screen,refresh,navigate){
 document.querySelectorAll('[data-lead-go]').forEach(btn=>btn.onclick=()=>navigate(btn.dataset.leadGo));
 document.querySelectorAll('[data-lead-member]').forEach(btn=>btn.onclick=()=>navigate('detail',btn.dataset.leadMember));
 const historical=document.getElementById('lead-history-person');
 if(historical)historical.onchange=()=>navigate('history',historical.value);
 const decisionPerson=document.getElementById('lead-person');
 if(decisionPerson)decisionPerson.onchange=()=>navigate('personnel',decisionPerson.value);
 const decision=document.getElementById('lead-decision-form');
 if(decision)decision.onsubmit=async e=>{
  e.preventDefault();
  const memberId=document.getElementById('lead-person').value;
  const member=ctx.members.find(m=>m.id===memberId);
  const rank=document.getElementById('lead-rank').value;
  const position=document.getElementById('lead-position').value.trim();
  if(rank===member.rank && position===(member.position||'')){notice('Укажите новое звание или должность',true);return;}
  if(!window.confirm('Сохранить кадровое решение для '+name(member)+'?'))return;
  await action(api,'fso_personnel_decision',
    {p_member:memberId,p_rank:rank,p_position:position,p_reason:document.getElementById('lead-decision-reason').value.trim()},
    refresh,decision.querySelector('[type="submit"]'));
 };
 const kind=document.getElementById('lead-request-kind'),dates=document.getElementById('lead-request-dates');
 if(kind&&dates){const change=()=>{dates.hidden=kind.value!=='leave';
  for(const x of dates.querySelectorAll('input'))x.required=kind.value==='leave';};kind.onchange=change;change();}
 const req=document.getElementById('lead-request-form');
 if(req)req.onsubmit=async e=>{
  e.preventDefault();const memberId=document.getElementById('lead-request-member')?.value||
    ctx.members.find(m=>m.user_id===ctx.userId&&active(m))?.id;
  await action(api,'fso_request_submit',{
   p_member:memberId,p_kind:kind.value,p_statement:document.getElementById('lead-request-text').value.trim(),
   p_from:kind.value==='leave'?document.getElementById('lead-request-from').value:null,
   p_to:kind.value==='leave'?document.getElementById('lead-request-to').value:null
  },refresh,req.querySelector('[type="submit"]'));
 };
 document.querySelectorAll('[data-lead-review]').forEach(btn=>btn.onclick=async()=>{
  const row=btn.closest('.lead-review');
  const note=row.querySelector('.lead-review-text').value.trim();
  if(btn.dataset.decision==='rejected'&&note.length<5){notice('Укажите причину отказа',true);return;}
  if(!window.confirm('Подтвердить решение по рапорту?'))return;
  await action(api,'fso_request_review',{p_id:btn.dataset.leadReview,p_decision:btn.dataset.decision,p_note:note},refresh,btn);
 });
 const leave=document.getElementById('lead-leave-form');
 if(leave)leave.onsubmit=async e=>{
  e.preventDefault();
  await action(api,'fso_leave_create',{
   p_member:document.getElementById('lead-leave-member').value,
   p_from:document.getElementById('lead-leave-from').value,
   p_to:document.getElementById('lead-leave-to').value,
   p_reason:document.getElementById('lead-leave-reason').value.trim()
  },refresh,leave.querySelector('[type="submit"]'));
 };
 document.querySelectorAll('[data-lead-leave]').forEach(btn=>btn.onclick=async()=>{
  const mode=btn.dataset.leaveAction;
  const reason=mode==='cancelled'?window.prompt('Причина отмены отпуска (минимум 5 символов)'):null;
  if(mode==='cancelled'&&(reason===null||reason.trim().length<5)){if(reason!==null)notice('Укажите причину отмены',true);return;}
  if(mode==='completed'&&!window.confirm('Подтвердить возвращение сотрудника из отпуска?'))return;
  await action(api,'fso_leave_close',{p_leave:btn.dataset.leadLeave,p_action:mode,p_reason:reason},refresh,btn);
 });
}
function bindAccount(api,member,refresh){
 const form=document.getElementById('lead-account-form');if(!form)return;
 form.onsubmit=async e=>{
  e.preventDefault();
  await action(api,'fso_member_account_link',{p_member:member.id,p_email:document.getElementById('lead-account-email').value.trim()},
    refresh,form.querySelector('[type="submit"]'));
 };
 const unbind=document.getElementById('lead-account-unlink');
 if(unbind)unbind.onclick=async()=>{
  if(!window.confirm('Отвязать личное дело от учётной записи?'))return;
  await action(api,'fso_member_account_link',{p_member:member.id,p_email:null},refresh,unbind);
 };
}
window.FSO_LEADERSHIP={load,dashboard,memberEvents,historyPage,accountPanel,decisionPage,requestPage,leavePage,bind,bindAccount,
 leaveFor,leaveState};
})();