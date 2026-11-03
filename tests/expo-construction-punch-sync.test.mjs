import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const start=source.indexOf('async function syncConstructionPunches(){');
const end=source.indexOf('\n useEffect(',start);
assert.ok(start>=0&&end>start,'Construction retry handler missing');
const code=source.slice(start,end).replace('catch(e:any)','catch(e)');
function harness({pending=2,conflicts=1,remainingPending=pending,source='server',blocked=false,connected=true,changed=false,
 throwNetwork=false,throwLoad=false,busy=false,working=false,scope='A:U'}={}){
 const calls=[],messages=[],flags={locked:false};
 const req={companyId:'A',userId:'U'},scopeRef={current:scope};
 const syncInFlight={get current(){return flags.locked},set current(v){flags.locked=v}};
 const punchActionInFlight={current:false};
 const punchReadRevision={current:0};
 const punch={sessions:[],segments:[],active:null,readSource:source,hasLocalProjection:remainingPending>0,localJournalBlocked:blocked};
 const set=(name,value)=>calls.push([name,value]);
 const retry=new Function('account','syncInFlight','punchActionInFlight','punchReadRevision','working','journalBlocked','localPending','journalViewScope',
  'setSyncBusy','Network','scopeRef','setMessage','loadPunchState','journalSummary','setJournalBlocked',
  'setLocalPending','setLocalConflicts','setPendingItems','setConflictItems','setJournalViewScope',
  'setHoursReadSource','setHoursProjected','setSessions','setServerSegments','setServerBreaks','setSegments',
  'setPunchActive','setStartMs',code+'\nreturn syncConstructionPunches;')(
  req,syncInFlight,punchActionInFlight,punchReadRevision,working,blocked,pending,scope,
  x=>set('syncBusy',x),
  {getNetworkStateAsync:async()=>{set('network',true);if(throwNetwork)throw Error('network');return {isConnected:connected,isInternetReachable:connected}}},
  scopeRef,x=>messages.push(x),
  async()=>{set('load',true);if(throwLoad)throw Error('server');if(changed)scopeRef.current='B:U';return punch},
  async()=>{set('summary',true);return {pending:remainingPending,conflicts,blocked,pendingItems:[{label:'Entrée',occurredAt:'2026-11-02T10:00:00Z'}],conflictItems:[{label:'Sortie',occurredAt:null}]}},
  x=>set('blocked',x),x=>set('pending',x),x=>set('conflicts',x),
  x=>set('pendingItems',x),x=>set('conflictItems',x),x=>set('scope',x),
  x=>set('source',x),x=>set('projection',x),x=>set('sessions',x),
  x=>set('segments',x),x=>set('breaks',x),x=>set('segmentRows',x),x=>set('active',x),x=>set('start',x)
 );
 return {retry,calls,messages,flags};
}
test('Construction manual sync refuses offline access and keeps local events intact',async()=>{
 const h=harness({connected:false});await h.retry();
 assert.equal(h.calls.filter(x=>x[0]==='load').length,0);
 assert.match(h.messages.at(-1),/Connexion Internet requise/);
 assert.equal(h.flags.locked,false);
});
test('Construction retry is disabled for blocked or empty journal and during working punch',async()=>{
 for(const options of [{blocked:true},{pending:0},{working:true},{scope:'B:U'}]){
  const h=harness(options);await h.retry();
  assert.deepEqual(h.calls,[]);
 }
});
test('Construction retry refreshes scoped pending, conflict and official snapshot separately',async()=>{
 const h=harness({pending:3,conflicts:2});await h.retry();
 assert.equal(h.calls.filter(x=>x[0]==='load').length,1);
 assert.equal(h.calls.filter(x=>x[0]==='summary').length,1);
 assert.deepEqual(h.calls.filter(x=>x[0]==='pending'||x[0]==='conflicts'),[['pending',3],['conflicts',2]]);
 assert.match(h.messages.at(-1),/3 pointage\(s\) en attente et 2 conflit\(s\)/);
 assert.equal(h.flags.locked,false);
});
test('Construction retry conflicts only or no pending do not claim payroll approval',async()=>{
 const conflicts=harness({pending:2,conflicts:3});await conflicts.retry();
 assert.doesNotMatch(conflicts.messages.at(-1),/approuvée|paie confirmée/i);
 const empty=harness({pending:2,conflicts:0});await empty.retry();
 assert.match(empty.messages.at(-1),/en attente/);
});
test('Construction cannot replace account view after company change during reply',async()=>{
 const h=harness({changed:true});await h.retry();
 assert.equal(h.calls.filter(x=>x[0]==='sessions').length,0);
 assert.equal(h.messages.length,0);
});
test('Construction network or RPC failure never announces confirmed sync',async()=>{
 for(const options of [{throwNetwork:true},{throwLoad:true}]){
  const h=harness(options);await h.retry();
  assert.match(h.messages.at(-1),/Synchronisation non confirmée/);
  assert.equal(h.flags.locked,false);
 }
});
test('Construction UI shows scoped safe pending and conflict event labels and manual retry',()=>{
 assert.match(source,/journalViewScope===currentScope/);
 assert.match(source,/pendingItems\.map\(\(item,i\)=>/);
 assert.match(source,/conflictItems\.map\(\(item,i\)=>/);
 assert.match(source,/localPending>pendingItems\.length/);
 assert.match(source,/localConflicts>conflictItems\.length/);
 assert.match(source,/accessibilityRole="button"/);
 assert.match(source,/onPress=\{\(\)=>\{void syncConstructionPunches\(\)\}\}/);
 assert.match(source,/Totaux indicatifs · aucune approbation des heures ou de la paie/);
 assert.doesNotMatch(source,/item\.job|item\.fix|item\.result/);
});
test('Construction refresh protects company switching and displays source of hours',()=>{
 const start=source.indexOf('async function refresh(){');
 const end=source.indexOf('async function syncConstructionPunches(){',start);
 const refresh=source.slice(start,end);
 assert.match(refresh,/scopeRef\.current!==requestedFor/);
 assert.match(refresh,/setPendingItems\(local\.pendingItems\)/);
 assert.match(refresh,/setJournalViewScope\(requestedFor\)/);
 assert.match(refresh,/setHoursReadSource\(punch\.readSource\|\|null\)/);
 assert.match(source,/Dernier relevé sauvegardé sur cet appareil/);
});

test('Construction retry never treats a cached attendance snapshot as a confirmed server reread',async()=>{
 const cached=harness({pending:2,remainingPending:0,conflicts:0,source:'cache'});
 await cached.retry();
 assert.equal(cached.calls.filter(x=>x[0]==='load').length,1);
 assert.match(cached.messages.at(-1),/synchronisation non confirmée/i);
 assert.doesNotMatch(cached.messages.at(-1),/Vérifiez les heures officielles sur le serveur/);
 assert.deepEqual(cached.calls.filter(x=>x[0]==='source'),[['source','cache']]);
 const verified=harness({pending:2,remainingPending:0,conflicts:0,source:'server'});
 await verified.retry();
 assert.match(verified.messages.at(-1),/Aucun pointage local en attente/);
});
