import {test} from 'node:test';
import assert from 'node:assert/strict';
import {missionImportDays,validateMissionDraftBatch} from '../web/live/mission-multiday-import.js';
const today='2026-10-28',tomorrow='2026-10-29';
const roster=[{id:'a',name:'Nadine',status:'active'}];
const sites=[{id:'s',client_name:'Client',name:'Édifice',city:'Québec',active:true}];
const rows=[
{line:2,employee:'Nadine',site:'s',day:today,order:'1',title:'Cuisine',instructions:''},
{line:3,employee:'Nadine',site:'s',day:tomorrow,order:'1',title:'Bureau',instructions:''}
];
const byDay=()=>({[today]:{enabled:true,truncated:false,items:[]},
 [tomorrow]:{enabled:true,truncated:false,items:[]}});
const check=(r=rows,days=byDay())=>validateMissionDraftBatch(r,{roster,sites,byDay:days,today});
test('multi-day import validates each separate day and preserves CSV line ordering',()=>{
 const r=check();
 assert.deepEqual(missionImportDays(rows,today),[today,tomorrow]);
 assert.equal(r.valid,true);assert.equal(r.total,2);
 assert.deepEqual(r.rows.map(x=>x.day),[today,tomorrow]);
 assert.deepEqual(r.days,[today,tomorrow]);
});
test('same date worker/order conflict blocks the entire preview',()=>{
 const r=check([...rows,{...rows[0],line:4,title:'Escalier'}]);
 assert.equal(r.valid,false);assert.match(r.errors[0].detail,/Rang/);
});
test('duplicate order on two different dates remains valid',()=>{
 const r=check(rows);
 assert.equal(r.valid,true);assert.equal(r.rows[0].order,r.rows[1].order);
});
test('future server snapshot conflict and partial data fail closed',()=>{
 const list=byDay();
 list[tomorrow].items.push({mission_day:tomorrow,worker_id:'a',site_id:'s',sort_order:1,title:'Other',status:'published'});
 const r=check(rows,list);
 assert.equal(r.valid,false);assert.match(r.errors[0].detail,/Rang/);
 assert.throws(()=>check(rows,{[today]:list[today]}),/incomplète|non autorisée/);
 assert.throws(()=>check(rows,{...byDay(),[tomorrow]:{enabled:true,truncated:true,items:[]}}),/incomplète/);
 assert.throws(()=>check(rows,{...byDay(),[tomorrow]:{enabled:false,truncated:false,items:[]}}),/non autorisée/);
 assert.throws(()=>check(rows,{...byDay(),[tomorrow]:{enabled:true,truncated:false,items:[{mission_day:today}]}}),/incohérente/);
});
test('invalid, past or excessive horizon dates are rejected before RPCs',()=>{
 for(const date of ['2026-10-27','2026-11-12','2026-02-30','2026-13-01','not-date']){
  assert.throws(()=>missionImportDays([{...rows[0],day:date}],today),/date|Date/);
 }
 assert.equal(missionImportDays([{...rows[0],day:'2026-11-11'}],today)[0],'2026-11-11');
 assert.throws(()=>missionImportDays(Array(51).fill(rows[0]),today),/50/);
 assert.throws(()=>missionImportDays([],today),/50/);
});
test('no cross-date worker/site leak from foreign snapshots',()=>{
 const list=byDay();
 list[tomorrow].items.push({mission_day:tomorrow,worker_id:'x',sort_order:2,title:'Unrelated',status:'published'});
 assert.equal(check(rows,list).valid,true);
 assert.throws(()=>validateMissionDraftBatch(rows,{roster,sites,byDay:byDay(),today,sitesComplete:false}),/incomplet/);
});
