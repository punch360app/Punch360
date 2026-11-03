import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {netSegmentMilliseconds} from '../web/live/essential-hours-export.js';

const native=readFileSync(new URL('../src/punch/api.ts',import.meta.url),'utf8');
const web=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
const fnStart=native.indexOf('export function hoursFor(');
assert.ok(fnStart>=0,'Expo hoursFor export missing');
// Compile and execute the actual Expo TypeScript function without importing
// the native Expo runtime, Supabase client or a real authenticated account.
const transpiled=ts.transpileModule(native.slice(fnStart),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const nativeExports={};
new Function('exports','netSegmentMilliseconds',transpiled)(nativeExports,netSegmentMilliseconds);
const {hoursFor}=nativeExports;
const iso=time=>'2026-11-02T'+time+':00Z';
const session='shift-1';
const segment=(from,to,session_id=session)=>({
 session_id,started_at:iso(from),ended_at:to==null?null:iso(to)
});
const pause=(from,to,is_paid=false,session_id=session)=>({
 session_id,started_at:iso(from),ended_at:to==null?null:iso(to),is_paid
});
const at=time=>Date.parse(iso(time));
const mins=minutes=>minutes*60000;

test('Expo and Web calculator subtract union of unpaid breaks, not duplicate overlaps or paid ones',()=>{
 const segments=[segment('08:00','12:00'),segment('12:00','16:00')];
 const breaks=[
  pause('10:00','10:30'),pause('10:15','10:45'),
  pause('12:05','12:35'),pause('13:00','13:10',true),
  pause('11:00','12:00',false,'another-session')
 ];
 assert.equal(hoursFor(segments,at('16:00'),at('08:00'),at('16:00'),breaks),mins(405));
 const expected=segments.reduce((ms,part)=>ms+netSegmentMilliseconds(part,breaks,at('08:00'),at('16:00')),0);
 assert.equal(hoursFor(segments,at('16:00'),at('08:00'),at('16:00'),breaks),expected);
});

test('partial window clips segment and unpaid breaks consistently',()=>{
 const segments=[segment('08:00','12:00'),segment('12:00','16:00')];
 const breaks=[pause('10:00','10:45'),pause('12:05','12:35')];
 assert.equal(hoursFor(segments,at('16:00'),at('09:00'),at('14:00'),breaks),mins(225));
});

test('ongoing shift with open unpaid break is capped at current time',()=>{
 const segments=[segment('14:00',null)];
 const breaks=[pause('15:00','15:15',true),pause('16:30',null)];
 assert.equal(hoursFor(segments,at('17:00'),at('14:00'),at('20:00'),breaks),mins(150));
});

test('invalid and reversed segments cannot turn a daily total into NaN or negative',()=>{
 const segments=[segment('15:00','14:00'),{...segment('08:00','12:00'),started_at:'invalid'}];
 assert.equal(hoursFor(segments,at('17:00'),at('08:00'),at('17:00'),[]),0);
 assert.equal(hoursFor(segments,NaN,at('08:00'),at('17:00'),[]),0);
});

test('both attendance UIs call the shared exact calculator',()=>{
 assert.match(native,/import \{netSegmentMilliseconds\} from '\.\.\/\.\.\/web\/live\/essential-hours-export\.js';/);
 assert.match(native,/total\+netSegmentMilliseconds\(segment,bySession\.get\(segment\.session_id\)\|\|\[\],fromMs,until\)/);
 assert.match(web,/import \{sessionIdChunks,netSegmentMilliseconds\} from '\.\/essential-hours-export\.js';/);
 assert.match(web,/function totals\(from\)\{/);
 assert.match(web,/netSegmentMilliseconds\(segment,breaks\.get\(segment\.session_id\)\|\|\[\],from,state\.time\)/);
 assert.match(web,/s\.company_id===companyId&&s\.user_id===userId/);
});
