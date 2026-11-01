import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createEssentialController} from '../web/live/essential.js';

// All requests and plans are synthetic; no Supabase account or live prices.
const plan=(id,title)=>({
 id,title,active:true,public_visible:true,recommended:false,base_cents:1200,
 included_seats:5,included_seats_unlimited:false,extra_seat_cents:100,
 annual_discount:0,kiosk_limit:1,establishment_limit:1,features:[]
});
const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function createDeferredCatalog(){
 const pending=[];
 const sb={from(table){
  assert.equal(table,'essential_plans');
  return {select(columns){
   assert.equal(columns,'*');
   return {order(column){
    assert.equal(column,'sort_order');
    return new Promise(resolve=>pending.push(resolve));
   }};
  }};
 }};
 return {sb,pending};
}
function createUI(window,sb){
 let ui;
 ui=createEssentialController({sb,document:window.document,escape,
  redraw:()=>{window.document.body.innerHTML=ui.renderPricing()},notify:()=>{}});
 return ui;
}

test('An earlier load cannot overwrite the catalog returned for a later session',async()=>{
 const window=new Window({url:'https://fixture.invalid/?edition=essential'});
 const {sb,pending}=createDeferredCatalog();
 try{
  const ui=createUI(window,sb);
  const stale=ui.load(null,null);
  assert.equal(pending.length,1);
  const fresh=ui.load(null,null);
  assert.equal(pending.length,2);
  pending[1]({data:[plan('new','SESSION COURANTE')],error:null});
  await fresh;
  assert.equal(ui.state.publicPlansLoaded,true);
  pending[0]({data:[plan('old','SESSION PÉRIMÉE')],error:null});
  await stale;
  assert.deepEqual(ui.state.plans.map(p=>p.id),['new']);
  assert.match(ui.renderPricing(),/SESSION COURANTE/);
  assert.doesNotMatch(ui.renderPricing(),/SESSION PÉRIMÉE/);
 }finally{await window.happyDOM.close()}
});

test('An old retry cannot show an error or keep loading after a new session starts',async()=>{
 const window=new Window({url:'https://fixture.invalid/?edition=essential'});
 const {sb,pending}=createDeferredCatalog();
 try{
  const ui=createUI(window,sb);
  const initial=ui.load(null,null);
  pending[0]({data:[],error:null});
  await initial;
  window.document.body.innerHTML=ui.renderPricing();
  const retryButton=window.document.querySelector('[data-action="ess:retry-public"]');
  assert.ok(retryButton);
  const retry=ui.handle(retryButton);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(pending.length,2);
  assert.equal(ui.state.loading,true);
  const fresh=ui.load(null,null);
  assert.equal(pending.length,3);
  assert.equal(ui.state.loading,false,'The new session owns its own busy state');
  pending[2]({data:[plan('new','FORFAIT ACTUEL')],error:null});
  await fresh;
  pending[1]({data:null,error:{message:'Synthetic stale failure'}});
  await retry;
  assert.equal(ui.state.error,'');
  assert.equal(ui.state.loading,false);
  assert.equal(ui.state.publicPlansLoaded,true);
  assert.deepEqual(ui.state.plans.map(p=>p.id),['new']);
  assert.doesNotMatch(ui.renderPricing(),/indisponibles|Synthetic stale failure/);
 }finally{await window.happyDOM.close()}
});

test('A reset invalidates an in-flight catalog request',async()=>{
 const window=new Window({url:'https://fixture.invalid/?edition=essential'});
 const {sb,pending}=createDeferredCatalog();
 try{
  const ui=createUI(window,sb);
  const inFlight=ui.load(null,null);
  assert.equal(pending.length,1);
  ui.reset();
  pending[0]({data:[plan('old','NE DOIT PAS APPARAÎTRE')],error:null});
  await inFlight;
  assert.deepEqual(ui.state.plans,[]);
  assert.equal(ui.state.publicPlansLoaded,false);
  assert.equal(ui.state.error,'');
  assert.equal(ui.state.loading,false);
 }finally{await window.happyDOM.close()}
});
