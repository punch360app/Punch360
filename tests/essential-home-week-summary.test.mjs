import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {essentialHomeWeekSummary} from '../web/live/essential-hours-view.js';

const at=(hour,minute=0)=>new Date(2026,10,4,hour,minute).toISOString();
const now=new Date(2026,10,4,18).getTime();
const ownSession={id:'own',company_id:'company-A',user_id:'worker-A',
 started_at:at(8),ended_at:at(12)};
const foreignSession={id:'foreign',company_id:'company-B',user_id:'worker-A',
 started_at:at(8),ended_at:at(17)};
const snapshot={
 sessions:[ownSession,foreignSession],
 // A segment outside the verified parent shift must never inflate the card.
 segments:[
  {session_id:'own',company_id:'company-A',started_at:at(7),ended_at:at(17)},
  {session_id:'foreign',company_id:'company-B',started_at:at(8),ended_at:at(17)}
 ],
 breaks:[{session_id:'own',company_id:'company-A',user_id:'worker-A',
  is_paid:false,started_at:at(9),ended_at:at(9,30)}]
};
const scope={companyId:'company-A',userId:'worker-A',
 snapshotCompanyId:'company-A',snapshot,now,snapshotFetchedAt:now};

test('home weekly total uses parent-bounded server sessions, not the pending local amount',()=>{
 const projectedSessions=[...snapshot.sessions,{id:'pending',company_id:'company-A',
  user_id:'worker-A',started_at:at(13),ended_at:null}];
 const projectedSegments=[...snapshot.segments,{session_id:'pending',
  company_id:'company-A',started_at:at(13),ended_at:null}];
 const result=essentialHomeWeekSummary({...scope,pendingCount:1,
  projectedSessions,projectedSegments,projectedBreaks:snapshot.breaks});
 // 13 h to the local 18 h clock is five pending hours, kept separate from 3.5 confirmed hours.
 assert.deepEqual(result,{ready:true,confirmedMs:3.5*3600000,estimatedMs:8.5*3600000});
});

test('absence of a server snapshot is unknown, not a claimed zero-hour week',()=>{
 const result=essentialHomeWeekSummary({...scope,snapshotCompanyId:'company-B',
  pendingCount:1,projectedSessions:snapshot.sessions,
  projectedSegments:snapshot.segments,projectedBreaks:snapshot.breaks});
 assert.deepEqual(result,{ready:false,confirmedMs:null,estimatedMs:null});
});

test('without local events the card offers no fabricated estimate',()=>{
 assert.deepEqual(essentialHomeWeekSummary({...scope,pendingCount:0}),
  {ready:true,confirmedMs:3.5*3600000,estimatedMs:null});
});

test('weekly home source remains the current week even if the caller provides another offset',()=>{
 assert.equal(essentialHomeWeekSummary({...scope,weekOffset:4}).confirmedMs,3.5*3600000);
});

test('the real Web home and its one-second tick read the verified summary',()=>{
 const page=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.ok(page.includes('function essentialHomeWeeklyHours()'));
 assert.ok(page.includes('const weekly=essentialHomeWeeklyHours();'));
 assert.ok(page.includes("(weekly.ready?mins(weekly.confirmedMs):'À vérifier')"));
 assert.ok(page.includes('const weekView=isEssential()?essentialHomeWeeklyHours():null'));
 assert.ok(page.includes('Estimation locale : '));
 assert.ok(!page.includes('mins(clockTotals().week)'));
});
