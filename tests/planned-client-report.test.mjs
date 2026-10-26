import {test} from 'node:test';
import assert from 'node:assert/strict';
import {plannedClientReport,plannedClientReportCsv} from '../web/live/planned-client-report.js';
const date='2026-11-02';
const shift=(id,worker,from,to,site,extra={})=>({
 id,worker_id:worker,starts_at:date+'T'+from+':00Z',ends_at:date+'T'+to+':00Z',
 client_site_id:site,department_id:'dept',version:1,...extra
});
const shifts=[
 shift('a','nadine','13:00','17:00','site-a'),
 shift('b','nadine','16:00','18:00','site-b'),
 shift('c','mathieu','13:00','21:00','site-b'),
 shift('d',null,'19:00','21:00','site-a'),
 shift('e','nadine','13:00','14:00','site-a',{cancelled_at:'2026-11-01T00:00:00Z'})
];
const sites=[
 {shift_id:'a',client_site_id:'site-a',client_name:'Maison Nadine',site_name:'Saint-Augustin',city:'Saint-Augustin-de-Desmaures'},
 {shift_id:'b',client_site_id:'site-b',client_name:'Condo Mathieu',site_name:'Charlesbourg',city:'Charlesbourg'},
 {shift_id:'c',client_site_id:'site-b',client_name:'Condo Mathieu',site_name:'Charlesbourg',city:'Charlesbourg'},
 {shift_id:'d',client_site_id:'site-a',client_name:'Maison Nadine',site_name:'Saint-Augustin',city:'Saint-Augustin-de-Desmaures'}
];
const args={shifts,assignedSites:sites,from:date,to:'2026-11-03',loadedFrom:'2026-10-26',loadedTo:'2026-11-10'};
test('two client sites; conflicting minutes are not attributed to either and coworkers retain independent hours',()=>{
 const before=structuredClone(shifts);
 const report=plannedClientReport(args);
 assert.equal(report.rows.length,2);
 assert.equal(report.totalHours,12); // Nadine 3h at A +1h at B, Mathieu 8h at B
 assert.equal(report.conflictHours,1);
 assert.equal(report.vacantHours,2); // Unfilled appointment never counted as employee hours
 assert.equal(report.rows.find(x=>x.siteId==='site-a').scheduledHours,3);
 assert.equal(report.rows.find(x=>x.siteId==='site-b').scheduledHours,9);
 assert.equal(report.actualHours,null);assert.equal(report.actualAvailable,false);
 assert.deepEqual(shifts,before);
});
test('same-site duplicate planning does not double-count; unknown address cannot be silently substituted',()=>{
 const duplicates=[shift('one','nadine','13:00','15:00','site-a'),shift('two','nadine','14:00','16:00','site-a')];
 const result=plannedClientReport({...args,shifts:duplicates,assignedSites:[
  {...sites[0],shift_id:'one'},{...sites[0],shift_id:'two'}]});
 assert.equal(result.totalHours,3);assert.equal(result.sameSiteOverlapHours,1);
 assert.equal(result.conflictHours,0);
 assert.throws(()=>plannedClientReport({...args,shifts:[shift('missing','nadine','13:00','15:00','site-c')]}),/Adresse.*manquante/);
});
test('filters preserve cross-site conflicts and never relabel actual time as scheduled work',()=>{
 const siteA=plannedClientReport({...args,site:'site-a'});
 assert.equal(siteA.totalHours,3);assert.equal(siteA.conflictHours,1);
 const worker=plannedClientReport({...args,worker:'nadine'});
 assert.equal(worker.totalHours,4);assert.equal(worker.vacantHours,0);assert.equal(worker.conflictHours,1);
 const other=plannedClientReport({...args,worker:'mathieu',site:'site-b'});
 assert.equal(other.totalHours,8);assert.equal(other.conflictHours,0);
 const noDept=plannedClientReport({...args,department:'elsewhere'});
 assert.equal(noDept.totalHours,0);
});
test('strict UTC dates and incomplete source explicitly stop wrong reports',()=>{
 assert.throws(()=>plannedClientReport({...args,from:'2026-11-05',to:'2026-11-02'}),/Période UTC/);
 assert.throws(()=>plannedClientReport({...args,from:'2026-11-02',to:'2026-12-10'}),/31 jours/);
 assert.throws(()=>plannedClientReport({...args,from:'2026-13-99'}),/Période UTC/);
 assert.throws(()=>plannedClientReport({...args,loadedFrom:'2026-11-03'}),/antérieure/);
 assert.throws(()=>plannedClientReport({...args,loadedTo:'2026-11-02'}),/postérieure/);
 assert.throws(()=>plannedClientReport({...args,incomplete:true}),/tronqués/);
 assert.throws(()=>plannedClientReport({...args,shifts:Array.from({length:1000},(_,i)=>({...shifts[0],id:String(i)}))}),/tronqués/);
});
test('CSV exports include no raw time attribution and defend against spreadsheet formulas',()=>{
 const report=plannedClientReport({...args,assignedSites:sites.map(x=>x.shift_id==='a'?{...x,client_name:'=1+1'}:x)});
 const out=plannedClientReportCsv(report);
 assert.match(out,/^\uFEFF/);
 assert.match(out,/'=1\+1/);
 assert.match(out,/Heures réellement attribuées/);
 assert.match(out,/Non disponibles/);
 assert.match(out,/Heures ambiguës exclues/);
 assert.doesNotMatch(out,/undefined|NaN/);
 assert.throws(()=>plannedClientReportCsv(null),/calculer/);
});
