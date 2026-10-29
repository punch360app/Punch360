// Browser QA for the actual Boss/Admin review controller, using ONLY synthetic data.
// No Auth session, no Supabase request, no real punch or employee information.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const dir='visual-captures';fs.mkdirSync(dir,{recursive:true});
const sizes=[['Small',320,640],['S25',412,915],['iPad',820,1180],['PC',1440,900]];
const results=[];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [device,width,height] of sizes){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:width<768,
    hasTouch:width<900,serviceWorkers:'block'});
   const errors=[],external=[];
   page.on('pageerror',error=>errors.push(String(error.message).slice(0,180)));
   await page.route('**/*',route=>{
    let url;try{url=new URL(route.request().url())}catch{return route.abort('blockedbyclient')}
    if(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port==='8765')return route.continue();
    external.push(url.hostname);return route.abort('blockedbyclient');
   });
   try{
    const response=await page.goto('http://127.0.0.1:8765/kiosk-offline-review.css?v=review-1',
     {waitUntil:'domcontentloaded'});
    if(!response?.ok())throw Error('Cannot establish local browser origin');
    await page.setContent('<!doctype html><html lang="fr"><head><meta charset="utf-8">'+
     '<meta name="viewport" content="width=device-width, initial-scale=1">'+
     '<link rel="stylesheet" href="./essential.css">'+
     '<link rel="stylesheet" href="./kiosk-offline-review.css?v=review-1"></head>'+
     '<body class="essential-management"><main id="review-root"></main></body></html>');
    await page.evaluate(async()=>{
     const [{createOfflineReviewController},{createEssentialLocale}]=await Promise.all([
      import('./kiosk-offline-review.js'),import('./essential-locale.js')
     ]);
     const locale=createEssentialLocale();
     const escape=value=>String(value??'').replace(/[&<>"']/g,c=>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
     let rows=[{id:'synthetic-lot-1',worker:'Alex de test',device:'Borne de démonstration',
      closed_at:null,events:[
       {id:'a',at:'2026-10-26T12:30:00Z',action:'in',state:'pending'},
       {id:'b',at:'2026-10-26T13:00:00Z',action:'break_end',state:'conflict'}
      ]}];
     const calls=[];
     const sb={rpc:async(name,args)=>{
      calls.push({name,args});
      if(name==='list_kiosk_offline')return {data:rows,error:null};
      if(name==='review_kiosk_offline'){
       rows=rows.map(x=>x.id===args.p_grant?{...x,closed_at:'2026-10-29T00:00:00Z'}:x);
       return {data:{ok:true},error:null};
      }
      throw Error('Unexpected synthetic RPC '+name);
     }};
     const root=document.getElementById('review-root');
     const ctrl=createOfflineReviewController({sb,escape,getLocale:()=>locale.code,
      redraw:()=>{root.innerHTML=ctrl.render()}});
     await ctrl.load('synthetic-company');
     ctrl.input({id:'offreview-note',value:'Vérifié avec le quart synthétique'});
     root.innerHTML=ctrl.render();
     root.addEventListener('click',ev=>{
      const button=ev.target.closest('button');
      if(button)void ctrl.handle(button);
     });
     root.addEventListener('input',ev=>ctrl.input(ev.target));
     window.__reviewHarness={ctrl,calls,locale};
    });
    const metrics=await page.evaluate(()=>{
     const controls=[...document.querySelectorAll('button,input,select')].filter(el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
     }).map(el=>{const r=el.getBoundingClientRect();
      return {action:el.getAttribute('data-action')||null,
       width:Math.round(r.width),height:Math.round(r.height)}});
     return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      controls,small:controls.filter(x=>x.width<44||x.height<44).length};
    });
    if(metrics.documentWidth>metrics.width||metrics.small||errors.length||external.length)
     throw Error('Review viewport failed '+device+': '+JSON.stringify({metrics,errors,external}));
    await page.screenshot({path:path.join(dir,'review-synthetic-initial-'+device+'.png'),animations:'disabled'});
    await page.locator('[data-action="offreview:approve"]').click();
    await page.locator('[data-action="offreview:confirm"]').waitFor({state:'visible'});
    const first=await page.evaluate(()=>window.__reviewHarness.calls
     .filter(x=>x.name==='review_kiosk_offline').length);
    if(first!==0)throw Error('First click MUST NOT mutate provisional hours');
    await page.screenshot({path:path.join(dir,'review-synthetic-confirm-'+device+'.png'),animations:'disabled'});
    await page.locator('[data-action="offreview:cancel"]').click();
    if(await page.locator('[data-action="offreview:confirm"]').count())
     throw Error('Cancel did not clear proposed decision');
    await page.locator('[data-action="offreview:approve"]').click();
    await page.locator('[data-action="offreview:confirm"]').click();
    await page.waitForFunction(()=>window.__reviewHarness.calls
     .filter(x=>x.name==='review_kiosk_offline').length===1,{},{timeout:10000});
    await page.waitForFunction(()=>!document.querySelector('[data-action="offreview:confirm"]'),
     null,{timeout:10000});
    const confirmed=await page.evaluate(()=>{
     const c=window.__reviewHarness.calls.filter(x=>x.name==='review_kiosk_offline');
     return {count:c.length,decision:c[0]?.args?.p_approve===true,
      reason:c[0]?.args?.p_note==='Vérifié avec le quart synthétique'};
    });
    if(confirmed.count!==1||!confirmed.decision||!confirmed.reason||errors.length||external.length)
     throw Error('Single confirmed decision expected '+device+': '+JSON.stringify({confirmed,errors,external}));
    results.push({device,viewport:{width,height},metrics,confirmation:confirmed,
     scope:'synthetic DOM only; no real manager session or RPC'});
    console.log('Manager review '+device+': two-step decision, cancel, single confirmation and no overflow');
   }finally{await page.close()}
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(dir,'offline-review-synthetic-audit.json'),JSON.stringify({
  viewports:results.length,results,
  limitations:'Mocked list and decision RPC; no authentic tenant, permissions, pay, or device tested'
 },null,2)+'\n');
})().catch(error=>{console.error('OFFLINE REVIEW VISUAL FAILED:',error);process.exitCode=1});
