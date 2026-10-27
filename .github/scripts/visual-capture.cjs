// Public, logged-out UI only: real served app, blocked Supabase network, no production credentials.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const output='visual-captures';
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  for (const [device,width,height] of [['S25',412,915],['iPad',820,1180],['PC',1440,900]]) {
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block',isMobile:width<768,hasTouch:width<900});
   // Blocking every real Supabase request makes this job read-only by construction.
   await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.abort());
   await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>{
    const root=document.querySelector('#root');
    return root && root.textContent.trim() && !root.textContent.includes('Chargement de l’application');
   },null,{timeout:30000});
   await page.evaluate(()=>document.fonts.ready);
   await page.waitForTimeout(500);
   const file=path.join(output,'punch-'+device+'-logged-out.png');
   await page.screenshot({path:file,animations:'disabled'});
   console.log('Captured '+file);
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
