/**
 * MISSION-011 (partial): manager-only display helpers over an ALREADY authorized
 * list_essential_missions day snapshot. Never queries unrestricted worker/client
 * tables or interprets incomplete work as an absence/late arrival.
 */
import {missionIssueLabel} from './mission-issues.js';
export const MISSION_STATES=[['','Tous les états'],['draft','Brouillon'],['published','À faire'],['in_progress','En cours'],['completed','Terminé'],['impossible','Impossible'],['postponed','Reportée'],['cancelled','Annulé']];
export function missionDayReview(rows,filter={},truncated=false){
 if(!Array.isArray(rows))throw Error('Liste des missions invalide.');
 const allowed=new Set(MISSION_STATES.map(x=>x[0]));
 const state=String(filter.status||'');
 if(!allowed.has(state))throw Error('État de mission inconnu.');
 const worker=String(filter.worker||''),client=String(filter.client||'').trim().toLocaleLowerCase('fr-CA');
 const authorized=rows.filter(row=>row&&['draft','published','in_progress','completed','impossible','postponed','cancelled'].includes(row.status));
 const all={draft:0,published:0,in_progress:0,completed:0,impossible:0,postponed:0,cancelled:0};
 for(const item of authorized)all[item.status]++;
 const scoped=authorized.filter(row=>(!worker||row.worker_id===worker)&&(!client||String(row.client_name||'').toLocaleLowerCase('fr-CA').includes(client)));
 const counts={draft:0,published:0,in_progress:0,completed:0,impossible:0,postponed:0,cancelled:0};
 for(const item of scoped)counts[item.status]++;
 const visible=scoped.filter(x=>!state||x.status===state).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)||String(a.id).localeCompare(String(b.id)));
 return {visible,counts,all,scopedTotal:scoped.length,shown:visible.length,complete:counts.completed,
  remaining:counts.published,truncated:!!truncated,exportable:!truncated};
}
const csvCell=value=>{
 const str=String(value??'');
 const protectedValue=/^[\s\uFEFF]*[=+@\-\t\r\n]/.test(str)?"'"+str:str;
 return '"'+protectedValue.replaceAll('"','""').replace(/[\u0000-\u001F]/g,' ').trim()+'"';
};
export function missionDayReviewCsv(report,day){
 if(!report?.exportable||!Array.isArray(report.visible))throw Error('Liste incomplète : export refusé. Choisissez une journée plus petite.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(day))||!Number.isFinite(Date.parse(day+'T12:00:00Z')))
  throw Error('Date de mission invalide.');
 const labels=Object.fromEntries(MISSION_STATES);
 const cols=['Date','Employé','Client','Lieu','Ville','Mission','Ordre','État','Motif de mission impossible','Nouvelle journée (si reportée)','Fin confirmée (UTC)'];
 const rows=report.visible.map(m=>[m.mission_day||day,[m.first_name,m.last_name].filter(Boolean).join(' '),
  m.client_name,m.site_name,m.city,m.title,m.sort_order,labels[m.status]||m.status,
  m.status==='impossible'?missionIssueLabel(m.issue_reason):'',m.issue_decision==='postpone'?(m.effective_day||m.mission_day):'',m.completed_at||'']);
 return '\uFEFF'+[cols,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
