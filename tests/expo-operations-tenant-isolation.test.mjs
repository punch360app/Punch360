import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/workforce/OperationsPanel.tsx',import.meta.url),'utf8');
const loadStart=source.indexOf(' async function load(){');
const loadEnd=source.indexOf(' useEffect(()=>{',loadStart);
const runStart=source.indexOf(' async function run(fn:',loadEnd);
const runEnd=source.indexOf(' const chooseJob=',runStart);
assert.ok(loadStart>=0&&loadEnd>loadStart&&runStart>loadEnd&&runEnd>runStart);
function compile(part){
 return ts.transpileModule(part,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None
 }}).outputText;
}
const loadCode=compile(source.slice(loadStart,loadEnd));
const runCode=compile(source.slice(runStart,runEnd));
const tableNames=['jobs','company_members','scheduled_shifts','job_documents','document_acknowledgements'];
function defer(){let resolve;const promise=new Promise(done=>{resolve=done});return {resolve,promise};}
function fixture(){
 const scopeRef={current:'tenant-A:user-A'},readRevision={current:0},state={
  jobs:[],members:[],shifts:[],docs:[],acks:[],loadedScope:'',error:'',busy:false
 },writes=[];
 const setters=Object.fromEntries(['Jobs','Members','Shifts','Docs','Acks','LoadedScope','Error','Busy']
  .map(name=>['set'+name,value=>{const field=name[0].toLowerCase()+name.slice(1);
   state[field]=value;writes.push([field,value]);}]));
 const pending=new Map();
 const supabase={from:table=>{
  assert.ok(tableNames.includes(table));
  const request=pending.get(table);assert.ok(request,'Missing response gate '+table);
  const query={select:()=>query,eq:()=>query,is:()=>query,order:()=>query,
   then:(accept,reject)=>request.promise.then(accept,reject)};
  return query;
 }};
 function create(account,mode='schedule'){
  const scope=account.companyId+':'+account.userId;
  return new Function('scope','scopeRef','readRevision','account','supabase','mode',
   ...Object.keys(setters),loadCode+'\nreturn load;')(
   scope,scopeRef,readRevision,account,supabase,mode,...Object.values(setters));
 }
 function gates(value='A',data=undefined,problem=null){
  const map=new Map();
  for(const table of tableNames){
   const pendingRead=defer();
   map.set(table,pendingRead);
   pending.set(table,pendingRead);
  }
  const release=()=>{for(const [table,gate] of map){
   gate.resolve({data:data&&Object.prototype.hasOwnProperty.call(data,table)?data[table]:[{id:table+'-'+value}],error:problem?.[table]||null});
  }};
  return {release};
 }
 return {state,writes,scopeRef,readRevision,create,gates,pending,setters};
}

test('slow tenant A query cannot display jobs, workers, shifts or documents after switching to tenant B',async()=>{
 const f=fixture(),old=f.gates('A');
 const loadingA=f.create({companyId:'tenant-A',userId:'user-A'})();
 f.scopeRef.current='tenant-B:user-B';
 const current=f.gates('B');
 const loadingB=f.create({companyId:'tenant-B',userId:'user-B'})();
 current.release();await loadingB;
 old.release();await loadingA;
 assert.equal(f.state.loadedScope,'tenant-B:user-B');
 for(const [field,table] of [['jobs','jobs'],['members','company_members'],
  ['shifts','scheduled_shifts']]){
  assert.deepEqual(f.state[field],[{id:table+'-B'}],field);
  assert.equal(f.writes.some(([key,value])=>key===field&&
   value?.[0]?.id===table+'-A'),false,'Stale private response must never be rendered');
 }
});

test('same company, different signed-in worker invalidates old responses',async()=>{
 const f=fixture(),first=f.gates('A');
 const pending=f.create({companyId:'tenant-A',userId:'user-A'})();
 f.scopeRef.current='tenant-A:user-B';
 first.release();await pending;
 assert.equal(f.state.loadedScope,'');
 assert.deepEqual(f.state.jobs,[]);
 assert.deepEqual(f.state.acks,[]);
});

test('older same-worker request cannot override a newer refresh',async()=>{
 const f=fixture(),old=f.gates('old');
 const first=f.create({companyId:'tenant-A',userId:'user-A'})();
 const newer=f.gates('new');
 const second=f.create({companyId:'tenant-A',userId:'user-A'})();
 newer.release();await second;
 old.release();await first;
 assert.deepEqual(f.state.jobs,[{id:'jobs-new'}]);
 assert.equal(f.state.loadedScope,'tenant-A:user-A');
});

test('a partial server success never renders an empty private operations page',async()=>{
 const f=fixture(),step=f.gates('A',{jobs:[],company_members:null});
 const promise=f.create({companyId:'tenant-A',userId:'user-A'})();
 step.release();await assert.rejects(promise,/Relevé des opérations incomplet/);
 assert.deepEqual(f.state.jobs,[]);
 assert.equal(f.state.loadedScope,'');
});

test('a membership query error does not mix fresh jobs with stale memberships',async()=>{
 const f=fixture(),step=f.gates('A',null,{company_members:new Error('Membership unavailable')});
 const promise=f.create({companyId:'tenant-A',userId:'user-A'})();
 step.release();await assert.rejects(promise,/Membership unavailable/);
 assert.equal(f.writes.length,0);
});

test('actions completing after a company switch cannot update new company status',async()=>{
 const scopeRef={current:'tenant-A:user-A'},scope='tenant-A:user-A',gate=defer();
 let busy=false,loadedScope=scope,loadCalls=0;
 const effects=[];
 const run=new Function('busy','loadedScope','scope','scopeRef','setBusy','setError','load',
  runCode+'\nreturn run;')(
  busy,loadedScope,scope,scopeRef,
  v=>effects.push(['busy',v]),v=>effects.push(['error',v]),
  async()=>{loadCalls++});
 const work=run(async()=>{await gate.promise});
 scopeRef.current='tenant-B:user-B';
 gate.resolve();await work;
 assert.equal(loadCalls,0);
 assert.deepEqual(effects,[['busy',true],['error','']]);
});

test('panel hides stale private rows until exact user and company finish loading',()=>{
 assert.match(source,/if\(loadedScope!==scope\)return <View/);
 assert.ok(source.indexOf('if(loadedScope!==scope)return <View')<
  source.indexOf('return <ScrollView keyboardShouldPersistTaps'));
 assert.match(source,/setLoadedScope\(''\);setJobs\(\[\]\);setMembers\(\[\]\);setShifts\(\[\]\)/);
 assert.match(source,/setDocs\(\[\]\);setAcks\(\[\]\);setJob\(account\.defaultJobId\|\|''\)/);
 assert.match(source,/\},\[scope,mode\]\);/);
 const ast=ts.createSourceFile('OperationsPanel.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0);
});

test('invite mode needs no private company operations tables to load',async()=>{
 const f=fixture();
 // No gates means a Supabase query would fail immediately.
 await f.create({companyId:'tenant-A',userId:'user-A'},'invite')();
 assert.equal(f.state.loadedScope,'tenant-A:user-A');
 assert.deepEqual(f.state.jobs,[]);
 assert.deepEqual(f.state.members,[]);
 assert.deepEqual(f.state.docs,[]);
 assert.deepEqual(f.state.acks,[]);
});

test('document mode reads documents and acknowledgements but not employee schedules',async()=>{
 const f=fixture(),request=f.gates('docs');
 const promise=f.create({companyId:'tenant-A',userId:'user-A'},'documents')();
 request.release();await promise;
 assert.deepEqual(f.state.jobs,[{id:'jobs-docs'}]);
 assert.deepEqual(f.state.docs,[{id:'job_documents-docs'}]);
 assert.deepEqual(f.state.acks,[{id:'document_acknowledgements-docs'}]);
 assert.deepEqual(f.state.members,[]);
 assert.deepEqual(f.state.shifts,[]);
});

test('schedule mode ignores document-read failures unrelated to work planning',async()=>{
 const f=fixture(),request=f.gates('sched',null,{
  job_documents:new Error('Document service unavailable'),
  document_acknowledgements:new Error('Document permissions unavailable')
 });
 const promise=f.create({companyId:'tenant-A',userId:'user-A'},'schedule')();
 request.release();await promise;
 assert.equal(f.state.loadedScope,'tenant-A:user-A');
 assert.deepEqual(f.state.shifts,[{id:'scheduled_shifts-sched'}]);
 assert.deepEqual(f.state.docs,[]);
});

test('document mode ignores schedule-table failures unrelated to reading PDFs',async()=>{
 const f=fixture(),request=f.gates('pdf',null,{
  company_members:new Error('Members unavailable'),
  scheduled_shifts:new Error('Schedules unavailable')
 });
 const promise=f.create({companyId:'tenant-A',userId:'user-A'},'documents')();
 request.release();await promise;
 assert.equal(f.state.loadedScope,'tenant-A:user-A');
 assert.deepEqual(f.state.docs,[{id:'job_documents-pdf'}]);
 assert.deepEqual(f.state.shifts,[]);
});

test('a loading error offers a scoped retry without showing old company data',()=>{
 const start=source.indexOf(' if(loadedScope!==scope)return <View');
 const end=source.indexOf(' return <ScrollView keyboardShouldPersistTaps',start);
 assert.ok(start>=0&&end>start);
 const loading=source.slice(start,end);
 assert.match(loading,/Réessayer le chargement/);
 assert.match(loading,/const requestedScope=scope/);
 assert.match(loading,/if\(scopeRef\.current===requestedScope\)setError/);
 assert.match(loading,/void load\(\)\.catch/);
 assert.doesNotMatch(loading,/setLoadedScope\(scope\)/);
});
