const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE='http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(BASE+'redesign.html',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Портал ФСО'}).waitFor();
  assert.equal(await page.locator('#portal-ref-count').count(),1);
  assert.equal(await page.locator('#portal-law-count').count(),1);
  assert.equal(await page.locator('#section-search-form').count(),1);
  assert.equal(await page.locator('.rd-feature-row').count(),6);
  assert.equal(await page.locator('.rail-button').count(),12);
  const side=await page.locator('#rail').boundingBox();
  assert.ok(side&&side.width>=235,'Desktop persistent navigation should be visible');
  const screen=await page.locator('#home-screen').boundingBox();
  assert.ok(screen.x>=side.width,'Home screen must not be hidden behind sidebar');
  await page.screenshot({path:'/tmp/fso-redesign-desktop.png',fullPage:true});
  // The same data and navigation as the production site.
  await page.locator('.rd-feature-row[data-page="reference"]').click();
  await page.locator('#reference-list .reference-entry').first().waitFor();
  await page.locator('.rail-button[data-page="home"]').click();
  await page.locator('.rd-feature-row[data-page="detention"]').click();
  await page.locator('#detention-steps .det-step').first().waitFor();
  await page.locator('.rail-button[data-page="home"]').click();
  // Mobile layout should preserve access and not overflow.
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Портал ФСО'}).waitFor();
  const overflow=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(overflow.width<=overflow.viewport+3,'Unexpected horizontal overflow: '+JSON.stringify(overflow));
  const mobileRail=await page.locator('#rail').boundingBox();
  assert.ok(mobileRail&&mobileRail.y>700,'Mobile navigation should dock to bottom');
  await page.screenshot({path:'/tmp/fso-redesign-mobile.png',fullPage:true});
  assert.deepEqual(errors,[],'Unexpected JavaScript page errors');
  console.log('PASS: redesign preview opens, desktop sidebar, mobile layout, references and detention work');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
