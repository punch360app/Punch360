import test from 'node:test';
import assert from 'node:assert/strict';
import {beginPublicEssentialSignup,rememberPublicPlanIntent,readPublicPlanIntent,readPublicPlanEstimate,forgetPublicPlanIntent,renderPublicPlanReminder} from '../web/live/public-plan-intent.js';

const store=()=>{
 const data=new Map();
 return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('Selection reminder survives navigation in the same tab, without storing prices',()=>{
 const storage=store();
 assert.equal(rememberPublicPlanIntent(storage,{planId:'fixture_basic',seats:7,cadence:'yearly'}),true);
 const saved=readPublicPlanIntent(storage);
 assert.deepEqual(saved,{planId:'fixture_basic',seats:7,cadence:'yearly'});
 assert.equal(Object.hasOwn(saved,'base_cents'),false);
 const html=renderPublicPlanReminder(storage,[{id:'fixture_basic',title:'Équipe',active:true,public_visible:true}],escape);
 assert.match(html,/Équipe/);
 assert.match(html,/7 membres/);
 assert.match(html,/annuel/);
 assert.match(html,/ne crée aucun abonnement/);
 assert.doesNotMatch(html,/\$|Stripe.*activé/);
 assert.equal(forgetPublicPlanIntent(storage),true);
 assert.equal(readPublicPlanIntent(storage),null);
});

test('Inactive, hidden or missing plan titles never appear as a verified selection',()=>{
 const storage=store();
 rememberPublicPlanIntent(storage,{planId:'fixture_basic',seats:1,cadence:'monthly'});
 for(const plans of [[],[{id:'fixture_basic',title:'PRIVÉ',active:true,public_visible:false}],
  [{id:'fixture_basic',title:'INACTIF',active:false,public_visible:true}]]){
  const html=renderPublicPlanReminder(storage,plans,escape);
  assert.match(html,/Forfait à revérifier/);
  assert.doesNotMatch(html,/PRIVÉ|INACTIF/);
 }
 const escaped=renderPublicPlanReminder(storage,[{id:'fixture_basic',title:'<script>alert(1)</script>',active:true,public_visible:true}],escape);
 assert.doesNotMatch(escaped,/<script>/);
 assert.match(escaped,/&lt;script&gt;/);
});

test('Malformed or manipulated plan, seats and cadence are rejected',()=>{
 const storage=store();
 for(const bad of [
  {planId:'',seats:4,cadence:'monthly'},
  {planId:'script:<img>',seats:4,cadence:'monthly'},
  {planId:'valid',seats:0,cadence:'monthly'},
  {planId:'valid',seats:100001,cadence:'monthly'},
  {planId:'valid',seats:1.5,cadence:'monthly'},
  {planId:'valid',seats:1,cadence:'daily'}
 ])assert.equal(rememberPublicPlanIntent(storage,bad),false);
 storage.setItem('punch-public-plan-intent-v1','{broken');
 assert.equal(readPublicPlanIntent(storage),null);
 storage.setItem('punch-public-plan-intent-v1',JSON.stringify({planId:'ok',seats:'3',cadence:'monthly'}));
 assert.equal(readPublicPlanIntent(storage),null);
 assert.equal(rememberPublicPlanIntent({setItem:()=>{throw Error('blocked')}},{planId:'valid',seats:1,cadence:'monthly'}),false);
 assert.equal(readPublicPlanIntent({getItem:()=>{throw Error('blocked')}}),null);
 assert.equal(forgetPublicPlanIntent({removeItem:()=>{throw Error('blocked')}}),false);
});

// A reload recreates the pricing controller. Restore only editable estimates,
// never a server entitlement or a price the customer could rely upon.
test('Reopen the Essentiel price picker with the saved valid estimate',()=>{
 const storage=store();
 rememberPublicPlanIntent(storage,{planId:'fixture_basic',seats:42,cadence:'yearly'});
 assert.deepEqual(readPublicPlanEstimate(storage),{seats:42,seatDraft:'42',cadence:'yearly'});
 const newController={seats:5,seatDraft:null,cadence:'monthly',checkout:null};
 Object.assign(newController,readPublicPlanEstimate(storage));
 assert.equal(newController.seats,42);
 assert.equal(newController.seatDraft,'42');
 assert.equal(newController.cadence,'yearly');
 assert.equal(newController.checkout,null);
 assert.equal(Object.hasOwn(readPublicPlanEstimate(storage),'planId'),false);
 forgetPublicPlanIntent(storage);
 assert.equal(readPublicPlanEstimate(storage),null);
});

// The estimate is calculated from the current visible catalog, never stored
// in sessionStorage. Changed catalog prices must update the visible estimate.
test('Signup reminder uses current public pricing instead of any stored price',()=>{
 const storage=store();
 rememberPublicPlanIntent(storage,{planId:'fixture_basic',seats:7,cadence:'yearly'});
 const current={id:'fixture_basic',title:'Équipe',active:true,public_visible:true,
  base_cents:2300,included_seats:5,included_seats_unlimited:false,
  extra_seat_cents:300,annual_discount:10};
 const render=plan=>renderPublicPlanReminder(storage,[plan],escape);
 let html=render(current);
 assert.match(html,/Estimation au catalogue actuel/);
 assert.match(html,/313,20/);
 assert.match(html,/avant taxes/);
 assert.doesNotMatch(html,/fournir.*paiement/i);
 html=render({...current,base_cents:3300});
 assert.match(html,/421,20/);
 assert.doesNotMatch(html,/313,20/);
 html=render({...current,active:false});
 assert.doesNotMatch(html,/Estimation au catalogue actuel|421,20/);
});

// The selected edition must match the plan, including after an OAuth redirect.
// Private-browsing storage errors may remove the reminder, not block signup.
test('Choosing Essentiel persists the edition and keeps only a nonbinding plan hint',()=>{
 const tab=store(),prefs=store();
 prefs.setItem('punch-creation-edition','construction');
 assert.equal(beginPublicEssentialSignup(tab,prefs,{planId:'fixture_basic',seats:12,cadence:'yearly'}),true);
 assert.equal(prefs.getItem('punch-creation-edition'),'essential');
 assert.equal(tab.getItem('punch-selected-plan'),'fixture_basic');
 assert.deepEqual(readPublicPlanIntent(tab),{planId:'fixture_basic',seats:12,cadence:'yearly'});
 assert.equal(tab.getItem('punch-public-plan-intent-v1').includes('base_cents'),false);
});

test('Blocked tab or edition storage cannot prevent a valid public signup',()=>{
 const blocked={setItem:()=>{throw Error('storage unavailable')}};
 const tab=store(),prefs=store();
 const draft={planId:'fixture_basic',seats:4,cadence:'monthly'};
 assert.equal(beginPublicEssentialSignup(blocked,prefs,draft),false,'Intent cannot be stored in blocked tab');
 assert.equal(prefs.getItem('punch-creation-edition'),'essential','Edition can still be remembered');
 assert.equal(beginPublicEssentialSignup(tab,blocked,draft),true,'Blocked persistent preferences are nonfatal');
 assert.deepEqual(readPublicPlanIntent(tab),draft);
 assert.equal(beginPublicEssentialSignup(tab,prefs,{...draft,seats:0}),false);
 assert.equal(beginPublicEssentialSignup(tab,prefs,{...draft,planId:'<invalid>'}),false);
});
