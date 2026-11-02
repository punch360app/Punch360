import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const helper=readFileSync(new URL('../src/hr/teamActions.ts',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/hr/TeamsPanel.tsx',import.meta.url),'utf8');
const mod={};
new Function('exports',ts.transpileModule(helper,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText)(mod);
const {validatedTeamCreation,validatedTeamMemberAssignment,validatedTeamJobAssignment}=mod;
const members=[
 {user_id:'lead-A',role:'lead'},
 {user_id:'worker-A',role:'employee'},
 {user_id:'boss-A',role:'boss'}
];
const teams=[{id:'team-A'}],jobs=[{id:'job-A'}];

test('creating a team requires a real active lead and normalizes its name',()=>{
 assert.deepEqual(validatedTeamCreation('company-A','  Équipe toiture  ','lead-A',members),
  {p_company:'company-A',p_name:'Équipe toiture',p_lead:'lead-A'});
 for(const [company,name,lead,personnel] of [
  ['','Toiture','lead-A',members],
  ['company-A','','lead-A',members],
  ['company-A','  ','lead-A',members],
  ['company-A','x'.repeat(141),'lead-A',members],
  ['company-A','Toiture','boss-A',members],
  ['company-A','Toiture','worker-A',members],
  ['company-A','Toiture','not-in-company',members]
 ]){
  assert.throws(()=>validatedTeamCreation(company,name,lead,personnel));
 }
 assert.equal(validatedTeamCreation('company-A','x'.repeat(140),'lead-A',members).p_name.length,140);
});

test('adding an employee requires a team and worker from the refreshed active-company lists',()=>{
 assert.deepEqual(validatedTeamMemberAssignment('team-A','worker-A',teams,members),
  {p_team:'team-A',p_employee:'worker-A'});
 assert.equal(validatedTeamMemberAssignment('team-A','lead-A',teams,members).p_employee,'lead-A');
 for(const [team,worker] of [
  ['','worker-A'],['team-B','worker-A'],['team-A',''],['team-A','boss-A'],
  ['team-A','departed-worker']
 ]){
  assert.throws(()=>validatedTeamMemberAssignment(team,worker,teams,members));
 }
});

test('team-to-job assignment rejects stale, inactive or missing team and job choices',()=>{
 assert.deepEqual(validatedTeamJobAssignment('company-A','team-A','job-A',teams,jobs),
  {company_id:'company-A',team_id:'team-A',job_id:'job-A'});
 for(const [company,team,job] of [
  ['','team-A','job-A'],['company-A','','job-A'],
  ['company-A','team-B','job-A'],['company-A','team-A',''],
  ['company-A','team-A','job-other']
 ]){
  assert.throws(()=>validatedTeamJobAssignment(company,team,job,teams,jobs));
 }
});

test('server choices never accept a nonmatching role or unlisted identifier',()=>{
 assert.throws(()=>validatedTeamCreation('company-A','Site','lead-A',
  [{user_id:'lead-A',role:'inactive'}]),/chef actif/);
 assert.throws(()=>validatedTeamMemberAssignment('team-A','worker-A',teams,
  [{user_id:'worker-A',role:'terminated'}]),/employé actif/);
 assert.throws(()=>validatedTeamJobAssignment('company-A','team-A','job-A',
  teams,[]),/chantier actif/);
});

const start=panel.indexOf(' const submit=async(');
const end=panel.indexOf(' if(loadedScope!==scope)',start);
assert.ok(start>=0&&end>start);
const submitJs=ts.transpileModule(panel.slice(start,end),{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None
}}).outputText;
function gate(){let release;const promise=new Promise(resolve=>{release=resolve});return {promise,release};}
function fixture({manager=true,loadedScope='company-A:user-A:boss',refresh=true}={}){
 const scope='company-A:user-A:boss',scopeRef={current:scope},lock={current:null};
 const alerts=[],busy=[],calls={refresh:0};
 const Alert={alert:(...args)=>alerts.push(args)};
 const setBusy=v=>busy.push(v);
 const load=async()=>{calls.refresh++;return refresh};
 const submit=new Function('manager','submitInFlight','loadedScope','scope','scopeRef',
  'setBusy','load','Alert',submitJs+'\nreturn submit;')(
  manager,lock,loadedScope,scope,scopeRef,setBusy,load,Alert);
 return {submit,scopeRef,lock,alerts,busy,calls};
}

test('simultaneous presses cannot duplicate an active manager write',async()=>{
 const f=fixture(),pending=gate();
 let writes=0;
 const first=f.submit(async()=>{writes++;await pending.promise;return {error:null}});
 assert.equal(writes,1);
 await f.submit(async()=>{writes++;return {error:null}});
 assert.equal(writes,1);
 assert.deepEqual(f.busy,[true]);
 pending.release();await first;
 assert.equal(f.calls.refresh,1);
 assert.deepEqual(f.busy,[true,false]);
 assert.equal(f.alerts[0][0],'Enregistré');
});

test('read-only and unloaded team pages do not start manager mutations',async()=>{
 for(const config of [{manager:false},{loadedScope:''}]){
  const f=fixture(config);
  let count=0;
  await f.submit(async()=>{count++;return {error:null}});
  assert.equal(count,0);
  assert.equal(f.alerts.length,0);
 }
});

test('a stale successful write does not show a false alert on a different account',async()=>{
 const f=fixture(),pending=gate();
 const first=f.submit(async()=>{await pending.promise;return {error:null}});
 f.scopeRef.current='company-B:user-B:boss';
 pending.release();await first;
 assert.equal(f.alerts.length,0);
 assert.equal(f.calls.refresh,0);
 assert.deepEqual(f.busy,[true]);
});

test('a rejected write restores submit ability without claiming success',async()=>{
 const f=fixture();
 await f.submit(async()=>({error:new Error('Not allowed')}));
 assert.deepEqual(f.alerts,[['Erreur','Not allowed']]);
 assert.equal(f.calls.refresh,0);
 assert.equal(f.lock.current,null);
 await f.submit(async()=>({error:null}));
 assert.equal(f.alerts.at(-1)[0],'Enregistré');
});

test('a confirmed team write is not reported as failed when the list cannot refresh',async()=>{
 const f=fixture({refresh:false});
 await f.submit(async()=>({error:null}));
 assert.equal(f.alerts[0][0],'Enregistré');
 assert.match(f.alerts[0][1],/liste n’a pas été actualisée/);
});

test('mobile manager controls use validated selections, pending state and scoped mutation guard',()=>{
 for(const name of ['validatedTeamCreation','validatedTeamMemberAssignment','validatedTeamJobAssignment'])
  assert.match(panel,new RegExp(name+'\\('));
 assert.match(panel,/submitInFlight\.current===scope/);
 assert.match(panel,/scopeRef\.current!==scope/);
 assert.match(panel,/Enregistrement en cours…/);
 assert.match(panel,/disabled=\{busy\}/);
 assert.doesNotMatch(panel,/if\(!name\.trim\(\)\|\|!lead\)/);
 assert.doesNotMatch(panel,/p_team:selectedTeam,p_employee:worker/);
 assert.match(panel,/Modification confirmée, mais la liste n’a pas été actualisée/);
 for(const [filename,code,kind] of [
  ['teamActions.ts',helper,ts.ScriptKind.TS],['TeamsPanel.tsx',panel,ts.ScriptKind.TSX]
 ]){
  const ast=ts.createSourceFile(filename,code,ts.ScriptTarget.Latest,true,kind);
  assert.equal(ast.parseDiagnostics.length,0,filename+' should parse');
 }
});
