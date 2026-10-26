import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const helper=readFileSync(new URL('../src/auth/offlineWorkspaceGuard.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {mayRestoreCachedWorkspace,canResumeAfterExplicitSignOut}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const gate=readFileSync(new URL('../src/auth/AuthGate.tsx',import.meta.url),'utf8');
const between=(a,b)=>{
 const start=gate.indexOf(a),end=gate.indexOf(b,start);
 assert.ok(start>=0&&end>start,'section AuthGate missing: '+a);
 return gate.slice(start,end);
};

test('offline recovery requires the same auth generation AND no explicit sign-out',()=>{
 assert.equal(mayRestoreCachedWorkspace(8,8,false),true);
 for(const [request,current,loggedOut] of [[8,8,true],[7,8,false],[8,9,true],[9,8,false]]){
  assert.equal(mayRestoreCachedWorkspace(request,current,loggedOut),false);
 }
});

test('SIGNED_OUT blocks delayed reads synchronously before async cache cleanup',()=>{
 const body=between(' const {data:sub}=supabase.auth.onAuthStateChange','  let active=true;');
 const signout=body.indexOf("if(_event==='SIGNED_OUT'){");
 const guard=body.indexOf('explicitlySignedOut.current=true',signout);
 const cleanup=body.indexOf('void forgetLocalIdentity()',signout);
 const cleared=body.indexOf('setAccount(null)',signout);
 assert.ok(signout>=0&&guard>signout&&cleanup>guard&&cleared>guard);
 assert.match(body,/if\(explicitlySignedOut\.current\)\{[\s\S]*?canResumeAfterExplicitSignOut\(_event,Boolean\(newSession\)\)/);
 assert.match(body,/explicitlySignedOut\.current=false;\s*\}\s*if\(_event==='PASSWORD_RECOVERY'\)/);
 assert.ok(body.indexOf('return;',signout)<body.indexOf('setTimeout(()=>refresh(),0)'),
  'a SIGNED_OUT callback must not schedule a fresh offline refresh');
});

test('offline fallback checks sign-out before AND after each awaited cache read',()=>{
 const body=between(' async function refresh(){',' async function selectWorkspace(');
 const offline=body.slice(body.indexOf('if(network.isConnected===false'),body.indexOf('   const {data,error:sessionError}'));
 const before=offline.indexOf('if(!offlineAllowed()){');
 const identity=offline.indexOf('await cachedLocalIdentity()');
 const workspace=offline.indexOf('await cachedWorkspace(local.id)');
 assert.ok(before>=0&&identity>before&&workspace>identity);
 assert.match(offline,/const local=await cachedLocalIdentity\(\);if\(!offlineAllowed\(\)\)return;/);
 assert.match(offline,/const cache=local\?await cachedWorkspace\(local.id\):null;if\(!offlineAllowed\(\)\)return;/);
 assert.match(body,/mayRestoreCachedWorkspace\(revision,authRevision\.current,explicitlySignedOut\.current\)/);
});

test('workspace changes re-check current session user against verified Auth user',()=>{
 const body=between(' async function selectWorkspace(companyId:string){',' useEffect(()=>{');
 assert.match(body,/await supabase\.auth\.getUser\(\)/);
 assert.match(body,/data\.user\.id!==session\?\.user\.id/);
 assert.ok(body.indexOf('data.user.id!==session?.user.id')<body.indexOf("supabase.from('company_members')"));
});

test('native implementation still parses after the hardening',()=>{
 for(const [name,source,kind] of [['AuthGate.tsx',gate,ts.ScriptKind.TSX],['offlineWorkspaceGuard.ts',helper,ts.ScriptKind.TS]]){
  const parsed=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,kind);
  assert.equal(parsed.parseDiagnostics.length,0,name+' must parse as TypeScript');
 }
});


test('only a fresh sign-in or recovery session may unlock an explicit logout',()=>{
 for(const event of ['INITIAL_SESSION','TOKEN_REFRESHED','USER_UPDATED','SIGNED_OUT','MFA_CHALLENGE_VERIFIED']){
  assert.equal(canResumeAfterExplicitSignOut(event,true),false,event);
 }
 assert.equal(canResumeAfterExplicitSignOut('SIGNED_IN',false),false);
 assert.equal(canResumeAfterExplicitSignOut('PASSWORD_RECOVERY',false),false);
 assert.equal(canResumeAfterExplicitSignOut('SIGNED_IN',true),true);
 assert.equal(canResumeAfterExplicitSignOut('PASSWORD_RECOVERY',true),true);
});

test('native refresh invalidates delayed ONLINE responses too',()=>{
 const body=between(' async function refresh(){',' async function selectWorkspace(companyId:string){');
 assert.match(body,/const current=\(\)=>revision===authRevision\.current&&!explicitlySignedOut\.current;/);
 assert.match(body,/const serverIdentity=await supabase\.auth\.getUser/);
 assert.match(body,/if\(!current\(\)\)return;\s*const u=requireServerVerifiedIdentity/);
 assert.match(body,/if\(!current\(\)\)return;\s*if\(e\)/);
 const auth=between(' const {data:sub}=supabase.auth.onAuthStateChange','  let active=true;');
 assert.match(auth,/if\(explicitlySignedOut\.current\)/);
 assert.match(auth,/canResumeAfterExplicitSignOut\(_event,Boolean\(newSession\)\)/);
 assert.ok(auth.indexOf('canResumeAfterExplicitSignOut(')<auth.indexOf('explicitlySignedOut.current=false'));
});
