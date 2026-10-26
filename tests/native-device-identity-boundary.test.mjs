import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const gateSource=readFileSync(new URL('../src/auth/deviceIdentityGate.ts',import.meta.url),'utf8');
const output=ts.transpileModule(gateSource,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const {selectNativeDeviceIdentity}=await import('data:text/javascript;base64,'+
 Buffer.from(output).toString('base64'));

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const cached={id,email:'old@example.invalid'};
const fresh={id,email:'current@example.invalid'};

test('explicit offline mode preserves pending punch identity without contacting Auth',async()=>{
 let onlineCalls=0,offlineCalls=0;
 const result=await selectNativeDeviceIdentity(true,async()=>{offlineCalls++;return cached;},async()=>{onlineCalls++;return fresh;});
 assert.equal(result,cached);
 assert.equal(offlineCalls,1);
 assert.equal(onlineCalls,0);
});

test('online mode NEVER consults cached identity even if Auth validation fails',async()=>{
 for(const offline of [false,undefined,null,'false']){
  let cachedCalls=0,onlineCalls=0;
  await assert.rejects(
   selectNativeDeviceIdentity(offline,async()=>{cachedCalls++;return cached;},async()=>{onlineCalls++;throw Error('AUTH_REVOKED');}),
   /AUTH_REVOKED/
  );
  assert.equal(cachedCalls,0,'no offline cache on an online Auth error');
  assert.equal(onlineCalls,1);
 }
});

test('online mode uses verified identity rather than locally remembered role hints',async()=>{
 let cachedCalls=0;
 const result=await selectNativeDeviceIdentity(false,async()=>{cachedCalls++;return cached;},async()=>fresh);
 assert.equal(result,fresh);
 assert.equal(cachedCalls,0);
});

test('offline cache must contain a valid user identifier',async()=>{
 for(const invalid of [null,{},[],{id:'boss'},{id:''},{id:123},{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\n'}]){
  await assert.rejects(selectNativeDeviceIdentity(true,async()=>invalid,async()=>fresh),/OFFLINE_IDENTITY_UNAVAILABLE/);
 }
});

test('native punch/jobs identity path checks live getUser before accepting online identity',()=>{
 const source=readFileSync(new URL('../src/auth/localIdentity.ts',import.meta.url),'utf8');
 const local=source.slice(source.indexOf('export async function getLocalIdentity()'));
 assert.match(local,/network\.isConnected===false\|\|network\.isInternetReachable===false/);
 assert.match(local,/selectNativeDeviceIdentity\(offline,cachedLocalIdentity,async\(\)=>/);
 assert.match(local,/supabase\.auth\.getSession\(\)/);
 assert.match(local,/if\(error\|\|!data\.session\)throw Error\('IDENTITY_VERIFICATION_REQUIRED'\)/);
 assert.match(local,/supabase\.auth\.getUser\(data\.session\.access_token\)/);
 assert.match(local,/requireServerVerifiedIdentity\(data\.session,verified\)/);
 assert.doesNotMatch(local,/if\(error\)\{const local=await cachedLocalIdentity/);
 assert.doesNotMatch(local,/rememberLocalIdentity\(data\.session\.user\)/);
});

test('malformed offline JSON does not crash a worker identity resolver',()=>{
 const source=readFileSync(new URL('../src/auth/localIdentity.ts',import.meta.url),'utf8');
 assert.match(source,/export async function cachedLocalIdentity\(\)/);
 assert.match(source,/try\{[\s\S]*?JSON\.parse\(raw\)[\s\S]*?\}catch\{return null;\}/);
});
