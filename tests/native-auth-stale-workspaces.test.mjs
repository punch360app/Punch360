import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const src=readFileSync(new URL('../src/auth/AuthGate.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('AuthGate.tsx',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const section=(start,end)=>{
 const a=src.indexOf(start),b=src.indexOf(end,a);
 assert.ok(a>=0&&b>a,'expected AuthGate section missing');
 return src.slice(a,b);
};

test('native AuthGate still parses and uses an auth revision reference',()=>{
 assert.equal(ast.parseDiagnostics.length,0,ast.parseDiagnostics.map(x=>x.messageText).join('; '));
 assert.match(src,/import React,\{useEffect,useRef,useState\} from 'react'/);
 assert.match(src,/const authRevision=useRef\(0\)/);
});

test('refresh invalidates previous loads and checks before displaying verified workspaces',()=>{
 const body=section(' async function refresh(){',' async function selectWorkspace(');
 assert.match(body,/const revision=\+\+authRevision\.current/);
 assert.match(body,/const current=\(\)=>revision===authRevision\.current/);
 assert.ok((body.match(/if\(!current\(\)\)return/g)||[]).length>=8,
  'every awaited auth/storage boundary must reject stale results');
 assert.match(body,/const \{data,error:sessionError\}=await supabase\.auth\.getSession\(\);\s*if\(!current\(\)\)return;/);
 assert.match(body,/\.limit\(100\);\s*if\(!current\(\)\)return;/);
 assert.match(body,/await AsyncStorage\.getItem\('punch-last-company:'\+u\.id\);\s*if\(!current\(\)\)return;/);
 assert.match(body,/await rememberLocalIdentity\(u\);if\(!current\(\)\)return;/);
 assert.match(body,/finally\{if\(current\(\)\)setBoot\(false\);\}/);
});

test('workspace switching checks the same auth epoch before applying server role',()=>{
 const body=section(' async function selectWorkspace(companyId:string){',' useEffect(()=>{');
 assert.match(body,/const revision=authRevision\.current/);
 assert.match(body,/const current=\(\)=>revision===authRevision\.current/);
 assert.ok((body.match(/if\(!current\(\)\)return/g)||[]).length>=4);
 assert.match(body,/await supabase\.auth\.getUser\(\);\s*if\(!current\(\)\)return;/);
 assert.match(body,/\.limit\(100\);\s*if\(!current\(\)\)return;/);
 assert.match(body,/if\(!current\(\)\)return;\s*setWorkspaces\(verified\);setAccount\(selected\)/);
 assert.match(body,/catch\(e:any\)\{if\(current\(\)\)setError/);
});

test('logout cancels outstanding native loads before clearing the workspace',()=>{
 const body=section(' const {data:sub}=supabase.auth.onAuthStateChange','  let active=true;');
 assert.match(body,/\+\+authRevision\.current;\s*setBusy\(false\)/);
 assert.match(body,/if\(_event==='SIGNED_OUT'\)\{/);
 assert.match(body,/setSession\(null\);setBoot\(false\);setError\(''\);return;/);
 assert.ok(body.indexOf('++authRevision.current')<body.indexOf("if(_event==='SIGNED_OUT')"));
 // Signed-out cleanup must not schedule a fresh offline-cache load.
 assert.ok(body.indexOf('return;',body.indexOf("if(_event==='SIGNED_OUT')"))<
           body.indexOf('setTimeout(()=>refresh(),0)'));
});
