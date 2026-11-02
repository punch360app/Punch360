import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {currentOpenPunchBreak} from '../web/live/active-punch-break.js';

const company='tenant-A',user='employee-A';
const active={id:'session-1',company_id:company,user_id:user,ended_at:null};
const pause=(id,session_id='session-1',company_id=company,user_id=user,ended_at=null)=>({
 id,session_id,company_id,user_id,started_at:'2026-11-01T12:00:00Z',ended_at
});

test('finds an open unpaid break owned by the current authenticated employee',()=>{
 assert.deepEqual(currentOpenPunchBreak(company,user,active,[
  pause('foreign','session-2','tenant-B','someone-else'),
  pause('mine')
 ]),pause('mine'));
});

test('a foreign user or company cannot switch pause action or UI',()=>{
 for(const candidate of [
  pause('other-company','session-1','tenant-B',user),
  pause('other-person','session-1',company,'employee-B'),
  pause('wrong-session','session-2',company,user),
  pause('ended','session-1',company,user,'2026-11-01T12:10:00Z')
 ])assert.equal(currentOpenPunchBreak(company,user,active,[candidate]),null);
});

test('a closed or missing session does not resume a break',()=>{
 assert.equal(currentOpenPunchBreak(company,user,null,[pause('mine')]),null);
 assert.equal(currentOpenPunchBreak(company,user,{...active,ended_at:'2026-11-01T12:05:00Z'},[pause('mine')]),null);
 assert.equal(currentOpenPunchBreak('tenant-B',user,active,[pause('mine')]),null);
 assert.equal(currentOpenPunchBreak(company,'employee-B',active,[pause('mine')]),null);
});

test('invalid or mixed snapshot data fails closed',()=>{
 for(const entries of [null,undefined,{},[null,42,'legacy'],[pause('mine',null)]])
  assert.equal(currentOpenPunchBreak(company,user,active,entries),null);
});

test('the employee home and pause button use exactly the same scoped break selection',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/import \{currentOpenPunchBreak\} from '\.\/active-punch-break\.js';/);
 assert.match(app,/function activeBreak\(\)\{return currentOpenPunchBreak\(company\(\),state\.user\?\.id,currentSession\(\),state\.breaks\)\}/);
 assert.match(app,/const active=currentSession\(\),pause=activeBreak\(\)/);
 assert.match(app,/locatedPunch\(activeBreak\(\)\?'break_end':'break_start',null,paid\)/);
 assert.doesNotMatch(app,/state\.breaks\.find\(b=>!b\.ended_at\)/);
 assert.doesNotMatch(app,/state\.breaks\.some\(b=>!b\.ended_at\)/);
});
