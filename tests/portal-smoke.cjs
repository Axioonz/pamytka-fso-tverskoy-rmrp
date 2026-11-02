const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE='http://127.0.0.1:8765/';
const mockSupabase=String.raw`(()=>{'use strict';
const role=window.__role||'anonymous';
const seed=[{id:'member-1',employee_number:'0007',first_name:'Иван',last_name:'Тестовый',position:'Сотрудник',rank:'Сержант',discord:'ivan.test',status:'active',joined_on:'2026-10-10',dismissed_on:null,created_at:'2026-10-10',updated_at:'2026-10-10'}];
const db={fso_profiles:[{user_id:'user-1',role,display_name:''}],fso_members:seed,fso_disciplinary_actions:[],fso_disciplinary_audit:[],fso_questions:[{id:'q1',source_key:'quiz2-001',difficulty:1,prompt:'Проверочный вопрос?',is_published:true}],fso_exams:[],fso_exam_assignments:[],fso_exam_attempts:[]};
const state={db,rpcs:[],signedOut:false};window.__fsoMock=state;
const user={id:'user-1',email:'admin@example.test'};
function make(table){const q={table,where:[],action:'read',payload:null,
select(){return this},eq(k,v){this.where.push([k,v]);return this},order(){return this},limit(){return this},
insert(payload){this.action='insert';this.payload=payload;return this},update(payload){this.action='update';this.payload=payload;return this},
async run(){
const a=db[table]||[];
let records=a.filter(x=>this.where.every(([k,v])=>x[k]===v));
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
 if(name==='fso_issue_discipline'){
  db.fso_disciplinary_actions.push({id:'act-'+state.rpcs.length,member_id:args.p_member,kind:args.p_kind,status:'active',reason:args.p_reason,evidence:args.p_evidence,issued_at:new Date().toISOString()});
  return Promise.resolve({data:{issued_id:'act-1'},error:null});
 }
 if(name==='fso_make_exam'){
  db.fso_exams.push({id:'exam-1',title:args.p_title,pass_percent:args.p_pass_percent,duration_minutes:args.p_duration,max_attempts:args.p_max_attempts,status:'published',created_at:new Date().toISOString()});
  return Promise.resolve({data:'exam-1',error:null});
 }
 if(name==='fso_assign_exam'){
  db.fso_exam_assignments.push({id:'assignment-1',exam_id:args.p_exam,member_id:args.p_member,status:'assigned',assigned_at:new Date().toISOString()});
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
 return {page,errors};
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
 // Public entry and code login
 {
 const {page,errors}=await launchWithRole(browser,'anonymous');
 await page.getByRole('heading',{name:'Вход в личный кабинет'}).waitFor();
 await page.getByRole('button',{name:/Для курсантов/}).click();
 await page.getByRole('heading',{name:'Для курсантов'}).waitFor();
 assert.equal(new URL(page.url()).hash,'#cadet');
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
 await page.locator('#member-rank').fill('Рядовой');
 await page.locator('#member-discord').fill('demo.test');
 await page.locator('#member-status').selectOption('cadet');
 await page.locator('#member-form button[type="submit"]').click();
 await page.getByRole('heading',{name:'Алексей Проверочный'}).waitFor();
 await page.locator('#issue-reason').fill('Нарушение служебного регламента');
 await page.locator('#issue-proof').fill('https://example.com/evidence');
 await page.locator('#issue-form button[type="submit"]').click();
 await page.locator('.record strong').filter({hasText:'Предупреждение'}).first().waitFor();
 const capture=await page.evaluate(()=>({people:window.__fsoMock.db.fso_members.length,rpcs:window.__fsoMock.rpcs.map(x=>x.name)}));
 assert.equal(capture.people,2);
 assert.ok(capture.rpcs.includes('fso_issue_discipline'));
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
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/portal-admin.png',fullPage:true});
 await page.close();
 }
 // Ordinary employee denied access
 {
 const {page,errors}=await launchWithRole(browser,'employee');
 await page.getByRole('heading',{name:'Недостаточно прав'}).waitFor();
 assert.equal(await page.locator('#new-member').count(),0);
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
 await page.getByRole('button',{name:/Для курсантов/}).click();
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