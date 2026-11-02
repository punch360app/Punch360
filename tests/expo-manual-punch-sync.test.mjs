import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
const start=source.indexOf('async function syncLocalPunches(){');
const end=source.indexOf('const navDestination=',start);
assert.ok(start>=0&&end>start,'Native explicit sync handler not found');
const code=source.slice(start,end).replace('catch(e:any)','catch(e)');

// Exercise the production notice mapping, not a mock message.
const messageSource=source.slice(source.indexOf('export function essentialManualPunchSyncNotice('),
 source.indexOf('export function EssentialWorkspace('));
const bodyStart=messageSource.indexOf('}):string{');
assert.ok(bodyStart>=0,'Shared native notice helper not found');
const messageBody=messageSource.slice(bodyStart+'}):string{'.length,messageSource.lastIndexOf('\n}'));
const evaluateNotice=new Function('blocked','pending','conflicts','readSource','cacheWriteFailed',messageBody);
const notice=({blocked,pending,conflicts,readSource,cacheWriteFailed})=>
 evaluateNotice(blocked,pending,conflicts,readSource,cacheWriteFailed);

function harness({pending=0,conflicts=0,blocked=false,summaryBlocked=false,connected=true,
 throwNetwork=false,throwLoad=false,switched=false,busy=false,readSource='server',
 cacheWriteFailed=false,actionRunning=false,syncRunning=false,deferred=false}={}){
 const notices=[],setCalls=[],calls={load:0,summary:0,network:0};
 const account={companyId:'A',userId:'U'},visitContext={current:'A:U'};
 const punchActionInFlight={current:actionRunning},syncInFlight={current:syncRunning};
 const punchReadRevision={current:0};
 let resolveLoad;
 const fn=new Function('busy','punchActionInFlight','syncInFlight','journalBlocked',
  'punchReadRevision','setBusy','setNotice','Network','loadPunchState','journalSummary','pending',
  'account','visitContext','setPunch','setJournalBlocked','setPending','setConflicts',
  'setPendingItems','setConflictItems','essentialManualPunchSyncNotice',
  code+'\nreturn syncLocalPunches;')(
   busy,punchActionInFlight,syncInFlight,blocked,punchReadRevision,
   value=>setCalls.push(['busy',value]),value=>notices.push(value),
   {getNetworkStateAsync:async()=>{calls.network++;if(throwNetwork)throw Error('Impossible de lire le réseau');
    return {isConnected:connected,isInternetReachable:connected}}},
   async()=>{calls.load++;if(throwLoad)throw Error('serveur indisponible');
    if(deferred)await new Promise(resolve=>{resolveLoad=resolve});
    if(switched)visitContext.current='B:U';
    return {localJournalBlocked:blocked,readSource,cacheWriteFailed}},
   async()=>{calls.summary++;return {pending,conflicts,blocked:summaryBlocked,pendingItems:[],conflictItems:[]}},
   pending,account,visitContext,
   value=>setCalls.push(['punch',value]),value=>setCalls.push(['journalBlocked',value]),
   value=>setCalls.push(['pending',value]),value=>setCalls.push(['conflicts',value]),
   value=>setCalls.push(['pendingItems',value]),value=>setCalls.push(['conflictItems',value]),
   notice);
 return {fn,notices,setCalls,calls,punchActionInFlight,syncInFlight,punchReadRevision,
  release:()=>{if(!resolveLoad)throw Error('No deferred server request');resolveLoad()}};
}

test('manual sync refuses offline network without retrying server or losing journal',async()=>{
 const h=harness({connected:false,pending:2});
 await h.fn();
 assert.equal(h.calls.load,0);
 assert.equal(h.calls.summary,0);
 assert.match(h.notices.at(-1),/Connexion Internet requise/);
 assert.deepEqual(h.setCalls,[['busy',true],['busy',false]]);
 assert.equal(h.syncInFlight.current,false);
});
test('blocked journal and in-flight actions prevent new manual sync attempts',async()=>{
 for(const flags of [{blocked:true},{actionRunning:true},{syncRunning:true},{busy:true}]){
  const h=harness(flags);
  await h.fn();
  assert.equal(h.calls.network,0);
  assert.deepEqual(h.setCalls,[]);
 }
});
test('online retry shows remaining pending pointages and conflicts separately',async()=>{
 const h=harness({pending:3,conflicts:1});
 await h.fn();
 assert.equal(h.calls.load,1);
 assert.equal(h.calls.summary,1);
 assert.match(h.notices.at(-1),/3 pointage\(s\) en attente et 1 conflit\(s\)/);
 assert.deepEqual(h.setCalls.filter(x=>x[0]==='pending'||x[0]==='conflicts'),
  [['pending',3],['conflicts',1]]);
 assert.deepEqual(h.setCalls.filter(x=>x[0]==='pendingItems'||x[0]==='conflictItems'),
  [['pendingItems',[]],['conflictItems',[]]]);
 assert.deepEqual(h.setCalls.filter(x=>x[0]==='journalBlocked'),[['journalBlocked',false]]);
});
test('an unreadable journal summary blocks writes even when hours were readable',async()=>{
 const h=harness({summaryBlocked:true,readSource:'server'});
 await h.fn();
 assert.deepEqual(h.setCalls.filter(x=>x[0]==='journalBlocked'),[['journalBlocked',true]]);
 assert.match(h.notices.at(-1),/Journal local à vérifier/);
 assert.doesNotMatch(h.notices.at(-1),/heures confirmées|approuvées/i);
});
test('conflicts alone do not report approved or synchronized hours',async()=>{
 const h=harness({pending:0,conflicts:2});
 await h.fn();
 assert.match(h.notices.at(-1),/2 conflit\(s\) à vérifier/);
 assert.doesNotMatch(h.notices.at(-1),/confirmé|Approuvé|synchronisé/i);
});
test('a complete successful server refresh still avoids payroll approval claims',async()=>{
 const h=harness();
 await h.fn();
 assert.match(h.notices.at(-1),/Aucun pointage local en attente/);
 assert.match(h.notices.at(-1),/Vérifiez vos heures dans le relevé serveur/);
});
test('a successful RPC with a cached hours fallback does not claim confirmation',async()=>{
 const h=harness({readSource:'cache'});
 await h.fn();
 assert.match(h.notices.at(-1),/synchronisation non confirmée/);
 assert.doesNotMatch(h.notices.at(-1),/Aucun pointage local en attente/);
});
test('switching company while response is pending cannot update the new workspace',async()=>{
 const h=harness({switched:true,pending:1});
 await h.fn();
 assert.equal(h.setCalls.filter(x=>x[0]==='punch').length,0);
 assert.equal(h.notices.length,0);
 assert.equal(h.syncInFlight.current,false);
});
test('network or server errors never claim that a punch was transmitted',async()=>{
 for(const args of [{throwNetwork:true},{throwLoad:true}]){
  const h=harness(args);await h.fn();
  assert.match(h.notices.at(-1),/Synchronisation non confirmée/);
  assert.deepEqual(h.setCalls.at(-1),['busy',false]);
  assert.equal(h.syncInFlight.current,false);
 }
});
test('simultaneous manual sync attempts share the same in-flight guard',async()=>{
 const h=harness({deferred:true});
 const first=h.fn();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(h.calls.load,1);
 assert.equal(h.syncInFlight.current,true);
 await h.fn();
 assert.equal(h.calls.load,1,'Second tap must never trigger a duplicate flush');
 h.release();await first;
 assert.equal(h.syncInFlight.current,false);
 assert.equal(h.punchReadRevision.current,1);
});
test('native home, hours and footer use the same blocked journal state',()=>{
 assert.match(source,/setPunch\(updated\);setJournalBlocked\(!!updated\.localJournalBlocked\|\|summary\.blocked\)/);
 assert.match(source,/journalBlocked\?'Journal à vérifier':pending\?pending\+' en attente':conflicts/);
 assert.match(source,/pending>0&&!journalBlocked\?<Pressable accessibilityRole="button"/);
 assert.match(source,/onPress=\{\(\)=>\{void syncLocalPunches\(\)\}\}/);
 assert.match(source,/Ces événements ne constituent pas une validation officielle des heures/);
 assert.match(source,/notice\|\|pending\|\|conflicts\|\|journalBlocked/);
});

test('native home permits a manual retry without navigating to My Hours',()=>{
 const home=source.slice(source.indexOf("page==='home'?"),source.indexOf(":page==='hours'?"));
 assert.match(home,/pending>0&&!journalBlocked\?<Pressable accessibilityRole="button"/);
 assert.match(home,/accessibilityLabel="Synchroniser mes pointages en attente"/);
 assert.match(home,/accessibilityState=\{\{disabled:busy\}\} disabled=\{busy\}/);
 assert.match(home,/onPress=\{\(\)=>\{void syncLocalPunches\(\)\}\}/);
 assert.match(home,/busy\?'Synchronisation…':'Synchroniser maintenant'/);
 const handler=source.slice(source.indexOf('async function syncLocalPunches(){'),source.indexOf('const navDestination='));
 assert.match(handler,/if\(busy\|\|punchActionInFlight.current\|\|syncInFlight.current\|\|journalBlocked\)return/);
 assert.match(handler,/await loadPunchState\(account.companyId\)/);
});

test('native home routes blocked journals and conflicts to the scoped My Hours list',()=>{
 const home=source.slice(source.indexOf("page==='home'?"),source.indexOf(":page==='hours'?"));
 assert.match(home,/journalBlocked\|\|conflicts>0\?<Pressable accessibilityRole="button"/);
 assert.match(home,/accessibilityLabel="Consulter les pointages à vérifier"/);
 assert.match(home,/onPress=\{\(\)=>setPage\('hours'\)\}/);
 assert.match(home,/Vérifier le journal dans Mes heures/);
 assert.match(home,/Voir les conflits dans Mes heures/);
 assert.doesNotMatch(home,/onPress=\{\(\)=>.*journal\.flush/);
});

test('both native home and My Hours reuse the same protected sync handler',()=>{
 const home=source.slice(source.indexOf("page==='home'?"),source.indexOf(":page==='hours'?"));
 const hours=source.slice(source.indexOf(":page==='hours'?"),source.indexOf(":page==='schedule'?"));
 assert.equal((home.match(/void syncLocalPunches\(\)/g)||[]).length,1);
 assert.equal((hours.match(/void syncLocalPunches\(\)/g)||[]).length,1);
 assert.match(hours,/Ces événements ne constituent pas une validation officielle des heures/);
});
