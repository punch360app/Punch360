import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Run the real TypeScript callback module in Node without a mobile runtime.
const source=readFileSync(new URL('../src/auth/nativeOAuthCallback.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const {processNativeOAuthCallback}=await import('data:text/javascript;base64,'+
 Buffer.from(compiled).toString('base64'));
const makeUrl=(code,extra='')=>'punchapp://auth/callback?code='+encodeURIComponent(code)+extra;
const good=async()=>({data:{session:{user:{id:'test'}}},error:null});

test('cold-start OAuth redirect exchanges only the expected PUNCH deep link',async()=>{
 const seen=new Set();
 assert.equal(await processNativeOAuthCallback(makeUrl('pkce123'),seen,good),'authenticated');
 assert.deepEqual([...seen],['pkce123']);
 for(const alien of [
  'https://example.org/auth/callback?code=secret',
  'punchapp://evil.example/auth/callback?code=secret',
  'punchapp://auth/notcallback?code=secret',
  'punchapp://auth/callback-evil?code=secret',
  'punchapp://auth/callback/extra?code=secret',
  'https://example.org/?redirect=punchapp://auth/callback?code=secret',
  'broken://',
  'punchapp://auth@evil.example/callback?code=secret'
 ]){
  assert.equal(await processNativeOAuthCallback(alien,seen,good),'ignored',alien);
 }
 assert.equal(seen.size,1,'untrusted URLs must not consume a code');
});

test('foreground event plus initialURL may share the same PKCE code; exchange exactly once',async()=>{
 const seen=new Set();let calls=0;
 let finish;const exchange=async()=>{calls++;return await new Promise(resolve=>{finish=resolve;});};
 const url=makeUrl('single-use-code');
 const first=processNativeOAuthCallback(url,seen,exchange);
 assert.equal(await processNativeOAuthCallback(url,seen,exchange),'duplicate');
 assert.equal(calls,1,'claim must happen synchronously before await');
 finish({data:{session:{user:{id:'test'}}},error:null});
 assert.equal(await first,'authenticated');
 assert.equal(await processNativeOAuthCallback(url,seen,exchange),'duplicate');
 assert.equal(calls,1);
});

test('recovery callback has a separate state, invalid callbacks do not call exchange',async()=>{
 let calls=0;const exchange=async()=>{calls++;return good();};
 assert.equal(await processNativeOAuthCallback(makeUrl('reset1','&type=recovery'),new Set(),exchange),'recovery');
 const seen=new Set();
 assert.equal(await processNativeOAuthCallback('punchapp://auth/callback',seen,exchange),'invalid');
 assert.equal(await processNativeOAuthCallback('punchapp://auth/callback?code=',seen,exchange),'invalid');
 assert.equal(await processNativeOAuthCallback(makeUrl('x'.repeat(2049)),seen,exchange),'invalid');
 assert.equal(await processNativeOAuthCallback(null,seen,exchange),'ignored');
 assert.equal(calls,1);
});

test('expired or rejected PKCE exchange is never accepted and must restart login',async()=>{
 const seen=new Set();const url=makeUrl('expired-code');
 assert.equal(await processNativeOAuthCallback(url,seen,async()=>({data:null,error:{message:'expired'}})),'failed');
 assert.equal(await processNativeOAuthCallback(url,seen,good),'duplicate');
 assert.equal(await processNativeOAuthCallback(makeUrl('network'),seen,async()=>{throw Error('network');}),'failed');
 assert.equal(await processNativeOAuthCallback(makeUrl('no-session'),seen,async()=>({data:{session:null},error:null})),'failed');
});

test('AuthGate registers listener AND obtains cold-start URL, with cleanup',()=>{
 const gate=readFileSync(new URL('../src/auth/AuthGate.tsx',import.meta.url),'utf8');
 assert.match(gate,/Linking\.addEventListener\('url'/);
 assert.match(gate,/Linking\.getInitialURL\(\)/);
 assert.match(gate,/processNativeOAuthCallback\(/);
 assert.match(gate,/active=false;sub\.subscription\.unsubscribe\(\);listener\.remove\(\)/);
 assert.doesNotMatch(gate,/url\.includes\('\/auth\/callback'\)/);
});
