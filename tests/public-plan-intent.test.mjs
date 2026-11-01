import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberPublicPlanIntent,readPublicPlanIntent,forgetPublicPlanIntent,renderPublicPlanReminder} from '../web/live/public-plan-intent.js';

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
