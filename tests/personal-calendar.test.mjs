import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPersonalCalendar} from '../web/live/personal-calendar.js';
const company='11111111-1111-4111-8111-111111111111',worker='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const shift=(overrides={})=>({id:'44444444-4444-4444-8444-444444444444',company_id:company,worker_id:worker,starts_at:'2026-11-01T05:30:00Z',ends_at:'2026-11-01T10:30:00Z',timezone:'America/Toronto',location_id:'site',version:2,...overrides});
test('exports only the employee own published shifts; no other tenant, other worker, vacant or cancelled',()=>{
 const result=buildPersonalCalendar({companyId:company,workerId:worker,now:'2026-10-25T16:00:00Z',
 shifts:[shift(),shift({id:'other-worker',worker_id:other}),shift({id:'other-company',company_id:other}),shift({id:'vacant',worker_id:null}),shift({id:'cancelled',cancelled_at:'2026-10-24'}),shift({id:'invalid-date',ends_at:'2026-10-31T10:30:00Z'})],
 locations:[{id:'site',name:'Atelier, Nord; \n\"'}]});
 assert.equal(result.count,1);
 assert.match(result.content,/BEGIN:VCALENDAR\r\nVERSION:2.0/);
 assert.match(result.content,/DTSTART:20261101T053000Z\r\nDTEND:20261101T103000Z/);
 assert.match(result.content,/SEQUENCE:2\r\n/);
 assert.doesNotMatch(result.content,/other-worker|other-company|vacant|cancelled|invalid-date/);
 assert.doesNotMatch(result.content,/PRIVATE|email|phone|password/i);
});
test('safely quotes long Unicode calendar lines at 75 octets and keeps CRLF',()=>{
 const long='é'.repeat(90)+'\\,;\n';
 const {content,count}=buildPersonalCalendar({companyId:company,workerId:worker,shifts:[shift()],locations:[{id:'site',name:long}]});
 assert.equal(count,1);
 for(const line of content.split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75,'long iCalendar line');
 assert.match(content,/LOCATION:/);
 assert.match(content,/\\,\\;\\n/);
});
test('refuses missing worker identity and never exports an unscoped manager schedule',()=>{
 assert.throws(()=>buildPersonalCalendar({companyId:company,shifts:[shift()]}),/Dossier salarié/);
 assert.equal(buildPersonalCalendar({companyId:company,workerId:other,shifts:[shift()]}).count,0);
});
test('personal calendar is a one-time snapshot, with stable UID and no subscription token',()=>{
 const args={companyId:company,workerId:worker,shifts:[shift()],now:'2026-10-25T16:00:00Z'};
 assert.equal(buildPersonalCalendar(args).content,buildPersonalCalendar(args).content);
 assert.match(buildPersonalCalendar(args).content.replace(/\\r\\n /g,''),/UID:44444444-4444-4444-8444-444444444444@11111111-1111-4111-8111-111111111111\\.punch360\\.app/);
 assert.doesNotMatch(buildPersonalCalendar(args).content,/URL:|ATTENDEE:|ORGANIZER:|token|Bearer/i);
});
