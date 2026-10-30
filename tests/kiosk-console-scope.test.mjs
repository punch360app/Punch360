import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createKioskConsoleScope,kioskConsoleIdentity,mayManageKiosks,maySetWorkerChannels,
 validKioskDevices,validKioskLocations,validKioskWorkers,validPairingInput,canAlterKiosk,
 canAlterKioskWorker,canEnrollKioskPin,kioskIdleOptions,validKioskSecret} from '../src/workforce/kioskConsoleScope.js';
const id1='123e4567-e89b-12d3-a456-426614174000',id2='123e4567-e89b-12d3-a456-426614174001';
const a={companyId:'company-A',userId:'alice',role:'boss',edition:'essential'};
const device={id:id1,name:'Réception',revoked_at:null,idle_seconds:10};
const location={id:id1,company_id:'company-A',name:'Accueil',active:true};
const worker={id:id2,company_id:'company-A',status:'active',role:'employee',can_kiosk_punch:true,can_mobile_punch:false};
test('A B A, role, user and edition switch revoke all previous codes and requests',()=>{
 const s=createKioskConsoleScope(a),one=s.enter(a);
 const two=s.enter({...a,companyId:'company-B'});assert.equal(s.allows(one),false);
 const three=s.enter({...a,userId:'bob'});assert.equal(s.allows(two),false);
 const four=s.enter({...a,role:'employee'});assert.equal(s.allows(three),false);
 s.enter({...a,edition:'construction'});assert.equal(s.allows(four),false);
 s.enter(a);assert.equal(s.allows(one),false);
 const latest=s.current();s.invalidate();assert.equal(s.allows(latest),false);
 assert.notEqual(kioskConsoleIdentity(a),kioskConsoleIdentity({...a,userId:'bob'}));
});
test('late pairing token cannot appear under another user',async()=>{
 const s=createKioskConsoleScope(a),token=s.enter(a);
 let resolve;const delayed=new Promise(r=>resolve=r);let shown=0;
 const result=delayed.then(()=>{if(s.allows(token))shown++});
 s.enter({...a,userId:'bob'});resolve('secret');await result;
 assert.equal(shown,0);
});
test('only Essential boss/admin can operate kiosks and Boss alone changes channels',()=>{
 assert.equal(mayManageKiosks(a),true);
 assert.equal(mayManageKiosks({...a,role:'admin'}),true);
 assert.equal(mayManageKiosks({...a,role:'employee'}),false);
 assert.equal(mayManageKiosks({...a,edition:'construction'}),false);
 assert.equal(maySetWorkerChannels(a),true);
 assert.equal(maySetWorkerChannels({...a,role:'admin'}),false);
 assert.equal(canAlterKiosk(device,[device],a),true);
 assert.equal(canAlterKiosk({...device,revoked_at:'now'},[device],a),false);
 assert.equal(canAlterKiosk(device,[],a),false);
 assert.equal(canAlterKiosk(device,[device],{...a,role:'employee'}),false);
});
test('bounded resources are complete, company scoped and not duplicated',()=>{
 assert.deepEqual(validKioskDevices([device]),[device]);
 assert.deepEqual(validKioskLocations([location],a.companyId),[location]);
 assert.deepEqual(validKioskWorkers([worker],a.companyId),[worker]);
 assert.throws(()=>validKioskDevices([device,device]),/indisponible/);
 assert.throws(()=>validKioskDevices([{...device,id:'not-an-id'}]),/indisponible/);
 assert.throws(()=>validKioskLocations([{...location,company_id:'company-B'}],a.companyId),/indisponibles/);
 assert.throws(()=>validKioskWorkers([{...worker,company_id:'company-B'}],a.companyId),/indisponible/);
 assert.throws(()=>validKioskWorkers([worker,worker],a.companyId,1),/indisponible/);
});
test('pairing requires selected active location and reasonable name',()=>{
 assert.deepEqual(validPairingInput(id1,' Réception ',[location]),{location:id1,name:'Réception'});
 assert.throws(()=>validPairingInput(id1,'X',[location]),/invalide/);
 assert.throws(()=>validPairingInput(id1,'Borne',[{...location,active:false}]),/invalide/);
 assert.throws(()=>validPairingInput(id2,'Borne',[location]),/invalide/);
});
test('worker channels and enrollment verify membership and state',()=>{
 assert.equal(canAlterKioskWorker(worker,[worker],a),true);
 assert.equal(canAlterKioskWorker(worker,[worker],{...a,role:'admin'}),false);
 assert.equal(canAlterKioskWorker({...worker,company_id:'company-B'},[worker],a),false);
 assert.equal(canEnrollKioskPin(worker,[worker],a),true);
 assert.equal(canEnrollKioskPin({...worker,status:'disabled'},[worker],a),false);
 assert.equal(canEnrollKioskPin({...worker,can_kiosk_punch:false},[worker],a),false);
 assert.equal(canEnrollKioskPin({...worker,role:'admin'},[worker],a),false);
 assert.deepEqual(kioskIdleOptions,[5,10,15,30,60]);
 assert.equal(validKioskSecret('temporary-code'),'temporary-code');
 assert.throws(()=>validKioskSecret(''),/disponible/);
});
test('Expo panel fences loading, secrets and Alert callbacks; offers accessible controls',()=>{
 const src=readFileSync(new URL('../src/workforce/KioskPanel.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!identityMatches\)return <View/);
 assert.match(src,/scope\.current\.enter\(account\)/);
 assert.match(src,/scope\.current\.invalidate\(\)/);
 assert.match(src,/actionLock\.current/);
 assert.match(src,/validKioskDevices\(/);
 assert.match(src,/validKioskLocations\(/);
 assert.match(src,/validKioskWorkers\(/);
 assert.match(src,/validPairingInput\(/);
 assert.match(src,/canEnrollKioskPin\(/);
 assert.match(src,/if\(!current\(token\)\)throw/);
 assert.match(src,/\.limit\(501\)/);
 assert.match(src,/minHeight:48/);
 assert.match(src,/accessibilityRole="alert"/);
 assert.match(src,/Réessayer/);
 assert.match(src,/KioskOfflineReviewPanel/);
 assert.match(src,/kioskUrl/);
});
