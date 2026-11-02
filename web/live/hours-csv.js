import {segmentExportDuration} from './essential-hours-export.js';
/**
 * Read-only CSV projection of server-fetched punches. This module does not
 * perform permission checks: the database RLS + membership checks own those.
 * All input records are nevertheless scoped to the selected company/user.
 */
export function personalHoursExport(role,section){
 return !['boss','admin'].includes(role)||section==='hours';
}
export function hoursExportScope(companyId,userId,role,section){
 if(typeof companyId!=='string'||!companyId||
  typeof userId!=='string'||!userId)throw Error('Entreprise ou utilisateur non vérifié.');
 return {companyId,userId,ownOnly:personalHoursExport(role,section)};
}
const csvCell=value=>{
 const raw=String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ');
 const safe=/^[\s\uFEFF]*[=+@-]/.test(raw)?"'"+raw:raw;
 return '"'+safe.replaceAll('"','""')+'"';
};
export function createHoursCsv({companyId,userId,ownOnly=true,rows=[],breaks=[],
 essential=false,roster=[],locations=[],jobs=[]}={}){
 if(typeof companyId!=='string'||!companyId||
  typeof userId!=='string'||!userId||!Array.isArray(rows)||!Array.isArray(breaks))
  throw Error('Relevé incomplet : impossible de préparer le CSV.');
 const allowed=rows.filter(r=>r?.company_id===companyId&&
  r.punch_sessions?.company_id===companyId&&
  (!ownOnly||r.punch_sessions?.user_id===userId));
 const sessionIds=new Set(allowed.map(r=>r.session_id));
 const indexed=new Map();
 for(const b of breaks){
  if(!b||b.company_id!==companyId||!sessionIds.has(b.session_id))continue;
  if(!indexed.has(b.session_id))indexed.set(b.session_id,[]);
  indexed.get(b.session_id).push(b);
 }
 const header=['Segment',essential?'Matricule':'Employé',essential?'Lieu':'Job',
  'Entrée ISO','Sortie ISO','Heures brutes','Pauses non payées (h)','Heures nettes','Anomalie'];
 const output=allowed.map(r=>{
  const worker=r.punch_sessions;
  const duration=segmentExportDuration(r,indexed.get(r.session_id)||[]);
  const person=essential?(roster.find(w=>w.id===worker.worker_id)?.employee_number||
    worker.worker_id||worker.user_id):worker.user_id||worker.worker_id;
  const location=essential?(locations.find(w=>w.punch_job_id===r.job_id&&w.company_id===companyId)?.name||'Établissement'):
   (jobs.find(j=>j.id===r.job_id&&j.company_id===companyId)?.number||r.job_id);
  return [r.id,person,location,r.started_at,r.ended_at||'',duration.gross,duration.unpaid,
   duration.net,duration.anomaly];
 });
 return {header,rows:output,csv:'\uFEFF'+[header,...output].map(row=>row.map(csvCell).join(';')).join('\r\n')};
}
