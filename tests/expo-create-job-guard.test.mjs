import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/jobs/api.ts',import.meta.url),'utf8');
const start=source.indexOf('export function validatedJobDraft(');
assert.ok(start>=0,'Real Expo createJob implementation must be available');
const code=ts.transpileModule(source.slice(start).replace(/^export /gm,''),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
}).outputText;
function fixture({online=true,unknown=false,probeError=false,identity=['worker-A'],
 verifiedUser='worker-A',authError=null,reply={data:{id:'job-new'},error:null},
 insertError=null}={}){
 let reads=0,net=0,auth=0,inserts=0,submitted=null;
 const Network={getNetworkStateAsync:async()=>{
  net++;
  if(probeError)throw Error('Network probe unavailable');
  if(unknown)return {isConnected:true,isInternetReachable:null};
  return {isConnected:online,isInternetReachable:online};
 }};
 const getLocalIdentity=async()=>({id:identity[Math.min(reads++,identity.length-1)]});
 const supabase={
  auth:{getUser:async()=>{auth++;return {error:authError,data:{user:verifiedUser?{id:verifiedUser}:null}}}},
  from:table=>{
   assert.equal(table,'jobs');
   return {insert:value=>{
    inserts++;submitted=value;
    return {select:fields=>{
     assert.equal(fields,'id');
     return {single:async()=>insertError?{data:null,error:insertError}:reply};
    }};
   }};
  }
 };
 const native=new Function('Network','getLocalIdentity','supabase',code+
  '\nreturn {createJob,validatedJobDraft};')(Network,getLocalIdentity,supabase);
 return {...native,submit:(company='tenant-A',number='  JOB-214  ',name='  Résidence  ',address='  10 rue A  ')=>
  native.createJob(company,number,name,address),
  get calls(){return {reads,net,auth,inserts,submitted}}};
}

test('valid job creation trims fields and submits only one verified insert',async()=>{
 const f=fixture();
 assert.equal(await f.submit(),'job-new');
 assert.deepEqual(f.calls.submitted,{company_id:'tenant-A',number:'JOB-214',
  name:'Résidence',address:'10 rue A'});
 assert.deepEqual({net:f.calls.net,auth:f.calls.auth,inserts:f.calls.inserts},
  {net:1,auth:1,inserts:1});
});

test('empty company, job number or job name never touches the network',async()=>{
 const samples=[
  ['', 'JOB-1','Name','Address',/Entreprise indisponible/],
  ['tenant-A','  ','Name','Address',/Numéro de chantier requis/],
  ['tenant-A','JOB-1','  ','Address',/Nom du chantier requis/]
 ];
 for(const [company,number,name,address,message] of samples){
  const f=fixture();
  await assert.rejects(f.submit(company,number,name,address),message);
  assert.equal(f.calls.net,0);
  assert.equal(f.calls.inserts,0);
 }
});

test('the address may be empty but is always normalized to a string',async()=>{
 const f=fixture();
 assert.equal(await f.submit('tenant-A','N1','Site','  '),'job-new');
 assert.equal(f.calls.submitted.address,'');
 assert.throws(()=>f.validatedJobDraft('tenant-A','N1','Site',null),/Adresse/);
});

test('offline, unknown reachability and failed network probe never insert a job',async()=>{
 for(const mode of [{online:false},{unknown:true},{probeError:true}]){
  const f=fixture(mode);
  await assert.rejects(f.submit(),/Connexion Internet requise/);
  assert.equal(f.calls.auth,0);
  assert.equal(f.calls.inserts,0);
 }
});

test('server identity mismatch or verification error prevents stale-user insertion',async()=>{
 for(const caseValue of [
  {verifiedUser:'worker-B'},{verifiedUser:null},
  {authError:{message:'Session expired'}}
 ]){
  const f=fixture(caseValue);
  await assert.rejects(f.submit(),/Compte changé ou non vérifié/);
  assert.equal(f.calls.inserts,0);
 }
});

test('local user switching during the preflight cannot submit the old form',async()=>{
 const f=fixture({identity:['worker-A','worker-B']});
 await assert.rejects(f.submit(),/Compte changé pendant la création/);
 assert.equal(f.calls.inserts,0);
 assert.equal(f.calls.reads,2);
});

test('a server error is preserved without automatically repeating a non-idempotent insert',async()=>{
 const f=fixture({insertError:{message:'Duplicate job number',code:'23505'}});
 await assert.rejects(f.submit(),e=>e?.code==='23505');
 assert.equal(f.calls.inserts,1);
});

test('unknown server acknowledgement warns about possible duplicate rather than claiming success',async()=>{
 for(const data of [null,{}, {id:''},{id:42}]){
  const f=fixture({reply:{data,error:null}});
  await assert.rejects(f.submit(),/Vérifiez la liste des chantiers avant de réessayer/);
  assert.equal(f.calls.inserts,1);
 }
});

test('transport failure is not silently retried during job creation',async()=>{
 const f=fixture({reply:{data:null,error:new Error('Request timeout')}});
 await assert.rejects(f.submit(),/Request timeout/);
 assert.equal(f.calls.inserts,1);
});

test('job creation remains separated from cached offline job listing',()=>{
 const code=source.slice(start);
 assert.match(code,/const verified=await supabase\.auth\.getUser\(\)/);
 assert.match(code,/getLocalIdentity\(\)/);
 assert.match(code,/online=net\.isConnected===true&&net\.isInternetReachable===true/);
 assert.match(code,/Réponse de création non confirmée/);
 const ast=ts.createSourceFile('api.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 assert.deepEqual(ast.parseDiagnostics,[]);
});
