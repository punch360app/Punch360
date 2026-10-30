const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const output='visual-captures';fs.mkdirSync(output,{recursive:true});
const formats=[['Small',320,640],['S25',412,915],['iPad',820,1180],['PC',1440,900]];
const results=[];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [device,width,height] of formats){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,
    isMobile:width<720,hasTouch:width<900,acceptDownloads:true,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[],blocked=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**'+'/'+'*',route=>{
    const u=new URL(route.request().url());
    if(u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port==='8765')
     return route.continue();
    if(u.protocol==='https:'&&u.hostname==='atelier-projets-jf.juliensav.chatgpt.site'&&u.pathname.startsWith('/responsive/'))
     return route.continue();
    blocked.push(u.hostname);return route.abort();
   });
   try{
    const response=await page.goto('http://127.0.0.1:8765/annotations.html',{waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200);
    await page.locator('[data-punch-live-root]').first().waitFor({state:'attached',timeout:25000});
    await page.locator('[data-punch-live-root] [data-action="support:open"]').first().waitFor({state:'attached',timeout:15000});
    const structure=await page.evaluate(()=>{
     const root=document.querySelector('[data-punch-live-root]');
     const ancestors=[];let node=root;
     while(node&&ancestors.length<12){
      const style=getComputedStyle(node);
      ancestors.push({tag:node.tagName,className:String(node.className).slice(0,100),
       containerName:style.containerName,containerType:style.containerType});
      node=node.parentElement;
     }
     return {roots:document.querySelectorAll('[data-punch-live-root]').length,
      sameDocument:root?.ownerDocument===document,
      atelierSlot:!!root?.closest('.ap-device-content'),
      atelierFrame:!!root?.closest('.ap-device-frame'),
      punchContainer:ancestors[0]?.containerName==='punch-screen'&&ancestors[0]?.containerType==='inline-size',
      iframes:document.querySelectorAll('iframe').length,
      duplicateIds:(()=>{
       const ids=[...document.querySelectorAll('[data-punch-live-root] [id]')].map(el=>el.id);
       return ids.filter((id,index)=>ids.indexOf(id)!==index);
      })(),
      firstField:document.querySelector('[data-punch-live-root] [data-punch-original-id="support-subject"]')?.id,
      ancestors};
    });
    console.log('Atelier shared DOM containers',JSON.stringify(structure));
    assert.ok(structure.roots>=1,'Atelier callback must mount at least one Punch screen');
    assert.equal(structure.sameDocument,true);
    assert.equal(structure.iframes,0);
    assert.ok(structure.atelierSlot&&structure.atelierFrame,'Atelier must own real device slot and frame');
    assert.ok(structure.punchContainer,'Punch component container must follow actual slot dimensions');
    assert.deepEqual(structure.duplicateIds,[],'IDs must be unique across rendered Atelier device slots');
    assert.match(structure.firstField||'',/^punch-[a-z0-9-]+-support-support-subject$/);
    if(await page.locator('#review-toggle').isVisible())await page.locator('#review-toggle').click();
    await page.locator('[data-punch-live-root] [data-action="support:open"]:visible').first().click();
    await page.getByText('Comment déplacer un quart dans le calendrier ?').first().waitFor({state:'visible',timeout:12000});
    await page.screenshot({path:path.join(output,'atelier-responsive-'+device+'.png'),animations:'disabled'});
    await page.locator('#punch-review-reopen').click();
    await page.locator('#annotate-mode').click();
    // Collapse the side panel to access the actual Punch controls on small screens.
    await page.locator('#review-toggle').click();
    await page.locator('[data-punch-live-root] [data-action="support:refresh"]:visible').first().click();
    await page.locator('#punch-review-reopen').click();
    await page.locator('#punch-note-form').waitFor({state:'visible',timeout:10000});
    await page.locator('#punch-note-text').fill('Déplacer le bouton Actualiser et harmoniser son espacement');
    await page.locator('#punch-note-save').click();
    await page.getByText('Déplacer le bouton Actualiser et harmoniser son espacement').first().waitFor({state:'visible'});
    await page.waitForFunction(()=>document.querySelectorAll('.punch-annotation-pin').length>=1,null,{timeout:7000});
    await page.screenshot({path:path.join(output,'atelier-annotations-'+device+'.png'),animations:'disabled'});
    const dlPromise=page.waitForEvent('download');
    await page.locator('#review-export').click();
    const download=await dlPromise;
    const payload=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
    assert.equal(payload.format,'punch360-live-annotations');
    assert.equal(payload.projectId,'punch360-12fb1917-94ea-481d-b131-16c58a5bf010');
    assert.equal(payload.notes.length,1);
    assert.equal(payload.notes[0].screen,'support');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('[data-punch-live-root] [data-action="support:open"]').first().waitFor({state:'attached',timeout:25000});
    if(await page.locator('#punch-review-reopen').isVisible())await page.locator('#punch-review-reopen').click();
    await page.getByText('Déplacer le bouton Actualiser et harmoniser son espacement').first().waitFor({state:'visible'});
    await page.locator('#test-mode').click();
    await page.locator('#punch-screen-select').selectOption('directory');
    await page.locator('[data-punch-live-root] [data-action="directory:detail"]').first().waitFor({state:'attached',timeout:12000});
    await page.locator('#punch-screen-select').selectOption('audit');
    await page.locator('[data-punch-live-root] [data-action="audit:search"]').first().waitFor({state:'attached',timeout:12000});
    const layout=await page.evaluate(()=>({
      width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      projectElement:document.querySelectorAll('[data-punch-live-root]').length
    }));
    assert.ok(layout.documentWidth<=layout.width+2,
     'horizontal viewport overflow on '+device+': '+JSON.stringify(layout));
    assert.deepEqual(errors,[],'script errors on '+device);
    assert.ok(!blocked.some(x=>/supabase/i.test(x)),'live Supabase must not be queried');
    results.push({device,viewport:{width,height},sameDocument:true,realInteraction:true,
      elementAnnotation:true,localPersistence:true,export:true,noOverflow:true});
    console.log('Atelier shared responsive '+device+': live Punch DOM, interaction, annotation, export, reload PASS');
   }finally{await context.close()}
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,'atelier-responsive-review.json'),
  JSON.stringify({viewports:results.length,results,limitations:'Synthetic project data; physical devices and real Auth NOT VERIFIED'},null,2)+'\n');
})().catch(err=>{console.error('ATELIER RESPONSIVE REVIEW FAILED',err);process.exitCode=1});
