// Browser-level synthetic catalog test for Bento 05. Every sample title and
// price is FICTION, and the only permitted HTTP response is the local static
// site or the intercepted GET of essential_plans. NO Supabase request is sent.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const output='visual-captures';
const sizes=[
 ['Small320',320,640],['Mobile390',390,844],['Tablet834',834,1112],
 ['TabletWide1024',1024,768],['Desktop1440',1440,900]
];
const plans=[
 {id:'fixture_only_a',title:'TEST FICTION A',active:true,public_visible:true,recommended:false,
  base_cents:1250,included_seats:3,included_seats_unlimited:false,extra_seat_cents:200,
  annual_discount:10,kiosk_limit:1,establishment_limit:1,features:[],sort_order:1},
 {id:'fixture_only_b',title:'TEST FICTION B',active:true,public_visible:true,recommended:true,
  base_cents:2300,included_seats:5,included_seats_unlimited:false,extra_seat_cents:300,
  annual_discount:10,kiosk_limit:2,establishment_limit:2,features:[],sort_order:2},
 {id:'fixture_only_c',title:'TEST FICTION C',active:true,public_visible:true,recommended:false,
  base_cents:5100,included_seats:0,included_seats_unlimited:true,extra_seat_cents:0,
  annual_discount:10,kiosk_limit:null,establishment_limit:null,features:[],sort_order:3},
 {id:'fixture_hidden',title:'TEST NEVER SHOW',active:true,public_visible:false,
  base_cents:9999,included_seats:1,included_seats_unlimited:false,extra_seat_cents:0,
  annual_discount:0,kiosk_limit:1,establishment_limit:1,features:[],sort_order:4},
 {id:'fixture_inactive',title:'TEST NEVER ACTIVE',active:false,public_visible:true,
  base_cents:9999,included_seats:1,included_seats_unlimited:false,extra_seat_cents:0,
  annual_discount:0,kiosk_limit:1,establishment_limit:1,features:[],sort_order:5}
];
const cents=c=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(c/100).replace(/\s/g,'');
const normalize=s=>String(s).replace(/\s/g,'');
const results=[];
fs.mkdirSync(output,{recursive:true});

async function assertCards(page,amounts,device,period){
 const cards=page.locator('.punch-public-bento .ess-price');
 await cards.first().waitFor({state:'visible',timeout:15000});
 assert.equal(await cards.count(),3,'Expected 3 synthetic plan cards: '+device+' '+period);
 const headings=await cards.locator('h3').allTextContents();
 assert.deepEqual(headings,['TEST FICTION A','TEST FICTION B','TEST FICTION C']);
 for(let i=0;i<3;i++){
  const el=cards.nth(i);
  const title=await el.locator('h3').innerText();
  const amount=normalize(await el.locator('.ess-price-amount').innerText());
  assert.ok(amount.includes(cents(amounts[i])),
    'Wrong '+period+' synthetic plan amount on '+device+': '+title+' expected '+cents(amounts[i])+' got '+amount);
  const button=el.locator('button[data-action="ess:choose"]');
  assert.equal(await button.count(),1);
  const rect=await button.boundingBox();
  assert.ok(rect&&rect.width>=44&&rect.height>=44,'Pricing CTA <44px: '+device+' '+title);
 }
 // A recommended label belongs above the action, never below it on mobile.
 if(['Small320','Mobile390'].includes(device)){
  const recommended=cards.nth(1);
  const badge=await recommended.locator('.ess-badge').boundingBox();
  const cta=await recommended.locator('button[data-action="ess:choose"]').boundingBox();
  assert.ok(badge&&cta&&badge.y+badge.height<=cta.y+2,
   'Recommended badge must be visually before the choose button: '+device);
 }
 const body=await page.locator('.punch-public-bento .ess-pricing').innerText();
 assert.doesNotMatch(body,/TEST NEVER SHOW|Tarifs temporairement indisponibles|Failed to fetch|TypeError/);
 const dimensions=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));
 assert.ok(dimensions.documentWidth<=dimensions.viewport+2,
  'Horizontal overflow with synthetic pricing: '+device+' '+period+' '+JSON.stringify(dimensions));
 // This is a visibility AUDIT, not a false claim of one-screen mobile fit.
 // A 320px phone or enlarged text may require vertical scrolling for readability.
 const initialViewport=await page.evaluate(()=>{
  const main=document.querySelector('.punch-public-bento .onboard-main');
  const buttons=[...document.querySelectorAll('.punch-public-bento .ess-price button[data-action="ess:choose"]')];
  const onscreen=buttons.filter(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});
  const bounds=buttons.map(el=>{
   const b=el.getBoundingClientRect(),card=el.closest('.ess-price')?.getBoundingClientRect();
   return {buttonTop:Math.round(b.top),buttonBottom:Math.round(b.bottom),
    cardTop:Math.round(card?.top??0),cardBottom:Math.round(card?.bottom??0)};
  });
  const header=document.querySelector('.punch-public-bento .onboard-header')?.getBoundingClientRect();
  const intro=document.querySelector('.punch-public-bento .welcome-intro')?.getBoundingClientRect();
  const pricing=document.querySelector('.punch-public-bento .ess-pricing')?.getBoundingClientRect();
  return {viewportHeight:innerHeight,fullyVisiblePlanActions:onscreen.length,
   planActions:buttons.length,mainCanScroll:Boolean(main&&main.scrollHeight>main.clientHeight+2),
   bounds,headerBottom:Math.round(header?.bottom??0),
   introBottom:Math.round(intro?.bottom??0),pricingTop:Math.round(pricing?.top??0)};
 });
 if(device==='Small320'||device==='Mobile390'){
  console.log('BENTO VIEWPORT METRICS '+device+' '+period+': '+JSON.stringify(initialViewport));
  if(initialViewport.fullyVisiblePlanActions<3)
   await page.screenshot({path:path.join(output,'FIXTURE-ONLY-bento05-'+device+'-'+period+'-diagnostic.png'),
    animations:'disabled',fullPage:true});
  assert.equal(initialViewport.fullyVisiblePlanActions,3,
   'All three primary plan actions must be visible on the initial '+device+' screen: '+
    JSON.stringify(initialViewport));
 }else if(initialViewport.fullyVisiblePlanActions<3)
  console.warn('BENTO VIEWPORT AUDIT '+device+' '+period+': only '+
   initialViewport.fullyVisiblePlanActions+'/3 plan actions initially visible; vertical scrolling required.');
 return {headings,amounts,dimensions,initialViewport};
}

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [device,width,height] of sizes){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,
    hasTouch:width<900,isMobile:width<768,serviceWorkers:'block'});
   const page=await context.newPage();
   let catalogReads=0,blocked=0;
   const errors=[];
   page.on('pageerror',error=>errors.push(String(error.message)));
   await page.route('**/*',route=>{
    let u;try{u=new URL(route.request().url())}catch{return route.abort('blockedbyclient')}
    if(u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port==='8765')return route.continue();
    // Only intercepted read-only catalog GET. Never reach Supabase or any other external server.
    if(u.hostname==='mlabstdxxwjdpfaxiwmg.supabase.co'
      &&u.pathname==='/rest/v1/essential_plans'&&route.request().method()==='GET'){
      catalogReads++;
      return route.fulfill({status:200,
       headers:{'content-type':'application/json','access-control-allow-origin':'*',
        'access-control-expose-headers':'content-range','content-range':'0-4/5'},
       body:JSON.stringify(plans)});
    }
    blocked++;return route.abort('blockedbyclient');
   });
   try{
    const response=await page.goto('http://127.0.0.1:8765/?edition=essential',
     {waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200);
    await page.locator('.punch-public-bento .ess-pricing').waitFor({state:'visible',timeout:30000});
    const monthly=await assertCards(page,[1650,2300,5100],device,'monthly');
    assert.equal(await page.locator('[data-action="ess:monthly"]').getAttribute('aria-pressed'),'true');
    assert.equal((await page.locator('[data-action="ess:yearly"]').innerText()).trim(),'Annuel −10 %',
     'An inactive or hidden plan must not mask the shared public discount: '+device);
    await page.screenshot({path:path.join(output,'FIXTURE-ONLY-bento05-'+device+'-monthly.png'),
     animations:'disabled',fullPage:true});

    // Type multiple digits through Chromium's REAL input events. Each price
    // update replaces the input; the second keystroke must still reach it.
    const seatsInput=page.locator('#ess-seats');
    await seatsInput.focus();
    await seatsInput.fill('');
    await page.keyboard.type('12',{delay:40});
    assert.equal(await page.locator('#ess-seats').inputValue(),'12',
      'Member count lost the next keystroke after redraw: '+device);
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'ess-seats',
      'Member count must retain keyboard focus across price redraw: '+device);
    assert.equal(await page.evaluate(()=>document.querySelector('#ess-seats')?.value),'12');
    const updated=page.locator('.punch-public-bento .ess-price');
    for(const [i,amount] of [3050,4400,5100].entries())
      assert.ok(normalize(await updated.nth(i).locator('.ess-price-amount').innerText()).includes(cents(amount)),
        'Member input did not update real pricing card '+i+' on '+device);
    await page.locator('#ess-seats').fill('5');
    assert.equal(await page.locator('#ess-seats').inputValue(),'5');
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'ess-seats');
    // Remove focus before the annual keyboard scenario and keep the same
    // first-viewport geometry for the monthly/yearly review.
    await page.evaluate(()=>document.activeElement?.blur());

    // Navigate the actual public billing switch with Enter (not a synthetic click).
    const annualToggle=page.locator('[data-action="ess:yearly"]');
    await annualToggle.focus();
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-action')),'ess:yearly');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-action="ess:yearly"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-action')),'ess:yearly',
     'The billing-period action must keep keyboard focus after the SPA redraw: '+device);
    const yearly=await assertCards(page,[17820,24840,55080],device,'yearly');
    await page.screenshot({path:path.join(output,'FIXTURE-ONLY-bento05-'+device+'-yearly.png'),
     animations:'disabled',fullPage:true});

    // Exercise the real public DOM event handler with a tampered catalog ID.
    // Hidden/inactive/nonexistent plans must not open account creation or save
    // an unauthorized selected-plan ID to sessionStorage.
    for(const forgedId of ['fixture_hidden','fixture_inactive','fixture_missing']){
      const forgedButton=page.locator('.ess-price button[data-action="ess:choose"]').nth(1);
      await forgedButton.evaluate((node,id)=>{node.dataset.id=id},forgedId);
      await forgedButton.click();
      await page.waitForTimeout(45);
      assert.equal(await page.locator('#authForm').count(),0,
       'Tampered plan must not start signup: '+device+' / '+forgedId);
      assert.equal(await page.evaluate(()=>sessionStorage.getItem('punch-selected-plan')),null,
       'Tampered plan must not save a selected plan: '+device+' / '+forgedId);
      assert.equal(await page.locator('.ess-price').count(),3,
       'Tampered selection must preserve visible public catalog');
    }
    assert.deepEqual(errors,[],'No uncaught exception from a forged ID: '+device);
    // A keyboard-only customer must also be able to choose the recommended plan.
    const recommendedChoose=page.locator('.ess-price button[data-action="ess:choose"]').nth(1);
    await recommendedChoose.evaluate(node=>{node.dataset.id='fixture_only_b'});
    await recommendedChoose.focus();
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-action')),'ess:choose');
    await page.keyboard.press('Enter');
    await page.locator('#authForm').waitFor({state:'visible',timeout:10000});
    assert.match(await page.locator('#main h2').innerText(),/Créer mon compte/);
    assert.equal(await page.locator('#authForm button[type="submit"]').count(),1);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('punch-selected-plan')),'fixture_only_b',
     'Public plan selection must save only the valid plan');
    assert.ok(catalogReads>=1,'Expected a synthetic catalog GET for '+device);
    assert.deepEqual(errors,[], 'Browser exceptions: '+device);
    results.push({device,width,height,monthly,yearly,catalogReads,
     blockedExternalRequests:blocked,signupVisible:true,pageErrors:errors});
    console.log('BENTO SYNTHETIC CATALOG '+device+': 3 cards, monthly/yearly, signup and no overflow PASS');
   }finally{await context.close()}
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,'FIXTURE-ONLY-bento-catalog-results.json'),
  JSON.stringify({source:'SYNTHETIC TEST DATA ONLY; never Supabase or Stripe',
   viewports:results.length,screenshots:results.length*2,results,
   limitations:'Real plan amounts, live network/auth/Stripe, and owner-approved design NOT VERIFIED'},null,2)+'\n');
})().catch(err=>{console.error('BENTO SYNTHETIC CATALOG FAILURE',err);process.exitCode=1});
