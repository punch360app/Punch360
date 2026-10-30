import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationsScope,operationsIdentity,canEditOperations,validOperationsJob,operationsDraftJob,canCancelShift,canReadCompanyDocument,parseOperationsShiftDates} from '../src/workforce/operationsScope.js';

const a={companyId:'A',userId:'alice',role:'admin',edition:'construction',defaultJobId:'j'};
const b={...a,companyId:'B'};
test('company/user/role/edition/default job/tab and A B A invalidate old callbacks',()=>{
 const scope=createOperationsScope(a,'schedule');
 const old=scope.enter(a,'schedule');
 assert.ok(scope.matches(a,'schedule'));assert.ok(scope.allows(old));
 const next=scope.enter(b,'schedule');assert.equal(scope.allows(old),false);
 const role=scope.enter({...b,role:'employee'},'schedule');assert.equal(scope.allows(next),false);
 scope.enter({...b,role:'employee'},'documents');assert.equal(scope.allows(role),false);
 const tab=scope.current();assert.equal(scope.matches({...b,role:'employee'},'invite'),false);
 scope.enter(a,'schedule');assert.equal(scope.allows(old),false);
 scope.invalidate();assert.equal(scope.allows(tab),false);
 assert.notEqual(operationsIdentity(a,'schedule'),operationsIdentity({...a,defaultJobId:'j2'},'schedule'));
 assert.notEqual(operationsIdentity(a,'schedule'),operationsIdentity({...a,edition:'essential'},'schedule'));
});
test('late file-picker, network or share continuation never passes stale token',async()=>{
 const scope=createOperationsScope(a,'documents');const token=scope.enter(a,'documents');
 let resolve;const pending=new Promise(r=>resolve=r);
 let sideEffects=0;
 const continuation=pending.then(()=>{if(scope.allows(token))sideEffects++});
 scope.enter(b,'documents');resolve('chosen.pdf');await continuation;
 assert.equal(sideEffects,0);
});
test('manager-only edit guards, scoped cancellation and PDFs',()=>{
 assert.equal(canEditOperations('boss'),true);assert.equal(canEditOperations('admin'),true);
 assert.equal(canEditOperations('lead'),false);
 assert.equal(canCancelShift({id:'s',company_id:'A'},a),true);
 assert.equal(canCancelShift({id:'s',company_id:'B'},a),false);
 assert.equal(canCancelShift({id:'s',company_id:'A',cancelled_at:'now'},a),false);
 assert.equal(canCancelShift({id:'s',company_id:'A'},{...a,role:'lead'}),false);
 assert.equal(canReadCompanyDocument({id:'d',company_id:'A',storage_path:'A/j/file.pdf'},a),true);
 assert.equal(canReadCompanyDocument({id:'d',company_id:'B',storage_path:'B/j/file.pdf'},a),false);
 assert.equal(canReadCompanyDocument({id:'d',company_id:'A',storage_path:'B/j/file.pdf'},a),false);
 assert.equal(canReadCompanyDocument({id:'d',company_id:'A',storage_path:'A2/j/file.pdf'},a),false);
});
test('reject stale job selection, invalid timezone and oversized shift before RPC',()=>{
 assert.equal(validOperationsJob('old',[{id:'new'}]),false);
 assert.equal(operationsDraftJob('old',[{id:'new'}]),'new');
 assert.equal(operationsDraftJob('old',[]),'');
 const result=parseOperationsShiftDates('2026-11-01T00:00:00-04:00','2026-11-01T04:00:00-05:00');
 assert.equal(Date.parse(result.end)-Date.parse(result.start),5*3600000);
 assert.throws(()=>parseOperationsShiftDates('2026-11-01T08:00','2026-11-01T10:00Z'),/fuseau/);
 assert.throws(()=>parseOperationsShiftDates('2026-11-01T00:00:00-04:00','2026-11-03T00:00:00-05:00'),/24/);
});
test('Expo operations panel connects scope to load, visible state, PDF and invite mutations',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/workforce/OperationsPanel.tsx',import.meta.url),'utf8');
 assert.match(source,/if\(!identityMatches\)return <View/);
 assert.match(source,/scope\.current\.enter\(account,mode\)/);
 assert.match(source,/scope\.current\.invalidate\(\)/);
 assert.match(source,/actionLock\.current/);
 assert.match(source,/if\(!current\(token\)\)return/);
 assert.match(source,/if\(!current\(token\)\)throw/);
 assert.match(source,/DocumentPicker\.getDocumentAsync/);
 assert.match(source,/new File\(asset\.uri\)\.arrayBuffer\(\)/);
 assert.match(source,/supabase\.storage\.from\('job-documents'\)\.upload/);
 assert.match(source,/Share\.share/);
 assert.match(source,/canReadCompanyDocument/);
 assert.match(source,/canCancelShift/);
 assert.match(source,/createSignedUrl/);
 assert.match(source,/minHeight:48/);
 assert.match(source,/Réessayer/);
 assert.match(source,/accessibilityRole="alert"/);
});
