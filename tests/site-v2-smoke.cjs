const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:8765/';
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'v2.html',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:/Служба.*Информация.*Порядок/s}).waitFor();
 assert.equal(await page.locator('.v2-hero').count(),1);
 assert.equal(await page.locator('#rail .rail-nav').count(),1);
 assert.ok(await page.locator('#rail').evaluate(el=>getComputedStyle(el).position==='sticky'));
 assert.equal(await page.locator('.v2-directions-list .v2-direction').count(),4);
 assert.equal(await page.locator('.v2-doc-list button').count(),3);
 const nav=await page.locator('#rail').boundingBox();
 const home=await page.locator('#home-screen').boundingBox();
 assert.ok(nav&&home&&home.y>=nav.y+nav.height-2,'Main content should start below horizontal header');
 await page.screenshot({path:'/tmp/fso-v2-desktop.png',fullPage:true});
 // Primary navigation works with existing JS and content.
 await page.locator('.v2-navigation [data-page="reference"]').click();
 await page.locator('#reference-list .reference-entry').first().waitFor();
 await page.locator('#v2-nav-dropdown summary').click();
 await page.locator('.v2-dropdown-content [data-page="detention"]').click();
 await page.locator('#detention-steps .det-step').first().waitFor();
 // Documentation library is still functional.
 await page.locator('.v2-navigation [data-page="laws"]').click();
 await page.locator('#law-list').waitFor({state:'visible'});
 await page.locator('.v2-navigation [data-page="home"]').click();
 await page.locator('#section-search').fill('паспорт');
 await page.locator('#section-search-form button[type=submit]').click();
 assert.ok((await page.locator('#search-results').innerText()).length>0);
 // Phone: full-width dropdown, top controls, no old bottom sidebar.
 await page.setViewportSize({width:390,height:844});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#home-title').waitFor();
 let dim=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert.ok(dim.scroll<=dim.viewport+3,'Unexpected mobile horizontal overflow '+JSON.stringify(dim));
 const box=await page.locator('#rail').boundingBox();
 assert.ok(box&&box.y<5,'Top nav must remain at top on mobile');
 await page.locator('#v2-menu-toggle').click();
 assert.equal(await page.locator('#v2-menu-toggle').getAttribute('aria-expanded'),'true');
 await page.locator('.v2-navigation [data-page="reference"]').click();
 await page.locator('#reference-list .reference-entry').first().waitFor();
 assert.equal(await page.locator('#v2-menu-toggle').getAttribute('aria-expanded'),'false');
 await page.locator('.v2-navigation [data-page="home"]').first().evaluate(el=>el.click());
 await page.screenshot({path:'/tmp/fso-v2-mobile.png',fullPage:true});
 assert.deepEqual(errors,[],'Unexpected page script errors');
 console.log('PASS: full v2 navigation, document sections, live search, mobile menu and layout');
}finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
