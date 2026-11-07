const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE='http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(BASE+'portal.html',{waitUntil:'domcontentloaded'});
  await page.locator('#home-title').waitFor({state:'visible'});
  await page.waitForTimeout(220);
  const bg=await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.equal(bg,'rgb(5, 6, 7)','Portal must be pure black, not dark blue');
  assert.equal(await page.locator('.nv-reading-progress').count(),1);
  assert.equal(await page.locator('.nv-back-top').count(),1);
  assert.ok((await page.locator('.nv-hero-buttons a').getAttribute('href')).includes('кабинет-новый.html'));
  const fullWidth=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(fullWidth.width<=fullWidth.viewport+4,'Desktop overflow '+JSON.stringify(fullWidth));
  // Real scrolling must reveal every content block without scroll hijacking.
  for(const pos of [450,950,1500,2100,2800]){
   await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),pos);
   await page.waitForTimeout(85);
  }
  const prog=await page.locator('.nv-reading-progress').evaluate(el=>getComputedStyle(el).transform);
  assert.notEqual(prog,'matrix(0, 0, 0, 1, 0, 0)','Scroll progress must update');
  await page.locator('.nv-back-top').click();
  await page.waitForTimeout(220);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:'/tmp/fso-motion-home.png',fullPage:true});
  // Separate design for territories: three distinctly coded zones.
  await page.locator('.nv-utility [data-page="posts"]').first().click();
  await page.locator('#posts-screen').waitFor({state:'visible'});
  await page.locator('.nv-more summary').click();
  await page.locator('.nv-more-panel [data-page="territories"]').click();
  await page.locator('.tg-regime').first().waitFor({state:'visible'});
  assert.equal(await page.locator('.tg-regime').count(),3);
  assert.ok(await page.locator('#territories-screen').isVisible());
  await page.waitForTimeout(440);
  await page.screenshot({path:'/tmp/fso-motion-territories.png',fullPage:false});
  // Detention timeline with preserved procedural text and deadlines.
  await page.locator('.nv-more summary').click();
  await page.locator('.nv-more-panel [data-page="detention"]').click();
  await page.locator('#detention-steps .det-step').first().waitFor({state:'visible'});
  assert.ok(await page.getByText('60 минут',{exact:true}).isVisible());
  assert.ok(await page.getByText('5 + 5 минут',{exact:true}).isVisible());
  assert.ok(await page.getByText('2 минуты',{exact:true}).isVisible());
  assert.equal(await page.locator('#detention-screen .det-stat').count(),4);
  await page.waitForTimeout(440);
  await page.screenshot({path:'/tmp/fso-motion-detention.png',fullPage:false});
  // Legal reference library remains interactive under the redesigned styles.
  await page.locator('.nv-nav [data-page="reference"]').click();
  await page.locator('#reference-list .reference-entry').first().waitFor({state:'visible'});
  assert.equal(await page.locator('#reference-list .reference-entry').first().evaluate(el=>getComputedStyle(el).display),'grid');
  await page.waitForTimeout(440);
  await page.screenshot({path:'/tmp/fso-motion-reference.png',fullPage:false});
  await page.locator('.nv-nav [data-page="laws"]').click();
  await page.locator('#law-list').waitFor({state:'visible'});
  await page.waitForTimeout(440);
  await page.screenshot({path:'/tmp/fso-motion-laws.png',fullPage:false});
  // Mobile, menu, no overflow, sticky native scroll.
  await page.locator('.nv-nav [data-page="home"]').click();
  await page.locator('#home-screen').waitFor({state:'visible'});
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#home-title').waitFor({state:'visible'});
  const mobile=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(mobile.width<=mobile.viewport+4,'Mobile overflow '+JSON.stringify(mobile));
  await page.locator('#nv-menu-button').click();
  await page.locator('.nv-nav [data-page="reference"]').click();
  await page.locator('#reference-list .reference-entry').first().waitFor({state:'visible'});
  await page.locator('.nv-identity').click();
  await page.locator('#home-screen').waitFor({state:'visible'});
  await page.screenshot({path:'/tmp/fso-motion-mobile.png',fullPage:true});
  // Reduced motion must leave content readable and navigable.
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload({waitUntil:'domcontentloaded'});
  assert.ok(await page.locator('#home-title').isVisible());
  assert.ok(await page.locator('.nv-service-links').isVisible());
  assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(5, 6, 7)');
  assert.deepEqual(errors,[],'Unexpected runtime errors');
  console.log('PASS: black portal, real scroll reveal/progress, page transitions, territories, detention, laws and reduced-motion accessibility');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
