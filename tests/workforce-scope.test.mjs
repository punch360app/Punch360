import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkforceScope,workforceIdentity,canManageWorkforce,canReviewWorkforceRequest,canChangeOrder,belongsToActiveSession,workforceCorrectionDates,payrollMonday,csvCell,exportSessionIds} from '../src/workforce/workforceScope.js';
const a={companyId:'A',userId:'alice',role:'boss',edition:'construction'};
test('tenant, user, role, edition, mode and A B A invalidate stale UI',()=>{
 const scope=createWorkforceScope(a,false),old=scope.enter(a,false);
 const b=scope.enter({...a,companyId:'B'},false);assert.equal(scope.allows(old),false);
 const role=scope.enter({...a,role:'employee'},false);assert.equal(scope.allows(b),false);
 scope.enter({...a,role:'employee'},true);assert.equal(scope.allows(role),false);
 const current=scope.enter(a,false);assert.equal(scope.allows(old),false);
 scope.invalidate();assert.equal(scope.allows(current),false);
 assert.notEqual(workforceIdentity(a),workforceIdentity({...a,userId:'bob'}));
 assert.notEqual(workforceIdentity(a),workforceIdentity({...a,edition:'essential'}));
});
test('late export response is not shared after account switch',async()=>{
 const scope=createWorkforceScope(a,false),token=scope.enter(a,false);
 let complete;const delayed=new Promise(resolve=>complete=resolve);let shares=0;
 const pending=delayed.then(()=>{if(scope.allows(token))shares++});
 scope.enter({...a,companyId:'B'},false);complete('csv');await pending;
 assert.equal(shares,0);
});
test('review only current other-user pending requests; orders only approved path',()=>{
 assert.equal(canManageWorkforce(a),true);assert.equal(canManageWorkforce({...a,role:'lead'}),false);
 assert.equal(canReviewWorkforceRequest({company_id:'A',status:'pending',requested_by:'bob'},a,'correction'),true);
 assert.equal(canReviewWorkforceRequest({company_id:'A',status:'pending',requested_by:'alice'},a,'correction'),false);
 assert.equal(canReviewWorkforceRequest({company_id:'A',status:'pending',user_id:'bob'},a,'leave'),true);
 assert.equal(canReviewWorkforceRequest({company_id:'A',status:'pending',user_id:'alice'},a,'leave'),false);
 assert.equal(canReviewWorkforceRequest({company_id:'B',status:'pending',user_id:'bob'},a,'leave'),false);
 assert.equal(canChangeOrder({company_id:'A',status:'requested'},a,'approved'),true);
 assert.equal(canChangeOrder({company_id:'A',status:'requested'},a,'delivered'),false);
 assert.equal(canChangeOrder({company_id:'B',status:'requested'},a,'approved'),false);
});
test('personal corrections cannot select a session from another user',()=>{
 const records=[{id:'s',company_id:'A',user_id:'alice',ended_at:'2026-10-29T10:00:00Z'}];
 assert.equal(belongsToActiveSession(records[0],records,a,false),true);
 assert.equal(belongsToActiveSession({...records[0],user_id:'bob'},records,a,false),false);
 assert.equal(belongsToActiveSession(records[0],records,a,true),false);
});
test('strict offset dates, Monday and CSV injection',()=>{
 assert.equal(Date.parse(workforceCorrectionDates('2026-11-01T00:00:00-04:00','2026-11-01T04:00:00-05:00').end)-Date.parse(workforceCorrectionDates('2026-11-01T00:00:00-04:00','2026-11-01T04:00:00-05:00').start),5*3600000);
 assert.throws(()=>workforceCorrectionDates('2026-11-01T10:00:00','2026-11-01T11:00:00Z'),/fuseau/);
 assert.throws(()=>workforceCorrectionDates('2026-11-01T20:00:00Z','2026-11-01T19:00:00Z'),/invalides/);
 assert.equal(payrollMonday('2026-10-26'),'2026-10-26');
 assert.throws(()=>payrollMonday('2026-10-27'),/lundi/);
 assert.throws(()=>payrollMonday('2026-02-30'),/lundi/);
 assert.equal(csvCell('=cmd'),'"\'=cmd"');
 assert.deepEqual(exportSessionIds([{session_id:'s1'},{session_id:'s1'},{session_id:'s2'}]),['s1','s2']);
});
test('source protects asynchronous export and server decisions',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../src/workforce/WorkforcePanel.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!identityMatches\)return <View/);
 assert.match(src,/scope\.current\.enter\(account,managementOnly\)/);
 assert.match(src,/scope\.current\.invalidate\(\)/);
 assert.match(src,/actionLock\.current/);
 assert.match(src,/canReviewWorkforceRequest/);
 assert.match(src,/workforceCorrectionDates/);
 assert.match(src,/exportSessionIds/);
 assert.match(src,/if\(!current\(token\)\)throw/);
 assert.match(src,/if\(!current\(token\)\)return/);
 assert.match(src,/\\.in\('session_id',batch\)/);
 assert.match(src,/Sharing\.shareAsync/);
 assert.match(src,/Share\.share/);
 assert.match(src,/accessibilityRole="alert"/);
 assert.match(src,/minHeight:48/);
 assert.match(src,/Réessayer/);
});
