(()=>{'use strict';
let records=[],profiles=[],error='';
const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={
 'member.created':'Добавление сотрудника','member.updated':'Изменение личного дела','member.dismissed':'Увольнение сотрудника','member.deleted':'Удаление сотрудника',
 'blacklist.added':'Внесение в чёрный список','blacklist.removed':'Исключение из чёрного списка','blacklist.updated':'Изменение чёрного списка','blacklist.deleted':'Удаление из чёрного списка',
 'profile.created':'Выдача доступа','profile.updated':'Редактирование профиля','profile.role_changed':'Изменение прав доступа','profile.deleted':'Удаление доступа',
 'discipline.issued':'Выдача взыскания','discipline.converted':'Автоматическая замена взысканий','discipline.removed':'Снятие взыскания','discipline.dismissed':'Увольнение сотрудника','discipline.dismissal_proposed':'Предложение об увольнении','discipline.voided':'Отмена взыскания',
 'exam.created':'Создание экзамена','exam.updated':'Изменение экзамена','exam.deleted':'Удаление экзамена',
 'question.created':'Добавление вопроса','question.updated':'Изменение вопроса','question.deleted':'Удаление вопроса',
 'assignment.created':'Назначение экзамена','assignment.updated':'Изменение назначения','assignment.deleted':'Удаление назначения'
};
const categories={member:'Сотрудники',blacklist:'Чёрный список',discipline:'Взыскания',profile:'Права доступа',exam:'Экзамены',question:'Вопросы',assignment:'Назначения'};
const labels={employee_number:'ID',first_name:'Имя',last_name:'Фамилия',rank:'Звание',position:'Должность',discord:'Discord',status:'Статус',joined_on:'Дата вступления',dismissed_on:'Дата увольнения',
role:'Роль',display_name:'Имя пользователя',title:'Название',prompt:'Вопрос',reason:'Причина',removal_reason:'Причина снятия',event:'Событие',details:'Детали',
kind:'Вид взыскания',expires_at:'Срок действия',pass_percent:'Проходной балл',duration_minutes:'Длительность',max_attempts:'Количество попыток',difficulty:'Сложность',is_published:'Опубликован'};
const pretty=v=>v===undefined||v===null||v===''?'Не указано':typeof v==='boolean'?(v?'Да':'Нет'):typeof v==='object'?JSON.stringify(v):String(v);
const formatTime=v=>v?new Date(v).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}):'Без даты';
async function load(api,role){
 error='';records=[];profiles=[];
 if(role!=='admin'){error='Доступ к журналу запрещён';return}
 try{
  const [r,p]=await Promise.all([
   api.from('fso_activity_audit').select('id,occurred_at,actor_id,entity_type,entity_id,member_id,target_user_id,action,before_data,after_data').order('id',{ascending:false}).limit(300),
   api.from('fso_profiles').select('user_id,display_name,role')
  ]);
  if(r.error)throw r.error;
  records=r.data||[];
  if(p.error)error='Имена исполнителей временно недоступны: '+p.error.message;
  profiles=p.data||[];
 }catch(err){error='Не удалось загрузить аудит: '+(err.message||'Ошибка подключения')}
}
function changes(log){
 const old=log.before_data||{},next=log.after_data||{};
 const hidden=new Set(['id','user_id','member_id','performed_by','added_by','removed_by','issued_by','created_by','author_id','created_at','updated_at','occurred_at','issued_at','assigned_at','added_at','action_id']);
 const keys=[...new Set([...Object.keys(old),...Object.keys(next)])].filter(k=>!hidden.has(k)&&JSON.stringify(old[k])!==JSON.stringify(next[k]));
 if(!keys.length)return '<p class="subtle">Изменения зафиксированы на сервере.</p>';
 return '<div class="audit-changes">'+keys.map(k=>'<div class="audit-change"><strong>'+html(labels[k]||k)+'</strong><span>'+html(pretty(old[k]))+'</span><span class="audit-arrow">→</span><span>'+html(pretty(next[k]))+'</span></div>').join('')+'</div>';
}
function events(rows,members){
 if(!rows.length)return '<div class="empty">Событий по выбранным условиям нет.</div>';
 return rows.map(log=>{
  const actor=profiles.find(p=>p.user_id===log.actor_id),member=members.find(m=>m.id===log.member_id);
  const who=log.actor_id?(actor?.display_name?.trim()||'ID '+String(log.actor_id)):'Система / SQL';
  const subject=member?member.first_name+' '+member.last_name+' · № '+member.employee_number:
    log.target_user_id?'Учётная запись '+String(log.target_user_id).slice(0,8):'Объект '+String(log.entity_id).slice(0,12);
  const reason=log.after_data?.details?.reason||log.after_data?.reason||log.after_data?.removal_reason||'';
  return '<article class="audit-item"><div class="audit-head"><span class="audit-tag">'+html(categories[log.entity_type]||log.entity_type)+'</span><time>'+html(formatTime(log.occurred_at))+'</time></div>'+
   '<h3>'+html(titles[log.action]||log.action)+'</h3><div class="audit-subject">'+html(subject)+'</div>'+
   '<div class="audit-person">Исполнитель · <strong>'+html(who)+'</strong>'+(actor?.role?' · '+html(actor.role==='hr'?'Редактор':actor.role==='admin'?'Администратор':actor.role):'')+'</div>'+
   (reason?'<p class="audit-reason">Причина · '+html(reason)+'</p>':'')+
   '<details class="audit-details"><summary>Показать изменения</summary>'+changes(log)+'</details></article>';
 }).join('');
}
function render(role,members){
 if(role!=='admin')return '<div class="message error">Доступ к журналу только у администратора.</div>';
 return '<div class="eyebrow">FSO / СЛУЖЕБНЫЙ ПОРТАЛ</div><h1>Журнал аудита</h1>'+
 '<p class="head-subtitle">История кадровых решений, прав доступа, взысканий и действий с экзаменами. Записи создаются сервером с момента включения журнала.</p>'+
 (error?'<div class="message error">'+html(error)+'</div>':'')+
 '<section class="section audit-section"><div class="section-heading"><div><span class="form-step">КОНТРОЛЬ ИЗМЕНЕНИЙ</span><h2>История действий</h2></div><span class="sort-note">До 300 последних событий</span></div>'+
 '<div class="member-toolbar audit-toolbar"><input id="audit-search" type="search" placeholder="Поиск по сотруднику, действию или исполнителю" aria-label="Поиск по аудиту">'+
 '<label class="rank-filter">Категория<select id="audit-category"><option value="">Все события</option>'+
 Object.entries(categories).map(([key,val])=>'<option value="'+html(key)+'">'+html(val)+'</option>').join('')+'</select></label>'+
 '<button type="button" class="btn" id="audit-reload">Обновить</button></div>'+
 '<div class="audit-counter" id="audit-counter">'+records.length+' событий</div><div class="audit-list" id="audit-list">'+events(records,members)+'</div></section>';
}
function bind(api,role,members,reload){
 if(role!=='admin')return;
 const search=document.getElementById('audit-search'),category=document.getElementById('audit-category');
 function update(){
  const term=(search?.value||'').trim().toLocaleLowerCase('ru-RU'),type=category?.value||'';
  const found=records.filter(log=>{
   if(type&&log.entity_type!==type)return false;
   const actor=profiles.find(p=>p.user_id===log.actor_id),person=members.find(m=>m.id===log.member_id);
   return [titles[log.action],log.action,log.actor_id,actor?.display_name,person?.first_name,person?.last_name,person?.employee_number,log.entity_id,log.after_data?.reason,log.after_data?.details?.reason].join(' ').toLocaleLowerCase('ru-RU').includes(term);
  });
  document.getElementById('audit-list').innerHTML=events(found,members);
  document.getElementById('audit-counter').textContent='Показано '+found.length+' из '+records.length;
 }
 if(search)search.oninput=update;
 if(category)category.onchange=update;
 const button=document.getElementById('audit-reload');
 if(button)button.onclick=reload;
}
function clear(){records=[];profiles=[];error=''}
window.FSO_AUDIT={load,render,bind,clear};
})();