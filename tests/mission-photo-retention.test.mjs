import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validCleanupItem,cleanupSummary} from '../supabase/functions/mission-photo-retention/cleanup.mjs';
const company='4ff4b1ba-47e2-444b-8805-3f622c8bdced';
const mission='b8d2eb98-ae2e-44a4-b0ca-44062531b8ec';
const id='16531f2d-4206-4f5d-89ec-117ef997725c';
const claim='48e5b44d-d130-4002-8866-14a9cf062486';
const good={company,mission,id,claim,path:company+'/'+mission+'/'+id};
test('strict photo cleanup path rejects other bucket paths and forged company',()=>{
 assert.equal(validCleanupItem(good),true);
 for(const path of ['../outside',company+'/../'+mission+'/'+id,
  company+'/'+mission+'/'+id+'/extra',company+'/'+mission+'/'+claim,'/'])
  assert.equal(validCleanupItem({...good,path}),false);
 assert.equal(validCleanupItem({...good,company:'other'}),false);
 assert.equal(validCleanupItem({...good,id:null}),false);
 assert.equal(validCleanupItem({...good,claim:'not-a-claim'}),false);
});
test('maintenance counts contain no personal path or proof identifiers',()=>{
 assert.deepEqual(cleanupSummary(),{claimed:0,deleted:0,failed:0,invalid:0});
});
