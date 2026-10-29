// Super Admin audit visual verification with synthetic data only.
// Never authenticates, reads production audit data, or calls Supabase.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const output='visual-captures';fs.mkdirSync(output,{recursive:true});
const sizes=[['Small',320,640],['S25',412,915],['iPad',820,1180],['PC',1440,900]];
const result=[];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [device,width,height] of sizes){
   const page=await browser.newPage({viewport:{width,height},isMobile:width<768,
    hasTouch:width<900,deviceScaleFactor:1,serviceWorkers:'block'});
   const errors=[],external=[];
   page.on('pageerror',err=>errors.push(String(err.message).slice(0,180)));
   await page.route('**/*',route=>{
    let url;try{url=new URL(route.request().url())}catch{return route.abort('blockedbyclient')}
    if(url.hostname==='127.0.0.1'&&url.protocol==='http:'&&url.port==='8765')
     return route.continue();
    external.push(url.hostname);return route.abort('blockedbyclient');
   });
   try{
    await page.goto('http://127.0.0.1:8765/kiosk.html',{waitUntil:'domcontentloaded'});
    await page.setContent('<!doctype html><html lang="fr"><head><meta charset="utf-8">'+
     '<meta name="viewport" content="width=device-width, initial-scale=1">'+
     '<link rel="stylesheet" href="./essential.css"></head>'+
     '<body class="essential-management"><main id="audit-root"></main></body></html>');
    await page.evaluate(async()=>{
     const {createPlatformAuditController}=await import('./platform-audit.js');
     const root=document.querySelector('#audit-root');
     let deny=false;
     const calls=[];
     const rows=[{id:'00000000-0000-4000-8000-000000000001',
      action:'audit_event_synthetic',actor_id:'demo@example.invalid',
      entity_id:'TEST-COMPANY',created_at:'2026-10-28T14:00:00Z',
      detail:{reason:'Illustration fictive, aucun client réel'}}];
     const sb={rpc:async(name,args)=>{
      calls.push({name,args});
      return deny?{error:{code:'42501',message:'SECRET PROVIDER ERROR'}}:
       {data:rows,error:null};
     }};
     const escape=s=>String(s??'').replace(/[&<>"']/g,c=>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
     const ui=createPlatformAuditController({sb,redraw:()=>{root.innerHTML=ui.render()},
      escape,download:()=>{throw Error('No audit downloads during visual test')}});
     await ui.load();
     root.addEventListener('input',ev=>ui.input(ev.target));
     root.addEventListener('click',ev=>{const el=ev.target.closest('button');if(el)void ui.handle(el)});
     window.__auditFixture={ui,calls,deny:()=>{deny=true}};
    });
    const check=await page.evaluate(()=>{
     const buttons=[...document.querySelectorAll('button,input')].filter(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
     }).map(el=>{const r=el.getBoundingClientRect();
      return {name:el.getAttribute('data-action')||el.id,width:r.width,height:r.height}});
     return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      tooSmall:buttons.filter(b=>b.width<44||b.height<44),buttons};
    });
    if(check.documentWidth>check.width||check.tooSmall.length)
     throw Error(device+' audit responsive failure: '+JSON.stringify(check));
    if(!await page.getByText('audit_event_synthetic').count())
     throw Error('Synthetic audit list not shown');
    await page.screenshot({path:path.join(output,'platform-audit-synthetic-'+device+'.png'),
      animations:'disabled'});
    await page.evaluate(()=>window.__auditFixture.deny());
    await page.locator('[data-action="audit:search"]').click();
    await page.locator('[role="alert"]').waitFor({state:'visible',timeout:10000});
    const denied=await page.evaluate(()=>({
     count:window.__auditFixture.ui.state.rows.length,
     more:window.__auditFixture.ui.state.more,
     text:document.body.textContent,
     exportDisabled:document.querySelector('[data-action="audit:export"]')?.disabled
    }));
    if(denied.count!==0||denied.more||!denied.exportDisabled||
       denied.text.includes('demo@example.invalid')||
       denied.text.includes('TEST-COMPANY')||
       denied.text.includes('SECRET PROVIDER ERROR')||errors.length||external.length)
     throw Error(device+' did not clear audit access: '+JSON.stringify({denied,errors,external}));
    await page.screenshot({path:path.join(output,'platform-audit-denied-'+device+'.png'),
      animations:'disabled'});
    result.push({device,viewport:{width,height},controls:check.buttons.length,
      status:'synthetic list and access-revoked clear state',outsideRequests:0});
    console.log('Super Admin audit '+device+': list, MFA denial privacy, no overflow or tiny controls');
   }finally{await page.close()}
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,'platform-audit-synthetic.json'),JSON.stringify({
  viewports:result.length,result,limitations:'Mocked session only; real MFA and RLS not tested'
 },null,2)+'\n');
})().catch(err=>{console.error('PLATFORM AUDIT VISUAL FAILED:',err);process.exitCode=1});
