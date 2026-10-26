import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../web/live/suivi.html',import.meta.url),'utf8');
const script=html.match(/<script type="application\/json" id="dataBundle">([\s\S]*?)<\/script>/);
if(!script)throw Error('Data bundle missing');
const data=JSON.parse(script[1]);

test('visual tracker has exactly 578 uniquely identified requirements in 29 master lots',()=>{
 assert.equal(data.total_requirements,578);
 assert.equal(data.sections.length,29);
 const tasks=data.sections.flatMap(s=>s.tasks);
 assert.equal(tasks.length,578);
 assert.equal(new Set(tasks.map(t=>t.id)).size,578);
 for(const s of data.sections){
  assert.equal(s.total,s.tasks.length,'mismatched count for '+s.code);
  assert.ok(s.tasks.every(t=>t.id.startsWith(s.code+'-')));
 }
 assert.deepEqual(Object.fromEntries(['P0','P1','P2','P3','P4'].map(p=>[p,
  data.sections.filter(s=>s.priority===p).reduce((sum,s)=>sum+s.tasks.length,0)])),
 {P0:164,P1:140,P2:220,P3:43,P4:11});
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

test('links to verified PRs and open provider/device QA issues are visible',()=>{
 for(const n of [104,106,108,109,110]){
  assert.ok(html.includes('https://github.com/punch360app/Punch360/pull/'+n),'missing PR '+n);
 }
 for(const n of [35,102]){
  assert.ok(html.includes('https://github.com/punch360app/Punch360/issues/'+n));
 }
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
