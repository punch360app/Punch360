// Exercise the REAL Punch annotation page with the Atelier module intentionally
// unavailable. This is failure-recovery QA, NOT a substitute for the shared
// responsive workspace test in visual-annotations.cjs.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const output='visual-captures';
fs.mkdirSync(output,{recursive:true});
const sizes=[['Small',320,640],['S25',412,915],['iPad',820,1180],['PC',1440,900]];
const results=[];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [device,width,height] of sizes){
   const context=await browser.newContext({
    viewport:{width,height},deviceScaleFactor:1,
    isMobile:width<720,hasTouch:width<900,serviceWorkers:'block'
   });
   const page=await context.newPage();
   const requests=[];
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1'&&url.port==='8765')return route.continue();
    requests.push(url.hostname+url.pathname);
    // No external API or remote script can run during this isolated test.
    return route.abort();
   });
   try{
    const response=await page.goto('http://127.0.0.1:8765/annotations.html',{waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200);
    const boot=page.locator('#punch-preview-boot[role="alert"]');
    await boot.waitFor({state:'visible',timeout:12000});
    assert.match(await boot.textContent(),/temporairement indisponible/);
    assert.match(await boot.textContent(),/annotations locales restent sur cet appareil/);
    assert.equal(await page.locator('[data-punch-live-root]').count(),0,
     'an unavailable Atelier module must never create a fake rendered device');
    const retry=boot.getByRole('button',{name:'Réessayer le chargement'});
    assert.ok(await retry.isVisible());
    const bounds=await retry.boundingBox();
    assert.ok(bounds&&bounds.height>=44&&bounds.width>=44,
     'retry must remain touch-accessible on '+device);
    const visibleControls=await page.locator('#review-export').count();
    assert.equal(visibleControls,1,'the annotation UI must initialize independently');
    const notesKey='punch360-12fb1917-94ea-481d-b131-16c58a5bf010:live-annotations:v1';
    await page.evaluate(([key])=>localStorage.setItem(key,'[]'),[notesKey]);
    const capture=path.join(output,'atelier-offline-retry-'+device+'.png');
    await page.screenshot({path:capture,animations:'disabled'});
    await Promise.all([
     page.waitForNavigation({waitUntil:'domcontentloaded',timeout:12000}),
     retry.click()
    ]);
    const recovered=page.locator('#punch-preview-boot[role="alert"]');
    await recovered.waitFor({state:'visible',timeout:12000});
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),notesKey),'[]',
     'a reload should not delete annotations');
    assert.equal(await page.locator('[data-punch-live-root]').count(),0);
    const layout=await page.evaluate(()=>({
     viewport:innerWidth,width:document.documentElement.scrollWidth
    }));
    assert.ok(layout.width<=layout.viewport+2,'no horizontal overflow on '+device);
    assert.ok(requests.some(u=>u.includes('/responsive/v1/entry.mjs')),
     'the real Atelier module must have been attempted');
    assert.ok(!requests.some(u=>/supabase/i.test(u)),
     'fallback must never reach production Supabase');
    results.push({device,width,height,attemptedRemoteModule:true,
     accessibleFailure:true,reload:true,persistence:true,
     genuineSharedModuleMounted:false,capture});
    console.log('PUNCH Atelier OFFLINE '+device+': graceful failure and retry PASS; real responsive rendering NOT VERIFIED');
   }finally{await context.close()}
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,'atelier-offline-retry.json'),
  JSON.stringify({type:'offline-recovery-only',viewports:results.length,
   realResponsiveRendering:'NOT VERIFIED — see mandatory visual-annotations.cjs',
   results},null,2)+'\n');
})().catch(err=>{console.error('PUNCH Atelier offline-retry FAILED',err);process.exitCode=1});
