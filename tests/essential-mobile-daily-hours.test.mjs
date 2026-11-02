import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {essentialMobileDailyHours} from '../web/live/essential-hours-view.js';

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
 assert.match(ui,/import \{essentialMobileDailyHours\} from '\.\.\/\.\.\/web\/live\/essential-hours-view\.js'/);
 assert.match(ui,/dailyHours:\{dayStart:number;netMs:number;grossMs:number;unpaidMs:number\}\[\]=essentialMobileDailyHours/);
 assert.match(ui,/sessions:punch\.sessions,segments:punch\.segments,breaks:punch\.breaks\|\|\[\]/);
 assert.match(ui,/dailyHours\.map\(row=>/);
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
