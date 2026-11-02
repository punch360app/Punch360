import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCompanyOnce,isCreatedCompanyVerified,validCreatedCompanyId,
 savePendingCompanyCreation,readPendingCompanyCreation,clearPendingCompanyCreation} from '../web/live/company-onboarding.js';

const user='10000000-0000-4000-8000-000000000001';
const other='10000000-0000-4000-8000-000000000002';
const company='20000000-0000-4000-8000-000000000001';
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,
 setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
const membership={companyId:company,userId:user,role:'boss',edition:'essential'};

test('server-created company is acknowledged separately from read-only verification',async()=>{
 let requests=0;
 const result=await createCompanyOnce(async(name,payload)=>{
  requests++;
  assert.equal(name,'create_company_for_edition');
  assert.deepEqual(payload,{p_name:'Ma compagnie',p_edition:'essential'});
  return {data:company,error:null};
 },'  Ma compagnie  ','essential');
 assert.deepEqual(result,{accepted:true,companyId:company});
 assert.equal(isCreatedCompanyVerified(company,user,{company_id:company},[membership]),true);
 assert.equal(requests,1);
});

test('missing or cross-tenant membership never claims the created workspace is ready',()=>{
 for(const [account,workspaces] of [
  [null,[]],
  [{company_id:company},[]],
  [{company_id:other},[membership]],
  [{company_id:company},[{...membership,userId:other}]],
  [{company_id:company},[{...membership,companyId:other}]],
  [{company_id:company},[membership]]
 ]){
  assert.equal(isCreatedCompanyVerified(company,user,account,workspaces),
   account?.company_id===company&&workspaces[0]?.companyId===company&&workspaces[0]?.userId===user);
 }
 assert.equal(isCreatedCompanyVerified('<malformed>',user,{company_id:company},[membership]),false);
});

test('bad name and edition never invoke the creation RPC',async()=>{
 let called=0;const rpc=async()=>{called++;return {data:company}};
 for(const [name,edition] of [[' ','essential'],['A','essential'],['Correct','unexpected'],[null,'essential']])
  await assert.rejects(createCompanyOnce(rpc,name,edition));
 assert.equal(called,0);
 const denial=Error('Server permission rejected');
 await assert.rejects(createCompanyOnce(async()=>({error:denial}),'Valid','essential'),denial);
});

test('missing server response stays ambiguous and must not become a successful creation',async()=>{
 for(const reply of [null,undefined,{}, {error:null}]){
  await assert.rejects(createCompanyOnce(async()=>reply,'Test','essential'),
   /Réponse du serveur absente/);
 }
});
test('an accepted response with unrecognized ID stays accepted but unverified',async()=>{
 const result=await createCompanyOnce(async()=>({data:{id:company}}),'Test','construction');
 assert.deepEqual(result,{accepted:true,companyId:null});
 assert.equal(validCreatedCompanyId('fake-company-id'),false);
});

test('pending creation receipt is per-tab and tied to user, not an entitlement',()=>{
 const tab=storage();
 assert.equal(savePendingCompanyCreation(tab,user,company),true);
 assert.deepEqual(readPendingCompanyCreation(tab,user),{companyId:company});
 assert.equal(readPendingCompanyCreation(tab,other),null);
 assert.equal(clearPendingCompanyCreation(tab),true);
 assert.equal(readPendingCompanyCreation(tab,user),null);
 assert.equal(savePendingCompanyCreation(tab,'not-user',company),false);
 assert.equal(savePendingCompanyCreation({setItem(){throw Error('blocked')}},user,company),false);
 assert.equal(readPendingCompanyCreation({getItem(){throw Error('blocked')}},user),null);
 assert.equal(clearPendingCompanyCreation({removeItem(){throw Error('blocked')}}),false);
});

test('public app guards repeat creation and checks the server membership',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/if\(state\.authBusy\|\|state\.pendingCompanyCreation\)return;/);
 assert.match(app,/const accepted=await createCompanyOnce\(/);
 assert.match(app,/state\.pendingCompanyCreation=\{companyId:accepted\.companyId\}/);
 assert.match(app,/isCreatedCompanyVerified\(pending\.companyId,state\.user\?\.id,state\.account,companyContext\.list\)/);
 assert.match(app,/verifyCreatedCompany/);
 assert.match(app,/if\(definiteError\)throw err;state\.pendingCompanyCreation=\{companyId:null\}/);
 assert.match(app,/readPendingCompanyCreation\(sessionStorage,state\.user\.id\)/);
});
