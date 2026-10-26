// MLOC-007 (partial). Read-only gross scheduled hours per customer/location.
// Never label scheduled work as punched or paid time. If a worker has contradictory
// simultaneous shifts at DIFFERENT sites, ambiguous minutes are NOT attributed.
const iso=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&
 Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const millis=d=>Date.parse(d+'T00:00:00Z');
const hours=ms=>Math.round(ms/36000)/100;
export function plannedClientReport({shifts=[],assignedSites=[],from,to,worker='',site='',department='',loadedFrom=null,loadedTo=null,incomplete=false}){
 if(!iso(from)||!iso(to)||millis(to)<=millis(from)||millis(to)-millis(from)>31*86400000)
  throw Error('Période UTC invalide : du inclusif, au exclusif, maximum 31 jours.');
 if(loadedFrom&&(!iso(loadedFrom)||millis(from)<millis(loadedFrom)))throw Error('Période antérieure aux quarts chargés : ajustez la période du calendrier et rechargez.');
 if(loadedTo&&(!iso(loadedTo)||millis(to)>millis(loadedTo)))throw Error('Période postérieure aux quarts chargés : ajustez la période du calendrier et rechargez.');
 if(incomplete||shifts.length>=1000)throw Error('Quarts ou adresses tronqués : réduisez la période et rechargez avant le rapport ou son export.');
 const start=millis(from),end=millis(to);
 const siteMap=new Map(assignedSites.map(x=>[x.shift_id,x]));
 const grouped=new Map(),uniqueShifts=new Set();
 const assigned=shifts.filter(s=>{
  if(!s||s.cancelled_at||!s.id||!s.starts_at||!s.ends_at)return false;
  const a=Date.parse(s.starts_at),b=Date.parse(s.ends_at);
  return Number.isFinite(a)&&Number.isFinite(b)&&a<b&&a<end&&b>start;
 }).map(s=>{
  const destination=siteMap.get(s.id);
  if(s.client_site_id&&!destination)throw Error('Adresse d’un quart manquante : synchronisation incomplète.');
  return {...s,_dest:destination||null,_start:Math.max(start,Date.parse(s.starts_at)),
   _end:Math.min(end,Date.parse(s.ends_at))};
 });
 const workers=new Map();
 let vacantMs=0,unassignedMs=0,conflictMs=0,sameSiteOverlapMs=0;
 for(const sh of assigned){
  if(!sh.worker_id){if((!worker||worker==='__vacant__')&&(!department||sh.department_id===department)&&(!site||sh.client_site_id===site))vacantMs+=sh._end-sh._start;continue;}
  const set=workers.get(sh.worker_id)||[];set.push(sh);workers.set(sh.worker_id,set);
 }
 for(const [workerId,list] of workers){
  if(worker&&worker!==workerId)continue;
  const times=[...new Set(list.flatMap(s=>[s._start,s._end]))].sort((a,b)=>a-b);
  for(let i=1;i<times.length;i++){
   const a=times[i-1],z=times[i];if(a===z)continue;
   const overlapping=list.filter(x=>x._start<z&&x._end>a);
   if(!overlapping.length)continue;
   const destinations=new Set(overlapping.map(x=>x.client_site_id||'__unassigned__'));
   const matching=overlapping.filter(x=>(!department||x.department_id===department)&&(!site||x.client_site_id===site));
   if(!matching.length)continue;
   if(destinations.size>1){
    conflictMs+=z-a;continue;
   }
   if(overlapping.length>1)sameSiteOverlapMs+=z-a;
   const item=matching[0],destination=item._dest,key=item.client_site_id||'__unassigned__';
   const rec=grouped.get(key)||{clientId:destination?.client_id||null,client:destination?.client_name||'Sans client',
    siteId:item.client_site_id||null,site:destination?.site_name||'Adresse non attribuée',
    city:destination?.city||'',scheduledMs:0,workers:new Set(),shifts:new Set()};
   rec.scheduledMs+=z-a;rec.workers.add(workerId);
   for(const sh of matching)rec.shifts.add(sh.id);
   grouped.set(key,rec);uniqueShifts.add(item.id);
   if(!item.client_site_id)unassignedMs+=z-a;
  }
 }
 const rows=[...grouped.values()].map(x=>({
  clientId:x.clientId,client:x.client,siteId:x.siteId,site:x.site,city:x.city,
  scheduledMs:x.scheduledMs,scheduledHours:hours(x.scheduledMs),workers:x.workers.size,shifts:x.shifts.size
 })).sort((a,b)=>(a.client+' '+a.site).localeCompare(b.client+' '+b.site,'fr-CA'));
 const totalMs=rows.reduce((n,x)=>n+x.scheduledMs,0);
 return {from,to,rows,totalMs,totalHours:hours(totalMs),
  conflictMs,conflictHours:hours(conflictMs),sameSiteOverlapMs,sameSiteOverlapHours:hours(sameSiteOverlapMs),
  vacantMs,vacantHours:hours(vacantMs),unassignedMs,unassignedHours:hours(unassignedMs),filtered:!!(worker||site||department),
  actualAvailable:false,actualHours:null};
}
const csv=(value)=>{
 let s=String(value??'');
 if(/^[=+@\t\r\n-]/.test(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
};
export function plannedClientReportCsv(report){
 if(!report||!Array.isArray(report.rows))throw Error('Rapport à calculer avant export.');
 const header=['Client','Lieu','Ville','Heures prévues brutes uniques','Salariés','Quarts','Début UTC','Fin UTC exclusive','Heures réellement attribuées'];
 const rows=report.rows.map(x=>[x.client,x.site,x.city,x.scheduledHours.toFixed(2),x.workers,x.shifts,report.from,report.to,'Non disponibles']);
 const end=[['Heures ambiguës exclues',report.conflictHours.toFixed(2)],['Chevauchements même lieu dédupliqués',report.sameSiteOverlapHours.toFixed(2)],['Heures de quarts à combler (séparées)',report.vacantHours.toFixed(2)]];
 return '\uFEFF'+[header,...rows,...end].map(row=>row.map(csv).join(',')).join('\r\n')+'\r\n';
}
