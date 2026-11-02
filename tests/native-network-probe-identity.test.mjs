import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function nativeExport(path,name){
 const code=readFileSync(new URL(path,import.meta.url),'utf8');
 const js=ts.transpileModule(code,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
 }}).outputText;
 const exports={};
 new Function('exports',js)(exports);
 assert.equal(typeof exports[name],'function',path+' must export '+name);
 return exports[name];
}
const selectNativeDeviceIdentity=nativeExport('../src/auth/deviceIdentityGate.ts','selectNativeDeviceIdentity');
const requireServerVerifiedIdentity=nativeExport('../src/auth/serverVerifiedIdentity.ts','requireServerVerifiedIdentity');
const source=readFileSync(new URL('../src/auth/localIdentity.ts',import.meta.url),'utf8');
const start=source.indexOf('export async function getLocalIdentity()');
assert.ok(start>=0,'Native local identity method required');
const native=ts.transpileModule(source.slice(start).replace('export async function','async function'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
}).outputText;

const personA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const personB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture({state='offline',cached={id:personA},user=personA,
 token='session-token',authError=null,sessionError=null}={}){
 let network=state,identity=user,rejectAuth=authError,sessionFailure=sessionError;
 const calls={network:0,cached:0,session:0,user:0};
 const cachedLocalIdentity=async()=>{calls.cached++;return cached};
 const Network={getNetworkStateAsync:async()=>{
  calls.network++;
  if(network==='throws')throw Error('Expo connectivity probe failed');
  if(network==='offline')return {isConnected:false,isInternetReachable:false};
  if(network==='unknown')return {isConnected:true,isInternetReachable:null};
  if(network==='disconnected')return {isConnected:false,isInternetReachable:true};
  return {isConnected:true,isInternetReachable:true};
 }};
 const session={access_token:token,user:{id:personA}};
 const supabase={auth:{
  getSession:async()=>{calls.session++;return sessionFailure?
   {data:{session:null},error:sessionFailure}:{data:{session},error:null}},
  getUser:async(accessToken)=>{calls.user++;
   assert.equal(accessToken,token);
   return {data:{user:identity?{id:identity}:null},error:rejectAuth};
  }
 }};
 const getLocalIdentity=new Function('Network','cachedLocalIdentity','selectNativeDeviceIdentity',
  'supabase','requireServerVerifiedIdentity',native+'\nreturn getLocalIdentity;')(
  Network,cachedLocalIdentity,selectNativeDeviceIdentity,supabase,requireServerVerifiedIdentity);
 return {getLocalIdentity,calls,
  setState:value=>{network=value},
  setUser:value=>{identity=value},
  setAuthError:value=>{rejectAuth=value}};
}

test('confirmed offline Expo can read a previously verified local identity',async()=>{
 const f=fixture();
 assert.deepEqual(await f.getLocalIdentity(),{id:personA});
 assert.deepEqual(f.calls,{network:1,cached:1,session:0,user:0});
});

test('Expo probe failure verifies online server identity without reading the cached user',async()=>{
 const f=fixture({state:'throws',cached:{id:personB}});
 const identity=await f.getLocalIdentity();
 assert.equal(identity.id,personA);
 assert.deepEqual(f.calls,{network:1,cached:0,session:1,user:1});
});

test('unknown Internet reachability is not evidence of offline access',async()=>{
 const f=fixture({state:'unknown',cached:{id:personB}});
 assert.equal((await f.getLocalIdentity()).id,personA);
 assert.equal(f.calls.cached,0);
 assert.equal(f.calls.user,1);
});

test('Expo probe failure plus missing or revoked server identity refuses cached fallback',async()=>{
 for(const config of [{state:'throws',authError:{message:'revoked'}},
  {state:'throws',sessionError:Error('offline')},
  {state:'unknown',user:personB}]){
  const f=fixture(config);
  await assert.rejects(f.getLocalIdentity(),/AUTH_SERVER_IDENTITY_UNVERIFIED|IDENTITY_VERIFICATION_REQUIRED/);
  assert.equal(f.calls.cached,0,'Server uncertainty must not authorize local identity');
 }
});

test('probe recovery can use offline cache only when a later state is explicitly offline',async()=>{
 const f=fixture({state:'throws',authError:{message:'offline'}});
 await assert.rejects(f.getLocalIdentity(),/AUTH_SERVER_IDENTITY_UNVERIFIED/);
 assert.equal(f.calls.cached,0);
 f.setState('offline');
 assert.equal((await f.getLocalIdentity()).id,personA);
 assert.equal(f.calls.cached,1);
});

test('offline cache rejects invalid identity even after failed network probe and recovery',async()=>{
 const f=fixture({state:'offline',cached:{id:'not-a-uuid'}});
 await assert.rejects(f.getLocalIdentity(),/OFFLINE_IDENTITY_UNAVAILABLE/);
 assert.equal(f.calls.session,0);
});
