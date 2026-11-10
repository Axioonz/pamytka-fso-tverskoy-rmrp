(()=>{'use strict';
const URL='https://lejagyuibxdnvpmxoggy.supabase.co';
const KEY='sb_publishable_8cdFcw4V8F545924bpdLjg_3yKTHt1d';
const EXAM_EDGE=URL+'/functions/v1/fso-cadet-exam';
const root=document.getElementById('main'), toast=document.getElementById('toast');
const allowed=['admin','hr','examiner','employee','cadet'];const rosterRoles=['admin','hr'];
let api=null,user=null,profile=null,members=[],blacklist=[],actions=[],audits=[],questions=[],examsList=[],assignments=[],examAttempts=[],examStaff=[],screen='home',selected=null;
let newlyIssuedCode=null,cadetCode='',cadetState=null,cadetIndex=0,cadetPending=false;
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const v=id=>document.getElementById(id)?.value?.trim()||'';
const date=x=>x?new Date(String(x).slice(0,10)+'T12:00:00').toLocaleDateString('ru-RU'):'Не указана';
const roleTitle={admin:'Администратор',hr:'Руководство',examiner:'Экзаменатор',employee:'Сотрудник',cadet:'Курсант'};
const statusTitle={active:'Сотрудник',cadet:'Курсант',dismissed:'Уволен',archived:'Архив'};
const subdivisionOptions=['АС','Академия','УЛО','УСН'];
const subdivisionOf=m=>m.department||(m.status==='cadet'?'Академия':'Не назначено');
const rankGroups=[
 {group:'Высшие офицеры',level:'general',ranks:['Генерал-майор']},
 {group:'Старшие офицеры',level:'senior',ranks:['Полковник','Подполковник','Майор']},
 {group:'Младшие офицеры',level:'junior',ranks:['Капитан','Старший лейтенант','Лейтенант','Младший лейтенант']},
 {group:'Прапорщики',level:'warrant',ranks:['Старший прапорщик','Прапорщик']},
 {group:'Солдаты и сержанты',level:'enlisted',ranks:['Старшина','Старший сержант','Сержант','Младший сержант','Ефрейтор','Рядовой']}
];
const rankNames=rankGroups.flatMap(g=>g.ranks);
const rankKey=s=>String(s||'').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[–—]/g,'-');
const rankIndex=s=>{const n=rankNames.findIndex(x=>rankKey(x)===rankKey(s));return n<0?rankNames.length:n};
const rankLevel=s=>(rankGroups.find(g=>g.ranks.some(x=>rankKey(x)===rankKey(s)))||{level:'unknown'}).level;
const rankOptions=selected=>rankGroups.map(g=>'<optgroup label="'+e(g.group)+'">'+g.ranks.map(x=>'<option value="'+e(x)+'" '+(rankKey(selected)===rankKey(x)?'selected':'')+'>'+e(x)+'</option>').join('')+'</optgroup>').join('');
const rankFilter=()=>'<label class="rank-filter">Звание<select id="rank-filter" aria-label="Фильтр по званию"><option value="">Все звания</option>'+rankOptions('')+'</select></label>';
const sortMembers=arr=>[...arr].sort((a,b)=>rankIndex(a.rank)-rankIndex(b.rank)||String(a.last_name||'').localeCompare(String(b.last_name||''),'ru')||String(a.first_name||'').localeCompare(String(b.first_name||''),'ru')||String(a.employee_number||'').localeCompare(String(b.employee_number||''),'ru',{numeric:true}));

function flash(msg,bad=false){toast.textContent=msg;toast.style.background=bad?'#502129':'#15354b';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),4200)}
function msg(text,bad=false){return '<div class="message '+(bad?'error':'')+'">'+e(text)+'</div>'}
function loading(){root.innerHTML='<div class="section">Загрузка данных...</div>'}
function days(iso){if(!iso)return 'Не указан';const from=new Date(iso+'T12:00:00'),to=new Date();return Math.max(0,Math.floor((to-from)/864e5))+' дн.'}
function kindcounts(m){const rows=actions.filter(a=>a.member_id===m.id&&a.status==='active');return {warnings:rows.filter(a=>a.kind==='warning').length,reprimands:rows.filter(a=>a.kind==='reprimand').length}}
function hero(title,subtitle=''){return '<div class="eyebrow">FSO / СЛУЖЕБНЫЙ ПОРТАЛ</div><h1>'+e(title)+'</h1><p class="head-subtitle">'+e(subtitle)+'</p>'}
function authPage(error='',mode='login',success=''){
 const isSignup=mode==='signup';
 const title=isSignup?'Регистрация':'Вход в личный кабинет';
 const details=isSignup?'Самостоятельная регистрация не заменяет служебную учётную запись. Доступ к кабинету выдаёт руководство.':'Введите логин и пароль, выданные при приёме во ФСО. При первом входе установите собственный пароль.';
 const form=isSignup?
 '<form id="register-form" class="auth-form">'+
 '<label>Имя и фамилия<input id="register-name" type="text" autocomplete="name" maxlength="120" placeholder="Как к вам обращаться" required></label>'+
 '<label>Discord<input id="register-discord" type="text" maxlength="100" placeholder="Имя пользователя Discord" required></label>'+
 '<label>Электронная почта<input id="register-email" type="email" autocomplete="email" placeholder="name@example.com" required></label>'+
 '<label>Пароль<input id="register-password" type="password" minlength="8" maxlength="72" autocomplete="new-password" required></label>'+
 '<label>Повторите пароль<input id="register-password-repeat" type="password" minlength="8" maxlength="72" autocomplete="new-password" required></label>'+
 '<button class="btn primary" type="submit">Зарегистрироваться</button>'+
 '<p class="auth-note">После регистрации подтвердите электронную почту, если придёт письмо. Назначение роли выполняет администратор.</p></form>':
 '<form id="login-form" class="auth-form">'+
 '<label>Служебный логин или почта<input id="email" type="text" autocapitalize="none" spellcheck="false" autocomplete="username" placeholder="fso_0007" required></label>'+
 '<label>Пароль<input id="password" type="password" autocomplete="current-password" required></label>'+
 '<button class="btn primary" type="submit">Войти</button></form>';
 root.innerHTML='<div class="auth-layout">'+hero(title,details)+
 '<section class="section"><div class="auth-switch" aria-label="Авторизация"><button type="button" id="show-login" class="'+(!isSignup?'active':'')+'" aria-pressed="'+!isSignup+'">Вход</button><button type="button" id="show-register" class="'+(isSignup?'active':'')+'" aria-pressed="'+isSignup+'">Регистрация</button></div>'+
 (error?msg(error,true):'')+(success?'<div class="message good" role="status">'+e(success)+'</div>':'')+
 form+'<div class="actions auth-actions"><button class="btn" type="button" id="to-cadet">Вход по коду экзамена</button></div></section></div>';
 document.getElementById('show-login').onclick=()=>authPage();
 document.getElementById('show-register').onclick=()=>authPage('','signup');
 document.getElementById(isSignup?'register-form':'login-form').addEventListener('submit',isSignup?register:login);
 document.getElementById('to-cadet').onclick=()=>{location.hash='cadet';window.FSO_CADET.open()};
}
async function register(event){
 event.preventDefault();
 const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
 const name=v('register-name'),discord=v('register-discord'),email=v('register-email').toLowerCase();
 const password=document.getElementById('register-password').value;
 const repeated=document.getElementById('register-password-repeat').value;
 const feedback=(message)=>{let box=document.getElementById('register-error');if(!box){box=document.createElement('div');box.id='register-error';box.setAttribute('role','alert');form.prepend(box)}box.innerHTML=msg(message,true)};
 if(name.length<3||name.length>120){feedback('Укажите имя и фамилию, от 3 до 120 символов.');return}
 if(discord.length<2||discord.length>100){feedback('Укажите Discord, от 2 до 100 символов.');return}
 if(password.length<8){feedback('Пароль должен содержать не менее 8 символов.');return}
 if(password!==repeated){feedback('Пароли не совпадают.');return}
 button.disabled=true;
 try{
  const redirect=new URL('./кабинет-новый.html',location.href);
  redirect.hash='';redirect.search='';
  const {data,error}=await api.auth.signUp({
   email,password,
   options:{emailRedirectTo:redirect.toString(),data:{display_name:name,discord,signup_source:'cabinet'}}
  });
  if(error)throw error;
  if(data?.session){await refresh();return}
  authPage('','login','Если адрес ещё не зарегистрирован, на него отправлено письмо для подтверждения. После подтверждения войдите в кабинет. Администратор рассмотрит запрос на доступ.');
 }catch(err){
  const message=String(err?.message||'Не удалось создать аккаунт');
  feedback(/signups? not allowed|signup.*disabled|email signups are disabled/i.test(message)?
   'Регистрация отключена в настройках Supabase Auth. Администратору нужно разрешить регистрацию по электронной почте.':
   message);
 }finally{button.disabled=false}
}
function waitingPage(){
 root.innerHTML=hero('Ожидается выдача доступа','Учётная запись создана, но права для работы в кабинете ещё не назначены.')+
 '<section class="section pending-access"><h2>Регистрация завершена</h2>'+
 '<p>Аккаунт <strong>'+e(user?.email||'')+'</strong> пока не имеет доступа к закрытым разделам. Администратор должен назначить роль в разделе «Управление доступом».</p>'+
 '<p class="hint">Если вам уже сообщили о выдаче доступа, обновите статус.</p>'+
 '<div class="actions"><button class="btn primary" id="check-access" type="button">Проверить доступ</button><button class="btn" id="logout" type="button">Выйти</button></div></section>';
 document.getElementById('check-access').onclick=refresh;
 document.getElementById('logout').onclick=logout;
}

async function login(ev){ev.preventDefault();const btn=ev.target.querySelector('button');btn.disabled=true;try{
 const login=v('email').trim().toLowerCase();
 if(!login.includes('@')&&!/^[a-z][a-z0-9_-]{2,23}$/.test(login))throw Error('Укажите служебный логин или электронную почту');
 const email=login.includes('@')?login:login+'@staff.fso-rmrp.example';
 const {error}=await api.auth.signInWithPassword({email,password:v('password')});
 if(error)throw error;await refresh()
 }catch(err){authPage(err.message||'Не удалось войти')}finally{btn.disabled=false}}
async function refresh(){loading();const {data:{user:u},error:ue}=await api.auth.getUser();if(ue||!u){user=null;profile=null;if(location.hash==='#cadet'){window.FSO_CADET.open();return}authPage();return}user=u;const pr=await api.from('fso_profiles').select('user_id,role,display_name').eq('user_id',u.id).maybeSingle();if(pr.error){root.innerHTML=msg('Не удалось прочитать служебный профиль: '+pr.error.message,true);return}profile=pr.data;if(profile?.role==='employee_pending'){
 window.FSO_STAFF_ACCOUNTS.firstLogin(api,refresh,logout,root);return
 }if(!profile||!allowed.includes(profile.role)){waitingPage();return}
const m=await api.from('fso_members').select('id,user_id,employee_number,first_name,last_name,position,department,rank,discord,joined_on,status,dismissed_on,created_at,updated_at').order('created_at',{ascending:false});if(m.error){root.innerHTML=msg('Ошибка получения личного состава: '+m.error.message,true);return}members=m.data||[];const bl=await api.from('fso_blacklist').select('id,member_id,reason,added_at,removed_at,removal_reason').order('added_at',{ascending:false});blacklist=bl.error?[]:(bl.data||[]);
const a=await api.from('fso_disciplinary_actions').select('id,member_id,kind,status,reason,evidence,issued_at,removed_at,removal_reason,removal_evidence,converted_to').order('issued_at',{ascending:false});actions=a.error?[]:(a.data||[]);const log=await api.from('fso_disciplinary_audit').select('id,member_id,event,details,occurred_at').order('occurred_at',{ascending:false}).limit(500);audits=log.error?[]:(log.data||[]);
if(['admin','examiner'].includes(profile.role)){
const [q,ex,as,at,staff]=await Promise.all([
api.from('fso_questions').select('id,source_key,difficulty,prompt').eq('is_published',true).order('source_key'),
api.from('fso_exams').select('id,title,created_by,pass_percent,duration_minutes,max_attempts,status,created_at').order('created_at',{ascending:false}),
api.from('fso_exam_assignments').select('id,exam_id,member_id,issued_by,status,assigned_at,expires_at').order('assigned_at',{ascending:false}),
api.from('fso_exam_attempts').select('id,assignment_id,user_id,correct_count,total_count,passed,completed_at,started_at,deadline_at').order('started_at',{ascending:false}),
api.rpc('fso_exam_staff_directory')
]);
questions=q.data||[];examsList=ex.data||[];assignments=as.data||[];examAttempts=at.data||[];examStaff=Array.isArray(staff.data)?staff.data:[];
}
if(!['admin','hr','examiner'].includes(profile.role)&&!['requests','leaves','history'].includes(screen))screen='requests';
await window.FSO_LEADERSHIP.load(api,profile.role);
if(screen==='audit'&&profile.role==='admin')await window.FSO_AUDIT.load(api,profile.role);
if(screen==='access'&&profile.role==='admin')await window.FSO_ACCESS.load(api,profile.role);
render()}
function nav(active){
 const leadership=['admin','hr','examiner'].includes(profile.role);
 const cadres=rosterRoles.includes(profile.role);
 return '<div class="row between" style="margin-bottom:20px"><div class="row"><span class="badge">'+e(roleTitle[profile.role])+'</span><span class="subtle">'+e(user.email)+'</span></div><button class="btn small" id="logout">Выйти</button></div>'+
 '<nav class="tabs" aria-label="Разделы">'+
 (leadership?'<button data-tab="home" class="'+(active==='home'?'active':'')+'">Обзор</button><button data-tab="roster" class="'+(active==='roster'?'active':'')+'">Сотрудники</button>':'')+
 '<button data-tab="requests" class="'+(active==='requests'?'active':'')+'">Рапорты</button>'+
 '<button data-tab="leaves" class="'+(active==='leaves'?'active':'')+'">Отпуска</button>'+
 '<button data-tab="history" class="'+(active==='history'?'active':'')+'">История службы</button>'+
 (cadres?'<button data-tab="personnel" class="'+(active==='personnel'?'active':'')+'">Кадровые решения</button>':'')+
 (cadres?'<button data-tab="archive" class="'+(active==='archive'?'active':'')+'">Архив</button><button data-tab="blacklist" class="'+(active==='blacklist'?'active':'')+'">Чёрный список</button>':'')+
 (profile.role==='admin'||profile.role==='examiner'?'<button data-tab="exams" class="'+(active==='exams'?'active':'')+'">Экзамены</button>':'')+
 (profile.role==='admin'?'<button data-tab="audit" class="'+(active==='audit'?'active':'')+'">Журнал аудита</button><button data-tab="access" class="'+(active==='access'?'active':'')+'">Управление доступом</button>':'')+
 '</nav>';
}
function bindNav(){
 document.getElementById('logout').onclick=logout;
 document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=async()=>{
  screen=button.dataset.tab;selected=null;
  if(screen==='audit'&&profile.role==='admin'){loading();await window.FSO_AUDIT.load(api,profile.role)}
  if(screen==='access'&&profile.role==='admin'){loading();await window.FSO_ACCESS.load(api,profile.role)}
  render();
 });
}
function workflowContext(){
 return {role:profile.role,userId:user.id,members,actions,exams:examsList,assignments,attempts:examAttempts};
}
function render(){
 if(!profile||!allowed.includes(profile.role))return;
 const workflow=window.FSO_LEADERSHIP,ctx=workflowContext();
 let content='';
 if(screen==='home')content=workflow.dashboard(ctx);
 else if(screen==='requests')content=workflow.requestPage(ctx);
 else if(screen==='leaves')content=workflow.leavePage(ctx);
 else if(screen==='history')content=workflow.historyPage(ctx,selected);
 else if(screen==='personnel')content=workflow.decisionPage(ctx,selected);
 else if(screen==='exams')content=exams();
 else if(screen==='audit'&&profile.role==='admin')content=window.FSO_AUDIT.render(profile.role,members);
 else if(screen==='access'&&profile.role==='admin')content=window.FSO_ACCESS.render(profile.role,user.id);
 else if(screen==='archive'&&rosterRoles.includes(profile.role))content=archivePage();
 else if(screen==='blacklist'&&rosterRoles.includes(profile.role))content=blacklistPage();
 else if(screen==='detail')content=detail();
 else if(screen==='add'||screen==='edit')content=editor(screen==='edit'?selected:null);
 else content=roster();
 const activeTab=['detail','add','edit'].includes(screen)?'roster':screen;
 root.innerHTML=nav(activeTab)+content;
 bindNav();bindScreen();
}
function roster(){
 const current=members.filter(m=>['active','cadet'].includes(m.status));
 const n=current.filter(m=>m.status==='active').length,c=current.filter(m=>m.status==='cadet').length;
 return hero('Сотрудники','Действующий состав Федеральной службы охраны.')+
 '<div class="cards roster-metrics"><div class="metric"><b>'+current.length+'</b><span>Всего в составе</span></div>'+
 '<div class="metric"><b>'+n+'</b><span>Сотрудники</span></div>'+
 '<div class="metric"><b>'+c+'</b><span>Курсанты</span></div></div>'+
 
 '<section class="section roster-section"><div class="section-heading"><div><span class="form-step">КАДРОВЫЙ РЕЕСТР</span><h2>Действующий состав</h2></div></div>'+
 '<div class="member-toolbar"><input id="search" type="search" placeholder="Поиск по ФИО, ID, отделу, должности, Discord" aria-label="Поиск сотрудников">'+rankFilter()+
 (rosterRoles.includes(profile.role)?'<button class="btn primary" id="new-member">+ Добавить сотрудника</button>':'')+
 '</div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Сотрудник</th><th>Должность</th><th>Подразделение</th><th>Звание</th><th>Взыскания</th><th>Статус</th><th></th></tr></thead><tbody id="roster-rows">'+rows(current)+'</tbody></table></div></section>';
}
function rows(data){
 const people=sortMembers(data);
 if(!people.length)return '<tr><td colspan="8" class="subtle">Записи не найдены.</td></tr>';
 return people.map(m=>{const z=kindcounts(m),danger=z.reprimands>=3&&['active','cadet'].includes(m.status);
 return '<tr class="'+(danger?'attention':'')+'"><td><span class="employee-id">'+e(m.employee_number)+'</span></td>'+
 '<td><strong class="employee-name">'+e(m.first_name+' '+m.last_name)+'</strong><small class="table-subline">'+e(m.discord||'Discord не указан')+'</small></td>'+
 '<td>'+e(m.position||'Не указана')+'</td>'+'<td>'+e(subdivisionOf(m))+'</td>'+
 '<td><span class="rank-badge rank-'+rankLevel(m.rank)+'">'+e(m.rank||'Не указано')+'</span></td>'+
 '<td><span class="tag '+(danger?'bad':'')+'">'+z.warnings+'/3 · '+z.reprimands+'/3</span></td>'+
 '<td><span class="status-label status-'+e(m.status)+'">'+e(statusTitle[m.status]||m.status)+'</span>'+
 (window.FSO_LEADERSHIP.leaveFor(m.id)?'<small class="table-subline lead-leave-tag">'+e(window.FSO_LEADERSHIP.leaveState(window.FSO_LEADERSHIP.leaveFor(m.id)))+'</small>':'')+'</td>'+
 '<td><div class="archive-row-actions"><button class="btn small" data-person="'+e(m.id)+'">Открыть</button>'+(screen==='archive'&&profile.role==='admin'?'<button type="button" class="btn danger small" data-archive-delete="'+e(m.id)+'">Удалить</button>':'')+'</div></td></tr>'
 }).join('');
}
function detail(){
const m=members.find(x=>x.id===selected);if(!m){screen='roster';return roster()}
const c=kindcounts(m),list=actions.filter(x=>x.member_id===m.id),history=audits.filter(x=>x.member_id===m.id);
const can=rosterRoles.includes(profile.role)&&!['dismissed','archived'].includes(m.status);const retired=['dismissed','archived'].includes(m.status);const listed=blacklist.some(x=>x.member_id===m.id&&!x.removed_at);
const head=hero(m.first_name+' '+m.last_name,'Личное дело № '+m.employee_number)+
'<div class="detail-rank"><span class="rank-badge rank-'+rankLevel(m.rank)+'">'+e(m.rank||'Без звания')+'</span><span class="status-label status-'+e(m.status)+'">'+e(statusTitle[m.status])+'</span></div><div class="actions"><button class="btn" id="back-roster">← '+(retired?'Архив':'Реестр')+'</button>'+
(can?'<button class="btn primary" id="edit-person">Редактировать личное дело</button>':'')+
 (can?'<button class="btn" type="button" id="open-personnel">Кадровое решение</button>':'')+'</div>';
const warning=c.reprimands>=3&&!retired?'<div class="danger-box"><b>Три действующих выговора · '+c.reprimands+'/3</b><p>Основание по пункту 30.3. Увольнение доступно и по другим причинам.</p></div>':'';
const dismissal=can?'<section class="section"><h2>Увольнение сотрудника</h2><p class="hint">Уволить можно в любой момент. Причина обязательна, доказательства необязательны.</p><button class="btn danger" id="dismiss-show">Уволить сотрудника</button><form id="dismiss-form" hidden><div class="fields"><label class="wide">Причина увольнения<textarea id="dismiss-reason" required minlength="5" maxlength="4000"></textarea></label><label class="wide">Доказательства (необязательно), ссылки HTTPS<textarea id="dismiss-proof"></textarea></label></div><div class="actions"><button class="btn danger" type="submit">Подтвердить увольнение</button></div><div id="dismiss-error"></div></form></section>':'';
const blackAction=retired&&rosterRoles.includes(profile.role)?'<section class="section"><h2>Чёрный список</h2>'+(listed?'<p class="text-critical">Сотрудник находится в чёрном списке.</p><form id="black-remove-form"><div class="fields"><label class="wide">Причина исключения<textarea id="black-remove-reason" required minlength="5" maxlength="4000"></textarea></label></div><button class="btn" type="submit">Исключить из чёрного списка</button><div id="black-error"></div></form>':'<form id="black-add-form"><div class="fields"><label class="wide">Причина внесения<textarea id="black-reason" required minlength="5" maxlength="4000"></textarea></label></div><button class="btn danger" type="submit">Внести в чёрный список</button><div id="black-error"></div></form>')+'</section>':'';
const fields=[['Служебный ID',m.employee_number],['Должность',m.position],['Подразделение',subdivisionOf(m)],['Звание',m.rank],['Discord',m.discord],['Дата вступления',date(m.joined_on)],['Стаж во фракции',days(m.joined_on)],['Статус',statusTitle[m.status]],['Дата увольнения',m.dismissed_on?date(m.dismissed_on):'Нет']].map(x=>'<div class="card-muted"><span>'+e(x[0])+'</span><strong>'+e(x[1]||'Не указано')+'</strong></div>').join('');
const counter='<div class="cards"><div class="metric"><b>'+c.warnings+'/3</b><span>Действующие предупреждения</span></div><div class="metric"><b class="'+(c.reprimands>=3?'text-critical':'')+'">'+c.reprimands+'/3</b><span>Действующие выговоры</span></div></div>';
const listing='<section class="section"><h2>Взыскания и их история</h2>'+(list.length?list.map(x=>{
const type=x.kind==='warning'?'Предупреждение':'Выговор';
const state={active:'Действует',converted:'Преобразовано в выговор',removed:'Снято',voided:'Отменено'}[x.status]||x.status;
const proof=Array.isArray(x.evidence)?x.evidence.filter(y=>typeof y==='string'&&y.startsWith('https://')).map(y=>'<a class="link" target="_blank" rel="noopener noreferrer" href="'+e(y)+'">Доказательство</a>').join(' · '):'';
const remove=can&&x.status==='active'?'<button class="btn small" type="button" data-remove="'+e(x.id)+'">Снять взыскание</button>':'';
return '<div class="record"><div class="row between"><strong>'+e(type)+' · <span class="'+(x.status==='active'?'text-warn':'subtle')+'">'+e(state)+'</span></strong><span class="subtle">'+date(x.issued_at)+'</span></div><p>'+e(x.reason)+'</p><div class="subtle">'+proof+'</div>'+(x.removal_reason?'<p class="hint">Причина снятия · '+e(x.removal_reason)+'</p>':'')+(Array.isArray(x.removal_evidence)?x.removal_evidence.filter(y=>typeof y==='string'&&y.startsWith('https://')).map(y=>'<a class="link" rel="noopener noreferrer" target="_blank" href="'+e(y)+'">Доказательство снятия</a>').join(' · '):'')+'<div class="actions">'+remove+'</div></div>'
}).join(''):'<div class="empty">Взысканий нет.</div>')+
(can?'<form class="section" id="remove-form" hidden style="margin-top:12px"><h3>Снятие взыскания</h3><input type="hidden" id="remove-id"><div class="fields"><label class="wide">Основание снятия<textarea required minlength="5" id="remove-reason"></textarea></label><label class="wide">Доказательства, ссылки HTTPS<textarea required id="remove-proof" placeholder="https://... (одна ссылка на строку)"></textarea></label></div><div class="actions"><button type="submit" class="btn primary">Подтвердить снятие</button><button type="button" class="btn" id="remove-cancel">Отмена</button></div><div id="remove-error"></div></form>':'')+'</section>';
const events=history.length?'<section class="section"><h2>Журнал решений</h2><div class="records">'+history.map(x=>'<div class="record"><strong>'+e(({issued:'Выдача взыскания',converted:'Автоматическая замена',removed:'Снятие взыскания',dismissed:'Увольнение'}[x.event]||x.event))+'</strong><small>'+date(x.occurred_at)+' · '+e(x.details?.reason||'Событие зафиксировано в журнале')+'</small></div>').join('')+'</div></section>':'';
return '<div class="'+(c.reprimands>=3?'critical-profile':'')+'">'+head+'<section class="section member-profile-section"><div class="section-heading"><div><span class="form-step">СВЕДЕНИЯ</span><h2>Личное дело</h2></div></div><div class="member-details">'+fields+'</div></section>'+counter+warning+listing+events+window.FSO_LEADERSHIP.memberEvents(m)+window.FSO_LEADERSHIP.accountPanel(m,profile.role)+blackAction+dismissal+'</div>';
}
function editor(id){
 if(!rosterRoles.includes(profile.role))return msg('Недостаточно прав.',true);
 const m=id?members.find(x=>x.id===id):null,existing=m?.rank||'Рядовой';
 const known=rankNames.some(x=>rankKey(x)===rankKey(existing));
 return hero(m?'Редактирование сотрудника':'Добавление сотрудника',m?'Изменения сохраняются на сервере.':'После сохранения сотрудник появится в кадровом реестре.')+
 '<section class="section member-form-section"><div class="section-heading"><div><span class="form-step">ЛИЧНОЕ ДЕЛО</span><h2>Служебные сведения</h2></div><span class="sort-note">* Обязательное поле</span></div><form id="member-form"><div class="fields">'+
 '<label>Числовой ID *<input id="member-no" inputmode="numeric" pattern="[0-9]{1,12}" maxlength="12" value="'+e(m?.employee_number||'')+'" placeholder="0001" required></label>'+
 (m?'<div class="card-muted member-form-readonly"><span>Подразделение</span><strong>'+e(subdivisionOf(m))+'</strong><input type="hidden" id="member-department" value="'+e(subdivisionOf(m))+'"></div>':
  '<label>Подразделение *<select id="member-department" required>'+subdivisionOptions.map(x=>'<option value="'+e(x)+'" '+(x==='Академия'?'selected':'')+'>'+e(x)+'</option>').join('')+'</select></label>')+
 '<label>Имя *<input id="member-first" maxlength="100" value="'+e(m?.first_name||'')+'" required></label>'+
 '<label>Фамилия *<input id="member-last" maxlength="100" value="'+e(m?.last_name||'')+'" required></label>'+
 (m?'<div class="card-muted member-form-readonly"><span>Должность</span><strong>'+e(m.position||'Не указана')+'</strong></div>':
 '<label>Должность<input id="member-position" maxlength="200"></label>')+
 
 (m?'<div class="card-muted member-form-readonly"><span>Воинское звание</span><strong>'+e(m.rank||'Не указано')+'</strong></div>':
 '<label>Воинское звание *<select id="member-rank" required><option value="" disabled selected>Выберите звание</option>'+rankOptions('')+'</select></label>')+
 '<label>Discord<input id="member-discord" maxlength="150" value="'+e(m?.discord||'')+'"></label>'+
 '<label>Дата вступления *<input id="member-date" type="date" value="'+e(m?.joined_on||new Date().toISOString().slice(0,10))+'" required></label>'+
 '</div>'+(m?'':window.FSO_STAFF_ACCOUNTS.newFields())+
 '<p class="hint rank-help">Звания расположены от генерал-майора до рядового. После сохранения порядок в таблице обновляется автоматически.</p>'+
 '<div class="actions"><button class="btn primary" type="submit">Сохранить личное дело</button><button class="btn" type="button" id="cancel-editor">Отмена</button></div>'+
 (m?'<p class="hint">Звание, должность и подразделение меняются через раздел «Кадровые решения».</p>':'')+
 '<div id="save-error" role="alert"></div></form></section>';
}
function exams(){
if(!['admin','examiner'].includes(profile.role))return msg('Нет полномочий экзаменатора.',true);
const choices=questions.map(q=>'<label class="question-check"><input type="checkbox" class="exam-choose" value="'+e(q.id)+'"><span><small>Уровень '+e(q.difficulty)+'</small>'+e(q.prompt)+'</span></label>').join('');
const examOptions=examsList.filter(x=>x.status==='published').map(x=>'<option value="'+e(x.id)+'">'+e(x.title)+'</option>').join('');
const memberOptions=members.filter(m=>['active','cadet'].includes(m.status)).map(x=>'<option value="'+e(x.id)+'">'+e(x.employee_number+' · '+x.first_name+' '+x.last_name)+'</option>').join('');

return hero('Экзамены и аттестация','Серверная система. Коды индивидуальные, ответы проверяются на сервере.')+
'<div class="cards"><div class="metric"><b>'+questions.length+'</b><span>Вопросов в банке</span></div><div class="metric"><b>'+examsList.length+'</b><span>Экзаменов</span></div><div class="metric"><b>'+assignments.length+'</b><span>Назначений</span></div><div class="metric"><b>'+examAttempts.filter(x=>!!x.completed_at).length+'</b><span>Завершённых попыток</span></div></div>'+
'<section class="section"><h2>Создать экзамен</h2><form id="exam-create"><div class="fields"><label class="wide">Название экзамена<input id="exam-title" required minlength="4" maxlength="160" placeholder="Первичная аттестация курсанта"></label><label>Проходной балл, %<input id="exam-pass" type="number" required min="1" max="100" value="80"></label><label>Время, минут<input id="exam-minutes" type="number" required min="1" max="480" value="30"></label><label>Максимум попыток<input id="exam-max" type="number" required min="1" max="10" value="1"></label></div><p class="hint">Выберите от 1 до 60 вопросов. Состав экзамена фиксируется при создании.</p><div class="q-picker">'+choices+'</div><div class="actions"><span id="question-count" class="tag">Выбрано 0</span><button class="btn primary" type="submit">Создать экзамен</button></div><div id="exam-create-error"></div></form></section>'+
'<section class="section"><h2>Добавить собственный вопрос</h2><form id="question-create"><div class="fields"><label>Сложность<select id="new-question-level"><option value="1">Основы</option><option value="2">Применение</option><option value="3">Сложные ситуации</option></select></label><label class="wide">Формулировка<textarea id="new-question-prompt" required minlength="12"></textarea></label>'+['A','B','C','D'].map((v,i)=>'<label>Ответ '+v+'<input id="new-question-opt-'+i+'" required></label>').join('')+'<label>Правильный вариант<select id="new-question-correct">'+['A','B','C','D'].map((v,i)=>'<option value="'+i+'">'+v+'</option>').join('')+'</select></label><label class="wide">Объяснение и правовое обоснование<textarea id="new-question-explanation" required minlength="10"></textarea></label></div><div class="actions"><button type="submit" class="btn">Добавить в банк</button></div><div id="question-create-error"></div></form></section>'+
'<section class="section"><h2>Назначить экзамен</h2><form id="exam-assign"><div class="fields"><label>Экзамен<select id="exam-assign-exam" required>'+examOptions+'</select></label><label>Курсант или сотрудник<select id="exam-assign-member" required>'+memberOptions+'</select></label><label>Код действителен до<input id="exam-expires" type="date" min="'+new Date().toISOString().slice(0,10)+'"></label></div><div class="actions"><button class="btn primary" type="submit" '+(!examOptions||!memberOptions?'disabled':'')+'>Выдать индивидуальный код</button></div><div id="exam-assign-error"></div></form>'+
(newlyIssuedCode?'<div class="notice"><strong>Сохраните новый код, он показывается только сейчас</strong><p style="font-size:20px;font-weight:850;word-break:break-all">'+e(newlyIssuedCode)+'</p><button class="btn small" id="code-copy" type="button">Скопировать код</button></div>':'')+'</section>'+
window.FSO_ADMIN_TOOLS.examPanels({exams:examsList,assignments,attempts:examAttempts,members,staff:examStaff,role:profile.role});
}
function bindScreen(){if(screen==='access'){window.FSO_ACCESS.bind(api,profile.role,user.id,{refresh,render,audit:async()=>{screen='audit';selected=null;loading();await window.FSO_AUDIT.load(api,profile.role);render();const filter=document.getElementById('audit-category');if(filter){filter.value='profile';filter.dispatchEvent(new Event('change'))}}});return}if(screen==='audit'){window.FSO_AUDIT.bind(api,profile.role,members,async()=>{loading();await window.FSO_AUDIT.load(api,profile.role);render()});return}
 if(['home','requests','leaves','history','personnel'].includes(screen)){
 window.FSO_LEADERSHIP.bind(workflowContext(),api,screen,refresh,(next,member)=>{
  screen=next;selected=member||null;render();
 });
 return;
}
if(['roster','archive','blacklist'].includes(screen)){
  const search=document.getElementById('search'),rank=document.getElementById('rank-filter');
  function updateRoster(){
   const term=(search?.value||'').trim().toLocaleLowerCase('ru-RU'),selectedRank=rank?.value||'';
   const source=screen==='archive'?members.filter(m=>['dismissed','archived'].includes(m.status)):
     screen==='blacklist'?members.filter(m=>blacklist.some(x=>x.member_id===m.id&&!x.removed_at)):
     members.filter(m=>['active','cadet'].includes(m.status));
   document.getElementById('roster-rows').innerHTML=rows(source.filter(m=>(!selectedRank||rankKey(m.rank)===rankKey(selectedRank))&&
      [m.employee_number,m.first_name,m.last_name,m.position,m.department,m.rank,m.discord].some(x=>String(x||'').toLocaleLowerCase('ru-RU').includes(term))));
   document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>{selected=b.dataset.person;screen='detail';render()});
  }
  if(search)search.oninput=updateRoster;
  if(rank)rank.onchange=updateRoster;
 if(screen==='archive'&&profile.role==='admin')window.FSO_ADMIN_TOOLS.bindArchive(api,members.filter(m=>['dismissed','archived'].includes(m.status)),refresh);
  const add=document.getElementById('new-member');
  if(add)add.onclick=()=>{screen='add';selected=null;render()};
  document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>{selected=b.dataset.person;screen='detail';render()});
 }
if(screen==='detail'){
 const linked=members.find(m=>m.id===selected);
 if(linked)window.FSO_LEADERSHIP.bindAccount(api,linked,refresh);
 const personnelBtn=document.getElementById('open-personnel');
 if(personnelBtn)personnelBtn.onclick=()=>{screen='personnel';render()};
}
if(screen==='detail'){document.getElementById('back-roster').onclick=()=>{screen=members.find(x=>x.id===selected)&&['dismissed','archived'].includes(members.find(x=>x.id===selected).status)?'archive':'roster';selected=null;render()};const b=document.getElementById('edit-person');if(b)b.onclick=()=>{screen='edit';render()}}if(screen==='detail'){

document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{document.getElementById('remove-id').value=b.dataset.remove;document.getElementById('remove-form').hidden=false;document.getElementById('remove-form').scrollIntoView({behavior:'smooth',block:'center'});});
const rf=document.getElementById('remove-form');if(rf)rf.onsubmit=submitRemoval;
const rc=document.getElementById('remove-cancel');if(rc)rc.onclick=()=>{rf.hidden=true;rf.reset()};
const ds=document.getElementById('dismiss-show');if(ds)ds.onclick=()=>{document.getElementById('dismiss-form').hidden=false};
const df=document.getElementById('dismiss-form');if(df)df.onsubmit=submitDismiss;const ba=document.getElementById('black-add-form');if(ba)ba.onsubmit=submitBlacklistAdd;const br=document.getElementById('black-remove-form');if(br)br.onsubmit=submitBlacklistRemove;
}
if(screen==='exams'){
const chooser=document.querySelectorAll('.exam-choose');const badge=document.getElementById('question-count');
chooser.forEach(x=>x.onchange=()=>{badge.textContent='Выбрано '+document.querySelectorAll('.exam-choose:checked').length});
document.getElementById('exam-create').onsubmit=createOfficialExam;
document.getElementById('question-create').onsubmit=createOwnQuestion;
document.getElementById('exam-assign').onsubmit=assignOfficialExam;
const cp=document.getElementById('code-copy');if(cp)cp.onclick=()=>navigator.clipboard.writeText(newlyIssuedCode).then(()=>flash('Код скопирован')).catch(()=>flash('Скопируйте код вручную',true));
window.FSO_ADMIN_TOOLS.bindExams(api,{exams:examsList,assignments,attempts:examAttempts,members,staff:examStaff,role:profile.role},refresh);
}
if(screen==='add'||screen==='edit'){
 document.getElementById('cancel-editor').onclick=()=>{screen='roster';render()};
 document.getElementById('member-form').onsubmit=saveMember;
 if(screen==='add')window.FSO_STAFF_ACCOUNTS.bindNewForm()
}}

function readOptionalProof(id){if(!v(id))return [];return readProof(id)}
function archivePage(){const data=members.filter(m=>['dismissed','archived'].includes(m.status));return hero('Архив','Уволенные сотрудники и сохранённые личные дела.')+'<section class="section"><div class="member-toolbar"><input id="search" type="search" placeholder="Поиск по архиву">'+rankFilter()+'</div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Имя и фамилия</th><th>Должность</th><th>Подразделение</th><th>Звание</th><th>Взыскания</th><th>Статус</th><th></th></tr></thead><tbody id="roster-rows">'+rows(data)+'</tbody></table></div>'+window.FSO_ADMIN_TOOLS.archiveToolbar(data,profile.role)+'</section>'}
function blacklistPage(){const data=members.filter(m=>blacklist.some(x=>x.member_id===m.id&&!x.removed_at));return hero('Чёрный список','Сотрудники, внесённые по решению руководства.')+'<section class="section"><div class="member-toolbar"><input id="search" type="search" placeholder="Поиск по чёрному списку">'+rankFilter()+'</div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Имя и фамилия</th><th>Должность</th><th>Подразделение</th><th>Звание</th><th>Взыскания</th><th>Статус</th><th></th></tr></thead><tbody id="roster-rows">'+rows(data)+'</tbody></table></div></section>'+data.map(m=>{const b=blacklist.find(x=>x.member_id===m.id&&!x.removed_at);return '<div class="record"><strong>'+e(m.first_name+' '+m.last_name)+'</strong><p>Причина: '+e(b.reason)+'</p><small>Внесён: '+date(b.added_at)+'</small></div>'}).join('')}
async function submitBlacklistAdd(ev){ev.preventDefault();const b=ev.target.querySelector('[type=submit]');b.disabled=true;try{const {data,error}=await api.functions.invoke('fso-staff-account',{body:{action:'blacklist',member_id:selected,reason:v('black-reason')}});if(error||!data?.ok)throw Error(data?.error||error?.message||'Не удалось оформить чёрный список');flash('Сотрудник внесён в чёрный список, аккаунт удалён');await refresh()}catch(err){document.getElementById('black-error').innerHTML=msg(err.message||'Ошибка',true)}finally{b.disabled=false}}
async function submitBlacklistRemove(ev){ev.preventDefault();const b=ev.target.querySelector('[type=submit]');b.disabled=true;try{if(!confirm('Исключить сотрудника из чёрного списка?'))return;const {error}=await api.rpc('fso_blacklist_remove',{p_member:selected,p_reason:v('black-remove-reason')});if(error)throw error;flash('Сотрудник исключён из чёрного списка');await refresh()}catch(err){document.getElementById('black-error').innerHTML=msg(err.message||'Ошибка',true)}finally{b.disabled=false}}
function readProof(id){
const lines=v(id).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
if(!lines.length||lines.length>15||lines.some(x=>!/^https:\/\/\S+$/.test(x)))throw Error('Добавьте от 1 до 15 ссылок вида https://..., каждую с новой строки');
return lines;
}
async function submitRemoval(ev){
ev.preventDefault();const b=ev.target.querySelector('[type=submit]');b.disabled=true;
try{
const {error}=await api.rpc('fso_remove_discipline',{p_action:v('remove-id'),p_reason:v('remove-reason'),p_evidence:readProof('remove-proof')});
if(error)throw error;flash('Взыскание снято, история сохранена');await refresh();
}catch(err){document.getElementById('remove-error').innerHTML=msg(err.message||'Ошибка снятия',true)}finally{b.disabled=false}
}
async function submitDismiss(ev){
ev.preventDefault();const b=ev.target.querySelector('[type=submit]');b.disabled=true;
try{
if(!window.confirm('Уволить сотрудника и переместить личное дело в архив?'))return;
const {data,error}=await api.functions.invoke('fso-staff-account',{body:{action:'dismiss',member_id:selected,reason:v('dismiss-reason'),evidence:readOptionalProof('dismiss-proof')}});
if(error||!data?.ok)throw Error(data?.error||error?.message||'Не удалось оформить увольнение');flash('Сотрудник уволен, аккаунт удалён, личное дело перенесено в архив');screen='archive';selected=null;await refresh();
}catch(err){document.getElementById('dismiss-error').innerHTML=msg(err.message||'Ошибка увольнения',true)}finally{b.disabled=false}
}

async function createOfficialExam(ev){
ev.preventDefault();const ids=[...document.querySelectorAll('.exam-choose:checked')].map(x=>x.value);
if(!ids.length){document.getElementById('exam-create-error').innerHTML=msg('Выберите хотя бы один вопрос',true);return}
const b=ev.target.querySelector('[type=submit]');b.disabled=true;
try{
const {error}=await api.rpc('fso_make_exam',{p_title:v('exam-title'),p_questions:ids,p_pass_percent:Number(v('exam-pass')),p_duration:Number(v('exam-minutes')),p_max_attempts:Number(v('exam-max'))});
if(error)throw error;flash('Экзамен создан');await refresh()
}catch(err){document.getElementById('exam-create-error').innerHTML=msg(err.message||'Ошибка создания',true)}finally{b.disabled=false}
}
async function createOwnQuestion(ev){
ev.preventDefault();const b=ev.target.querySelector('[type=submit]');b.disabled=true;
try{
const options=[0,1,2,3].map(i=>v('new-question-opt-'+i));
if(options.some(x=>!x))throw Error('Заполните все варианты ответов');
const payload={difficulty:Number(v('new-question-level')),prompt:v('new-question-prompt'),options,correct_answers:[Number(v('new-question-correct'))],explanation:v('new-question-explanation'),source_refs:[],author_id:user.id,is_published:true};
const {error}=await api.from('fso_questions').insert(payload);
if(error)throw error;flash('Вопрос добавлен в банк');await refresh()
}catch(err){document.getElementById('question-create-error').innerHTML=msg(err.message||'Ошибка добавления',true)}finally{b.disabled=false}
}
async function assignOfficialExam(ev){
ev.preventDefault();const b=ev.target.querySelector('[type=submit]');b.disabled=true;
try{
const expires=v('exam-expires');
const {data,error}=await api.rpc('fso_assign_exam',{p_exam:v('exam-assign-exam'),p_member:v('exam-assign-member'),p_expires_at:expires?new Date(expires+'T23:59:59').toISOString():null});
if(error)throw error;newlyIssuedCode=data.access_code;flash('Назначение создано. Обязательно сохраните код.');await refresh()
}catch(err){document.getElementById('exam-assign-error').innerHTML=msg(err.message||'Ошибка назначения',true)}finally{b.disabled=false}
}
async function saveMember(ev){
 ev.preventDefault();
 const button=ev.target.querySelector('[type=submit]');
 if(button.disabled)return;
 button.disabled=true;
 const old=screen==='edit'&&selected;
 const payload={
  employee_number:v('member-no'),first_name:v('member-first'),last_name:v('member-last'),
  discord:v('member-discord'),joined_on:v('member-date'),department:v('member-department'),
   status:v('member-department')==='Академия'?'cadet':'active'
 };
 if(!old){payload.position=v('member-position');payload.rank=v('member-rank')}
 const area=document.getElementById('save-error');
 try{
  if(!/^\d{1,12}$/.test(payload.employee_number))throw Error('ID должен содержать только цифры');
  if(!old&&!rankNames.includes(payload.rank))throw Error('Выберите звание из списка');
  const credential=old?null:window.FSO_STAFF_ACCOUNTS.newValues();
  if(old){
   const {data,error}=await api.rpc('fso_member_subdivision_save',{
    p_member:selected,p_employee_number:payload.employee_number,
    p_first_name:payload.first_name,p_last_name:payload.last_name,
    p_discord:payload.discord,p_joined_on:payload.joined_on,
    p_department:payload.department,p_reason:''
   });
   if(error)throw error;
   selected=data.member_id;
  }else{
   const result=await api.from('fso_members').insert(payload).select('id').single();
   if(result.error)throw result.error;
   selected=result.data.id;
  }
  if(!old){
   try{
    await window.FSO_STAFF_ACCOUNTS.issue(api,{id:selected},credential.login,credential.password);
    flash('Сотрудник добавлен. Логин и временный пароль готовы к выдаче');
   }catch(err){
    window.FSO_STAFF_ACCOUNTS.failed(selected,err);
    flash('Личное дело создано, но аккаунт не выдан. Откройте личное дело и повторите выдачу',true);
   }
  }else flash('Личное дело обновлено');
  screen='detail';
  await refresh();
 }catch(err){if(area)area.innerHTML=msg(err.message||'Ошибка сохранения',true)}
 finally{button.disabled=false}
}
async function logout(){await api.auth.signOut();user=null;profile=null;members=[];blacklist=[];window.FSO_AUDIT.clear();window.FSO_ACCESS.clear();window.FSO_LEADERSHIP.clear();window.FSO_STAFF_ACCOUNTS.forget();members=[];actions=[];examsList=[];assignments=[];examAttempts=[];screen='home';authPage()}
async function init(){if(!window.supabase?.createClient){root.innerHTML=msg('Не загрузилась библиотека Supabase. Проверьте соединение с интернетом.',true);return}api=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});api.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){user=null;profile=null;members=[];actions=[];window.FSO_LEADERSHIP.clear();window.FSO_STAFF_ACCOUNTS.forget();authPage()}});await refresh()}
init().catch(err=>{root.innerHTML=msg('Не удалось подключиться к серверу: '+(err.message||err),true)});
})();