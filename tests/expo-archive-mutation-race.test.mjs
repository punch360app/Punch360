import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/punch/api.ts',import.meta.url),'utf8');
const a=source.indexOf('const archiveRevisions=new Map');
const b=source.indexOf('/** The mobile totals',a);
assert.ok(a>=0&&b>a,'Real native archive functions and revision helpers are present');
const js=ts.transpileModule(source.slice(a,b).replace(/^export /gm,''),{
 compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}
}).outputText;
const worker='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const segA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const segB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function deferred(){
 let resolve;
 const promise=new Promise(done=>{resolve=done});
 return {promise,resolve};
}
function fixture({cached=[],remote=[],blockRead=false,blockFirstWrite=false,
 mutationError=null,writeError=false}={}){
 const key='punch-archives:'+worker,storage=new Map([[key,JSON.stringify(cached)]]);
 const server=new Set(remote),readGate=deferred(),readStarted=deferred(),
  writeGate=deferred(),writeStarted=deferred();
 const calls={read:0,write:0,list:0,archive:0,restore:0};
 let gateWrite=blockFirstWrite,online=true;
 const AsyncStorage={
  getItem:async k=>{calls.read++;return storage.get(k)??null;},
  setItem:async(k,value)=>{
   calls.write++;
   if(gateWrite){gateWrite=false;writeStarted.resolve();await writeGate.promise;}
   if(writeError)throw Error('storage full');
   storage.set(k,value);
  }
 };
 const Network={getNetworkStateAsync:async()=>({
  isConnected:online,isInternetReachable:online
 })};
 const getLocalIdentity=async()=>({id:worker});
 const supabase={auth:{getUser:async()=>({data:{user:{id:worker}},error:null})},
  from:name=>{
   assert.equal(name,'punch_archive_preferences');
   let op='select',segment=null;
   const query={
    select:()=>{op='select';return query;},
    eq:(field,value)=>{
     if(op==='select'){assert.equal(field,'user_id');assert.equal(value,worker);}
     else if(field==='segment_id')segment=value;
     return query;
    },
    insert:async row=>{
     calls.archive++;
     assert.equal(row.user_id,worker);
     if(mutationError)return {error:mutationError};
     server.add(row.segment_id);
     return {error:null};
    },
    delete:()=>{op='delete';calls.restore++;return query;},
    then:(resolve,reject)=>{
     if(op==='delete'){
      if(mutationError)return Promise.resolve({error:mutationError}).then(resolve,reject);
      server.delete(segment);
      return Promise.resolve({error:null}).then(resolve,reject);
     }
     calls.list++;const result={data:[...server].map(segment_id=>({segment_id})),error:null};
     readStarted.resolve();
     return (blockRead?readGate.promise:Promise.resolve()).then(()=>result).then(resolve,reject);
    }
   };
   return query;
  }
 };
 const native=new Function('getLocalIdentity','AsyncStorage','Network','supabase',
  js+'\nreturn {loadArchives,archiveSegment,restoreSegment};')(
  getLocalIdentity,AsyncStorage,Network,supabase);
 return {...native,storage,key,calls,server,readStarted,writeStarted,
  releaseRead:()=>readGate.resolve(),releaseWrite:()=>writeGate.resolve(),
  setOnline:value=>{online=value}};
}

test('confirmed archive remains hidden after immediate offline switch',async()=>{
 const f=fixture({cached:[]});
 await f.archiveSegment(segA);
 f.setOnline(false);
 assert.deepEqual(await f.loadArchives(),[segA]);
 assert.deepEqual(JSON.parse(f.storage.get(f.key)),[segA]);
 assert.equal(f.calls.archive,1);
});
test('confirmed restore immediately removes hidden item offline, preserving other IDs',async()=>{
 const f=fixture({cached:[segA,segB],remote:[segA,segB]});
 await f.restoreSegment(segA);
 f.setOnline(false);
 assert.deepEqual(await f.loadArchives(),[segB]);
 assert.deepEqual(JSON.parse(f.storage.get(f.key)),[segB]);
 assert.equal(f.calls.restore,1);
});
test('server rejection never changes the cached archive preference',async()=>{
 const f=fixture({cached:[segB],mutationError:{message:'Access denied'}});
 await assert.rejects(f.archiveSegment(segA),error=>error?.message==='Access denied');
 await assert.rejects(f.restoreSegment(segB),error=>error?.message==='Access denied');
 f.setOnline(false);
 assert.deepEqual(await f.loadArchives(),[segB]);
 assert.equal(f.calls.write,0);
});
test('server duplicate archive acknowledgment is idempotent in cache',async()=>{
 const f=fixture({cached:[segA],mutationError:{code:'23505'}});
 await f.archiveSegment(segA);
 f.setOnline(false);
 assert.deepEqual(await f.loadArchives(),[segA]);
});
test('a server read started before an archive must not overwrite it',async()=>{
 const f=fixture({cached:[],remote:[],blockRead:true});
 const initial=f.loadArchives();
 await f.readStarted.promise;
 await f.archiveSegment(segA);
 f.releaseRead();
 assert.deepEqual(await initial,[segA]);
 assert.deepEqual(JSON.parse(f.storage.get(f.key)),[segA]);
});
test('a server read started before restore must not rearchive the segment',async()=>{
 const f=fixture({cached:[segA],remote:[segA],blockRead:true});
 const initial=f.loadArchives();
 await f.readStarted.promise;
 await f.restoreSegment(segA);
 f.releaseRead();
 assert.deepEqual(await initial,[]);
 assert.deepEqual(JSON.parse(f.storage.get(f.key)),[]);
});
test('a stale server storage write in flight cannot roll back a confirmed archive',async()=>{
 const f=fixture({cached:[],remote:[],blockFirstWrite:true});
 const initial=f.loadArchives();
 await f.writeStarted.promise;
 const change=f.archiveSegment(segA);
 f.releaseWrite();
 await Promise.all([initial,change]);
 f.setOnline(false);
 assert.deepEqual(await f.loadArchives(),[segA]);
 assert.deepEqual(JSON.parse(f.storage.get(f.key)),[segA]);
});
test('local storage failure never masks a server-confirmed archive action',async()=>{
 const f=fixture({cached:[],writeError:true});
 await f.archiveSegment(segA);
 assert.equal(f.calls.archive,1);
 assert.deepEqual(JSON.parse(f.storage.get(f.key)),[]);
});
