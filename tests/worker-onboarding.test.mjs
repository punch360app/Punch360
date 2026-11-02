import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 validWorkerInviteToken,acceptWorkerInviteOnce,
 savePendingWorkerActivation,readPendingWorkerActivation,clearPendingWorkerActivation,
 recoverWorkerActivation,isWorkerActivationVerified
} from '../web/live/worker-onboarding.js';

const user='10000000-0000-4000-8000-000000000001';
const stranger='10000000-0000-4000-8000-000000000002';
const company='20000000-0000-4000-8000-000000000001';
const prior='30000000-0000-4000-8000-000000000001';
const token='a'.repeat(64);
const worker={company_id:company,auth_user_id:user,status:'active',personal_access:true};
const workspace={companyId:company,userId:user,role:'employee',edition:'essential'};
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,
 setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};

test('a worker invitation sends only a valid token to its server RPC exactly once',async()=>{
 let called=0;const rpc=async(...args)=>{
  called++;assert.deepEqual(args,['accept_worker_invitation',{p_token:token}]);
  return {data:company,error:null};
 };
 assert.deepEqual(await acceptWorkerInviteOnce(rpc,token),{accepted:true,companyId:company});
 assert.equal(called,1);
 for(const invalid of [null,'','abc','<script>','a'.repeat(65)]){
  assert.equal(validWorkerInviteToken(invalid),false);
  await assert.rejects(acceptWorkerInviteOnce(rpc,invalid),/Lien d’activation invalide/);
 }
 assert.equal(called,1,'invalid links never reach Supabase');
});

test('a definitive rejection is surfaced, and unknown/missing replies cannot claim success',async()=>{
 const rejected=Error('Invitation expirée');
 await assert.rejects(acceptWorkerInviteOnce(async()=>({error:rejected}),token),rejected);
 for(const response of [undefined,null,{}, {error:null}]){
  await assert.rejects(acceptWorkerInviteOnce(async()=>response,token),/Réponse d’activation absente/);
 }
 assert.deepEqual(await acceptWorkerInviteOnce(async()=>({data:{id:company}}),token),
  {accepted:true,companyId:null});
});

test('an accepted activation becomes ready only after membership AND worker verification',()=>{
 assert.equal(isWorkerActivationVerified(company,user,{company_id:company},[workspace],worker),true);
 for(const [account,spaces,record] of [
  [null,[workspace],worker],
  [{company_id:prior},[workspace],worker],
  [{company_id:company},[],worker],
  [{company_id:company},[{...workspace,userId:stranger}],worker],
  [{company_id:company},[{...workspace,edition:'construction'}],worker],
  [{company_id:company},[workspace],null],
  [{company_id:company},[workspace],{...worker,auth_user_id:stranger}],
  [{company_id:company},[workspace],{...worker,status:'inactive'}],
  [{company_id:company},[workspace],{...worker,personal_access:false}]
 ]){
  assert.equal(isWorkerActivationVerified(company,user,account,spaces,record),false);
 }
});

test('ambiguous response recovery requires one newly verified essential workspace',()=>{
 const receipt={companyId:null,previousIds:[prior]};
 assert.deepEqual(recoverWorkerActivation(receipt,user,[workspace]),workspace);
 assert.equal(recoverWorkerActivation({...receipt,companyId:company},user,[workspace]),null);
 assert.equal(recoverWorkerActivation({...receipt,previousIds:[company]},user,[workspace]),null);
 assert.equal(recoverWorkerActivation({...receipt,previousIds:null},user,[workspace]),null);
 assert.equal(recoverWorkerActivation(receipt,user,[{...workspace,userId:stranger}]),null);
 assert.equal(recoverWorkerActivation(receipt,user,[{...workspace,edition:'construction'}]),null);
 assert.equal(recoverWorkerActivation(receipt,user,[workspace,{...workspace,companyId:'40000000-0000-4000-8000-000000000001'}]),null);
});

test('non-authorizing per-tab receipt is scoped to user, survives reload and clears',()=>{
 const tab=storage(),ids=[prior];
 assert.equal(savePendingWorkerActivation(tab,user,null,ids),true);
 assert.deepEqual(readPendingWorkerActivation(tab,user),{companyId:null,previousIds:ids});
 assert.equal(readPendingWorkerActivation(tab,stranger),null);
 assert.equal(isWorkerActivationVerified(company,user,{company_id:company},[],worker),false);
 assert.equal(clearPendingWorkerActivation(tab),true);
 assert.equal(readPendingWorkerActivation(tab,user),null);
 assert.equal(savePendingWorkerActivation(tab,'bad',company),false);
 assert.equal(savePendingWorkerActivation(tab,user,company,['bad']),false);
 assert.equal(savePendingWorkerActivation({setItem(){throw Error('blocked')}},user,company),false);
 assert.equal(readPendingWorkerActivation({getItem(){throw Error('blocked')}},user),null);
 assert.equal(clearPendingWorkerActivation({removeItem(){throw Error('blocked')}}),false);
});

test('real app blocks double clicks, verifies access and avoids automatic invitation replay',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/async function activateWorker\(\)/);
 assert.match(app,/if\(state\.authBusy\|\|state\.pendingWorkerActivation\|\|!state\.user\)return;/);
 assert.match(app,/validWorkerInviteToken\(token\)/);
 assert.match(app,/acceptWorkerInviteOnce\(async\(name,args\)=>/);
 assert.match(app,/if\(rejected\)throw err;/);
 assert.match(app,/savePendingWorkerActivation\(sessionStorage,state\.user\.id,null,baseline\)/);
 assert.match(app,/isWorkerActivationVerified\(createdCompanyId,state\.user\?\.id,state\.account,companyContext\.list,essentialUI\.state\.worker\)/);
 assert.match(app,/await verifyWorkerActivation\(\)/);
 assert.match(app,/state\.pendingWorkerActivation=null;clearPendingWorkerActivation\(sessionStorage\)/);
});
