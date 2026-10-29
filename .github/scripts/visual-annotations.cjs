
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const output='visual-captures';
fs.mkdirSync(output,{recursive:true});
const viewports=[['Small',320,640],['S25',412,915],['iPad',820,1180],['PC',1440,900]],results=[];
function sample(){
 const png=new PNG({width:400,height:720});
 for(let i=0;i<png.data.length;i+=4){png.data[i]=230;png.data[i+1]=239;png.data[i+2]=224;png.data[i+3]=255}
 return PNG.sync.write(png);
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [device,width,height] of viewports){
   const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<720,hasTouch:width<900,acceptDownloads:true,serviceWorkers:'block'});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**'+'/'+'*',route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='127.0.0.1'&&u.port==='8765')return route.continue();
    return route.abort();
   });
   try{
    const response=await page.goto('http://127.0.0.1:8765/annotations.html',{waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200);
    await page.locator('#page-title').waitFor({state:'visible'});
    const initial=await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth}));
    assert.ok(initial.doc<=initial.width,'dashboard must fit '+device);
    await page.screenshot({path:path.join(output,'annotations-dashboard-'+device+'.png'),animations:'disabled'});
    await page.locator('#new-capture-top').click();
    await page.locator('#capture-name').fill('Écran test '+device);
    await page.locator('#capture-device').selectOption(width<720?'mobile':width<1000?'tablet':'desktop');
    await page.locator('#capture-file').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:sample()});
    await page.locator('#create-screen').click();
    await page.locator('#selected-title').waitFor({state:'visible'});
    assert.equal(await page.locator('#selected-title').textContent(),'Écran test '+device);
    await page.locator('.image-frame svg').click({position:{x:30,y:80}});
    await page.locator('#note-text').fill('Réduire le bouton et vérifier le responsive');
    await page.locator('#save-note').click();
    await page.getByText('Réduire le bouton et vérifier le responsive').waitFor();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('[data-tab="reviews"]').first().click();
    await page.getByText('Réduire le bouton et vérifier le responsive').waitFor();
    assert.equal(await page.locator('.note-card').count(),1,'note must survive IndexedDB reload');
    await page.locator('#add-after').click();
    await page.locator('#after-file').setInputFiles({name:'after.png',mimeType:'image/png',buffer:sample()});
    await page.locator('.compare-layout').waitFor({state:'visible'});
    assert.equal(await page.locator('.compare-layout .image-frame img').count(),2);
    await page.screenshot({path:path.join(output,'annotations-editor-'+device+'.png'),animations:'disabled'});
    await page.locator('[data-view="before"]').click();
    await page.locator('[data-tool="rect"]').click();
    const box=await page.locator('.image-frame svg').boundingBox();
    assert.ok(box&&box.width>50);
    await page.mouse.move(box.x+box.width*.23,box.y+box.height*.25);
    await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5,{steps:5});await page.mouse.up();
    await page.locator('#note-text').fill('Encadrer cette zone et harmoniser les espacements');
    await page.locator('#save-note').click();
    assert.equal(await page.locator('.note-card').count(),2);
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#export-button').click();
    const download=await downloadPromise;
    assert.match(download.suggestedFilename(),/^punch360-revue-\d{4}-\d\d-\d\d\.json$/);
    const payload=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
    assert.equal(payload.format,'punch360-annotation-review');
    assert.equal(payload.screens[0].notes.length,2);
    assert.ok(payload.screens[0].before.data.startsWith('data:image/png;base64,'));
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#import-file').setInputFiles({name:'revue.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
    await page.waitForFunction(()=>document.getElementById('metric-captures').textContent==='2',null,{timeout:10000});
    const final=await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth,count:document.querySelectorAll('.note-card').length}));
    assert.ok(final.doc<=final.width,'editor horizontal overflow on '+device+': '+JSON.stringify(final));
    assert.deepEqual(errors,[],'browser errors: '+device);
    results.push({device,viewport:{width,height},notes:2,localPersistence:'pass',compare:'pass',exportImport:'pass',noOverflow:true});
    console.log('Visual annotations '+device+': add/draw/save/reload/compare/export/import PASS');
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,'annotations-dashboard-audit.json'),JSON.stringify({screens:results.length,results,limitations:'Synthetic screenshot only; real customer data or private Atelier synchronization NOT TESTED'},null,2));
})().catch(err=>{console.error('VISUAL ANNOTATIONS FAILED',err);process.exitCode=1});
