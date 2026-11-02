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
const millis=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
const csvCell=value=>{
 const raw=String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ');
 const safe=/^[\s\uFEFF]*[=+@-]/.test(raw)?"'"+raw:raw;
 return '"'+safe.replaceAll('"','""')+'"';
};
function unpaidBreakMs(start,end,pauses){
 const ranges=pauses.filter(b=>b.is_paid===false).map(b=>{
  const a=millis(b.started_at),z=b.ended_at==null?end:millis(b.ended_at);
  return a===null||z===null||z<a?null:[Math.max(start,a),Math.min(end,z)];
 }).filter(p=>p&&p[1]>p[0]).sort((a,b)=>a[0]-b[0]);
 let time=0,lastEnd=start;
 for(const [a,z] of ranges){const begin=Math.max(lastEnd,a);if(z>begin)time+=z-begin;lastEnd=Math.max(lastEnd,z);}
 return Math.min(end-start,time);
}
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
  const worker=r.punch_sessions,begin=millis(r.started_at),end=r.ended_at==null?null:millis(r.ended_at);
  const invalid=begin===null||(r.ended_at!==null&&(end===null||end<begin));
  const open=r.ended_at==null;
  const gross=!open&&!invalid?end-begin:null;
  const pause=gross===null?null:unpaidBreakMs(begin,end,indexed.get(r.session_id)||[]);
  const hours=v=>v===null?'':(v/3600000).toFixed(4);
  const anomaly=invalid?'HORODATAGE INVALIDE':open?'SORTIE MANQUANTE':gross>16*3600000?'PLUS DE 16H':'';
  const person=essential?(roster.find(w=>w.id===worker.worker_id)?.employee_number||
    worker.worker_id||worker.user_id):worker.user_id||worker.worker_id;
  const location=essential?(locations.find(w=>w.punch_job_id===r.job_id&&w.company_id===companyId)?.name||'Établissement'):
   (jobs.find(j=>j.id===r.job_id&&j.company_id===companyId)?.number||r.job_id);
  return [r.id,person,location,r.started_at,r.ended_at||'',hours(gross),hours(pause),
   hours(gross===null?null:Math.max(0,gross-pause)),anomaly];
 });
 return {header,rows:output,csv:'\uFEFF'+[header,...output].map(row=>row.map(csvCell).join(';')).join('\r\n')};
}
