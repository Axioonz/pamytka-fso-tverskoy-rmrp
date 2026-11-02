(()=>{'use strict';
const URL='https://lejagyuibxdnvpmxoggy.supabase.co';
const KEY='sb_publishable_8cdFcw4V8F545924bpdLjg_3yKTHt1d';
const EXAM_EDGE=URL+'/functions/v1/fso-cadet-exam';
const root=document.getElementById('main'), toast=document.getElementById('toast');
const allowed=['admin','hr','examiner'];const rosterRoles=['admin','hr'];
let api=null,user=null,profile=null,members=[],actions=[],audits=[],questions=[],examsList=[],assignments=[],examAttempts=[],screen='home',selected=null;
let newlyIssuedCode=null,cadetCode='',cadetState=null,cadetIndex=0,cadetPending=false;
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const v=id=>document.getElementById(id)?.value?.trim()||'';
const date=x=>x?new Date(String(x).slice(0,10)+'T12:00:00').toLocaleDateString('ru-RU'):'Не указана';
const roleTitle={admin:'Администратор',hr:'Кадровый сотрудник',examiner:'Экзаменатор',employee:'Сотрудник',cadet:'Курсант'};
const statusTitle={active:'В составе',cadet:'Курсант',dismissed:'Уволен',archived:'Архив'};
function flash(msg,bad=false){toast.textContent=msg;toast.style.background=bad?'#502129':'#15354b';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),4200)}
function msg(text,bad=false){return '<div class="message '+(bad?'error':'')+'">'+e(text)+'</div>'}
function loading(){root.innerHTML='<div class="section">Загрузка данных...</div>'}
function days(iso){if(!iso)return 'Не указан';const from=new Date(iso+'T12:00:00'),to=new Date();return Math.max(0,Math.floor((to-from)/864e5))+' дн.'}
function kindcounts(m){const rows=actions.filter(a=>a.member_id===m.id&&a.status==='active');return {warnings:rows.filter(a=>a.kind==='warning').length,reprimands:rows.filter(a=>a.kind==='reprimand').length}}
function hero(title,subtitle=''){return '<div class="eyebrow">FSO / СЛУЖЕБНЫЙ ПОРТАЛ</div><h1>'+e(title)+'</h1><p class="head-subtitle">'+e(subtitle)+'</p>'}
function authPage(error=''){root.innerHTML='<div class="auth-layout">'+hero('Вход в личный кабинет','Доступ только по служебной учётной записи. Памятка остаётся общедоступной.')+'<section class="section"><h2>Авторизация</h2>'+(error?msg(error,true):'')+'<form id="login-form" class="auth-form"><label>Электронная почта<input id="email" type="email" autocomplete="username" placeholder="name@example.com" required></label><label>Пароль<input id="password" type="password" autocomplete="current-password" required></label><button class="btn primary" type="submit">Войти</button></form><div class="foot">Если аккаунт был создан приглашением, используйте установленный вами пароль.</div><div class="actions"><button class="btn" type="button" id="to-cadet">Для курсантов · вход по коду</button></div></section></div>';document.getElementById('login-form').addEventListener('submit',login);document.getElementById('to-cadet').onclick=()=>{location.hash='cadet';window.FSO_CADET.open()}}
async function login(ev){ev.preventDefault();const btn=ev.target.querySelector('button');btn.disabled=true;try{const {error}=await api.auth.signInWithPassword({email:v('email'),password:v('password')});if(error)throw error;await refresh()}catch(err){authPage(err.message||'Не удалось войти')}finally{btn.disabled=false}}
async function refresh(){loading();const {data:{user:u},error:ue}=await api.auth.getUser();if(ue||!u){user=null;profile=null;if(location.hash==='#cadet'){window.FSO_CADET.open();return}authPage();return}user=u;const pr=await api.from('fso_profiles').select('user_id,role,display_name').eq('user_id',u.id).maybeSingle();if(pr.error){root.innerHTML=msg('Не удалось прочитать служебный профиль: '+pr.error.message,true);return}profile=pr.data;if(!profile||!allowed.includes(profile.role)){root.innerHTML=hero('Недостаточно прав','Ваш аккаунт существует, но доступ к кабинету руководства не предоставлен.')+'<div class="section">Уровень доступа: '+e(roleTitle[profile?.role]||'не назначен')+'<div class="actions"><button class="btn" id="logout">Выйти</button></div></div>';document.getElementById('logout').onclick=logout;return}
const m=await api.from('fso_members').select('id,user_id,employee_number,first_name,last_name,position,rank,discord,joined_on,status,dismissed_on,created_at,updated_at').order('created_at',{ascending:false});if(m.error){root.innerHTML=msg('Ошибка получения личного состава: '+m.error.message,true);return}members=m.data||[];
const a=await api.from('fso_disciplinary_actions').select('id,member_id,kind,status,reason,evidence,issued_at,removed_at,removal_reason,removal_evidence,converted_to').order('issued_at',{ascending:false});actions=a.error?[]:(a.data||[]);const log=await api.from('fso_disciplinary_audit').select('id,member_id,event,details,occurred_at').order('occurred_at',{ascending:false}).limit(500);audits=log.error?[]:(log.data||[]);
if(['admin','examiner'].includes(profile.role)){
const [q,ex,as,at]=await Promise.all([
api.from('fso_questions').select('id,source_key,difficulty,prompt').eq('is_published',true).order('source_key'),
api.from('fso_exams').select('id,title,pass_percent,duration_minutes,max_attempts,status,created_at').order('created_at',{ascending:false}),
api.from('fso_exam_assignments').select('id,exam_id,member_id,status,assigned_at,expires_at').order('assigned_at',{ascending:false}),
api.from('fso_exam_attempts').select('id,assignment_id,correct_count,total_count,passed,completed_at,started_at').order('started_at',{ascending:false})
]);
questions=q.data||[];examsList=ex.data||[];assignments=as.data||[];examAttempts=at.data||[];
}
render()}
function nav(active){return '<div class="row between" style="margin-bottom:20px"><div class="row"><span class="badge">'+e(roleTitle[profile.role])+'</span><span class="subtle">'+e(user.email)+'</span></div><button class="btn small" id="logout">Выйти</button></div><nav class="tabs" aria-label="Разделы"><button data-tab="roster" class="'+(active==='roster'?'active':'')+'">Личный состав</button><button data-tab="exams" class="'+(active==='exams'?'active':'')+'">Экзамены</button></nav>'}
function bindNav(){document.getElementById('logout').onclick=logout;document.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>{screen=x.dataset.tab;selected=null;render()})}
function render(){if(!profile||!allowed.includes(profile.role))return;let content='';if(screen==='exams')content=exams();else if(screen==='detail')content=detail();else if(screen==='add')content=editor();else if(screen==='edit')content=editor(selected);else content=roster();root.innerHTML=nav(screen==='exams'?'exams':'roster')+content;bindNav();bindScreen()}
function roster(){const n=members.filter(m=>m.status==='active').length;const c=members.filter(m=>m.status==='cadet').length;return hero('Личный состав','Единый реестр сотрудников. Изменения сохраняются в Supabase и доступны уполномоченному руководству.')+'<div class="cards"><div class="metric"><b>'+members.length+'</b><span>Всего личных дел</span></div><div class="metric"><b>'+n+'</b><span>В составе</span></div><div class="metric"><b>'+c+'</b><span>Курсанты</span></div><div class="metric"><b>'+members.filter(m=>kindcounts(m).reprimands>=3).length+'</b><span>Основание для увольнения</span></div></div><section class="section"><div class="member-toolbar"><input id="search" type="search" placeholder="Поиск по имени, ID, должности, Discord" aria-label="Поиск сотрудников">'+(rosterRoles.includes(profile.role)?'<button class="btn primary" id="new-member">+ Добавить сотрудника</button>':'')+'</div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Имя и фамилия</th><th>Должность</th><th>Звание</th><th>Взыскания</th><th>Статус</th><th></th></tr></thead><tbody id="roster-rows">'+rows(members)+'</tbody></table></div></section>'}
function rows(data){if(!data.length)return '<tr><td colspan="7" class="subtle">Сотрудники не найдены.</td></tr>';return data.map(m=>{const z=kindcounts(m);return '<tr class="'+(z.reprimands>=3?'attention':'')+'"><td>'+e(m.employee_number)+'</td><td><b>'+e(m.first_name+' '+m.last_name)+'</b></td><td>'+e(m.position||'Не указана')+'</td><td>'+e(m.rank||'Не указано')+'</td><td><span class="tag '+(z.reprimands>=3?'bad':'')+'">'+z.warnings+'/3 · '+z.reprimands+'/3</span></td><td>'+e(statusTitle[m.status])+'</td><td><button class="btn small" data-person="'+e(m.id)+'">Открыть</button></td></tr>'}).join('')}
function detail(){
const m=members.find(x=>x.id===selected);if(!m){screen='roster';return roster()}
const c=kindcounts(m),list=actions.filter(x=>x.member_id===m.id),history=audits.filter(x=>x.member_id===m.id);
const can=rosterRoles.includes(profile.role)&&!['dismissed','archived'].includes(m.status);
const head=hero(m.first_name+' '+m.last_name,'Личное дело № '+m.employee_number)+
'<div class="actions"><button class="btn" id="back-roster">← Реестр</button>'+
(can?'<button class="btn primary" id="edit-person">Редактировать личное дело</button>':'')+'</div>';
const warning=c.reprimands>=3?'<div class="danger-box"><b>Основание для увольнения по пункту 30.3 · Выговоры '+c.reprimands+'/3</b><p>Решение принимает уполномоченное руководство. Снятие действующего взыскания автоматически убирает красный статус при снижении количества выговоров.</p>'+
(can?'<button class="btn danger" id="dismiss-show">Оформить увольнение</button><form id="dismiss-form" class="fields" hidden style="margin-top:14px"><label class="wide">Причина увольнения<textarea id="dismiss-reason" required minlength="5" maxlength="4000" placeholder="Обоснование принятого решения"></textarea></label><label class="wide">Доказательства решения, ссылки HTTPS<textarea id="dismiss-proof" required placeholder="https://... (одна ссылка на строку)"></textarea></label><button class="btn danger" type="submit">Подтвердить увольнение</button><div id="dismiss-error"></div></form>':'')+'</div>':'';
const fields=[['Служебный ID',m.employee_number],['Должность',m.position],['Звание',m.rank],['Discord',m.discord],['Дата вступления',date(m.joined_on)],['Стаж во фракции',days(m.joined_on)],['Статус',statusTitle[m.status]],['Дата увольнения',m.dismissed_on?date(m.dismissed_on):'Нет']].map(x=>'<div class="card-muted"><span>'+e(x[0])+'</span><strong>'+e(x[1]||'Не указано')+'</strong></div>').join('');
const counter='<div class="cards"><div class="metric"><b>'+c.warnings+'/3</b><span>Действующие предупреждения</span></div><div class="metric"><b class="'+(c.reprimands>=3?'text-critical':'')+'">'+c.reprimands+'/3</b><span>Действующие выговоры</span></div></div>';
const issue=can?'<section class="section"><h2>Выдать взыскание</h2><p class="hint">Все действия фиксируются на сервере. Три предупреждения автоматически заменяются одним выговором.</p><form id="issue-form"><div class="fields"><label>Вид взыскания<select id="issue-kind"><option value="warning">Предупреждение (замечание)</option><option value="reprimand">Выговор</option></select></label><label class="wide">Причина<textarea id="issue-reason" minlength="5" maxlength="4000" required placeholder="Опишите факт нарушения"></textarea></label><label class="wide">Доказательства, ссылки HTTPS<textarea id="issue-proof" required placeholder="https://... (одна ссылка на строку)"></textarea></label></div><div class="actions"><button class="btn primary" type="submit">Выдать взыскание</button></div><div id="issue-error"></div></form></section>':'';
const listing='<section class="section"><h2>Взыскания и их история</h2>'+(list.length?list.map(x=>{
const type=x.kind==='warning'?'Предупреждение':'Выговор';
const state={active:'Действует',converted:'Преобразовано в выговор',removed:'Снято',voided:'Отменено'}[x.status]||x.status;
const proof=Array.isArray(x.evidence)?x.evidence.filter(y=>typeof y==='string'&&y.startsWith('https://')).map(y=>'<a class="link" target="_blank" rel="noopener noreferrer" href="'+e(y)+'">Доказательство</a>').join(' · '):'';
const remove=can&&x.status==='active'?'<button class="btn small" type="button" data-remove="'+e(x.id)+'">Снять взыскание</button>':'';
return '<div class="record"><div class="row between"><strong>'+e(type)+' · <span class="'+(x.status==='active'?'text-warn':'subtle')+'">'+e(state)+'</span></strong><span class="subtle">'+date(x.issued_at)+'</span></div><p>'+e(x.reason)+'</p><div class="subtle">'+proof+'</div>'+(x.removal_reason?'<p class="hint">Причина снятия · '+e(x.removal_reason)+'</p>':'')+(Array.isArray(x.removal_evidence)?x.removal_evidence.filter(y=>typeof y==='string'&&y.startsWith('https://')).map(y=>'<a class="link" rel="noopener noreferrer" target="_blank" href="'+e(y)+'">Доказательство снятия</a>').join(' · '):'')+'<div class="actions">'+remove+'</div></div>'
}).join(''):'<div class="empty">Взысканий нет.</div>')+
(can?'<form class="section" id="remove-form" hidden style="margin-top:12px"><h3>Снятие взыскания</h3><input type="hidden" id="remove-id"><div class="fields"><label class="wide">Основание снятия<textarea required minlength="5" id="remove-reason"></textarea></label><label class="wide">Доказательства, ссылки HTTPS<textarea required id="remove-proof" placeholder="https://... (одна ссылка на строку)"></textarea></label></div><div class="actions"><button type="submit" class="btn primary">Подтвердить снятие</button><button type="button" class="btn" id="remove-cancel">Отмена</button></div><div id="remove-error"></div></form>':'')+'</section>';
const events=history.length?'<section class="section"><h2>Журнал решений</h2><div class="records">'+history.map(x=>'<div class="record"><strong>'+e(({issued:'Выдача взыскания',converted:'Автоматическая замена',removed:'Снятие взыскания',dismissed:'Увольнение'}[x.event]||x.event))+'</strong><small>'+date(x.occurred_at)+' · '+e(x.details?.reason||'Событие зафиксировано в журнале')+'</small></div>').join('')+'</div></section>':'';
return '<div class="'+(c.reprimands>=3?'critical-profile':'')+'">'+head+warning+'<section class="section"><div class="member-details">'+fields+'</div></section>'+counter+issue+listing+events+'</div>';
}
function editor(id){if(!rosterRoles.includes(profile.role))return msg('Недостаточно прав.',true);const m=id?members.find(x=>x.id===id):null;return hero(m?'Редактирование сотрудника':'Добавление сотрудника',m?'Изменения сохраняются на сервере.':'После добавления сотрудник появится в общем реестре.')+'<section class="section"><form id="member-form"><div class="fields"><label>Числовой ID<input id="member-no" pattern="[0-9]{1,12}" maxlength="12" value="'+e(m?.employee_number||'')+'" placeholder="0001" required></label><label>Статус<select id="member-status">'+['cadet','active','dismissed','archived'].map(s=>'<option value="'+s+'" '+(m?.status===(s)||(!m&&s==='active')?'selected':'')+'>'+statusTitle[s]+'</option>').join('')+'</select></label><label>Имя<input id="member-first" maxlength="100" value="'+e(m?.first_name||'')+'" required></label><label>Фамилия<input id="member-last" maxlength="100" value="'+e(m?.last_name||'')+'" required></label><label>Должность<input id="member-position" maxlength="200" value="'+e(m?.position||'')+'"></label><label>Звание<input id="member-rank" maxlength="150" value="'+e(m?.rank||'')+'"></label><label>Discord<input id="member-discord" maxlength="150" value="'+e(m?.discord||'')+'"></label><label>Дата вступления<input id="member-date" type="date" value="'+e(m?.joined_on||new Date().toISOString().slice(0,10))+'" required></label><label>Дата увольнения (если есть)<input id="member-dismissed" type="date" value="'+e(m?.dismissed_on||'')+'"></label></div><div class="actions"><button class="btn primary" type="submit">Сохранить в Supabase</button><button class="btn" type="button" id="cancel-editor">Отмена</button></div><div id="save-error" role="alert"></div></form></section>'}
function exams(){
if(!['admin','examiner'].includes(profile.role))return msg('Нет полномочий экзаменатора.',true);
const choices=questions.map(q=>'<label class="question-check"><input type="checkbox" class="exam-choose" value="'+e(q.id)+'"><span><small>Уровень '+e(q.difficulty)+'</small>'+e(q.prompt)+'</span></label>').join('');
const examOptions=examsList.filter(x=>x.status==='published').map(x=>'<option value="'+e(x.id)+'">'+e(x.title)+'</option>').join('');
const memberOptions=members.filter(m=>['active','cadet'].includes(m.status)).map(x=>'<option value="'+e(x.id)+'">'+e(x.employee_number+' · '+x.first_name+' '+x.last_name)+'</option>').join('');
const reports=assignments.map(a=>{const ex=examsList.find(x=>x.id===a.exam_id),m=members.find(x=>x.id===a.member_id),attempts=examAttempts.filter(x=>x.assignment_id===a.id),last=attempts[0];
const result=last?.completed_at?(last.passed?'Сдан · ':'Не сдан · ')+last.correct_count+'/'+last.total_count:last?'В процессе':a.status==='revoked'?'Отозван':'Не проходил';
return '<tr><td>'+e(m?(m.first_name+' '+m.last_name):'Неизвестный сотрудник')+'</td><td>'+e(ex?.title||'Неизвестный экзамен')+'</td><td>'+e(result)+'</td><td>'+e(attempts.length)+'</td><td>'+e(date(a.assigned_at))+'</td></tr>'}).join('');
return hero('Экзамены и аттестация','Серверная система. Коды индивидуальные, ответы проверяются на сервере.')+
'<div class="cards"><div class="metric"><b>'+questions.length+'</b><span>Вопросов в банке</span></div><div class="metric"><b>'+examsList.length+'</b><span>Экзаменов</span></div><div class="metric"><b>'+assignments.length+'</b><span>Назначений</span></div><div class="metric"><b>'+examAttempts.filter(x=>!!x.completed_at).length+'</b><span>Завершённых попыток</span></div></div>'+
'<section class="section"><h2>Создать экзамен</h2><form id="exam-create"><div class="fields"><label class="wide">Название экзамена<input id="exam-title" required minlength="4" maxlength="160" placeholder="Первичная аттестация курсанта"></label><label>Проходной балл, %<input id="exam-pass" type="number" required min="1" max="100" value="80"></label><label>Время, минут<input id="exam-minutes" type="number" required min="1" max="480" value="30"></label><label>Максимум попыток<input id="exam-max" type="number" required min="1" max="10" value="1"></label></div><p class="hint">Выберите от 1 до 60 вопросов. Состав экзамена фиксируется при создании.</p><div class="q-picker">'+choices+'</div><div class="actions"><span id="question-count" class="tag">Выбрано 0</span><button class="btn primary" type="submit">Создать экзамен</button></div><div id="exam-create-error"></div></form></section>'+
'<section class="section"><h2>Добавить собственный вопрос</h2><form id="question-create"><div class="fields"><label>Сложность<select id="new-question-level"><option value="1">Основы</option><option value="2">Применение</option><option value="3">Сложные ситуации</option></select></label><label class="wide">Формулировка<textarea id="new-question-prompt" required minlength="12"></textarea></label>'+['A','B','C','D'].map((v,i)=>'<label>Ответ '+v+'<input id="new-question-opt-'+i+'" required></label>').join('')+'<label>Правильный вариант<select id="new-question-correct">'+['A','B','C','D'].map((v,i)=>'<option value="'+i+'">'+v+'</option>').join('')+'</select></label><label class="wide">Объяснение и правовое обоснование<textarea id="new-question-explanation" required minlength="10"></textarea></label></div><div class="actions"><button type="submit" class="btn">Добавить в банк</button></div><div id="question-create-error"></div></form></section>'+
'<section class="section"><h2>Назначить экзамен</h2><form id="exam-assign"><div class="fields"><label>Экзамен<select id="exam-assign-exam" required>'+examOptions+'</select></label><label>Курсант или сотрудник<select id="exam-assign-member" required>'+memberOptions+'</select></label><label>Код действителен до<input id="exam-expires" type="date" min="'+new Date().toISOString().slice(0,10)+'"></label></div><div class="actions"><button class="btn primary" type="submit" '+(!examOptions||!memberOptions?'disabled':'')+'>Выдать индивидуальный код</button></div><div id="exam-assign-error"></div></form>'+
(newlyIssuedCode?'<div class="notice"><strong>Сохраните новый код, он показывается только сейчас</strong><p style="font-size:20px;font-weight:850;word-break:break-all">'+e(newlyIssuedCode)+'</p><button class="btn small" id="code-copy" type="button">Скопировать код</button></div>':'')+'</section>'+
'<section class="section"><h2>Результаты назначенных экзаменов</h2><div class="table-wrap"><table><thead><tr><th>Сотрудник</th><th>Экзамен</th><th>Результат</th><th>Попыток</th><th>Назначено</th></tr></thead><tbody>'+(reports||'<tr><td colspan="5" class="subtle">Назначений пока нет.</td></tr>')+'</tbody></table></div></section>';
}
function bindScreen(){if(screen==='roster'||screen==='home'){const s=document.getElementById('search');if(s)s.oninput=()=>{const q=s.value.toLowerCase();document.getElementById('roster-rows').innerHTML=rows(members.filter(m=>[m.employee_number,m.first_name,m.last_name,m.position,m.rank,m.discord].some(x=>String(x||'').toLowerCase().includes(q))))};const b=document.getElementById('new-member');if(b)b.onclick=()=>{screen='add';selected=null;render()};document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>{selected=b.dataset.person;screen='detail';render()})}if(screen==='detail'){document.getElementById('back-roster').onclick=()=>{screen='roster';render()};const b=document.getElementById('edit-person');if(b)b.onclick=()=>{screen='edit';render()}}if(screen==='detail'){
const f=document.getElementById('issue-form');if(f)f.onsubmit=submitDiscipline;
document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{document.getElementById('remove-id').value=b.dataset.remove;document.getElementById('remove-form').hidden=false;document.getElementById('remove-form').scrollIntoView({behavior:'smooth',block:'center'});});
const rf=document.getElementById('remove-form');if(rf)rf.onsubmit=submitRemoval;
const rc=document.getElementById('remove-cancel');if(rc)rc.onclick=()=>{rf.hidden=true;rf.reset()};
const ds=document.getElementById('dismiss-show');if(ds)ds.onclick=()=>{document.getElementById('dismiss-form').hidden=false};
const df=document.getElementById('dismiss-form');if(df)df.onsubmit=submitDismiss;
}
if(screen==='exams'){
const chooser=document.querySelectorAll('.exam-choose');const badge=document.getElementById('question-count');
chooser.forEach(x=>x.onchange=()=>{badge.textContent='Выбрано '+document.querySelectorAll('.exam-choose:checked').length});
document.getElementById('exam-create').onsubmit=createOfficialExam;
document.getElementById('question-create').onsubmit=createOwnQuestion;
document.getElementById('exam-assign').onsubmit=assignOfficialExam;
const cp=document.getElementById('code-copy');if(cp)cp.onclick=()=>navigator.clipboard.writeText(newlyIssuedCode).then(()=>flash('Код скопирован')).catch(()=>flash('Скопируйте код вручную',true));
}
if(screen==='add'||screen==='edit'){document.getElementById('cancel-editor').onclick=()=>{screen='roster';render()};document.getElementById('member-form').onsubmit=saveMember}}

function readProof(id){
const lines=v(id).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
if(!lines.length||lines.length>15||lines.some(x=>!/^https:\/\/\S+$/.test(x)))throw Error('Добавьте от 1 до 15 ссылок вида https://..., каждую с новой строки');
return lines;
}
async function submitDiscipline(ev){
ev.preventDefault();const b=ev.target.querySelector('[type=submit]');b.disabled=true;
try{
const {error}=await api.rpc('fso_issue_discipline',{p_member:selected,p_kind:v('issue-kind'),p_reason:v('issue-reason'),p_evidence:readProof('issue-proof')});
if(error)throw error;flash('Взыскание оформлено и записано в журнал');await refresh();
}catch(err){document.getElementById('issue-error').innerHTML=msg(err.message||'Ошибка выдачи',true)}finally{b.disabled=false}
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
if(!window.confirm('Оформить увольнение по пункту 30.3? Это действие изменит статус сотрудника.'))return;
const {error}=await api.rpc('fso_dismiss_after_three',{p_member:selected,p_reason:v('dismiss-reason'),p_evidence:readProof('dismiss-proof')});
if(error)throw error;flash('Увольнение оформлено, запись перенесена в архив статуса');await refresh();
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
async function saveMember(ev){ev.preventDefault();const button=ev.target.querySelector('[type=submit]');button.disabled=true;const payload={employee_number:v('member-no'),first_name:v('member-first'),last_name:v('member-last'),position:v('member-position'),rank:v('member-rank'),discord:v('member-discord'),joined_on:v('member-date'),status:v('member-status'),dismissed_on:v('member-dismissed')||null};if(!/^\d{1,12}$/.test(payload.employee_number)){document.getElementById('save-error').innerHTML=msg('ID должен содержать только цифры.',true);button.disabled=false;return}
try{const old=screen==='edit'&&selected;const q=old?api.from('fso_members').update(payload).eq('id',selected):api.from('fso_members').insert(payload);const r=await q.select('id').single();if(r.error)throw r.error;flash(old?'Личное дело обновлено':'Сотрудник добавлен');selected=r.data.id;screen='detail';await refresh()}catch(err){document.getElementById('save-error').innerHTML=msg(err.message||'Ошибка сохранения',true)}finally{button.disabled=false}}
async function logout(){await api.auth.signOut();user=null;profile=null;members=[];screen='home';authPage()}
async function init(){if(!window.supabase?.createClient){root.innerHTML=msg('Не загрузилась библиотека Supabase. Проверьте соединение с интернетом.',true);return}api=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});api.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){user=null;profile=null;authPage()}});await refresh()}
init().catch(err=>{root.innerHTML=msg('Не удалось подключиться к серверу: '+(err.message||err),true)});
})();