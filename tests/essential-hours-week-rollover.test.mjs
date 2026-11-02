import test from 'node:test';
import assert from 'node:assert/strict';
import {essentialHoursView} from '../web/live/essential-hours-view.js';

const companyId='tenant-A',userId='employee-A';
const local=(year,month,day,hour)=>new Date(year,month-1,day,hour).getTime();
const iso=ms=>new Date(ms).toISOString();
const session=(id,from,to)=>({
 id,company_id:companyId,user_id:userId,started_at:iso(from),ended_at:to==null?null:iso(to)
});
const segment=(id,from,to)=>({
 id:'segment-'+id,company_id:companyId,session_id:id,job_id:'job-A',
 started_at:iso(from),ended_at:to==null?null:iso(to)
});
const view=(snapshot,options)=>essentialHoursView({
 companyId,userId,snapshotCompanyId:companyId,snapshot,
 ...options
});

test('Sunday server cache shows zero confirmed hours in the new Monday week',()=>{
 const sun9=local(2026,11,1,9),sun10=local(2026,11,1,10);
 const mon9=local(2026,11,2,9),mon11=local(2026,11,2,11);
 const snapshot={sessions:[session('sun',sun9,sun10)],
  segments:[segment('sun',sun9,sun10)],breaks:[]};
 const result=view(snapshot,{snapshotFetchedAt:local(2026,11,1,18),
  now:local(2026,11,2,12),pendingCount:1,
  projectedSessions:[...snapshot.sessions,session('mon-local',mon9,mon11)],
  projectedSegments:[...snapshot.segments,segment('mon-local',mon9,mon11)],
  projectedBreaks:[]});
 assert.equal(result.ready,true);
 assert.equal(result.confirmedWeekMs,0,'old Sunday hours must not be labeled this week');
 assert.equal(result.projectedWeekMs,2*3600000,'local Monday hours are a separate estimate');
 assert.deepEqual(result.confirmedDays.map(day=>day.session.id),['sun'],
  'historical Sunday entry remains visible but is not counted this week');
});

test('in a current-week snapshot, confirmed time stops at server receipt while local projection continues',()=>{
 const sun9=local(2026,11,1,9),sun10=local(2026,11,1,10);
 const mon9=local(2026,11,2,9);
 const snapshot={sessions:[session('sun',sun9,sun10),session('mon',mon9,null)],
  segments:[segment('sun',sun9,sun10),segment('mon',mon9,null)],
  breaks:[]};
 const result=view(snapshot,{now:local(2026,11,2,13),
  snapshotFetchedAt:local(2026,11,2,10),pendingCount:1,
  projectedSessions:snapshot.sessions,projectedSegments:snapshot.segments,projectedBreaks:[]});
 assert.equal(result.confirmedWeekMs,3600000,'open server segment capped at 10:00');
 assert.equal(result.projectedWeekMs,4*3600000,'local estimate runs up to 13:00');
});

test('a prior-year Sunday cache cannot populate the first Monday of a new year',()=>{
 const sun=local(2027,1,3,9),mon=local(2027,1,4,9);
 const snapshot={sessions:[session('old',sun,sun+3600000)],
  segments:[segment('old',sun,sun+3600000)],breaks:[]};
 const result=view(snapshot,{now:local(2027,1,4,13),
  snapshotFetchedAt:local(2027,1,3,20),
  pendingCount:1,
  projectedSessions:[...snapshot.sessions,session('new',mon,mon+7200000)],
  projectedSegments:[...snapshot.segments,segment('new',mon,mon+7200000)],
  projectedBreaks:[]});
 assert.equal(result.confirmedWeekMs,0);
 assert.equal(result.projectedWeekMs,7200000);
});
