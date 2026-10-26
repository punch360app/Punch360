import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../web/live/suivi.html',import.meta.url),'utf8');
const progress=JSON.parse(readFileSync(new URL('../web/live/work-progress.json',import.meta.url),'utf8'));
const master=readFileSync(new URL('../docs/prompt-board/MASTER_PROMPT_20261025.md',import.meta.url),'utf8');
const ids=[...master.matchAll(/^- \[ \] \*\*([A-Z]+-\d{3})\*\* — /gm)].map(m=>m[1]);
const start=html.indexOf('function summarizeWorkProgress(manifest){');
const end=html.indexOf('function totalValidated()',start);
assert.ok(start>0&&end>start);
const fn=vm.runInNewContext('(function(){const validTaskIds=new Set('+JSON.stringify(ids)+');'+html.slice(start,end)+';return summarizeWorkProgress;})()');

test('three Work meters exist before the project-wide inventory and adapt to mobile',()=>{
 for(const part of ['progressFraction','progressPercent','progressMeter','progressFill',
  'progressTestedFraction','progressTestedPercent','progressTestedMeter','progressTestedFill',
  'progressDeliveredFraction','progressDeliveredPercent','progressDeliveredMeter','progressDeliveredFill']){
  assert.ok(html.includes('id="'+part+'"'),part);
 }
 assert.ok(html.indexOf('id="progressFraction"')<html.indexOf('id="reqCount"'));
 assert.ok(html.indexOf('id="progressTestedFraction"')<html.indexOf('id="reqCount"'));
 assert.ok(html.indexOf('id="progressDeliveredFraction"')<html.indexOf('id="reqCount"'));
 assert.match(html,/completion-submetrics/);
 assert.match(html,/@media\(max-width:760px\)\{\.completion-submetrics\{/);
});

test('all three ratios derive automatically from exactly 578 master IDs, not owner checkboxes',()=>{
 assert.equal(new Set(ids).size,578);
 const p=fn(progress);
 assert.equal(p.total,578);
 assert.equal(p.documented,82);
 assert.equal(p.developedTested,26);
 assert.equal(p.delivered,0);
 assert.equal(p.percent,14.2);
 assert.equal(p.testedPercent,4.5);
 assert.equal(p.deliveredPercent,0);
 assert.match(html,/document\.getElementById\('progressTestedFraction'\)\.textContent=result\.developedTested/);
 assert.match(html,/document\.getElementById\('progressDeliveredFraction'\)\.textContent=result\.delivered/);
 assert.match(html,/fetch\(source,\{cache:'no-store'\}\)/);
});

test('independent counts never equate merged work, tested code, and delivered code',()=>{
 const sample={requirements:{
  'GOV-001':{developed:'partial',tested:'not_verified',deployed:false},
  'GOV-002':{developed:'partial',tested:'software',deployed:false},
  'GOV-009':{developed:'verified',tested:'software',deployed:true,external_required:true},
  'GOV-010':{developed:'verified',tested:'software',deployed:true,external_required:false},
  'UNKNOWN-999':{developed:'verified',tested:'software',deployed:true,external_required:false}
 }};
 const p=fn(sample);
 assert.equal(p.documented,4);
 assert.equal(p.developedTested,3);
 assert.equal(p.delivered,1);
 assert.equal(p.percent,0.7);
 assert.equal(p.testedPercent,0.5);
 assert.equal(p.deliveredPercent,0.2);
});
