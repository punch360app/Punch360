import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/auth/serverVerifiedIdentity.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const {requireServerVerifiedIdentity}=await import('data:text/javascript;base64,'+
 Buffer.from(compiled).toString('base64'));
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const session={access_token:'example-jwt-no-network',user:{id:a,email:'cached@example.invalid'}};
const verified={data:{user:{id:a,email:'fresh@example.invalid'}},error:null};

test('accept Auth server identity only for the same nonempty session token',()=>{
 assert.equal(requireServerVerifiedIdentity(session,verified),verified.data.user);
 assert.equal(requireServerVerifiedIdentity(session,verified).email,'fresh@example.invalid');
});
test('reject stale, mismatched, revoked, absent or unauthenticated Auth responses',()=>{
 for(const input of [
  {session:{...session,user:{id:b}},result:verified},
  {session:null,result:verified},
  {session:{...session,access_token:''},result:verified},
  {session:{...session,access_token:null},result:verified},
  {session,result:{data:{user:{id:b}},error:null}},
  {session,result:{data:{user:null},error:null}},
  {session,result:{data:null,error:null}},
  {session,result:{data:{user:{id:a}},error:{message:'revoked'}}},
  {session,result:null}
 ]){
  assert.throws(()=>requireServerVerifiedIdentity(input.session,input.result),
   /AUTH_SERVER_IDENTITY_UNVERIFIED/);
 }
});
test('native workspace loading verifies the exact token before RLS roles and local persistence',()=>{
 const gate=readFileSync(new URL('../src/auth/AuthGate.tsx',import.meta.url),'utf8');
 const refresh=gate.slice(gate.indexOf(' async function refresh(){'),gate.indexOf(' async function selectWorkspace('));
 const serverGet=refresh.indexOf('supabase.auth.getUser(data.session.access_token)');
 const validation=refresh.indexOf('requireServerVerifiedIdentity(data.session,serverIdentity)');
 const membership=refresh.indexOf("supabase.from('company_members')");
 const identityCache=refresh.indexOf('await rememberLocalIdentity(u)');
 const roleDisplayed=refresh.indexOf('setAccount(chosen)');
 assert.ok(serverGet>=0&&validation>serverGet,'Auth identity must be verified');
 assert.ok(membership>validation,'RLS membership lookup comes after identity validation');
 assert.ok(identityCache>membership,'offline identity cache comes after authenticated membership');
 assert.ok(roleDisplayed>identityCache,'role is displayed only after authenticated identity');
 assert.match(refresh,/const serverIdentity=await supabase.auth.getUser\(data.session.access_token\);\s*if\(!current\(\)\)return;/);
 assert.match(refresh,/setSession\(\{\.\.\.data.session,user:u\}\)/);
 assert.match(refresh,/catch\{\s*if\(!current\(\)\)return;\s*setSession\(null\);setAccount\(null\)/);
});
test('native role verification source is valid TypeScript',()=>{
 const gate=readFileSync(new URL('../src/auth/AuthGate.tsx',import.meta.url),'utf8');
 const tsx=ts.createSourceFile('AuthGate.tsx',gate,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(tsx.parseDiagnostics.length,0,tsx.parseDiagnostics.map(d=>String(d.messageText)).join(', '));
});
