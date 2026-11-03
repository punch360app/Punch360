import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {currentOpenPunchBreak,currentPunchBreakState,hasConflictingOpenPunchBreak} from '../web/live/active-punch-break.js';

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

test('invalid scoped open break blocks home and action without clearing cached rows',()=>{
 const invalid=pause(null);
 assert.deepEqual(currentPunchBreakState(company,user,active,[invalid]),{status:'ambiguous',break:null});
 assert.equal(currentOpenPunchBreak(company,user,active,[invalid]),null);
 assert.equal(hasConflictingOpenPunchBreak(company,user,active,[invalid]),true);
 assert.equal(currentPunchBreakState(company,user,active,[pause('valid')]).status,'open');
 assert.equal(currentPunchBreakState(company,user,active,null).status,'unavailable');
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
 assert.match(app,/import \{currentOpenPunchBreak,currentPunchBreakState,hasConflictingOpenPunchBreak\} from '\.\/active-punch-break\.js';/);
 assert.match(app,/function activeBreak\(\)\{return currentOpenPunchBreak\(company\(\),state\.user\?\.id,currentSession\(\),state\.breaks\)\}/);
 assert.match(app,/const active=currentSession\(\),pause=activeBreak\(\)/);
 assert.match(app,/locatedPunch\(breakState\.break\?'break_end':'break_start',null,paid\)/);
 assert.doesNotMatch(app,/state\.breaks\.find\(b=>!b\.ended_at\)/);
 assert.doesNotMatch(app,/state\.breaks\.some\(b=>!b\.ended_at\)/);
});

test('two open breaks in one session fail closed instead of selecting the first',()=>{
 const first=pause('first'),second=pause('second');
 const mixed=[pause('other-company','session-1','tenant-B',user),first,
  pause('closed','session-1',company,user,'2026-11-01T12:05:00Z'),second];
 assert.equal(currentOpenPunchBreak(company,user,active,mixed),null);
 assert.equal(hasConflictingOpenPunchBreak(company,user,active,mixed),true);
 assert.equal(hasConflictingOpenPunchBreak(company,user,active,[first]),false);
 assert.equal(hasConflictingOpenPunchBreak(company,user,active,[pause('foreign','session-2','tenant-B',user)]),false);
 assert.equal(hasConflictingOpenPunchBreak(company,user,{...active,ended_at:'2026-11-01T12:20:00Z'},mixed),false);
});

test('Web pause controls and handler block ambiguous local pause state',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/function activeBreakConflict\(\)\{return hasConflictingOpenPunchBreak\(/);
 assert.match(app,/if\(breakState\.status==='ambiguous'\|\|breakState\.status==='unavailable'\)\{/);
 assert.match(app,/pauseConflict\?'disabled aria-disabled="true"'/);
 assert.match(app,/pauseConflict\?'<p class="ess-notice" role="status">État des pauses non vérifiable/);
});
