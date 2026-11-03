(()=>{'use strict';
let users=[],error='',editing=null,busy=false,notice='';
const roleNames={admin:'Администратор',hr:'Редактор',examiner:'Экзаменатор',employee:'Без доступа',cadet:'Курсант'};
const activeRoles=new Set(['admin','hr','examiner']);
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const dt=x=>x?new Date(x).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Ещё не входил';
const roles=selected=>['employee','hr','examiner','admin','cadet'].map(r=>'<option value="'+r+'" '+(selected===r?'selected':'')+'>'+roleNames[r]+'</option>').join('');
const escapeId=x=>h(x);
async function load(api,role){
 error='';notice='';users=[];editing=null;
 if(role!=='admin'){error='Доступ запрещён';return}
 try{
  const response=await api.rpc('fso_access_list');
  if(response.error)throw response.error;
  if(!Array.isArray(response.data))throw Error('Некорректный ответ сервера');
  users=response.data;
 }catch(ex){error='Не удалось получить список пользователей: '+(ex.message||'Ошибка сервера')}
}
function itemRow(u,currentId){
 const self=u.user_id===currentId;
 const status=!u.confirmed?'Почта не подтверждена':activeRoles.has(u.role)?'Доступ разрешён':u.self_registered?'Ожидает выдачи доступа':'Нет доступа';
 return '<tr data-access-user="'+escapeId(u.user_id)+'">'+
 '<td><strong class="access-name">'+h(u.display_name||u.email||'Без имени')+'</strong><small class="access-subline">'+h(u.email||'Email не указан')+(self?' · Вы':'')+'</small>'+(u.discord?'<small class="access-subline">Discord · '+h(u.discord)+'</small>':'')+'</td>'+
 '<td><span class="access-role access-role-'+h(u.role)+'">'+h(roleNames[u.role]||u.role)+'</span></td>'+
 '<td><span class="access-state '+(activeRoles.has(u.role)&&u.confirmed?'access-allowed':'')+'">'+h(status)+'</span></td>'+
 '<td class="access-date">'+h(dt(u.last_sign_in_at))+'</td>'+
 '<td><button class="btn small access-edit" type="button" data-edit-user="'+escapeId(u.user_id)+'">Настроить</button></td></tr>';
}
function editor(u){
 if(!u)return '';
 return '<section class="section access-editor" id="access-editor">'+
 '<div class="section-heading"><div><span class="form-step">УПРАВЛЕНИЕ ПРАВАМИ</span><h2>'+h(u.email)+'</h2></div><button class="btn small" type="button" id="access-close">Закрыть</button></div>'+
 (u.discord?'<p class="hint">Discord · '+h(u.discord)+'</p>':'')+
 '<form id="access-edit-form"><div class="fields">'+
 '<label>Имя в системе<input id="access-name" maxlength="120" value="'+h(u.display_name||'')+'" placeholder="Имя и фамилия"></label>'+
 '<label>Уровень доступа<select id="access-role">'+roles(u.role)+'</select></label></div>'+
 '<p class="hint">Отзыв доступа означает запрет работы в служебном кабинете. Учётная запись Supabase при этом сохраняется.</p>'+
 '<div class="actions"><button class="btn primary" type="submit">Сохранить изменения</button>'+
 (activeRoles.has(u.role)?'<button class="btn danger" type="button" id="access-revoke">Отозвать доступ</button>':'')+
 '</div><div id="access-edit-message" role="alert"></div></form></section>';
}
function render(role,currentId){
 if(role!=='admin')return '<div class="message error">Доступ только администратору.</div>';
 const staff=users.filter(u=>activeRoles.has(u.role)).length;
 const waiting=users.filter(u=>u.self_registered&&u.confirmed&&!activeRoles.has(u.role)).length;
 const unconfirmed=users.filter(u=>!u.confirmed).length;
 return '<div class="eyebrow">FSO / СЛУЖЕБНЫЙ ПОРТАЛ</div><h1>Центр управления доступом</h1>'+
 '<p class="head-subtitle">Учётные записи, роли и последний вход. Изменять права может только администратор.</p>'+
 (error?'<div class="message error">'+h(error)+'</div>':'')+
 (notice?'<div class="message" role="status">'+h(notice)+'</div>':'')+
 '<div class="cards access-metrics"><div class="metric"><b>'+users.length+'</b><span>Учётных записей</span></div>'+
 '<div class="metric"><b>'+staff+'</b><span>С доступом к кабинету</span></div>'+
 '<div class="metric"><b>'+waiting+'</b><span>Заявок на доступ</span></div></div>'+
 (unconfirmed?'<p class="hint">'+unconfirmed+' учётных записей ожидают подтверждения электронной почты.</p>':'')+
 '<section class="section access-grant"><div class="section-heading"><div><span class="form-step">НАЗНАЧЕНИЕ РОЛИ</span><h2>Выдать доступ</h2></div></div>'+
 '<p class="hint">Пользователь регистрируется самостоятельно и подтверждает почту. После этого администратор назначает роль. Можно назначить роль существующему аккаунту по адресу электронной почты.</p>'+
 '<form id="access-grant-form"><div class="fields">'+
 '<label>Электронная почта<input id="access-grant-email" type="email" required placeholder="user@example.com" autocomplete="off"></label>'+
 '<label>Роль<select id="access-grant-role"><option value="hr">Редактор</option><option value="examiner">Экзаменатор</option><option value="admin">Администратор</option></select></label>'+
 '<label class="wide">Имя для отображения<input id="access-grant-name" maxlength="120" placeholder="Необязательно"></label></div>'+
 '<div class="actions"><button class="btn primary" type="submit">Назначить роль</button>'+
 '<a class="btn" href="https://supabase.com/dashboard/project/lejagyuibxdnvpmxoggy/auth/users" target="_blank" rel="noopener noreferrer">Пригласить пользователя в Supabase</a></div>'+
 '<div id="access-grant-message" role="alert"></div></form></section>'+
 '<section class="section access-accounts"><div class="section-heading"><div><span class="form-step">УЧЁТНЫЕ ЗАПИСИ</span><h2>Пользователи</h2></div><span class="sort-note">До 500 аккаунтов</span></div>'+
 '<div class="member-toolbar"><input id="access-search" type="search" placeholder="Поиск по почте или имени" aria-label="Поиск пользователей">'+
 '<label class="rank-filter">Доступ<select id="access-filter"><option value="">Все пользователи</option>'+
 '<option value="staff">Есть доступ</option><option value="requests">Заявки на доступ</option><option value="none">Без доступа</option><option value="pending">Почта не подтверждена</option></select></label>'+
 '<button class="btn" type="button" id="access-refresh">Обновить</button></div>'+
 '<div class="table-wrap"><table class="access-table"><thead><tr><th>Пользователь</th><th>Роль</th><th>Состояние</th><th>Последний вход</th><th></th></tr></thead>'+
 '<tbody id="access-users">'+rows(users,currentId)+'</tbody></table></div></section>'+
 (editing?editor(users.find(u=>u.user_id===editing)):'')+
 '<div class="access-history-link"><button class="btn" type="button" id="access-history">История выдачи и изменения прав в журнале аудита</button></div>';
}
function rows(list,id){
 return list.length?list.map(u=>itemRow(u,id)).join(''):'<tr><td colspan="5" class="subtle">Пользователи не найдены.</td></tr>';
}
function bind(api,role,currentId,callbacks){
 if(role!=='admin')return;
 const editBox=document.getElementById('access-editor');
 const feedback=(id,message,isError)=>{const node=document.getElementById(id);if(node)node.innerHTML='<div class="message '+(isError?'error':'')+'">'+h(message)+'</div>'};
 const submit=async(userId,nextRole,displayName,msgId)=>{
  if(busy)return false;
  if(nextRole==='admin'&&!window.confirm('Назначить администратора? Пользователь получит полный доступ к кадровому кабинету и управлению ролями.'))return false;
  busy=true;
  const buttons=[...document.querySelectorAll('#access-editor button,#access-grant-form button')];
  buttons.forEach(b=>b.disabled=true);
  try{
   const result=await api.rpc('fso_access_set_role',{p_user:userId,p_role:nextRole,p_display_name:displayName});
   if(result.error)throw result.error;
   await callbacks.refresh();
   return true;
  }catch(ex){feedback(msgId,ex.message||'Не удалось изменить права',true);return false}
  finally{busy=false;buttons.forEach(b=>b.disabled=false)}
 };
 const grant=document.getElementById('access-grant-form');
 if(grant)grant.onsubmit=async event=>{
  event.preventDefault();
  const email=document.getElementById('access-grant-email').value.trim().toLocaleLowerCase('ru-RU');
  const target=users.find(u=>String(u.email||'').toLocaleLowerCase('ru-RU')===email);
  if(!target){feedback('access-grant-message','Учётная запись не найдена. Пользователь должен сначала зарегистрироваться на сайте и подтвердить почту.',true);return}
  await submit(target.user_id,document.getElementById('access-grant-role').value,
    document.getElementById('access-grant-name').value.trim()||target.display_name||'','access-grant-message');
 };
 const search=document.getElementById('access-search'),filter=document.getElementById('access-filter');
 function updateRows(){
  const query=(search?.value||'').trim().toLocaleLowerCase('ru-RU'),type=filter?.value||'';
  const visible=users.filter(u=>{
   if(type==='staff'&&!activeRoles.has(u.role))return false;
   if(type==='requests'&&!(u.self_registered&&u.confirmed&&!activeRoles.has(u.role)))return false;
   if(type==='none'&&activeRoles.has(u.role))return false;
   if(type==='pending'&&u.confirmed)return false;
   return [u.email,u.display_name,u.role].join(' ').toLocaleLowerCase('ru-RU').includes(query);
  });
  document.getElementById('access-users').innerHTML=rows(visible,currentId);
  bindEditButtons();
 }
 function bindEditButtons(){
  document.querySelectorAll('[data-edit-user]').forEach(button=>button.onclick=()=>{
   editing=button.dataset.editUser;
   callbacks.render();
   document.getElementById('access-editor')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
 }
 if(search)search.oninput=updateRows;
 if(filter)filter.onchange=updateRows;
 bindEditButtons();
 const refresh=document.getElementById('access-refresh');
 if(refresh)refresh.onclick=callbacks.refresh;
 const history=document.getElementById('access-history');
 if(history)history.onclick=callbacks.audit;
 const close=document.getElementById('access-close');
 if(close)close.onclick=()=>{editing=null;callbacks.render()};
 const form=document.getElementById('access-edit-form');
 if(form)form.onsubmit=async event=>{
  event.preventDefault();
  const roleValue=document.getElementById('access-role').value;
  const nameValue=document.getElementById('access-name').value.trim();
  await submit(editing,roleValue,nameValue,'access-edit-message');
 };
 const revoke=document.getElementById('access-revoke');
 if(revoke)revoke.onclick=async()=>{
  if(!window.confirm('Отозвать доступ к служебному кабинету? Учётная запись пользователя сохранится.'))return;
  const nameValue=document.getElementById('access-name').value.trim();
  await submit(editing,'employee',nameValue,'access-edit-message');
 };
}
function clear(){users=[];error='';editing=null;notice='';busy=false}
window.FSO_ACCESS={load,render,bind,clear};
})();