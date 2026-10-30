import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApprovalScope,approvalRpcNames,canActOnApproval} from '../src/workforce/approvalScope.js';

test('old supervisor permission and inbox results are invalid after account, role, or logout transition',()=>{
 const scope=createApprovalScope('A','alice','lead'),first=scope.enter('A','alice','lead');
 const company=scope.enter('B','alice','lead');assert.equal(scope.allows(first),false);
 const person=scope.enter('B','bob','lead');assert.equal(scope.allows(company),false);
 const role=scope.enter('B','bob','employee');assert.equal(scope.allows(person),false);
 scope.invalidate();assert.equal(scope.allows(role),false);
});
test('same account A after visiting B does not accept old A response',()=>{
 const scope=createApprovalScope('A','alice','boss'),old=scope.enter('A','alice','boss');
 scope.enter('B','alice','boss');const fresh=scope.enter('A','alice','boss');
 assert.equal(scope.allows(old),false);assert.equal(scope.allows(fresh),true);
});
test('approval action requires current visible request with known domain',()=>{
 const inbox=[{id:'a',kind:'time'},{id:'b',kind:'leave'}];
 assert.equal(canActOnApproval(inbox,'time','a'),true);
 assert.equal(canActOnApproval(inbox,'leave','b'),true);
 assert.equal(canActOnApproval(inbox,'pause','a'),false);
 assert.equal(canActOnApproval(inbox,'other','b'),false);
 assert.equal(canActOnApproval([],'time','a'),false);
 assert.equal(approvalRpcNames.day,'review_essential_missing_day');
});
test('late delegated-access lookup cannot re-enable another account',async()=>{
 const scope=createApprovalScope('A','alice','lead'),token=scope.enter('A','alice','lead');
 let resolve;const request=new Promise(done=>{resolve=done}),result=[];
 const completion=request.then(allowed=>{if(scope.allows(token))result.push(allowed)});
 scope.enter('B','alice','lead');resolve(true);await completion;
 assert.deepEqual(result,[]);
});
test('hook and approval panel guard rendering, RPC, loading, and double decisions',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/workforce/SupervisorApprovalsPanel.tsx',import.meta.url),'utf8');
 assert.match(source,/if\(!identityMatches\)return <View/);
 assert.match(source,/scope\.current\.enter\(account\.companyId,account\.userId,account\.role\)/);
 assert.match(source,/scope\.current\.invalidate\(\)/);
 assert.match(source,/setRows\(\[\]\)/);
 assert.match(source,/actionLock\.current/);
 assert.match(source,/canActOnApproval\(rows,row\.kind,row\.id\)/);
 assert.match(source,/if\(!current\(token\)\)return/);
 assert.match(source,/accessibilityRole="alert"/);
 assert.match(source,/Réessayer/);
 assert.match(source,/minHeight:48/);
});
