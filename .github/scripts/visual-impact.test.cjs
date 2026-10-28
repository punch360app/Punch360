const {test}=require('node:test');
const assert=require('node:assert/strict');
const {classify,SAFE_HELPERS}=require('./visual-impact.cjs');
test('pure business logic alone uses safe fast PR path',()=>{
 for(const file of SAFE_HELPERS)assert.equal(classify([file]).mode,'fast',file);
 assert.equal(classify(['web/live/mission-recurrence.js','tests/mission-recurrence.test.mjs']).mode,'fast');
});
test('UI, CSS, auth, finance, policies, visuals and unknown sources always run 24 captures',()=>{
 const risky=[
  'web/live/missions.js','web/live/app.js','web/live/styles.css',
  'web/live/index.html','web/live/essential.js','web/live/mission-issue-decision.js',
  'src/auth/deviceIdentityGate.ts','supabase/migrations/202610280001.sql',
  '.github/workflows/visual-review.yml','.github/scripts/visual-capture.cjs',
  '.github/scripts/visual-impact.cjs','visual-baselines/manifest.json',
  'package-lock.json','web/live/new-helper.js','web/live/favicon.svg'
 ];
 for(const file of risky)assert.equal(classify(['web/live/mission-recurrence.js',file]).mode,'full',file);
});
test('untrusted, missing or ambiguous changes fail closed',()=>{
 for(const list of [[],null,undefined,[''],['../web/live/mission-recurrence.js'],
   ['web/live/mission-recurrence.js\nweb/live/styles.css'],
   ['web/live/mission-recurrence.js '],['tests/test.test.mjs']])
  assert.equal(classify(list).mode,'full',JSON.stringify(list));
});
test('full visual review remains mandatory for UI with matching unit tests',()=>{
 assert.equal(classify(['web/live/missions.js','tests/mission-flow.test.mjs']).mode,'full');
 assert.equal(classify(['web/live/mission-recurrence.js','web/live/missions.js',
   'tests/mission-recurrence.test.mjs']).mode,'full');
});
