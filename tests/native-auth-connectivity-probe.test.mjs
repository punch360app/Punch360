import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const gate=readFileSync(new URL('../src/auth/AuthGate.tsx',import.meta.url),'utf8');
const from=gate.indexOf(' async function refresh(){');
const to=gate.indexOf(' async function selectWorkspace(',from);
assert.ok(from>=0&&to>from,'Native login refresh must exist');
const compiled=ts.transpileModule(gate.slice(from,to),{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None
}}).outputText;
const userId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const companyId='tenant-A';
const workspace={companyId,userId,companyName:'Verified site',role:'employee'};
const localWorkspace={...workspace,companyName:'Saved site'};
const session={access_token:'verified-token',user:{id:userId}};
function fixture({network='throws',authValid=true,signedOut=false}={}){
 const counters={network:0,local:0,workspaceCache:0,session:0,user:0,members:0,remember:0};
 const state={account:null,error:'',session:null,workspaces:[],boot:true};
 const setters={
  setError:x=>{state.error=x},
  setAccount:x=>{state.account=x},
  setSession:x=>{state.session=x},
  setWorkspaces:x=>{state.workspaces=x},
  setShowWorkspacePicker:()=>{},
  setBoot:x=>{state.boot=x}
 };
 const Network={getNetworkStateAsync:async()=>{
  counters.network++;
  if(network==='throws')throw Error('expo-network unavailable');
  if(network==='offline')return {isConnected:false,isInternetReachable:false};
  if(network==='unknown')return {isConnected:true,isInternetReachable:null};
  return {isConnected:true,isInternetReachable:true};
 }};
 const cachedLocalIdentity=async()=>{counters.local++;return {id:userId}};
 const cachedWorkspace=async()=>{counters.workspaceCache++;return localWorkspace};
 const supabase={auth:{
  getSession:async()=>{counters.session++;return {data:{session},error:null}},
  getUser:async token=>{
   assert.equal(token,session.access_token);counters.user++;
   return authValid?{data:{user:{id:userId}},error:null}:
    {data:{user:null},error:{message:'revoked'}};
  }},
  from:table=>{
   assert.equal(table,'company_members');counters.members++;
   const query={select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,
    then:(resolve,reject)=>Promise.resolve({data:[{user_id:userId,company_id:companyId}],error:null}).then(resolve,reject)};
   return query;
  }
 };
 const AsyncStorage={getItem:async()=>companyId,setItem:async()=>{},removeItem:async()=>{}};
 const {setError,setAccount,setSession,setWorkspaces,setShowWorkspacePicker,setBoot}=setters;
 const authRevision={current:0},explicitlySignedOut={current:signedOut};
 const mayRestoreCachedWorkspace=(requested,current,blocked)=>requested===current&&!blocked;
 const listVerifiedWorkspaces=()=>[workspace];
 const chooseVerifiedWorkspace=()=>workspace;
 const requireServerVerifiedIdentity=(suppliedSession,response)=>{
  if(!suppliedSession?.access_token||response?.error||
   response?.data?.user?.id!==suppliedSession.user.id)throw Error('AUTH_SERVER_IDENTITY_UNVERIFIED');
  return response.data.user;
 };
 const rememberLocalIdentity=async()=>{counters.remember++};
 const refresh=new Function('authRevision','explicitlySignedOut','mayRestoreCachedWorkspace',
  'setError','Network','setWorkspaces','setAccount','setShowWorkspacePicker','setSession',
  'cachedLocalIdentity','cachedWorkspace','supabase','requireServerVerifiedIdentity',
  'MEMBERSHIP_COLUMNS','listVerifiedWorkspaces','AsyncStorage','chooseVerifiedWorkspace',
  'rememberLocalIdentity','setBoot',compiled+'\nreturn refresh;')(
  authRevision,explicitlySignedOut,mayRestoreCachedWorkspace,
  setError,Network,setWorkspaces,setAccount,setShowWorkspacePicker,setSession,
  cachedLocalIdentity,cachedWorkspace,supabase,requireServerVerifiedIdentity,
  'company_members',listVerifiedWorkspaces,AsyncStorage,chooseVerifiedWorkspace,
  rememberLocalIdentity,setBoot
 );
 return {refresh,state,counters};
}

test('Expo login recovers from network probe failure using verified server Auth only',async()=>{
 const f=fixture();
 await f.refresh();
 assert.equal(f.state.account.companyName,'Verified site');
 assert.equal(f.counters.local,0);
 assert.equal(f.counters.workspaceCache,0);
 assert.equal(f.counters.session,1);
 assert.equal(f.counters.user,1);
 assert.equal(f.counters.members,1);
 assert.equal(f.counters.remember,1);
 assert.equal(f.state.boot,false);
});

test('unknown network reachability never selects an unverified cached workspace',async()=>{
 const f=fixture({network:'unknown'});
 await f.refresh();
 assert.equal(f.state.account.companyName,'Verified site');
 assert.equal(f.counters.local,0);
 assert.equal(f.counters.members,1);
});

test('an offline state explicitly confirmed by Expo restores only the local workspace',async()=>{
 const f=fixture({network:'offline'});
 await f.refresh();
 assert.equal(f.state.account.companyName,'Saved site');
 assert.equal(f.counters.local,1);
 assert.equal(f.counters.workspaceCache,1);
 assert.equal(f.counters.user,0);
 assert.equal(f.counters.members,0);
 assert.equal(f.state.boot,false);
});

test('revoked Auth after probe failure cannot restore a saved workspace',async()=>{
 const f=fixture({authValid:false});
 await f.refresh();
 assert.equal(f.state.account,null);
 assert.equal(f.counters.local,0);
 assert.equal(f.counters.workspaceCache,0);
 assert.equal(f.counters.members,0);
 assert.match(f.state.error,/Identité ou accès non vérifié/);
 assert.equal(f.state.boot,false);
});

test('a signed-out generation cannot restore local identity or verified server membership',async()=>{
 const f=fixture({signedOut:true,network:'throws'});
 await f.refresh();
 assert.equal(f.counters.local,0);
 assert.equal(f.counters.user,0);
 assert.equal(f.counters.members,0);
 assert.equal(f.state.account,null);
});
