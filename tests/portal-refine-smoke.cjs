const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE='http://127.0.0.1:8765/';
async function settle(page){await page.waitForTimeout(370)}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(BASE+'portal.html',{waitUntil:'domcontentloaded'});
  await page.locator('#home-title').waitFor({state:'visible'});
  const tile=page.locator('.nv-main-module');
  await tile.hover();await settle(page);
  const serviceStyle=await tile.evaluate(el=>{
   const css=getComputedStyle(el);
   return {image:css.backgroundImage,before:getComputedStyle(el,'::before').content,after:getComputedStyle(el,'::after').content,transform:css.transform};
  });
  assert.equal(serviceStyle.image,'none','Service card grid/ornaments must be gone');
  assert.equal(serviceStyle.transform,'none','Service card must not jump on hover');
  const accent=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent-strong').trim());
  assert.equal(accent,'#a4bdcf','Accent should be muted steel blue');
  assert.match(await page.locator('.nv-workspace-info p').innerText(),/Рабочие инструменты руководства ФСО/);
  const footer=await page.locator('.nv-footer').innerText();
  assert.ok(!/Действующий сайт|Предыдущий вариант/.test(footer));
  const more=page.locator('.nv-more summary');
  assert.equal(await more.locator('svg.nv-more-icon').count(),1);
  assert.ok(!(await more.innerText()).includes('⌄'));
  await page.screenshot({path:'/tmp/fso-refine-home.png',fullPage:true});

  await page.locator('.nv-nav [data-page="reference"]').click();
  await page.locator('#reference-list .reference-entry').first().waitFor({state:'visible'});
  await page.locator('.nv-ref-index').first().waitFor();
  const cards=page.locator('#reference-list .reference-entry');
  assert.ok((await cards.count())>3);
  assert.equal(await cards.first().locator('.nv-ref-index').innerText(),'001');
  assert.equal(await cards.nth(1).locator('.nv-ref-index').innerText(),'002');
  const refStyle=await cards.first().evaluate(el=>({
   summary:getComputedStyle(el.querySelector('.ref-summary')).display,
   grid:getComputedStyle(el).gridTemplateColumns.split(' ').length,
   height:Math.round(el.getBoundingClientRect().height)
  }));
  assert.equal(refStyle.summary,'none');
  assert.ok(refStyle.height<100,'Reference entries should be concise '+JSON.stringify(refStyle));
  await settle(page);await page.screenshot({path:'/tmp/fso-refine-reference.png',fullPage:false});
  await cards.first().click();
  await page.locator('#reference-overlay').waitFor({state:'visible'});
  await page.locator('#reference-close').click();
  await page.locator('#reference-search').fill('паспорт');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#reference-list .reference-entry .nv-ref-index').first().innerText(),'001','List renumbers after search');
  await page.locator('#reference-search').fill('');

  await page.locator('.nv-more summary').click();
  await page.locator('.nv-more-panel [data-page="concepts"]').click();
  await page.locator('#material-list .concept-entry').first().waitFor({state:'visible'});
  assert.ok((await page.locator('#material-list .concept-entry').count())>=3);
  const heading=await page.locator('#section-title').evaluate(e=>({
   background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderTopWidth
  }));
  assert.equal(heading.background,'rgba(0, 0, 0, 0)','Concept heading should not use broken background panel');
  assert.equal(heading.border,'0px','Concept heading should not use inherited panel border');
  const concept=await page.locator('.concept-entry').first().evaluate(el=>({
   display:getComputedStyle(el).display,heading:getComputedStyle(el.querySelector('h2')).color,
   text:getComputedStyle(el.querySelector('p')).color
  }));
  assert.equal(concept.display,'grid');
  await settle(page);await page.screenshot({path:'/tmp/fso-refine-concepts.png',fullPage:false});

  await page.locator('#about-open').click();
  await page.locator('#about-layer.open #about-drawer').waitFor({state:'visible'});
  await settle(page);
  const box=await page.locator('#about-drawer').boundingBox();
  assert.ok(box&&box.width<720&&box.width>430,'About must be a centered medium card');
  assert.ok(Math.abs(box.x+box.width/2-720)<5,'About card horizontally centered '+JSON.stringify(box));
  assert.ok(Math.abs(box.y+box.height/2-470)<35,'About card vertically centered '+JSON.stringify(box));
  const about=await page.locator('#about-layer').innerText();
  assert.ok(!about.includes('Разработчик памятки'));
  assert.ok(!/\b0[123]\b/.test(about),'About sections must have no numbering');
  await page.screenshot({path:'/tmp/fso-refine-about.png',fullPage:false});
  await page.locator('#about-close').click();
  await page.locator('#about-layer').waitFor({state:'hidden'});

  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#home-title').waitFor({state:'visible'});
  const dimension=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dimension.scroll<=dimension.viewport+3,'Mobile horizontal overflow '+JSON.stringify(dimension));
  await page.screenshot({path:'/tmp/fso-refine-mobile.png',fullPage:true});
  await page.locator('#about-open').evaluate(el=>el.click());
  await page.locator('#about-layer.open #about-drawer').waitFor({state:'visible'});
  const mobileCard=await page.locator('#about-drawer').boundingBox();
  assert.ok(mobileCard.width<=390&&mobileCard.height<=844,'Mobile About card must fit viewport '+JSON.stringify(mobileCard));
  await page.locator('#about-close').click();
  await page.locator('#nv-menu-button').click();
  await page.locator('.nv-more summary').click();
  await page.locator('.nv-more-panel [data-page="concepts"]').click();
  await page.locator('#material-list .concept-entry').first().waitFor({state:'visible'});
  const mobileOverflow=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(mobileOverflow.scroll<=mobileOverflow.viewport+3,'Mobile concepts overflow '+JSON.stringify(mobileOverflow));
  assert.deepEqual(errors,[],'Page errors');
  console.log('PASS: refined black portal, service hover, muted accents, compact reference index, concepts and centered About');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
