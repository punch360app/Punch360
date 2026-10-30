import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBreakPolicyScope,parseBreakPolicyMinutes,currentDepartmentPolicy} from '../src/workforce/breakPolicyScope.js';

test('worker hook excludes pending responses from old company, user, role, and unmount',()=>{
 const scope=createBreakPolicyScope('A','alice','employee');
 const a=scope.enter('A','alice','employee');
 const b=scope.enter('B','alice','employee');assert.equal(scope.allows(a),false);
 const c=scope.enter('B','bob','employee');assert.equal(scope.allows(b),false);
 const d=scope.enter('B','bob','boss');assert.equal(scope.allows(c),false);
 scope.invalidate();assert.equal(scope.allows(d),false);
});
test('A-B-A identity switch never revives former A policy',()=>{
 const scope=createBreakPolicyScope('A','alice','employee');
 const old=scope.enter('A','alice','employee');scope.enter('B','alice','employee');
 const fresh=scope.enter('A','alice','employee');
 assert.equal(scope.allows(old),false);assert.equal(scope.allows(fresh),true);
});
test('break minute form validates whole numbers and null optionals',()=>{
 assert.equal(parseBreakPolicyMinutes('',240,1),null);
 assert.equal(parseBreakPolicyMinutes('15',240,1),15);
 assert.equal(parseBreakPolicyMinutes('0',1440,0),0);
 for(const bad of ['-1','1.5',' 1','01a','999999999999999'])assert.throws(()=>parseBreakPolicyMinutes(bad,240,1));
 assert.throws(()=>parseBreakPolicyMinutes('0',240,1));
 assert.throws(()=>parseBreakPolicyMinutes('241',240,1));
 assert.throws(()=>parseBreakPolicyMinutes('1441',1440,0));
});
test('effective policy picks newest eligible version, ignores future and invalid dates',()=>{
 const at=Date.parse('2026-10-29T10:00:00Z');
 const records=[
  {department_id:'D',effective_at:'2026-10-29T08:00:00Z',version:1,paid_mode:'choice'},
  {department_id:'D',effective_at:'2026-10-30T08:00:00Z',version:3,paid_mode:'unpaid'},
  {department_id:'D',effective_at:'not-a-date',version:15,paid_mode:'paid'},
  {department_id:'D',effective_at:'2026-10-29T08:00:00Z',version:2,paid_mode:'paid'},
  {department_id:'X',effective_at:'2026-10-29T09:00:00Z',version:8,paid_mode:'unpaid'}
 ];
 assert.equal(currentDepartmentPolicy(records,'D',at)?.version,2);
 assert.equal(currentDepartmentPolicy(records,'Z',at),null);
});
test('late callback after account switch cannot apply previous break policy',async()=>{
 const scope=createBreakPolicyScope('A','alice','employee'),token=scope.enter('A','alice','employee');
 let release;const pending=new Promise(resolve=>{release=resolve}),display=[];
 const completion=pending.then(v=>{if(scope.allows(token))display.push(v)});
 scope.enter('B','bob','employee');release({paid_mode:'paid'});await completion;
 assert.deepEqual(display,[]);
});
test('hook and admin screen contain synchronous identity guards, versioned writes and retry',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/workforce/BreakPoliciesPanel.tsx',import.meta.url),'utf8');
 assert.match(source,/if\(!identityMatches\)return <View/);
 assert.match(source,/scope\.current\.enter\(account\.companyId,account\.userId,account\.role\)/);
 assert.match(source,/scope\.current\.invalidate\(\)/);
 assert.match(source,/setPolicy\(null\)/);
 assert.match(source,/actionLock\.current/);
 assert.match(source,/p_expected_version:/);
 assert.match(source,/parseBreakPolicyMinutes/);
 assert.match(source,/Réessayer/);
 assert.match(source,/minHeight:48/);
});
