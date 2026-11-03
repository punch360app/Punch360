import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const start=app.indexOf('async function toggleConstructionBreak(paid=false){');
const end=app.indexOf('function requestConstructionBreak(){',start);
assert.ok(start>=0&&end>start);
const source=app.slice(start,end).replace('catch(e:any)','catch(e)');
function fixture({paused=false,blocked=false,active=true,working=false,connected=true,
 changed=false,throwPunch=false,throwRefresh=false,queued=false,review='approved',
 scope='A:U'}={}){
 const calls=[],alerts=[],messages=[],state={busy:false};
 const account={companyId:'A',userId:'U'},scopeRef={current:scope},punchActionInFlight={current:false};
 const syncInFlight={current:false},punchReadRevision={current:0},activeSession=active?{id:'S'}:null;
 const fn=new Function('account','punchActionInFlight','punchReadRevision','working','syncInFlight','journalBlocked',
  'journalViewScope','punchActive','activeSession','paused','scopeRef','setWorking','punchBreak',
  'refreshConstructionPunchState','setMessage','Alert',source+'\nreturn toggleConstructionBreak;')(
  account,punchActionInFlight,punchReadRevision,working,syncInFlight,blocked,scope,active,activeSession,paused,
  scopeRef,x=>{state.busy=x;calls.push(['busy',x])},
  async(...args)=>{calls.push(['punchBreak',...args]);if(throwPunch)throw Error('RPC échoué');if(changed)scopeRef.current='B:U';return {queued,review_status:review}},
  async()=>{calls.push(['refresh']);if(throwRefresh)throw Error('Relevé introuvable');return true},
  x=>messages.push(x),{alert:(...args)=>alerts.push(args)}
 );
 return {fn,calls,alerts,messages,state,punchActionInFlight,syncInFlight};
}
test('Construction starts unpaid break through existing scoped API and reads journal',async()=>{
 const h=fixture({queued:true});await h.fn(false);
 assert.deepEqual(h.calls.filter(x=>x[0]==='punchBreak'),[['punchBreak','A',false,false]]);
 assert.equal(h.calls.filter(x=>x[0]==='refresh').length,1);
 assert.match(h.messages.at(-1),/envoi au retour du réseau/);
 assert.equal(h.punchActionInFlight.current,false);
});
test('Construction starts paid break only when explicitly selected',async()=>{
 const h=fixture({review:'pending'});await h.fn(true);
 assert.deepEqual(h.calls.filter(x=>x[0]==='punchBreak'),[['punchBreak','A',false,true]]);
 assert.match(h.messages.at(-1),/validation du responsable/);
});
test('Construction resume ends ongoing break instead of beginning a new one',async()=>{
 const h=fixture({paused:true});await h.fn();
 assert.deepEqual(h.calls.filter(x=>x[0]==='punchBreak'),[['punchBreak','A',true,false]]);
});
test('Blocked, inactive, busy or wrong-account actions cannot record a break',async()=>{
 for(const cfg of [{blocked:true},{active:false},{working:true},{scope:'B:U'}]){
  const h=fixture(cfg);await h.fn();
  assert.deepEqual(h.calls,[]);assert.equal(h.punchActionInFlight.current,false);
 }
});
test('Concurrent repeated press during an in-flight pause never appends twice',async()=>{
 const h=fixture();h.punchActionInFlight.current=true;
 await h.fn();assert.deepEqual(h.calls,[]);
});
test('Company change during RPC cannot apply old pause status or server response',async()=>{
 const h=fixture({changed:true});await h.fn();
 assert.equal(h.calls.filter(x=>x[0]==='refresh').length,0);
 assert.deepEqual(h.messages,[]);assert.deepEqual(h.alerts,[]);
});
test('Backend rejection cannot claim pause registered',async()=>{
 const h=fixture({throwPunch:true});await h.fn();
 assert.equal(h.alerts.length,1);
 assert.match(h.alerts[0][0],/Pause non confirmée/);
 assert.equal(h.messages.length,0);
});
test('A sent event with failed reload stays recorded but UI warns before retry',async()=>{
 const h=fixture({throwRefresh:true});await h.fn();
 assert.equal(h.alerts.length,1);
 assert.match(h.alerts[0][0],/État de la pause à vérifier/);
 assert.match(h.alerts[0][1],/Pause enregistrée/);
});
test('Construction home exposes actionable pause, resumption and role-safe warnings',()=>{
 assert.match(app,/import \{loadPunchState,punchIn,punchOut,punchBreak,punchTransfer/);
 assert.match(app,/const activeBreak=activeSession\?serverBreaks\.find/);
 assert.match(app,/const paused=!!activeBreak&&journalViewScope===currentScope/);
 assert.match(app,/accessibilityLabel=\{paused\?'Reprendre le travail':'Début de pause'\}/);
 assert.match(app,/onPress=\{requestConstructionBreak\}/);
 assert.match(app,/Payée \(si autorisée\)/);
 assert.match(app,/Non payée \/ repas/);
 assert.match(app,/EN PAUSE/);
 assert.match(app,/if\(punchActionInFlight\.current\|\|scopeRef\.current!==requestedFor\)return/);
 assert.match(app,/disabled=\{journalBlocked\|\|working\|\|syncBusy\|\|journalViewScope!==currentScope\}/);
});
