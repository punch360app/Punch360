import test from 'node:test';
import assert from 'node:assert/strict';
import {createKioskOfflineScope,kioskReviewIdentity,canReviewKioskOffline,kioskReviewRows,isPendingKioskLot,validKioskReviewNote,canConfirmKioskLot} from '../src/workforce/kioskOfflineReviewScope.js';
const a={companyId:'A',userId:'alice',role:'boss',edition:'essential'};
const lot={id:'g1',closed_at:null,worker:'Worker B',device:'Tablet',events:[{id:'e1',state:'pending',action:'in',at:'2026-10-26T12:00:00Z'}]};
test('account/user/role/edition A-B-A invalidates callbacks',()=>{
 const scope=createKioskOfflineScope(a),old=scope.enter(a);
 const other=scope.enter({...a,companyId:'B'});assert.equal(scope.allows(old),false);
 const different=scope.enter({...a,userId:'bob'});assert.equal(scope.allows(other),false);
 const role=scope.enter({...a,role:'employee'});assert.equal(scope.allows(different),false);
 scope.enter({...a,edition:'construction'});assert.equal(scope.allows(role),false);
 scope.enter(a);assert.equal(scope.allows(old),false);
 const token=scope.current();scope.invalidate();assert.equal(scope.allows(token),false);
 assert.notEqual(kioskReviewIdentity(a),kioskReviewIdentity({...a,userId:'bob'}));
});
test('late list cannot repaint former tenant or trigger confirmation',async()=>{
 const scope=createKioskOfflineScope(a),old=scope.enter(a);
 let release;const delayed=new Promise(resolve=>release=resolve);let changed=0;
 const done=delayed.then(()=>{if(scope.allows(old))changed++});
 scope.enter({...a,userId:'bob'});release([lot]);await done;assert.equal(changed,0);
});
test('only managers can review, and closed/empty grants stay inert',()=>{
 assert.equal(canReviewKioskOffline(a),true);
 assert.equal(canReviewKioskOffline({...a,role:'employee'}),false);
 assert.equal(isPendingKioskLot(lot,[lot]),true);
 assert.equal(isPendingKioskLot({...lot,closed_at:'2026-10-26T15:00:00Z'},[lot]),false);
 assert.equal(isPendingKioskLot({...lot,events:[]},[lot]),false);
 assert.equal(isPendingKioskLot(lot,[]),false);
});
test('review note and explicit second confirmation cannot be reused for another lot',()=>{
 assert.equal(validKioskReviewNote('valid reason'),true);
 assert.equal(validKioskReviewNote('x'),false);
 assert.equal(validKioskReviewNote('x'.repeat(1001)),false);
 const pending={id:'g1',approve:true,note:'valid reason'};
 assert.equal(canConfirmKioskLot(pending,'valid reason',[lot],a),true);
 assert.equal(canConfirmKioskLot(pending,'different reason',[lot],a),false);
 assert.equal(canConfirmKioskLot({...pending,id:'g2'},'valid reason',[lot],a),false);
 assert.equal(canConfirmKioskLot(pending,'valid reason',[lot],{...a,role:'employee'}),false);
 assert.equal(canConfirmKioskLot(pending,'valid reason',[{...lot,closed_at:'now'}],a),false);
});
test('fail closed on malformed server grant lists',()=>{
 assert.deepEqual(kioskReviewRows([lot]),[lot]);
 assert.throws(()=>kioskReviewRows({items:[lot]}),/Incomplete/);
 assert.throws(()=>kioskReviewRows([{id:'g1',events:null}]),/Incomplete/);
 assert.throws(()=>kioskReviewRows(Array.from({length:101},(_,i)=>({...lot,id:String(i)}))),/Incomplete/);
});
test('Expo screen enforces scoped load, second check, accessible controls',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../src/workforce/KioskOfflineReviewPanel.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!identityMatches\)return <View/);
 assert.match(src,/scope\.current\.enter\(account\)/);
 assert.match(src,/scope\.current\.invalidate\(\)/);
 assert.match(src,/inFlight\.current/);
 assert.match(src,/if\(!current\(token\)\)throw/);
 assert.match(src,/canConfirmKioskLot\(/);
 assert.match(src,/review_kiosk_offline/);
 assert.match(src,/list_kiosk_offline/);
 assert.match(src,/minHeight:48/);
 assert.match(src,/accessibilityRole="alert"/);
 assert.match(src,/Réessayer/);
});
