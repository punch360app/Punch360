import test from 'node:test';
import assert from 'node:assert/strict';
import {createBossHandoffScope,canViewHandoff,activeHandoffAdmins,validHandoffStatus,handoffActionAllowed,handoffExpected} from '../src/workforce/bossHandoffScope.js';
const a={companyId:'c',userId:'boss',role:'boss',edition:'essential'};
const admins=[{user_id:'admin',role:'admin',status:'active'}];
const pending={id:'h',company_id:'c',from_user:'boss',to_user:'admin',version:1,status:'pending',can_accept:false,can_complete:false,expires_at:'2026-11-01T12:00:00Z'};
test('company/user/role/edition and A-B-A revoke old MFA and confirmation tokens',()=>{
 const s=createBossHandoffScope(a),old=s.enter(a);
 const next=s.enter({...a,companyId:'B'});assert.equal(s.allows(old),false);
 const user=s.enter({...a,userId:'other'});assert.equal(s.allows(next),false);
 const role=s.enter({...a,role:'employee'});assert.equal(s.allows(user),false);
 s.enter({...a,edition:'construction'});assert.equal(s.allows(role),false);
 s.enter(a);assert.equal(s.allows(old),false);
 const t=s.current();s.invalidate();assert.equal(s.allows(t),false);
});
test('late AAL2 response cannot authorize the next account',async()=>{
 const scope=createBossHandoffScope(a),old=scope.enter(a);
 let resolve;const pendingPromise=new Promise(r=>resolve=r);let accepted=0;
 const result=pendingPromise.then(()=>{if(scope.allows(old))accepted++});
 scope.enter({...a,userId:'different'});resolve({currentLevel:'aal2'});await result;
 assert.equal(accepted,0);
});
test('manager-only access and active valid successor',()=>{
 assert.equal(canViewHandoff(a),true);
 assert.equal(canViewHandoff({...a,role:'lead'}),false);
 assert.equal(canViewHandoff({...a,edition:'construction'}),false);
 assert.deepEqual(activeHandoffAdmins([...admins,{user_id:'boss',role:'admin',status:'active'},...admins],a),admins);
 assert.throws(()=>activeHandoffAdmins(null,a),/indisponibles/);
 assert.throws(()=>activeHandoffAdmins(admins,{...a,role:'employee'}),/indisponibles/);
});
test('handoff status must match company and participating user',()=>{
 assert.deepEqual(validHandoffStatus(pending,a),pending);
 assert.equal(validHandoffStatus(null,a),null);
 assert.throws(()=>validHandoffStatus({...pending,company_id:'B'},a),/non valide/);
 assert.throws(()=>validHandoffStatus({...pending,version:0},a),/non valide/);
 assert.throws(()=>validHandoffStatus({...pending,from_user:'x',to_user:'y'},a),/non valide/);
});
test('only correct actor can request/accept/complete/cancel',()=>{
 assert.equal(handoffActionAllowed('request',null,a,admins,'admin','motif assez long'),true);
 assert.equal(handoffActionAllowed('request',pending,a,admins,'admin','motif assez long'),false);
 assert.equal(handoffActionAllowed('request',null,{...a,role:'admin'},admins,'admin','motif assez long'),false);
 assert.equal(handoffActionAllowed('request',null,a,admins,'boss','motif assez long'),false);
 assert.equal(handoffActionAllowed('request',null,a,admins,'admin','short'),false);
 assert.equal(handoffActionAllowed('accept',pending,{...a,userId:'admin',role:'admin'},admins,'',''),false);
 assert.equal(handoffActionAllowed('accept',{...pending,can_accept:true},{...a,userId:'admin',role:'admin'},admins,'',''),true);
 assert.equal(handoffActionAllowed('complete',{...pending,status:'accepted',version:2,can_complete:true},a,admins,'',''),true);
 assert.equal(handoffActionAllowed('complete',{...pending,status:'accepted',version:2,can_complete:true},{...a,role:'admin'},admins,'',''),false);
 assert.equal(handoffActionAllowed('cancel',pending,a,admins,'',''),true);
 assert.equal(handoffActionAllowed('cancel',pending,{...a,userId:'outsider',role:'admin'},admins,'',''),false);
});
test('confirmation text preserves server contract',()=>{
 assert.equal(handoffExpected('request','c',pending,'admin'),'c:admin');
 assert.equal(handoffExpected('accept','c',pending,''),'c:boss');
 assert.equal(handoffExpected('complete','c',pending,''),'c:admin');
 assert.equal(handoffExpected('cancel','c',pending,''),'');
});
test('Expo handoff component guards MFA, double approval and sign-out',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../src/workforce/BossHandoffPanel.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!identityMatches\)return <View/);
 assert.match(src,/scope\.current\.enter\(account\)/);
 assert.match(src,/scope\.current\.invalidate\(\)/);
 assert.match(src,/actionLock\.current/);
 assert.match(src,/validHandoffStatus\(/);
 assert.match(src,/handoffActionAllowed\(/);
 assert.match(src,/handoffExpected\(/);
 assert.match(src,/if\(!current\(token\)\)throw/);
 assert.match(src,/essential_boss_handoff_complete/);
 assert.match(src,/p_expected_version/);
 assert.match(src,/scope:'local'/);
 assert.match(src,/accessibilityRole="alert"/);
 assert.match(src,/minHeight:48/);
});
