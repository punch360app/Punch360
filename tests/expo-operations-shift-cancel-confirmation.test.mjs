import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const panel=readFileSync(new URL('../src/workforce/OperationsPanel.tsx',import.meta.url),'utf8');
const validation=readFileSync(new URL('../src/workforce/operations-schedule-validation.ts',import.meta.url),'utf8');
const start=panel.indexOf(' function confirmShiftCancellation(');
const end=panel.indexOf(' async function upload()',start);
assert.ok(start>=0&&end>start,'Real cancellation confirmation must exist');
const compiled=ts.transpileModule(panel.slice(start,end),{compilerOptions:{
 module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022
}}).outputText;
const validatorJS=ts.transpileModule(validation,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const validators={};
new Function('exports',validatorJS)(validators);
const shift={id:'shift-A',company_id:'company-A',user_id:'worker-A',
 starts_at:'2026-11-03T12:00:00Z',ends_at:'2026-11-03T20:00:00Z'};
function fixture({reason='  Pluie  ',manager=true,busy=false,
 loadedScope='company-A:boss-A',shifts=[shift],companyId='company-A',
 rpcError=null}={}){
 const scope='company-A:boss-A',scopeRef={current:scope},account={companyId};
 const calls={alerts:[],rpc:[],errors:[],cleared:[],runs:0};
 const Alert={alert:(...args)=>{calls.alerts.push(args)}};
 const supabase={rpc:async(name,payload)=>{
  calls.rpc.push({name,payload});return {error:rpcError};
 }};
 const run=async action=>{calls.runs++;await action()};
 const setError=value=>calls.errors.push(value);
 const setCancelReason=value=>calls.cleared.push(value);
 const params={manager,busy,loadedScope,scope,scopeRef,shifts,account,Alert,
  validatedShiftCancellationReason:validators.validatedShiftCancellationReason,
  cancelReason:reason,setError,run,supabase,setCancelReason};
 const fn=new Function(...Object.keys(params),compiled+
  '\nreturn confirmShiftCancellation;')(...Object.values(params));
 async function confirm(){
  const modal=calls.alerts.at(-1);assert.ok(modal,'Expected native confirmation dialog');
  const action=modal[2].find(a=>a.style==='destructive');
  assert.ok(action,'Expected destructive confirmation action');
  action.onPress();await new Promise(resolve=>setImmediate(resolve));
 }
 return {fn,calls,scopeRef,confirm,shift};
}

test('cancel button opens a specific confirmation, never executes RPC immediately',async()=>{
 const f=fixture();
 f.fn(shift);
 assert.equal(f.calls.rpc.length,0);
 assert.equal(f.calls.runs,0);
 assert.equal(f.calls.alerts.length,1);
 const [title,message,actions]=f.calls.alerts[0];
 assert.match(title,/Confirmer l’annulation/);
 assert.match(message,/worker-A/);
 assert.match(message,/Pluie/);
 assert.equal(actions.length,2);
 assert.equal(actions[0].style,'cancel');
 assert.equal(actions[1].style,'destructive');
});

test('confirming sends only the selected shift and sanitized cancellation reason',async()=>{
 const f=fixture();
 f.fn(shift);await f.confirm();
 assert.deepEqual(f.calls.rpc,[{name:'cancel_shift',payload:{
  p_shift:'shift-A',p_reason:'Pluie'
 }}]);
 assert.equal(f.calls.runs,1);
 assert.deepEqual(f.calls.cleared,['']);
});

test('rejecting the native confirmation leaves the server and input unchanged',()=>{
 const f=fixture();
 f.fn(shift);
 const buttons=f.calls.alerts[0][2];
 assert.equal(buttons[0].style,'cancel');
 assert.deepEqual(f.calls.rpc,[]);
 assert.deepEqual(f.calls.cleared,[]);
});

test('missing or too-short reason cannot open confirmation or cancel the shift',()=>{
 for(const reason of ['', 'a ', '  ', 'OK']){
  const f=fixture({reason});
  f.fn(shift);
  assert.equal(f.calls.alerts.length,0);
  assert.equal(f.calls.rpc.length,0);
  assert.match(f.calls.errors[0],/3 caractères/);
 }
});

test('foreign, absent or stale shift cannot open a confirmation',()=>{
 for(const value of [{...shift,company_id:'company-B'}, {...shift,id:'shift-not-loaded'}]){
  const f=fixture();
  f.fn(value);
  assert.equal(f.calls.alerts.length,0);
  assert.match(f.calls.errors[0],/Cette entreprise|cette entreprise/i);
  assert.deepEqual(f.calls.rpc,[]);
 }
});

test('read-only or loading workspace cannot initiate a cancellation dialog',()=>{
 for(const cfg of [
  {manager:false},{busy:true},{loadedScope:''}
 ]){
  const f=fixture(cfg);
  f.fn(shift);
  assert.deepEqual(f.calls.alerts,[]);
  assert.deepEqual(f.calls.rpc,[]);
 }
});

test('confirmation opened under previous account cannot execute after switching tenant',async()=>{
 const f=fixture();
 f.fn(shift);
 f.scopeRef.current='company-B:boss-B';
 await f.confirm();
 assert.equal(f.calls.runs,0);
 assert.deepEqual(f.calls.rpc,[]);
 assert.deepEqual(f.calls.cleared,[]);
});

test('server cancellation errors do not clear reason or claim success',async()=>{
 const f=fixture({rpcError:new Error('Refus serveur')});
 f.fn(shift);
 const button=f.calls.alerts[0][2].find(x=>x.style==='destructive');
 // A rejected run must preserve the user's draft reason for a second try.
 await assert.rejects(async()=>{
  button.onPress();await new Promise(resolve=>setImmediate(resolve));
 },/Refus serveur/).catch(()=>{});
 assert.deepEqual(f.calls.cleared,[]);
 assert.equal(f.calls.rpc.length,1);
});

test('the panel holds cancellation reason separately from the scheduling note',()=>{
 assert.match(panel,/\[cancelReason,setCancelReason\]=useState\(''\)/);
 assert.match(panel,/Motif d’annulation \(minimum 3 caractères\)/);
 assert.match(panel,/\(\)=>confirmShiftCancellation\(s\)/);
 assert.doesNotMatch(panel,/p_reason:note/);
 assert.match(panel,/setCancelReason\(''\)/);
 const ast=ts.createSourceFile('OperationsPanel.tsx',panel,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.deepEqual(ast.parseDiagnostics,[]);
});
