import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {masterIds,pullProgressIds,updateWorkRegister} from '../scripts/update-work-progress.mjs';

const html=readFileSync(new URL('../web/live/suivi.html',import.meta.url),'utf8');
const progress=JSON.parse(readFileSync(new URL('../web/live/work-progress.json',import.meta.url),'utf8'));
const master=readFileSync(new URL('../docs/prompt-board/MASTER_PROMPT_20261025.md',import.meta.url),'utf8');
const valid=masterIds(master);
const bundle=html.match(/<script type="application\/json" id="dataBundle">([\s\S]*?)<\/script>/);
assert.ok(bundle);
const embedded=JSON.parse(bundle[1]);
const marker='function summarizeWorkProgress(manifest){',last='function totalValidated()';
const start=html.indexOf(marker),end=html.indexOf(last,start);
assert.ok(start>0&&end>start);
const calc=html.slice(start,end);
const summarize=vm.runInNewContext(
 '(function(){const validTaskIds=new Set('+JSON.stringify([...valid])+');'+calc+';return summarizeWorkProgress;})()');

test('Work progress is sourced from GitHub, NOT owner localStorage checkboxes',()=>{
 for(const id of ['progressFraction','progressPercent','progressRemaining','progressMeter','progressFill','progressDetail','progressSync'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('1. Travail documenté par Work'));
 assert.match(html,/async function loadWorkProgress\(\)/);
 assert.ok(html.includes('raw.githubusercontent.com/punch360app/Punch360/main/web/live/work-progress.json'));
 assert.ok(html.includes("'./work-progress.json?t='+stamp"));
 assert.ok(html.includes('setInterval(()=>{if(!document.hidden)void loadWorkProgress();},60000)'));
 assert.match(html,/id="workRecent"/);
 assert.ok(html.indexOf('id="progressFraction"')<html.indexOf('id="reqCount"'));
 assert.ok(html.indexOf('init();void loadWorkProgress();')>0);
 const summaryBlock=html.slice(html.indexOf('function totalValidated()'),html.indexOf('function renderWorkProgress('));
 assert.ok(!summaryBlock.includes("document.getElementById('progressFraction')"));
 assert.ok(!summaryBlock.includes("document.getElementById('progressPercent')"));
});
test('exactly 578 master IDs, backfilled evidence, no invented deployment or blanket completion',()=>{
 assert.equal(valid.size,578);
 assert.equal(embedded.sections.flatMap(s=>s.tasks).length,578);
 assert.equal(progress.schema_version,1);
 assert.equal(progress.denominator,578);
 const ids=Object.keys(progress.requirements);
 assert.ok(ids.length>=20,'existing merged work must be represented');
 assert.ok(ids.every(id=>valid.has(id)));
 assert.ok(Object.values(progress.requirements).every(r=>Array.isArray(r.pr)&&r.pr.length&&r.deployed!==true));
 assert.ok(progress.activity.length>=30,'already merged PRs are visible as history');
 assert.ok(progress.activity.every(p=>Number.isSafeInteger(p.number)&&p.merged_at&&p.title));
 const output=summarize(progress);
 assert.equal(output.total,578);
 assert.equal(output.documented,ids.length);
 assert.equal(output.developedTested,ids.filter(id=>progress.requirements[id].tested==='software').length);
 assert.ok(output.developedTested<output.documented,'older merged PR titles are not proof of software tests');
 assert.ok(output.documented>=80,'retrospective archives, HR, kiosk and Super Admin must be represented');
 assert.ok(Object.values(progress.requirements).some(r=>r.tested==='not_verified'&&r.developed==='partial'));
 assert.equal(output.delivered,0);
 assert.equal(output.percent,Math.round(1000*ids.length/578)/10);
});
test('work progress does not count unproven or fake IDs',()=>{
 const altered=structuredClone(progress);
 altered.requirements['NOT-IN-MASTER-999']={developed:'verified',tested:'software',deployed:true};
 altered.requirements['STRIPE-001']={developed:'none',tested:'not_verified',deployed:false};
 assert.equal(summarize(altered).documented,Object.keys(progress.requirements).length);
});
test('completed count requires code verified + tests + deployment and external QA finished',()=>{
 const fresh=structuredClone(progress);
 fresh.requirements['STRIPE-001']={developed:'verified',tested:'software',deployed:true,external_required:true,pr:[1]};
 let stats=summarize(fresh);
 assert.equal(stats.delivered,0);
 fresh.requirements['STRIPE-001'].external_required=false;
 stats=summarize(fresh);
 assert.equal(stats.delivered,1);
});
test('PR marker requires explicit IDs and never infers from title or ambiguous prose',()=>{
 assert.deepEqual(pullProgressIds('Fix Stripe STRIPE-012 and GOV-014'),[]);
 assert.deepEqual(pullProgressIds('PUNCH-PROGRESS: STRIPE-012, GOV-014\nAnything'),['STRIPE-012','GOV-014']);
 assert.deepEqual(pullProgressIds('PUNCH-PROGRESS: GOV-014; GOV-014'),['GOV-014']);
});
test('merged PR with successful CI updates exact mapped requirement without certifying deployment',()=>{
 const pull={merged:true,number:222,merge_commit_sha:'a'.repeat(40),head:{sha:'b'.repeat(40)},
  title:'Strengthen invoice status',merged_at:'2026-10-26T12:00:00Z',body:'PUNCH-PROGRESS: STRIPE-012, GOV-014'};
 const next=updateWorkRegister(progress,pull,true,valid,'2026-10-26T12:01:00Z');
 assert.ok(next.requirements['STRIPE-012'].pr.includes(222));
 assert.equal(next.requirements['STRIPE-012'].tested,'software');
 assert.equal(next.requirements['STRIPE-012'].deployed,false);
 assert.equal(next.activity[0].number,222);
 assert.equal(next.activity[0].ci,'success');
 assert.equal(summarize(next).delivered,0);
 assert.deepEqual(updateWorkRegister(next,pull,true,valid,'2026-10-26T12:03:00Z'),next);
});
test('unknown ID is rejected and an unannotated merged PR only updates activity',()=>{
 const base={merged:true,number:223,merge_commit_sha:'b'.repeat(40),title:'No markers',body:'Unrelated change'};
 const next=updateWorkRegister(progress,base,false,valid,'2026-10-26T12:01:00Z');
 assert.equal(Object.keys(next.requirements).length,Object.keys(progress.requirements).length);
 assert.equal(next.activity[0].ci,'not_verified');
 assert.equal(next.activity[0].ids.length,0);
 assert.throws(()=>updateWorkRegister(progress,{...base,number:224,body:'PUNCH-PROGRESS: UNKNOWN-001'},true,valid,'2026-10-26T12:01:00Z'),/UNKNOWN_PROGRESS_ID/);
 assert.throws(()=>updateWorkRegister(progress,{...base,merged:false},true,valid,'2026-10-26T12:01:00Z'),/MERGED_PR_REQUIRED/);
});
test('automation is merge triggered, scoped and preserves security of owner Stripe contracts',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/work-progress.yml',import.meta.url),'utf8');
 assert.match(workflow,/types: \[closed\]/);
 assert.match(workflow,/merged == true/);
 assert.match(workflow,/contents: write/);
 assert.match(workflow,/actions: read/);
 assert.match(workflow,/node scripts\/update-work-progress\.mjs/);
 assert.ok(!workflow.includes('SUPABASE_SERVICE_ROLE_KEY'));
 assert.ok(!workflow.includes('STRIPE_SECRET_KEY'));
});
