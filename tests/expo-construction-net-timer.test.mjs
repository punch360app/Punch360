import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {netSegmentMilliseconds} from '../web/live/essential-hours-export.js';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const api=readFileSync(new URL('../src/punch/api.ts',import.meta.url),'utf8');
const calcSource=api.slice(api.indexOf('export function hoursFor('))
 .replace('export function hoursFor(segments:PunchSegment[],nowMs:number,fromMs:number,toMs:number,breaks:PunchBreak[]=[]){','function hoursFor(segments,nowMs,fromMs,toMs,breaks=[]){')
 .replace('new Map<string,PunchBreak[]>()','new Map()');
const hoursFor=new Function('netSegmentMilliseconds',calcSource+'\nreturn hoursFor;')(netSegmentMilliseconds);
const ts=h=>Date.parse('2026-11-02T'+h+'Z');
const segment=(session,from,to=null)=>({session_id:session,company_id:'A',job_id:'J',started_at:'2026-11-02T'+from+'Z',ended_at:to?'2026-11-02T'+to+'Z':null});
const pause=(session,from,to,paid=false)=>({session_id:session,is_paid:paid,started_at:'2026-11-02T'+from+'Z',ended_at:to?'2026-11-02T'+to+'Z':null});
const activeNet=(now,segments,breaks,session='S')=>
 hoursFor(segments.filter(x=>x.session_id===session),ts(now),ts('08:00:00'),ts(now),breaks);
test('active net clock freezes while unpaid pause remains open',()=>{
 const rows=[segment('S','08:00:00')],b=[pause('S','10:00:00',null)];
 assert.equal(activeNet('10:00:00',rows,b),2*3600000);
 assert.equal(activeNet('12:00:00',rows,b),2*3600000);
});
test('active net clock continues through paid break',()=>{
 const rows=[segment('S','08:00:00')],b=[pause('S','10:00:00',null,true)];
 assert.equal(activeNet('12:00:00',rows,b),4*3600000);
});
test('after unpaid break ends, net clock resumes from previously accrued hours',()=>{
 const rows=[segment('S','08:00:00')],b=[pause('S','10:00:00','10:30:00')];
 assert.equal(activeNet('11:15:00',rows,b),2*3600000+45*60000);
});
test('net clock excludes other session breaks and segments',()=>{
 const rows=[segment('S','08:00:00'),segment('OTHER','08:00:00')];
 const b=[pause('OTHER','09:00:00',null),pause('S','10:00:00','10:10:00')];
 assert.equal(activeNet('11:00:00',rows,b),170*60000);
});
test('active timer follows scoped server and journal segments, not raw elapsed time',()=>{
 assert.match(app,/const activeWorkedMs=journalViewScope===currentScope&&activeSession\?/);
 assert.match(app,/hoursFor\(serverSegments\.filter\(s=>s\.session_id===activeSession\.id\),now,/);
 assert.match(app,/Date\.parse\(activeSession\.started_at\),now,serverBreaks\)/);
 assert.match(app,/clock\(activeWorkedMs\/1000\)/);
 assert.match(app,/Temps travaillé net/);
 assert.doesNotMatch(app,/clock\(elapsed\)/);
});
test('home and card totals hide data until correct company and user scope loads',()=>{
 assert.match(app,/\{journalViewScope===currentScope\?formatHours\(weekDuration\):'—'\}/);
 assert.match(app,/\{journalViewScope===currentScope\?formatHours\(annualDuration\):'—'\}/);
 assert.match(app,/journalViewScope===currentScope&&current\?<JobCard/);
 assert.match(app,/journalViewScope===currentScope&&upcoming\?<JobCard/);
});
test('Expo root remounts company-specific workspace and resets stale state on account switch',()=>{
 assert.equal((app.match(/<Workspace key=\{account\.companyId\+':'\+account\.userId\} account=\{account\}\/>/g)||[]).length,2);
 assert.equal((app.match(/<EssentialWorkspace key=\{account\.companyId\+':'\+account\.userId\} account=\{account\}\/>/g)||[]).length,2);
});
