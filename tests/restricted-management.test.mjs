import test from 'node:test';
import assert from 'node:assert/strict';
import {isRestrictedManagement, canUseRestrictedManagement} from '../web/live/restricted-management.js';

const account=(status,role='boss',edition='essential')=>({role,companies:{product_edition:edition,billing_status:status}});
const permit=(action,id='',role='boss',section='home',sub='')=>canUseRestrictedManagement({action,id,role,section,sub});

test('suspension platform effective status prevails over stale company billing_status',()=>{
  assert.equal(isRestrictedManagement(account('active'),{status:'restricted'}),true);
  assert.equal(isRestrictedManagement(account('restricted'),{status:'active'}),false);
  assert.equal(isRestrictedManagement(account('cancelled')),true);
  assert.equal(isRestrictedManagement(account('grace')),false);
  assert.equal(isRestrictedManagement(account('active')),false);
  assert.equal(isRestrictedManagement(account('restricted','boss','construction')),false);
});
test('restricted Boss still has access to billing, support, personal punch and refresh',()=>{
  for(const [action,id] of [['navigate','home'],['navigate','punch'],['navigate','management'],['subpage','billing'],['subpage','support'],['refresh',''],['logout','']])
    assert.equal(permit(action,id),true,action+':'+id);
  assert.equal(permit('bill:quote','','boss','sub','billing'),true);
  assert.equal(permit('support:create','','boss','sub','support'),true);
});
test('restricted management refuses unrelated routes, synthetic button calls and employees',()=>{
  for(const action of ['subpage','navigate']){
    for(const id of ['members','payroll','laborBudgets','qualifiedCoverage','invitations','companyHours','approvals','archives','notifications','messages','settings'])
      assert.equal(permit(action,id),false,action+':'+id);
  }
  for(const action of ['ess:create-worker','qualified:save','budget:save','support:create','bill:confirm','punch','createJob','scheduleShift'])
    assert.equal(permit(action),false,action);
  assert.equal(permit('subpage','billing','admin'),false);
  assert.equal(permit('navigate','punch','admin'),false);
  assert.equal(permit('subpage','support','admin'),true);
  assert.equal(permit('support:create','','admin','sub','support'),true);
  assert.equal(permit('bill:confirm','','admin','sub','billing'),false);
});
