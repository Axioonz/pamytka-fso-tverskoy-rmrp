const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE='http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:1});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 const isVisible=async(q)=>await page.locator(q).isVisible();
 try{
  await page.goto(BASE+'wiki.html',{waitUntil:'domcontentloaded'});
  await page.locator('#home-title').waitFor();
  assert.match(await page.locator('#home-title').innerText(),/ФСО\s*ТВЕРСКОЙ\s*WIKI/i);
  assert.equal(await page.locator('.wk-stats .wk-stat').count(),4);
  assert.equal(await page.locator('.wk-catalog-card').count(),10);
  assert.equal(await page.locator('.wk-feature-grid>button').count(),6);
  assert.equal(await page.locator('#section-search-form').count(),1);
  const stats=await page.locator('#portal-ref-count').innerText();
  assert.ok(Number(stats)>0,'Real legal reference count should be rendered');
  const header=await page.locator('#rail').boundingBox();
  assert.ok(header&&header.height<=80&&header.y===0,'Header should be at top');
  const over=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(over.actual<=over.viewport+3,'Desktop horizontal overflow: '+JSON.stringify(over));
  await page.screenshot({path:'/tmp/fso-wiki-home-desktop.png',fullPage:true});
  // Search is visible on demand and uses existing search logic.
  await page.keyboard.press('Control+k');
  await page.locator('#wk-search-modal').waitFor({state:'visible'});
  await page.locator('#section-search').fill('паспорт');
  await page.locator('#section-search-form button[type=submit]').click();
  await page.locator('#search-results:not([hidden])').waitFor();
  assert.ok((await page.locator('#search-results').innerText()).length>0);
  await page.keyboard.press('Escape');
  assert.equal(await isVisible('#wk-search-modal'),false);
  // Existing legal pages remain interactive.
  await page.locator('.wk-menu [data-page="reference"]').click();
  await page.locator('#reference-list .reference-entry').first().waitFor();
  await page.screenshot({path:'/tmp/fso-wiki-reference.png',fullPage:false});
  await page.locator('.wk-menu #wk-dropdown summary').click();
  await page.locator('.wk-dropdown-menu [data-page="detention"]').click();
  await page.locator('#detention-steps .det-step').first().waitFor();
  await page.screenshot({path:'/tmp/fso-wiki-detention.png',fullPage:false});
  await page.locator('.wk-menu [data-page="laws"]').click();
  await page.locator('#law-list').waitFor({state:'visible'});
  await page.screenshot({path:'/tmp/fso-wiki-laws.png',fullPage:false});
  await page.locator('.wk-menu [data-page="home"]').click();
  // Phone top dropdown and responsive categories.
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#home-title').waitFor();
  const mobile=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(mobile.actual<=mobile.viewport+3,'Mobile horizontal overflow: '+JSON.stringify(mobile));
  const major=await page.locator('.wk-catalog-major').boundingBox();
  const next=await page.locator('.wk-catalog-card[data-page="territories"]').boundingBox();
  assert.ok(major&&next&&next.y>=major.y+major.height-1,'Mobile catalog tile overlap detected');
  await page.locator('#wk-menu-toggle').click();
  assert.equal(await page.locator('#wk-menu-toggle').getAttribute('aria-expanded'),'true');
  await page.locator('.wk-menu [data-page="reference"]').click();
  await page.locator('#reference-list .reference-entry').first().waitFor();
  assert.equal(await page.locator('#wk-menu-toggle').getAttribute('aria-expanded'),'false');
  await page.locator('.wk-brand').click();
  await page.screenshot({path:'/tmp/fso-wiki-home-mobile.png',fullPage:true});
  assert.deepEqual(errs,[],'Browser errors');
  console.log('PASS: RussiaOnline-inspired FSO wiki dark/red home, category grid, Ctrl K, desktop/mobile, laws and detention');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
