import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
const start=source.indexOf('async function syncLocalPunches(){');
const end=source.indexOf('const navDestination=',start);
assert.ok(start>=0&&end>start,'Native explicit sync handler not found');
const code=source.slice(start,end).replace('catch(e:any)','catch(e)');

function harness({pending=0,conflicts=0,blocked=false,connected=true,throwNetwork=false,throwLoad=false,
 switched=false,busy=false}={}){
 const notices=[],setCalls=[],calls={load:0,summary:0,network:0};
 const account={companyId:'A',userId:'U'};
 const visitContext={current:'A:U'};
 const punch={localJournalBlocked:blocked};
 const fn=new Function('busy','punch','setBusy','setNotice','Network','loadPunchState','journalSummary',
  'account','visitContext','setPunch','setPending','setConflicts','setPendingItems','setConflictItems',
  code+'\nreturn syncLocalPunches;')(
   busy,punch,value=>setCalls.push(['busy',value]),
   value=>notices.push(value),
   {getNetworkStateAsync:async()=>{calls.network++;if(throwNetwork)throw Error('Impossible de lire le réseau');return {isConnected:connected,isInternetReachable:connected}}},
   async()=>{calls.load++;if(throwLoad)throw Error('serveur indisponible');if(switched)visitContext.current='B:U';return {localJournalBlocked:blocked}},
   async()=>{calls.summary++;return {pending,conflicts,blocked,pendingItems:[],conflictItems:[]}},
   account,visitContext,
   v=>setCalls.push(['punch',v]),v=>setCalls.push(['pending',v]),v=>setCalls.push(['conflicts',v]),
   v=>setCalls.push(['pendingItems',v]),v=>setCalls.push(['conflictItems',v])
  );
 return {fn,notices,setCalls,calls};
}
test('manual sync refuses offline network without retrying the server or losing local events',async()=>{
 const h=harness({connected:false,pending:2});
 await h.fn();
 assert.equal(h.calls.load,0);
 assert.equal(h.calls.summary,0);
 assert.match(h.notices.at(-1),/Connexion Internet requise/);
 assert.deepEqual(h.setCalls,[['busy',true],['busy',false]]);
});
test('blocked journal cannot be retried from the employee button',async()=>{
 const h=harness({blocked:true,pending:3});
 await h.fn();
 assert.equal(h.calls.network,0);
 assert.equal(h.calls.load,0);
 assert.deepEqual(h.setCalls,[]);
});
test('online retry displays remaining count and conflicts distinctly',async()=>{
 const h=harness({pending:3,conflicts:1});
 await h.fn();
 assert.equal(h.calls.load,1);
 assert.equal(h.calls.summary,1);
 assert.match(h.notices.at(-1),/3 pointage\(s\) encore en attente et 1 conflit\(s\)/);
 assert.deepEqual(h.setCalls.filter(x=>x[0]==='pending'||x[0]==='conflicts'),
  [['pending',3],['conflicts',1]]);
 assert.deepEqual(h.setCalls.filter(x=>x[0]==='pendingItems'||x[0]==='conflictItems'),
  [['pendingItems',[]],['conflictItems',[]]]);
});
test('conflict-only outcome never says synced or approved',async()=>{
 const h=harness({pending:0,conflicts:2});
 await h.fn();
 assert.match(h.notices.at(-1),/2 conflit\(s\) à vérifier/);
 assert.doesNotMatch(h.notices.at(-1),/confirmé|Approuvé|synchronisé/);
});
test('successful empty retry does not claim payroll approval',async()=>{
 const h=harness();
 await h.fn();
 assert.match(h.notices.at(-1),/Aucun pointage local en attente/);
 assert.match(h.notices.at(-1),/Vérifiez vos heures confirmées sur le serveur/);
});
test('a change of company during network response cannot replace the new workspace',async()=>{
 const h=harness({switched:true,pending:1});
 await h.fn();
 assert.equal(h.setCalls.filter(x=>x[0]==='punch').length,0);
 assert.equal(h.notices.length,0);
});
test('network or service errors do not claim a successful manual sync',async()=>{
 for(const args of [{throwNetwork:true},{throwLoad:true}]){
  const h=harness(args);await h.fn();
  assert.match(h.notices.at(-1),/Synchronisation non confirmée/);
  assert.equal(h.setCalls.at(-1)[1],false);
 }
});
test('native home, hours and footer distinguish pending, conflicts and blocked states',()=>{
 assert.match(source,/setPunch\(updated\);setPending\(summary\.pending\);setConflicts\(summary\.conflicts\)/);
 assert.match(source,/punch\.localJournalBlocked\?'Journal à vérifier':pending\?pending\+' en attente':conflicts/);
 assert.match(source,/pending>0&&!punch\.localJournalBlocked\?<Pressable accessibilityRole="button"/);
 assert.match(source,/onPress=\{\(\)=>\{void syncLocalPunches\(\)\}\}/);
 assert.match(source,/Ces événements ne constituent pas une validation officielle des heures/);
 assert.match(source,/notice\|\|pending\|\|conflicts\|\|punch\.localJournalBlocked/);
});
