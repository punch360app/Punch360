import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMissingDayScope,canReviewMissingDay,canCancelMissingDay,chooseMissingDaySelection} from '../src/workforce/missingDayScope.js';

test('company, user, role, remount and A B A invalidate delayed data',()=>{
 const scope=createMissingDayScope('A','alice','employee');
 const first=scope.enter('A','alice','employee');
 const second=scope.enter('B','alice','employee');assert.equal(scope.allows(first),false);
 const third=scope.enter('B','bob','employee');assert.equal(scope.allows(second),false);
 const role=scope.enter('B','bob','boss');assert.equal(scope.allows(third),false);
 scope.enter('A','alice','employee');assert.equal(scope.allows(first),false);
 scope.invalidate();assert.equal(scope.allows(role),false);
});
test('review only by manager for pending request from another worker',()=>{
 const workers=[{id:'worker1',auth_user_id:'alice'},{id:'worker2',auth_user_id:'bob'}];
 const manager={role:'boss',userId:'alice'};
 assert.equal(canReviewMissingDay({status:'pending',worker_id:'worker2',requested_by:'bob'},manager,workers),true);
 assert.equal(canReviewMissingDay({status:'pending',worker_id:'worker1',requested_by:'alice'},manager,workers),false);
 assert.equal(canReviewMissingDay({status:'pending',worker_id:'worker2',requested_by:'alice'},manager,workers),false);
 assert.equal(canReviewMissingDay({status:'approved',worker_id:'worker2',requested_by:'bob'},manager,workers),false);
 assert.equal(canReviewMissingDay({status:'pending',worker_id:'missing',requested_by:'bob'},manager,workers),false);
 assert.equal(canReviewMissingDay({status:'pending',worker_id:'worker2',requested_by:'bob'},{role:'employee',userId:'alice'},workers),false);
});
test('cancel can only apply to own still pending request',()=>{
 assert.equal(canCancelMissingDay({status:'pending',requested_by:'alice'},'alice'),true);
 assert.equal(canCancelMissingDay({status:'pending',requested_by:'bob'},'alice'),false);
 assert.equal(canCancelMissingDay({status:'approved',requested_by:'alice'},'alice'),false);
});
test('selection revalidated against scoped worker/job lists',()=>{
 const f={worker:'from-other-company',job:'other-job',breaks:[],reason:'x'};
 assert.deepEqual(chooseMissingDaySelection(f,[{id:'mine'}],[{id:'job1'}]),{...f,worker:'mine',job:'job1'});
 assert.deepEqual(chooseMissingDaySelection(f,[],[]),{...f,worker:'',job:''});
 assert.equal(chooseMissingDaySelection({...f,worker:'mine',job:'job1'},[{id:'mine'}],[{id:'job1'}]).worker,'mine');
});
test('late network callback does not repaint former company',async()=>{
 const scope=createMissingDayScope('A','alice','employee');
 const token=scope.enter('A','alice','employee');
 let release;const delayed=new Promise(resolve=>{release=resolve});
 let writes=0;
 const done=delayed.then(()=>{if(scope.allows(token))writes++});
 scope.enter('B','alice','employee');release([{reason:'private'}]);await done;
 assert.equal(writes,0);
});
test('Expo missing-day screen guards rendering, ledger and reviewer action',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../src/workforce/MissingDaysPanel.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!identityMatches\)return <View/);
 assert.match(src,/scope\.current\.enter\(account\.companyId,account\.userId,account\.role\)/);
 assert.match(src,/scope\.current\.invalidate\(\)/);
 assert.match(src,/actionLock\.current/);
 assert.match(src,/canReviewMissingDay\(r,account,workers\)/);
 assert.match(src,/canCancelMissingDay\(r,account\.userId\)/);
 assert.match(src,/missingDayPayload\(account\.companyId,form\)/);
 assert.match(src,/durableLedgerRequest/);
 assert.match(src,/punch-missing-day:/);
 assert.match(src,/if\(!current\(token\)\)throw/);
 assert.match(src,/accessibilityRole="alert"/);
 assert.match(src,/Réessayer/);
 assert.match(src,/minHeight:48/);
});
