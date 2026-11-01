// Dedicated Bento 05 viewport QA. The existing 24-screen public capture is retained.
// All requests outside the local static server are blocked. Plan prices, real
// Auth and physical devices are NOT verified by these synthetic-network captures.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const output='visual-captures';
const sizes=[
 ['Small320',320,640],['Mobile390',390,844],['Tablet834',834,1112],
 ['TabletWide1024',1024,768],['Desktop1440',1440,900]
];
fs.mkdirSync(output,{recursive:true});
const results=[];

async function measure(page){
 return page.evaluate(()=>{
  const width=innerWidth;
  const root=document.querySelector('.punch-public-bento');
  const tabs=[...document.querySelectorAll('.punch-public-bento .public-edition-tabs button')];
  const link=document.querySelector('.punch-public-bento .onboard-link');
  const cells=[...document.querySelectorAll('.punch-public-bento .bento-cell')];
  const targets=[...tabs,link].filter(Boolean).map(el=>{
   const box=el.getBoundingClientRect();
   return {label:el.textContent.trim().slice(0,48),width:box.width,height:box.height};
  });
  return {
   viewport:width,documentWidth:document.documentElement.scrollWidth,
   mainWidth:root?.getBoundingClientRect().width,
   tiles:cells.length,targets,iframes:document.querySelectorAll('iframe').length,
   errors:document.querySelectorAll('.punch-public-bento [role="alert"]').length
  };
 });
}

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [device,width,height] of sizes){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,
    isMobile:width<768,hasTouch:width<900,serviceWorkers:'block'});
   const page=await context.newPage();
   const pageErrors=[];
   page.on('pageerror',error=>pageErrors.push(String(error.message).slice(0,240)));
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port==='8765')
     return route.continue();
    return route.abort('blockedbyclient');
   });
   try{
    const response=await page.goto('http://127.0.0.1:8765/?edition=essential',
     {waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200);
    await page.locator('.punch-public-bento').waitFor({state:'visible',timeout:30000});
    await page.locator('.punch-public-bento .ess-pricing').waitFor({state:'visible',timeout:15000});
    assert.equal(await page.locator('.public-edition-tabs [data-id="essential"]').getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('.welcome-intro h1').textContent(),/Une équipe/);
    await page.evaluate(()=>document.fonts.ready);
    // Network isolation intentionally means the real catalog cannot load.
    // Do not certify live prices or display raw network/TypeError details.
    const pricingStatus=page.locator('.punch-public-bento .ess-pricing-status');
    await pricingStatus.waitFor({state:'visible',timeout:15000});
    assert.match(await pricingStatus.textContent(),/Tarifs temporairement indisponibles/);
    const retry=page.locator('.punch-public-bento button[data-action="ess:retry-public"]');
    await retry.waitFor({state:'visible',timeout:10000});
    const retryRect=await retry.boundingBox();
    assert.ok(retryRect&&retryRect.width>=44&&retryRect.height>=44,'Retry must be a touch target');
    await retry.click();
    await page.waitForFunction(()=>document.querySelector('.punch-public-bento .ess-pricing-status')?.textContent.includes('Tarifs temporairement indisponibles'),null,{timeout:15000});
    assert.equal(await page.locator('.punch-public-bento .ess-price').count(),0,
     'No invented prices should be rendered without the real catalog');
    assert.doesNotMatch(await page.locator('.punch-public-bento .ess-pricing').innerText(),
     /TypeError|Failed to fetch|NetworkError/i,
     'Public pricing must not leak technical API errors');
    const essential=await measure(page);
    assert.equal(essential.tiles,3,'three Bento value cards on '+device);
    assert.equal(essential.iframes,0,'real markup without an iframe');
    assert.ok(essential.documentWidth<=width+2,'horizontal overflow on '+device+': '+JSON.stringify(essential));
    assert.ok(essential.targets.every(x=>x.width>=44&&x.height>=44),
     'edition switch and header targets must be at least 44px: '+JSON.stringify(essential.targets));
    await page.screenshot({path:path.join(output,'bento05-'+device+'-essential.png'),
     animations:'disabled',fullPage:true});

    // Change through real buttons; never fake a payment, account or plan price.
    await page.locator('.public-edition-tabs [data-id="construction"]').click();
    await page.locator('.punch-public-bento .plan-cards').waitFor({state:'visible',timeout:10000});
    assert.equal(await page.locator('.public-edition-tabs [data-id="construction"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.punch-public-bento .ess-pricing').count(),0,
     'Construction must not inherit Essentiel pricing');
    const construction=await measure(page);
    assert.ok(construction.documentWidth<=width+2,
     'Construction horizontal overflow '+device+': '+JSON.stringify(construction));
    assert.ok(construction.targets.every(x=>x.width>=44&&x.height>=44),
     'Construction header and edition actions must be touch accessible');
    await page.screenshot({path:path.join(output,'bento05-'+device+'-construction.png'),
     animations:'disabled',fullPage:true});
    await page.locator('.public-edition-tabs [data-id="essential"]').click();
    await page.locator('.punch-public-bento .ess-pricing').waitFor({state:'visible',timeout:10000});
    assert.equal(await page.locator('.public-edition-tabs [data-id="essential"]').getAttribute('aria-pressed'),'true');
    assert.deepEqual(pageErrors,[],'uncaught page errors on '+device);
    results.push({device,width,height,essential,construction,pageErrors,backToEssential:true});
    console.log('PUNCH BENTO '+device+': two editions, 44px, no overflow, screenshots PASS');
   }finally{await context.close()}
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,'bento05-five-viewports.json'),
  JSON.stringify({type:'Bento05 static-network responsive QA',viewports:results.length,
   screenshots:results.length*2,
   limitations:'External calls blocked. Real catalog prices, sign-in, payment and physical devices NOT VERIFIED.',
   results},null,2)+'\n');
})().catch(error=>{console.error('PUNCH BENTO FIVE VIEWPORTS FAILED',error);process.exitCode=1});
