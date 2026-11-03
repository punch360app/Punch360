import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PunchJournal,projectPendingPunches,normalizeFreshPunchFix,hasUnsafePunchJournalEntries} from '../web/live/journal.js';

const api=readFileSync(new URL('../src/punch/api.ts',import.meta.url),'utf8');
// Exercise the actual Expo implementation with injected Expo dependencies,
// rather than asserting solely that a particular source expression exists.
function nativeFunction(start,end,name,dependencies){
 const a=api.indexOf(start),b=api.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Expected native implementation: '+name);
 const code=api.slice(a,b).replace(/^export /,'');
 const compiled=ts.transpileModule(code,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None
 }}).outputText;
 return new Function(...Object.keys(dependencies),compiled+'\nreturn '+name+';')(
  ...Object.values(dependencies));
}
function fixture({connectivity='offline',damaged=false}={}){
 const company='tenant-A',user='worker-A',job='site-A';
 let network=connectivity,queries=0,writes=0,reads=0,sequence=0;
 const sent=[],values=new Map();
 const storage={get:async key=>{reads++;return values.get(key)||null},
  set:async(key,value)=>{writes++;values.set(key,value)}};
 const journal=new PunchJournal({company,user,storage,uuid:()=> 'event-'+(++sequence),
  send:async event=>{sent.push(event.id);return {sync_status:'synced',review_status:'pending'}}});
 const snapshot={sessions:[{id:'shift-1',company_id:company,user_id:user,
  started_at:'2026-11-02T08:00:00Z',ended_at:null}],
  segments:[{id:'segment-1',session_id:'shift-1',company_id:company,job_id:job,
   started_at:'2026-11-02T08:00:00Z',ended_at:null}],breaks:[],
  active:null,lastJobId:job};
 const cache=new Map([['punch-state:'+user+':'+company,JSON.stringify(snapshot)]]);
 const AsyncStorage={getItem:async key=>cache.get(key)||null,
  setItem:async(key,value)=>{cache.set(key,value)}};
 const Network={getNetworkStateAsync:async()=>{
  if(network==='unknown')throw Error('Device network unavailable');
  if(network==='unverified')return {isConnected:true,isInternetReachable:null};
  return {isConnected:network==='online',isInternetReachable:network==='online'};
 }};
 const getLocalIdentity=async()=>({id:user});
 const getPunchJournal=async()=>journal;
 const supabase={from:()=>{queries++;throw Error('No server in isolated test')}};
 const load=nativeFunction('export async function loadPunchState(',
  'export type LocationCheckResult','loadPunchState',
  {getLocalIdentity,getPunchJournal,Network,AsyncStorage,projectPendingPunches,supabase});
 const capture=nativeFunction('async function punchWithLocation(',
  'export const punchIn=','punchWithLocation',
  {getLocalIdentity,getPunchJournal,Network,
   Location:{requestForegroundPermissionsAsync:async()=>({status:'denied'})},
   normalizeFreshPunchFix,hasUnsafePunchJournalEntries});
 return {company,user,job,journal,values,cache,load,capture,sent,
  get writes(){return writes},get reads(){return reads},
  get queries(){return queries},setNetwork:value=>{network=value},
  corrupt:()=>values.set(journal.key,'[bad json')};
}

test('Expo offline refresh reads preserved punches without server calls or rewriting journal',async()=>{
 const f=fixture();
 await f.journal.append('out',null,null,'2026-11-02T17:00:00Z',false,true);
 const original=f.values.get(f.journal.key),writes=f.writes;
 const result=await f.load(f.company);
 assert.equal(result.readSource,'cache');
 assert.equal(result.localJournalBlocked,false);
 assert.equal(result.hasLocalProjection,true);
 assert.equal(result.hasAppliedLocalProjection,true);
 assert.equal(result.sessions[0].ended_at,'2026-11-02T17:00:00Z');
 assert.equal(result.baselineSnapshot.sessions[0].ended_at,null);
 assert.equal(f.queries,0);
 assert.deepEqual(f.sent,[]);
 assert.equal(f.writes,writes);
 assert.equal(f.values.get(f.journal.key),original);
 // A second foreground refresh must not mutate the preserved event.
 await f.load(f.company);
 assert.equal(f.values.get(f.journal.key),original);
 assert.deepEqual(f.sent,[]);
});

test('Expo unknown network status preserves local hours and does not try to upload',async()=>{
 const f=fixture({connectivity:'unknown'});
 await f.journal.append('out',null,null,'2026-11-02T17:00:00Z',false,true);
 const writes=f.writes;
 const state=await f.load(f.company);
 assert.equal(state.readSource,'cache');
 assert.equal(state.localJournalBlocked,false);
 assert.equal(state.hasLocalProjection,true);
 assert.equal(f.writes,writes);
 assert.equal(f.queries,0);
 assert.deepEqual(f.sent,[]);
});

test('Expo mobile connectivity without verified Internet never flushes saved events',async()=>{
 const f=fixture({connectivity:'unverified'});
 await f.journal.append('out',null,null,'2026-11-02T17:00:00Z',false,true);
 const bytes=f.values.get(f.journal.key),writes=f.writes;
 const state=await f.load(f.company);
 assert.equal(state.readSource,'cache');
 assert.equal(state.localJournalBlocked,false);
 assert.equal(state.hasLocalProjection,true);
 assert.equal(f.queries,0);
 assert.deepEqual(f.sent,[]);
 assert.equal(f.writes,writes);
 assert.equal(f.values.get(f.journal.key),bytes);
 const punch=await f.capture(f.company,'in',f.job);
 assert.equal(punch.queued,true);
 assert.deepEqual(f.sent,[]);
 assert.deepEqual((await f.journal.read()).map(e=>e.status),['pending','pending']);
});

test('Expo unreadable journal stays blocked; official cache stays available for viewing',async()=>{
 const f=fixture({connectivity:'offline'});
 f.corrupt();
 const original=f.values.get(f.journal.key),writes=f.writes;
 const state=await f.load(f.company);
 assert.equal(state.readSource,'cache');
 assert.equal(state.localJournalBlocked,true);
 assert.equal(state.hasLocalProjection,false);
 assert.equal(state.sessions[0].id,'shift-1');
 assert.equal(f.values.get(f.journal.key),original);
 assert.equal(f.writes,writes);
 assert.equal(f.queries,0);
 assert.deepEqual(f.sent,[]);
});

test('Expo offline capture persists before reconnect and reuses the identical event ID',async()=>{
 const f=fixture();
 const result=await f.capture(f.company,'in',f.job);
 assert.deepEqual(result,{queued:true,review_status:'local'});
 assert.deepEqual(f.sent,[]);
 const saved=await f.journal.read();
 assert.equal(saved[0].status,'pending');
 assert.equal(saved[0].offline,true);
 const firstBytes=f.values.get(f.journal.key);
 f.setNetwork('online');
 const synced=await f.journal.flush();
 assert.equal(synced.pending,0);
 assert.deepEqual(f.sent,['event-1']);
 assert.equal(synced.events[0].id,'event-1');
 assert.notEqual(f.values.get(f.journal.key),firstBytes);
 await f.journal.flush();
 assert.deepEqual(f.sent,['event-1'],'Acknowledged punch cannot be uploaded twice');
});

test('Expo online refresh may flush after reconnect, but never claims official hours on server read failure',async()=>{
 const f=fixture();
 await f.journal.append('out',null,null,'2026-11-02T17:00:00Z',false,true);
 f.setNetwork('online');
 const state=await f.load(f.company);
 assert.deepEqual(f.sent,['event-1']);
 assert.equal(state.readSource,'cache');
 assert.equal(state.localJournalBlocked,false);
 assert.equal(state.hasLocalProjection,false);
 assert.equal(f.queries,1);
});
