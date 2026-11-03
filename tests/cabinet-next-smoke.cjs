const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const BASE='http://127.0.0.1:8765/';
const source=fs.readFileSync(path.join(__dirname,'portal-smoke.cjs'),'utf8');
const q=String.fromCharCode(96);
const marker='const mockSupabase=String.raw'+q;
const start=source.indexOf(marker)+marker.length;
const end=source.indexOf(q+';\nasync function launchWithRole',start);
if(start<marker.length||end<0)throw Error('Existing Supabase test fixture could not be loaded');
const mockSupabase=source.slice(start,end);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 async function newPage(role,viewport){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript({content:'window.__role='+JSON.stringify(role)});
  await page.route('**/cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:mockSupabase}));
  await page.goto(BASE+'кабинет-новый.html',{waitUntil:'load'});
  return {page,errors};
 }
 try{
  {
   const {page,errors}=await newPage('anonymous',{width:1440,height:900});
   await page.getByRole('heading',{name:'Вход в личный кабинет'}).waitFor();
   const bodyBg=await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);
   assert.equal(bodyBg,'rgb(5, 6, 7)');
   assert.ok(await page.locator('.auth-layout>.section').isVisible());
   assert.equal(await page.locator('#login-form').count(),1);
   await page.locator('#show-register').click();
   assert.equal(await page.locator('#register-form').count(),1);
   assert.ok(await page.locator('#register-discord').isVisible());
   assert.ok(await page.locator('#register-password-repeat').isVisible());
   await page.locator('#show-login').click();
   assert.equal(await page.locator('#login-form').count(),1);
   const grid=await page.locator('.auth-layout').evaluate(e=>getComputedStyle(e).gridTemplateColumns);
   assert.equal(grid.split(' ').length,2,'Login should have two columns on desktop');
   await page.screenshot({path:'/tmp/fso-cabinet-next-login.png',fullPage:true});
   await page.locator('#to-cadet').click();
   await page.getByRole('heading',{name:'Для курсантов'}).waitFor();
   await page.getByRole('link',{name:'Не курсант?'}).click();
   await page.getByRole('heading',{name:'Вход в личный кабинет'}).waitFor();
   assert.ok(decodeURIComponent(new URL(page.url()).pathname).endsWith('/кабинет-новый.html'),
    'Returning from cadet exam must open the original modern cabinet');
   assert.ok(!page.url().includes('#cadet'));
   assert.ok(await page.locator('#show-register').isVisible(),
    'Registration remains available after return from cadet view');
   assert.deepEqual(errors,[]);
   await page.close();
  }
  {
   const {page,errors}=await newPage('admin',{width:1440,height:940});
   await page.getByRole('heading',{name:'Сотрудники'}).waitFor();
   await page.getByText('Иван Тестовый').waitFor();
   assert.equal(await page.locator('.roster-metrics .metric').count(),3);
   assert.ok(await page.locator('nav.tabs').isVisible());
   const navBox=await page.locator('nav.tabs').boundingBox();
   const rosterBox=await page.locator('.roster-section').boundingBox();
   assert.ok(navBox&&rosterBox&&rosterBox.x>navBox.x+navBox.width,'Desktop navigation must live in its own left column');
   const adminPanel=await page.locator('#main').evaluate(e=>getComputedStyle(e).display);
   assert.equal(adminPanel,'grid');
   const dimensions=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
   assert.ok(dimensions.width<=dimensions.viewport+3,'Unexpected desktop cabinet overflow '+JSON.stringify(dimensions));
   await page.screenshot({path:'/tmp/fso-cabinet-next-admin.png',fullPage:true});
   await page.keyboard.press('Control+k');
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'search');
   await page.getByRole('button',{name:'Журнал аудита'}).click();
   await page.getByRole('heading',{name:'Журнал аудита'}).waitFor();
   await page.getByRole('button',{name:'Управление доступом'}).click();
   await page.getByRole('heading',{name:'Центр управления доступом'}).waitFor();
   await page.locator('#access-users tr').first().waitFor();
   await page.screenshot({path:'/tmp/fso-cabinet-next-access.png',fullPage:false});
   assert.deepEqual(errors,[]);
   await page.close();
  }
  {
   const {page,errors}=await newPage('admin',{width:390,height:844});
   await page.getByRole('heading',{name:'Сотрудники'}).waitFor();
   await page.locator('nav.tabs').waitFor({state:'visible'});
   assert.equal(await page.locator('#main').evaluate(el=>getComputedStyle(el).display),'flex');
   const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
   assert.ok(width.scroll<=width.viewport+3,'Mobile cabinet overflow '+JSON.stringify(width));
   await page.screenshot({path:'/tmp/fso-cabinet-next-mobile.png',fullPage:true});
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS: cabinet preview login, protected admin roster, access management and mobile layout (mock test account)');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
