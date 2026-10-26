import {assignedSiteAddress,assignedSiteMapsUrl} from './shift-client-sites.js';
/**
 * MLOC-004 partial: select a destination already authorized for this worker.
 * Never infer a GPS location, an active attendance session, travel time or punch action.
 * Managers may receive other workers' shifts from the server, so the worker filter is mandatory.
 */
export function personalUpcomingClientVisit(items,workerId,at=Date.now(),futureHours=48){
 if(!workerId||!Array.isArray(items)||!Number.isFinite(at))return null;
 const horizon=at+futureHours*3600000;
 if(!Number.isFinite(horizon)||futureHours<1||futureHours>168)throw Error('Fenêtre de visites invalide.');
 const rows=items.filter(x=>{
  if(!x||x.worker_id!==workerId||!x.client_site_id||!x.shift_id)return false;
  const start=Date.parse(x.starts_at),end=Date.parse(x.ends_at);
  return Number.isFinite(start)&&Number.isFinite(end)&&start<end&&end>at&&start<horizon;
 }).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||String(a.shift_id).localeCompare(String(b.shift_id)));
 if(!rows.length)return null;
 const ongoing=rows.find(x=>Date.parse(x.starts_at)<=at&&Date.parse(x.ends_at)>at);
 const choice=ongoing||rows[0];
 return {shift_id:choice.shift_id,site_id:choice.client_site_id,
  client:choice.client_name||'',title:choice.site_name||'Lieu de travail',
  start:choice.starts_at,end:choice.ends_at,
  address:assignedSiteAddress(choice),
  instructions:choice.access_instructions||'',
  contact:choice.contact_name||'',phone:choice.contact_phone||'',
  ongoing:!!ongoing,
  route:assignedSiteMapsUrl(choice)};
}
