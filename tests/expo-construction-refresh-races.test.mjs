import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const from=app.indexOf(' async function refresh(){');
const to=app.indexOf(' async function syncConstructionPunches(){',from);
assert.ok(from>=0&&to>from);
const source=app.slice(from,to).replace('catch(e:any)','catch(e)');
const later=()=>{
 let finish;
 const promise=new Promise(resolve=>finish=resolve);
 return {promise,finish};
};
function harness(){
 const account={companyId:'A',userId:'U',companyName:'A'},scopeRef={current:'A:U'};
 const punchActionInFlight={current:false},syncInFlight={current:false},punchReadRevision={current:0};
 const calls=[],deferred=[],notices=[];
 let current=0;
 const refresh=new Function(
  'account','scopeRef','punchActionInFlight','syncInFlight','punchReadRevision','Network','listMyCompanyJobs',
  'loadPunchState','loadArchives','supabase','journalSummary','setJobs','setDemo','setJobsReadSource','setJournalBlocked',
  'setLocalPending','setLocalConflicts','setPendingItems','setConflictItems','setJournalViewScope',
  'setHoursReadSource','setHoursProjected','setMessage','setSessions','setServerSegments',
  'setServerBreaks','setSegments','setArchived','setSelectedId','setPunchActive','setStartMs',
  source+'\nreturn refresh;')(
  account,scopeRef,punchActionInFlight,syncInFlight,punchReadRevision,
  {getNetworkStateAsync:async()=>({isConnected:false,isInternetReachable:false})},
  async()=>({jobs:[{id:'J'}],message:'ok'}),
  async()=>{let d=later();deferred.push(d);return await d.promise;},
  async()=>[],{from:()=>{throw Error('No order call expected')}},
  async()=>({pending:0,conflicts:0,pendingItems:[],conflictItems:[],blocked:false}),
  x=>calls.push(['jobs',x]),x=>calls.push(['demo',x]),x=>calls.push(['jobSource',x]),x=>calls.push(['blocked',x]),
  x=>calls.push(['pending',x]),x=>calls.push(['conflicts',x]),
  x=>calls.push(['pendingItems',x]),x=>calls.push(['conflictItems',x]),
  x=>calls.push(['scope',x]),x=>calls.push(['source',x]),x=>calls.push(['projected',x]),
  x=>notices.push(x),x=>calls.push(['sessions',x]),x=>calls.push(['segments',x]),
  x=>calls.push(['breaks',x]),x=>calls.push(['segmentRows',x]),x=>calls.push(['archives',x]),
  cb=>{calls.push(['selection',true]);if(typeof cb==='function')cb('');},
  x=>calls.push(['active',x]),x=>calls.push(['start',x])
 );
 return {refresh,account,scopeRef,punchActionInFlight,syncInFlight,punchReadRevision,calls,deferred,notices};
}
const snapshot=(id)=>({sessions:[{id,company_id:'A',user_id:'U',started_at:'2026-11-02T08:00:00Z',ended_at:null}],
 segments:[],breaks:[],active:{id,started_at:'2026-11-02T08:00:00Z'},lastJobId:null,readSource:'server'});
async function drain(){await Promise.resolve();await Promise.resolve();await Promise.resolve();}
test('late background reply cannot overwrite a more recent attendance snapshot',async()=>{
 const h=harness();const a=h.refresh();await drain();const b=h.refresh();await drain();
 assert.equal(h.deferred.length,2);
 h.deferred[1].finish(snapshot('new'));await b;
 h.deferred[0].finish(snapshot('old'));await a;
 assert.deepEqual(h.calls.filter(x=>x[0]==='sessions').map(x=>x[1][0].id),['new']);
});
test('read started before a punch write cannot replace state after write begins',async()=>{
 const h=harness();const pending=h.refresh();await drain();
 h.punchActionInFlight.current=true;++h.punchReadRevision.current;
 h.deferred[0].finish(snapshot('stale'));await pending;
 assert.equal(h.calls.filter(x=>x[0]==='sessions').length,0);
});
test('a network error from an older request cannot replace the newest notice',async()=>{
 const h=harness();const first=h.refresh();await drain();
 const second=h.refresh();await drain();
 h.deferred[1].finish(snapshot('latest'));await second;
 h.deferred[0].finish(snapshot('older'));await first;
 assert.doesNotMatch(h.notices.at(-1),/Erreur de synchronisation/);
});
test('refresh never starts while a pointage mutation holds the lock',async()=>{
 const h=harness();h.punchActionInFlight.current=true;
 await h.refresh();assert.equal(h.deferred.length,0);
});
test('account change blocks old network response without showing prior employee hours',async()=>{
 const h=harness();const first=h.refresh();await drain();
 h.scopeRef.current='B:V';h.deferred[0].finish(snapshot('A'));await first;
 assert.equal(h.calls.length,0);
});
test('automatic and manual loaders use one monotonic read generation',()=>{
 assert.match(app,/const punchReadRevision=useRef\(0\)/);
 assert.match(app,/const revision=\+\+punchReadRevision\.current/);
 assert.match(app,/if\(scopeRef\.current!==requestedFor\|\|punchReadRevision\.current!==revision\)return/);
 assert.match(app,/if\(scopeRef\.current!==requestedFor\|\|punchReadRevision\.current!==revision\)return false/);
 assert.match(app,/const applied=await refreshConstructionPunchState\(\)/);
 assert.match(app,/\+\+punchReadRevision\.current; \/\/ invalidate any older background read before this write/);
 assert.match(app,/return\(\)=>\{\+\+punchReadRevision\.current;sub\.remove/);
});

test('timer refresh does not preempt a manual offline journal retry',async()=>{
 const h=harness();h.syncInFlight.current=true;
 await h.refresh();
 assert.equal(h.deferred.length,0);
 assert.equal(h.punchReadRevision.current,0);
});
