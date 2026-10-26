import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSubscribedCalendar} from '../supabase/functions/essential-calendar/ical.mjs';
const company='11111111-1111-4111-8111-111111111111',worker='22222222-2222-4222-8222-222222222222';
const original=(details={})=>({id:'33333333-3333-4333-8333-333333333333',company_id:company,worker_id:worker,starts_at:'2026-11-01T05:30:00Z',ends_at:'2026-11-01T11:00:00Z',version:2,location_id:'one',...details});
const make=shifts=>buildSubscribedCalendar({companyId:company,workerId:worker,shifts,locations:[{id:'one',company_id:company,name:'Siège, Québec; étage é'}],now:'2026-10-26T00:00:00Z'});
test('private subscription never includes other worker or company events',()=>{
 const v=make([original(),original({id:'other',worker_id:'other'}),original({id:'foreign',company_id:'foreign'})]);
 assert.equal(v.count,1);
 assert.match(v.content,/BEGIN:VCALENDAR\r\nVERSION:2.0/);
 assert.match(v.content,/DTSTART:20261101T053000Z/);
 assert.doesNotMatch(v.content,/other|foreign|email|phone|password/i);
});
test('updates and cancellations retain the same UID with increasing SEQUENCE',()=>{
 const active=make([original()]);
 const canceled=make([original({version:3,cancelled_at:'2026-10-25T22:00:00Z'})]);
 const uid='UID:33333333-3333-4333-8333-333333333333@11111111-1111-4111-8111-111111111111.punch360.app';
 assert.ok(active.content.replace(/\r\n /g,'').includes(uid));
 assert.ok(canceled.content.replace(/\r\n /g,'').includes(uid));
 assert.match(active.content,/STATUS:CONFIRMED/);
 assert.match(canceled.content,/STATUS:CANCELLED/);
 assert.match(canceled.content,/SEQUENCE:3/);
});
test('UTF-8 iCalendar lines respect RFC 5545 octet folding',()=>{
 const v=buildSubscribedCalendar({companyId:company,workerId:worker,shifts:[original()],locations:[{id:'one',name:'é'.repeat(120)}]});
 for(const line of v.content.split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75,'overlong line');
});
test('missing identity or more than 1000 shifts abort instead of giving a partial feed',()=>{
 assert.throws(()=>buildSubscribedCalendar({companyId:company,shifts:[original()]}));
 assert.throws(()=>make(Array.from({length:1001},()=>original())));
});
