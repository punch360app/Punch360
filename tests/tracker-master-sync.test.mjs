import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseMaster,syncTracker} from '../scripts/sync-tracker-master.mjs';
import {masterIds,updateWorkRegister} from '../scripts/update-work-progress.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const master=read('docs/prompt-board/MASTER_PROMPT_20261025.md');
const html=read('web/live/suivi.html');
const manifest=JSON.parse(read('web/live/work-progress.json'));
test('adding a requirement automatically updates HTML, denominator and percentages without granting evidence',()=>{
 const addition='\n## P2 — Nouveau lot (NEW, 1 points)\n- [ ] **NEW-001** — Nouvelle demande.\n';
 const result=syncTracker(html,manifest,master+addition);
 assert.equal(result.manifest.denominator,masterIds(master).size+1);
 assert.deepEqual(result.manifest.requirements,manifest.requirements);
 const bundle=JSON.parse(result.html.match(/id="dataBundle">([\s\S]*?)<\/script>/)[1]);
 assert.equal(bundle.sections.at(-1).tasks[0].id,'NEW-001');
 assert.ok(result.html.includes((manifest.denominator+1)+' exigences.<br>'));
 const counts=Object.keys(manifest.requirements).length;
 assert.ok(counts/result.manifest.denominator<counts/manifest.denominator);
 const pull={merged:true,number:9999,merge_commit_sha:'a'.repeat(40),body:''};
 assert.equal(updateWorkRegister(manifest,pull,false,masterIds(master+addition),'now').denominator,result.manifest.denominator);
 assert.deepEqual(syncTracker(result.html,result.manifest,master+addition),result);
});
test('checked boxes remain inventory, duplicates and empty input fail clearly',()=>{
 assert.equal(masterIds(master.replace('- [ ] **GOV-001**','- [x] **GOV-001**')).size,masterIds(master).size);
 assert.throws(()=>parseMaster(master+'\n- [ ] **SMS-001** — duplicate\n'),/DUPLICATE|INVALID/);
 assert.throws(()=>parseMaster(''),/EMPTY_MASTER/);
});
test('Pages republishes trusted main after the bot finishes recording progress',()=>{
 const workflow=read('.github/workflows/deploy-web.yml');
 assert.match(workflow,/workflow_run:\s*workflows: \["PUNCH Work progress register"\]\s*types: \[completed\]/);
 assert.match(workflow,/workflow_run\.conclusion == 'success'/);
 assert.match(workflow,/workflow_run\.head_repository\.full_name == github\.repository/);
 assert.match(workflow,/ref: \$\{\{ github\.event_name == 'workflow_run' && 'main' \|\| github\.sha \}\}/);
 assert.ok(workflow.indexOf('Generate tracker from current master')<workflow.indexOf('Upload website'));
});
