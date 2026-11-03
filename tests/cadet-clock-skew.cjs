const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const BASE='http://127.0.0.1:8765/';
const original=fs.readFileSync(path.join(__dirname,'portal-smoke.cjs'),'utf8');
const mark='const mockSupabase=String.raw'+String.fromCharCode(96);
const begin=original.indexOf(mark)+mark.length;
const end=original.indexOf(String.fromCharCode(96)+';\nasync function launchWithRole',begin);
if(begin<mark.length||end<0)throw Error('Missing existing mocked Supabase fixture');
const mockSupabase=original.slice(begin,end);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:870}});
  const errors=[],calls=[],answers={};
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript({content:`
    window.__role='anonymous';
    // Intentionally skew the trainee's system clock two hours into the future.
    // The test fails if local Date.now() can end an active exam.
    const originalNow=Date.now.bind(Date);
    Date.now=()=>originalNow()+2*60*60*1000;
  `});
  await page.route('**/cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:mockSupabase}));
  const serverStart=Date.now();
  const deadline=new Date(serverStart+30*60000).toISOString();
  await page.route('**/functions/v1/fso-cadet-exam',async route=>{
   const payload=JSON.parse(route.request().postData()||'{}');
   calls.push(payload);
   if(payload.action==='answer')answers[payload.ordinal]=[payload.chosen];
   if(payload.action==='finish'&&(payload.confirmed!==true||Object.keys(answers).length===0)){
    await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Не подтверждено завершение'})});
    return;
   }
   const done=payload.action==='finish';
   const state={
    status:done?'completed':'in_progress',title:'Проверочный экзамен',member:'Тестовый Курсант',
    started_at:new Date(serverStart).toISOString(),deadline_at:deadline,server_now:new Date().toISOString(),
    pass_percent:80,max_attempts:1,attempts_used:1,retries_remaining:0,
    answers,questions:done?[]:[{ordinal:1,prompt:'Контрольный вопрос?',options:['Ответ 1','Ответ 2']}],
    result:done?{correct:1,total:1,percent:100,passed:true}:null
   };
   await route.fulfill({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(state)});
  });
  await page.goto(BASE+'кабинет.html#cadet',{waitUntil:'domcontentloaded'});
  await page.locator('#cadet-code').waitFor({state:'visible'});
  await page.locator('#cadet-code').fill('FSO-'+'A'.repeat(32));
  await page.getByRole('button',{name:'Открыть экзамен'}).click();
  await page.getByRole('heading',{name:'Контрольный вопрос?'}).waitFor();
  assert.match(await page.locator('#cadet-clock').innerText(),/Осталось (30:00|2[89]:[0-5][0-9])/,'Countdown must use server time despite local skew');
  await page.waitForTimeout(1800);
  assert.equal(calls.filter(x=>x.action==='finish').length,0,'Clock skew must not submit exam');
  assert.equal(await page.getByRole('heading',{name:'Экзамен не сдан'}).count(),0);
  // Zero answers cannot be submitted even after pressing the finish button.
  await page.getByRole('button',{name:'Завершить экзамен'}).click();
  await page.getByText(/Сначала ответьте хотя бы/).waitFor();
  assert.equal(calls.filter(x=>x.action==='finish').length,0);
  await page.locator('[data-answer="0"]').click();
  await page.locator('.option.selected').waitFor();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Контрольный вопрос?'}).waitFor();
  assert.equal(calls.filter(x=>x.action==='finish').length,0,'Reload must not automatically finish');
  page.once('dialog',dlg=>dlg.accept());
  await page.getByRole('button',{name:'Завершить экзамен'}).click();
  await page.getByRole('heading',{name:'Экзамен сдан'}).waitFor();
  assert.equal(calls.filter(x=>x.action==='finish').length,1);
  assert.equal(calls.at(-1).confirmed,true,'Only a confirmed manual finish can be submitted');
  assert.deepEqual(errors,[]);
  console.log('PASS: trainee device clock +2 hours no longer finishes exam; explicit confirmed submission works');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
