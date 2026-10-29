// Synthetic, isolated browser QA of actual Support PUNCH Web screens.
// No Auth session, vendor network, real ticket, or private customer message.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const dir='visual-captures';fs.mkdirSync(dir,{recursive:true});
const formats=[['Small',320,640],['S25',412,915],['iPad',820,1180],['PC',1440,900]];
const reports=[];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [device,width,height] of formats){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,
    isMobile:width<768,hasTouch:width<900,serviceWorkers:'block'});
   const errors=[],external=[];
   page.on('pageerror',err=>errors.push(String(err.message).slice(0,160)));
   await page.route('**/*',route=>{
    let url;try{url=new URL(route.request().url())}catch{return route.abort('blockedbyclient')}
    if(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port==='8765')
     return route.continue();
    external.push(url.hostname);return route.abort('blockedbyclient');
   });
   try{
    await page.goto('http://127.0.0.1:8765/kiosk.html',{waitUntil:'domcontentloaded'});
    await page.setContent('<!doctype html><html lang="fr"><head><meta charset="utf-8">'+
     '<meta name="viewport" content="width=device-width, initial-scale=1">'+
     '<link rel="stylesheet" href="./essential.css">'+
     '<link rel="stylesheet" href="./support.css?v=support-1"></head>'+
     '<body class="essential-management"><main id="support-root"></main></body></html>');
    await page.evaluate(async()=>{
     const {createSupportController}=await import('./support.js');
     const root=document.getElementById('support-root');
     const ticket={id:'ticket-test',subject:'Question de démonstration',status:'open',
      updated_at:'2026-10-28T16:00:00Z',version:1};
     const detail={...ticket,messages:[{id:'message-test',body:'Réponse fictive, sans renseignement client',
      is_platform:false,created_at:'2026-10-28T16:01:00Z'}]};
     let refused=false;const calls=[];
     const sb={rpc:async(name,args)=>{
      calls.push({name,args});
      if(refused)return {error:{code:'42501',message:'PRIVATE_SUPABASE_DIAGNOSTIC'}};
      if(name==='support_list_tickets')return {data:[ticket]};
      if(name==='support_ticket_detail')return {data:detail};
      throw Error('No support write allowed by synthetic test');
     }};
     const escape=value=>String(value??'').replace(/[&<>"']/g,c=>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
     const controller=createSupportController({sb,escape,redraw:()=>{root.innerHTML=controller.render()},
      crypto:{randomUUID:()=>{throw Error('No mutation in a visual test')}}});
     await controller.load('synthetic-company');
     root.addEventListener('input',ev=>controller.input(ev.target));
     root.addEventListener('click',ev=>{
      const button=ev.target.closest('button');if(button)void controller.handle(button);
     });
     window.__supportFixture={controller,calls,refuse:()=>{refused=true}};
    });
    const sizes=await page.evaluate(()=>{
     const controls=[...document.querySelectorAll('button,input,textarea')].filter(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
     }).map(el=>{const r=el.getBoundingClientRect();
      return {action:el.dataset.action||el.id,width:Math.round(r.width),height:Math.round(r.height)}});
     return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      controls,small:controls.filter(x=>x.width<44||x.height<44)};
    });
    if(sizes.documentWidth>sizes.width||sizes.small.length||errors.length||external.length)
     throw Error(device+': support viewport failed: '+JSON.stringify({sizes,errors,external}));
    await page.screenshot({path:path.join(dir,'support-synthetic-list-'+device+'.png'),
     animations:'disabled'});
    await page.locator('[data-action="support:open"]').click();
    await page.getByText('Réponse fictive, sans renseignement client').waitFor({state:'visible'});
    const detail=await page.evaluate(()=>({
     horizontalOverflow:document.documentElement.scrollWidth>innerWidth,
     hasMessage:document.body.textContent.includes('Réponse fictive')
    }));
    if(detail.horizontalOverflow||!detail.hasMessage)
     throw Error(device+': support thread failed: '+JSON.stringify(detail));
    await page.screenshot({path:path.join(dir,'support-synthetic-thread-'+device+'.png'),
     animations:'disabled'});
    await page.evaluate(()=>window.__supportFixture.refuse());
    await page.locator('[data-action="support:refresh"]').click();
    await page.locator('[role="alert"]').waitFor({state:'visible',timeout:10000});
    const removed=await page.evaluate(()=>({
     count:window.__supportFixture.controller.state.tickets.length,
     detail:window.__supportFixture.controller.state.detail,
     text:document.body.textContent,
     hasOpen:!!document.querySelector('[data-action="support:open"]')
    }));
    if(removed.count||removed.detail!==null||removed.hasOpen||
       removed.text.includes('PRIVATE_SUPABASE_DIAGNOSTIC')||
       removed.text.includes('Réponse fictive')||
       removed.text.includes('Question de démonstration')||
       !removed.text.includes('Reconnectez-vous')||errors.length||external.length)
     throw Error(device+': support failed to clear revoked access: '+
      JSON.stringify({removed,errors,external}));
    await page.screenshot({path:path.join(dir,'support-synthetic-denied-'+device+'.png'),
     animations:'disabled'});
    console.log('PUNCH Support '+device+': list, thread and revoked session; zero overflow or small controls');
    reports.push({device,viewport:{width,height},controls:sizes.controls.length,
     threadRendered:detail.hasMessage,denialCleared:true});
   }finally{await page.close()}
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(dir,'support-synthetic-audit.json'),
  JSON.stringify({viewports:reports.length,reports,
   limitation:'Browser fixtures only; real customer Auth, replies, server RLS and physical devices NOT VERIFIED'},null,2)+'\n');
})().catch(error=>{console.error('SUPPORT VISUAL FAILED:',error);process.exitCode=1});
