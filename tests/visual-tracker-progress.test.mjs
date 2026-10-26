import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../web/live/suivi.html',import.meta.url),'utf8');
const bundle=html.match(/<script type="application\/json" id="dataBundle">([\s\S]*?)<\/script>/);
assert.ok(bundle,'embedded master inventory must stay available offline');
const data=JSON.parse(bundle[1]);
const source=html.match(/function localProgress\(validIds,statuses\)\{[\s\S]*?\n\}/);
assert.ok(source,'progress calculation must be testable and local');
const localProgress=vm.runInNewContext('('+source[0]+')');

test('prominent progress panel displays a count, percentage and accessible meter before dashboard stats',()=>{
 for(const id of ['completionHeading','progressFraction','progressPercent','progressRemaining','progressMeter','progressFill']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(html.indexOf('id="progressFraction"')<html.indexOf('id="reqCount"'),
  'completion appears at the very beginning of the dashboard');
 assert.match(html,/<section class="completion-card"/);
 assert.match(html,/role="progressbar"[^>]+aria-valuemin="0"[^>]+aria-valuemax="100"/);
 assert.match(html,/Le[s]? tâches non cochées|Les tâches non cochées/);
 assert.match(html,/pas une certification de déploiement/);
 assert.match(html,/@media\(max-width:760px\)[^}]*\.completion-card/);
});
test('progress uses precisely the 578 official unique IDs, and local Validé selections only',()=>{
 const officialIds=data.sections.flatMap(s=>s.tasks.map(t=>t.id));
 assert.equal(officialIds.length,578);
 const ids=new Set(officialIds);
 assert.equal(ids.size,578);
 let result=localProgress(ids,{});
 assert.deepEqual({...result},{done:0,total:578,remaining:578,percent:0});
 const statuses=Object.fromEntries(officialIds.slice(0,110).map(id=>[id,'valide']));
 result=localProgress(ids,statuses);
 assert.equal(result.done,110);
 assert.equal(result.remaining,468);
 assert.equal(result.percent,19);
 // External/unrelated localStorage keys and task statuses do not inflate completion.
 statuses['UNKNOWN-999']='valide';
 statuses[officialIds[110]]='tester';
 statuses[officialIds[111]]='en_cours';
 statuses[officialIds[112]]='bloque';
 assert.equal(localProgress(ids,statuses).done,110);
 statuses[officialIds[0]]='a_faire';
 assert.equal(localProgress(ids,statuses).done,109);
 assert.equal(localProgress(ids,statuses).percent,18.9);
 assert.equal(localProgress(ids,Object.fromEntries(officialIds.map(id=>[id,'valide']))).percent,100);
});
test('denominator is dynamic and percentage is mathematically correct',()=>{
 const result=localProgress(new Set(Array.from({length:500},(_,i)=>'T-'+i)),
 Object.fromEntries(Array.from({length:110},(_,i)=>['T-'+i,'valide'])));
 assert.equal(result.percent,22); // 110 / 500 = 22%, not 20%.
 assert.equal(result.total,500);
 assert.equal(localProgress(new Set(),{}).percent,0);
});
test('progress re-renders when status changes and when local notes reset',()=>{
 assert.match(html,/document\.getElementById\('progressFraction'\)\.textContent=result\.done\+' \/ '\+result\.total/);
 assert.match(html,/document\.getElementById\('progressPercent'\)\.textContent=localizedPercent/);
 assert.match(html,/document\.getElementById\('progressFill'\)\.style\.width=result\.percent\+'%'/);
 assert.match(html,/document\.getElementById\('progressMeter'\)\.setAttribute\('aria-valuenow',String\(result\.percent\)\)/);
 assert.match(html,/localStorage\.setItem\(SK,JSON\.stringify\(notes\)\);totalValidated\(\)/);
 assert.match(html,/localStorage\.removeItem\(SK\);totalValidated\(\)/);
 assert.match(html,/init\(\);\}\)\(\);/);
});
