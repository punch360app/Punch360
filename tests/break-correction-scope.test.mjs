import test from 'node:test';
import assert from 'node:assert/strict';
import {createBreakCorrectionScope,canChooseBreakSession,canSelectOriginalBreak,canCancelBreakCorrection,canReviewBreakCorrection,validDecisionNote} from '../src/workforce/breakCorrectionScope.js';
const a={companyId:'A',userId:'alice',role:'admin',edition:'essential'};
const sessions=[{id:'s1',company_id:'A',user_id:'bob',worker_id:'w1',ended_at:'2026-10-20T16:00:00Z'},{id:'s2',company_id:'A',user_id:'alice',worker_id:'w2',ended_at:'2026-10-21T16:00:00Z'}];
const request={id:'r1',session_id:'s1',company_id:'A',requested_by:'bob',status:'pending'};
test('old asynchronous tokens invalid after tenant, user, role, edition and A B A',()=>{
 const scope=createBreakCorrectionScope(a),one=scope.enter(a);
 const two=scope.enter({...a,companyId:'B'});assert.equal(scope.allows(one),false);
 const three=scope.enter({...a,userId:'charlie'});assert.equal(scope.allows(two),false);
 scope.enter({...a,role:'employee'});assert.equal(scope.allows(three),false);
 scope.enter({...a,edition:'construction'});scope.enter(a);assert.equal(scope.allows(one),false);
 const token=scope.current();scope.invalidate();assert.equal(scope.allows(token),false);
});
test('delayed response from prior account is ignored',async()=>{
 const scope=createBreakCorrectionScope(a),token=scope.enter(a);let resolve;const pending=new Promise(r=>resolve=r);
 let writes=0;const action=pending.then(()=>{if(scope.allows(token))writes++});
 scope.enter({...a,userId:'charlie'});resolve('private');await action;assert.equal(writes,0);
});
test('choose only active company terminated sessions and belonging breaks',()=>{
 assert.equal(canChooseBreakSession(sessions[0],sessions,a),true);
 assert.equal(canChooseBreakSession(sessions[0],sessions,{...a,role:'employee',userId:'bob'}),true);
 assert.equal(canChooseBreakSession(sessions[0],sessions,{...a,role:'employee'}),false);
 assert.equal(canChooseBreakSession({...sessions[0],company_id:'B'},sessions,a),false);
 const b={id:'b1',session_id:'s1',ended_at:'2026-10-20T12:30:00Z'};
 assert.equal(canSelectOriginalBreak(b,'s1',[b]),true);
 assert.equal(canSelectOriginalBreak(b,'s2',[b]),false);
});
test('cancellation and manager review deny self-review or unknown session',()=>{
 assert.equal(canCancelBreakCorrection(request,{...a,userId:'bob'},[request]),true);
 assert.equal(canCancelBreakCorrection(request,a,[request]),false);
 assert.equal(canCancelBreakCorrection({...request,status:'approved'},a,[request]),false);
 assert.equal(canReviewBreakCorrection(request,a,[request],sessions),true);
 assert.equal(canReviewBreakCorrection(request,{...a,role:'employee'},[request],sessions),false);
 assert.equal(canReviewBreakCorrection({...request,requested_by:'alice'},a,[{...request,requested_by:'alice'}],sessions),false);
 assert.equal(canReviewBreakCorrection({...request,session_id:'s2'},a,[{...request,session_id:'s2'}],sessions),false);
 assert.equal(canReviewBreakCorrection(request,a,[request],[]),false);
 assert.equal(canReviewBreakCorrection(request,a,[request],sessions,[{id:'w1',auth_user_id:'alice'}]),false);
 assert.equal(validDecisionNote('valid reason'),true);assert.equal(validDecisionNote('x'),false);
});
test('Expo screen protects durable request, view and private decisions',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../src/workforce/BreakCorrectionsPanel.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!identityMatches\)return <View/);
 assert.match(src,/scope\.current\.enter\(account\)/);
 assert.match(src,/scope\.current\.invalidate\(\)/);
 assert.match(src,/actionLock\.current/);
 assert.match(src,/if\(!current\(token\)\)throw/);
 assert.match(src,/canCancelBreakCorrection\(/);
 assert.match(src,/canReviewBreakCorrection\(/);
 assert.match(src,/breakCorrectionPayload\(form\)/);
 assert.match(src,/durableLedgerRequest/);
 assert.match(src,/punch-break-request:/);
 assert.match(src,/accessibilityRole="alert"/);
 assert.match(src,/minHeight:48/);
 assert.match(src,/Réessayer/);
});
