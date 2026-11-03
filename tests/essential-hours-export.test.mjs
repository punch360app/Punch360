import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sessionIdChunks,segmentExportDuration} from '../web/live/essential-hours-export.js';

test('export fetches unique session IDs in bounded chunks',()=>{
 const rows=Array.from({length:221},(_,i)=>({session_id:'session-'+i}));
 rows.push(rows[0],{session_id:''},{session_id:null},{},{session_id:'session-3'});
 const chunks=sessionIdChunks(rows);
 assert.deepEqual(chunks.map(c=>c.length),[100,100,21]);
 assert.equal(new Set(chunks.flat()).size,221);
 assert.deepEqual(sessionIdChunks([]),[]);
 for(const size of [0,201,-1,1.3])assert.deepEqual(sessionIdChunks(rows,size),[]);
 assert.deepEqual(sessionIdChunks(null),[]);
});

test('net time clips unpaid pauses to the segment, merges overlaps and excludes paid pauses',()=>{
 const row={session_id:'s1',started_at:'2026-11-01T12:00:00Z',ended_at:'2026-11-01T16:00:00Z',punch_sessions:{started_at:'2026-11-01T12:00:00Z',ended_at:'2026-11-01T16:00:00Z'}};
 const breaks=[
  {session_id:'s1',is_paid:false,started_at:'2026-11-01T11:30:00Z',ended_at:'2026-11-01T12:30:00Z'},
  {session_id:'s1',is_paid:false,started_at:'2026-11-01T12:20:00Z',ended_at:'2026-11-01T13:00:00Z'},
  {session_id:'s1',is_paid:true,started_at:'2026-11-01T13:00:00Z',ended_at:'2026-11-01T13:15:00Z'},
  {session_id:'s1',is_paid:false,started_at:'2026-11-01T15:45:00Z',ended_at:'2026-11-01T16:30:00Z'},
  {session_id:'s2',is_paid:false,started_at:'2026-11-01T13:00:00Z',ended_at:'2026-11-01T14:00:00Z'}
 ];
 assert.deepEqual(segmentExportDuration(row,breaks),{gross:'4.0000',unpaid:'1.2500',net:'2.7500',anomaly:''});
});

test('long shift, open shift, invalid and negative timestamps are flagged without invalid hours',()=>{
 const row={session_id:'s',started_at:'2026-11-01T12:00:00Z',ended_at:'2026-11-02T12:00:00Z',punch_sessions:{started_at:'2026-11-01T12:00:00Z',ended_at:'2026-11-02T12:00:00Z'}};
 assert.deepEqual(segmentExportDuration(row,[]),{gross:'24.0000',unpaid:'0.0000',net:'24.0000',anomaly:'PLUS DE 16H'});
 assert.equal(segmentExportDuration({...row,ended_at:null}).anomaly,'SORTIE MANQUANTE');
 assert.equal(segmentExportDuration({...row,ended_at:'invalid'}).anomaly,'HORODATAGE INVALIDE');
 assert.equal(segmentExportDuration({...row,started_at:'invalid'}).anomaly,'HORODATAGE INVALIDE');
 assert.equal(segmentExportDuration({...row,ended_at:'2026-11-01T11:00:00Z'}).anomaly,'SORTIE AVANT ENTRÉE');
});

test('unpaid breaks exceeding the segment never create negative net time',()=>{
 const row={session_id:'s',started_at:'2026-11-01T12:00:00Z',ended_at:'2026-11-01T12:30:00Z',punch_sessions:{started_at:'2026-11-01T12:00:00Z',ended_at:'2026-11-01T12:30:00Z'}};
 const breaks=[
  {session_id:'s',is_paid:false,started_at:'2026-11-01T10:00:00Z',ended_at:'2026-11-01T15:00:00Z'},
  {session_id:'s',is_paid:false,started_at:'bad',ended_at:null},
  {session_id:'s',is_paid:false,started_at:'2026-11-01T12:30:00Z',ended_at:'2026-11-01T12:00:00Z'}
 ];
 assert.deepEqual(segmentExportDuration(row,breaks),{gross:'0.5000',unpaid:'0.5000',net:'0.0000',anomaly:''});
});

test('CSV comes from scoped server sessions and associated breaks only',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/async function exportHours\(\)\{/);
 assert.match(app,/let rows=\[\],offset=0/);
 assert.match(app,/if\(selfOnly\)q=q\.eq\('punch_sessions\.user_id',userId\)/);
 assert.match(app,/for\(const ids of sessionIdChunks\(rows\)\)/);
 assert.match(app,/\.eq\('company_id',companyId\)\.in\('session_id',ids\)/);
 assert.match(app,/if\(company\(\)!==companyId\|\|state\.user\?\.id!==userId\)throw/);
 assert.match(app,/const data=createHoursCsv\(\{/);
 assert.match(app,/let rows=\[\],offset=0/);
 assert.doesNotMatch(app,/const paused=r=>breaks\.filter/);
});

test('CSV excludes payable time beyond parent session and clips unpaid break once',()=>{
 const row={session_id:'s',started_at:'2026-11-04T07:00:00Z',ended_at:'2026-11-04T12:00:00Z'};
 const parent={started_at:'2026-11-04T08:00:00Z',ended_at:'2026-11-04T10:00:00Z'};
 const pauses=[{session_id:'s',is_paid:false,started_at:'2026-11-04T07:30:00Z',ended_at:'2026-11-04T08:30:00Z'}];
 assert.deepEqual(segmentExportDuration(row,pauses,parent),
  {gross:'2.0000',unpaid:'0.5000',net:'1.5000',anomaly:'SEGMENT HORS SESSION'});
});
test('CSV never invents confirmed hours for missing or disjoint parent sessions',()=>{
 const row={session_id:'s',started_at:'2026-11-04T07:00:00Z',ended_at:'2026-11-04T08:00:00Z'};
 assert.deepEqual(segmentExportDuration(row,[],{started_at:'2026-11-04T10:00:00Z',ended_at:'2026-11-04T12:00:00Z'}),
  {gross:'',unpaid:'',net:'',anomaly:'SEGMENT HORS SESSION'});
 for(const parent of [null,{}, {started_at:'bad',ended_at:null},
  {started_at:'2026-11-04T10:00:00Z',ended_at:'2026-11-04T09:00:00Z'}]){
  assert.deepEqual(segmentExportDuration(row,[],parent),
   {gross:'',unpaid:'',net:'',anomaly:'SESSION NON VÉRIFIÉE'});
 }
});
