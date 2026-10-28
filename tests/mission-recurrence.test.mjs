import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recurringMissionDrafts,recurringMissionConflict,missionCalendarDay} from '../web/live/mission-recurrence.js';
const form={day:'2026-11-03',workerId:'worker-A',siteId:'site-A',order:2,
 title:'Entretien ménage',instructions:'',intervalWeeks:1,count:4};
const today='2026-10-28';
test('weekly and biweekly draft dates keep the same weekday across DST and month boundaries',()=>{
 let result=recurringMissionDrafts(form,{today});
 assert.deepEqual(result.map(x=>x.day),['2026-11-03','2026-11-10','2026-11-17','2026-11-24']);
 assert.equal(result.every(x=>x.workerId==='worker-A'&&x.order===2),true);
 result=recurringMissionDrafts({...form,intervalWeeks:2},{today});
 assert.deepEqual(result.map(x=>x.day),['2026-11-03','2026-11-17','2026-12-01','2026-12-15']);
});
test('leap days and invalid dates are handled as calendar dates',()=>{
 assert.equal(missionCalendarDay('2028-02-29').toISOString().slice(0,10),'2028-02-29');
 assert.throws(()=>missionCalendarDay('2027-02-29'),/impossible/);
 assert.throws(()=>missionCalendarDay('2026-13-02'),/impossible/);
 const dates=recurringMissionDrafts({...form,day:'2028-02-29',count:2},{today:'2028-02-20'});
 assert.deepEqual(dates.map(x=>x.day),['2028-02-29','2028-03-07']);
});
test('past, 180-day horizon, invalid counts and bad title are rejected before any RPC',()=>{
 assert.throws(()=>recurringMissionDrafts({...form,day:'2026-10-27'},{today}),/passé/);
 assert.throws(()=>recurringMissionDrafts({...form,intervalWeeks:3},{today}),/2 à 12/);
 assert.throws(()=>recurringMissionDrafts({...form,count:1},{today}),/2 à 12/);
 assert.throws(()=>recurringMissionDrafts({...form,count:13},{today}),/2 à 12/);
 assert.throws(()=>recurringMissionDrafts({...form,day:'2026-12-01',count:12,intervalWeeks:2},{today}),/180 jours/);
 assert.throws(()=>recurringMissionDrafts({...form,title:'x'},{today}),/invalide/);
});
test('any previous mission of the same worker/day/order blocks a recurring draft',()=>{
 const row=recurringMissionDrafts(form,{today})[0];
 assert.match(recurringMissionConflict(row,[{mission_day:row.day,worker_id:row.workerId,
  site_id:'site-B',sort_order:row.order,status:'completed',title:'Other'}]),/Rang/);
 assert.match(recurringMissionConflict(row,[{mission_day:row.day,worker_id:row.workerId,
  site_id:row.siteId,sort_order:4,status:'draft',title:row.title}]),/déjà présente/);
 assert.equal(recurringMissionConflict(row,[{mission_day:row.day,worker_id:'worker-B',
  sort_order:row.order,status:'published'}]),null);
 assert.equal(recurringMissionConflict(row,[{mission_day:row.day,worker_id:row.workerId,
  sort_order:row.order,status:'cancelled'}]),null);
});
