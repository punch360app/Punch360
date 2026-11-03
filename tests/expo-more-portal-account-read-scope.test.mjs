import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/hr/MorePortal.tsx',import.meta.url),'utf8');
const start=source.indexOf(' async function reload(){');
const end=source.indexOf(' useEffect(()=>{',start);
assert.ok(start>0&&end>start);
const compiled=ts.transpileModule(source.slice(start,end),{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None
}}).outputText;
const tables=['employee_profiles','emergency_contacts','employee_credentials','leave_requests'];
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
 return {promise,resolve,reject};}
function fixture(){
 const scopeRef={current:'company-A:worker-A'},revision={current:0};
 const state={fullName:'',phone:'',contacts:[],credentials:[],leaves:[],loadedScope:'',error:''};
 const writes=[],requests=new Map();
 const setters={
  setFullName:v=>record('fullName',v),setPhone:v=>record('phone',v),
  setContacts:v=>record('contacts',v),setCredentials:v=>record('credentials',v),
  setLeaves:v=>record('leaves',v),setLoadedPersonalScope:v=>record('loadedScope',v),
  setPersonalReadError:v=>record('error',v)
 };
 function record(k,v){state[k]=v;writes.push([k,v]);}
 const supabase={from:table=>{
  assert.ok(tables.includes(table));
  const d=requests.get(table);
  assert.ok(d,'Missing read gate for '+table);
  const query={select:()=>query,eq:()=>query,order:()=>query,maybeSingle:()=>d.promise,
   then:(yes,no)=>d.promise.then(yes,no)};
  return query;
 }};
 function gates(tag='A',answers={}){
  const current=new Map();
  for(const table of tables){
   const d=deferred();current.set(table,d);requests.set(table,d);
  }
  return {
   complete:()=>{for(const [table,d] of current){
    const data=table==='employee_profiles'?{full_name:'Worker '+tag,phone:'555-'+tag}:
     [{id:table+'-'+tag}];
    d.resolve(Object.prototype.hasOwnProperty.call(answers,table)?
     answers[table]:{data,error:null});
   }},
   reject:(table)=>current.get(table).reject(Error('Transport '+table))
  };
 }
 function create({companyId='company-A',userId='worker-A'}={}){
  const account={companyId,userId},accountScope=companyId+':'+userId;
  return new Function('account','accountScope','accountScopeRef','personalReadRevision',
   'supabase',...Object.keys(setters),compiled+'\nreturn reload;')(
   account,accountScope,scopeRef,revision,supabase,...Object.values(setters));
 }
 return {scopeRef,revision,state,writes,gates,create};
}

test('slow first account read cannot overwrite newly loaded employee details',async()=>{
 const f=fixture(),old=f.gates('old');
 const first=f.create()();
 f.scopeRef.current='company-B:worker-B';
 const fresh=f.gates('new');
 const second=f.create({companyId:'company-B',userId:'worker-B'})();
 fresh.complete();await second;
 old.complete();await first;
 assert.equal(f.state.loadedScope,'company-B:worker-B');
 assert.equal(f.state.fullName,'Worker new');
 assert.deepEqual(f.state.contacts,[{id:'emergency_contacts-new'}]);
 assert.deepEqual(f.state.leaves,[{id:'leave_requests-new'}]);
 assert.equal(f.writes.some(([k,v])=>k==='fullName'&&v==='Worker old'),false);
});

test('switching signed-in employee within one company drops old private response',async()=>{
 const f=fixture(),previous=f.gates('old');
 const first=f.create()();
 f.scopeRef.current='company-A:worker-B';
 previous.complete();await first;
 assert.equal(f.state.loadedScope,'');
 assert.deepEqual(f.state.contacts,[]);
 assert.equal(f.writes.some(([k])=>k==='contacts'),false);
});

test('the last refresh wins when two reads overlap for the same worker',async()=>{
 const f=fixture(),older=f.gates('old'),one=f.create()();
 const newer=f.gates('new'),two=f.create()();
 newer.complete();await two;
 older.complete();await one;
 assert.equal(f.state.fullName,'Worker new');
 assert.equal(f.state.loadedScope,'company-A:worker-A');
 assert.deepEqual(f.state.credentials,[{id:'employee_credentials-new'}]);
});

test('a damaged or incomplete response cannot be presented as a loaded personal snapshot',async()=>{
 for(const malformed of [
  {emergency_contacts:{data:null,error:null}},
  {employee_credentials:{data:'oops',error:null}},
  {leave_requests:{data:null,error:null}},
  {employee_profiles:{data:[],error:null}}
 ]){
  const f=fixture(),pending=f.gates('partial',malformed);
  const load=f.create()();pending.complete();await load;
  assert.equal(f.state.loadedScope,'');
  assert.match(f.state.error,/Renseignements indisponibles/);
  assert.deepEqual(f.state.leaves,[]);
 }
});

test('query error or transport rejection must not leak partial contact or leave records',async()=>{
 const f=fixture(),pending=f.gates('error',{leave_requests:{
  data:null,error:Error('Denied')
 }});
 const loading=f.create()();pending.complete();await loading;
 assert.equal(f.state.loadedScope,'');
 assert.deepEqual(f.state.contacts,[]);
 assert.match(f.state.error,/Renseignements indisponibles/);
 const g=fixture(),broken=g.gates('failed');
 const load=g.create()();broken.reject('employee_profiles');await load;
 assert.equal(g.state.loadedScope,'');
 assert.match(g.state.error,/Renseignements indisponibles/);
 // Remaining Promise.all queries are deliberately pending; no data can be published.
});

test('missing optional employee profile is permitted only with complete scoped lists',async()=>{
 const f=fixture(),read=f.gates('empty',{employee_profiles:{data:null,error:null},
  emergency_contacts:{data:[],error:null},
  employee_credentials:{data:[],error:null},
  leave_requests:{data:[],error:null}});
 const loading=f.create()();read.complete();await loading;
 assert.equal(f.state.loadedScope,'company-A:worker-A');
 assert.equal(f.state.fullName,'');
 assert.deepEqual(f.state.contacts,[]);
 assert.deepEqual(f.state.leaves,[]);
});

test('portal hides private panels before loading and permits a retry',()=>{
 assert.match(source,/loadedPersonalScope!==accountScope/);
 assert.match(source,/Réessayer le chargement/);
 assert.match(source,/setLoadedPersonalScope\(''\);setPersonalReadError\(''\)/);
 assert.match(source,/setFullName\(''\);setPhone\(''\);setContacts\(\[\]\);setCredentials\(\[\]\);setLeaves\(\[\]\)/);
 assert.match(source,/\+\+personalReadRevision\.current/);
 assert.match(source,/\},\[accountScope\]\);/);
 assert.match(source,/\['profile','emergency','credentials','leave'\]\.includes\(next\)/);
 const ast=ts.createSourceFile('MorePortal.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0);
});
