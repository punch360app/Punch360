import test from 'node:test';
import assert from 'node:assert/strict';
import {createQualifiedCoverageScope,qualifiedCoverageIdentity,mayLoadQualifiedCoverage,qualifiedResourceRows,qualifiedDateLabel,canInvokeQualifiedAction} from '../src/workforce/qualifiedCoverageScope.js';
const a={companyId:'A',userId:'alice',role:'admin',edition:'essential'};
test('tenant, user, role, edition and A B A invalidate stale snapshots',()=>{
 const s=createQualifiedCoverageScope(a),one=s.enter(a);
 const b=s.enter({...a,companyId:'B'});assert.equal(s.allows(one),false);
 const user=s.enter({...a,userId:'bob'});assert.equal(s.allows(b),false);
 const role=s.enter({...a,role:'employee'});assert.equal(s.allows(user),false);
 s.enter({...a,edition:'construction'});assert.equal(s.allows(role),false);
 s.enter(a);assert.equal(s.allows(one),false);
 const t=s.current();s.invalidate();assert.equal(s.allows(t),false);
 assert.notEqual(qualifiedCoverageIdentity(a),qualifiedCoverageIdentity({...a,userId:'bob'}));
});
test('late candidates from previous account cannot update the current UI',async()=>{
 const s=createQualifiedCoverageScope(a),token=s.enter(a);
 let release;const pending=new Promise(r=>release=r);let writes=0;
 const task=pending.then(()=>{if(s.allows(token))writes++});
 s.enter({...a,userId:'bob'});release({candidates:[{name:'private'}]});await task;assert.equal(writes,0);
});
test('restricted departments and locations must be complete and from one company',()=>{
 const item={id:'d',company_id:'A',name:'Accueil',active:true};
 assert.deepEqual(qualifiedResourceRows([item],'A'),[item]);
 assert.throws(()=>qualifiedResourceRows([{...item,company_id:'B'}],'A'),/indisponible/);
 assert.throws(()=>qualifiedResourceRows([item,item],'A'),/Doublons/);
 assert.throws(()=>qualifiedResourceRows(Array.from({length:251},(_,i)=>({...item,id:String(i)})),'A'),/indisponible/);
 assert.throws(()=>qualifiedResourceRows(null,'A'),/indisponible/);
});
test('editing is restricted to Essential managers with certificate access',()=>{
 assert.equal(mayLoadQualifiedCoverage(a),true);
 assert.equal(mayLoadQualifiedCoverage({...a,role:'lead'}),false);
 assert.equal(mayLoadQualifiedCoverage({...a,edition:'construction'}),false);
 assert.equal(canInvokeQualifiedAction(a,true,false,false,'report',false),true);
 assert.equal(canInvokeQualifiedAction(a,true,false,false,'save',false),false);
 assert.equal(canInvokeQualifiedAction(a,true,false,false,'save',true),true);
 assert.equal(canInvokeQualifiedAction(a,true,true,false,'report',true),false);
 assert.equal(canInvokeQualifiedAction({...a,role:'employee'},true,false,false,'save',true),false);
});
test('invalid date or timezone never crashes the page',()=>{
 assert.equal(qualifiedDateLabel('bad','America/Toronto'),'Date à vérifier');
 assert.equal(qualifiedDateLabel('2026-10-29T12:00:00Z','Not/AZone'),'Date à vérifier');
 assert.match(qualifiedDateLabel('2026-10-29T12:00:00Z','America/Toronto'),/2026/);
});
test('Expo panel and parent enforce scoped reload, access and device targets',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../src/workforce/QualifiedCoveragePanel.tsx',import.meta.url),'utf8');
 const parent=readFileSync(new URL('../src/workforce/ManagementWorkspace.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!identityMatches\)return <View/);
 assert.match(src,/scope\.current\.enter\(account\)/);
 assert.match(src,/scope\.current\.invalidate\(\)/);
 assert.match(src,/actionLock\.current/);
 assert.match(src,/qualifiedResourceRows\(/);
 assert.match(src,/mayLoadQualifiedCoverage\(account\)/);
 assert.match(src,/canInvokeQualifiedAction\(/);
 assert.match(src,/\.limit\(251\)/);
 assert.match(src,/accessibilityRole="alert"/);
 assert.match(src,/minHeight:48/);
 assert.match(src,/Réessayer/);
 assert.match(parent,/<QualifiedCoveragePanel key=\{\[account\.companyId,account\.userId,account\.role,account\.edition\]\.join\(':'\)\}/);
});
