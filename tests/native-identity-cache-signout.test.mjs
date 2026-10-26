import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/auth/nativeIdentityCache.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const {createNativeIdentityCache}=await import('data:text/javascript;base64,'+
 Buffer.from(compiled).toString('base64'));

const personA={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'one@company.invalid'};
const personB={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'two@company.invalid'};
function memoryStorage(){
 const values=new Map();
 const storage={
  getItem:async key=>values.get(key)??null,
  setItem:async(key,value)=>{values.set(key,value);},
  removeItem:async key=>{values.delete(key);}
 };
 return {values,storage};
}
function deferred(){
 let resolve;
 const promise=new Promise(done=>{resolve=done;});
 return {promise,resolve};
}

test('normal verified identity survives restart; corrupt or wrong-id cache fails closed',async()=>{
 const {values,storage}=memoryStorage();
 const cache=createNativeIdentityCache(storage,'punch-last-identity');
 await cache.remember(personA);
 assert.deepEqual(await cache.read(),personA);
 assert.deepEqual(await createNativeIdentityCache(storage,'punch-last-identity').read(),personA);
 values.set('punch-last-identity','bad-json');
 assert.equal(await cache.read(),null);
 values.set('punch-last-identity',JSON.stringify(personB));
 assert.equal(await cache.read(),null,'old user cannot reappear during new-user login');
});

test('logout immediately blocks cached identity even while deletion is pending',async()=>{
 const {values,storage}=memoryStorage();
 const cache=createNativeIdentityCache(storage,'punch-last-identity');
 await cache.remember(personA);
 const deletion=deferred();
 storage.removeItem=async key=>{await deletion.promise;values.delete(key);};
 const clearing=cache.forget();
 assert.equal(await cache.read(),null,'signed-out identity hidden before storage deletion');
 assert.ok(values.has('punch-last-identity'),'deletion is intentionally still in flight');
 deletion.resolve();
 await clearing;
 assert.equal(values.has('punch-last-identity'),false);
 assert.equal(await cache.read(),null);
});

test('in-flight previous write is deleted AFTER logout, without touching punch journals',async()=>{
 const {values,storage}=memoryStorage();
 const firstWrite=deferred(),started=deferred();
 storage.setItem=async(key,value)=>{started.resolve();await firstWrite.promise;values.set(key,value);};
 values.set('punch-journal:other','pending punch');
 const cache=createNativeIdentityCache(storage,'punch-last-identity');
 const saving=cache.remember(personA);
 await started.promise;
 const clearing=cache.forget();
 assert.equal(await cache.read(),null);
 firstWrite.resolve();
 await Promise.all([saving,clearing]);
 assert.equal(values.has('punch-last-identity'),false,'late write cannot resurrect signed-out user');
 assert.equal(values.get('punch-journal:other'),'pending punch');
});

test('a stale queued write is skipped; the next verified account wins',async()=>{
 const {values,storage}=memoryStorage();
 const gate=deferred(),started=deferred();
 storage.setItem=async(key,value)=>{
  if(!started.done){started.done=true;started.resolve();await gate.promise;}
  values.set(key,value);
 };
 const cache=createNativeIdentityCache(storage,'punch-last-identity');
 const one=cache.remember(personA);
 await started.promise;
 const two=cache.remember(personB);
 gate.resolve();
 await Promise.all([one,two]);
 assert.deepEqual(await cache.read(),personB);
 assert.equal(JSON.parse(values.get('punch-last-identity')).id,personB.id);
});

test('pending reads cannot return old identity once signout invalidates them',async()=>{
 const {values,storage}=memoryStorage();
 const cache=createNativeIdentityCache(storage,'punch-last-identity');
 await cache.remember(personA);
 const gate=deferred(),started=deferred();
 storage.getItem=async key=>{started.resolve();await gate.promise;return values.get(key)??null;};
 const read=cache.read();
 await started.promise;
 const clearing=cache.forget();
 gate.resolve();
 assert.equal(await read,null);
 await clearing;
});

test('invalid IDs and malformed storage never create an offline identity',async()=>{
 const {values,storage}=memoryStorage();
 const cache=createNativeIdentityCache(storage,'punch-last-identity');
 await assert.rejects(cache.remember({id:'invalid'}),/INVALID_LOCAL_IDENTITY/);
 values.set('punch-last-identity',JSON.stringify({id:personA.id+'\n'}));
 assert.equal(await cache.read(),null);
 storage.getItem=async()=>{throw Error('storage failure');};
 assert.equal(await cache.read(),null);
});

test('native AuthGate calls logout invalidation and localIdentity uses the serialized store',()=>{
 const gate=readFileSync(new URL('../src/auth/AuthGate.tsx',import.meta.url),'utf8');
 const identity=readFileSync(new URL('../src/auth/localIdentity.ts',import.meta.url),'utf8');
 assert.match(gate,/if\(_event==='SIGNED_OUT'\)\{\s*void forgetLocalIdentity\(\)\.catch\(\(\)=>\{\}\)/);
 assert.match(identity,/const cache=createNativeIdentityCache\(AsyncStorage,KEY\)/);
 assert.match(identity,/return cache\.remember\(user\)/);
 assert.match(identity,/return cache\.forget\(\)/);
 assert.match(identity,/return cache\.read\(\)/);
});
