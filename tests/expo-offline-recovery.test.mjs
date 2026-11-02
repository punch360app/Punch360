import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectPendingPunches} from '../web/live/journal.js';
const native=readFileSync(new URL('../src/punch/api.ts',import.meta.url),'utf8');
const essential=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const journal=readFileSync(new URL('../src/punch/journal.ts',import.meta.url),'utf8');
const a=native.indexOf('export async function loadPunchState('),b=native.indexOf('export type LocationCheckResult=',a);
assert.ok(a>=0&&b>a,'Expo loader not found');
const source=native.slice(a,b).replace('export async function loadPunchState(companyId:string):Promise<PunchState>{','async function loadPunchState(companyId){')
 .replace("const overlay=async(state:PunchState,readSource:'server'|'cache')=>",'const overlay=async(state,readSource)=>')
 .replace('let events:LocalPunchEvent[]=[];','let events=[];')
 .replace(' as PunchState','')
 .replace('const list=sessions as PunchSession[]||[];','const list=sessions||[];')
 .replace('const sorted=(segments||[]) as PunchSegment[];','const sorted=segments||[];');
const own={id:'own',company_id:'A',user_id:'U',started_at:'2026-11-02T08:00:00Z',ended_at:null};
const foreign={id:'foreign',company_id:'B',user_id:'V',started_at:'2026-11-02T09:00:00Z',ended_at:null};
const cached={sessions:[foreign,own],segments:[
 {id:'other-segment',company_id:'B',session_id:'foreign',job_id:'other-site',started_at:foreign.started_at,ended_at:null},
 {id:'own-segment',company_id:'A',session_id:'own',job_id:'my-site',started_at:own.started_at,ended_at:null}
],breaks:[],active:foreign,lastJobId:'other-site'};
function fixture({offline=true,flushFail=false,readFail=false,dbFail=false,networkStateFail=false,breakFail=false}={}){
 const store=new Map([['punch-state:U:A',JSON.stringify(cached)]]),calls={send:0,read:0,db:0};
 const offlineEvents=[{id:'out',company:'A',user:'U',action:'out',status:'pending',occurredAt:'2026-11-02T12:00:00Z'}];
 const j={flush:async()=>{calls.send++;if(flushFail)throw Error('Journal non vérifiable')},
  read:async()=>{calls.read++;if(readFail)throw Error('Journal illisible');return offlineEvents}};
 const storage={getItem:async key=>store.get(key)||null,setItem:async(k,v)=>store.set(k,v)};
 const network={getNetworkStateAsync:async()=>{if(networkStateFail)throw Error('Network status unavailable');return {isConnected:!offline,isInternetReachable:!offline}}};
 const supabase={from:table=>{
  const result=table==='punch_sessions'?{data:[own],error:dbFail?Error('offline'):null}:
   table==='punch_segments'?{data:[cached.segments[1]],error:null}:
   {data:[],error:breakFail?Error('Breaks unavailable'):null};
  const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,limit:()=>q,
   then:(ok,bad)=>{calls.db++;return Promise.resolve(result).then(ok,bad)}};
  return q;
 }};
 const load=new Function('getLocalIdentity','getPunchJournal','AsyncStorage',
  'Network','supabase','projectPendingPunches',source+'\nreturn loadPunchState;')(
  async()=>({id:'U'}),async()=>j,storage,network,supabase,projectPendingPunches);
 return {load,calls,store};
}
test('Expo offline blocked journal keeps scoped server snapshot only',async()=>{
 const h=fixture({flushFail:true}),s=await h.load('A');
 assert.equal(s.localJournalBlocked,true);
 assert.deepEqual(s.sessions.map(x=>x.id),['own']);
 assert.deepEqual(s.segments.map(x=>x.id),['own-segment']);
 assert.equal(s.active.id,'own');
 assert.equal(s.lastJobId,'my-site');
 assert.equal(h.calls.read,0);
});
test('Unreadable journal does not hide previous verified hours',async()=>{
 const s=await fixture({readFail:true}).load('A');
 assert.equal(s.localJournalBlocked,true);
 assert.equal(s.sessions[0].ended_at,null);
});
test('Healthy local OUT still projects to own hours, no foreign company rows',async()=>{
 const s=await fixture().load('A');
 assert.equal(s.localJournalBlocked,false);
 assert.equal(s.sessions[0].ended_at,'2026-11-02T12:00:00Z');
 assert.equal(s.sessions.find(x=>x.id==='foreign'),undefined);
});
test('Blocked journal does not stop live Supabase confirmation of hours',async()=>{
 const h=fixture({offline:false,flushFail:true}),s=await h.load('A');
 assert.equal(s.localJournalBlocked,true);
 assert.deepEqual(s.sessions.map(x=>x.id),['own']);
 assert.equal(h.calls.read,0);
 assert.equal(h.calls.db,3);
});
test('Network error falls back to scoped cached snapshot',async()=>{
 const s=await fixture({offline:false,flushFail:true,dbFail:true}).load('A');
 assert.equal(s.localJournalBlocked,true);
 assert.deepEqual(s.sessions.map(x=>x.id),['own']);
});
test('Both native workspace UI paths disable writes during journal recovery',()=>{
 assert.match(essential,/if\(busy\|\|!mobileAllowed\|\|punch\.localJournalBlocked\)return/);
 assert.match(essential,/disabled=\{busy\|\|!mobileAllowed\|\|punch\.localJournalBlocked\}/);
 assert.match(essential,/punch\.active&&mobileAllowed&&!punch\.localJournalBlocked/);
 assert.match(app,/disabled=\{journalBlocked\|\|working\|\|syncBusy\|\|journalViewScope!==currentScope\} onPress=\{togglePunch\}/);
 assert.match(app,/if\(journalBlocked\|\|journalViewScope!==currentScope\|\|working\|\|\s*punchActionInFlight\.current\|\|syncInFlight\.current\)\{/);
});
test('Journal summary and two mobile screens explicitly surface blocked status',()=>{
 assert.match(journal,/hasUnsafePunchJournalEntries\(events,j\.company,j\.user\)/);
 assert.match(journal,/catch\{return blocked\}/);
 assert.match(journal,/const blocked=\{pending:0,conflicts:0,blocked:true,pendingItems:\[\],conflictItems:\[\]\}/);
 assert.match(essential,/updated\.localJournalBlocked\|\|summary\.blocked/);
 assert.match(app,/const blocked=!!punch\.localJournalBlocked\|\|local\.blocked/);
});

test('Expo network-state failure retains worker-scoped cached hours without server requests',async()=>{
 const h=fixture({networkStateFail:true,flushFail:true}),state=await h.load('A');
 assert.equal(state.localJournalBlocked,true);
 assert.deepEqual(state.sessions.map(s=>s.id),['own']);
 assert.equal(state.lastJobId,'my-site');
 assert.equal(h.calls.db,0);
});
test('Expo network-state failure still projects valid local OUT when journal is healthy',async()=>{
 const h=fixture({networkStateFail:true}),state=await h.load('A');
 assert.equal(state.localJournalBlocked,false);
 assert.equal(state.sessions[0].ended_at,'2026-11-02T12:00:00Z');
 assert.equal(h.calls.db,0);
});
test('TypeScript local journal events must be typed rather than implicitly any',()=>{
 assert.match(native,/import type \{LocalPunchEvent\} from '\.\.\/\.\.\/web\/live\/journal.js'/);
 assert.match(native,/let events:LocalPunchEvent\[\]=\[\];/);
});

test('offline hours are labeled cache with local projection rather than server confirmed',async()=>{
 const s=await fixture().load('A');
 assert.equal(s.readSource,'cache');
 assert.equal(s.hasLocalProjection,true);
 assert.equal(s.localJournalBlocked,false);
});
test('complete live server reads are labeled server, but pending offline events remain provisional',async()=>{
 const s=await fixture({offline:false}).load('A');
 assert.equal(s.readSource,'server');
 assert.equal(s.hasLocalProjection,true);
});
test('blocked local journal has no pending projection and keeps cache identity scope',async()=>{
 const s=await fixture({flushFail:true}).load('A');
 assert.equal(s.readSource,'cache');
 assert.equal(s.hasLocalProjection,false);
});
test('sessions query failure is not called a fresh server snapshot',async()=>{
 const s=await fixture({offline:false,dbFail:true}).load('A');
 assert.equal(s.readSource,'cache');
});
test('breaks query failure reuses last complete cached snapshot, not partial fresh hours',async()=>{
 const s=await fixture({offline:false,breakFail:true}).load('A');
 assert.equal(s.readSource,'cache');
 assert.deepEqual(s.sessions.map(x=>x.id),['own']);
});
test('Expo hours and home clearly label cache, projected time and server origin without approval claim',()=>{
 assert.match(essential,/Dernier relevé sauvegardé sur cet appareil/);
 assert.match(essential,/Relevé serveur \+ pointages locaux en attente/);
 assert.match(essential,/Total indicatif · les heures restent sujettes à validation/);
 assert.match(essential,/punch\.readSource==='cache'\?'Copie locale'/);
 assert.match(app,/punch\.readSource==='server'\?'Dernier relevé serveur · heures sujettes à validation'/);
});
