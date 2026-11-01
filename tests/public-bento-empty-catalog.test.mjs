import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createEssentialController} from '../web/live/essential.js';

// Entirely synthetic catalog data. No live reads, signups or payments.
const publicPlan={id:'fixture_plan',title:'OFFRE FICTIVE',active:true,public_visible:true,recommended:false,
 base_cents:1200,included_seats:5,included_seats_unlimited:false,extra_seat_cents:100,
 annual_discount:0,kiosk_limit:1,establishment_limit:1,features:[]};
const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

test('Successful but empty public catalog shows an honest empty state and read-only retry',async()=>{
 const window=new Window({url:'https://fixture.invalid/?edition=essential'});
 let calls=0,ui,draws=0;
 const sb={from(table){
  assert.equal(table,'essential_plans');
  return {select(cols){
   assert.equal(cols,'*');
   return {order(column){
    assert.equal(column,'sort_order');
    calls++;
    return Promise.resolve({data:[publicPlan],error:null});
   }};
  }};
 }};
 try{
  ui=createEssentialController({sb,document:window.document,escape,
   redraw:()=>{draws++;window.document.body.innerHTML=ui.renderPricing()},notify:()=>{}});
  window.document.body.innerHTML=ui.renderPricing();
  assert.match(window.document.querySelector('.ess-pricing-status').textContent,/Chargement des tarifs/);
  assert.equal(window.document.querySelector('[data-action="ess:retry-public"]'),null);

  // Backend returned successfully, but only inactive/hidden plans are present.
  ui.state.plans=[{...publicPlan,id:'hidden_fixture',active:false}];
  ui.state.publicPlansLoaded=true;
  window.document.body.innerHTML=ui.renderPricing();
  const status=window.document.querySelector('.ess-pricing-status');
  assert.equal(status.getAttribute('role'),'status');
  assert.match(status.textContent,/Aucun forfait public/);
  assert.doesNotMatch(status.textContent,/Chargement des tarifs|TypeError|Failed to fetch/);
  assert.equal(window.document.querySelectorAll('.ess-price').length,0);
  const retry=window.document.querySelector('[data-action="ess:retry-public"]');
  assert.ok(retry);
  assert.equal(retry.getAttribute('aria-label'),'Réessayer le chargement des forfaits');

  await ui.handle(retry);
  assert.equal(calls,1,'Retry makes exactly one read of the public catalog');
  assert.ok(draws>=2);
  assert.equal(window.document.querySelector('.ess-pricing-status'),null);
  assert.equal(window.document.querySelectorAll('.ess-price').length,1);
  assert.match(window.document.body.textContent,/OFFRE FICTIVE/);
 }finally{await window.happyDOM.close()}
});

test('In-progress and failed catalog states do not pretend to have loaded empty plans',async()=>{
 const window=new Window({url:'https://fixture.invalid/?edition=essential'});
 const ui=createEssentialController({sb:{},document:window.document,escape,redraw:()=>{},notify:()=>{}});
 try{
  ui.state.publicPlansLoaded=true;
  ui.state.loading=true;
  window.document.body.innerHTML=ui.renderPricing();
  assert.match(window.document.querySelector('.ess-pricing-status').textContent,/Chargement des tarifs/);
  assert.equal(window.document.querySelector('[data-action="ess:retry-public"]'),null);
  ui.state.loading=false;
  ui.state.error='synthetic network error';
  window.document.body.innerHTML=ui.renderPricing();
  assert.match(window.document.querySelector('.ess-pricing-status').textContent,/Tarifs temporairement indisponibles/);
  assert.ok(window.document.querySelector('[data-action="ess:retry-public"]'));
  assert.doesNotMatch(window.document.body.textContent,/synthetic network error/);
 }finally{await window.happyDOM.close()}
});
