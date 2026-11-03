const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE='http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 try{
  await page.goto(BASE+'portal.html',{waitUntil:'domcontentloaded'});
  await page.locator('#home-title').waitFor({state:'visible'});
  assert.equal(await page.locator('.nv-chapters .nv-chapter').count(),5);
  assert.ok(await page.locator('.nv-chapters').isVisible(),'Home chapter wayfinder visible on desktop');
  const chapter=page.getByRole('button',{name:'Перейти к разделу Справочник'});
  await chapter.click();
  await page.waitForTimeout(1200);
  const chapterState=await page.locator('.nv-chapter.nv-current').getAttribute('aria-label');
  assert.equal(chapterState,'Перейти к разделу Справочник');
  const box=await page.locator('.nv-library').boundingBox();
  assert.ok(box&&box.y>=-10&&box.y<160,'Chapter should scroll to knowledge block, got '+JSON.stringify(box));
  await page.screenshot({path:'/tmp/fso-journey-knowledge.png',fullPage:false});

  await page.locator('.nv-more summary').click();
  await page.locator('.nv-more-panel [data-page="territories"]').click();
  await page.locator('#territories-screen').waitFor({state:'visible'});
  assert.equal(await page.locator('.nv-territory-jump button').count(),await page.locator('.tg-part[id]').count());
  await page.locator('.nv-territory-jump button').nth(1).click();
  await page.waitForTimeout(1100);
  const active=await page.locator('.nv-territory-jump .nv-current').first().innerText();
  assert.match(active,/Государственные объекты/);
  assert.ok((await page.locator('#tg-objects').boundingBox()).y<190);
  await page.screenshot({path:'/tmp/fso-journey-territories.png',fullPage:false});

  await page.locator('.nv-nav [data-page="laws"]').click();
  await page.locator('#law-reader').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Режим чтения'}).click();
  assert.equal(await page.locator('#law-screen.nv-reader-focused').count(),1);
  assert.equal(await page.locator('.law-sidebar').isVisible(),false);
  await page.screenshot({path:'/tmp/fso-journey-laws-focus.png',fullPage:false});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#law-screen.nv-reader-focused').count(),0);
  assert.ok(await page.locator('.law-sidebar').isVisible());
  await page.locator('.nv-more summary').click();
  await page.locator('.nv-more-panel [data-page="detention"]').click();
  await page.locator('#detention-steps .det-step').first().waitFor({state:'visible'});
  await page.waitForTimeout(400);
  assert.match(await page.locator('.nv-det-step-position').innerText(),/^Этап \d\d \/ \d\d$/);

  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('.nv-chapters').isVisible(),false);
  const size=await page.evaluate(()=>({page:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(size.page<=size.width+3,'Mobile horizontal overflow '+JSON.stringify(size));
  await page.locator('#nv-menu-button').click();
  await page.locator('.nv-nav [data-page="territories"]').count(); // menu routes differ, use More on mobile
  await page.locator('.nv-more summary').click();
  await page.locator('.nv-more-panel [data-page="territories"]').click();
  await page.locator('#territories-screen').waitFor({state:'visible'});
  await page.locator('.nv-territory-jump button').nth(1).click();
  await page.waitForTimeout(1000);
  assert.ok(await page.locator('#tg-objects').isVisible());
  const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(overflow.page<=overflow.width+3,'Territory mobile overflow '+JSON.stringify(overflow));
  assert.deepEqual(errors,[],'Browser page errors');
  console.log('PASS: chapter wayfinder, territory quick index, distraction-free law reading and current detention stage');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});