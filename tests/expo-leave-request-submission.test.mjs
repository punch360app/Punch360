import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/hr/leaveRequests.ts',import.meta.url),'utf8');
const portal=readFileSync(new URL('../src/hr/MorePortal.tsx',import.meta.url),'utf8');
const start=source.indexOf('export type NativeLeaveType=');
assert.ok(start>0);
const js=ts.transpileModule(source.slice(start),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const draft={companyId:'A',userId:'U',leaveType:'vacation',
 from:'2026-11-03',to:'2026-11-06',reason:'  Rendez-vous  '};
function gate(){let release;const promise=new Promise(resolve=>{release=resolve});return {promise,release};}
function fixture({online=true,probeError=false,unknown=false,identity=['U'],verified='U',
 authError=null,serverError=null,hold=false}={}){
 const pending=gate(),writes=[];
 let identityReads=0,requests=0;
 const Network={getNetworkStateAsync:async()=>{
  if(probeError)throw Error('offline probe');
  return unknown?{isConnected:true,isInternetReachable:null}:
   {isConnected:online,isInternetReachable:online};
 }};
 const getLocalIdentity=async()=>({id:identity[Math.min(identityReads++,identity.length-1)]});
 const supabase={
  auth:{getUser:async()=>({data:{user:verified?{id:verified}:null},error:authError})},
  from:table=>{
   assert.equal(table,'leave_requests');
   return {insert:async payload=>{
    requests++;writes.push(payload);
    if(hold)await pending.promise;
    return {error:serverError};
   }};
  }
 };
 const ex={};
 new Function('exports','Network','getLocalIdentity','supabase',js)(
  ex,Network,getLocalIdentity,supabase);
 return {...ex,writes,release:pending.release,
  get requests(){return requests},get identityReads(){return identityReads}};
}
test('valid real dates including leap day are accepted',()=>{
 const f=fixture();
 for(const date of ['2028-02-29','2026-11-30','1900-01-01','9999-12-31'])
  assert.equal(f.validLeaveDate(date),true);
 for(const date of ['2026-02-29','2026-02-30','2026-13-01','2026-00-12',
  '2026-11-31','2026-04-31','2026-11-00','2026-11-3','not a date',
  '2026-11-03T00:00:00Z','1899-12-31'])
  assert.equal(f.validLeaveDate(date),false,date);
});
test('request stores ISO calendar days and an optional trimmed reason',()=>{
 const f=fixture(),val=f.validatedLeaveRequest(draft);
 assert.deepEqual(val,{company_id:'A',user_id:'U',leave_type:'vacation',
  begins_on:'2026-11-03',ends_on:'2026-11-06',reason:'Rendez-vous'});
 assert.equal(f.validatedLeaveRequest({...draft,reason:' '}).reason,null);
 assert.equal(f.validatedLeaveRequest({...draft,from:'2026-11-03',to:'2026-11-03'}).ends_on,
 '2026-11-03');
});
test('invalid type, scope, or reversed dates cannot be sent',async()=>{
 const scenarios=[
  [{...draft,companyId:''},/Compte ou entreprise/],
  [{...draft,userId:'  '},/Compte ou entreprise/],
  [{...draft,leaveType:'invalid'},/type de congé/],
  [{...draft,from:'2026-02-30'},/Dates invalides/],
  [{...draft,to:'2026-10-29'},/fin du congé/]
 ];
 for(const [data,error] of scenarios){
  const f=fixture();
  await assert.rejects(f.submitNativeLeaveRequest(data),error);
  assert.equal(f.requests,0);
 }
});
test('verified online request writes once and receives confirmation',async()=>{
 const f=fixture();
 assert.equal(await f.submitNativeLeaveRequest(draft),true);
 assert.equal(f.requests,1);
 assert.deepEqual(f.writes,[f.validatedLeaveRequest(draft)]);
 assert.equal(f.identityReads,2);
});
test('offline and unknown connectivity never submit a leave request',async()=>{
 for(const v of [{online:false},{unknown:true},{probeError:true}]){
  const f=fixture(v);
  await assert.rejects(f.submitNativeLeaveRequest(draft),/Connexion Internet/);
  assert.equal(f.requests,0);
 }
});
test('authentication mismatch and an identity switch prevent submission',async()=>{
 for(const v of [{verified:'other'},{verified:null},{authError:Error('Expired')},
  {identity:['U','other']},{identity:['other']}]){
  const f=fixture(v);
  await assert.rejects(f.submitNativeLeaveRequest(draft),/Compte/);
  assert.equal(f.requests,0);
 }
});
test('overlapping taps cannot create two identical leave requests',async()=>{
 const f=fixture({hold:true});
 const first=f.submitNativeLeaveRequest(draft);
 for(let i=0;i<20&&f.requests===0;i++)await Promise.resolve();
 assert.equal(f.requests,1);
 await assert.rejects(f.submitNativeLeaveRequest(draft),/déjà en cours/);
 assert.equal(f.requests,1);
 f.release();
 assert.equal(await first,true);
});
test('server rejection releases lock so a deliberate later retry is possible',async()=>{
 const f=fixture({serverError:{code:'23505',message:'Duplicate'}});
 await assert.rejects(f.submitNativeLeaveRequest(draft),e=>e.code==='23505');
 await assert.rejects(f.submitNativeLeaveRequest(draft),e=>e.code==='23505');
 assert.equal(f.requests,2);
});
test('leave request UI keeps form after rejection and labels successful submission',()=>{
 assert.match(portal,/const \[leaveBusy,setLeaveBusy\]=useState\(false\)/);
 assert.match(portal,/if\(leaveSubmitting\.current\)return/);
 assert.match(portal,/await submitNativeLeaveRequest\(/);
 assert.match(portal,/if\(accountScopeRef\.current!==requestedScope\)return/);
 assert.match(portal,/Demande enregistrée/);
 assert.match(portal,/setReason\(''\);setFrom\(''\);setTo\(''\)/);
 assert.ok(portal.indexOf('await submitNativeLeaveRequest(')<
  portal.indexOf("setReason('');setFrom('');setTo('');"));
 const syntax=ts.createSourceFile('MorePortal.tsx',portal,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(syntax.parseDiagnostics.length,0);
});
