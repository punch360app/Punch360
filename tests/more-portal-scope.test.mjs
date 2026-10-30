import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMorePortalScope} from '../src/hr/morePortalScope.js';

test('user or company change invalidates pending private profile and leave reads',()=>{
 const s=createMorePortalScope('A','alice','employee');
 const a=s.enter('A','alice','employee');
 const b=s.enter('B','alice','employee');
 assert.equal(s.allows(a),false);assert.equal(s.allows(b),true);
 const other=s.enter('B','bob','employee');
 assert.equal(s.allows(b),false);assert.equal(s.allows(other),true);
 assert.equal(s.matches('B','alice','employee'),false);
});

test('role switch and unmount invalidate previous writes and reloads',()=>{
 const s=createMorePortalScope('A','alice','boss');
 const original=s.enter('A','alice','boss');
 s.enter('A','alice','employee');
 assert.equal(s.allows(original),false);
 const next=s.current();
 s.invalidate();
 assert.equal(s.allows(next),false);
});

test('A to B to A does not resurrect old results with identical identity',()=>{
 const s=createMorePortalScope('A','alice','employee');
 const old=s.enter('A','alice','employee');
 s.enter('B','alice','employee');
 const current=s.enter('A','alice','employee');
 assert.equal(s.allows(old),false);
 assert.equal(s.allows(current),true);
});

test('delayed network success after account switch does not repaint private data',async()=>{
 const s=createMorePortalScope('A','alice','employee');
 const token=s.enter('A','alice','employee');
 let release;const network=new Promise(resolve=>{release=resolve});
 const rendered=[];
 const pending=network.then(value=>{if(s.allows(token))rendered.push(value)});
 s.enter('B','bob','employee');release({name:'previous user'});
 await pending;
 assert.deepEqual(rendered,[]);
});

test('only latest reload may update current identity',()=>{
 const s=createMorePortalScope('A','alice','employee');
 const token=s.enter('A','alice','employee');
 let sequence=0;const output=[];
 const apply=(id,value)=>{if(s.allows(token)&&id===sequence)output.push(value)};
 const old=++sequence,next=++sequence;
 apply(next,'new data');apply(old,'old data');
 assert.deepEqual(output,['new data']);
});


test('sensitive Expo form gates survive refactors',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/hr/MorePortal.tsx',import.meta.url),'utf8');
 assert.match(source,/if\(!identityMatches\)return <View/);
 assert.match(source,/privateSection&&!privateReadsVerified/);
 assert.match(source,/setPrivateReadsVerified\(false\)/);
 assert.match(source,/setPrivateReadsVerified\(true\)/);
 assert.match(source,/seq!==reloadSequence\.current/);
 for(const section of ['profile','emergency','credentials','leave']){
  assert.ok(source.includes("section==='"+section+"'&&privateReadsVerified"),
   section+' must not show unverified private data');
 }
 for(const operation of ['saveProfile','saveContact','saveCredential','requestLeave']){
  const guard="async function "+operation+"(token:ReturnType<typeof scope.current.current>){\n  if(!current(token)||!privateReadsVerified)return;";
  assert.ok(source.includes(guard),operation+' must reject unverified writes');
 }
 assert.match(source,/Réessayer le chargement du compte/);
 assert.match(source,/minHeight:48/);
});
