const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE='http://127.0.0.1:8765/';
const mockSupabase=String.raw`(()=>{'use strict';
const role=window.__role||'anonymous';
const seed=[{id:'member-1',employee_number:'0007',first_name:'Иван',last_name:'Тестовый',position:'Сотрудник',rank:'Сержант',discord:'ivan.test',user_id:'user-1',department:'УЛО',status:'active',joined_on:'2026-10-10',dismissed_on:null,created_at:'2026-10-10',updated_at:'2026-10-10'}];
const db={fso_profiles:[{user_id:'user-1',role,display_name:''}],fso_members:seed,fso_disciplinary_actions:[],fso_disciplinary_audit:[],fso_activity_audit:[{id:1,entity_type:'member',entity_id:'member-1',member_id:'member-1',actor_id:'user-1',action:'member.updated',occurred_at:'2026-11-03T10:00:00Z',before_data:{rank:'Рядовой'},after_data:{rank:'Сержант'}}],fso_questions:[{id:'q1',source_key:'quiz2-001',difficulty:1,prompt:'Проверочный вопрос?',is_published:true}],fso_exams:[],fso_exam_assignments:[],fso_exam_attempts:[],fso_exam_items:[],fso_exam_answers:[],fso_service_events:[],fso_service_requests:[],fso_service_leaves:[]};
const subPages=['АС','УЛО','Академия'].map(department=>({
 department,essentials:department==='УЛО'?'Основная инструкция УЛО':'',
 promotion_rules:'',uniform_rules:'',service_contacts:'',
 updated_at:'2026-11-10T10:00:00Z',announcements:[]
}));
const accounts=[
 {user_id:'user-1',email:'admin@example.test',role,display_name:'Администратор',confirmed:true,created_at:'2026-10-01',last_sign_in_at:'2026-11-03T10:00:00Z'},
 {user_id:'user-2',email:'editor@example.test',role:'employee',display_name:'Редактор без роли',confirmed:true,created_at:'2026-10-20',last_sign_in_at:null}
];
const state={db,rpcs:[],accounts,signedOut:false,functionCalls:[],lastLogin:null};window.__fsoMock=state;
const user={id:'user-1',email:'admin@example.test'};
function make(table){const q={table,where:[],action:'read',payload:null,
select(){return this},eq(k,v){this.where.push([k,v]);return this},in(k,values){this.where.push([k,values]);return this},order(){return this},limit(){return this},
insert(payload){this.action='insert';this.payload=payload;return this},update(payload){this.action='update';this.payload=payload;return this},
async run(){
const a=db[table]||[];
let records=a.filter(x=>this.where.every(([k,v])=>Array.isArray(v)?v.includes(x[k]):x[k]===v));
if(this.action==='insert'){
const one={id:'member-'+(a.length+1),...this.payload,created_at:new Date().toISOString()};
a.push(one);records=[one];
}
if(this.action==='update') records.forEach(x=>Object.assign(x,this.payload));
return {data:records,error:null};
},
async single(){const r=await this.run();return {data:r.data[0]||null,error:null}},
async maybeSingle(){return this.single()},
then(res,rej){return this.run().then(res,rej)}
};return q}
function rpc(name,args){
 state.rpcs.push({name,args});
 if(name==='fso_subdivisions_read'){
  const my=db.fso_members.find(x=>x.user_id===user.id&&['active','cadet'].includes(x.status));
  return Promise.resolve({data:subPages.filter(p=>['admin','hr'].includes(role)||p.department===my?.department).map(p=>({...p,announcements:[...p.announcements]})),error:null});
 }
 if(name==='fso_subdivision_save'){
  if(!['admin','hr'].includes(role))return Promise.resolve({data:null,error:{code:'42501',message:'Нет прав'}});
  const page=subPages.find(p=>p.department===args.p_department);
  if(!page)return Promise.resolve({data:null,error:{message:'Неизвестное подразделение'}});
  Object.assign(page,{essentials:args.p_essentials,promotion_rules:args.p_promotion,
   uniform_rules:args.p_uniform,service_contacts:args.p_contacts});
  return Promise.resolve({data:{updated:true},error:null});
 }
 if(name==='fso_subdivision_announcement_publish'){
  if(!['admin','hr'].includes(role))return Promise.resolve({data:null,error:{code:'42501',message:'Нет прав'}});
  const page=subPages.find(p=>p.department===args.p_department);
  const id='news-'+state.rpcs.length;
  page.announcements.unshift({id,title:args.p_title,body:args.p_body,author:'Руководитель тестовый',published_at:new Date().toISOString()});
  return Promise.resolve({data:id,error:null});
 }
 if(name==='fso_subdivision_announcement_delete'){
  if(!['admin','hr'].includes(role))return Promise.resolve({data:null,error:{code:'42501',message:'Нет прав'}});
  for(const page of subPages)page.announcements=page.announcements.filter(x=>x.id!==args.p_id);
  return Promise.resolve({data:true,error:null});
 }
 if(name==='fso_access_list'){
  if(role!=='admin')return Promise.resolve({data:null,error:{message:'Нет доступа',code:'42501'}});
  return Promise.resolve({data:accounts.map(x=>({...x})),error:null});
 }
 if(name==='fso_access_set_role'){
  if(role!=='admin')return Promise.resolve({data:null,error:{message:'Нет доступа',code:'42501'}});
  const account=accounts.find(x=>x.user_id===args.p_user);
  if(!account)return Promise.resolve({data:null,error:{message:'Нет аккаунта'}});
  if(account.user_id==='user-1'&&args.p_role!=='admin')return Promise.resolve({data:null,error:{message:'Нельзя отозвать доступ у последнего администратора'}});
  account.role=args.p_role;account.display_name=args.p_display_name;
  return Promise.resolve({data:{user_id:account.user_id,role:account.role},error:null});
 }
 if(name==='fso_exam_staff_directory'){
  return Promise.resolve({data:[{user_id:'user-1',display_name:'Экзаменатор ФСО'}],error:null});
 }
 if(name==='fso_admin_archive_delete'){
  if(role!=='admin')return Promise.resolve({data:null,error:{code:'42501',message:'Только администратор'}});
  const targets=db.fso_members.filter(x=>['archived','dismissed'].includes(x.status)&&(args.p_all||x.id===args.p_member));
  for(const m of targets)db.fso_members.splice(db.fso_members.indexOf(m),1);
  return Promise.resolve({data:{deleted_members:targets.length},error:null});
 }
 if(name==='fso_admin_exam_delete'){
  if(role!=='admin')return Promise.resolve({data:null,error:{code:'42501',message:'Только администратор'}});
  const ex=db.fso_exams.find(x=>x.id===args.p_exam);
  if(ex)db.fso_exams.splice(db.fso_exams.indexOf(ex),1);
  return Promise.resolve({data:{deleted_exams:ex?1:0},error:null});
 }
 if(name==='fso_admin_assignment_delete'){
  if(role!=='admin')return Promise.resolve({data:null,error:{code:'42501',message:'Только администратор'}});
  const attemptIds=db.fso_exam_attempts.filter(x=>x.assignment_id===args.p_assignment).map(x=>x.id);
  db.fso_exam_attempts.splice(0,db.fso_exam_attempts.length,...db.fso_exam_attempts.filter(x=>!attemptIds.includes(x.id)));
  db.fso_exam_answers.splice(0,db.fso_exam_answers.length,...db.fso_exam_answers.filter(x=>!attemptIds.includes(x.attempt_id)));
  const assignment=db.fso_exam_assignments.find(x=>x.id===args.p_assignment);
  if(args.p_mode==='assignment'&&assignment)db.fso_exam_assignments.splice(db.fso_exam_assignments.indexOf(assignment),1);
  else if(assignment)assignment.status='assigned';
  return Promise.resolve({data:{deleted_attempts:attemptIds.length},error:null});
 }

 if(name==='fso_personnel_decision'){
  if(!['admin','hr'].includes(role))return Promise.resolve({data:null,error:{message:'Недостаточно прав',code:'42501'}});
  const m=db.fso_members.find(x=>x.id===args.p_member),before={rank:m.rank,position:m.position};
  m.rank=args.p_rank;m.position=args.p_position;
  for(const [field,kind] of [['rank','rank_changed'],['position','position_changed']]){
   if(before[field]!==m[field])db.fso_service_events.unshift({id:state.rpcs.length,member_id:m.id,event_type:kind,actor_id:'user-1',
    old_value:{[field]:before[field]},new_value:{[field]:m[field]},reason:args.p_reason,occurred_at:new Date().toISOString()});
  }
  return Promise.resolve({data:{member_id:m.id},error:null});
 }
 if(name==='fso_promotion_request_submit'){
  const member=db.fso_members.find(x=>x.id===args.p_member);
  const ranks=['Рядовой','Ефрейтор','Младший сержант','Сержант','Старший сержант','Старшина','Прапорщик','Старший прапорщик','Младший лейтенант','Лейтенант','Старший лейтенант','Капитан','Майор','Подполковник','Полковник','Генерал-майор'];
  if(!member||ranks.indexOf(args.p_target_rank)<=ranks.indexOf(member.rank))
   return Promise.resolve({data:null,error:{message:'Выберите звание выше текущего',code:'22023'}});
  const row={id:'request-'+state.rpcs.length,member_id:args.p_member,kind:'promotion',statement:args.p_statement,target_rank:args.p_target_rank,
   date_from:null,date_to:null,submitted_by:'user-1',submitted_at:new Date().toISOString(),status:'pending'};
  db.fso_service_requests.unshift(row);return Promise.resolve({data:row.id,error:null});
 }
 if(name==='fso_request_submit'){
  const member=db.fso_members.find(x=>x.id===args.p_member);
  const selfAbsence=['leave','inactivity'].includes(args.p_kind);
  if(!member||(selfAbsence?member.user_id!==user.id:(!['admin','hr'].includes(role)&&member.user_id!==user.id)))
   return Promise.resolve({data:null,error:{message:'Нельзя оформлять отсутствие за другого сотрудника',code:'42501'}});
 const row={id:'request-'+state.rpcs.length,member_id:args.p_member,kind:args.p_kind,statement:args.p_statement,
   date_from:args.p_from,date_to:args.p_to,submitted_by:'user-1',submitted_at:new Date().toISOString(),status:'pending'};
  db.fso_service_requests.unshift(row);return Promise.resolve({data:row.id,error:null});
 }
 if(name==='fso_request_review'){
  if(!['admin','hr'].includes(role))return Promise.resolve({data:null,error:{message:'Недостаточно прав',code:'42501'}});
  const row=db.fso_service_requests.find(x=>x.id===args.p_id);
  row.status=args.p_decision;row.reviewed_by='user-1';row.review_note=args.p_note;row.reviewed_at=new Date().toISOString();
  if(['leave','inactivity'].includes(row.kind)&&row.status==='approved')
   db.fso_service_leaves.unshift({id:'leave-'+state.rpcs.length,member_id:row.member_id,request_id:row.id,kind:row.kind,
    date_from:row.date_from,date_to:row.date_to,reason:row.statement,status:'approved',approved_by:'user-1'});
  return Promise.resolve({data:{status:row.status},error:null});
 }
 if(name==='fso_absence_create'||name==='fso_leave_create'){
  return Promise.resolve({data:null,error:{message:'Старый способ оформления отсутствия отключён',code:'42501'}});
 }
 if(name==='fso_leave_close'){
  if(!['admin','hr'].includes(role))return Promise.resolve({data:null,error:{message:'Недостаточно прав',code:'42501'}});
  const row=db.fso_service_leaves.find(x=>x.id===args.p_leave);if(row)row.status=args.p_action;
  return Promise.resolve({data:{},error:null});
 }
 if(name==='fso_member_account_link'){
  if(role!=='admin')return Promise.resolve({data:null,error:{message:'Недостаточно прав',code:'42501'}});
  const m=db.fso_members.find(x=>x.id===args.p_member);if(m)m.user_id=args.p_email?'user-2':null;
  return Promise.resolve({data:{},error:null});
 }
 if(name==='fso_issue_discipline'){
  db.fso_disciplinary_actions.push({id:'act-'+state.rpcs.length,member_id:args.p_member,kind:args.p_kind,status:'active',reason:args.p_reason,evidence:args.p_evidence,issued_at:new Date().toISOString()});
  return Promise.resolve({data:{issued_id:'act-1'},error:null});
 }
 if(name==='fso_make_exam'){
  db.fso_exams.push({id:'exam-1',title:args.p_title,created_by:'user-1',pass_percent:args.p_pass_percent,duration_minutes:args.p_duration,max_attempts:args.p_max_attempts,status:'published',created_at:new Date().toISOString()});
  db.fso_exam_items.push({exam_id:'exam-1',ordinal:1,question_snapshot:{prompt:'Проверочный вопрос?',options:['Верный ответ','Неверный ответ','Вариант 3','Вариант 4'],correct:[0]}});
  return Promise.resolve({data:'exam-1',error:null});
 }
 if(name==='fso_assign_exam'){
  db.fso_exam_assignments.push({id:'assignment-1',exam_id:args.p_exam,member_id:args.p_member,issued_by:'user-1',status:'completed',assigned_at:new Date().toISOString()});
  db.fso_exam_attempts.push({id:'attempt-1',assignment_id:'assignment-1',started_at:new Date().toISOString(),completed_at:new Date().toISOString(),correct_count:1,total_count:1,passed:true});
  db.fso_exam_answers.push({attempt_id:'attempt-1',ordinal:1,chosen:[0]});
  return Promise.resolve({data:{access_code:'FSO-'+('A'.repeat(32))},error:null});
 }
 return Promise.resolve({data:{},error:null});
}
const functions={invoke:async(name,request)=>{
 if(name!=='fso-staff-account')return {data:null,error:{message:'Unknown function'}};
 const b=request.body;
 state.functionCalls.push({action:b.action,member_id:b.member_id,login:b.login});
 if(b.action==='issue'){
  if(!['admin','hr'].includes(role))return {data:null,error:{message:'Not allowed'}};
  const m=db.fso_members.find(x=>x.id===b.member_id);
  if(!m||m.user_id)return {data:null,error:{message:'Account already linked'}};
  m.user_id='managed-'+m.id;
  db.fso_profiles.push({user_id:m.user_id,role:'employee_pending',display_name:m.first_name+' '+m.last_name});
  return {data:{ok:true,member_id:m.id,login:b.login,first_login:true},error:null};
 }
 if(b.action==='reset'){
  if(!['admin','hr'].includes(role))return {data:null,error:{message:'Not allowed'}};
  const m=db.fso_members.find(x=>x.id===b.member_id);
  const p=db.fso_profiles.find(x=>x.user_id===m?.user_id);
  if(p)p.role='employee_pending';
  return {data:{ok:true,login:'fso_0100',first_login:true},error:null};
 }
 if(b.action==='activate'){
  const p=db.fso_profiles.find(x=>x.user_id==='user-1');
  if(p)p.role='employee';
  return {data:{ok:true,role:'employee'},error:null};
 }
 return {data:null,error:{message:'Unknown action'}};
}};
const client={auth:{
 getUser:async()=>({data:{user:role==='anonymous'?null:user},error:null}),
 signInWithPassword:async(args)=>{state.lastLogin=args.email;return {data:{user},error:null}},
 signOut:async()=>{state.signedOut=true;return {error:null}},
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
 },from:make,rpc,functions};
window.supabase={createClient:()=>client};
})();`;
async function launchWithRole(browser,role){
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.addInitScript({content:'window.__role='+JSON.stringify(role)});
 await page.route('**/cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:mockSupabase}));
 await page.goto(BASE+'кабинет.html',{waitUntil:'load'});
 if(['admin','hr','examiner'].includes(role)){
  await page.getByRole('heading',{name:'Обзор подразделения'}).waitFor();
  await page.getByRole('button',{name:'Сотрудники'}).click();
 }
 return {page,errors};
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
 // Public entry and code login
 {
 const {page,errors}=await launchWithRole(browser,'anonymous');
 await page.getByRole('heading',{name:'Вход в личный кабинет'}).waitFor();
 await page.getByRole('button',{name:/Вход по коду экзамена/}).click();
 await page.getByRole('heading',{name:'Для курсантов'}).waitFor();
 assert.equal(new URL(page.url()).hash,'#cadet');
 const backHref=await page.getByRole('link',{name:'Не курсант?'}).getAttribute('href');
 assert.ok(decodeURIComponent(backHref).endsWith('/кабинет.html'),
   'Legacy view must return to the same legacy cabinet');
 await page.locator('#cadet-code').fill('123');
 await page.getByRole('button',{name:'Открыть экзамен'}).click();
 await page.getByText(/Проверьте код/).waitFor();
 assert.deepEqual(errors,[]);
 await page.close();
 }
 // Admin roster, member CRUD, disciplinary RPC, official exam builder
 {
 const {page,errors}=await launchWithRole(browser,'admin');
 await page.getByRole('heading',{name:'Сотрудники'}).waitFor();
 await page.getByText('Иван Тестовый').waitFor();
 await page.locator('#new-member').click();
 await page.locator('#member-no').fill('0020');
 await page.locator('#member-first').fill('Алексей');
 await page.locator('#member-last').fill('Проверочный');
 await page.locator('#member-position').fill('Курсант');
 await page.locator('#member-rank').selectOption('Рядовой');
 await page.locator('#member-discord').fill('demo.test');
 await page.locator('#member-department').selectOption('Академия');
 assert.equal(await page.locator('#member-rank optgroup').count(),5);
 assert.equal(await page.locator('#member-rank option:not([disabled])').count(),16);
 await page.locator('#member-rank').selectOption('Генерал-майор');
 await page.locator('#new-staff-login').fill('serov_0100');
 assert.ok((await page.locator('#new-staff-password').inputValue()).length>=12);
 await page.locator('#member-form button[type="submit"]').click();
 await page.getByRole('heading',{name:'Алексей Проверочный'}).waitFor();
 await page.getByText('Служебные данные для выдачи').waitFor();
 assert.equal(await page.locator('#staff-issued-login').innerText(),'serov_0100');
 assert.ok((await page.locator('#staff-issued-password').innerText()).length>=12);
 assert.equal(await page.evaluate(()=>window.__fsoMock.db.fso_members.find(m=>m.id==='member-2').user_id),'managed-member-2');
 assert.equal(await page.evaluate(()=>window.__fsoMock.db.fso_profiles.find(p=>p.user_id==='managed-member-2').role),'employee_pending');
 assert.ok(!Object.prototype.hasOwnProperty.call(await page.evaluate(()=>window.__fsoMock.db.fso_members.find(m=>m.id==='member-2')),'password'));
 assert.ok((await page.evaluate(()=>window.__fsoMock.functionCalls)).some(x=>x.action==='issue'&&x.login==='serov_0100'));
 assert.equal(await page.locator('#issue-form').count(),0,'Выдача взысканий в личном деле удалена');
 const capture=await page.evaluate(()=>({people:window.__fsoMock.db.fso_members.length,rpcs:window.__fsoMock.rpcs.map(x=>x.name)}));
 assert.equal(capture.people,2);
 assert.ok(!capture.rpcs.includes('fso_issue_discipline'));
 await page.getByRole('button',{name:'Сотрудники'}).click();
 assert.deepEqual(await page.locator('#roster-rows .employee-name').allTextContents(),['Алексей Проверочный','Иван Тестовый']);
 await page.locator('#rank-filter').selectOption('Генерал-майор');
 assert.deepEqual(await page.locator('#roster-rows .employee-name').allTextContents(),['Алексей Проверочный']);
 await page.locator('#rank-filter').selectOption('');
 assert.equal(await page.locator('#roster-rows tr').count(),2);
 assert.equal(await page.locator('.roster-metrics .metric').count(),3);
 assert.equal(await page.getByText('По старшинству · генерал-майор → рядовой').count(),0);
 assert.equal(await page.getByText('Три выговора',{exact:true}).count(),0);
 assert.equal(await page.locator('#roster-rows .status-label').first().innerText(),'Курсант');
 await page.getByRole('button',{name:'Журнал аудита'}).click();
 await page.getByRole('heading',{name:'Журнал аудита'}).waitFor();
 await page.getByRole('heading',{name:'Изменение личного дела'}).waitFor();
 await page.getByText('Иван Тестовый · № 0007').waitFor();
 await page.locator('.audit-details summary').first().click();
 await page.getByText('Звание',{exact:true}).waitFor();
 await page.locator('#audit-category').selectOption('profile');
 await page.getByText('Событий по выбранным условиям нет.').waitFor();
 await page.locator('#audit-category').selectOption('');

 // A linked employee files their own absence; leadership approves but cannot file for others.
 await page.getByRole('button',{name:'Отпуска'}).click();
 await page.getByRole('heading',{name:'Отпуска и неактивность',level:1}).waitFor();
 assert.equal(await page.locator('#lead-leave-form').count(),0);
 assert.equal(await page.locator('#lead-leave-member').count(),0);
 const forbidden=await page.evaluate(async()=>window.supabase.createClient().rpc('fso_request_submit',{
  p_member:'member-2',p_kind:'leave',p_statement:'Попытка оформить отпуск другому сотруднику',
  p_from:'2030-06-03',p_to:'2030-06-10'
 }));
 assert.equal(forbidden.error.code,'42501');
 const retired=await page.evaluate(async()=>window.supabase.createClient().rpc('fso_absence_create',{
  p_member:'member-2',p_kind:'leave',p_reason:'Неправомерное оформление',
  p_from:'2030-06-03',p_to:'2030-06-10'
 }));
 assert.equal(retired.error.code,'42501');
 await page.locator('#lead-absence-kind').selectOption('leave');
 await page.locator('#lead-absence-from').fill('2030-06-03');
 await page.locator('#lead-absence-to').fill('2030-06-10');
 await page.locator('#lead-absence-reason').fill('Прошу согласовать отпуск на указанный период для отдыха.');
 await page.locator('#lead-absence-request-form [type="submit"]').click();
 await page.getByText('На рассмотрении',{exact:true}).waitFor();
 await page.locator('.lead-review summary').first().click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-decision="approved"]').first().click();
 await page.getByText('Одобрено',{exact:true}).waitFor();
 await page.getByText('Запланирован',{exact:true}).waitFor();
 await page.locator('#lead-absence-kind').selectOption('inactivity');
 await page.locator('#lead-absence-from').fill('2030-07-01');
 await page.locator('#lead-absence-to').fill('2030-07-04');
 await page.locator('#lead-absence-reason').fill('Прошу согласовать временную неактивность по личным обстоятельствам.');
 await page.locator('#lead-absence-request-form [type="submit"]').click();
 await page.getByText('На рассмотрении',{exact:true}).waitFor();
 await page.locator('.lead-review summary').first().click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-decision="approved"]').first().click();
 await page.getByText('Неактивность',{exact:true}).waitFor();
 // Leadership can edit a department and post its own announcements.
 await page.getByRole('button',{name:'Подразделения'}).click();
 await page.getByRole('heading',{name:'Служебные подразделения'}).waitFor();
 assert.equal(await page.locator('.sub-department.is-locked').count(),0);
 await page.locator('[data-sub-department="АС"]').click();
 await page.locator('#sub-editor summary').click();
 await page.locator('#sub-material-form textarea[name="essentials"]').fill('Новые правила службы АС');
 await page.locator('#sub-material-form textarea[name="promotion"]').fill('Повышение согласно утверждённому регламенту АС');
 await page.locator('#sub-material-form [type="submit"]').click();
 await page.getByText('Новые правила службы АС').waitFor();
 await page.locator('.sub-publish summary').click();
 await page.locator('#sub-announcement-form [name="title"]').fill('Информация начальника');
 await page.locator('#sub-announcement-form [name="body"]').fill('Важное объявление для сотрудников подразделения АС.');
 await page.locator('#sub-announcement-form [type="submit"]').click();
 await page.getByText('Информация начальника').waitFor();
 assert.equal(await page.locator('.sub-notice').count(),1);
 await page.locator('[data-sub-department="УЛО"]').click();
 assert.equal(await page.getByText('Информация начальника').count(),0);
 await page.getByRole('button',{name:'Рапорты'}).click();
 await page.getByRole('button',{name:'Кадровые решения'}).click();
 await page.getByRole('heading',{name:'Кадровые решения'}).waitFor();
 await page.locator('#lead-person').selectOption('member-2');
 await page.locator('#lead-decision-kind').selectOption('demotion');
 await page.locator('#lead-rank-down').selectOption('Полковник');
 await page.locator('#lead-decision-reason').fill('Кадровое назначение по служебным заслугам');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#lead-decision-form [type="submit"]').click();
 await page.getByText('Звание · Полковник').waitFor();
 await page.locator('#lead-decision-kind').selectOption('position');
 await page.locator('#lead-position').fill('Помощник директора');
 await page.locator('#lead-decision-reason').fill('Назначение на должность по служебным заслугам');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#lead-decision-form [type="submit"]').click();
 await page.getByText('Должность · Помощник директора').waitFor();
 await page.getByRole('button',{name:'История службы'}).click();
 await page.locator('#lead-history-person').selectOption('member-2');
 await page.getByText('Понижение в звании',{exact:true}).waitFor();
 assert.equal(await page.getByText('Изменение должности',{exact:true}).count(),0);
 assert.equal(await page.getByText('Назначение на должность по служебным заслугам').count(),0);
 await page.getByRole('button',{name:'Сотрудники'}).click();
 await page.getByRole('button',{name:'Экзамены'}).click();
 await page.getByRole('heading',{name:'Экзамены и аттестация'}).waitFor();
 await page.locator('#exam-title').fill('Первичная аттестация');
 await page.locator('.exam-choose').first().check();
 await page.locator('#exam-create button[type="submit"]').click();
 await page.locator('#exam-assign-exam option').filter({hasText:'Первичная аттестация'}).waitFor({state:'attached'});
 await page.locator('#exam-assign-exam').selectOption('exam-1');
 await page.locator('#exam-assign-member').selectOption('member-2');
 await page.locator('#exam-assign button[type="submit"]').click();
 await page.getByText('FSO-'+('A'.repeat(32))).waitFor();
 await page.getByRole('heading',{name:'Созданные экзамены'}).waitFor();
 await page.getByText('Экзаменатор ФСО',{exact:true}).first().waitFor();
 assert.equal(await page.locator('[data-exam-detail]').count(),1);
 await page.locator('[data-exam-detail]').click();
 await page.getByText('Ответ сотрудника · Верный ответ').waitFor();
 await page.getByText('Правильный ответ · Верный ответ').waitFor();
 await page.locator('#exam-review-close').click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-attempt-clear]').click();
 await page.getByText('Не проходил',{exact:true}).waitFor();
 assert.ok((await page.evaluate(()=>window.__fsoMock.rpcs)).some(x=>x.name==='fso_admin_assignment_delete'&&x.args.p_mode==='results'));
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-assignment-delete]').click();
 await page.getByText('Назначений пока нет.').waitFor();
 assert.ok((await page.evaluate(()=>window.__fsoMock.rpcs)).some(x=>x.name==='fso_admin_assignment_delete'&&x.args.p_mode==='assignment'));
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-exam-delete]').click();
 await page.getByText('Экзамены не созданы.').waitFor();
 assert.ok((await page.evaluate(()=>window.__fsoMock.rpcs)).some(x=>x.name==='fso_admin_exam_delete'));
 await page.getByRole('button',{name:'Управление доступом'}).click();
 await page.getByRole('heading',{name:'Центр управления доступом'}).waitFor();
 assert.equal(await page.locator('#access-users tr').count(),2);
 assert.equal(await page.locator('#access-grant-form').count(),0,'Выдача доступа по email удалена');
 await page.locator('#access-users tr').filter({hasText:'editor@example.test'}).getByRole('button',{name:'Настроить'}).click();
 await page.locator('#access-role').selectOption('hr');
 await page.locator('#access-edit-form button[type="submit"]').click();
 await page.locator('#access-users tr').filter({hasText:'editor@example.test'}).getByText('Руководство',{exact:true}).waitFor();
 await page.locator('#access-users tr').filter({hasText:'editor@example.test'}).getByRole('button',{name:'Настроить'}).click();
 await page.locator('#access-role').selectOption('examiner');
 await page.locator('#access-edit-form button[type="submit"]').click();
 await page.locator('#access-users tr').filter({hasText:'editor@example.test'}).getByText('Экзаменатор',{exact:true}).waitFor();
 await page.locator('#access-users tr').filter({hasText:'editor@example.test'}).getByRole('button',{name:'Настроить'}).click();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Отозвать доступ'}).click();
 await page.locator('#access-users tr').filter({hasText:'editor@example.test'}).getByText('Личный кабинет',{exact:true}).first().waitFor();
 assert.ok((await page.evaluate(()=>window.__fsoMock.rpcs)).some(x=>x.name==='fso_access_set_role'&&x.args.p_role==='employee'));
 await page.getByRole('button',{name:'История выдачи и изменения прав в журнале аудита'}).click();
 await page.getByRole('heading',{name:'Журнал аудита'}).waitFor();
 assert.equal(await page.locator('#audit-category').inputValue(),'profile');
 // Archive may be deleted only by administrators, after an explicit confirmation.
 await page.evaluate(()=>{
  const person=window.__fsoMock.db.fso_members.find(x=>x.id==='member-2');
  person.status='dismissed';
  person.dismissed_on='2026-11-03';
 });
 await page.getByRole('button',{name:'Управление доступом'}).click();
 await page.locator('#access-refresh').click();
 await page.getByRole('button',{name:'Архив'}).click();
 await page.getByRole('heading',{name:'Архив'}).waitFor();
 assert.equal(await page.locator('[data-archive-delete]').count(),1);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-archive-delete]').click();
 await page.getByText('Записи не найдены.').waitFor();
 assert.ok((await page.evaluate(()=>window.__fsoMock.rpcs)).some(x=>x.name==='fso_admin_archive_delete'&&!x.args.p_all));
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/portal-admin.png',fullPage:true});
 await page.close();
 }
 // HR editor can edit personnel without seeing administrator audit.
 {
 const {page,errors}=await launchWithRole(browser,'hr');
 await page.getByRole('heading',{name:'Сотрудники'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Журнал аудита'}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Управление доступом'}).count(),0);
 assert.equal(await page.locator('#roster-rows .status-label').first().innerText(),'Сотрудник');
 await page.locator('#new-member').click();
 assert.deepEqual(await page.locator('#member-department option').allTextContents(),['АС','Академия','УЛО']);
 assert.deepEqual(errors,[]);
 await page.close();
 }
 // First sign-in blocks access until the temporary password is replaced.
 {
 const {page,errors}=await launchWithRole(browser,'employee_pending');
 await page.getByRole('heading',{name:'Первый вход'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Сотрудники'}).count(),0);
 await page.locator('#staff-activate-password').fill('DifferentStaffPass44');
 await page.locator('#staff-activate-repeat').fill('DifferentStaffPass44');
 await page.locator('#staff-activate-form [type="submit"]').click();
 await page.getByRole('heading',{name:'Рапорты и заявки'}).waitFor();
 assert.ok((await page.evaluate(()=>window.__fsoMock.functionCalls)).some(x=>x.action==='activate'));
 assert.deepEqual(errors,[]);
 await page.close();
 }
 // Employee can only use their linked personal self-service area.
 {
 const {page,errors}=await launchWithRole(browser,'employee');
 await page.getByRole('heading',{name:'Рапорты и заявки'}).waitFor();
 assert.equal(await page.locator('#lead-request-form').count(),1);
 const requestKinds=await page.locator('#lead-request-kind option').evaluateAll(options=>options.map(x=>x.value));
 assert.deepEqual(requestKinds,['promotion','transfer','dismissal','other']);
 assert.equal(await page.locator('#lead-request-kind option[value="reinstatement"]').count(),0);
 for(const [kind,word] of [['promotion','воинского звания'],['transfer','переводе'],['dismissal','уволить'],['other','вопрос о']]){
  await page.locator('#lead-request-kind').selectOption(kind);
  assert.ok((await page.locator('#lead-request-example .lead-example-content').innerText()).toLowerCase().includes(word));
 }
 await page.locator('#lead-request-kind').selectOption('promotion');
 assert.equal(await page.locator('#lead-request-promotion').isVisible(),true);
 assert.equal(await page.locator('#lead-request-rank').inputValue(),'');
 const options=await page.locator('#lead-request-rank option').evaluateAll(xs=>xs.map(x=>x.value));
 assert.ok(options.includes('Старший сержант'));
 assert.ok(!options.includes('Сержант'));
 assert.ok(!options.includes('Рядовой'));
 await page.locator('#lead-request-rank').selectOption('Старший сержант');
 const promoSample=await page.locator('#lead-request-example .lead-example-content').innerText();
 assert.ok(promoSample.includes('воинского звания «Старший сержант»'));
 assert.ok(promoSample.includes('Пост КПП:'));
 assert.ok(promoSample.includes('Участие в сопровождении:'));
 assert.ok(promoSample.includes('1. [ссылка]'));
 await page.locator('#lead-request-example .lead-example-use').click();
 assert.ok((await page.locator('#lead-request-text').inputValue()).includes('воинского звания «Старший сержант»'));
 await page.locator('#lead-request-rank').selectOption('Старшина');
 assert.ok((await page.locator('#lead-request-text').inputValue()).includes('воинского звания «Старшина»'));
 await page.locator('#lead-request-text').fill('Прошу рассмотреть рапорт о присвоении звания Старшина.\n\nПост КПП:\n1. https://example.test/kpp1\n2. https://example.test/kpp2\n\nУчастие в сопровождении:\n1. https://example.test/escort1\n2. https://example.test/escort2');
 await page.locator('#lead-request-form [type="submit"]').click();
 assert.ok((await page.evaluate(()=>window.__fsoMock.rpcs)).some(x=>
  x.name==='fso_promotion_request_submit'&&x.args.p_target_rank==='Старшина'&&x.args.p_member==='member-1'));
 await page.getByText('Запрошенное звание',{exact:true}).first().waitFor();
 assert.ok((await page.locator('.lead-request-statement').first().innerText()).includes('Пост КПП:'));
 await page.locator('#lead-request-kind').selectOption('dismissal');
 assert.equal(await page.locator('#lead-request-promotion').isVisible(),false);
 await page.locator('#lead-request-example .lead-example-use').click();
 assert.ok((await page.locator('#lead-request-text').inputValue()).includes('Прошу уволить'));
 await page.locator('#lead-request-text').fill('Прошу рассмотреть мой рапорт об увольнении по собственному желанию.');
 await page.locator('#lead-request-form [type="submit"]').click();
 assert.ok((await page.evaluate(()=>window.__fsoMock.rpcs)).some(x=>
  x.name==='fso_request_submit'&&x.args.p_kind==='dismissal'&&x.args.p_member==='member-1'));
 assert.equal(await page.getByRole('button',{name:'Кадровые решения'}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Управление доступом'}).count(),0);
 // Access to subdivision materials follows the linked employee record.
 await page.getByRole('button',{name:'Подразделения'}).click();
 await page.getByRole('heading',{name:'Служебные подразделения'}).waitFor();
 assert.equal(await page.locator('.sub-department').count(),3);
 assert.equal(await page.locator('[data-sub-department="АС"].is-locked').count(),1);
 assert.equal(await page.locator('#sub-material-form').count(),0);
 assert.ok((await page.getByText('Основная инструкция УЛО').innerText()).includes('УЛО'));
 await page.locator('[data-sub-department="АС"]').click();
 await page.getByText('Доступ к этому подразделению определяется записью в личном деле сотрудника.',{exact:false}).waitFor();
 assert.equal(await page.getByText('Основная инструкция УЛО').count(),0);
 await page.locator('[data-sub-department="УЛО"]').click();
 assert.ok((await page.getByText('Основная инструкция УЛО').innerText()).includes('УЛО'));
 await page.getByRole('button',{name:'Рапорты'}).click();
 await page.getByRole('button',{name:'Отпуска'}).click();
 await page.getByRole('heading',{name:'Отпуска и неактивность',level:1}).waitFor();
 assert.equal(await page.locator('#lead-absence-request-form').count(),1);
 assert.equal(await page.locator('[data-lead-review]').count(),0);
 for(const [kind,word] of [['leave','отпуск'],['inactivity','неактивность'],['dayoff','отгул']]){
  await page.locator('#lead-absence-kind').selectOption(kind);
  assert.ok((await page.locator('#lead-absence-example .lead-example-content').innerText()).toLowerCase().includes(word));
 }
 await page.locator('#lead-absence-kind').selectOption('inactivity');
 await page.locator('#lead-absence-from').fill('2030-08-01');
 await page.locator('#lead-absence-to').fill('2030-08-10');
 await page.locator('#lead-absence-reason').fill('Прошу согласовать временную неактивность по личным обстоятельствам.');
 await page.locator('#lead-absence-request-form [type="submit"]').click();
 await page.getByText('На рассмотрении',{exact:true}).waitFor();
 assert.ok((await page.evaluate(()=>window.__fsoMock.rpcs)).some(x=>
  x.name==='fso_request_submit'&&x.args.p_kind==='inactivity'&&x.args.p_member==='member-1'));
 assert.equal(await page.locator('[data-lead-review]').count(),0);
 await page.locator('#lead-absence-kind').selectOption('dayoff');
 await page.locator('#lead-absence-from').fill('2030-08-15');
 await page.locator('#lead-absence-to').fill('2030-08-15');
 await page.locator('#lead-absence-reason').fill('Прошу согласовать отгул на один день по личным обстоятельствам.');
 await page.locator('#lead-absence-request-form [type="submit"]').click();
 await page.getByText('Отгул',{exact:true}).first().waitFor();
 assert.ok((await page.evaluate(()=>window.__fsoMock.rpcs)).some(x=>
  x.name==='fso_request_submit'&&x.args.p_kind==='dayoff'&&x.args.p_member==='member-1'));
 assert.equal(await page.locator('[data-lead-review]').count(),0);
 await page.getByRole('button',{name:'История службы'}).click();
 await page.getByRole('heading',{name:'История службы',level:1}).waitFor();
 assert.deepEqual(errors,[]);
 await page.close();
 }
 // Cadet exam full mock workflow, answer saved after reload via sessionStorage
 {
 const {page,errors}=await launchWithRole(browser,'anonymous');
 let chosen=null,finished=false;
 const code='FSO-'+('B'.repeat(32));
 await page.route('**/functions/v1/fso-cadet-exam',async route=>{
  const p=route.request().postDataJSON();
  if(p.action==='answer')chosen=p.chosen;
  if(p.action==='finish')finished=true;
  const result=finished?
  {status:'completed',title:'Экзамен курсанта',member:'Иван Тестовый',pass_percent:80,max_attempts:1,attempts_used:1,retries_remaining:0,answers:{1:[chosen]},result:{correct:1,total:1,percent:100,passed:true}}:
  {status:'in_progress',title:'Экзамен курсанта',member:'Иван Тестовый',pass_percent:80,max_attempts:1,attempts_used:1,retries_remaining:0,started_at:new Date().toISOString(),deadline_at:new Date(Date.now()+15*60*1000).toISOString(),answers:chosen===null?{}:{1:[chosen]},questions:[{ordinal:1,prompt:'Что должен знать курсант?',options:['Ответ А','Ответ Б','Ответ В','Ответ Г']}]};
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(result)});
 });
 await page.getByRole('button',{name:/Вход по коду экзамена/}).click();
 await page.locator('#cadet-code').fill(code);
 await page.getByRole('button',{name:'Открыть экзамен'}).click();
 await page.getByRole('heading',{name:'Что должен знать курсант?'}).waitFor();
 await page.locator('[data-answer="0"]').click();
 await page.locator('.option.selected').waitFor();
 await page.reload({waitUntil:'load'});
 await page.getByRole('heading',{name:'Что должен знать курсант?'}).waitFor();
 assert.equal(await page.locator('.option.selected').count(),1);
 page.once('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Завершить экзамен'}).click();
 await page.getByRole('heading',{name:'Экзамен сдан'}).waitFor();
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/portal-cadet.png',fullPage:true});
 await page.close();
 }
 console.log('PASS: login, cadet entry, admin roster CRUD, discipline, exams, permission denial, cadet resume/finish');
 } finally {await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});