import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canUseEssentialMobilePunch,essentialMobilePunchNotice,lastConfirmedKioskPunch} from '../web/live/essential-mobile-punch.js';
const worker={company_id:'A',auth_user_id:'u',status:'active',personal_access:true,can_mobile_punch:true};
const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
test('An explicitly authorized, current worker may use mobile punch',()=>{
 assert.equal(canUseEssentialMobilePunch('A','u',worker),true);
 assert.equal(canUseEssentialMobilePunch('A','u',{...worker,can_mobile_punch:false}),false);
});
test('Unknown, disabled, foreign-company and foreign-user workers fail closed',()=>{
 for(const candidate of [null,undefined,{}, {...worker,company_id:'B'}, {...worker,auth_user_id:'v'},
 {...worker,status:'disabled'}, {...worker,can_mobile_punch:undefined},
 {...worker,can_mobile_punch:null}, {...worker,can_mobile_punch:'true'},
 {...worker,personal_access:false}, {...worker,personal_access:null}, {...worker,personal_access:undefined}]){
  assert.equal(canUseEssentialMobilePunch('A','u',candidate),false);
 }
 assert.equal(canUseEssentialMobilePunch('B','u',worker),false);
 assert.equal(canUseEssentialMobilePunch('A',null,worker),false);
 assert.match(essentialMobilePunchNotice({...worker,can_mobile_punch:false}),/borne/);
 assert.match(essentialMobilePunchNotice(null),/non confirmé/);
});
test('All three local entry points block Essentiel mobile punch, without hiding other tabs',()=>{
 assert.match(app,/function essentialMobilePunchAllowed\(\)/);
 assert.match(app,/const mobile=essentialMobilePunchAllowed\(\)/);
 assert.match(app,/hidden disabled aria-disabled="true"/);
 assert.match(app,/async function locatedPunch\(action,job,paid=false\)\{if\(isEssential\(\)&&!essentialMobilePunchAllowed\(\)\)throw new Error/);
 assert.match(app,/async function doPunch\(\)\{if\(isEssential\(\)&&!essentialMobilePunchAllowed\(\)\)/);
 assert.match(app,/async function doPause\(paid=false\)\{if\(isEssential\(\)&&!essentialMobilePunchAllowed\(\)\)/);
 assert.match(app,/function essentialHours\(\)/);
 assert.match(app,/function essentialSchedule\(\)/);
});

test('Kiosk-only home reports only last acknowledged server session for current company and user',()=>{
 const sessions=[{user_id:'u',started_at:'2026-10-31T11:00:00Z',ended_at:'2026-10-31T15:00:00Z'},
  {user_id:'u',started_at:'2026-11-01T12:00:00Z',ended_at:null},
  {user_id:'other',started_at:'2026-11-02T11:00:00Z',ended_at:null}];
 assert.deepEqual(lastConfirmedKioskPunch('A','A','u',{sessions}),{type:'in',at:'2026-11-01T12:00:00Z'});
 assert.equal(lastConfirmedKioskPunch('A','B','u',{sessions}),null);
 assert.equal(lastConfirmedKioskPunch('A',null,'u',{sessions}),null);
 assert.equal(lastConfirmedKioskPunch('A','A','missing',{sessions}),null);
 assert.equal(lastConfirmedKioskPunch('A','A','u',{sessions:[]}),null);
 assert.equal(lastConfirmedKioskPunch('A','A','u',{sessions:[{user_id:'u',started_at:'bad'}]}),null);
 assert.equal(lastConfirmedKioskPunch('A','A','u',{sessions:[{user_id:'u',started_at:'2026-10-30T16:00:00Z',ended_at:'2026-10-30T08:00:00Z'}]}),null);
 assert.deepEqual(lastConfirmedKioskPunch('A','A','u',{sessions:[{user_id:'u',started_at:'2026-10-30T08:00:00Z',ended_at:'2026-10-30T16:00:00Z'}]}),
  {type:'out',at:'2026-10-30T16:00:00Z'});
});
test('Read-only kiosk indicator uses company-bound server data, not projected offline journal',()=>{
 assert.match(app,/state.serverPunchCompany===company\(\)/);
 assert.match(app,/lastConfirmedKioskPunch\(company\(\),state.serverPunchCompany,state.user.id,state.serverPunch\)/);
 assert.match(app,/Dernier pointage confirmé disponible/);
 assert.match(app,/canUseEssentialMobilePunch\(company\(\),state.user\?\.id,essentialUI.state.worker\)/);
 assert.match(app,/\['employee','lead','boss'\]\.includes\(state.account\?\.role\)/);
});
