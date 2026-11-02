import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/orders/materialOrders.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const orderCode=source.slice(source.indexOf('export function validatedMaterialOrderDraft('));
const compiled=ts.transpileModule(orderCode,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const job=(id='job-A',company_id='tenant-A')=>({id,company_id,number:'314',name:'Chantier',
 address:'1 rue Test',latitude:null,longitude:null,photo_url:null});
const draft=()=>({companyId:'tenant-A',userId:'worker-A',jobId:'job-A',
 note:'  4 boîtes de vis  ',jobs:[job()]});
function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
 return {promise,resolve,reject};
}
function fixture({online=true,unknown=false,probeThrows=false,origin=['worker-A'],
 verified='worker-A',authError=null,insertError=null,
 response={data:{id:'order-314'},error:null},transportThrows=false,hold=false}={}){
 const holdGate=deferred();
 let probes=0,identityReads=0,verifiedReads=0,inserts=0;
 const submissions=[];
 const Network={getNetworkStateAsync:async()=>{
  probes++;
  if(probeThrows)throw Error('Probe unavailable');
  return unknown?{isConnected:true,isInternetReachable:null}:
   {isConnected:online,isInternetReachable:online};
 }};
 const getLocalIdentity=async()=>({id:origin[Math.min(identityReads++,origin.length-1)]});
 const supabase={
  auth:{getUser:async()=>{verifiedReads++;return {
   data:{user:verified?{id:verified}:null},error:authError
  }}},
  from:table=>{
   assert.equal(table,'material_orders');
   return {insert:payload=>{
    inserts++;submissions.push(payload);
    return {select:columns=>{
     assert.equal(columns,'id');
     return {single:async()=>{
      if(hold)await holdGate.promise;
      if(transportThrows)throw Error('Connection disappeared');
      return insertError?{data:null,error:insertError}:response;
     }};
    }};
   }};
  }
 };
 const exports={};
 new Function('exports','Network','getLocalIdentity','supabase',compiled)(
  exports,Network,getLocalIdentity,supabase);
 return {...exports,release:holdGate.resolve,submissions,
  get calls(){return {probes,identityReads,verifiedReads,inserts}}};
}

test('valid active company job and description get normalized before insert',async()=>{
 const f=fixture();
 assert.equal(await f.submitMaterialOrder(draft()),'order-314');
 assert.deepEqual(f.submissions,[{company_id:'tenant-A',job_id:'job-A',
  created_by:'worker-A',note:'4 boîtes de vis'}]);
 assert.deepEqual(f.calls,{probes:1,identityReads:2,verifiedReads:1,inserts:1});
});

test('empty account or description rejects before any identity/network request',async()=>{
 for(const override of [{companyId:''},{userId:''},{note:'  '},{note:'x'.repeat(4001)}]){
  const f=fixture();
  await assert.rejects(f.submitMaterialOrder({...draft(),...override}));
  assert.equal(f.calls.probes,0);
  assert.equal(f.calls.inserts,0);
 }
 const f=fixture();
 assert.equal(f.validatedMaterialOrderDraft('tenant-A','worker-A','job-A',
  'x'.repeat(4000),[job()]).note.length,4000);
});

test('a foreign, missing or demo job is rejected before writing',async()=>{
 for(const data of [
  {...draft(),jobs:[job('job-A','tenant-B')]},
  {...draft(),jobs:[job('job-A','demo')]},
  {...draft(),jobId:'not-in-scope'},
  {...draft(),jobId:''},
  {...draft(),jobs:[]}
 ]){
  const f=fixture();
  await assert.rejects(f.submitMaterialOrder(data),/chantier actif/);
  assert.equal(f.calls.inserts,0);
 }
});

test('offline, unknown internet and failed network probes do not send an order',async()=>{
 for(const opts of [{online:false},{unknown:true},{probeThrows:true}]){
  const f=fixture(opts);
  await assert.rejects(f.submitMaterialOrder(draft()),/Connexion Internet requise/);
  assert.equal(f.calls.inserts,0);
  assert.equal(f.calls.verifiedReads,0);
 }
});

test('server identity mismatch, expired session and local user switch block insert',async()=>{
 for(const opts of [
  {origin:['worker-B']},{origin:['worker-A','worker-B']},
  {verified:'worker-B'},{verified:null},{authError:{message:'Expired'}}
 ]){
  const f=fixture(opts);
  await assert.rejects(f.submitMaterialOrder(draft()),/Compte changé|Session non vérifiée/);
  assert.equal(f.calls.inserts,0);
 }
});

test('two fast taps cannot create duplicate non-idempotent orders',async()=>{
 const f=fixture({hold:true});
 const first=f.submitMaterialOrder(draft());
 for(let i=0;i<20&&f.calls.inserts===0;i++)await Promise.resolve();
 assert.equal(f.calls.inserts,1);
 await assert.rejects(f.submitMaterialOrder(draft()),/Commande déjà en cours/);
 assert.equal(f.calls.inserts,1);
 f.release();
 assert.equal(await first,'order-314');
});

test('lock releases after server rejection for an explicit later attempt',async()=>{
 const f=fixture({insertError:{code:'23505',message:'Duplicate'}});
 await assert.rejects(f.submitMaterialOrder(draft()),e=>e?.code==='23505');
 await assert.rejects(f.submitMaterialOrder(draft()),e=>e?.code==='23505');
 assert.equal(f.calls.inserts,2);
});

test('an uncertain network response is never automatically retried',async()=>{
 const f=fixture({transportThrows:true});
 await assert.rejects(f.submitMaterialOrder(draft()),/vérifie l’historique/);
 assert.equal(f.calls.inserts,1);
 const g=fixture({response:{data:null,error:null}});
 await assert.rejects(g.submitMaterialOrder(draft()),/Envoi non confirmé/);
 assert.equal(g.calls.inserts,1);
});

test('independent companies may submit without a global business lock',async()=>{
 const f=fixture({hold:true});
 const first=f.submitMaterialOrder(draft());
 for(let i=0;i<20&&f.calls.inserts===0;i++)await Promise.resolve();
 const second=f.submitMaterialOrder({...draft(),companyId:'tenant-B',
  jobs:[job('job-A','tenant-B')]});
 for(let i=0;i<20&&f.calls.inserts<2;i++)await Promise.resolve();
 assert.equal(f.calls.inserts,2);
 f.release();
 await Promise.all([first,second]);
});

test('native orders screen sends via helper and hides foreign account histories',()=>{
 assert.match(app,/import \{submitMaterialOrder\} from '\.\/src\/orders\/materialOrders'/);
 assert.match(app,/orderInFlight\.current===requestedScope/);
 assert.match(app,/await submitMaterialOrder\(/);
 assert.match(app,/setOrderNote\(''\)/);
 assert.match(app,/orderListScope!==currentScope/);
 assert.match(app,/o\.company_id===account\.companyId/);
 assert.match(app,/Réponse réseau incertaine|historique des commandes/i);
 assert.doesNotMatch(app,/supabase\.from\('material_orders'\)\.insert\(/);
 for(const [filename,contents,kind] of [
  ['App.tsx',app,ts.ScriptKind.TSX],
  ['materialOrders.ts',source,ts.ScriptKind.TS]
 ]){
  const ast=ts.createSourceFile(filename,contents,ts.ScriptTarget.Latest,true,kind);
  assert.equal(ast.parseDiagnostics.length,0,filename+' has TypeScript syntax errors');
 }
});
