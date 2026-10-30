import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSupportAccountScope,supportAccountIdentity,safeSupportTicketPage,safeSupportTicketDetail,isKnownSupportTicket} from '../src/support/supportScope.js';
const a={companyId:'A',userId:'alice',role:'employee',edition:'essential'};
const ticket={id:'t',company_id:'A',created_by:'alice',subject:'Support',status:'open',version:2,updated_at:'2026-10-30T12:00:00Z'};
test('same-company different user and role, edition, tenant, A B A invalidate private state',()=>{
 const s=createSupportAccountScope(a),first=s.enter(a);
 const another=s.enter({...a,userId:'bob'});assert.equal(s.allows(first),false);
 const role=s.enter({...a,role:'admin'});assert.equal(s.allows(another),false);
 const edition=s.enter({...a,edition:'construction'});assert.equal(s.allows(role),false);
 const tenant=s.enter({...a,companyId:'B'});assert.equal(s.allows(edition),false);
 s.enter(a);assert.equal(s.allows(first),false);assert.equal(s.allows(tenant),false);
 const now=s.current();s.invalidate();assert.equal(s.allows(now),false);
 assert.notEqual(supportAccountIdentity(a),supportAccountIdentity({...a,userId:'bob'}));
});
test('late response from prior session cannot paint messages or trigger a reply',async()=>{
 const s=createSupportAccountScope(a),token=s.enter(a);let done;const delayed=new Promise(r=>done=r);
 let writes=0;const work=delayed.then(()=>{if(s.allows(token))writes++});
 s.enter({...a,userId:'bob'});done(ticket);await work;assert.equal(writes,0);
});
test('reject cross-tenant, foreign authors, duplicates, truncated or invalid status',()=>{
 assert.deepEqual(safeSupportTicketPage([ticket],a),[ticket]);
 assert.throws(()=>safeSupportTicketPage([{...ticket,company_id:'B'}],a),/incomplète/);
 assert.throws(()=>safeSupportTicketPage([{...ticket,created_by:'bob'}],a),/incomplète/);
 assert.deepEqual(safeSupportTicketPage([{...ticket,created_by:'bob'}],{...a,role:'admin'}),[{...ticket,created_by:'bob'}]);
 assert.throws(()=>safeSupportTicketPage([ticket,ticket],a),/Doublon/);
 assert.throws(()=>safeSupportTicketPage([{...ticket,status:'deleted'}],a),/incomplète/);
 assert.throws(()=>safeSupportTicketPage(Array(51).fill(ticket),a),/incomplète/);
});
test('ticket detail and messages limited to current account',()=>{
 const d={...ticket,messages:[{id:'m1',body:'Private note'}]};
 assert.deepEqual(safeSupportTicketDetail(d,a),d);
 assert.equal(isKnownSupportTicket('t',[ticket]),true);
 assert.equal(isKnownSupportTicket('other',[ticket]),false);
 assert.throws(()=>safeSupportTicketDetail({...d,created_by:'bob'},a),/incomplète/);
 assert.throws(()=>safeSupportTicketDetail({...d,messages:null},a),/incomplète/);
 assert.throws(()=>safeSupportTicketDetail({...d,messages:[...d.messages,...d.messages]},a),/double/);
});
test('screen clears private state on role/user switches and retains idempotent retry ledger',async()=>{
 const {readFileSync}=await import('node:fs');
 const s=readFileSync(new URL('../src/support/SupportPanel.tsx',import.meta.url),'utf8');
 const parent=readFileSync(new URL('../src/workforce/ManagementWorkspace.tsx',import.meta.url),'utf8');
 assert.match(s,/if\(!identityMatches\)return <View/);
 assert.match(s,/scope\.current\.enter\(account\)/);
 assert.match(s,/scope\.current\.invalidate\(\)/);
 assert.match(s,/actionLock\.current/);
 assert.match(s,/safeSupportTicketPage\(/);
 assert.match(s,/safeSupportTicketDetail\(/);
 assert.match(s,/p_request:requestId\(payload\)/);
 assert.match(s,/p_expected_version/);
 assert.match(s,/minHeight:48/);
 assert.match(s,/accessibilityRole="alert"/);
 assert.match(s,/Réessayer/);
 assert.match(parent,/<SupportPanel key=\{\[account\.companyId,account\.userId,account\.role,account\.edition\]\.join\(':'\)\}/);
});
