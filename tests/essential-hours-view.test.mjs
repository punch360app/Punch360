import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {essentialHoursView} from '../web/live/essential-hours-view.js';

const at=Date.parse('2026-11-04T15:00:00Z');
const company='company-A',user='employee-A';
const sessions=[
 {id:'day-1',company_id:company,user_id:user,started_at:'2026-11-04T10:00:00Z',ended_at:'2026-11-04T12:00:00Z'},
 {id:'day-2',company_id:company,user_id:user,started_at:'2026-11-04T14:00:00Z',ended_at:null},
 {id:'other-company',company_id:'company-B',user_id:user,started_at:'2026-11-04T08:00:00Z',ended_at:null},
 {id:'other-person',company_id:company,user_id:'another-user',started_at:'2026-11-04T08:00:00Z',ended_at:null}
];
const segments=[
 {session_id:'day-1',company_id:company,started_at:'2026-11-04T10:00:00Z',ended_at:'2026-11-04T12:00:00Z'},
 {session_id:'day-2',company_id:company,started_at:'2026-11-04T14:00:00Z',ended_at:null},
 {session_id:'other-company',company_id:'company-B',started_at:'2026-11-04T08:00:00Z',ended_at:null},
 {session_id:'other-person',company_id:company,started_at:'2026-11-04T08:00:00Z',ended_at:null}
];
const breaks=[
 {session_id:'day-1',company_id:company,is_paid:false,started_at:'2026-11-04T11:00:00Z',ended_at:'2026-11-04T11:15:00Z'},
 {session_id:'day-1',company_id:company,is_paid:true,started_at:'2026-11-04T11:20:00Z',ended_at:'2026-11-04T11:30:00Z'},
 {session_id:'other-person',company_id:company,is_paid:false,started_at:'2026-11-04T08:00:00Z',ended_at:null}
];
const fixture={companyId:company,userId:user,snapshotCompanyId:company,snapshot:{sessions,segments,breaks},now:at};

test('the employee sees only current-company server sessions and net weekly time',()=>{
 const view=essentialHoursView(fixture);
 assert.equal(view.ready,true);
 assert.deepEqual(view.confirmedSessions.map(x=>x.id),['day-2','day-1']);
 assert.equal(view.confirmedWeekMs,(2*60+60-15)*60000);
 assert.equal(view.projectedWeekMs,null);
 assert.equal(view.hasPending,false);
});

test('pending journal time is visibly separate from server-sourced time',()=>{
 const local={id:'local-1',company_id:company,user_id:user,started_at:'2026-11-04T13:00:00Z',ended_at:'2026-11-04T14:00:00Z'};
 const view=essentialHoursView({...fixture,pendingCount:1,projectedSessions:[...sessions,local],
  projectedSegments:[...segments,{session_id:'local-1',company_id:company,started_at:local.started_at,ended_at:local.ended_at}],
  projectedBreaks:breaks});
 assert.equal(view.confirmedWeekMs,(3*60-15)*60000);
 assert.equal(view.projectedWeekMs,(4*60-15)*60000);
 assert.equal(view.confirmedSessions.some(x=>x.id==='local-1'),false);
 assert.equal(view.pending,1);
});

test('an open day stops accumulating confirmed time at the last complete server read',()=>{
 const fetchedAt=Date.parse('2026-11-04T14:30:00Z');
 const v=essentialHoursView({...fixture,snapshotFetchedAt:fetchedAt,
  now:Date.parse('2026-11-04T21:00:00Z')});
 assert.equal(v.confirmedWeekMs,(2*60+30-15)*60000);
 assert.deepEqual(v.confirmedDays.map(x=>({id:x.session.id,minutes:x.netMs/60000,open:x.open})),[
  {id:'day-2',minutes:30,open:true},
  {id:'day-1',minutes:105,open:false}
 ]);
 const capped=essentialHoursView({...fixture,snapshotFetchedAt:at-15*60000,
  now:at+500000});
 assert.equal(capped.confirmedWeekMs,(2*60+45-15)*60000);
});

test('a pending local punch remains an explicitly separate estimate beyond server cutoff',()=>{
 const earlier=Date.parse('2026-11-04T14:15:00Z');
 const view=essentialHoursView({...fixture,snapshotFetchedAt:earlier,pendingCount:1,
  projectedSessions:sessions,projectedSegments:segments,projectedBreaks:breaks});
 assert.equal(view.confirmedWeekMs,(2*60+15-15)*60000);
 assert.equal(view.projectedWeekMs,(2*60+60-15)*60000);
});

test('missing or mismatched confirmed company snapshot fails closed',()=>{
 for(const args of [
  {...fixture,snapshotCompanyId:'company-B'},
  {...fixture,snapshotCompanyId:null},
  {...fixture,snapshot:{sessions,segments}},
  {...fixture,snapshot:null},
  {...fixture,userId:null},
  {...fixture,now:NaN}
 ]){
  const view=essentialHoursView({...args,pendingCount:2});
  assert.equal(view.ready,false);
  assert.equal(view.confirmedWeekMs,0);
  assert.deepEqual(view.confirmedSessions,[]);
  assert.equal(view.projectedWeekMs,null);
 }
});

test('unpaid pauses and invalid timestamps cannot generate negative or cross-user hours',()=>{
 const snapshot={sessions:[{id:'s',company_id:company,user_id:user,started_at:'2026-11-04T10:00:00Z',ended_at:'2026-11-04T10:30:00Z'}],
  segments:[{session_id:'s',company_id:company,started_at:'2026-11-04T10:00:00Z',ended_at:'2026-11-04T10:30:00Z'},
   {session_id:'unknown',company_id:company,started_at:'2026-11-04T00:00:00Z',ended_at:null},
   {session_id:'s',company_id:company,started_at:'bad',ended_at:null}],
  breaks:[{session_id:'s',company_id:company,is_paid:false,started_at:'2026-11-04T09:00:00Z',ended_at:'2026-11-04T11:00:00Z'}]};
 const view=essentialHoursView({...fixture,snapshot});
 assert.equal(view.confirmedWeekMs,0,'the net display must not show negative paid hours');
 assert.equal(view.confirmedSessions.length,1);
});

test('Essentiel hours UI does not export projected local events as the server CSV',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/function essentialHours\(\)\{/);
 assert.match(app,/const view=essentialHoursView\(\{/);
 assert.match(app,/snapshotCompanyId:state\.serverPunchCompany,snapshot:state\.serverPunch/);
 assert.match(app,/view\.confirmedDays\.slice\(0,80\)/);
 assert.match(app,/événement\(s\) conservé\(s\) sur cet appareil/);
 assert.match(app,/Exporter le relevé serveur CSV/);
 assert.match(app,/snapshotFetchedAt:state\.serverPunchFetchedAt/);
 assert.match(app,/\+mins\(netMs\)\+' net'/);

 assert.match(app,/!calls\[2\]\.error&&!calls\[21\]\.error&&!errors\.some\(x=>x\.startsWith\('segments:'\)\)/);
 assert.match(app,/serverPunchFetchedAt=Date\.now\(\)/);
 assert.match(app,/Number\.isFinite\(data\.serverPunchFetchedAt\)/);
 assert.match(app,/DERNIER RELEVÉ SERVEUR REÇU/);
 assert.match(app,/une lecture réseau incomplète peuvent manquer/);
 assert.match(app,/if\(scope\.ownOnly\)q=q\.eq\('punch_sessions\.user_id',scope\.userId\)/);
});
