// Audits the actual unpaired kiosk DOM with no device token, credential or API call.
// Screenshots are evidence for manual review, not approved Figma baselines.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const output='visual-captures';
fs.mkdirSync(output,{recursive:true});
const devices=[['Small',320,640],['S25',412,915],['iPad',820,1180],['PC',1440,900]];
const results=[];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [device,width,height] of devices){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,
     isMobile:width<768,hasTouch:width<900,serviceWorkers:'block'});
   const errors=[];
   page.on('pageerror',err=>errors.push(String(err.message).slice(0,200)));
   await page.route('**/*',route=>{
    let u;try{u=new URL(route.request().url());}catch{return route.abort('blockedbyclient');}
    if(u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port==='8765')return route.continue();
    return route.abort('blockedbyclient');
   });
   try{
    const response=await page.goto('http://127.0.0.1:8765/kiosk.html',{waitUntil:'domcontentloaded'});
    if(!response?.ok())throw Error(device+': kiosk static page failed');
    await page.locator('#pairCode').waitFor({state:'visible',timeout:15000});
    await page.evaluate(()=>document.fonts.ready);
    const scan=await page.evaluate(()=>{
     const root=document.getElementById('kiosk');
     const controls=[...root.querySelectorAll('button,select,input,a[href],[role="button"]')]
       .filter(el=>{
         const r=el.getBoundingClientRect(),s=getComputedStyle(el);
         return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
       }).map(el=>{
         const r=el.getBoundingClientRect();
         return {tag:el.tagName.toLowerCase(),id:el.id||null,
           action:el.getAttribute('data-action')||null,
           width:Math.round(r.width),height:Math.round(r.height)};
       });
     const pair=root.querySelector('button[data-action="pair"]');
     const code=root.querySelector('#pairCode'),language=root.querySelector('#kiosk-language');
     let calls=0;
     const originalClick=pair.click;
     pair.click=()=>{calls++}; // Browser-only interception: NEVER submit a pairing code.
     const pairKey=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
     code.dispatchEvent(pairKey);
     const languageKey=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
     language.dispatchEvent(languageKey);
     pair.click=originalClick;
     return {
       viewportWidth:innerWidth,documentWidth:document.documentElement.scrollWidth,
       smallControls:controls.filter(x=>x.width<44||x.height<44),
       controls,keyboard:{pairClicks:calls,pairPrevented:pairKey.defaultPrevented,
         languagePrevented:languageKey.defaultPrevented},
       hasLocalStatus:!!root.querySelector('[role="status"]'),
       rootLiveRegion:root.hasAttribute('aria-live')
     };
    });
    if(scan.documentWidth>scan.viewportWidth||scan.smallControls.length||
       scan.keyboard.pairClicks!==1||!scan.keyboard.pairPrevented||
       scan.keyboard.languagePrevented||!scan.hasLocalStatus||scan.rootLiveRegion||errors.length)
     throw Error(device+': kiosk UX accessibility check failed: '+JSON.stringify({scan,errors}));
    await page.screenshot({path:path.join(output,'kiosk-unpaired-'+device+'.png'),
      animations:'disabled'});
    if(device==='iPad'){
      const select=page.locator('#kiosk-language');
      await select.focus();
      await select.selectOption('ar');
      if(await page.evaluate(()=>document.getElementById('kiosk').getAttribute('dir'))!=='rtl'||
         await page.evaluate(()=>document.documentElement.lang)!=='ar'||
         await page.evaluate(()=>document.activeElement?.id)!=='kiosk-language')
        throw Error('RTL language selection must preserve language selector focus');
      await page.screenshot({path:path.join(output,'kiosk-unpaired-iPad-RTL.png'),animations:'disabled'});
    }
    results.push({device,viewport:{width,height},...scan,
      screenshot:'kiosk-unpaired-'+device+'.png',
      scope:'Unpaired kiosk public UI; no camera, authenticated action, device or physical test'});
    console.log('Kiosk '+device+': '+scan.controls.length+' controls; zero tiny targets/overflow; Enter scoped');
   }finally{await page.close();}
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(output,'kiosk-public-audit.json'),
  JSON.stringify({screens:results.length,results,
    disclaimer:'Unpaired public kiosk only; real pointage and enrolled-device states NON VÉRIFIÉS'},null,2)+'\n');
 console.log('Verified unpaired kiosk viewports: '+results.length);
})().catch(err=>{console.error('KIOSK-UI-SMOKE FAILED:',err);process.exitCode=1});
