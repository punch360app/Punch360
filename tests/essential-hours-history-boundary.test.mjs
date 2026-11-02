import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {essentialHoursView} from '../web/live/essential-hours-view.js';

const companyId='company-A',userId='employee-A';
const local=(y,m,d,h=0)=>new Date(y,m-1,d,h).getTime();
const iso=ms=>new Date(ms).toISOString();
const view=(from,to,opts={})=>{
 const shift={id:'overnight',company_id:companyId,user_id:userId,
  started_at:iso(from),ended_at:to==null?null:iso(to)};
 return essentialHoursView({companyId,userId,snapshotCompanyId:companyId,
  snapshot:{sessions:[shift],segments:[{session_id:shift.id,company_id:companyId,
   started_at:shift.started_at,ended_at:shift.ended_at}],breaks:[]},
  now:local(2026,11,4,17),snapshotFetchedAt:local(2026,11,4,16),...opts});
};

test('an overnight shift history row shows only the portion belonging to each week',()=>{
 const sun=local(2026,11,1,23),mon=local(2026,11,2),end=local(2026,11,2,2);
 const current=view(sun,end,{weekOffset:0}).confirmedWeekDays[0];
 const previous=view(sun,end,{weekOffset:1}).confirmedWeekDays[0];
 assert.equal(current.rangeStart,iso(mon));
 assert.equal(current.rangeEnd,iso(end));
 assert.equal(current.netMs,2*3600000);
 assert.equal(current.rangeEndIsFinal,true);
 assert.equal(previous.rangeStart,iso(sun));
 assert.equal(previous.rangeEnd,iso(mon));
 assert.equal(previous.netMs,3600000);
 assert.equal(previous.rangeEndIsFinal,false,
  'the selected week ending is not a PUNCH OUT');
});

test('an open session in an earlier week is clipped at Monday, not shown as ongoing',()=>{
 const from=local(2026,10,31,23);
 const previous=view(from,null,{weekOffset:1}).confirmedWeekDays[0];
 assert.equal(previous.rangeEnd,iso(local(2026,11,2)));
 assert.equal(previous.rangeEndIsFinal,false);
 assert.equal(previous.netMs,25*3600000);
});

test('a current open shift history stops at the last complete server read',()=>{
 const from=local(2026,11,4,8),cutoff=local(2026,11,4,12);
 const row=view(from,null,{weekOffset:0,snapshotFetchedAt:cutoff}).confirmedWeekDays[0];
 assert.equal(row.rangeStart,iso(from));
 assert.equal(row.rangeEnd,iso(cutoff));
 assert.equal(row.rangeEndIsFinal,false);
 assert.equal(row.netMs,4*3600000);
});

test('Web displays the clipped history range, never raw session timestamps',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const start=app.indexOf('const history=view.ready&&view.confirmedWeekDays.length?');
 const history=app.slice(start,app.indexOf('return heading(\'Mes heures\')',start));
 assert.ok(start>=0);
 assert.match(history,/when\(rangeStart\)/);
 assert.match(history,/when\(rangeEnd\)/);
 assert.match(history,/rangeEndIsFinal/);
 assert.doesNotMatch(history,/when\(s\.started_at\)|when\(s\.ended_at\)/);
});
