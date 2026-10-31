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
