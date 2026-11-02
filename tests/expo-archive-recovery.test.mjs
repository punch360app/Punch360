import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/punch/api.ts',import.meta.url),'utf8');
const a=source.indexOf('export async function loadArchives()');
const b=source.indexOf('/** The mobile totals',a);
assert.ok(a>=0&&b>a,'Expected real Expo archive-loading function');
const js=ts.transpileModule(source.slice(a,b).replace('export ',''),
 {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const segA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const segB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture({network='offline',cache=[segA],response=[{segment_id:segA}],
 error=null,throws=false,writeFail=false,readFail=false}={}){
 const key='punch-archives:employee-A',memory=new Map();
 if(cache!==null)memory.set(key,typeof cache==='string'?cache:JSON.stringify(cache));
 const calls={network:0,read:0,write:0,server:0,filter:0};
 const AsyncStorage={
  getItem:async k=>{calls.read++;if(readFail)throw Error('storage read failed');return memory.get(k)??null},
  setItem:async(k,v)=>{calls.write++;if(writeFail)throw Error('storage full');memory.set(k,v)}
 };
 const Network={getNetworkStateAsync:async()=>{
  calls.network++;
  if(network==='throws')throw Error('native probe unavailable');
  if(network==='unknown')return {isConnected:true,isInternetReachable:null};
  return {isConnected:network==='online',isInternetReachable:network==='online'};
 }};
 const getLocalIdentity=async()=>({id:'employee-A'});
 const supabase={from:table=>{
  calls.server++;assert.equal(table,'punch_archive_preferences');
  if(throws)throw Error('transport failed before request');
  const query={select:()=>query,eq:(field,id)=>{
   calls.filter++;assert.equal(field,'user_id');assert.equal(id,'employee-A');return query;},
   then:(done,fail)=>Promise.resolve({data:response,error}).then(done,fail)};
  return query;
 }};
 const loadArchives=new Function('getLocalIdentity','AsyncStorage','Network',
  'supabase',js+'\nreturn loadArchives;')(
  getLocalIdentity,AsyncStorage,Network,supabase);
 return {run:loadArchives,memory,key,calls};
}

test('offline and unknown network never contact archive API or overwrite preferences',async()=>{
 for(const network of ['offline','unknown','throws']){
  const f=fixture({network,cache:[segA,segB,segA]});
  const bytes=f.memory.get(f.key);
  assert.deepEqual(await f.run(),[segA,segB]);
  assert.equal(f.calls.server,0,network);
  assert.equal(f.calls.write,0,network);
  assert.equal(f.memory.get(f.key),bytes,network);
 }
});

test('invalid or damaged archive cache never hides real hours or discards evidence',async()=>{
 for(const cache of ['{bad-json','{}',JSON.stringify([segA,'malicious']),
  JSON.stringify([{id:segA}]),'null']){
  const f=fixture({cache});
  assert.deepEqual(await f.run(),[]);
  assert.equal(f.memory.get(f.key),cache);
  assert.equal(f.calls.write,0);
 }
});

test('unreadable or absent offline archive cache returns visible hours',async()=>{
 for(const c of [{cache:null},{readFail:true}]){
  const f=fixture(c);
  assert.deepEqual(await f.run(),[]);
  assert.equal(f.calls.server,0);
 }
});

test('online server preferences replace valid cache and deduplicate IDs',async()=>{
 const f=fixture({network:'online',response:[
  {segment_id:segB},{segment_id:segA},{segment_id:segB}]});
  assert.deepEqual(await f.run(),[segB,segA]);
  assert.equal(f.calls.server,1);
  assert.equal(f.calls.filter,1);
  assert.equal(f.calls.write,1);
  assert.deepEqual(JSON.parse(f.memory.get(f.key)),[segB,segA]);
});

test('server API errors and transport throws fall back to scoped archived IDs',async()=>{
 for(const c of [{error:{message:'network'}},{throws:true}]){
  const f=fixture({network:'online',...c});
  assert.deepEqual(await f.run(),[segA]);
  assert.equal(f.calls.server,1);
  assert.equal(f.calls.write,0);
 }
});

test('partial or malformed successful responses keep the last valid archive cache',async()=>{
 for(const response of [null,{},[{segment_id:'bad'}],[{segment_id:segA},null],
  [{segment_id:segB},{segment_id:null}]]){
  const f=fixture({network:'online',response});
  const bytes=f.memory.get(f.key);
  assert.deepEqual(await f.run(),[segA]);
  assert.equal(f.memory.get(f.key),bytes);
  assert.equal(f.calls.write,0);
 }
});

test('storage write failure does not discard a fresh valid server response',async()=>{
 const f=fixture({network:'online',response:[{segment_id:segB}],writeFail:true});
 assert.deepEqual(await f.run(),[segB]);
 assert.equal(f.calls.write,1);
 assert.deepEqual(JSON.parse(f.memory.get(f.key)),[segA],
  'Keep original bytes intact if device storage refuses update');
});

test('server-confirmed zero archived segments removes stale cached hiding',async()=>{
 const f=fixture({network:'online',response:[]});
 assert.deepEqual(await f.run(),[]);
 assert.deepEqual(JSON.parse(f.memory.get(f.key)),[]);
});
