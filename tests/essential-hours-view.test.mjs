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

test('web daily rows reconcile gross, unpaid and net with verified weekly hours',()=>{
 const view=essentialHoursView(fixture);
 assert.equal(view.ready,true);
 assert.equal(view.confirmedDaily.length,1);
 const day=view.confirmedDaily[0];
 assert.equal(day.grossMs,3*3600000);
 assert.equal(day.unpaidMs,15*60000);
 assert.equal(day.netMs,view.confirmedWeekMs);
});
test('web daily server view never incorporates locally projected pending time',()=>{
 const local={id:'local-new',company_id:company,user_id:user,started_at:'2026-11-04T13:00:00Z',ended_at:'2026-11-04T14:00:00Z'};
 const view=essentialHoursView({...fixture,pendingCount:1,projectedSessions:[...sessions,local],
  projectedSegments:[...segments,{session_id:'local-new',company_id:company,started_at:local.started_at,ended_at:local.ended_at}],
  projectedBreaks:breaks});
 assert.equal(view.confirmedDaily[0].netMs,view.confirmedWeekMs);
 assert.ok(view.projectedWeekMs>view.confirmedWeekMs);
});
test('confirmed Web daily open hours stop at server cutoff while local week stays current',()=>{
 const earlier=Date.parse('2026-11-04T14:30:00Z');
 const view=essentialHoursView({...fixture,snapshotFetchedAt:earlier,
  now:Date.parse('2026-11-04T21:00:00Z')});
 assert.equal(view.confirmedDaily[0].netMs,view.confirmedWeekMs);
 assert.equal(view.confirmedDaily[0].netMs,(2*60+30-15)*60000);
 const sunday=Date.parse('2026-11-01T23:00:00Z');
 const monday=Date.parse('2026-11-02T12:00:00Z');
 const stale=essentialHoursView({...fixture,snapshotFetchedAt:sunday,now:monday});
 assert.deepEqual(stale.confirmedDaily,[]);
 assert.equal(stale.confirmedWeekMs,0);
});
test('Web Mes heures renders read-only server daily breakdown separately from pending',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/view\.confirmedDaily\.map\(row=>/);
 assert.match(app,/Brut '\+mins\(row\.grossMs\)/);
 assert.match(app,/Pause non payée '\+mins\(row\.unpaidMs\)/);
 assert.match(app,/pointages locaux en attente ne sont pas inclus/);
 assert.match(app,/daily\+'<div class="ess-panel"><b>Historique des journées/);
});

test('Web selected week shows only server-confirmed hours in that local week',()=>{
 const local=(y,m,d,h)=>new Date(y,m-1,d,h).getTime();
 const iso=ms=>new Date(ms).toISOString();
 const oldStart=local(2026,10,28,8),nowStart=local(2026,11,4,8);
 const add=(id,start,duration)=>({id,company_id:company,user_id:user,started_at:iso(start),ended_at:iso(start+duration)});
 const old=add('old-week',oldStart,3*3600000),recent=add('this-week',nowStart,2*3600000);
 const source={sessions:[old,recent],segments:[old,recent].map(s=>({session_id:s.id,company_id:company,started_at:s.started_at,ended_at:s.ended_at})),breaks:[]};
 const args={...fixture,snapshot:source,now:local(2026,11,4,18),snapshotFetchedAt:local(2026,11,4,17)};
 assert.equal(essentialHoursView({...args,weekOffset:0}).confirmedWeekMs,2*3600000);
 const previous=essentialHoursView({...args,weekOffset:1});
 assert.equal(previous.confirmedWeekMs,3*3600000);
 assert.deepEqual(previous.confirmedDaily.map(r=>r.netMs),[3*3600000]);
 assert.equal(essentialHoursView({...args,weekOffset:2}).confirmedWeekMs,0);
});
test('Web historical week projection stays unconfirmed and rejects other users',()=>{
 const atLocal=(y,m,d,h)=>new Date(y,m-1,d,h).getTime(),iso=x=>new Date(x).toISOString();
 const begin=atLocal(2026,10,28,8),now=atLocal(2026,11,4,15);
 const old={id:'server-old',company_id:company,user_id:user,started_at:iso(begin),ended_at:iso(begin+3600000)};
 const local={...old,id:'pending-old',started_at:iso(begin+7200000),ended_at:iso(begin+10800000)};
 const stranger={...local,id:'foreign',user_id:'stranger',started_at:iso(begin+14400000)};
 const segment=s=>({session_id:s.id,company_id:s.company_id,started_at:s.started_at,ended_at:s.ended_at});
 const args={...fixture,now,weekOffset:1,snapshotFetchedAt:now-60000,
  snapshot:{sessions:[old],segments:[segment(old)],breaks:[]},pendingCount:1,
  projectedSessions:[old,local,stranger],
  projectedSegments:[segment(old),segment(local),segment(stranger)],projectedBreaks:[]};
 const result=essentialHoursView(args);
 assert.equal(result.confirmedWeekMs,3600000);
 assert.equal(result.projectedWeekMs,7200000);
 assert.equal(result.confirmedDaily.reduce((a,r)=>a+r.netMs,0),3600000);
});
test('historical week hours stop at next local Monday rather than including current week',()=>{
 const local=(y,m,d,h=0)=>new Date(y,m-1,d,h).getTime(),iso=x=>new Date(x).toISOString();
 const start=local(2026,10,31,10),now=local(2026,11,4,16);
 const open={id:'old-open',company_id:company,user_id:user,started_at:iso(start),ended_at:null};
 const s={session_id:open.id,company_id:company,started_at:open.started_at,ended_at:null};
 const result=essentialHoursView({...fixture,now,weekOffset:1,snapshotFetchedAt:now,
  snapshot:{sessions:[open],segments:[s],breaks:[]}});
 const end=local(2026,11,2);
 assert.equal(result.confirmedWeekMs,end-start);
 assert.equal(result.confirmedDaily.reduce((sum,r)=>sum+r.netMs,0),end-start);
});
test('Web hours navigation validates offsets and binds both arrows to scoped UI state',()=>{
 for(const offset of [-1,5,1.2,NaN,Infinity]){
  const v=essentialHoursView({...fixture,weekOffset:offset});
  assert.equal(v.ready,false);
  assert.equal(v.confirmedWeekMs,0);
 }
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/hoursWeekOffset:0,hoursWeekScope:''/);
 assert.match(app,/state\.hoursWeekScope!==hoursScope/);
 assert.match(app,/weekOffset:1/);
 assert.match(app,/data-id="older"/);
 assert.match(app,/data-id="newer"/);
 assert.match(app,/Math\.max\(0,Math\.min\(4,state\.hoursWeekOffset/);
 assert.match(app,/snapshotFetchedAt:state\.serverPunchFetchedAt,weekOffset/);
});
