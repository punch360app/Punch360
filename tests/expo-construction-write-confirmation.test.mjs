import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const p0=app.indexOf('function togglePunch(){'),p1=app.indexOf('function archivePunch(',p0);
const t0=app.indexOf('function switchTo(j:Job){'),t1=app.indexOf('async function refreshConstructionPunchState(){',t0);
assert.ok(p0>0&&p1>p0&&t0>0&&t1>t0);
const punchCode=app.slice(p0,p1).replaceAll('catch(e:any)','catch(e)');
const transferCode=app.slice(t0,t1).replace('function switchTo(j:Job){','function switchTo(j){').replaceAll('catch(e:any)','catch(e)');
function scenario({active=false,queued=false,review='approved',failAction=false,failRefresh=false,
 changed=false,skipRefresh=false}={}){
 const calls=[],alerts=[],notices=[];
 const account={companyId:'A',userId:'U'};
 const scopeRef={current:'A:U'},punchReadRevision={current:0},punchActionInFlight={current:false},
  syncInFlight={current:false};
 const current={id:'J1',number:'214',name:'Résidence'},newJob={id:'J2',number:'215',name:'Chantier B'};
 let working=false;
 const Alert={alert:(...args)=>alerts.push(args)};
 const punchIn=async(...args)=>{calls.push(['in',...args]);if(failAction)throw Error('RPC échoué');if(changed)scopeRef.current='B:V';return {queued,review_status:review}};
 const punchOut=async(...args)=>{calls.push(['out',...args]);if(failAction)throw Error('RPC échoué');if(changed)scopeRef.current='B:V';return {queued,review_status:review}};
 const punchTransfer=async(...args)=>{calls.push(['transfer',...args]);if(failAction)throw Error('RPC échoué');if(changed)scopeRef.current='B:V';return {queued,review_status:review}};
 const refresh=async()=>{calls.push(['reload']);if(failRefresh)throw Error('Lecture impossible');return !skipRefresh};
 const togglePunch=new Function('journalBlocked','journalViewScope','currentScope','Alert','current','working',
  'punchActionInFlight','syncInFlight','punchActive','account','scopeRef','setWorking','punchReadRevision',
  'punchOut','punchIn','refreshConstructionPunchState','setMessage',
  punchCode+'\nreturn togglePunch;')(
  false,'A:U','A:U',Alert,current,working,punchActionInFlight,syncInFlight,active,account,scopeRef,
  v=>calls.push(['working',v]),punchReadRevision,punchOut,punchIn,refresh,v=>notices.push(v));
 const switchTo=new Function('journalBlocked','journalViewScope','currentScope','working','punchActionInFlight',
  'syncInFlight','selectedId','setPage','account','scopeRef','setWorking','punchReadRevision','punchActive',
  'punchTransfer','setSelectedId','refreshConstructionPunchState','setMessage','Alert','current',
  transferCode+'\nreturn switchTo;')(
  false,'A:U','A:U',working,punchActionInFlight,syncInFlight,'J1',v=>calls.push(['page',v]),
  account,scopeRef,v=>calls.push(['working',v]),punchReadRevision,active,punchTransfer,
  v=>calls.push(['selected',v]),refresh,v=>notices.push(v),Alert,current);
 return {calls,alerts,notices,punchActionInFlight,scopeRef,newJob,togglePunch,switchTo,
  confirmPunch:async()=>{togglePunch();const a=alerts.shift();assert.ok(a);await a[2][1].onPress()},
  confirmTransfer:async()=>{switchTo(newJob);const a=alerts.shift();assert.ok(a);await a[2][1].onPress()}};
}
test('offline PUNCH IN confirms only that local journal received the event',async()=>{
 const h=scenario({queued:true});await h.confirmPunch();
 assert.deepEqual(h.calls.filter(c=>c[0]==='in'),[['in','A','J1']]);
 assert.match(h.notices.at(-1),/sur cet appareil.*envoi/);
 assert.equal(h.punchActionInFlight.current,false);
});
test('pending server PUNCH OUT explicitly awaits approval, not payroll',async()=>{
 const h=scenario({active:true,review:'pending'});await h.confirmPunch();
 assert.deepEqual(h.calls.filter(c=>c[0]==='out'),[['out','A']]);
 assert.match(h.notices.at(-1),/validation du responsable/);
});
test('successful PUNCH followed by refresh failure never says unrecorded',async()=>{
 const h=scenario({failRefresh:true});await h.confirmPunch();
 assert.match(h.alerts[0][0],/État du pointage à vérifier/);
 assert.match(h.alerts[0][1],/Pointage enregistré/);
 assert.doesNotMatch(h.alerts[0][1],/non enregistré/);
});
test('failed punch action stays explicitly unconfirmed and cannot show queued success',async()=>{
 const h=scenario({failAction:true});await h.confirmPunch();
 assert.match(h.alerts[0][0],/Pointage non confirmé/);
 assert.equal(h.notices.length,0);
 assert.equal(h.calls.filter(c=>c[0]==='reload').length,0);
});
test('switch after recorded offline transfer reports local status without claiming approval',async()=>{
 const h=scenario({active:true,queued:true});await h.confirmTransfer();
 assert.deepEqual(h.calls.filter(c=>c[0]==='transfer'),[['transfer','A','J2']]);
 assert.match(h.notices.at(-1),/sur cet appareil.*envoi/);
 assert.equal(h.punchActionInFlight.current,false);
});
test('transfer that saved but could not refresh does not invite duplicate retry',async()=>{
 const h=scenario({active:true,failRefresh:true});await h.confirmTransfer();
 assert.match(h.alerts[0][0],/État du transfert à vérifier/);
 assert.match(h.alerts[0][1],/Transfert enregistré/);
});
test('rejected transfer cannot switch selected job optimistically',async()=>{
 const h=scenario({active:true,failAction:true});await h.confirmTransfer();
 assert.match(h.alerts[0][0],/Transfert non confirmé/);
 assert.equal(h.calls.filter(c=>c[0]==='selected').length,0);
});
test('successful read that became stale cannot emit misleading confirmation',async()=>{
 const h=scenario({active:true,queued:true,skipRefresh:true});await h.confirmPunch();
 assert.equal(h.notices.length,0);
});
test('switching account mid-action never reveals old account success',async()=>{
 const h=scenario({active:true,queued:true,changed:true});await h.confirmPunch();
 assert.equal(h.notices.length,0);
 assert.equal(h.calls.filter(c=>c[0]==='reload').length,0);
});
test('manual synchronization refuses while mutation is in progress',()=>{
 assert.match(app,/if\(syncInFlight\.current\|\|punchActionInFlight\.current\|\|working\|\|journalBlocked\|\|localPending===0\|\|/);
});
