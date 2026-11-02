import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canUseEssentialMobilePunch,essentialMobilePunchNotice,lastConfirmedKioskPunch,resolveEssentialPunchJob,firstEssentialPunchGuidance} from '../web/live/essential-mobile-punch.js';
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

test('first mobile punch requires the exact active workplace in the current company',()=>{
 const jobs=[
  {id:'site-1',company_id:'A',active:true,name:'Atelier central'},
  {id:'site-2',company_id:'B',active:true,name:'Autre compagnie'},
  {id:'site-3',company_id:'A',active:false,name:'Fermé'}
 ];
 assert.equal(resolveEssentialPunchJob('A','site-1',jobs),jobs[0]);
 for(const id of ['site-2','site-3','missing',null]){
  assert.equal(resolveEssentialPunchJob('A',id,jobs),null);
 }
 assert.equal(resolveEssentialPunchJob('A','site-2',jobs.slice(1)),null);
 assert.equal(resolveEssentialPunchJob('A','site-1',null),null);
 assert.equal(resolveEssentialPunchJob('B','site-1',jobs),null);
});

test('first punch guidance uses acknowledged company sessions and never optimistic offline events',()=>{
 const job={id:'site-1',company_id:'A',active:true};
 const first=(company,snapshotCompany,record,snapshot,pending,workplace)=>
  firstEssentialPunchGuidance(company,'u',record,snapshotCompany,snapshot,pending,workplace);
 const empty={sessions:[]};
 assert.equal(first('A','A',worker,empty,0,job),'ready');
 assert.equal(first('A','A',worker,empty,0,null),'missing-workplace');
 assert.equal(first('A','A',worker,empty,1,job),null);
 assert.equal(first('A','B',worker,empty,0,job),null);
 assert.equal(first('A','A',worker,{sessions:[{user_id:'u'}]},0,job),null);
 assert.equal(first('A','A',worker,{sessions:[{user_id:'other'}]},0,job),'ready');
 assert.equal(first('A','A',{...worker,can_mobile_punch:false},empty,0,job),null);
 assert.equal(first('A','A',{...worker,company_id:'B'},empty,0,job),null);
 assert.equal(first('A','A',worker,{sessions:null},0,job),null);
 assert.equal(first('A','A',worker,empty,undefined,job),null);
});

test('public first-punch action does not fall back to a selected unrelated Job',()=>{
 assert.match(app,/resolveEssentialPunchJob\(company\(\),activeJobId,state\.jobs\)/);
 assert.match(app,/firstEssentialPunchGuidance\(company\(\),state\.user\?\.id,essentialUI\.state\.worker,state\.serverPunchCompany,state\.serverPunch,state\.localPending,punchWorkplace\)/);
 assert.match(app,/state\.busy\|\|mobile&&!punchWorkplace\?'disabled aria-disabled="true"'/);
 assert.match(app,/if\(!j\)\{if\(isEssential\(\)\)toast\('Aucun établissement actif confirmé/);
 assert.doesNotMatch(app,/getJob\(essentialPunchJob\(\)\)\|\|selectedJob\(\)/);
 assert.match(app,/Votre premier PUNCH IN/);
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
