import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {essentialHoursView,employeeHoursRequestTimeline} from '../web/live/essential-hours-view.js';

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
 assert.match(app,/if\(selfOnly\)q=q\.eq\('punch_sessions\.user_id',userId\)/);
});

test('My Hours combines only own company adjustment requests across all three workflows',()=>{
 const correction={id:'hours-1',company_id:company,requested_by:user,status:'pending',
  created_at:'2026-11-01T09:00:00Z'};
 const pause={id:'break-1',company_id:company,requested_by:user,status:'approved',
  created_at:'2026-11-03T09:00:00Z'};
 const missing={id:'missing-1',status:'rejected',startsAt:'2026-10-31T08:00:00Z',
  createdAt:'2026-11-02T09:00:00Z'};
 const result=employeeHoursRequestTimeline({companyId:company,userId:user,
  correctionView:{ready:true,requests:[correction,{...correction,id:'other-hours',requested_by:'else'}]},
  breakView:{ready:true,requests:[pause,{...pause,id:'other-break',company_id:'other'}]},
  missingView:{ready:true,requests:[missing]}});
 assert.equal(result.complete,true);
 assert.deepEqual(result.items.map(x=>x.key),['pauses:break-1','journée:missing-1','heures:hours-1']);
 assert.deepEqual(result.items.map(x=>x.label),['Approuvée','Refusée','En attente']);
 assert.equal(result.pendingCount,1);
 assert.equal(result.unavailable.length,0);
 assert.doesNotMatch(JSON.stringify(result),/other-hours|other-break/);
});
test('a partial HR adjustment read cannot be shown as an empty verified inbox',()=>{
 const base={companyId:company,userId:user,correctionView:{ready:false,requests:[]},
  breakView:{ready:true,requests:[{id:'mine',company_id:company,requested_by:user,
   status:'pending',created_at:'2026-11-01T09:00:00Z'}]},missingView:{ready:false,requests:[]}};
 const v=employeeHoursRequestTimeline(base);
 assert.equal(v.complete,false);
 assert.equal(v.pendingCount,1);
 assert.deepEqual(v.items.map(x=>x.key),['pauses:mine']);
 assert.deepEqual(v.unavailable,['Correction d’heures','Journée oubliée']);
 assert.deepEqual(employeeHoursRequestTimeline({...base,userId:''}),
  {complete:false,pendingCount:0,total:0,items:[],unavailable:[]});
});
test('manager viewing personal hours never receives colleagues pending break requests',()=>{
 const own={id:'own',company_id:company,requested_by:'boss',status:'pending',
  created_at:'2026-11-01T13:00:00Z'};
 const result=employeeHoursRequestTimeline({companyId:company,userId:'boss',
  correctionView:{ready:true,requests:[]},breakView:{ready:true,requests:[
    own,{...own,id:'colleague',requested_by:'colleague'},
    {...own,id:'foreign',company_id:'foreign'}]},missingView:{ready:true,requests:[]}});
 assert.equal(result.complete,true);assert.deepEqual(result.items.map(x=>x.key),['pauses:own']);
});
test('My Hours links every adjustment type and never treats reviewed requests as official payroll',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const begin=app.indexOf('function essentialHours()'),end=app.indexOf('function essentialCorrectionPage()',begin);
 const view=app.slice(begin,end);
 assert.match(app,/import \{essentialHoursView,employeeHoursRequestTimeline\} from '\.\/essential-hours-view\.js'/);
 assert.match(app,/function myRequestsTimeline\(limit=8\)/);
 assert.match(app,/employeeHoursRequestTimeline\(\{companyId,userId,limit/);
 assert.match(view,/myRequestsTimeline\(\)/);
 assert.match(view,/Mes demandes et absences/);
 assert.match(view,/Suivi incomplet/);
 assert.match(view,/Une demande approuvée ne confirme pas, à elle seule, votre paie/);
 for(const target of ['essentialCorrection','breakCorrections','missingDays','leave'])
  assert.match(view,new RegExp('data-id="'+target+'"'));
});

test('My Hours includes only the employee own-company leave requests alongside adjustments',()=>{
 const leave={id:'leave-own',company_id:company,user_id:user,status:'pending',
  begins_on:'2026-11-10',created_at:'2026-11-05T09:00:00Z'};
 const other={...leave,id:'leave-foreign',user_id:'other-person'};
 const crossCompany={...leave,id:'leave-company',company_id:'other-company'};
 const v=employeeHoursRequestTimeline({companyId:company,userId:user,
  correctionView:{ready:true,requests:[]},breakView:{ready:true,requests:[]},
  missingView:{ready:true,requests:[]},
  leaveView:{ready:true,requests:[leave,other,crossCompany]}});
 assert.equal(v.complete,true);
 assert.equal(v.pendingCount,1);
 assert.deepEqual(v.items.map(r=>r.key),['congé:leave-own']);
 assert.deepEqual(v.items.map(r=>r.title),['Congé ou absence']);
 assert.doesNotMatch(JSON.stringify(v),/leave-foreign|leave-company/);
});

test('unverified leave history is not counted as a confirmed empty inbox',()=>{
 const args={companyId:company,userId:user,correctionView:{ready:true,requests:[]},
  breakView:{ready:true,requests:[]},missingView:{ready:true,requests:[]}};
 const v=employeeHoursRequestTimeline({...args,leaveView:{ready:false,requests:[
  {id:'wrong',company_id:company,user_id:user,status:'pending',created_at:'2026-11-03T09:00:00Z'}
 ]}});
 assert.equal(v.complete,false);
 assert.equal(v.pendingCount,0);
 assert.deepEqual(v.unavailable,['Congé ou absence']);
 assert.deepEqual(v.items,[]);
 const empty=employeeHoursRequestTimeline({...args,leaveView:{ready:true,requests:[]}});
 assert.equal(empty.complete,true);
});

test('My Hours passes only the leave view scoped to the account, with no automatic payroll approval',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const start=app.indexOf('function essentialHours()'),end=app.indexOf('function essentialCorrectionPage()',start);
 const hours=app.slice(start,end);
 assert.match(app,/leaveView:essentialLeaveView\(\{companyId,userId,loaded:state\.leavesLoaded/);
 assert.match(app,/loaded:state\.leavesLoaded,requests:state\.leaves/);
 assert.match(hours,/data-id="leave"/);
 assert.match(hours,/Mes demandes et absences/);
 assert.match(hours,/Une demande approuvée ne confirme pas, à elle seule, votre paie/);
});

test('all personal requests page expands beyond eight rows while preserving the summary limit',()=>{
 const own=Array.from({length:35},(_,i)=>({id:'req-'+i,company_id:company,
  requested_by:user,status:i%2?'approved':'pending',
  created_at:new Date(Date.parse('2026-11-02T10:00:00Z')+i*60000).toISOString()}));
 const foreign={...own[0],id:'foreign',requested_by:'someone-else'};
 const args={companyId:company,userId:user,
  correctionView:{ready:true,requests:[...own,foreign]},
  breakView:{ready:true,requests:[]},missingView:{ready:true,requests:[]},
  leaveView:{ready:true,requests:[]}};
 const compact=employeeHoursRequestTimeline(args);
 const full=employeeHoursRequestTimeline({...args,limit:100});
 assert.equal(compact.items.length,8);
 assert.equal(full.items.length,35);
 assert.equal(compact.total,35);
 assert.equal(full.total,35);
 assert.equal(full.pendingCount,18);
 assert.doesNotMatch(JSON.stringify(full),/foreign/);
 assert.equal(employeeHoursRequestTimeline({...args,limit:NaN}).items.length,8);
 assert.equal(employeeHoursRequestTimeline({...args,limit:1000}).items.length,35);
});

test('all requests page exposes status filters, scoped actions and failure notices',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const start=app.indexOf('function essentialRequestsPage()'),end=app.indexOf('function essentialHours()',start);
 const page=app.slice(start,end);
 assert.match(page,/const tracking=myRequestsTimeline\(100\)/);
 for(const status of ['all','pending','approved','rejected','cancelled'])
  assert.match(page,new RegExp("'"+status+"'"));
 for(const route of ['essentialCorrection','breakCorrections','missingDays','leave'])
  assert.match(page,new RegExp("'"+route+"'"));
 assert.match(page,/tracking\.unavailable\.join/);
 assert.match(page,/requestFilter/);
 assert.match(page,/data-id="hours"/);
 assert.match(app,/if\(state\.sub==='myRequests'\)return essentialRequestsPage\(\)/);
 assert.match(app,/else if\(a==='requestFilter'\)/);
 assert.match(app,/data-id="myRequests"/);
 assert.doesNotMatch(page,/\.rpc\(/);
});
