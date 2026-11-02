import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {netSegmentMilliseconds} from '../web/live/essential-hours-export.js';

const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const api=readFileSync(new URL('../src/punch/api.ts',import.meta.url),'utf8');
const from=api.indexOf('export function hoursFor(');
assert.ok(from>=0,'shared native hours calculator not found');
const js=api.slice(from)
 .replace('export function hoursFor(segments:PunchSegment[],nowMs:number,fromMs:number,toMs:number,breaks:PunchBreak[]=[]){',
  'function hoursFor(segments,nowMs,fromMs,toMs,breaks=[]){')
 .replace('new Map<string,PunchBreak[]>()','new Map()');
const hoursFor=new Function('netSegmentMilliseconds',js+'\nreturn hoursFor;')(netSegmentMilliseconds);
const ms=s=>Date.parse('2026-11-02T'+s+'Z');
const segment=(id,start,end=null,session_id='s')=>({
 id,session_id,started_at:'2026-11-02T'+start+'Z',
 ended_at:end?'2026-11-02T'+end+'Z':null,company_id:'A',job_id:id});
const pause=(start,end,paid=false,session_id='s')=>({
 session_id,started_at:'2026-11-02T'+start+'Z',
 ended_at:end?'2026-11-02T'+end+'Z':null,is_paid:paid});
test('Construction weekly totals exclude unpaid but preserve paid break minutes',()=>{
 const rows=[segment('jobA','08:00:00','16:00:00')];
 const pauses=[pause('10:00:00','10:20:00'),pause('13:00:00','13:15:00',true),pause('14:00:00','14:30:00')];
 assert.equal(hoursFor(rows,ms('17:00:00'),ms('00:00:00'),ms('17:00:00'),pauses),7*3600000+10*60000);
});
test('Construction calculates separate session histories using segments instead of gross presence',()=>{
 const rows=[segment('jobA','08:00:00','10:00:00'),segment('jobB','10:30:00','13:00:00'),
  segment('jobC','09:00:00','11:00:00','other')];
 const breaks=[pause('09:15:00','09:30:00'),pause('11:00:00','11:20:00'),
  pause('09:05:00','09:50:00',false,'other')];
 const own=rows.filter(s=>s.session_id==='s');
 assert.equal(hoursFor(own,ms('15:00:00'),ms('08:00:00'),ms('13:00:00'),breaks),3*3600000+55*60000);
 assert.equal(hoursFor(rows.filter(s=>s.session_id==='other'),ms('15:00:00'),ms('09:00:00'),ms('11:00:00'),breaks),75*60000);
});
test('Construction unpaid overlapping breaks are merged and clipped to job boundaries',()=>{
 const rows=[segment('jobA','08:00:00','12:00:00')];
 const pauses=[pause('07:30:00','09:00:00'),pause('08:30:00','09:30:00'),pause('11:45:00','13:00:00')];
 assert.equal(hoursFor(rows,ms('15:00:00'),ms('00:00:00'),ms('15:00:00'),pauses),135*60000);
});
test('Construction open sessions and open unpaid breaks stop at the current clock',()=>{
 const rows=[segment('jobA','08:00:00')];
 assert.equal(hoursFor(rows,ms('11:00:00'),ms('00:00:00'),ms('17:00:00'),
  [pause('10:00:00',null,false)]),2*3600000);
});
test('Construction week boundary does not include prior shift or break outside period',()=>{
 const rows=[segment('jobA','08:00:00','16:00:00')];
 assert.equal(hoursFor(rows,ms('17:00:00'),ms('12:00:00'),ms('16:00:00'),
  [pause('11:00:00','13:00:00')]),3*3600000);
});
test('Construction invalid timestamps never create positive hours',()=>{
 const rows=[{...segment('jobA','08:00:00','16:00:00'),started_at:'invalid'}];
 assert.equal(hoursFor(rows,ms('17:00:00'),ms('00:00:00'),ms('17:00:00')),0);
});
test('Construction refresh and manual retry preserve break rows, never raw session hours',()=>{
 assert.match(app,/const \[serverBreaks,setServerBreaks\]=useState<PunchBreak\[\]>\(\[\]\)/);
 assert.equal(app.match(/setSessions\(punch\.sessions\);setServerSegments\(punch\.segments\);setServerBreaks\(punch\.breaks\|\|\[\]\)/g)?.length,2);
 assert.match(app,/const weekDuration=hoursFor\(serverSegments,now,weekBegin,now,serverBreaks\)/);
 assert.match(app,/const annualDuration=hoursFor\(serverSegments,now,yearBegin,now,serverBreaks\)/);
 assert.match(app,/formatHours\(hoursFor\(serverSegments\.filter\(seg=>seg\.session_id===s\.id\),now,Date\.parse\(s\.started_at\),s\.ended_at\?Date\.parse\(s\.ended_at\):now,serverBreaks\)\)/);
 assert.doesNotMatch(app,/formatHours\(Math\.max\(0,\(s\.ended_at\?/);
});
test('Construction hours do not render stale totals and session details after company change',()=>{
 assert.match(app,/\{scoped\?formatHours\(weekDuration\):'—'\}/);
 assert.match(app,/\{scoped\?formatHours\(annualDuration\):'—'\}/);
 assert.match(app,/\{!scoped\?<T color=\{C\.muted\}>Relevé du compte en cours de chargement/);
});
