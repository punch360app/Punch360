// True kiosk rendering with a strictly synthetic, local IndexedDB device.
// Never submits credentials, calls Supabase, or claims a real paired-device test.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const output='visual-captures';
fs.mkdirSync(output,{recursive:true});
const devices=[['Small',320,640],['S25',412,915],['iPad',820,1180],['PC',1440,900]];
const results=[];
async function syntheticPair(page){
 await page.evaluate(()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('punch-essential-kiosk',1);
  request.onupgradeneeded=()=>{
   if(!request.result.objectStoreNames.contains('device'))
    request.result.createObjectStore('device');
  };
  request.onerror=()=>reject(Error('Cannot initialize synthetic IndexedDB device'));
  request.onsuccess=()=>{
   const db=request.result;
   const tx=db.transaction('device','readwrite');
   tx.objectStore('device').put({
     device_id:'00000000-0000-4000-8000-000000000000',
     token:'LOCAL-SYNTHETIC-NOT-A-REAL-DEVICE-TOKEN',
     company_name:'Compagnie fictive',name:'Borne de démonstration',
     idle_seconds:120
   },'paired');
   tx.oncomplete=()=>{db.close();resolve()};
   tx.onerror=()=>{db.close();reject(Error('Cannot write synthetic device'))};
  };
 }));
}
async function audit(page,device,state){
 const data=await page.evaluate(()=>{
  const root=document.getElementById('kiosk');
  const controls=[...root.querySelectorAll('button,input,select,a[href],[role="button"]')]
   .filter(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
   }).map(el=>{
    const r=el.getBoundingClientRect();
    return {tag:el.tagName.toLowerCase(),id:el.id||null,
      action:el.getAttribute('data-action')||null,
      key:el.getAttribute('data-key')||null,
      width:Math.round(r.width),height:Math.round(r.height)};
   });
  const code=root.querySelector('#pin');
  return {viewportWidth:innerWidth,documentWidth:document.documentElement.scrollWidth,
   controls,smallControls:controls.filter(x=>x.width<44||x.height<44),
   passwordMasked:code?.type==='password',
   hasNumber:!!root.querySelector('#number'),
   hasEnrollment:!!root.querySelector('#enrollment'),
   hasConfirmPin:!!root.querySelector('#pinConfirm'),
   hasKeypad:!!root.querySelector('[data-key="OK"]')};
 });
 if(data.documentWidth>data.viewportWidth||data.smallControls.length||!data.passwordMasked||
    !data.hasNumber||!data.hasKeypad||
    (state==='enroll'?(!data.hasEnrollment||!data.hasConfirmPin):(data.hasEnrollment||data.hasConfirmPin)))
  throw Error(device+'/'+state+': failed synthetic paired kiosk audit: '+JSON.stringify(data));
 const image='kiosk-synthetic-'+state+'-'+device+'.png';
 await page.screenshot({path:path.join(output,image),animations:'disabled'});
 results.push({device,state,image,controls:data.controls,viewportWidth:data.viewportWidth,
  documentWidth:data.documentWidth,verified:'synthetic UI and interactions only'});
 console.log('Kiosk synthetic '+device+'/'+state+': '+data.controls.length+' controls, no overflow/tiny targets');
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [device,width,height] of devices){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,
    hasTouch:width<900,isMobile:width<768,serviceWorkers:'block'});
   const errors=[],externalCalls=[];
   page.on('pageerror',err=>errors.push(String(err.message).slice(0,200)));
   await page.route('**/*',route=>{
    let url;try{url=new URL(route.request().url())}catch{return route.abort('blockedbyclient')}
    if(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port==='8765')
     return route.continue();
    externalCalls.push(url.hostname);
    return route.abort('blockedbyclient');
   });
   try{
    await page.goto('http://127.0.0.1:8765/kiosk.html',{waitUntil:'domcontentloaded'});
    await page.locator('#pairCode').waitFor({state:'visible',timeout:15000});
    await syntheticPair(page);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#number').waitFor({state:'visible',timeout:15000});
    await page.evaluate(()=>document.fonts.ready);
    await audit(page,device,'identify');
    // Real keypad buttons, no identity lookup and no PIN outside the test tab.
    await page.locator('[data-key="1"]').click();
    if(await page.locator('#pin').inputValue()!=='1')
     throw Error(device+': keypad digit not accepted');
    await page.locator('[data-key="C"]').click();
    if(await page.locator('#pin').inputValue()!=='')
     throw Error(device+': keypad clear failed');
    // Intercept browser-only click to verify Enter, never send credentials.
    const keyboard=await page.evaluate(()=>{
     const button=document.querySelector('[data-key="OK"]');
     const input=document.querySelector('#number');
     let calls=0;
     const original=button.click;
     button.click=()=>{calls++};
     const key=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
     input.dispatchEvent(key);
     button.click=original;
     return {calls,prevented:key.defaultPrevented};
    });
    if(keyboard.calls!==1||!keyboard.prevented)
     throw Error(device+': Enter did not target identity confirmation');
    await page.locator('[data-action="toggle-enroll"]').click();
    await page.locator('#pinConfirm').waitFor({state:'visible',timeout:10000});
    await audit(page,device,'enroll');
    await page.locator('#kiosk-language').focus();
    await page.locator('#kiosk-language').selectOption('ar');
    const rtl=await page.evaluate(()=>({
     lang:document.documentElement.lang,
     dir:document.getElementById('kiosk').getAttribute('dir'),
     focus:document.activeElement?.id,
     hasConfirm:!!document.getElementById('pinConfirm')
    }));
    if(rtl.lang!=='ar'||rtl.dir!=='rtl'||rtl.focus!=='kiosk-language'||!rtl.hasConfirm)
     throw Error(device+': Arabic enrollment state lost RTL/focus');
    if(device==='iPad')await page.screenshot({
     path:path.join(output,'kiosk-synthetic-enroll-iPad-RTL.png'),animations:'disabled'});
    if(errors.length||externalCalls.length)
     throw Error(device+': prohibited outside request or JS error: '+JSON.stringify({errors,externalCalls}));
   }finally{await page.close()}
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,'kiosk-synthetic-audit.json'),
  JSON.stringify({states:results.length,results,
    limits:'Synthetic local registration only; no real Auth, QR camera, server, punch or physical device tested'},null,2)+'\n');
 console.log('Synthetic kiosk identity/enrollment states captured: '+results.length);
})().catch(err=>{console.error('KIOSK-PAIRED-SYNTHETIC-FAILED:',err);process.exitCode=1});
