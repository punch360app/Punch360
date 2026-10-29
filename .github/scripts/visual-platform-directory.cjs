// Audits real Super Admin company directory UI with synthetic records only.
// No authenticated session, no backend request and no production company information.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const output='visual-captures';fs.mkdirSync(output,{recursive:true});
const formats=[['Small',320,640],['S25',412,915],['iPad',820,1180],['PC',1440,900]];
const results=[];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [device,width,height] of formats){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,
    isMobile:width<768,hasTouch:width<900,serviceWorkers:'block'});
   const errors=[],external=[];
   page.on('pageerror',error=>errors.push(String(error.message).slice(0,180)));
   await page.route('**/*',route=>{
    let u;try{u=new URL(route.request().url())}catch{return route.abort('blockedbyclient')}
    if(u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port==='8765')
     return route.continue();
    external.push(u.hostname);return route.abort('blockedbyclient');
   });
   try{
    await page.goto('http://127.0.0.1:8765/kiosk.html',{waitUntil:'domcontentloaded'});
    await page.setContent('<!doctype html><html lang="fr"><head><meta charset="utf-8">'+
     '<meta name="viewport" content="width=device-width, initial-scale=1">'+
     '<link rel="stylesheet" href="./essential.css">'+
     '<link rel="stylesheet" href="./platform-directory.css?v=directory-1"></head>'+
     '<body class="essential-management"><main id="directory-root"></main></body></html>');
    await page.evaluate(async()=>{
     const {createPlatformDirectoryController}=await import('./platform-directory.js');
     const root=document.querySelector('#directory-root');
     const fixture={id:'00000000-0000-4000-8000-000000000008',name:'Entreprise de démonstration',
      product_edition:'essential',billing_status:'active',seat_limit:5,is_test:false,
      entitlement:{features:[]},active_members:2,disabled_members:0,
      active_workers:2,workers_without_account:0,
      service_controls:{version:2,grace_days:null,suspended:false}};
     let denied=false;const calls=[];
     const sb={rpc:async(name,args)=>{
      calls.push({name,args});
      if(denied)return {error:{code:'42501',message:'PRIVATE_SQL_DIAGNOSTIC'}};
      if(name==='platform_search_companies')return {data:{items:[fixture],has_more:false}};
      if(name==='platform_company_detail')return {data:fixture};
      throw Error('Unexpected production-like request '+name);
     }};
     const escape=value=>String(value??'').replace(/[&<>"']/g,c=>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
     const ui=createPlatformDirectoryController({sb,escape,redraw:()=>{root.innerHTML=ui.render()},
      onArchives:()=>{throw Error('No navigation in fixture')},
      onPriceCompany:()=>{throw Error('No prices in fixture')}});
     await ui.load();
     root.addEventListener('input',event=>ui.input(event.target));
     root.addEventListener('change',event=>ui.input(event.target));
     root.addEventListener('click',event=>{
      const el=event.target.closest('button');if(el)void ui.handle(el);
     });
     window.__companyFixture={ui,calls,deny:()=>{denied=true}};
    });
    const check=await page.evaluate(()=>{
     const controls=[...document.querySelectorAll('button,input,select')].filter(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
     }).map(el=>{const r=el.getBoundingClientRect();
      return {name:el.dataset.action||el.id||el.tagName.toLowerCase(),
       width:Math.round(r.width),height:Math.round(r.height)}});
     return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      small:controls.filter(x=>x.width<44||x.height<44),controls};
    });
    if(check.documentWidth>check.width||check.small.length||errors.length||external.length)
     throw Error(device+': directory initial layout '+JSON.stringify({check,errors,external}));
    await page.locator('[data-action="directory:detail"]').waitFor({state:'visible'});
    await page.screenshot({path:path.join(output,'platform-directory-synthetic-'+device+'.png'),
     animations:'disabled'});
    await page.locator('#directory-reason').fill('Consultation de support synthétique');
    await page.locator('[data-action="directory:detail"]').click();
    await page.getByText('2 membres avec compte actifs').waitFor({state:'visible',timeout:10000});
    const detail=await page.evaluate(()=>({
     width:innerWidth,documentWidth:document.documentElement.scrollWidth,
     profile:!!document.querySelector('.platform-directory details'),
     company:document.body.textContent.includes('Entreprise de démonstration')
    }));
    if(detail.documentWidth>detail.width||!detail.profile||!detail.company)
     throw Error(device+': company profile layout failed: '+JSON.stringify(detail));
    await page.screenshot({path:path.join(output,'platform-directory-profile-'+device+'.png'),
     animations:'disabled'});
    await page.evaluate(()=>window.__companyFixture.deny());
    await page.locator('[data-action="directory:search"]').click();
    await page.locator('[role="alert"]').waitFor({state:'visible',timeout:10000});
    const revoked=await page.evaluate(()=>({
     count:window.__companyFixture.ui.state.items.length,
     profile:window.__companyFixture.ui.state.detail,
     text:document.body.textContent,
     hasArchiveButton:!!document.querySelector('[data-action="directory:archives"]'),
     next:window.__companyFixture.ui.state.next
    }));
    if(revoked.count||revoked.profile!==null||revoked.next!==null||
      revoked.hasArchiveButton||revoked.text.includes('Entreprise de démonstration')||
      revoked.text.includes('PRIVATE_SQL_DIAGNOSTIC')||
      !revoked.text.includes('Reconnectez-vous avec MFA')||errors.length||external.length)
     throw Error(device+': directory did not fail closed: '+JSON.stringify({revoked,errors,external}));
    await page.screenshot({path:path.join(output,'platform-directory-denied-'+device+'.png'),
     animations:'disabled'});
    results.push({device,viewport:{width,height},controls:check.controls.length,
     profile:detail.profile,denialCleared:true,externalRequests:0});
    console.log('Super Admin company directory '+device+
      ': list/profile/permission refusal, zero overflow and small controls');
   }finally{await page.close()}
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,'platform-directory-synthetic.json'),
  JSON.stringify({screens:results.length,results,
   limitation:'Synthetic frontend only; no real MFA, company permissions, service change or physical device tested'},null,2)+'\n');
})().catch(error=>{console.error('DIRECTORY VISUAL FAILED:',error);process.exitCode=1});
