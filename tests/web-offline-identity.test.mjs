import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cachedOfflineWebUser,cachedOfflineWebAccount} from '../web/live/offline-identity.js';
const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
const start=app.indexOf('async function initialize()');
const stop=app.indexOf('async function lookupAccount()',start);
assert.ok(start>=0&&stop>start);
const source=app.slice(start,stop);
const id='worker-A',company='company-A';
const user={id,email:'employee@example.test'};
const account={company_id:company,role:'employee',companies:{
 name:'Atelier',billing_status:'active',product_edition:'essential',default_punch_job_id:'job-A'}};
const key='punch-account:'+id+':'+company;
function memory(initial={}){
 const entries=new Map(Object.entries(initial));
 return {getItem:k=>entries.has(k)?entries.get(k):null,setItem:(k,v)=>entries.set(k,v),entries};
}
function fixture(initial){
 const storage=memory(initial),calls=[],state={
  user:{id:'stale-user'},account:{company_id:'other-company'},jobs:[{id:'stale'}],
  assignments:[1],shifts:[1],selected:'foreign',sessions:[{id:'stale'}],
  segments:[{id:'stale'}],breaks:[{id:'stale'}],
  serverPunch:{sessions:[{id:'stale'}],segments:[],breaks:[]},
  serverPunchCompany:'other-company',serverPunchFetchedAt:5
 },companyContext={list:[1],choosing:true};
 const initialize=new Function('cachedOfflineWebUser','cachedOfflineWebAccount',
  'localStorage','navigator','state','companyContext','member','isEssential',
  'essentialUI','restoreOfflineSnapshot','loadData','draw','sb','error',
  'punchLoadRevision','getRevision',
  source+'\nreturn initialize;')(
  cachedOfflineWebUser,cachedOfflineWebAccount,storage,{onLine:false},
  state,companyContext,()=>!!state.user&&!!state.account,
  ()=>state.account?.companies?.product_edition==='essential',
  {appearance:{load:async()=>calls.push('appearance')}},()=>calls.push('restore'),
  async()=>calls.push('load'),()=>calls.push('draw'),
  {auth:{getSession:async()=>{throw Error('Cannot fetch offline')}}},
  e=>calls.push('error:'+e.message),0,()=>0);
 return {storage,state,calls,companyContext,initialize};
}
test('well-formed scoped offline identity loads last verified company and its data',async()=>{
 const h=fixture({'punch-local-user':JSON.stringify(user),
  ['punch-last-company:'+id]:company,[key]:JSON.stringify(account)});
 await h.initialize();
 assert.equal(h.state.user.id,id);assert.equal(h.state.account.company_id,company);
 assert.deepEqual(h.calls,['restore','appearance','load','draw']);
 assert.deepEqual(h.state.sessions,[],'prior in-memory tenant data cleared');
});
test('corrupt cached user JSON does not crash startup or overwrite original bytes',async()=>{
 const raw='{"id":"broken"',h=fixture({'punch-local-user':raw});
 await h.initialize();
 assert.equal(h.state.user,null);assert.equal(h.state.account,null);
 assert.deepEqual(h.calls,['draw']);
 assert.equal(h.storage.getItem('punch-local-user'),raw);
 assert.deepEqual(h.state.sessions,[]);
});
test('invalid cached account cannot grant access or restore another company',async()=>{
 const h=fixture({'punch-local-user':JSON.stringify(user),
  ['punch-last-company:'+id]:company,[key]:'{"company_id":'});
 await h.initialize();
 assert.equal(h.state.user.id,id);assert.equal(h.state.account,null);
 assert.deepEqual(h.calls,['draw']);
 assert.equal(h.storage.getItem(key),'{"company_id":');
 assert.equal(h.companyContext.choosing,false);
});
test('foreign company, mismatched user, forged role and edition never load offline',()=>{
 const variants=[
  {...account,company_id:'company-B'},
  {...account,user_id:'other-worker'},
  {...account,role:'platform-admin'},
  {...account,companies:{...account.companies,product_edition:'enterprise'}},
  []
 ];
 for(const candidate of variants){
  const storage=memory({'punch-local-user':JSON.stringify(user),
   ['punch-last-company:'+id]:company,[key]:JSON.stringify(candidate)});
  assert.equal(cachedOfflineWebAccount(storage,user),null);
 }
});
test('only identity fields from saved user are reused, never browser role claims',()=>{
 const storage=memory({'punch-local-user':JSON.stringify({...user,role:'boss',access_token:'secret'})});
 assert.deepEqual(cachedOfflineWebUser(storage),user);
 for(const row of [{id:7},{email:'x'},[],{id:'  '},{id:'A',email:5}])
  assert.equal(cachedOfflineWebUser(memory({'punch-local-user':JSON.stringify(row)})),null);
});
test('absence of last-company hint remains a safe offline signed-out workspace',async()=>{
 const h=fixture({'punch-local-user':JSON.stringify(user),[key]:JSON.stringify(account)});
 await h.initialize();assert.equal(h.state.account,null);assert.deepEqual(h.calls,['draw']);
});
test('storage exceptions cannot authorize a stale offline workspace',()=>{
 const invalid={getItem:()=>{throw Error('blocked')}};
 assert.equal(cachedOfflineWebUser(invalid),null);
 assert.equal(cachedOfflineWebAccount(invalid,user),null);
});
test('initializer uses scoped offline cache rather than raw JSON.parse role records',()=>{
 assert.match(source,/cachedOfflineWebUser\(localStorage\)/);
 assert.match(source,/cachedOfflineWebAccount\(localStorage,cached\)/);
 assert.doesNotMatch(source,/JSON\.parse\(localStorage\.getItem\('punch-account:/);
});
