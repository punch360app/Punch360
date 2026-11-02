import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const portal=readFileSync(new URL('../src/hr/MorePortal.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const a=portal.indexOf(' async function addJob(){');
const b=portal.indexOf(' const open=(next:Section)',a);
assert.ok(a>=0&&b>a,'Use the real mobile job creation handler');
const js=ts.transpileModule(portal.slice(a,b),{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None
}}).outputText;
function fixture({created='job-new',createFailure=null,refreshFailure=null,restricted=false}={}){
 const alerts=[],notices=[],calls={created:0,refreshed:0,cleared:[]};
 const account={companyId:'company-A'},number='JOB-314',jobName='New site',address='123 rue A';
 const Alert={alert:(...args)=>alerts.push(args)};
 const notify=(...args)=>notices.push(args);
 const createJob=async()=>{calls.created++;if(createFailure)throw createFailure;return created};
 const onRefresh=async()=>{calls.refreshed++;if(refreshFailure)throw refreshFailure};
 const setNumber=value=>calls.cleared.push(['number',value]);
 const setJobName=value=>calls.cleared.push(['name',value]);
 const setAddress=value=>calls.cleared.push(['address',value]);
 const args={account,number,jobName,address,restricted,Alert,notify,createJob,
  onRefresh,setNumber,setJobName,setAddress};
 const addJob=new Function(...Object.keys(args),js+'\nreturn addJob;')(...Object.values(args));
 return {addJob,alerts,notices,calls};
}

test('confirmed create remains successful when refreshing jobs afterward fails',async()=>{
 const f=fixture({refreshFailure:Error('No Internet')});
 await f.addJob();
 assert.equal(f.calls.created,1);
 assert.equal(f.calls.refreshed,1);
 assert.equal(f.notices.length,0);
 assert.deepEqual(f.calls.cleared,[['number',''],['name',''],['address','']]);
 assert.match(f.alerts[0][0],/Chantier créé/);
 assert.match(f.alerts[0][1],/Actualisez avant de créer un autre chantier/);
});

test('failed create retains form and never claims a new job was created',async()=>{
 const f=fixture({createFailure:Error('Timeout before confirmation')});
 await f.addJob();
 assert.equal(f.calls.created,1);
 assert.equal(f.calls.refreshed,0);
 assert.equal(f.calls.cleared.length,0);
 assert.equal(f.alerts.length,0);
 assert.equal(f.notices.length,1);
 assert.equal(f.notices[0][0],'Création impossible');
});

test('suspended administration blocks any new job request',async()=>{
 const f=fixture({restricted:true});
 await f.addJob();
 assert.equal(f.calls.created,0);
 assert.equal(f.calls.refreshed,0);
 assert.equal(f.alerts[0][0],'Administration suspendue');
});

test('normal successful create clears form and refreshes once',async()=>{
 const f=fixture();
 await f.addJob();
 assert.equal(f.calls.created,1);
 assert.equal(f.calls.refreshed,1);
 assert.equal(f.notices.length,0);
 assert.equal(f.alerts[0][0],'Chantier créé');
});

test('legacy native home also distinguishes creation failure from refresh failure',()=>{
 assert.match(app,/catch\{Alert\.alert\('Job ajoutée','Création confirmée, mais la liste n’a pas pu être actualisée/);
 assert.match(app,/catch\(e:any\)\{Alert\.alert\('Création non confirmée'/);
 const create=app.slice(app.indexOf("label=\"Ajouter le chantier\""),app.indexOf('</Card>:null}',app.indexOf("label=\"Ajouter le chantier\"")));
 assert.ok(create.indexOf('await createJob(')<create.indexOf('await refresh()'));
 assert.ok(create.indexOf("catch(e:any)")<create.indexOf("await refresh()"));
 for(const [filename,contents,kind] of [
  ['MorePortal.tsx',portal,ts.ScriptKind.TSX],['App.tsx',app,ts.ScriptKind.TSX]
 ]){
  const ast=ts.createSourceFile(filename,contents,ts.ScriptTarget.Latest,true,kind);
  assert.equal(ast.parseDiagnostics.length,0,filename+' must parse');
 }
});
