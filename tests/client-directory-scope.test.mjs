import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientDirectoryScope,directorySearch,safeDirectoryPage,canEditDirectoryRow,canCreateSiteForClient} from '../src/workforce/clientDirectoryScope.js';
const c1={id:'a',company_id:'A',name:'Client',version:2,active:true};
const c2={...c1,id:'b'};
test('company A B A and unmount invalidate old private directory snapshots',()=>{
 const scope=createClientDirectoryScope('A'),one=scope.enter('A');
 const two=scope.enter('B');assert.equal(scope.allows(one),false);
 scope.enter('A');assert.equal(scope.allows(two),false);assert.equal(scope.allows(one),false);
 const now=scope.current();scope.invalidate();assert.equal(scope.allows(now),false);
});
test('late server page cannot update a different company',async()=>{
 const scope=createClientDirectoryScope('A'),old=scope.enter('A');let resolve;
 const pending=new Promise(r=>resolve=r);let updates=0;
 const done=pending.then(()=>{if(scope.allows(old))updates++});
 scope.enter('B');resolve([c1]);await done;assert.equal(updates,0);
});
test('pagination rejects cross-tenant rows, cursors, duplicates, malformed shape',()=>{
 const payload={items:[c1,c2],has_more:true};
 assert.deepEqual(safeDirectoryPage(payload,'A',[],false,50),[c1,c2]);
 assert.deepEqual(safeDirectoryPage({items:[{...c1,id:'c'}],has_more:false},'A',[c1,c2],true),[c1,c2,{...c1,id:'c'}]);
 assert.throws(()=>safeDirectoryPage({items:[{...c1,company_id:'B'}],has_more:false},'A'),/invalide/);
 assert.throws(()=>safeDirectoryPage({items:[c1,c1],has_more:false},'A'),/Doublons/);
 assert.throws(()=>safeDirectoryPage({items:[c2,c1],has_more:false},'A'),/désordonnée/);
 assert.throws(()=>safeDirectoryPage({items:[c1],has_more:false},'A',[c1],true),/Curseur/);
 assert.throws(()=>safeDirectoryPage({items:[],has_more:true},'A'),/incomplète/);
 assert.throws(()=>safeDirectoryPage({items:[c1]},'A'),/invalide/);
});
test('existing row must remain in the visible company page with expected version',()=>{
 assert.equal(canEditDirectoryRow(c1,'A',[c1]),true);
 assert.equal(canEditDirectoryRow(c1,'B',[c1]),false);
 assert.equal(canEditDirectoryRow({...c1,version:1},'A',[c1]),false);
 assert.equal(canEditDirectoryRow(c1,'A',[]),false);
 assert.equal(canCreateSiteForClient('a',[c1]),true);
 assert.equal(canCreateSiteForClient('a',[{...c1,active:false}]),false);
});
test('search must respect server 100-character limit',()=>{
 assert.equal(directorySearch('  usine  '),'usine');
 assert.throws(()=>directorySearch('a'.repeat(101)),/100/);
});
test('Expo component gates data, pagination, confirmations and retry',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/workforce/ClientDirectoryPanel.tsx',import.meta.url),'utf8');
 assert.match(source,/if\(!identityMatches\)return <View/);
 assert.match(source,/scope\.current\.enter\(companyId\)/);
 assert.match(source,/scope\.current\.invalidate\(\)/);
 assert.match(source,/actionLock\.current/);
 assert.match(source,/safeDirectoryPage\(/);
 assert.match(source,/canEditDirectoryRow\(/);
 assert.match(source,/clientSaveArgs\(/);
 assert.match(source,/siteSaveArgs\(/);
 assert.match(source,/if\(!current\(token\)\)throw/);
 assert.match(source,/accessibilityRole="alert"/);
 assert.match(source,/minHeight:48/);
 assert.match(source,/Réessayer/);
});

test('parent remounts private directory when a different person signs into the same company',async()=>{
 const {readFileSync}=await import('node:fs');
 const parent=readFileSync(new URL('../src/workforce/EssentialPlanningPanel.tsx',import.meta.url),'utf8');
 assert.match(parent,/<ClientDirectoryPanel key=\{\[account\.companyId,account\.userId,account\.role,account\.edition\]\.join\(':'\)\}/);
 assert.match(parent,/<ClientDirectoryPanel[^>]*companyId=\{account\.companyId\}/);
});
