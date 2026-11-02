import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canUseEssentialMobilePunch,essentialMobilePunchNotice,lastConfirmedKioskPunch,resolveEssentialPunchJob,resolveEssentialMobilePunchAction,firstEssentialPunchGuidance,essentialWorkerPunchJobId} from '../web/live/essential-mobile-punch.js';
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

test('assigned worker location has priority over default and must be active in the same company',()=>{
 const locations=[
  {id:'loc-1',company_id:'A',punch_job_id:'site-1',active:true},
  {id:'loc-2',company_id:'B',punch_job_id:'foreign',active:true},
  {id:'loc-3',company_id:'A',punch_job_id:'closed',active:false}
 ];
 assert.equal(essentialWorkerPunchJobId('A',{location_id:'loc-1'},locations,'default'),'site-1');
 assert.equal(essentialWorkerPunchJobId('A',{location_id:'loc-2'},locations,'default'),null);
 assert.equal(essentialWorkerPunchJobId('A',{location_id:'loc-3'},locations,'default'),null);
 assert.equal(essentialWorkerPunchJobId('A',{location_id:'unknown'},locations,'default'),null);
 assert.equal(essentialWorkerPunchJobId('A',{location_id:'loc-1'},null,'default'),null);
 assert.equal(essentialWorkerPunchJobId('A',{location_id:null},locations,'default'),'default');
 assert.equal(essentialWorkerPunchJobId('A',{},locations,'default'),'default');
 assert.equal(essentialWorkerPunchJobId('A',null,locations,'default'),'default');
 assert.equal(essentialWorkerPunchJobId('A',{location_id:'loc-1'},[{id:'loc-1',company_id:'A',punch_job_id:'site-1'}],'default'),null);
});

test('a valid open employee segment can PUNCH OUT even if its establishment was deactivated',()=>{
 const session={id:'session-1',company_id:'A',user_id:'u',ended_at:null};
 const segment={id:'segment-1',company_id:'A',session_id:'session-1',job_id:'closed-workplace',ended_at:null};
 for(const jobs of [[],null,[{id:'closed-workplace',company_id:'A',active:false}]]){
  assert.deepEqual(resolveEssentialMobilePunchAction('A','u',session,[segment],'default-workplace',jobs),
   {action:'out',jobId:null},'OUT sends null job: SQL uses the open server segment');
 }
 assert.deepEqual(resolveEssentialMobilePunchAction('A','u',null,[],
  'live-workplace',[{id:'live-workplace',company_id:'A',active:true}]),
  {action:'in',jobId:'live-workplace'});
 for(const jobs of [[],[{id:'closed-workplace',company_id:'A',active:false}]]){
  assert.equal(resolveEssentialMobilePunchAction('A','u',null,[],
   'closed-workplace',jobs),null,'IN still requires an active current-company workplace');
 }
});

test('an open session must match this exact worker and have exactly one matching open segment',()=>{
 const session={id:'session-1',company_id:'A',user_id:'u',ended_at:null};
 const segment={id:'segment-1',company_id:'A',session_id:session.id,job_id:'closed-workplace',ended_at:null};
 const resolve=(s,segments)=>resolveEssentialMobilePunchAction('A','u',s,segments,'any',[]);
 assert.deepEqual(resolve(session,[segment]),{action:'out',jobId:null});
 for(const s of [{...session,user_id:'other'},{...session,company_id:'B'},
  {...session,ended_at:'2026-11-01T12:00:00Z'},
  {...session,id:null}]){
  assert.equal(resolve(s,[segment]),null);
 }
 for(const segments of [[{...segment,company_id:'B'}],
  [{...segment,session_id:'other'}],[{...segment,ended_at:'2026-11-01T12:00:00Z'}],
  [{...segment,job_id:null}],[segment,segment],[],null]){
  assert.equal(resolve(session,segments),null);
 }
 assert.equal(resolveEssentialMobilePunchAction('B','u',session,[segment],'any',[]),null);
 assert.equal(resolveEssentialMobilePunchAction('A','other',session,[segment],'any',[]),null);
 assert.equal(resolveEssentialMobilePunchAction('', 'u',session,[segment],'any',[]),null);
});

test('the mobile home and event submission use the same OUT guard and send no stale job',()=>{
 assert.match(app,/const punchAction=resolveEssentialMobilePunchAction\(company\(\),state\.user\?\.id,currentSession\(\),state\.segments,essentialPunchJob\(\),state\.jobs\)/);
 assert.match(app,/punchAction=isEssential\(\)\?resolveEssentialMobilePunchAction\(company\(\),state\.user\?\.id,active,state\.segments,essentialPunchJob\(\),state\.jobs\)/);
 assert.match(app,/state\.busy\|\|mobile&&!punchAction\?'disabled aria-disabled="true"'/);
 assert.match(app,/locatedPunch\(active\?'out':'in',isEssential\(\)\?punchAction\.jobId:j\.id\)/);
 assert.match(app,/Le pointage ouvert ne peut pas être vérifié/);
 const sql=readFileSync(new URL('../supabase/migrations/20261024124016_punch_geofence_review.sql',import.meta.url),'utf8');
 assert.match(sql,/if p_action='out' then[\s\S]*?select ps\.job_id into v_job[\s\S]*?v_session:=public\.punch_out\(p_company\)/);
 assert.match(sql,/select \* into j from public\.jobs where company_id=p_company and id=v_job/);
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
 assert.match(app,/state\.busy\|\|mobile&&!punchAction\?'disabled aria-disabled="true"'/);
 assert.match(app,/if\(isEssential\(\)&&!punchAction\)\{toast\(active\?/);
 assert.doesNotMatch(app,/getJob\(essentialPunchJob\(\)\)\|\|selectedJob\(\)/);
 assert.match(app,/Votre premier PUNCH IN/);
 assert.match(app,/function essentialPunchJob\(\)\{return essentialWorkerPunchJobId\(company\(\),essentialUI\.state\.worker,essentialUI\.planning\.state\.locations,state\.account\?\.companies\?\.default_punch_job_id\);\}/);
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
