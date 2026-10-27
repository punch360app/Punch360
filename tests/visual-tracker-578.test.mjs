import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseMaster} from '../scripts/sync-tracker-master.mjs';
const sections=parseMaster(readFileSync('docs/prompt-board/MASTER_PROMPT_20261025.md','utf8'));
const count=sections.reduce((n,s)=>n+s.tasks.length,0);

const html=readFileSync(new URL('../web/live/suivi.html',import.meta.url),'utf8');
const script=html.match(/<script type="application\/json" id="dataBundle">([\s\S]*?)<\/script>/);
if(!script)throw Error('Data bundle missing');
const data=JSON.parse(script[1]);

test('visual tracker has exactly 578 uniquely identified requirements in 29 master lots',()=>{
 assert.equal(data.total_requirements,count);
 assert.equal(data.sections.length,sections.length);
 const tasks=data.sections.flatMap(s=>s.tasks);
 assert.equal(tasks.length,count);
 assert.equal(new Set(tasks.map(t=>t.id)).size,count);
 for(const s of data.sections){
  assert.equal(s.total,s.tasks.length,'mismatched count for '+s.code);
  assert.ok(s.tasks.every(t=>t.id.startsWith(s.code+'-')));
 }
 assert.deepEqual(Object.fromEntries(['P0','P1','P2','P3','P4'].map(p=>[p,
  data.sections.filter(s=>s.priority===p).reduce((sum,s)=>sum+s.tasks.length,0)])),
 Object.fromEntries(['P0','P1','P2','P3','P4'].map(p=>[p,sections.filter(s=>s.priority===p).reduce((n,s)=>n+s.tasks.length,0)])));
});

test('source is dated 26 October 2026; no invented completion or sensitive Drive link',()=>{
 assert.equal(data.generated_at,'2026-10-26');
 assert.equal(data.repository,'punch360app/Punch360');
 assert.equal(data.sections.filter(x=>x.tasks.some(t=>t.status==='valide')).length,0);
 assert.match(html,/GitHub et CI réussie ≠ déploiement|Fusion GitHub et CI réussie ≠ déploiement/);
 assert.match(html,/Notes locales « validées »/);
 assert.doesNotMatch(html,/drive\.google\.com|1vnzIYol5OZxV3MySFZQjzcxV-VhRGfD4/);
 assert.doesNotMatch(html,/(sk_live_|sk_test_|SUPABASE_SERVICE_ROLE_KEY\s*=)/);
});

test('latest evidence uses the current register and links to the authoritative continuation',()=>{
 assert.ok(html.includes('id="latestEvidence"'));
 assert.ok(html.includes('docs/PUNCH_WORK_CONTINUATION.md'));
 assert.match(html,/Preuves issues du registre GitHub/);
 assert.doesNotMatch(html,/AUTOPILOT_HANDOFF_20261026|migration de confirmation 20261026110100 absente/);
 assert.match(html,/Une fusion ne confirme pas à elle seule une recette/);
});

test('standalone original HTML design keeps search, filters, local note controls and export',()=>{
 for(const key of ['id="searchInput"','id="priorityFilter"','id="statusFilter"','id="taskModules"',
  'id="taskDetail"','id="dataBundle"','id="exportBtn"','id="resetBtn"','id="reqCount"',
  'data-view="tasks"','localStorage.setItem(SK']){
  assert.ok(html.includes(key),'missing feature: '+key);
 }
 assert.match(html,/const D=JSON\.parse\(document\.getElementById\('dataBundle'\)/);
 assert.match(html,/<meta name="viewport"/);
 assert.match(html,/@media\(max-width:760px\)/);
 assert.ok(!html.includes('id="navCount">390'));
});
