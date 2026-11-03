const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE='http://127.0.0.1:8765/';

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(BASE+'index.html',{waitUntil:'domcontentloaded'});
  await page.locator('.rail-button[data-page="reference"]').click();
  const item=page.locator('#reference-list .reference-entry').filter({hasText:'Проверка документов'}).first();
  await item.waitFor();
  await item.click();
  await page.locator('#reference-modal-title').waitFor();
  assert.match(await page.locator('#reference-modal-title').innerText(),/Проверка документов/i);
  const cards=page.locator('.reference-context-link');
  const count=await cards.count();
  assert.ok(count>=2,'Expected several related legal grounds');
  const visual=await cards.first().evaluate(el=>{
    const style=getComputedStyle(el);
    return {
      display:style.display,
      padding:parseFloat(style.paddingLeft),
      borderRadius:parseFloat(style.borderTopLeftRadius),
      children:[...el.children].map(node=>({
        tag:node.tagName,
        display:getComputedStyle(node).display
      }))
    };
  });
  assert.equal(visual.display,'flex','Related legal grounds must use card layout');
  assert.ok(visual.padding>=12,'Related card should have inner spacing');
  assert.ok(visual.borderRadius>=8,'Related card should have rounded corners');
  assert.deepEqual(visual.children.map(x=>x.tag),['B','SPAN','SMALL']);
  assert.ok(visual.children.every(x=>x.display==='block'));
  // Measure static layout, not intermediate entrance transforms from the modal.
  await page.addStyleTag({content:'.reference-context-link{animation:none!important;transition:none!important;transform:none!important}'});
  // Wait for the existing entry animation to settle before measuring grid alignment.
  await page.waitForFunction(()=>{
    const elements=document.querySelectorAll('.reference-context-link');
    if(elements.length<2)return false;
    return Math.abs(elements[0].getBoundingClientRect().y-elements[1].getBoundingClientRect().y)<2;
  },null,{timeout:3000});
  const first=await cards.nth(0).boundingBox();
  const second=await cards.nth(1).boundingBox();
  assert.ok(first&&second);
  const gridInfo=await page.locator('.reference-context-grid').evaluate(el=>({display:getComputedStyle(el).display,template:getComputedStyle(el).gridTemplateColumns,width:el.getBoundingClientRect().width,viewport:innerWidth}));
  console.log('Reference desktop grid',JSON.stringify({gridInfo,first,second}));
  assert.ok(Math.abs(first.y-second.y)<3,'Desktop cards must align in columns');
  const article=page.locator('.reference-full-article');
  if(await article.count()){
    await article.locator('summary').click();
    const display=await article.evaluate(el=>getComputedStyle(el).display);
    assert.equal(display,'block');
    assert.ok(await article.locator('.reference-full-article-text p').count()>0);
  }
  await page.screenshot({path:'/tmp/portal-reference-desktop.png',fullPage:false});
  await page.setViewportSize({width:390,height:844});
  const mFirst=await cards.nth(0).boundingBox();
  const mSecond=await cards.nth(1).boundingBox();
  assert.ok(mFirst&&mSecond);
  assert.ok(mSecond.y>mFirst.y+20,'Mobile cards must stack vertically');
  assert.ok(mFirst.x>=0&&mFirst.x+mFirst.width<=391,'Mobile card must remain within viewport');
  await page.screenshot({path:'/tmp/portal-reference-mobile.png',fullPage:false});
  await cards.first().click();
  assert.notEqual(await page.locator('#reference-modal-title').innerText(),'Проверка документов');

  // Detention content must be concise: no repeated advice blocks, no empty explanations.
  await page.locator('#reference-close').click();
  await page.setViewportSize({width:1280,height:900});
  // In the redesigned portal the detention link lives in the collapsed "More sections" menu.
  // Open the menu first, then navigate via a visible control.
  await page.locator('#nv-more > summary').click();
  await page.locator('#nv-more .rail-button[data-page="detention"]').click();
  await page.locator('#detention-screen').waitFor({state:'visible'});
  const detSteps=page.locator('#detention-steps .det-step');
  assert.equal(await detSteps.count(),4);
  assert.deepEqual(await detSteps.locator('h2').allTextContents(),[
   'Представиться и назвать статьи',
   'Соблюдать права задержанного',
   'Учитывать особый порядок',
   'Передать задержанного'
  ]);
  assert.equal(await page.locator('#detention-screen .det-hint').count(),0);
  assert.equal(await page.locator('#detention-screen .det-step-reason').count(),0);
  assert.equal(await page.getByText('Подсказка',{exact:true}).count(),0);
  assert.ok((await detSteps.first().locator('.det-step-action').innerText()).includes('удостоверение'));
  assert.ok((await detSteps.last().locator('.det-step-action').innerText()).includes('МВД или СК'));
  assert.ok((await detSteps.last().locator('.det-norm-text').first().innerText()).includes('Задержанные лица незамедлительно передаются'));
  const quotes=await page.locator('#detention-steps .det-norm-text').count();
  assert.equal(quotes,8,'Exact legal extracts should remain for every step');
  assert.equal(await page.locator('#detention-steps .det-norms-heading').first().innerText(),'ТЕКСТ ЗАКОНА');
  const detText=await page.locator('#detention-screen').innerText();
  assert.ok(!detText.includes('undefined'));
  assert.ok(!detText.includes('Основание и смысл'));
  await page.screenshot({path:'/tmp/portal-detention-mobile.png',fullPage:true});
  assert.deepEqual(errors,[],'Unexpected JavaScript errors');
  console.log('PASS: legal references and detention plain-language steps, without hints or duplication');
 }finally{
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
