import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import ts from 'typescript';
import {ABSENCE_REASONS,prepareAbsence,canReportShift,absenceStatus} from '../web/live/shift-absence.js';
import {createPlanningController} from '../web/live/planning.js';

const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=Date.now(),start=new Date(now+86400000).toISOString(),end=new Date(now+2*86400000).toISOString();
const shift={id:'shift-a',company_id:'company-a',worker_id:'worker-a',user_id:'user-a',location_id:'site-a',department_id:null,
 starts_at:start,ends_at:end,timezone:'America/Toronto',version:3,note:''};
const ent={title:'Plus',features:['advanced_schedules','shift_swaps','availability']};
function setup(role='employee',user='user-a',own='worker-a'){
 const w=new Window();w.confirm=()=>true;w.document.body.innerHTML='<main></main>';
 const calls=[],notifications=[],reports=[];
 const sb={
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='essential_entitlements')return {data:ent};
   if(name==='essential_team_roster')return {data:[{id:'worker-a',name:'Employé A',status:'active'}]};
   if(name==='essential_swap_options')return {data:[]};
   if(name==='list_essential_shift_absences')return {data:reports};
   if(name==='report_essential_shift_absence'){
    if(reports.length)return {data:{id:reports[0].id,status:reports[0].status,duplicate:true}};
    reports.push({id:'report-a',shift_id:shift.id,worker_id:shift.worker_id,status:'reported'});
    notifications.push('manager');
    return {data:{id:'report-a',status:'reported',duplicate:false}};
   }
   if(name==='review_essential_shift_absence'){
    reports[0].status=args.p_decision;notifications.push('worker');
    return {data:{id:reports[0].id,status:reports[0].status,duplicate:false}};
   }
   if(name==='personal_calendar_feed_status')return {data:{active:false}};
   return {data:[]};
  },
  from(table){
   const query={select(){return query},eq(){return query},gt(){return query},lt(){return query},order(){return query},limit(){return query},
    then(resolve){return Promise.resolve({data:table==='scheduled_shifts'?[shift]:table==='essential_locations'?[{id:'site-a',name:'Atelier',active:true,timezone:'America/Toronto'}]:[],error:null}).then(resolve)}};
   return query;
  }
 };
 const ui=createPlanningController({sb,redraw(){},notify(){},escape,document:w.document,exportIcs(){}});
 Object.assign(ui.state,{company:'company-a',role,user,own,entitlement:ent,locations:[{id:'site-a',name:'Atelier',active:true,timezone:'America/Toronto'}],
  roster:[{id:'worker-a',name:'Employé A',status:'active'}],shifts:[shift],absences:reports,absenceUnavailable:false});
 return {ui,w,calls,notifications,reports};
}

test('exactly nine reasons, none preselected, optional private note and bounds',()=>{
 assert.equal(ABSENCE_REASONS.length,9);
 assert.equal(prepareAbsence('undisclosed','').p_note,'');
 assert.equal(prepareAbsence('other','').p_note,'');
 assert.throws(()=>prepareAbsence('', ''),/motif/);
 assert.throws(()=>prepareAbsence('medical_appointment','x'.repeat(401)),/400/);
 assert.equal(prepareAbsence('personal',' <private> ').p_note,'<private>');
});
test('only own active future shift is reportable, and not a second time',()=>{
 assert.equal(canReportShift(shift,'worker-a',null,now),true);
 assert.equal(canReportShift(shift,'worker-b',null,now),false);
 assert.equal(canReportShift(shift,'worker-a',{id:'existing'},now),false);
 assert.equal(canReportShift({...shift,cancelled_at:start},'worker-a',null,now),false);
 assert.equal(canReportShift({...shift,ends_at:new Date(now-1).toISOString()},'worker-a',null,now),false);
 assert.match(absenceStatus('follow_up'),/communiquera/);
});
test('employee confirms a specific shift; manager responds and employee sees status without reason',async()=>{
 const {ui,w,calls,reports,notifications}=setup();
 assert.match(ui.renderSchedule(),/Signaler mon absence/);
 await ui.handle({dataset:{action:'ess:plan-absence-open',id:shift.id}});
 w.document.body.innerHTML=ui.renderSchedule();
 assert.equal(w.document.querySelector('#plan-absenceReason').value,'');
 w.document.querySelector('#plan-absenceReason').value='undisclosed';
 w.document.querySelector('#plan-absenceNote').value='<private>';
 await ui.handle({dataset:{action:'ess:plan-absence-report',id:shift.id}});
 const submitted=calls.filter(c=>c.name==='report_essential_shift_absence');
 assert.equal(submitted.length,1);
 assert.equal(submitted[0].args.p_shift,shift.id);
 assert.equal(submitted[0].args.p_expected_version,3);
 assert.equal(submitted[0].args.p_reason,'undisclosed');
 assert.equal(submitted[0].args.p_note,'<private>');
 assert.equal(notifications[0],'manager');
 assert.match(ui.renderSchedule(),/en attente de prise en charge/);
 assert.doesNotMatch(ui.renderSchedule(),/private/);
 ui.state.role='boss';ui.state.user='boss';ui.state.own='boss-worker';
 assert.match(ui.renderSchedule(),/Pris en charge/);
 await ui.handle({dataset:{action:'ess:plan-absence-review',id:'report-a',decision:'follow_up'}});
 assert.equal(reports[0].status,'follow_up');
 assert.equal(notifications[1],'worker');
 ui.state.role='employee';ui.state.user='user-a';ui.state.own='worker-a';
 assert.match(ui.renderSchedule(),/communiquera avec vous/);
 assert.equal(calls.filter(x=>/punch|leave|shift_change/.test(x.name)).length,0);
 await w.happyDOM.close();
});
test('colleague cannot report another worker shift or view sensitive fields',async()=>{
 const {ui,w}=setup('employee','user-b','worker-b');
 const html=ui.renderSchedule();
 assert.doesNotMatch(html,/Signaler mon absence|private_note|reason_code/);
 assert.match(html,/Employé A/);
 assert.equal(w.document.querySelector('#plan-absenceNote'),null);
 await w.happyDOM.close();
});
test('native and web both use shared reasons and protected server RPC paths',()=>{
 const native=readFileSync(new URL('../src/workforce/EssentialPlanningPanel.tsx',import.meta.url),'utf8');
 const web=readFileSync(new URL('../web/live/planning.js',import.meta.url),'utf8');
 assert.equal(ts.createSourceFile('EssentialPlanningPanel.tsx',native,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0);
 for(const src of [native,web]){
  assert.match(src,/report_essential_shift_absence/);
  assert.match(src,/review_essential_shift_absence/);
  assert.match(src,/list_essential_shift_absences/);
  assert.match(src,/prepareAbsence/);
 }
});
test('migration preserves private notes; no automatic shift reassign/punch/offer',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261026163000_essential_shift_absences.sql',import.meta.url),'utf8');
 assert.match(sql,/create table private\.essential_shift_absences/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on private\.essential_shift_absences from public,anon,authenticated/);
 assert.match(sql,/unique \(company_id,shift_id\)/);
 assert.match(sql,/for update/);
 assert.match(sql,/private\.is_member\(s\.company_id\)/);
 assert.match(sql,/private\.is_manager\(a\.company_id\)/);
 assert.doesNotMatch(sql,/update public\.scheduled_shifts|insert into public\.essential_shift_requests/i);
 assert.doesNotMatch(sql,/jsonb_build_object\([^;]*?reason_code/i);
});
