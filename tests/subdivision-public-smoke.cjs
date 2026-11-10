const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const BASE='http://127.0.0.1:8765/';
const fixture=fs.readFileSync(path.join(__dirname,'portal-smoke.cjs'),'utf8');
const tick=String.fromCharCode(96);
const marker='const mockSupabase=String.raw'+tick;
const begin=fixture.indexOf(marker)+marker.length;
const finish=fixture.indexOf(tick+';\nasync function launchWithRole',begin);
if(begin<marker.length||finish<0)throw Error('Missing shared Supabase fixture');
const mockSupabase=fixture.slice(begin,finish);

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 async function visit(role,variant='index.html',width=1366){
  const page=await browser.newPage({viewport:{width,height:920}});
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.addInitScript({content:'window.__role='+JSON.stringify(role)});
  await page.route('**/cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:mockSupabase}));
  await page.goto(BASE+variant,{waitUntil:'domcontentloaded'});
  await page.locator('#home-title').waitFor({state:'visible'});
  await page.locator('.nv-more summary').click();
  await page.locator('.nv-more-panel [data-page="departments"]').click();
  await page.locator('#departments-screen').waitFor({state:'visible'});
  assert.equal(await page.locator('.sdept-card').count(),3);
  assert.equal(await page.locator('#sdept-login-form').count(),0);
  return {page,errors};
 }
 try{
  // Unauthenticated visitors can click cards and read the access instructions, not private text.
  {
   const {page,errors}=await visit('anonymous');
   await page.locator('.sdept-card[data-sdept="АС"]').click();
   await page.locator('#sdept-current-name').getByText('АС').waitFor();
   await page.locator('#sdept-login-form').waitFor();
   assert.equal(await page.locator('.sdept-material').count(),0);
   assert.equal(await page.locator('.sdept-news-item').count(),0);
   assert.equal(await page.locator('#sdept-detail a[href*="кабинет"]').count(),0);
   await page.locator('#sdept-back').click();
   assert.equal(await page.locator('.sdept-card:visible').count(),3);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  // An employee sees only their assigned department, from the server-checked RPC.
  {
   const {page,errors}=await visit('employee','portal.html',390);
   await page.locator('.sdept-card[data-sdept="АС"]').click();
   await page.getByRole('heading',{name:'Материалы подразделения недоступны'}).waitFor();
   assert.equal(await page.locator('.sdept-material').count(),0);
   assert.equal(await page.locator('#sdept-material-form').count(),0);
   await page.locator('[data-sdept-switch="УЛО"]').click();
   await page.getByText('Основная инструкция УЛО').waitFor();
   assert.equal(await page.locator('.sdept-material').count(),4);
   const forbidden=await page.evaluate(async()=>window.supabase.createClient().rpc('fso_subdivision_save',{
    p_department:'АС',p_essentials:'Подмена',p_promotion:'',p_uniform:'',p_contacts:''
   }));
   assert.equal(forbidden.error.code,'42501');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=3,'Department page overflows mobile width by '+overflow+'px');
   assert.deepEqual(errors,[]);
   await page.close();
  }
  // Leadership edits content and publishes notes directly on the main site.
  {
   const {page,errors}=await visit('admin');
   await page.locator('.sdept-card[data-sdept="АС"]').click();
   await page.locator('.sdept-edit-panel summary').click();
   await page.locator('#sdept-material-form [name="essentials"]').fill('Важные материалы АС');
   await page.locator('#sdept-material-form [name="promotion"]').fill('Система повышения АС');
   await page.locator('#sdept-material-form [name="uniform"]').fill('Форма подразделения АС');
   await page.locator('#sdept-material-form [type="submit"]').click();
   await page.locator('.sdept-material .sdept-copy').filter({hasText:'Важные материалы АС'}).waitFor();
   assert.equal(await page.getByText('Система повышения АС').count(),2);
   await page.locator('.sdept-add-news summary').click();
   await page.locator('#sdept-news-form [name="title"]').fill('Указание руководства');
   await page.locator('#sdept-news-form [name="body"]').fill('Важное объявление для сотрудников подразделения.');
   await page.locator('#sdept-news-form [type="submit"]').click();
   await page.getByRole('heading',{name:'Указание руководства'}).waitFor();
   await page.locator('#sdept-back').click();
   await page.locator('.sdept-card[data-sdept="УЛО"]').click();
   assert.equal(await page.getByText('Указание руководства').count(),0);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS: in-site clickable department cards, secured contents, publishing, and mobile layout');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
