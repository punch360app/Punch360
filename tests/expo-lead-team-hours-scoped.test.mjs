import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/hr/teamHoursOverview.ts',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/hr/TeamsPanel.tsx',import.meta.url),'utf8');
const lib={};
new Function('exports',ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText)(lib);
const {parseLeadTeamHours}=lib;
const staff=(id,today,week,present=false)=>({
 user_id:id,present,today_gross_ms:today,week_gross_ms:week
});
test('authorized server values show actual supervised hours, employees and presence',()=>{
 assert.deepEqual(parseLeadTeamHours([
  staff('worker-A',3600000,7200000,true),
  staff('worker-B',5400000,9000000,false)
 ]),{workers:2,present:1,todayMs:9000000,weekMs:16200000});
 assert.deepEqual(parseLeadTeamHours([]),{workers:0,present:0,todayMs:0,weekMs:0});
});

test('malformed server overview must not be disguised as zero hours',()=>{
 for(const v of [null,{},'[]',[null],[{}],[staff('A',-1,0)],
  [staff('A',NaN,0)],[staff('A',0,Infinity)],
  [{...staff('A',100,200),present:'yes'}],
  [{...staff('A',100,200),week_gross_ms:null}],
  [staff('A',1,2),staff('A',3,4)]]){
  assert.throws(()=>parseLeadTeamHours(v),/Relevé|Total/,String(v));
 }
});

const start=panel.indexOf(' async function load(){');
const end=panel.indexOf(' useEffect(()=>{',start);
assert.ok(start>0&&end>start);
const js=ts.transpileModule(panel.slice(start,end),{compilerOptions:{
 module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022
}}).outputText;
function defer(){let resolve;const promise=new Promise(r=>{resolve=r});return {resolve,promise};}
function fixture(role='lead'){
 const ref={current:'company-A:worker-A:'+role},rev={current:0};
 const states={teams:[],people:[],jobs:[],stats:null,loaded:'',error:''};
 const writes=[],calls=[],gates=[];
 function save(key,value){states[key]=value;writes.push({key,value})}
 const setters={
  setTeams:x=>save('teams',x),setPeople:x=>save('people',x),
  setJobs:x=>save('jobs',x),setTeamStats:x=>save('stats',x),
  setLoadError:x=>save('error',x),setLoadedScope:x=>save('loaded',x)
 };
 let request=null;
 const supabase={
  from:table=>{
   calls.push(table);
   if(table==='punch_segments')throw Error('Unsafe broad segment scan');
   const gate=defer();gates.push({table,gate});
   const query={select:()=>query,eq:()=>query,
    then:(resolve,reject)=>gate.promise.then(resolve,reject)};
   return query;
  },
  rpc:(name,args)=>{
   calls.push(name);
   assert.equal(name,'lead_team_overview');
   assert.deepEqual(args,{p_company:request.companyId});
   const gate=defer();gates.push({table:'rpc',gate});
   return gate.promise;
  }
 };
 function create(account={companyId:'company-A',userId:'worker-A',role}){
  request=account;
  const scope=account.companyId+':'+account.userId+':'+account.role;
  const manager=['admin','boss'].includes(account.role);
  return new Function('account','scope','scopeRef','readRevision','manager',
   'supabase','parseLeadTeamHours',...Object.keys(setters),js+'\nreturn load;')(
    account,scope,ref,rev,manager,supabase,parseLeadTeamHours,...Object.values(setters));
 }
 function resolveWaiting(label='new',overrides={}){
  for(const {table,gate} of gates.splice(0)){
   const data=table==='teams'?[{id:'team-'+label,name:'Team '+label,lead_user_id:'worker-A'}]:
    table==='rpc'?[staff('worker-'+label,3600000,7200000,true)]:
    table==='company_members'?[{user_id:'worker-'+label,role:'lead'}]:
    table==='jobs'?[{id:'job-'+label,name:'Job '+label,number:'123'}]:null;
   gate.resolve(Object.hasOwn(overrides,table)?overrides[table]:{data,error:null});
  }
 }
 return {ref,rev,states,writes,calls,gates,create,resolveWaiting};
}

test('lead reads only assigned team overview RPC and own-team listing',async()=>{
 const f=fixture(),pending=f.create()();
 assert.deepEqual(f.calls,['teams','lead_team_overview']);
 f.resolveWaiting();await pending;
 assert.equal(f.states.loaded,'company-A:worker-A:lead');
 assert.deepEqual(f.states.stats,{workers:1,present:1,todayMs:3600000,weekMs:7200000});
 assert.deepEqual(f.states.people,[]);
 assert.deepEqual(f.states.jobs,[]);
});

test('manager screen lists teams, employees and jobs without calling lead-only RPC',async()=>{
 const f=fixture('boss'),pending=f.create()();
 assert.deepEqual(f.calls,['teams','company_members','jobs']);
 f.resolveWaiting();await pending;
 assert.equal(f.states.loaded,'company-A:worker-A:boss');
 assert.equal(f.states.stats,null);
 assert.equal(f.states.people.length,1);
 assert.equal(f.states.jobs.length,1);
});

test('late team overview for old company cannot replace new company figures',async()=>{
 const f=fixture(),old=f.create()();
 const oldGates=f.gates.splice(0);
 f.ref.current='company-B:worker-B:lead';
 const current=f.create({companyId:'company-B',userId:'worker-B',role:'lead'})();
 f.resolveWaiting('B');await current;
 for(const {table,gate} of oldGates){
  gate.resolve({data:table==='rpc'?[staff('worker-OLD',999999999,999999999)]:
   [{id:'team-old',name:'OLD',lead_user_id:'worker-A'}],error:null});
 }
 await old;
 assert.equal(f.states.loaded,'company-B:worker-B:lead');
 assert.equal(f.states.stats.todayMs,3600000);
 assert.equal(f.writes.some(x=>x.key==='stats'&&x.value?.todayMs===999999999),false);
});

test('failed or incomplete overview shows an error, never fake zero-hour totals',async()=>{
 for(const response of [{data:null,error:null},
  {data:null,error:Error('Access denied')},
  {data:[staff('A',null,123)],error:null}]){
  const f=fixture(),loading=f.create()();
  f.resolveWaiting('bad',{rpc:response});await loading;
  assert.equal(f.states.loaded,'');
  assert.equal(f.states.stats,null);
  assert.match(f.states.error,/Heures|Relevé|Total/);
 }
});

test('UI describes authorized worker totals rather than count of punch segments',()=>{
 assert.match(panel,/lead_team_overview/);
 assert.doesNotMatch(panel,/supabase\.from\('punch_segments'\)/);
 assert.match(panel,/employés supervisés/);
 assert.match(panel,/Heures brutes des chantiers supervisés/);
 assert.match(panel,/loadedScope!==scope/);
 assert.match(panel,/Réessayer le chargement/);
 const ast=ts.createSourceFile('TeamsPanel.tsx',panel,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0);
});
