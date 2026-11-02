import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const a=app.indexOf('async function refresh(){'),b=app.indexOf('async function syncConstructionPunches(){',a);
assert.ok(a>=0&&b>a,'Construction background refresh missing');
const source=app.slice(a,b).replace('catch(e:any)','catch(e)');
const sessions=[{id:'S1',company_id:'A',user_id:'U',started_at:'2026-11-02T09:00:00Z',ended_at:null}];
const snapshot={sessions,segments:[{id:'X',session_id:'S1',job_id:'J1',started_at:'2026-11-02T09:00:00Z',ended_at:null}],breaks:[],active:sessions[0],lastJobId:'J1',readSource:'cache'};
function fixture({failJobs=false,failArchives=false,failOrders=false,failPunch=false,networkError=false,
 changed=false}={}){
 const calls=[],messages=[],account={companyId:'A',userId:'U',companyName:'Compagnie A'};
 const scopeRef={current:'A:U'},punchReadRevision={current:0},punchActionInFlight={current:false};
 const set=(k,v)=>calls.push([k,v]);
 const fn=new Function('account','scopeRef','punchActionInFlight','punchReadRevision',
  'Network','listMyCompanyJobs','loadPunchState','loadArchives','supabase','journalSummary',
  'setJobs','setDemo','setLocalPending','setLocalConflicts','setPendingItems','setConflictItems',
  'setJournalViewScope','setJournalBlocked','setMessage','setHoursReadSource','setHoursProjected',
  'setSessions','setServerSegments','setServerBreaks','setSegments','setArchived','setSelectedId',
  'setPunchActive','setStartMs','setOrders',source+'\nreturn refresh;')(
  account,scopeRef,punchActionInFlight,punchReadRevision,
  {getNetworkStateAsync:async()=>{if(networkError)throw Error('Unknown network');return {isConnected:true,isInternetReachable:true}}},
  async()=>{if(failJobs)throw Error('no jobs');return {jobs:[{id:'J1',name:'Chantier'}],message:''}},
  async()=>{if(failPunch)throw Error('no hours');if(changed)scopeRef.current='B:V';return snapshot;},
  async()=>{if(failArchives)throw Error('no archives');return []},
  {from:()=>({select:()=>({eq:()=>({order:()=>({limit:async()=>{if(failOrders)throw Error('no orders');return {data:[],error:null}}})})})})},
  async()=>({pending:2,conflicts:0,blocked:false,pendingItems:[],conflictItems:[]}),
  x=>set('jobs',x),x=>set('demo',x),x=>set('pending',x),x=>set('conflicts',x),x=>set('pendingItems',x),
  x=>set('conflictItems',x),x=>set('scope',x),x=>set('blocked',x),x=>messages.push(x),
  x=>set('source',x),x=>set('projected',x),x=>set('sessions',x),x=>set('segments',x),x=>set('breaks',x),
  x=>set('segmentRows',x),x=>set('archives',x),fn=>set('selection',typeof fn==='function'?fn(''):fn),
  x=>set('active',x),x=>set('start',x),x=>set('orders',x)
 );
 return {run:fn,calls,messages,scopeRef};
}
test('failure to load jobs must not hide offline punch state and pending events',async()=>{
 const h=fixture({failJobs:true});await h.run();
 assert.equal(h.calls.find(x=>x[0]==='sessions')[1][0].id,'S1');
 assert.equal(h.calls.find(x=>x[0]==='pending')[1],2);
 assert.equal(h.calls.filter(x=>x[0]==='jobs').length,0);
});
test('failed archives and orders cannot block punch data',async()=>{
 const h=fixture({failArchives:true,failOrders:true});await h.run();
 assert.equal(h.calls.filter(x=>x[0]==='sessions').length,1);
 assert.equal(h.calls.filter(x=>x[0]==='archives').length,0);
 assert.equal(h.calls.filter(x=>x[0]==='orders').length,0);
});
test('network state lookup failure still loads cached punch hours',async()=>{
 const h=fixture({networkError:true,failJobs:true});await h.run();
 assert.equal(h.calls.filter(x=>x[0]==='sessions').length,1);
 assert.equal(h.calls.filter(x=>x[0]==='source')[0][1],'cache');
});
test('failed punch loader never displays false confirmation or old sessions',async()=>{
 const h=fixture({failPunch:true});await h.run();
 assert.match(h.messages.at(-1),/Relevé de pointage indisponible/);
 assert.equal(h.calls.filter(x=>x[0]==='sessions').length,0);
});
test('company change before promise settlement cannot reveal prior sessions',async()=>{
 const h=fixture({changed:true});await h.run();
 assert.equal(h.calls.length,0);
});
test('workplace data is not selected when cached job lookup failed',async()=>{
 const h=fixture({failJobs:true});await h.run();
 assert.equal(h.calls.filter(x=>x[0]==='selection').length,0);
});
test('PUNCH OUT can proceed even if no cached workplace is available',()=>{
 assert.match(app,/if\(!punchActive&&!current\)\{Alert\.alert\('Aucune job'/);
 assert.match(app,/current\?'#'\+current\.number/);
 assert.match(app,/punchActive\?await punchOut\(account\.companyId\):await punchIn\(account\.companyId,current\?\.id\|\|''\)/);
 assert.match(app,/PUNCH OUT possible/);
});
test('background failure paths preserve monotonic revision and account validation',()=>{
 assert.match(source,/scopeRef\.current!==requestedFor\|\|punchReadRevision\.current!==revision/);
 assert.match(source,/Promise\.allSettled\(/);
});
