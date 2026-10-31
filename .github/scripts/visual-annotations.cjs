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
    if(await page.locator('#punch-review-reopen').isVisible())await page.locator('#punch-review-reopen').click();
    await page.locator('#punch-note-form').waitFor({state:'visible',timeout:10000});
    await page.locator('#punch-note-text').fill('Déplacer le bouton Actualiser et harmoniser son espacement');
    await page.locator('#punch-note-save').click();
    await page.getByText('Déplacer le bouton Actualiser et harmoniser son espacement').first().waitFor({state:'visible'});
    await page.locator('#punch-note-form').waitFor({state:'hidden',timeout:7000});
    await page.waitForFunction(()=>document.querySelectorAll('.punch-annotation-pin').length>=1,null,{timeout:7000});
    await page.screenshot({path:path.join(output,'atelier-annotations-'+device+'.png'),animations:'disabled'});

    // A free pin must work over any visible content, not only input or button.
    await page.locator('#annotate-pin').click();
    await page.locator('#review-toggle').click();
    const layer=page.locator('[data-punch-live-root]:visible').first().locator('[data-punch-annotation-layer]');
    await layer.waitFor({state:'visible'});
    const layerBox=await layer.boundingBox();
    assert.ok(layerBox&&layerBox.width>100&&layerBox.height>100);
    const tap={x:Math.min(layerBox.width*.35,120),y:Math.min(layerBox.height*.20,110)};
    if(width<900)await layer.tap({position:tap,timeout:15000});
    else await layer.click({position:tap,timeout:15000});
    await page.locator('#punch-note-form').waitFor({state:'visible'});
    await page.waitForFunction(()=>document.getElementById('punch-note-target')?.textContent?.includes('Punaise'),null,{timeout:5000});
    console.log('PUNCH PIN BEFORE SAVE',JSON.stringify(await page.evaluate(()=>({
     target:document.getElementById('punch-note-target')?.textContent,
     active:document.getElementById('annotate-pin')?.getAttribute('aria-pressed'),
     markers:[...document.querySelectorAll('[data-punch-annotation-kind]')].map(x=>x.dataset.punchAnnotationKind),
     formHidden:document.getElementById('punch-note-form')?.classList.contains('hidden')
    }))));
    assert.match(await page.locator('#punch-note-target').textContent(),/Punaise/,
      'A free tap must open a positional annotation, not the previous element form');
    await page.locator('#punch-note-text').fill('Punaise libre sur le texte, pas un bouton');
    await page.locator('#punch-note-save').click();
    const pinState=await page.evaluate(()=>{
     const key='punch360-12fb1917-94ea-481d-b131-16c58a5bf010:live-annotations:v1';
     const saved=JSON.parse(localStorage.getItem(key)||'[]');
     return {notes:saved.map(n=>({kind:n.kind,slot:n.slot,screen:n.screen,geometry:n.geometry})),
      layers:[...document.querySelectorAll('[data-punch-annotation-layer]')].map(layer=>({
       slot:layer.closest('[data-punch-live-root]')?.dataset.punchSlot,
       children:layer.children.length,content:layer.innerHTML.slice(0,300),
       className:layer.className
      })),pinCount:document.querySelectorAll('[data-punch-annotation-kind="pin"]').length};
    });
    console.log('PUNCH PIN STATE',JSON.stringify(pinState));
    assert.ok(pinState.pinCount>=1,'Free pin marker missing: '+JSON.stringify(pinState));

    await page.locator('#annotate-zone').click();
    await page.locator('#review-toggle').click();
    const rectLayer=page.locator('[data-punch-live-root]:visible').first().locator('[data-punch-annotation-layer]');
    await rectLayer.scrollIntoViewIfNeeded();
    const region=await rectLayer.boundingBox();
    console.log('PUNCH RECTANGLE PREVIEW BOUNDS',JSON.stringify(region));
    assert.ok(region&&region.width>30&&region.height>35,'Responsive previews can be miniaturized inside Atelier frames');
    const sx=region.x+Math.min(region.width*.18,65);
    const sy=region.y+Math.min(region.height*.18,75);
    const ex=sx+Math.min(region.width*.28,110);
    const ey=sy+Math.min(region.height*.19,90);
    await page.mouse.move(sx,sy);
    await page.mouse.down();
    await page.mouse.move(ex,ey,{steps:7});
    await page.mouse.up();
    await page.locator('#punch-note-form').waitFor({state:'visible',timeout:10000});
    await page.locator('#punch-note-text').fill('Rectangle autour de toute cette section');
    await page.locator('#punch-note-save').click();
    assert.ok(await page.locator('[data-punch-annotation-kind="rect"]').count()>=1);
    await page.screenshot({path:path.join(output,'atelier-free-pin-rectangle-'+device+'.png'),animations:'disabled'});

    const dlPromise=page.waitForEvent('download');
    await page.locator('#review-export').click();
    const download=await dlPromise;
    const payload=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
    assert.equal(payload.format,'punch360-live-annotations');
    assert.equal(payload.projectId,'punch360-12fb1917-94ea-481d-b131-16c58a5bf010');
    assert.equal(payload.version,2);
    assert.equal(payload.coordinateSpace,'screen-content-relative-v1');
    assert.equal(payload.notes.length,3);
    assert.equal(payload.notes[0].screen,'support');
    assert.equal(payload.notes[0].kind,'element');
    const free=payload.notes.find(n=>n.kind==='pin');
    const rect=payload.notes.find(n=>n.kind==='rect');
    assert.ok(free&&rect,'free pin and rectangle should be present in JSON');
    assert.equal(free.selector,'');
    assert.equal(free.coordinateSpace,'screen-content-relative-v1');
    assert.ok(free.geometry.x>0&&free.geometry.x<1&&free.geometry.y>0&&free.geometry.y<1);
    assert.ok(rect.geometry.width>.05&&rect.geometry.height>.05);
    assert.ok(rect.geometry.x+rect.geometry.width<=1.000002);
    assert.ok(free.sourceSize.width>100&&free.sourceSize.height>100);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('[data-punch-live-root] [data-action="support:open"]').first().waitFor({state:'attached',timeout:25000});
    if(await page.locator('#punch-review-reopen').isVisible())await page.locator('#punch-review-reopen').click();
    await page.getByText('Déplacer le bouton Actualiser et harmoniser son espacement').first().waitFor({state:'visible'});
    await page.getByText('Punaise libre sur le texte, pas un bouton').first().waitFor({state:'visible'});
    assert.ok(await page.locator('[data-punch-annotation-kind="pin"]').count()>=1);
    assert.ok(await page.locator('[data-punch-annotation-kind="rect"]').count()>=1);
    const marker=await page.locator('[data-punch-annotation-kind="pin"]').first().evaluate(node=>({
     x:parseFloat(node.style.left)/100,y:parseFloat(node.style.top)/100
    }));
    assert.ok(Math.abs(marker.x-free.geometry.x)<0.00001);
    assert.ok(Math.abs(marker.y-free.geometry.y)<0.00001);
    await page.locator('#test-mode').click();
    await page.locator('#punch-screen-select').selectOption('directory');
    await page.locator('[data-punch-live-root] [data-action="directory:detail"]').first().waitFor({state:'attached',timeout:12000});
    await page.locator('#punch-screen-select').selectOption('audit');
    await page.locator('[data-punch-live-root] [data-action="audit:search"]').first().waitFor({state:'attached',timeout:12000});
    // Check the actual shared public welcome fragments mounted inside Atelier's
    // same-document slots. No real login or dynamic pricing API may be called.
    await page.locator('#punch-screen-select').selectOption('client');
    await page.locator('[data-punch-live-root] [data-punch-client-page]').first().waitFor({state:'attached',timeout:12000});
    if(await page.locator('#review-toggle').isVisible())await page.locator('#review-toggle').click();
    const client=page.locator('[data-punch-live-root]:visible').first();
    assert.match(await client.textContent(),/Vos chantiers/);
    await client.locator('[data-action="chooseEdition"][data-id="essential"]').click();
    assert.match(await client.textContent(),/Vos heures/);
    assert.ok(await client.evaluate(el=>el.classList.contains('punch-client-essential')));
    await page.screenshot({path:path.join(output,'atelier-real-client-'+device+'.png'),animations:'disabled'});
    await client.locator('[data-action="continueSignup"]').click();
    assert.match(await client.textContent(),/Aucun compte ni paiement/);
    await client.locator('[data-action="authBack"]').last().click();
    assert.match(await client.textContent(),/Vos heures/);
    assert.equal(await page.locator('iframe').count(),0);
    const layout=await page.evaluate(()=>({
      width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      projectElement:document.querySelectorAll('[data-punch-live-root]').length
    }));
    assert.ok(layout.documentWidth<=layout.width+2,
     'horizontal viewport overflow on '+device+': '+JSON.stringify(layout));
    assert.deepEqual(errors,[],'script errors on '+device);
    assert.ok(!blocked.some(x=>/supabase/i.test(x)),'live Supabase must not be queried');
    results.push({device,viewport:{width,height},sameDocument:true,realInteraction:true,
      elementAnnotation:true,freePin:true,dragRectangle:true,relativeCoordinates:true,
      localPersistence:true,export:true,publicClientPreview:true,noOverflow:true});
    console.log('Atelier shared responsive '+device+': live Punch DOM, interaction, annotation, export, reload PASS');
   }finally{await context.close()}
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,'atelier-responsive-review.json'),
  JSON.stringify({viewports:results.length,results,limitations:'Synthetic project data; physical devices and real Auth NOT VERIFIED'},null,2)+'\n');
})().catch(err=>{console.error('ATELIER RESPONSIVE REVIEW FAILED',err);process.exitCode=1});
