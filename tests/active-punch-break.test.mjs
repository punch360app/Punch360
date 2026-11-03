import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {currentOpenPunchBreak,currentPunchBreakState} from '../web/live/active-punch-break.js';

const company='tenant-A',user='employee-A';
const active={id:'session-1',company_id:company,user_id:user,ended_at:null};
const pause=(id,session_id='session-1',company_id=company,user_id=user,ended_at=null)=>({
 id,session_id,company_id,user_id,started_at:'2026-11-01T12:00:00Z',ended_at
});

test('finds a unique open break owned by the current authenticated employee',()=>{
 const mine=pause('mine');
 assert.deepEqual(currentOpenPunchBreak(company,user,active,[
  pause('foreign','session-2','tenant-B','someone-else'),mine
 ]),mine);
 assert.deepEqual(currentPunchBreakState(company,user,active,[mine]),{
  status:'open',break:mine
 });
});

test('a foreign user or company cannot switch pause action or UI',()=>{
 for(const candidate of [
  pause('other-company','session-1','tenant-B',user),
  pause('other-person','session-1',company,'employee-B'),
  pause('wrong-session','session-2',company,user),
  pause('ended','session-1',company,user,'2026-11-01T12:10:00Z')
 ]){
  assert.equal(currentOpenPunchBreak(company,user,active,[candidate]),null);
  assert.deepEqual(currentPunchBreakState(company,user,active,[candidate]),{
   status:'none',break:null
  });
 }
});

test('two open breaks for the same worker and session cannot be chosen by order',()=>{
 for(const entries of [
  [pause('first'),pause('second')],
  [pause('second'),pause('first')],
  [pause('same'),pause('same')]
 ]){
  assert.deepEqual(currentPunchBreakState(company,user,active,entries),{
   status:'ambiguous',break:null
  });
  assert.equal(currentOpenPunchBreak(company,user,active,entries),null);
 }
});

test('foreign and ended pauses do not hide or create a scoped ambiguity',()=>{
 const mine=pause('mine');
 const foreign=pause('other-tenant','session-1','tenant-B',user);
 const anotherUser=pause('other-user','session-1',company,'employee-B');
 const ended=pause('ended','session-1',company,user,'2026-11-01T12:10:00Z');
 assert.deepEqual(currentPunchBreakState(company,user,active,[
  foreign,ended,mine,anotherUser
 ]),{status:'open',break:mine});
 assert.deepEqual(currentPunchBreakState(company,user,active,[
  pause('second'),foreign,ended,mine,anotherUser
 ]),{status:'ambiguous',break:null});
});

test('an open scoped pause without a usable id cannot trigger a new pause',()=>{
 for(const id of [null,undefined,'',123]){
  assert.deepEqual(currentPunchBreakState(company,user,active,[pause(id)]),{
   status:'ambiguous',break:null
  });
  assert.deepEqual(currentPunchBreakState(company,user,active,[pause('valid'),pause(id)]),{
   status:'ambiguous',break:null
  });
 }
});

test('closed, missing, unrelated or unverified session is never authorized',()=>{
 assert.equal(currentOpenPunchBreak(company,user,null,[pause('mine')]),null);
 assert.equal(currentOpenPunchBreak(company,user,{...active,ended_at:'2026-11-01T12:05:00Z'},[pause('mine')]),null);
 assert.equal(currentOpenPunchBreak('tenant-B',user,active,[pause('mine')]),null);
 assert.equal(currentOpenPunchBreak(company,'employee-B',active,[pause('mine')]),null);
 for(const entries of [null,undefined,{}])
  assert.equal(currentPunchBreakState(company,user,active,entries).status,'unavailable');
});

test('invalid or mixed snapshot data fails closed',()=>{
 for(const entries of [null,undefined,{},[null,42,'legacy'],[pause('mine',null)]])
  assert.equal(currentOpenPunchBreak(company,user,active,entries),null);
});

test('employee home uses a unique scoped pause; action blocks ambiguous or unavailable state',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/import \{currentOpenPunchBreak,currentPunchBreakState\} from '\.\/active-punch-break\.js';/);
 assert.match(app,/function activeBreak\(\)\{return currentOpenPunchBreak\(company\(\),state\.user\?\.id,currentSession\(\),state\.breaks\)\}/);
 assert.match(app,/const active=currentSession\(\),pause=activeBreak\(\)/);
 const start=app.indexOf('async function doPause(paid=false){');
 const end=app.indexOf('\nfunction breakApprovals()',start);
 assert.ok(start>=0&&end>start);
 const action=app.slice(start,end);
 assert.match(action,/const breakState=currentPunchBreakState\(company\(\),state\.user\?\.id,session,state\.breaks\)/);
 assert.match(action,/if\(breakState\.status==='ambiguous'\|\|breakState\.status==='unavailable'\)/);
 assert.match(action,/locatedPunch\(breakState\.break\?'break_end':'break_start',null,paid\)/);
 assert.ok(action.indexOf("if(breakState.status==='ambiguous'")<action.indexOf('state.busy=true'));
 assert.ok(action.indexOf("if(breakState.status==='ambiguous'")<action.indexOf('locatedPunch('));
 assert.doesNotMatch(action,/locatedPunch\(activeBreak\(\)/);
 assert.doesNotMatch(app,/state\.breaks\.find\(b=>!b\.ended_at\)/);
 assert.doesNotMatch(app,/state\.breaks\.some\(b=>!b\.ended_at\)/);
});
