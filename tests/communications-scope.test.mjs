import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommunicationsScope,communicationIdentity,canPublishCommunication,canWriteShiftNote,communicationRows,announcementReceiptRows,validCommunicationPublication,validCommunicationNote,canAcknowledgeAnnouncement,canWithdrawAnnouncement} from '../src/hr/communicationsScope.js';
const a={companyId:'A',userId:'alice',role:'admin',edition:'essential'};
const item={id:'x',company_id:'A',title:'Infos',body:'Information',department_id:null,withdrawn_at:null,expires_at:null};
test('company, user, role, edition and A B A invalidate stale private updates',()=>{
 const scope=createCommunicationsScope(a),first=scope.enter(a);
 const b=scope.enter({...a,companyId:'B'});assert.equal(scope.allows(first),false);
 const user=scope.enter({...a,userId:'bob'});assert.equal(scope.allows(b),false);
 const role=scope.enter({...a,role:'employee'});assert.equal(scope.allows(user),false);
 scope.enter({...a,edition:'construction'});assert.equal(scope.allows(role),false);
 scope.enter(a);assert.equal(scope.allows(first),false);
 const last=scope.current();scope.invalidate();assert.equal(scope.allows(last),false);
 assert.notEqual(communicationIdentity(a),communicationIdentity({...a,userId:'bob'}));
});
test('previous account request cannot repaint or withdraw after user switch',async()=>{
 const scope=createCommunicationsScope(a),token=scope.enter(a);let resolve;
 const delayed=new Promise(r=>resolve=r);let calls=0;
 const run=delayed.then(()=>{if(scope.allows(token))calls++});
 scope.enter({...a,companyId:'B'});resolve(item);await run;assert.equal(calls,0);
});
test('announcements and receipt reads fail closed on other company/user and truncation',()=>{
 assert.deepEqual(communicationRows([item],'A'),[item]);
 assert.throws(()=>communicationRows([{...item,company_id:'B'}],'A'),/incomplète/);
 assert.throws(()=>communicationRows([item,item], 'A',1),/incomplète/);
 assert.deepEqual(announcementReceiptRows([{announcement_id:'x',user_id:'alice'}],'alice',['x']),[{announcement_id:'x',user_id:'alice'}]);
 assert.throws(()=>announcementReceiptRows([{announcement_id:'x',user_id:'bob'}],'alice',['x']),/incomplets/);
 assert.throws(()=>announcementReceiptRows([{announcement_id:'y',user_id:'alice'}],'alice',['x']),/incomplets/);
});
test('publication requires authorized manager, active department and field bounds',()=>{
 assert.equal(canPublishCommunication(a,['announcements']),true);
 assert.equal(canPublishCommunication({...a,role:'employee'},['announcements']),false);
 assert.equal(canPublishCommunication(a,[]),false);
 assert.equal(canWriteShiftNote(a,['hr_documents']),true);
 assert.equal(canWriteShiftNote(a,[]),false);
 assert.deepEqual(validCommunicationPublication(' Salut ',' Hello ','dep',[{id:'dep',active:true}]),{title:'Salut',body:'Hello',department:'dep'});
 assert.throws(()=>validCommunicationPublication('x','test','',[]),/invalide/);
 assert.throws(()=>validCommunicationPublication('OK','test','other',[{id:'dep',active:true}]),/indisponible/);
 assert.equal(validCommunicationNote(' bonjour '),'bonjour');
 assert.throws(()=>validCommunicationNote(' '),/requise/);
 assert.throws(()=>validCommunicationNote('x'.repeat(3001)),/requise/);
});
test('acknowledgement remains user scoped; withdrawn and expired notices cannot be confirmed',()=>{
 assert.equal(canAcknowledgeAnnouncement(item,a,[item],[]),true);
 assert.equal(canAcknowledgeAnnouncement(item,{...a,companyId:'B'},[item],[]),false);
 assert.equal(canAcknowledgeAnnouncement(item,a,[item],[{announcement_id:'x',user_id:'alice'}]),false);
 assert.equal(canAcknowledgeAnnouncement({...item,withdrawn_at:'2026-10-30T00:00:00Z'},a,[item],[]),false);
 assert.equal(canAcknowledgeAnnouncement({...item,expires_at:'2020-01-01T00:00:00Z'},a,[item],[]),false);
 assert.equal(canWithdrawAnnouncement(item,a,['announcements'],[item]),true);
 assert.equal(canWithdrawAnnouncement(item,{...a,role:'employee'},['announcements'],[item]),false);
});
test('Expo screen scopes private feeds, RPC callbacks and confirmation alerts',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../src/hr/EssentialCommunicationsPanel.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!identityMatches\)return <View/);
 assert.match(src,/scope\.current\.enter\(account\)/);
 assert.match(src,/scope\.current\.invalidate\(\)/);
 assert.match(src,/actionLock\.current/);
 assert.match(src,/if\(!current\(token\)\)throw/);
 assert.match(src,/canAcknowledgeAnnouncement/);
 assert.match(src,/canWithdrawAnnouncement/);
 assert.match(src,/communicationRows/);
 assert.match(src,/announcementReceiptRows/);
 assert.match(src,/minHeight:48/);
 assert.match(src,/accessibilityRole="alert"/);
 assert.match(src,/Réessayer/);
});
