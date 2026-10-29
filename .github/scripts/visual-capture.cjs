// Browser-level functional smoke and screenshots, REAL public UI only.
// Accounts are never used, forms are never submitted, OAuth is never invoked.
// All requests except the loopback static server are aborted before the network.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const output='visual-captures';
const {buildPublicInventory}=require('./ux-public-inventory.cjs');
fs.mkdirSync(output,{recursive:true});
const devices=[['S25',412,915],['iPad',820,1180],['PC',1440,900]];
const editions=['construction','essential'];
const states=['welcome','login','signup','reset'];
const results=[];
function fileName(device,edition,state) {
  // Backward-compatible first reference: formerly labelled "logged-out".
  return edition==='construction' && state==='welcome'
    ? 'punch-'+device+'-logged-out.png'
    : 'punch-'+device+'-'+edition+'-'+state+'.png';
}
async function waitForReady(page) {
  await page.waitForFunction(()=>{
    const root=document.querySelector('#root');
    return root && root.textContent.trim() && !root.textContent.includes('Chargement de l’application');
  },null,{timeout:30000});
  await page.evaluate(()=>document.fonts.ready);
}
async function metrics(page) {
  return page.evaluate(()=>{
    const visible=el=>{
      const rect=el.getBoundingClientRect();
      const style=getComputedStyle(el);
      return style.display!=='none' && style.visibility!=='hidden' && Number(style.opacity)!==0 &&
        rect.width>0 && rect.height>0 && rect.bottom>0 && rect.right>0 &&
        rect.top<innerHeight && rect.left<innerWidth;
    };
    const targets=Array.from(document.querySelectorAll(
      'button,a[href],[role="button"],input:not([type="hidden"]),select,textarea'
    )).filter(visible);
    // Capture all displayed controls, including those below the fold.
    // Do not record input values or any credential-bearing URL.
    const controls=Array.from(document.querySelectorAll(
      'button,a[href],[role="button"],input:not([type="hidden"]),select,textarea'
    )).filter(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return s.display!=='none' && s.visibility!=='hidden' && Number(s.opacity)!==0 &&
        r.width>0 && r.height>0;
    }).map((el,index)=>{
      const r=el.getBoundingClientRect();
      const labeledBy=(el.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean)
        .map(id=>document.getElementById(id)?.textContent||'').join(' ');
      const labelText=Array.from(el.labels||[]).map(label=>label.textContent||'').join(' ');
      const fallback=el.closest('label')?.textContent||'';
      const inputValue=['submit','button','reset'].includes(el.getAttribute('type'))
        ? el.getAttribute('value')||'' : '';
      const name=(el.getAttribute('aria-label')||labeledBy||labelText||fallback||
        el.textContent||inputValue||el.getAttribute('title')||'').trim().slice(0,100);
      return {
        index,element:el.getAttribute('role')==='button'&&!['BUTTON','A'].includes(el.tagName)
          ?'role-button':el.tagName.toLowerCase(),
        id:el.id||null,action:el.getAttribute('data-action')||null,
        name,disabled:!!el.disabled,tabIndex:el.tabIndex,
        inViewport:r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth,
        width:Math.round(r.width),height:Math.round(r.height)
      };
    });
    const small=targets.filter(el=>{
      const r=el.getBoundingClientRect();
      return r.width<44 || r.height<44;
    });
    return {
      layout:{documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,
        overflowPx:Math.max(0,document.documentElement.scrollWidth-innerWidth)},
      controls,
      tapTargets:{total:targets.length,smallCount:small.length,
        examples:small.slice(0,8).map(el=>({
          label:(el.getAttribute('aria-label')||el.textContent||el.tagName).trim().slice(0,70),
          width:Math.round(el.getBoundingClientRect().width),
          height:Math.round(el.getBoundingClientRect().height)
        }))}
    };
  });
}
async function shot(page,device,edition,state,pageErrors,blockedCount) {
  await waitForReady(page);
  const measurements=await metrics(page);
  // These four public auth screens must have real 44px touch targets.
  // Check the rendered DOM, not a CSS declaration or visual guess.
  if (measurements.tapTargets.smallCount>0) {
    throw new Error('Small touch targets on '+device+'/'+edition+'/'+state+': '+
      JSON.stringify(measurements.tapTargets.examples));
  }
  const name=fileName(device,edition,state);
  // Short stabilisation; the same browser and viewport are reused across each journey.
  await page.waitForTimeout(120);
  await page.screenshot({path:path.join(output,name),animations:'disabled'});
  const audit={
    device,edition,screen:state==='welcome'?'logged-out':state,
    viewport:{width:page.viewportSize().width,height:page.viewportSize().height},
    ...measurements,pageErrors:[...pageErrors],blockedExternalRequests:blockedCount()
  };
  fs.writeFileSync(path.join(output,'audit-'+device+'-'+edition+'-'+state+'.json'),
    JSON.stringify(audit,null,2)+'\n');
  results.push({device,edition,state,image:name});
  console.log('Captured '+name+'; overflow '+measurements.layout.overflowPx+
    'px; small targets '+measurements.tapTargets.smallCount);
}
async function assertHeading(page,expected) {
  const heading=page.locator('#main h2').first();
  await heading.waitFor({state:'visible',timeout:10000});
  const actual=(await heading.textContent()).trim();
  if(actual!==expected) throw new Error('Expected heading "'+expected+'" but received "'+actual+'"');
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    for(const [device,width,height] of devices) {
      for(const edition of editions) {
        const pageErrors=[];
        let blocked=0;
        const page=await browser.newPage({
          viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block',
          isMobile:width<768,hasTouch:width<900
        });
        page.on('pageerror',error=>{
          if(pageErrors.length<10) pageErrors.push(String(error.message).slice(0,250));
        });
        await page.route('**/*',route=>{
          let u;
          try {u=new URL(route.request().url());}catch {blocked++;return route.abort('blockedbyclient');}
          if(u.protocol==='http:' && u.hostname==='127.0.0.1' && u.port==='8765') return route.continue();
          blocked++;
          return route.abort('blockedbyclient');
        });
        try {
          const response=await page.goto('http://127.0.0.1:8765/?edition='+edition,
            {waitUntil:'domcontentloaded'});
          if(!response || !response.ok()) throw new Error('Static server returned '+(response ? response.status():'no response'));
          await shot(page,device,edition,'welcome',pageErrors,()=>blocked);

          // Verify actual DOM action dispatch; no authentication attempt and no form submit.
          await page.locator('button[data-action="openLogin"]').first().click();
          await page.locator('#authForm').waitFor({state:'visible',timeout:10000});
          await assertHeading(page,'Se connecter');
          if(!(await page.locator('#email[required]').count()) ||
             !(await page.locator('#password[required]').count()))
            throw new Error('Login required inputs missing');
          await shot(page,device,edition,'login',pageErrors,()=>blocked);

          await page.locator('button[data-action="authMode"]').first().click();
          await assertHeading(page,'Créer mon compte');
          const password=page.locator('#password');
          if((await password.getAttribute('minlength'))!=='8')
            throw new Error('Signup password length check missing');
          await shot(page,device,edition,'signup',pageErrors,()=>blocked);

          await page.locator('button[data-action="authMode"]').first().click();
          await assertHeading(page,'Se connecter');
          await page.locator('button[data-action="openReset"]').first().click();
          await assertHeading(page,'Mot de passe oublié');
          if(!(await page.locator('#email[required]').count()))
            throw new Error('Password recovery email field missing');
          if(await page.locator('#authForm').count())
            throw new Error('Login form incorrectly displayed in recovery mode');
          await shot(page,device,edition,'reset',pageErrors,()=>blocked);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(output,'functional-journeys.json'),
    JSON.stringify({coverage:'Unauthenticated public UI only; zero form submits, zero real accounts',
      visits:results.length,results},null,2)+'\n');
  const audits=[];
  for(const item of results) {
    const screen=item.state==='welcome'?'logged-out':item.state;
    audits.push(JSON.parse(fs.readFileSync(
      path.join(output,'audit-'+item.device+'-'+item.edition+'-'+item.state+'.json'),'utf8')));
  }
  const inventory=buildPublicInventory(audits);
  if(inventory.screens!==24 || inventory.controls===0)
    throw new Error('Incomplete public control inventory; refusing silent coverage loss');
  fs.writeFileSync(path.join(output,'public-ui-inventory.json'),
    JSON.stringify(inventory,null,2)+'\n');
  console.log('Public control inventory: '+inventory.controls+
    ' controls, '+inventory.findings.length+' actionable findings; logged-in UI NOT VERIFIED');
  console.log('Validated public browser states: '+results.length);
})().catch(error=>{console.error('PUBLIC-UI-SMOKE FAILED:',error);process.exitCode=1;});
