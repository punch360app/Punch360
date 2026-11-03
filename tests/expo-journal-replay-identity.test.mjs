import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PunchJournal} from '../web/live/journal.js';

const native=readFileSync(new URL('../src/punch/journal.ts',import.meta.url),'utf8');
const begin=native.indexOf('const journals=new Map<string,PunchJournal>();');
const end=native.indexOf('export async function journalSummary(',begin);
assert.ok(begin>=0&&end>begin,'Expected shared native Expo journal factory');
const source=native.slice(begin,end).replace('export async function getPunchJournal','async function getPunchJournal');
const compiled=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None
}}).outputText;
function fixture({internet=true,authUser='employee-A',authError=null}={}){
 let online=internet,user=authUser,error=authError,serverCalls=0,authChecks=0,id=0;
 const storage=new Map(),sent=[];
 const AsyncStorage={getItem:async key=>storage.get(key)||null,
  setItem:async(key,value)=>storage.set(key,value)};
 const Network={getNetworkStateAsync:async()=>online===true?
  {isConnected:true,isInternetReachable:true}:online==='uncertain'?
  {isConnected:true,isInternetReachable:null}:{isConnected:false,isInternetReachable:false}};
 const supabase={auth:{getUser:async()=>{authChecks++;return {data:{user:user?{id:user}:null},error}}},
  rpc:(name,params)=>({abortSignal:async()=>{
   serverCalls++;sent.push({name,id:params.p_event,company:params.p_company});
   return {data:{sync_status:'synced',event_id:params.p_event},error:null};
  }})};
 const getLocalIdentity=async()=>({id:'employee-A'});
 const Crypto={randomUUID:()=>String(++id)};
 const getPunchJournal=new Function('Network','getLocalIdentity','AsyncStorage',
  'Crypto','supabase','PunchJournal',compiled+'\nreturn getPunchJournal;')(
  Network,getLocalIdentity,AsyncStorage,Crypto,supabase,PunchJournal);
 return {getPunchJournal,storage,sent,
  get authChecks(){return authChecks},get serverCalls(){return serverCalls},
  setUser:value=>{user=value},setError:value=>{error=value},
  setNetwork:value=>{online=value}};
}
const punch=async journal=>journal.append('in','site-A',null,'2026-11-02T08:00:00Z',false,true);

test('Expo replay sends only under the verified owner and keeps immutable event ID',async()=>{
 const f=fixture(),journal=await f.getPunchJournal('tenant-A');
 const event=await punch(journal);
 const synced=await journal.flush();
 assert.equal(synced.sent,1);assert.equal(synced.pending,0);
 assert.equal(f.authChecks,1);assert.equal(f.serverCalls,1);
 assert.deepEqual(f.sent,[{name:'sync_punch_event',id:event.id,company:'tenant-A'}]);
 await journal.flush();
 assert.equal(f.serverCalls,1,'Acknowledged event must not be replayed');
});

test('switching Expo login preserves old employee queue without sending it',async()=>{
 const f=fixture(),journal=await f.getPunchJournal('tenant-A');
 const event=await punch(journal);
 const bytes=f.storage.get(journal.key);
 f.setUser('employee-B');
 const blocked=await journal.flush();
 assert.equal(blocked.sent,0);assert.equal(blocked.pending,1);
 assert.equal(f.serverCalls,0);
 assert.equal((await journal.read())[0].id,event.id);
 assert.ok(f.storage.has(journal.key));
 assert.notEqual(f.storage.get(journal.key),null);
 assert.ok(bytes.includes(event.id));
 f.setUser('employee-A');
 const accepted=await journal.flush();
 assert.equal(accepted.pending,0);assert.equal(f.serverCalls,1);
 assert.equal(f.sent[0].id,event.id,'Retry must preserve event ID');
});

test('a revoked or unverifiable session never uploads queued Expo hours',async()=>{
 const f=fixture({authUser:null,authError:{message:'not verified'}});
 const journal=await f.getPunchJournal('tenant-A');
 await punch(journal);
 await journal.flush();
 assert.equal(f.serverCalls,0);
 assert.equal((await journal.pending()).length,1);
 f.setUser('employee-A');f.setError(null);
 await journal.flush();
 assert.equal(f.serverCalls,1);
});

test('an unverified Internet connection cannot dispatch pending native events',async()=>{
 const f=fixture({internet:'uncertain'}),journal=await f.getPunchJournal('tenant-A');
 const event=await punch(journal);
 await journal.flush();
 assert.equal(f.serverCalls,0);
 assert.equal(f.authChecks,0,'Never ask Auth to verify a network that is not reachable');
 assert.equal((await journal.pending())[0].id,event.id);
 f.setNetwork(true);
 await journal.flush();
 assert.equal(f.serverCalls,1);
});

test('native replay rejects event ownership mismatch before the RPC',async()=>{
 const f=fixture(),journal=await f.getPunchJournal('tenant-A');
 const event={id:'foreign-event',company:'tenant-B',user:'employee-B',
  action:'in',job:'site-B',fix:null,occurredAt:'2026-11-02T08:00:00Z',
  offline:true,status:'pending',previous:null};
 await assert.rejects(journal.send(event),/entreprise ou salarié/);
 assert.equal(f.authChecks,0);assert.equal(f.serverCalls,0);
 assert.equal(f.storage.size,0);
});
