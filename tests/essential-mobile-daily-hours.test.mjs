import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {essentialMobileDailyHours,essentialMobileHoursLimit,essentialMobileDailyComparison,shouldOfferEssentialCachedRefresh,essentialMobileSnapshotLabel,essentialMobileOpenShiftLabel} from '../web/live/essential-hours-view.js';

const companyId='A',userId='U';
const time=(day,hour=0,minute=0)=>new Date(2026,10,day,hour,minute).getTime();
const iso=ms=>new Date(ms).toISOString();
const session=(id,a,b=null,company='A',user='U')=>({
 id,company_id:company,user_id:user,started_at:iso(a),ended_at:b==null?null:iso(b)});
const segment=(id,a,b=null,company='A',sessionId=id)=>({
 id:'seg-'+id,session_id:sessionId,company_id:company,job_id:'job',
 started_at:iso(a),ended_at:b==null?null:iso(b)});
const pause=(id,a,b=null,paid=false)=>({
 id:'pause-'+id,session_id:id,company_id:'A',user_id:'U',
 is_paid:paid,started_at:iso(a),ended_at:b==null?null:iso(b)});
const daily=(snapshot,now)=>essentialMobileDailyHours({companyId,userId,now,...snapshot});

test('current Monday nets overlapping unpaid pauses only once',()=>{
 const start=time(2,8),end=time(2,16);
 const rows=daily({sessions:[session('m',start,end)],
  segments:[segment('m',start,end)],
  breaks:[pause('m',time(2,10),time(2,10,30)),
   pause('m',time(2,10,15),time(2,10,45))]},time(3,12));
 assert.deepEqual(rows,[{dayStart:time(2),netMs:(8*60-45)*60000,grossMs:8*3600000,unpaidMs:45*60000}]);
});
test('midnight shift and break are clipped separately to each calendar day',()=>{
 const start=time(3,22),end=time(4,2);
 const rows=daily({sessions:[session('night',start,end)],
  segments:[segment('night',start,end)],
  breaks:[pause('night',time(3,23,30),time(4,0,30))]},time(4,12));
 assert.deepEqual(rows,[{dayStart:time(4),netMs:90*60000,grossMs:120*60000,unpaidMs:30*60000},
  {dayStart:time(3),netMs:90*60000,grossMs:120*60000,unpaidMs:30*60000}]);
});
test('paid break is retained while an ongoing unpaid pause stops at now',()=>{
 const start=time(2,8);
 const rows=daily({sessions:[session('open',start)],segments:[segment('open',start)],
  breaks:[pause('open',time(2,9),time(2,10),true),
   pause('open',time(2,11))]},time(2,12));
 assert.deepEqual(rows,[{dayStart:time(2),netMs:3*3600000,grossMs:4*3600000,unpaidMs:3600000}]);
});
test('tenant, user, and foreign break identities cannot change own hours',()=>{
 const start=time(2,8),end=time(2,12);
 const rows=daily({sessions:[session('mine',start,end),
  session('other-company',start,end,'B'),session('other-user',start,end,'A','V')],
  segments:[segment('mine',start,end),segment('other-company',start,end,'B'),
   segment('other-user',start,end),
   {...segment('mine-foreign',start,end,'A','mine'),user_id:'V'}],
  breaks:[pause('mine',time(2,9),time(2,9,30)),
   {...pause('mine',start,end),company_id:'B'},
   {...pause('mine',start,end),user_id:'V'}]},time(2,15));
 assert.deepEqual(rows,[{dayStart:time(2),netMs:210*60000,grossMs:4*3600000,unpaidMs:30*60000}]);
});
test('Sunday previous-week hours and future segments do not appear on Monday',()=>{
 const rows=daily({sessions:[session('sun',time(1,8),time(1,9)),
  session('mon',time(2,9),time(2,10)),session('future',time(3,8),time(3,9))],
  segments:[segment('sun',time(1,8),time(1,9)),segment('mon',time(2,9),time(2,10)),
   segment('future',time(3,8),time(3,9))],breaks:[]},time(2,12));
 assert.deepEqual(rows,[{dayStart:time(2),netMs:3600000,grossMs:3600000,unpaidMs:0}]);
});
test('invalid identity, clock and record arrays fail closed',()=>{
 for(const changes of [{companyId:''},{userId:''},{now:NaN},
  {sessions:null},{segments:null},{breaks:null}])
  assert.deepEqual(essentialMobileDailyHours({
   companyId:'A',userId:'U',now:time(2,12),sessions:[],segments:[],breaks:[],
   ...changes}),[]);
});
test('native hours displays the same scoped daily calculation as provisional time',()=>{
 const ui=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
 assert.match(ui,/import \{[^}]*essentialMobileDailyHours[^}]*\} from '\.\.\/\.\.\/web\/live\/essential-hours-view\.js'/);
 assert.match(ui,/dailyHours:\{dayStart:number;netMs:number;grossMs:number;unpaidMs:number\}\[\]=essentialMobileDailyHours/);
 assert.match(ui,/sessions:punch\.sessions,segments:visibleSegments,breaks:punch\.breaks\|\|\[\]/);
 assert.match(ui,/comparedDailyHours\.map\(row=>/);
 assert.match(ui,/essentialMobileDailyComparison\(\{/);
 assert.match(ui,/Détail quotidien · temps indicatif/);
 assert.match(ui,/Brut '\+hm\(row\.grossMs\)/);
 assert.match(ui,/Pause non payée '\+hm\(row\.unpaidMs\)/);
 assert.match(ui,/Inclut les pointages locaux en attente, le cas échéant\. Non approuvé/);
});

test('a shift crossing the Sunday-to-Monday week boundary counts only Monday net hours',()=>{
 const start=time(1,22),end=time(2,2);
 const rows=daily({sessions:[session('boundary',start,end)],
  segments:[segment('boundary',start,end)],
  breaks:[pause('boundary',time(1,23,30),time(2,0,30))]},time(2,8));
 assert.deepEqual(rows,[{dayStart:time(2),netMs:90*60000,grossMs:120*60000,unpaidMs:30*60000}]);
});

test('a fully unpaid day remains in daily detail with zero net time',()=>{
 const start=time(2,8),end=time(2,9);
 const rows=daily({sessions:[session('unpaid',start,end)],
  segments:[segment('unpaid',start,end)],
  breaks:[pause('unpaid',start,end)]},time(2,12));
 assert.deepEqual(rows,[{dayStart:time(2),netMs:0,grossMs:3600000,unpaidMs:3600000}]);
});

test('browse an earlier local week without changing the real clock',()=>{
 const earlier=time(-4,8),today=time(2,8);
 const snapshot={sessions:[session('old',earlier,earlier+3600000),session('today',today,today+3600000)],
  segments:[segment('old',earlier,earlier+3600000),segment('today',today,today+3600000)],breaks:[]};
 const args={companyId,userId,...snapshot,now:time(2,12)};
 assert.deepEqual(essentialMobileDailyHours({...args,weekAt:time(-4,12)}),[
  {dayStart:time(-4),netMs:3600000,grossMs:3600000,unpaidMs:0}]);
 assert.deepEqual(essentialMobileDailyHours(args),[
  {dayStart:time(2),netMs:3600000,grossMs:3600000,unpaidMs:0}]);
});

test('week browsing clips a Sunday-night shift at the week boundary',()=>{
 const start=time(1,22),end=time(2,2);
 const args={companyId,userId,now:time(2,12),weekAt:time(1,12),
  sessions:[session('night',start,end)],segments:[segment('night',start,end)],breaks:[]};
 assert.deepEqual(essentialMobileDailyHours(args),[
  {dayStart:time(1),netMs:7200000,grossMs:7200000,unpaidMs:0}]);
 assert.deepEqual(essentialMobileDailyHours({...args,weekAt:time(2,12)}),[
  {dayStart:time(2),netMs:7200000,grossMs:7200000,unpaidMs:0}]);
});

test('browsing cannot extend an old server snapshot into a later week',()=>{
 const start=time(2,8),end=time(2,12);
 assert.deepEqual(essentialMobileDailyHours({companyId,userId,
  sessions:[session('later',start,end)],segments:[segment('later',start,end)],
  breaks:[],weekAt:time(2,12),now:time(2,15),cutoff:time(1,23)}),[]);
 assert.deepEqual(essentialMobileDailyHours({companyId,userId,
  sessions:[],segments:[],breaks:[],now:time(2,12),weekAt:NaN}),[]);
});

test('native My Hours browses scoped weeks without changing the home clock',()=>{
 const ui=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
 assert.ok(ui.includes('weekAt:viewWeekDate.getTime()'));
 assert.ok(ui.includes('setWeekOffset(v=>Math.min(4,v+1))'));
 assert.ok(ui.includes('setWeekOffset(v=>Math.max(0,v-1))'));
 assert.ok(ui.includes("weekOffset===0?tr('thisWeek')"));
 assert.ok(ui.includes('dailyHours.reduce((sum,row)=>sum+row.netMs,0)'));
 assert.ok(ui.includes('Aucune journée dans le relevé chargé'));
 assert.ok(ui.includes('Date.parse(s.started_at)<viewWeekEnd'));
 assert.ok(ui.includes('s.company_id===account.companyId&&s.user_id===account.userId'));
 assert.ok(ui.includes('weekly=hoursFor(visibleSegments,displayNow,week,displayNow,punch.breaks||[])'));
 assert.ok(ui.includes('setWeekOffset(0)},[account.companyId,account.userId]'));
});

test('sum of daily gross minus unpaid always equals sum of daily net',()=>{
 const start=time(3,22),end=time(4,2);
 const rows=daily({sessions:[session('night',start,end)],
  segments:[segment('night',start,end)],
  breaks:[pause('night',time(3,23,30),time(4,0,30))]},time(4,12));
 const total=field=>rows.reduce((sum,r)=>sum+r[field],0);
 assert.equal(total('grossMs'),4*3600000);
 assert.equal(total('unpaidMs'),3600000);
 assert.equal(total('netMs'),total('grossMs')-total('unpaidMs'));
});

test('cached open shifts stop at the last complete server read',()=>{
 const cutoff=time(2,10),now=time(2,15),start=time(2,8);
 const limit=essentialMobileHoursLimit({now,snapshotFetchedAt:cutoff});
 assert.deepEqual(limit,{until:cutoff,excludeOpen:false});
 const rows=essentialMobileDailyHours({companyId,userId,
  sessions:[session('cached',start)],segments:[segment('cached',start)],
  breaks:[],now,cutoff:limit.until});
 assert.equal(rows[0].netMs,2*3600000);
 assert.equal(rows[0].grossMs,2*3600000);
});
test('legacy cache keeps completed days without guessing open hours',()=>{
 const now=time(2,18),start=time(2,8),end=time(2,10);
 const limit=essentialMobileHoursLimit({now,snapshotFetchedAt:null});
 assert.deepEqual(limit,{until:now,excludeOpen:true});
 const segments=[segment('closed',start,end),segment('open',time(2,11))];
 const rows=essentialMobileDailyHours({companyId,userId,
  sessions:[session('closed',start,end),session('open',time(2,11))],
  segments:segments.filter(s=>s.ended_at!=null),breaks:[],now,cutoff:limit.until});
 assert.equal(rows[0].netMs,2*3600000);
 assert.equal(rows[0].grossMs,2*3600000);
});
test('pending local events remain provisional and stale future time fails closed',()=>{
 const now=time(2,15),old=time(2,10);
 assert.deepEqual(essentialMobileHoursLimit({now,snapshotFetchedAt:old,hasLocalProjection:true}),
  {until:now,excludeOpen:false});
 assert.deepEqual(essentialMobileHoursLimit({now,snapshotFetchedAt:now+60000}),
  {until:now,excludeOpen:true});
 assert.deepEqual(essentialMobileHoursLimit({now,snapshotFetchedAt:now+1000}),
  {until:now,excludeOpen:false});
 assert.deepEqual(essentialMobileHoursLimit({now:NaN,snapshotFetchedAt:old}),
  {until:0,excludeOpen:true});
});
test('native totals, daily rows and session cards honor the display cutoff',()=>{
 const ui=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
 assert.match(ui,/essentialMobileHoursLimit\(\{now,snapshotFetchedAt:punch\.snapshotFetchedAt/);
 assert.match(ui,/visibleSegments=hoursLimit\.excludeOpen/);
 assert.match(ui,/hoursFor\(visibleSegments,displayNow,day,displayNow/);
 assert.match(ui,/segments:visibleSegments,breaks:punch\.breaks\|\|\[\]/);
 assert.match(ui,/now,cutoff:displayNow,weekAt:viewWeekDate/);
 assert.match(ui,/hoursFor\(visibleSegments\.filter/);
 assert.match(ui,/Date du dernier relevé indisponible/);
});

test('Expo daily-hours TypeScript contract stays attached to its function',()=>{
 const source=readFileSync(new URL('../web/live/essential-hours-view.js',import.meta.url),'utf8');
 const start=source.indexOf('export function essentialMobileDailyHours(');
 const docs=source.slice(source.lastIndexOf('/**',start),start);
 assert.match(docs,/sessions\?: Array/);
 assert.match(docs,/segments\?: Array/);
 assert.match(docs,/breaks\?: Array/);
 assert.match(docs,/@param/);
 assert.match(source,/export function essentialMobileHoursLimit/);
 const native=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
 assert.match(native,/openShiftLabel=essentialMobileOpenShiftLabel\(/);
 assert.match(native,/openShiftLabel=essentialMobileOpenShiftLabel/);
});

test('cached-hours refresh is offered with no pending punches, never from a blocked journal',()=>{
 assert.equal(shouldOfferEssentialCachedRefresh({readSource:'cache',pending:0,blocked:false}),true);
 for(const data of [
  {readSource:'server',pending:0,blocked:false},
  {readSource:'cache',pending:1,blocked:false},
  {readSource:'cache',pending:0,blocked:true},
  {readSource:'cache',pending:NaN,blocked:false},
  {readSource:'cache',pending:0,blocked:undefined}
 ])assert.equal(shouldOfferEssentialCachedRefresh(data),false);
});
test('native home and My Hours refresh cached hours through the existing safe sync handler',()=>{
 const ui=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
 assert.equal((ui.match(/offerCachedRefresh\?<Pressable/g)||[]).length,2);
 assert.equal((ui.match(/accessibilityLabel="Actualiser le relevé horaire sauvegardé"/g)||[]).length,2);
 assert.match(ui,/shouldOfferEssentialCachedRefresh\(\{readSource:punch\.readSource,pending,blocked:journalBlocked\}\)/);
 assert.match(ui,/Connexion Internet requise pour actualiser le relevé/);
 assert.match(ui,/onPress=\{\(\)=>\{void syncLocalPunches\(\)\}\}/);
});

test('native hours use applied projection cutoff but show all pending events',()=>{
 const ui=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
 assert.match(ui,/hasLocalProjection:punch\.hasAppliedLocalProjection/);
 assert.match(ui,/punch\.hasLocalProjection\?\(punch\.readSource==='cache'/);
});

test('Expo keeps original attendance hours apart from local projected estimate in both views',()=>{
 const native=readFileSync(new URL('../src/punch/api.ts',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
 assert.match(native,/baselineSnapshot:\{sessions:ownSessions,segments:ownSegments,breaks:ownBreaks\}/);
 assert.match(ui,/baselineLimit=essentialMobileHoursLimit\(\{now,snapshotFetchedAt:punch\.snapshotFetchedAt\}\)/);
 assert.match(ui,/baselineSnapshot\.sessions,segments:baselineSegments/);
 assert.match(ui,/comparePendingHours=!!punch\.hasLocalProjection&&!punch\.snapshotUnverified/);
 assert.match(ui,/Relevé : '\+hm\(baselineWeekMs\)/);
 assert.match(ui,/Dernier relevé disponible : '\+hm\(baselineDailyHours\.reduce/);
 assert.match(ui,/Avec pointages locaux en attente : estimation non confirmée/);
});

test('current server snapshot shows device read time, never a payroll approval',()=>{
 const now=Date.parse('2026-11-02T17:00:00Z');
 const label=essentialMobileSnapshotLabel({readSource:'server',snapshotFetchedAt:now-60000,now});
 assert.match(label,/Dernier chargement serveur/);
 assert.doesNotMatch(label,/copie enregistrée|plus de 24 h|approuvé/);
 const cache=essentialMobileSnapshotLabel({readSource:'cache',snapshotFetchedAt:now-60000,now});
 assert.match(cache,/copie enregistrée sur cet appareil/);
 assert.doesNotMatch(cache,/plus de 24 h/);
});
test('old or timestamp-free cached hours explain staleness without inventing a server date',()=>{
 const now=Date.parse('2026-11-02T17:00:00Z');
 assert.match(essentialMobileSnapshotLabel({readSource:'cache',snapshotFetchedAt:now-86400000,now}),/plus de 24 h/);
 assert.equal(essentialMobileSnapshotLabel({readSource:'cache',snapshotFetchedAt:null,now}),
  'Date du dernier chargement serveur inconnue.');
 assert.equal(essentialMobileSnapshotLabel({readSource:'server',snapshotFetchedAt:null,now}),null);
 assert.equal(essentialMobileSnapshotLabel({readSource:'cache',snapshotFetchedAt:now+60000,now}),
  'Date du dernier chargement serveur inconnue.');
 assert.equal(essentialMobileSnapshotLabel({readSource:'cache',snapshotFetchedAt:now,now:NaN}),null);
 assert.equal(essentialMobileSnapshotLabel({readSource:'invalid',snapshotFetchedAt:now,now}),null);
});
test('native My Hours displays snapshot age without asserting a time for unverified cache',()=>{
 const ui=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
 assert.match(ui,/snapshotLabel=punch\.snapshotUnverified\?null:essentialMobileSnapshotLabel/);
 assert.match(ui,/readSource:punch\.readSource,snapshotFetchedAt:punch\.snapshotFetchedAt,now/);
 const hourPage=ui.slice(ui.indexOf("page==='hours'?"),ui.indexOf("page==='schedule'?"));
 assert.match(hourPage,/snapshotLabel\?txt\(snapshotLabel/);
});

test('daily comparison keeps distinct baseline and local estimates sorted by civil day',()=>{
 const earlier=time(2),later=time(3);
 const local=[{dayStart:earlier,netMs:5,grossMs:6,unpaidMs:1},
  {dayStart:later,netMs:8,grossMs:8,unpaidMs:0}];
 const base=[{dayStart:earlier,netMs:7,grossMs:8,unpaidMs:1},
  {dayStart:later,netMs:6,grossMs:7,unpaidMs:1}];
 const result=essentialMobileDailyComparison({projectedDays:local,baselineDays:base});
 assert.deepEqual(result.map(row=>[row.dayStart,row.baselineNetMs,row.deltaMs]),
  [[later,6,2],[earlier,7,-2]]);
 assert.deepEqual(result.map(row=>row.netMs),[8,5]);
 assert.deepEqual(local.map(row=>row.netMs),[5,8],'Comparison must not mutate the original rows');
 assert.deepEqual(base.map(row=>row.netMs),[7,6]);
});
test('daily comparison includes days present on only one side and rejects malformed values',()=>{
 const earlier=time(2),later=time(3);
 const valid={dayStart:earlier,netMs:2,grossMs:3,unpaidMs:1};
 const invalid={dayStart:later,netMs:NaN,grossMs:3,unpaidMs:0};
 const result=essentialMobileDailyComparison({projectedDays:[valid,invalid],
  baselineDays:[{dayStart:later,netMs:4,grossMs:4,unpaidMs:0}]});
 assert.deepEqual(result,[
  {dayStart:later,netMs:0,grossMs:0,unpaidMs:0,baselineNetMs:4,deltaMs:-4},
  {dayStart:earlier,netMs:2,grossMs:3,unpaidMs:1,baselineNetMs:0,deltaMs:2}
 ]);
 assert.deepEqual(essentialMobileDailyComparison({projectedDays:'invalid',baselineDays:null}),[]);
});
test('native My Hours compares personal daily rows without labeling offline events as approved',()=>{
 const ui=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
 assert.match(ui,/comparedDailyHours=essentialMobileDailyComparison/);
 assert.match(ui,/projectedDays:dailyHours,baselineDays:comparePendingHours\?baselineDailyHours:\[\]/);
 const page=ui.slice(ui.indexOf("page==='hours'?"),ui.indexOf("page==='schedule'?"));
 assert.match(page,/comparedDailyHours\.map\(row/);
 assert.match(page,/Dernier relevé : '\+hm\(row\.baselineNetMs\)/);
 assert.match(page,/Écart local : /);
 assert.match(page,/comparePendingHours\?txt/);
 assert.match(page,/Non approuvé/);
});

test('saved open sessions never claim a live clock-in from a stale cache',()=>{
 assert.equal(essentialMobileOpenShiftLabel({readSource:'cache',excludeOpen:false}),'Fin non vérifiée');
 assert.equal(essentialMobileOpenShiftLabel({readSource:'cache',excludeOpen:true}),'Fin non vérifiée');
 assert.equal(essentialMobileOpenShiftLabel({readSource:'server',excludeOpen:true}),'Fin non vérifiée');
 assert.equal(essentialMobileOpenShiftLabel({readSource:'server',excludeOpen:false}),'En cours');
 assert.equal(essentialMobileOpenShiftLabel({}),'Fin non vérifiée');
});
test('a local ongoing shift is always labeled as an unofficial estimate',()=>{
 for(const readSource of ['cache','server']){
  assert.equal(essentialMobileOpenShiftLabel({readSource,hasAppliedLocalProjection:true,excludeOpen:false}),
   'En cours · estimation locale non confirmée');
 }
 assert.equal(essentialMobileOpenShiftLabel({readSource:'cache',hasAppliedLocalProjection:true,excludeOpen:true}),
  'Fin non vérifiée');
});
test('native My Hours uses scoped open-shift labels instead of treating cache as live',()=>{
 const ui=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
 assert.match(ui,/openShiftLabel=essentialMobileOpenShiftLabel/);
 assert.match(ui,/hasAppliedLocalProjection:punch\.hasAppliedLocalProjection,excludeOpen:hoursLimit\.excludeOpen/);
 const hours=ui.slice(ui.indexOf("page==='hours'?"),ui.indexOf("page==='schedule'?"));
 assert.match(hours,/new Date\(s\.ended_at\).*:openShiftLabel/);
 assert.doesNotMatch(hours,/hoursLimit\.excludeOpen\?'Fin non vérifiée':'En cours'/);
});


test('native daily rows never exceed their verified parent session',()=>{
 const shift=session('bounded',time(2,8),time(2,10));
 const outside=segment('bounded',time(2,7),time(2,12));
 const source=JSON.stringify(outside);
 const rows=daily({sessions:[shift],segments:[outside],
  breaks:[pause('bounded',time(2,9),time(2,9,30))]},time(2,16));
 assert.deepEqual(rows,[{dayStart:time(2),grossMs:2*3600000,
  netMs:90*60000,unpaidMs:30*60000}]);
 assert.equal(JSON.stringify(outside),source,'Clipping must not mutate server or cached records');
});

test('a completed session bounds a stale open segment in native daily hours',()=>{
 const rows=daily({sessions:[session('closed',time(2,8),time(2,10))],
  segments:[segment('closed',time(2,8))],breaks:[]},time(2,16));
 assert.deepEqual(rows,[{dayStart:time(2),grossMs:2*3600000,
  netMs:2*3600000,unpaidMs:0}]);
});

test('native daily totals reject invalid, foreign and orphan parent sessions',()=>{
 const rows=daily({sessions:[
  session('reversed',time(2,12),time(2,10)),
  session('other',time(2,8),time(2,12),'B'),
  session('another-worker',time(2,8),time(2,12),'A','V')],
  segments:[
   segment('reversed',time(2,8),time(2,12)),
   segment('other',time(2,8),time(2,12)),
   segment('another-worker',time(2,8),time(2,12)),
   segment('orphan',time(2,8),time(2,12))],breaks:[]},time(2,16));
 assert.deepEqual(rows,[]);
});
