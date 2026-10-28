import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMissionDraftCsv,validateMissionDraftRows,importMissionDraftRows,MISSION_IMPORT_HEADER} from '../web/live/mission-batch-import.js';
const roster=[{id:'worker-A',name:'Nadine',status:'active'},{id:'worker-B',name:'Mathieu',status:'active'}];
const sites=[{id:'site-A',client_name:'Clinique',name:'Édifice A',city:'Québec',active:true},
 {id:'site-B',client_name:'Condo',name:'Édifice B',city:'Charlesbourg',active:true}];
const day='2026-11-03';
const sample='employe;lieu;date;ordre;titre;instructions\nNadine;site-A;2026-11-03;1;Nettoyage;"Porte, étage ""A"""\nMathieu;site-B;2026-11-03;1;Entretien;';
const preview=csv=>validateMissionDraftRows(parseMissionDraftCsv(csv),{roster,sites,existing:[],day});
test('French CSV supports BOM, quoted semicolons, commas and escaped quotes',()=>{
 const x=parseMissionDraftCsv('\uFEFF'+sample);
 assert.equal(x.length,2);assert.equal(x[0].instructions,'Porte, étage "A"');
 assert.equal(preview(sample).valid,true);
 assert.equal(parseMissionDraftCsv(sample.replaceAll(';',','))[0].employee,'Nadine');
 assert.equal(MISSION_IMPORT_HEADER,'employe;lieu;date;ordre;titre;instructions');
});
test('invalid or excessive CSV fails closed without saving',()=>{
 assert.throws(()=>parseMissionDraftCsv('foo;bar\nx;y'),/En-têtes/);
 assert.throws(()=>parseMissionDraftCsv('employe;lieu;date;ordre;titre;instructions'),/sans mission/);
 assert.throws(()=>parseMissionDraftCsv(sample+'x'.repeat(66000)),/64 Kio/);
 assert.throws(()=>parseMissionDraftCsv(MISSION_IMPORT_HEADER+'\n'+'a;b;2026-11-03;1;A;B\n'.repeat(51)),/50/);
 assert.throws(()=>parseMissionDraftCsv(MISSION_IMPORT_HEADER+'\n"a;b;2026-11-03;1;A;B'),/non fermée/);
});
test('only authorized active roster and sites can be resolved; ambiguous names refused',()=>{
 let r=preview(sample);assert.equal(r.valid,true);assert.equal(r.rows[0].workerId,'worker-A');
 r=validateMissionDraftRows(parseMissionDraftCsv(sample),{roster:[...roster,{id:'other',name:'Nadine',status:'active'}],sites,existing:[],day});
 assert.equal(r.valid,false);assert.match(r.errors[0].detail,/ambigu/);
 const deleted=validateMissionDraftRows(parseMissionDraftCsv(sample),{roster,sites:sites.map(s=>({...s,active:false})),existing:[],day});
 assert.equal(deleted.valid,false);
 assert.throws(()=>validateMissionDraftRows(parseMissionDraftCsv(sample),{roster,sites,existing:[],day,sitesComplete:false}),/incomplet/);
});
test('duplicate order, worker/site/title, and old manager snapshot are rejected',()=>{
 const p=parseMissionDraftCsv(sample);
 const existing=[{mission_day:day,worker_id:'worker-A',site_id:'site-A',sort_order:1,title:'Autre',status:'published'}];
 const r=validateMissionDraftRows(p,{roster,sites,existing,day});
 assert.equal(r.valid,false);assert.match(r.errors[0].detail,/Rang/);
 const repeated=preview(MISSION_IMPORT_HEADER+'\nNadine;site-A;'+day+';1;Nettoyage;\nNadine;site-A;'+day+';2;Nettoyage;');
 assert.equal(repeated.valid,false);assert.match(repeated.errors[0].detail,/déjà présente/);
});
test('errors in one row block the whole preview from being importable',()=>{
 const p=preview(MISSION_IMPORT_HEADER+'\nNadine;site-A;'+day+';1;Bonne mission;\nIntrus;site-A;'+day+';2;Refus;');
 assert.equal(p.valid,false);assert.equal(p.total,2);assert.equal(p.rows.length,1);assert.equal(p.errors.length,1);
});
test('confirmed drafts are created sequentially, never published',async()=>{
 const rows=preview(sample).rows,events=[];
 const result=await importMissionDraftRows(rows,{beforeEach:async row=>events.push('check:'+row.line),
  save:async row=>{events.push('save:'+row.line);return{id:row.title,status:'draft',version:1}}});
 assert.deepEqual(events,['check:2','save:2','check:3','save:3']);
 assert.equal(result.completed,2);
});
test('uncertain response stops immediately, reports confirmed count, and does not retry',async()=>{
 const rows=preview(sample).rows,events=[];
 await assert.rejects(importMissionDraftRows(rows,{beforeEach:async()=>{},
  save:async row=>{events.push(row.line);throw Error('timeout');}}),
  error=>{assert.equal(error.completed,0);assert.match(error.message,/Actualisez/);return true;});
 assert.deepEqual(events,[2]);
});
