import test from 'node:test';
import assert from 'node:assert/strict';
import {createPayrollExportScope,payrollExportIdentity,payrollDefaultColumns,mayUsePayrollExport,
 payrollPrivateRows,validatePayrollProfile,validPayrollMapping,canUsePayrollPreview,
 payrollRequestKey,validExportFilename} from '../src/hr/payrollExportScope.js';
const account={companyId:'A',userId:'alice',role:'admin',edition:'essential'};
const estimate={id:'e1',company_id:'A',week_start:'2026-10-26'};
const profile={id:'p1',company_id:'A',version:3,delimiter:',',columns:payrollDefaultColumns(),active:true};
const preview={id:'123e4567-e89b-12d3-a456-426614174000',company_id:'A',created_by:'alice',
 profile_id:'p1',estimate_id:'e1',payload:{profile_version:3,delimiter:',',
 columns:payrollDefaultColumns(),rows:[{external_id:'100'}],week:'2026-10-26'}};
test('A B A, user, role, edition, estimate and report changes revoke old snapshots',()=>{
 const s=createPayrollExportScope(account,estimate),a=s.enter(account,estimate);
 const b=s.enter({...account,companyId:'B'},estimate);assert.equal(s.allows(a),false);
 const user=s.enter({...account,userId:'bob'},estimate);assert.equal(s.allows(b),false);
 const role=s.enter({...account,role:'employee'},estimate);assert.equal(s.allows(user),false);
 const edition=s.enter({...account,edition:'construction'},estimate);assert.equal(s.allows(role),false);
 const estimate2=s.enter(account,{...estimate,id:'e2'});assert.equal(s.allows(edition),false);
 const version=s.enter(account,{...estimate,payload:{generated_at:'later'}});assert.equal(s.allows(estimate2),false);
 s.enter(account,estimate);assert.equal(s.allows(a),false);
 const current=s.current();s.invalidate();assert.equal(s.allows(current),false);
 assert.notEqual(payrollExportIdentity(account,estimate),payrollExportIdentity({...account,userId:'bob'},estimate));
});
test('late preview response cannot appear in another employee session',async()=>{
 const s=createPayrollExportScope(account,estimate),token=s.enter(account,estimate);
 let resolve;const pending=new Promise(r=>resolve=r);let accepted=0;
 const action=pending.then(()=>{if(s.allows(token))accepted++});
 s.enter({...account,userId:'other'},estimate);resolve(preview);await action;
 assert.equal(accepted,0);
});
test('profiles and mappings reject other-company rows and partial pages',()=>{
 assert.deepEqual(payrollPrivateRows([profile],'A'),[profile]);
 assert.throws(()=>payrollPrivateRows([{...profile,company_id:'B'}],'A'),/indisponible/);
 assert.throws(()=>payrollPrivateRows([profile,profile],'A',1),/indisponible/);
});
test('profile and mapping require correct fields, amount-free format and audit reasons',()=>{
 const cols=payrollDefaultColumns();
 assert.equal(validatePayrollProfile('  Fournisseur  ',',',cols,'motif documenté').name,'Fournisseur');
 assert.throws(()=>validatePayrollProfile('x',',',cols,'motif documenté'),/invalide/);
 assert.throws(()=>validatePayrollProfile('Bon',',',[{key:'external_id',header:'ID'}],'motif documenté'),/invalide/);
 assert.throws(()=>validatePayrollProfile('Bon',',',[cols[0],cols[0]],'motif documenté'),/invalide/);
 assert.throws(()=>validatePayrollProfile('Bon',',',[...cols,{key:'bad',header:'Bad'}],'motif documenté'),/invalide/);
 assert.throws(()=>validatePayrollProfile('Bon',',',cols,'a'),/invalide/);
 assert.deepEqual(validPayrollMapping('w',' 123 ','raison valide',[{id:'w'}]),{worker:'w',external:'123',reason:'raison valide'});
 assert.throws(()=>validPayrollMapping('foreign','123','raison valide',[{id:'w'}]),/invalide/);
 assert.throws(()=>validPayrollMapping('w','bad\ncell','raison valide',[{id:'w'}]),/invalide/);
});
test('CSV preview rejects wrong profile, version, user, report and account',()=>{
 assert.equal(mayUsePayrollExport(account),true);
 assert.equal(mayUsePayrollExport({...account,role:'employee'}),false);
 assert.equal(canUsePayrollPreview(preview,account,estimate,profile),true);
 assert.equal(canUsePayrollPreview({...preview,company_id:'B'},account,estimate,profile),false);
 assert.equal(canUsePayrollPreview({...preview,created_by:'bob'},account,estimate,profile),false);
 assert.equal(canUsePayrollPreview(preview,{...account,role:'employee'},estimate,profile),false);
 assert.equal(canUsePayrollPreview(preview,account,{...estimate,id:'e2'},profile),false);
 assert.equal(canUsePayrollPreview(preview,account,estimate,{...profile,version:4}),false);
 assert.equal(canUsePayrollPreview(preview,account,estimate,{...profile,id:'p2'}),false);
});
test('retry request id stays stable for identical snapshot and changes for new version',()=>{
 const key=payrollRequestKey(account,profile,estimate);
 assert.equal(key,payrollRequestKey({...account}, {...profile}, {...estimate}));
 assert.notEqual(key,payrollRequestKey(account,{...profile,version:4},estimate));
 assert.notEqual(key,payrollRequestKey({...account,userId:'bob'},profile,estimate));
 assert.equal(validExportFilename(preview),'PUNCH-paie-2026-10-26-123e4567-e89b-12d3-a456-426614174000.csv');
 assert.throws(()=>validExportFilename({...preview,id:'../../escape'}),/invalide/);
});
test('Expo component gates sharing and clears old private reports on changes',async()=>{
 const {readFileSync}=await import('node:fs');
 const s=readFileSync(new URL('../src/hr/PayrollExportPanel.tsx',import.meta.url),'utf8');
 const parent=readFileSync(new URL('../src/hr/EssentialPayrollPanel.tsx',import.meta.url),'utf8');
 assert.match(s,/if\(!identityMatches\)return <View/);
 assert.match(s,/scope\.current\.enter\(account,estimate\)/);
 assert.match(s,/scope\.current\.invalidate\(\)/);
 assert.match(s,/actionLock\.current/);
 assert.match(s,/if\(!current\(token\)\)throw/);
 assert.match(s,/canUsePayrollPreview/);
 assert.match(s,/payrollRequestKey/);
 assert.match(s,/validatePayrollProfile/);
 assert.match(s,/validPayrollMapping/);
 assert.match(s,/payrollExportCSV/);
 assert.match(s,/Sharing\.shareAsync/);
 assert.match(s,/minHeight:48/);
 assert.match(s,/accessibilityRole="alert"/);
 assert.match(s,/Réessayer/);
 assert.match(parent,/<PayrollExportPanel key=\{\[account\.companyId,account\.userId,account\.role,account\.edition\]\.join\(':'\)\}/);
});
