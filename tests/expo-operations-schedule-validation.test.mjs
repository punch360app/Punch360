import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const code=readFileSync(new URL('../src/workforce/operations-schedule-validation.ts',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/workforce/OperationsPanel.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(code,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const exports={};
new Function('exports',compiled)(exports);
const {validatedScheduleShift,validatedShiftCancellationReason}=exports;
const plan={companyId:'tenant-A',userId:'worker-A',jobId:'job-A',
 start:'2026-11-03T07:00:00-05:00',end:'2026-11-03T15:00:00-05:00',
 note:'  Travail façade  '};

test('scheduling submits normalized UTC instants without dropping worker or job scope',()=>{
 const result=validatedScheduleShift(plan);
 assert.deepEqual(result,{p_company:'tenant-A',p_user:'worker-A',p_job:'job-A',
  p_start:'2026-11-03T12:00:00.000Z',
  p_end:'2026-11-03T20:00:00.000Z',p_note:'Travail façade'});
});

test('start and end with different offsets compare actual instants across daylight saving',()=>{
 const result=validatedScheduleShift({...plan,
  start:'2026-11-01T01:30:00-04:00',
  end:'2026-11-01T01:30:00-05:00'});
 assert.equal(Date.parse(result.p_end)-Date.parse(result.p_start),3600000);
});

test('invalid or missing ISO timezones are rejected before scheduling RPC',()=>{
 const bad=[
  '2026-11-03T07:00',
  '2026-11-03 07:00:00',
  '2026-11-03T07:00:00',
  '2026-11-03T07:00:00+20:00',
  '2026-11-03T07:00:00-14:15',
  '2026-11-03T25:00:00Z',
  '2026-11-03T07:62:00Z',
  '2026-02-30T07:00:00Z',
  '2025-02-29T07:00:00Z',
  'garbage'
 ];
 for(const start of bad){
  assert.throws(()=>validatedScheduleShift({...plan,start}),/Début/,start);
 }
});

test('valid leap day and UTC Z formats are accepted',()=>{
 const payload=validatedScheduleShift({...plan,
  start:'2028-02-29T00:00:00Z',end:'2028-02-29T08:00:00Z'});
 assert.equal(payload.p_start,'2028-02-29T00:00:00.000Z');
 assert.equal(payload.p_end,'2028-02-29T08:00:00.000Z');
});

test('a zero, reversed or longer-than-24-hours shift never reaches the server',()=>{
 for(const end of [
  '2026-11-03T07:00:00-05:00',
  '2026-11-03T06:59:59-05:00'
 ]){
  assert.throws(()=>validatedScheduleShift({...plan,end}),/fin du quart/);
 }
 assert.throws(()=>validatedScheduleShift({...plan,
  end:'2026-11-04T07:00:01-05:00'}),/24 heures/);
 assert.equal(validatedScheduleShift({...plan,
  end:'2026-11-04T07:00:00-05:00'}).p_end,'2026-11-04T12:00:00.000Z');
});

test('missing company, worker or job selection fails before an RPC attempt',()=>{
 for(const [field,message] of [
  ['companyId',/Entreprise requise/],
  ['userId',/Sélectionne un employé/],
  ['jobId',/Sélectionne un chantier/]
 ]){
  assert.throws(()=>validatedScheduleShift({...plan,[field]:'  '}),message);
 }
});

test('cancelling a planned shift requires and trims a real reason',()=>{
 for(const reason of ['', '  ', 'OK', ' a ']){
  assert.throws(()=>validatedShiftCancellationReason(reason),/3 caractères/);
 }
 assert.equal(validatedShiftCancellationReason('   Pluie  '),'Pluie');
});

test('OperationsPanel uses the existing secured RPCs only after local validation',()=>{
 const schedule=panel.slice(panel.indexOf("{button('Planifier',"),panel.indexOf('{manager?button(\'Annuler ce quart',panel.indexOf("{button('Planifier',")));
 assert.match(schedule,/validatedScheduleShift\(/);
 assert.ok(schedule.indexOf('validatedScheduleShift(')<schedule.indexOf("supabase.rpc('schedule_shift'"));
 assert.match(schedule,/members\.some\(/);
 assert.match(schedule,/jobs\.some\(/);
 const cancel=panel.slice(panel.indexOf("button('Annuler ce quart"),panel.indexOf("{mode==='documents'"));
 assert.match(cancel,/validatedShiftCancellationReason\(note\)/);
 assert.ok(cancel.indexOf('validatedShiftCancellationReason')<cancel.indexOf("supabase.rpc('cancel_shift'"));
 assert.match(panel,/Exemple : 2026-11-03T07:00:00-05:00/);
 const syntax=ts.createSourceFile('OperationsPanel.tsx',panel,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(syntax.parseDiagnostics.length,0,'OperationsPanel must remain valid TSX');
});
