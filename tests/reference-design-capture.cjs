const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
for(const u of ['https://russiaonline.wiki/','https://wiki.russia.online/ru','https://rinvek.com/work/russiaonline/']){
 let p=await browser.newPage({viewport:{width:1440,height:980},deviceScaleFactor:1});
 try{const r=await p.goto(u,{waitUntil:'domcontentloaded',timeout:20000});await p.waitForTimeout(1500);const name=u.includes('russiaonline.wiki')?'russiawiki':u.includes('wiki.russia')?'russia-new':'rinvek';await p.screenshot({path:'/tmp/reference-'+name+'.png',fullPage:true,timeout:25000});console.log('CAPTURE',name,p.url(),r?.status(),(await p.title()),(await p.locator('body').innerText()).slice(0,1700))}catch(e){console.log('CAPTURE FAILED',u,String(e).slice(0,250))}
 await p.close();
}
await browser.close()})().catch(e=>{console.error(e);process.exitCode=1});
