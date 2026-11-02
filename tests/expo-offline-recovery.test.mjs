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
 .replace("const overlay=async(state:PunchState,readSource:'server'|'cache',cacheWriteFailed=false)=>",'const overlay=async(state,readSource,cacheWriteFailed=false)=>')
 .replace('let events:LocalPunchEvent[]=[];','let events=[];')
 .replace('let cached:PunchState|null=null;','let cached=null;')
 .replaceAll('(row:Record<string,unknown>|null)=>','(row)=>')
 .replace(' as PunchState','')
 .replace('const list=sessions as PunchSession[]||[];','const list=sessions||[];')
 .replace('const sorted=(segments||[]) as PunchSegment[];','const sorted=segments||[];')
 .replace('const list=((sessions||[]) as PunchSession[]).filter','const list=(sessions||[]).filter')
 .replace('const sorted=((segments||[]) as PunchSegment[]).filter','const sorted=(segments||[]).filter')
 .replace('const ownBreaks=((breakResult.data||[]) as PunchBreak[]).filter','const ownBreaks=(breakResult.data||[]).filter');
const own={id:'own',company_id:'A',user_id:'U',started_at:'2026-11-02T08:00:00Z',ended_at:null};
const foreign={id:'foreign',company_id:'B',user_id:'V',started_at:'2026-11-02T09:00:00Z',ended_at:null};
const cached={sessions:[foreign,own],segments:[
 {id:'other-segment',company_id:'B',session_id:'foreign',job_id:'other-site',started_at:foreign.started_at,ended_at:null},
 {id:'own-segment',company_id:'A',session_id:'own',job_id:'my-site',started_at:own.started_at,ended_at:null}
],breaks:[],active:foreign,lastJobId:'other-site'};
function fixture({offline=true,flushFail=false,readFail=false,dbFail=false,networkStateFail=false,breakFail=false,writeFail=false,emptyServer=false,serverMixed=false,rawCache=undefined,malformedTable='',malformedData=null,rejectTable='',throwTable=''}={}){
 const store=new Map(),calls={send:0,read:0,db:0};
 if(rawCache!==null)store.set('punch-state:U:A',rawCache===undefined?JSON.stringify(cached):rawCache);
 const offlineEvents=[{id:'out',company:'A',user:'U',action:'out',status:'pending',occurredAt:'2026-11-02T12:00:00Z'}];
 const j={flush:async()=>{calls.send++;if(flushFail)throw Error('Journal non vérifiable')},
  read:async()=>{calls.read++;if(readFail)throw Error('Journal illisible');return offlineEvents}};
 const storage={getItem:async key=>store.get(key)||null,setItem:async(k,v)=>{if(writeFail)throw Error('cache saturé');store.set(k,v)}};
 const network={getNetworkStateAsync:async()=>{if(networkStateFail)throw Error('Network status unavailable');return {isConnected:!offline,isInternetReachable:!offline}}};
 const supabase={from:table=>{
  if(table===throwTable)throw Error('Supabase query construction failed');
  const result=table==='punch_sessions'?{data:emptyServer?[]:serverMixed?[foreign,own]:[own],error:dbFail?Error('offline'):null}:
   table==='punch_segments'?{data:serverMixed?cached.segments:[cached.segments[1]],error:null}:
   {data:serverMixed?[
    {id:'other-break',session_id:'foreign',started_at:foreign.started_at,ended_at:null},
    {id:'own-break',session_id:'own',started_at:own.started_at,ended_at:null}
   ]:[],error:breakFail?Error('Breaks unavailable'):null};
  if(table===malformedTable)result.data=malformedData;
  const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,limit:()=>q,
   then:(ok,bad)=>{calls.db++;return (table===rejectTable?Promise.reject(Error('Supabase transport unavailable')):Promise.resolve(result)).then(ok,bad)}};
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
 assert.match(essential,/if\(busy\|\|punchActionInFlight\.current\|\|syncInFlight\.current\|\|!mobileAllowed\|\|journalBlocked\)return/);
 assert.match(essential,/disabled=\{busy\|\|!mobileAllowed\|\|journalBlocked\|\|\(!punch\.active&&!siteJob\)\}/);
 assert.match(essential,/punch\.active&&mobileAllowed&&!journalBlocked/);
 assert.match(essential,/setJournalBlocked\(!!updated\.localJournalBlocked\|\|summary\.blocked\)/);
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

test('online official hours survive device cache write failure',async()=>{
 const h=fixture({offline:false,writeFail:true}),state=await h.load('A');
 assert.equal(state.readSource,'server');
 assert.equal(state.cacheWriteFailed,true);
 assert.deepEqual(state.sessions.map(s=>s.id),['own']);
 assert.deepEqual(state.segments.map(s=>s.id),['own-segment']);
 assert.equal(h.calls.db,3);
});
test('online empty punch session result survives device cache write failure',async()=>{
 const h=fixture({offline:false,writeFail:true,emptyServer:true}),state=await h.load('A');
 assert.equal(state.readSource,'server');
 assert.deepEqual(state.sessions,[]);assert.equal(state.active,null);
 assert.equal(state.cacheWriteFailed,true);
 assert.equal(h.calls.db,1);
});

test('successful server and offline reads do not report failed snapshot writes',async()=>{
 assert.equal((await fixture({offline:false}).load('A')).cacheWriteFailed,false);
 assert.equal((await fixture({offline:true}).load('A')).cacheWriteFailed,false);
});
test('Construction and Essential warn when a verified snapshot cannot be cached',()=>{
 assert.match(native,/cacheWriteFailed\?:boolean/);
 assert.match(app,/cacheWriteFailed\?'Relevé serveur reçu · copie hors ligne indisponible/);
 assert.match(essential,/cacheWriteFailed\?'Relevé serveur · copie hors ligne indisponible/);
});

test('offline first launch cannot mistake missing hours for an empty server workday',async()=>{
 const h=fixture({rawCache:null}),state=await h.load('A');
 assert.equal(state.snapshotUnverified,true);assert.equal(state.localJournalBlocked,true);
 assert.equal(state.readSource,'cache');assert.equal(h.calls.db,0);
});
test('corrupted cached hours remain on disk and fail closed',async()=>{
 const h=fixture({rawCache:'{"sessions":'}),state=await h.load('A');
 assert.equal(state.snapshotUnverified,true);assert.equal(state.localJournalBlocked,true);
 assert.equal(h.store.get('punch-state:U:A'),'{"sessions":');
});
test('legacy incomplete or structurally invalid snapshots fail closed',async()=>{
 for(const rawCache of ['null','{}','{"sessions":{},"segments":[]}','{"sessions":[null],"segments":[]}']){
  const state=await fixture({rawCache}).load('A');
  assert.equal(state.snapshotUnverified,true);assert.equal(state.localJournalBlocked,true);
 }
});
test('offline absent cache after server failure is not verified',async()=>{
 const state=await fixture({offline:false,dbFail:true,rawCache:null}).load('A');
 assert.equal(state.snapshotUnverified,true);assert.equal(state.readSource,'cache');
});
test('fresh server read recovers from an invalid local cache',async()=>{
 const state=await fixture({offline:false,rawCache:'invalid json'}).load('A');
 assert.equal(state.snapshotUnverified,false);assert.equal(state.localJournalBlocked,false);
 assert.equal(state.readSource,'server');
 assert.deepEqual(state.sessions.map(s=>s.id),['own']);
});
test('valid cached and server snapshots are still verified',async()=>{
 assert.equal((await fixture().load('A')).snapshotUnverified,false);
 assert.equal((await fixture({offline:false}).load('A')).snapshotUnverified,false);
});
test('both mobile UIs distinguish a damaged cache from a blocked journal',()=>{
 assert.match(native,/snapshotUnverified\?:boolean/);
 assert.match(native,/localJournalBlocked:journalBlocked\|\|snapshotUnverified/);
 assert.match(app,/punch\.snapshotUnverified\?'Relevé hors ligne introuvable ou illisible/);
 assert.match(essential,/punch\.snapshotUnverified\?'Relevé hors ligne introuvable ou illisible/);
});

// Confirm the bytes saved to AsyncStorage are tenant-scoped, not just the
// in-memory projection; old mixed responses must never be persisted verbatim.
test('Expo filters foreign RPC rows before persisting the offline snapshot',async()=>{
 const h=fixture({offline:false,serverMixed:true});
 const state=await h.load('A');
 assert.deepEqual(state.sessions.map(s=>s.id),['own']);
 assert.deepEqual(state.segments.map(s=>s.id),['own-segment']);
 assert.deepEqual(state.breaks.map(b=>b.id),['own-break']);
 const stored=JSON.parse(h.store.get('punch-state:U:A'));
 assert.deepEqual(stored.sessions.map(s=>s.id),['own']);
 assert.deepEqual(stored.segments.map(s=>s.id),['own-segment']);
 assert.deepEqual(stored.breaks.map(b=>b.id),['own-break']);
 assert.equal(stored.lastJobId,'my-site');
 assert.equal(state.readSource,'server');
});

test('Expo rejects incomplete server arrays and preserves the last cached hours',async()=>{
 for(const table of ['punch_sessions','punch_segments','punch_breaks']){
  for(const malformedData of [null,{}]){
   const h=fixture({offline:false,malformedTable:table,malformedData});
   const state=await h.load('A');
   assert.equal(state.readSource,'cache',table+' '+String(malformedData));
   assert.equal(state.snapshotUnverified,false,table);
   assert.deepEqual(state.sessions.map(s=>s.id),['own'],table);
   assert.deepEqual(state.segments.map(s=>s.id),['own-segment'],table);
   assert.equal(state.lastJobId,'my-site',table);
  }
 }
});

test('Expo rejects an incomplete online response with no cached hours, without treating it as an empty shift',async()=>{
 const state=await fixture({offline:false,rawCache:null,malformedTable:'punch_sessions'}).load('A');
 assert.equal(state.readSource,'cache');
 assert.equal(state.snapshotUnverified,true);
 assert.equal(state.localJournalBlocked,true);
 assert.deepEqual(state.sessions,[]);
});

test('a valid empty sessions array remains a confirmed server read',async()=>{
 const state=await fixture({offline:false,emptyServer:true}).load('A');
 assert.equal(state.readSource,'server');
 assert.equal(state.snapshotUnverified,false);
 assert.deepEqual(state.sessions,[]);
});

test('Expo rejects malformed attendance rows without erasing a valid cached shift',async()=>{
 const validRows={
  punch_sessions:{...own},
  punch_segments:{...cached.segments[1]},
  punch_breaks:{id:'break-a',session_id:'own',started_at:own.started_at,ended_at:null}
 };
 for(const [table,valid] of Object.entries(validRows)){
  for(const badRow of [null,{}, {...valid,id:''},
   {...valid,started_at:'bad-date'},
   {...valid,ended_at:'2026-11-01T06:00:00Z'}]){
   const h=fixture({offline:false,malformedTable:table,malformedData:[badRow]});
   const state=await h.load('A');
   assert.equal(state.readSource,'cache',table+': '+JSON.stringify(badRow));
   assert.equal(state.snapshotUnverified,false,table);
   assert.deepEqual(state.sessions.map(s=>s.id),['own'],table);
   assert.deepEqual(state.segments.map(s=>s.id),['own-segment'],table);
   assert.equal(state.lastJobId,'my-site',table);
   // A malformed response must not replace a worker's last cached snapshot.
   assert.deepEqual(JSON.parse(h.store.get('punch-state:U:A')),cached);
  }
 }
});

test('invalid session rows without a previous offline snapshot remain unverified',async()=>{
 const h=fixture({offline:false,rawCache:null,malformedTable:'punch_sessions',
  malformedData:[{...own,started_at:'invalid'}]});
 const state=await h.load('A');
 assert.equal(state.readSource,'cache');
 assert.equal(state.snapshotUnverified,true);
 assert.equal(state.localJournalBlocked,true);
 assert.deepEqual(state.sessions,[]);
 assert.equal(h.store.has('punch-state:U:A'),false);
});

test('Essentiel manual punch synchronization reports a cached fallback as unconfirmed',()=>{
 const from=essential.indexOf('export function essentialManualPunchSyncNotice(');
 const to=essential.indexOf('export function EssentialWorkspace(',from);
 assert.ok(from>=0&&to>from,'Missing native Essentiel sync notice');
 const source=essential.slice(from,to);
 const begin=source.indexOf('}):string{');
 assert.ok(begin>=0,'Expected typed native notice function');
 const body=source.slice(begin+'}):string{'.length,source.lastIndexOf('\n}'));
 const message=new Function('blocked','pending','conflicts','readSource','cacheWriteFailed',body);
 assert.match(essential,/setNotice\(essentialManualPunchSyncNotice\(\{/);
 assert.match(essential,/readSource:updated\.readSource/);
 assert.match(essential,/cacheWriteFailed:!!updated\.cacheWriteFailed/);
 const evaluate=({blocked=false,pending=0,conflicts=0,readSource=null,cacheWriteFailed=false}={})=>
  message(blocked,pending,conflicts,readSource,cacheWriteFailed);
 assert.match(evaluate({readSource:'cache'}),/synchronisation non confirmée/i);
 assert.match(evaluate({readSource:undefined}),/synchronisation non confirmée/i);
 assert.doesNotMatch(evaluate({readSource:'cache'}),/heures confirmées|synchronisé/i);
 assert.match(evaluate({readSource:'server'}),/Aucun pointage local en attente/);
 assert.match(evaluate({readSource:'server',cacheWriteFailed:true}),/copie hors ligne indisponible/);
 assert.match(evaluate({pending:2,conflicts:1,readSource:'cache'}),/2 pointage\(s\).*1 conflit\(s\)/);
 assert.match(evaluate({pending:1,readSource:'cache'}),/en attente/);
 assert.match(evaluate({conflicts:2}),/2 conflit\(s\).*responsable/);
 assert.match(evaluate({blocked:true,readSource:'server'}),/aucun envoi confirmé/);
});

test('Essentiel pause controls use only the active session and never a historical open break',()=>{
 assert.match(essential,/paused=!!punch\.active&&\(punch\.breaks\|\|\[\]\)\.some\(b=>b\.session_id===punch\.active\?\.id&&b\.ended_at===null\)/);
 const isPaused=(active,breaks)=>!!active&&(breaks||[]).some(b=>b.session_id===active.id&&b.ended_at===null);
 const current={id:'session-now'};
 const historical={session_id:'session-before',ended_at:null};
 assert.equal(isPaused(current,[historical]),false);
 assert.equal(isPaused(current,[historical,{session_id:'session-now',ended_at:null}]),true);
 assert.equal(isPaused(null,[historical]),false);
 assert.equal(isPaused(current,[{session_id:'session-now',ended_at:'2026-11-02T11:00:00Z'}]),false);
 assert.match(essential,/punch\.readSource==='server'\?'Relevé serveur':'Relevé non vérifié'/);
});

test('Supabase transport exceptions on each Expo punch table preserve previous verified hours',async()=>{
 for(const table of ['punch_sessions','punch_segments','punch_breaks']){
  for(const scenario of [{rejectTable:table},{throwTable:table}]){
   const h=fixture({offline:false,...scenario});
   const before=h.store.get('punch-state:U:A');
   const state=await h.load('A');
   assert.equal(state.readSource,'cache',table);
   assert.equal(state.snapshotUnverified,false,table);
   assert.equal(state.localJournalBlocked,false,table);
   assert.deepEqual(state.sessions.map(s=>s.id),['own'],table);
   assert.deepEqual(state.segments.map(s=>s.id),['own-segment'],table);
   assert.equal(state.lastJobId,'my-site',table);
   assert.equal(h.store.get('punch-state:U:A'),before,'A partial request must not overwrite the cache');
  }
 }
});

test('Rejected Supabase transport without saved attendance stays unverified',async()=>{
 for(const table of ['punch_sessions','punch_segments','punch_breaks']){
  const h=fixture({offline:false,rawCache:null,rejectTable:table});
  const state=await h.load('A');
  assert.equal(state.readSource,'cache');
  assert.equal(state.snapshotUnverified,true);
  assert.equal(state.localJournalBlocked,true);
  assert.deepEqual(state.sessions,[]);
  assert.equal(h.store.has('punch-state:U:A'),false);
 }
});
