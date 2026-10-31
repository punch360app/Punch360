// All three example plans below are synthetic test data, NOT Punch pricing.
// Never query or mutate Supabase, create an account, or invoke Stripe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createEssentialController} from '../web/live/essential.js';

const fakePlans=[
 {id:'fixture_only_a',title:'FICTION A',active:true,public_visible:true,recommended:false,
  base_cents:1250,included_seats:3,included_seats_unlimited:false,extra_seat_cents:200,
  annual_discount:10,kiosk_limit:1,establishment_limit:1,features:[]},
 {id:'fixture_only_b',title:'FICTION B',active:true,public_visible:true,recommended:true,
  base_cents:2300,included_seats:5,included_seats_unlimited:false,extra_seat_cents:300,
  annual_discount:10,kiosk_limit:2,establishment_limit:2,features:['advanced_schedules']},
 {id:'fixture_only_c',title:'FICTION C',active:true,public_visible:true,recommended:false,
  base_cents:5100,included_seats:0,included_seats_unlimited:true,extra_seat_cents:0,
  annual_discount:10,kiosk_limit:null,establishment_limit:null,features:[]},
 {id:'fixture_hidden',title:'NEVER PUBLIC',active:true,public_visible:false,
  base_cents:9900,included_seats:1,extra_seat_cents:0,annual_discount:0,features:[]},
 {id:'fixture_inactive',title:'NEVER ACTIVE',active:false,public_visible:true,
  base_cents:9900,included_seats:1,extra_seat_cents:0,annual_discount:0,features:[]}
];
const cad=cents=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(cents/100);
const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

test('Pricing outage retry reads only public plans and replaces the error with real cards',async()=>{
 const window=new Window({url:'https://fixture.invalid/?edition=essential'});
 let calls=0,draws=0;const notifications=[];
 const db={from(name){
  assert.equal(name,'essential_plans');
  return {select(columns){
   assert.equal(columns,'*');
   return {order(column){
    assert.equal(column,'sort_order');calls++;
    return Promise.resolve(calls===1
     ?{data:null,error:{message:'synthetic offline failure'}}
     :{data:fakePlans,error:null});
   }};
  }};
 }};
 try{
  let ui;
  ui=createEssentialController({sb:db,escape,document:window.document,
   redraw:()=>{draws++;window.document.body.innerHTML=ui.renderPricing()},
   notify:msg=>notifications.push(msg)});
  ui.state.error='Failed to fetch';
  window.document.body.innerHTML=ui.renderPricing();
  assert.equal(window.document.querySelectorAll('.ess-price').length,0);
  assert.match(window.document.querySelector('.ess-pricing-status').textContent,/Tarifs temporairement indisponibles/);
  assert.doesNotMatch(window.document.body.textContent,/TypeError|Failed to fetch/);
  let retry=window.document.querySelector('button[data-action="ess:retry-public"]');
  assert.equal(retry?.getAttribute('aria-label'),'Réessayer le chargement des forfaits');
  await ui.handle(retry);
  assert.equal(calls,1);
  assert.ok(window.document.querySelector('button[data-action="ess:retry-public"]'));
  assert.doesNotMatch(window.document.body.textContent,/synthetic offline failure/);
  retry=window.document.querySelector('button[data-action="ess:retry-public"]');
  await ui.handle(retry);
  assert.equal(calls,2);
  assert.equal(window.document.querySelectorAll('.ess-price').length,3);
  assert.equal(window.document.querySelector('button[data-action="ess:retry-public"]'),null);
  assert.equal(window.document.querySelector('.ess-pricing-status'),null);
  assert.ok(draws>=4);
  assert.deepEqual(notifications,[]);
 }finally{await window.happyDOM.close()}
});

test('Keyboard focus survives the public monthly/yearly redraw without changing pricing',async()=>{
 const window=new Window({url:'https://fixture.invalid/?edition=essential'});
 let ui,draws=0;
 try{
  ui=createEssentialController({sb:{},document:window.document,escape,
   redraw:()=>{draws++;window.document.body.innerHTML=ui.renderPricing()},
   notify:()=>{}});
  ui.state.plans=fakePlans;
  window.document.body.innerHTML=ui.renderPricing();
  const oldButton=window.document.querySelector('button[data-action="ess:yearly"]');
  oldButton.focus();
  assert.equal(window.document.activeElement,oldButton);
  await ui.handle(oldButton);
  const newButton=window.document.querySelector('button[data-action="ess:yearly"]');
  assert.notEqual(newButton,oldButton,'Redraw really replaced the button node');
  assert.equal(window.document.activeElement,newButton,'Keyboard focus should remain on Annuel');
  assert.equal(newButton.getAttribute('aria-pressed'),'true');
  assert.ok(draws>0);
 }finally{await window.happyDOM.close()}
});

test('Member-count input keeps its DOM node, cursor and focus while live prices update',async()=>{
 const window=new Window({url:'https://fixture.invalid/?edition=essential'});
 let ui,redraws=0;
 try{
  ui=createEssentialController({sb:{},document:window.document,escape,
   redraw:()=>{redraws++;window.document.body.innerHTML=ui.renderPricing()},
   notify:()=>{}});
  ui.state.plans=fakePlans;
  window.document.body.innerHTML=ui.renderPricing();
  const original=window.document.getElementById('ess-seats');
  original.focus();
  assert.equal(window.document.activeElement,original);
  original.value='1';ui.input(original);
  assert.equal(window.document.getElementById('ess-seats'),original);
  assert.equal(window.document.activeElement,original);
  original.value='12';ui.input(original);
  assert.equal(window.document.getElementById('ess-seats'),original,
   'No replacement of the live input between keystrokes');
  assert.equal(window.document.activeElement,original);
  assert.equal(original.value,'12');
  assert.equal(ui.state.seats,12);
  const cards=[...window.document.querySelectorAll('.ess-price')];
  assert.ok(cards[0].textContent.includes(cad(3050)));
  assert.ok(cards[1].textContent.includes(cad(4400)));
  assert.ok(cards[2].textContent.includes(cad(5100)));
  original.value='';ui.input(original);
  assert.equal(ui.state.seats,12,'Incomplete count must not change prices');
  assert.equal(window.document.activeElement,original,'The empty edit keeps focus');
  original.value='5';ui.input(original);
  assert.equal(ui.state.seats,5);
  assert.equal(window.document.getElementById('ess-seats'),original);
  assert.equal(redraws,0,'Only price cards change during typing, never the whole screen');
 }finally{await window.happyDOM.close();}
});

test('Forged hidden, inactive, and missing public plan IDs cannot open signup',async()=>{
 const window=new Window({url:'https://fixture.invalid/?edition=essential'});
 const chosen=[],notifications=[];let redraws=0;
 try{
  const ui=createEssentialController({sb:{},document:window.document,escape,
   redraw:()=>{redraws++},notify:msg=>notifications.push(msg),
   onChoose:plan=>chosen.push(plan)});
  ui.state.plans=fakePlans;
  ui.state.checkout=null;
  for(const badId of ['fixture_hidden','fixture_inactive','missing-plan-id']){
   assert.equal(await ui.handle({dataset:{action:'ess:choose',id:badId}}),true);
   assert.equal(ui.state.checkout,null,'Rejected plan must not set checkout');
   assert.equal(chosen.length,0,'Rejected plan must never enter signup');
  }
  assert.equal(notifications.filter(msg=>msg.includes('n’est plus disponible')).length,3);
  assert.ok(redraws>=3);
  // A public, active plan must keep its original onboarding behavior.
  await ui.handle({dataset:{action:'ess:choose',id:'fixture_only_b'}});
  assert.equal(chosen.length,1);
  assert.equal(chosen[0].id,'fixture_only_b');
  assert.equal(ui.state.checkout,'FICTION B');
 }finally{await window.happyDOM.close();}
});

test('Public annual discount label ignores hidden and inactive discounts',async()=>{
 const window=new Window({url:'https://fixture.invalid/?edition=essential'});
 try{
  const ui=createEssentialController({sb:{},document:window.document,escape,redraw:()=>{},notify:()=>{}});
  ui.state.plans=fakePlans;
  const annual=()=>{window.document.body.innerHTML=ui.renderPricing();
   return window.document.querySelector('button[data-action="ess:yearly"]').textContent};
  assert.equal(annual(),'Annuel −10 %','Hidden 0% plans do not suppress a true public 10% saving');
  ui.state.plans=fakePlans.map(p=>p.id==='fixture_only_c'?{...p,annual_discount:5}:p);
  assert.equal(annual(),'Annuel','No single advertised discount for different public plan rates');
  ui.state.plans=fakePlans.map(p=>p.active&&p.public_visible?{...p,annual_discount:0}:p);
  assert.equal(annual(),'Annuel','Do not advertise a 0% saving');
  ui.state.plans=fakePlans.map(p=>({...p,active:false}));
  assert.equal(annual(),'Annuel','Never advertise a discount without public plans');
 }finally{await window.happyDOM.close();}
});

test('Real public pricing renderer uses only three visible synthetic test plans and existing actions',async()=>{
 const window=new Window({url:'https://fixture.invalid/?edition=essential'});
 const notifications=[];
 let selected=null,draws=0;
 try {
  // Controller is the actual production renderer, with no live backend actions.
  const ui=createEssentialController({
   sb:{},redraw:()=>{draws++},notify:msg=>notifications.push(msg),
   escape,document:window.document,onChoose:plan=>{selected=plan}
  });
  ui.state.plans=fakePlans;
  ui.state.seats=5;
  window.document.body.innerHTML=ui.renderPricing();
  let cards=[...window.document.querySelectorAll('.ess-price')];
  assert.equal(cards.length,3);
  assert.deepEqual(cards.map(el=>el.querySelector('h3').textContent),
   ['FICTION A','FICTION B','FICTION C']);
  assert.equal(window.document.querySelectorAll('[data-action="ess:choose"]').length,3);
  assert.equal(window.document.querySelector('.ess-pricing-status'),null);
  assert.ok(window.document.querySelector('.ess-market-details summary'));
  // 1250 base cents + 2 extra seats at 200 cents = 1650 cents, never a hardcoded public price.
  assert.ok(cards[0].textContent.includes(cad(1650)));
  assert.ok(cards[1].textContent.includes(cad(2300)));
  assert.ok(cards[2].textContent.includes(cad(5100)));
  assert.doesNotMatch(window.document.body.textContent,/NEVER PUBLIC|NEVER ACTIVE/);
  assert.equal(window.document.querySelector('[data-action="ess:monthly"]').getAttribute('aria-pressed'),'true');

  await ui.handle({dataset:{action:'ess:yearly'}});
  window.document.body.innerHTML=ui.renderPricing();
  cards=[...window.document.querySelectorAll('.ess-price')];
  assert.equal(window.document.querySelector('[data-action="ess:yearly"]').getAttribute('aria-pressed'),'true');
  assert.ok(cards[0].textContent.includes(cad(Math.round(1650*12*.9))));
  assert.ok(cards[1].textContent.includes(cad(Math.round(2300*12*.9))));
  assert.ok(cards[2].textContent.includes(cad(Math.round(5100*12*.9))));

  await ui.handle({dataset:{action:'ess:choose',id:'fixture_only_b'}});
  assert.equal(selected?.id,'fixture_only_b');
  assert.ok(notifications.some(msg=>msg.includes('Paiement Stripe encore à configurer')));
  assert.ok(draws>=2);
  assert.equal(window.document.querySelector('form#authForm'),null);
 } finally {
  await window.happyDOM.close();
 }
});
