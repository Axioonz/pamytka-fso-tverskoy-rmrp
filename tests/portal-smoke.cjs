const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE='http://127.0.0.1:8765/';
const mockSupabase=String.raw`(()=>{'use strict';
const role=window.__role||'anonymous';
const seed=[{id:'member-1',employee_number:'0007',first_name:'Иван',last_name:'Тестовый',position:'Сотрудник',rank:'Сержант',discord:'ivan.test',user_id:'user-1',status:'active',joined_on:'2026-10-10',dismissed_on:null,created_at:'2026-10-10',updated_at:'2026-10-10'}];
const db={fso_profiles:[{user_id:'user-1',role,display_name:''}],fso_members:seed,fso_disciplinary_actions:[],fso_disciplinary_audit:[],fso_activity_audit:[{id:1,entity_type:'member',entity_id:'member-1',member_id:'member-1',actor_id:'user-1',action:'member.updated',occurred_at:'2026-11-03T10:00:00Z',before_data:{rank:'Рядовой'},after_data:{rank:'Сержант'}}],fso_questions:[{id:'q1',source_key:'quiz2-001',difficulty:1,prompt:'Проверочный вопрос?',is_published:true}],fso_exams:[],fso_exam_assignments:[],fso_exam_attempts:[],fso_exam_items:[],fso_exam_answers:[],fso_service_events:[],fso_service_requests:[],fso_service_leaves:[]};
const accounts=[
 {user_id:'user-1',email:'admin@example.test',role,display_name:'Администратор',confirmed:true,created_at:'2026-10-01',last_sign_in_at:'2026-11-03T10:00:00Z'},
 {user_id:'user-2',email:'editor@example.test',role:'employee',display_name:'Редактор без роли',confirmed:true,created_at:'2026-10-20',last_sign_in_at:null}
];
const state={db,rpcs:[],accounts,signedOut:false};window.__fsoMock=state;
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
const client={auth:{
 getUser:async()=>({data:{user:role==='anonymous'?null:user},error:null}),
 signInWithPassword:async()=>({data:{user},error:null}),signOut:async()=>{state.signedOut=true;return {error:null}},
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
 },from:make,rpc};
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
 await page.locator('#member-status').selectOption('cadet');
 assert.equal(await page.locator('#member-rank optgroup').count(),5);
 assert.equal(await page.locator('#member-rank option:not([disabled])').count(),16);
 await page.locator('#member-rank').selectOption('Генерал-майор');
 await page.locator('#member-form button[type="submit"]').click();
 await page.getByRole('heading',{name:'Алексей Проверочный'}).waitFor();
 await page.locator('#issue-reason').fill('Нарушение служебного регламента');
 await page.locator('#issue-proof').fill('https://example.com/evidence');
 await page.locator('#issue-form button[type="submit"]').click();
 await page.locator('.record strong').filter({hasText:'Предупреждение'}).first().waitFor();
 const capture=await page.evaluate(()=>({people:window.__fsoMock.db.fso_members.length,rpcs:window.__fsoMock.rpcs.map(x=>x.name)}));
 assert.equal(capture.people,2);
 assert.ok(capture.rpcs.includes('fso_issue_discipline'));
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
 await page.getByRole('button',{name:'Кадровые решения'}).click();
 await page.getByRole('heading',{name:'Повышения и назначения'}).waitFor();
 await page.locator('#lead-person').selectOption('member-2');
 await page.locator('#lead-rank').selectOption('Полковник');
 await page.locator('#lead-position').fill('Помощник директора');
 await page.locator('#lead-decision-reason').fill('Кадровое назначение по служебным заслугам');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#lead-decision-form [type="submit"]').click();
 await page.getByText('Текущее звание · Полковник').waitFor();
 await page.getByRole('button',{name:'История службы'}).click();
 await page.locator('#lead-history-person').selectOption('member-2');
 await page.getByText('Изменение звания',{exact:true}).waitFor();
 await page.getByText('Изменение должности',{exact:true}).waitFor();
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
 await page.locator('#access-grant-email').fill('editor@example.test');
 await page.locator('#access-grant-role').selectOption('hr');
 await page.locator('#access-grant-name').fill('Кадровый редактор');
 await page.locator('#access-grant-form button[type="submit"]').click();
 await page.locator('#access-users tr').filter({hasText:'editor@example.test'}).getByText('Редактор',{exact:true}).waitFor();
 await page.locator('#access-users tr').filter({hasText:'editor@example.test'}).getByRole('button',{name:'Настроить'}).click();
 await page.locator('#access-role').selectOption('examiner');
 await page.locator('#access-edit-form button[type="submit"]').click();
 await page.locator('#access-users tr').filter({hasText:'editor@example.test'}).getByText('Экзаменатор',{exact:true}).waitFor();
 await page.locator('#access-users tr').filter({hasText:'editor@example.test'}).getByRole('button',{name:'Настроить'}).click();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Отозвать доступ'}).click();
 await page.locator('#access-users tr').filter({hasText:'editor@example.test'}).getByText('Нет доступа',{exact:true}).first().waitFor();
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
 assert.deepEqual(await page.locator('#member-status option').allTextContents(),['Курсант','Сотрудник']);
 assert.deepEqual(errors,[]);
 await page.close();
 }
 // Employee can only use their linked personal self-service area.
 {
 const {page,errors}=await launchWithRole(browser,'employee');
 await page.getByRole('heading',{name:'Рапорты и заявки'}).waitFor();
 assert.equal(await page.locator('#lead-request-form').count(),1);
 assert.equal(await page.getByRole('button',{name:'Кадровые решения'}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Управление доступом'}).count(),0);
 await page.getByRole('button',{name:'Отпуска'}).click();
 await page.getByRole('heading',{name:'Отпуска и неактивность',level:1}).waitFor();
 assert.equal(await page.locator('#lead-absence-request-form').count(),1);
 assert.equal(await page.locator('[data-lead-review]').count(),0);
 await page.locator('#lead-absence-kind').selectOption('inactivity');
 await page.locator('#lead-absence-from').fill('2030-08-01');
 await page.locator('#lead-absence-to').fill('2030-08-10');
 await page.locator('#lead-absence-reason').fill('Прошу согласовать временную неактивность по личным обстоятельствам.');
 await page.locator('#lead-absence-request-form [type="submit"]').click();
 await page.getByText('На рассмотрении',{exact:true}).waitFor();
 assert.ok((await page.evaluate(()=>window.__fsoMock.rpcs)).some(x=>
  x.name==='fso_request_submit'&&x.args.p_kind==='inactivity'&&x.args.p_member==='member-1'));
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