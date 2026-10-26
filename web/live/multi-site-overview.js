/**
 * MLOC-003: two read-only views of the SAME scheduled_shifts rows.
 * No second calendar, no route-duration guesses and no new company-wide permission.
 * The caller must pass only shifts/RPC client destinations already authorized for its role.
 */
const dateOnly=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&
 !Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const isoDate=(time,zone)=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time));
 const x=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return x.year+'-'+x.month+'-'+x.day;
};
export function overviewRange(day,period='day'){
 if(!dateOnly(day)||!['day','week'].includes(period))throw Error('Jour et période valides requis.');
 const d=new Date(day+'T12:00:00Z');
 if(period==='week'){d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));}
 const from=d.toISOString().slice(0,10);
 if(period==='week')d.setUTCDate(d.getUTCDate()+6);
 return {from,to:d.toISOString().slice(0,10)};
}
export function overviewLocalDate(instant,zone){return isoDate(instant,zone);}
export function buildMultiSiteOverview({shifts=[],assignedSites=[],roster=[],day,period='day',view='employee',
 worker='',site='',department=''}) {
 const {from,to}=overviewRange(day,period);
 if(!['employee','location'].includes(view))throw Error('Vue inconnue.');
 const siteMap=new Map((assignedSites||[]).map(x=>[x.shift_id,x]));
 const rosterMap=new Map((roster||[]).map(x=>[x.id,x.name||[x.first_name,x.last_name].filter(Boolean).join(' ')]));
 const eligible=(shifts||[]).filter(s=>{
  if(!s||s.cancelled_at||!s.id||!s.starts_at||!s.ends_at)return false;
  const start=Date.parse(s.starts_at),end=Date.parse(s.ends_at);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return false;
  return isoDate(start,s.timezone)<=to&&isoDate(end-1,s.timezone)>=from;
 });
 const byEmployee=new Map();
 for(const sh of eligible){
  if(!sh.worker_id)continue;
  const list=byEmployee.get(sh.worker_id)||[];
  list.push(sh);byEmployee.set(sh.worker_id,list);
 }
 const overlaps=new Set(),travels=new Set();
 for(const list of byEmployee.values()){
  list.sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
   const a=list[i],b=list[j];
   if(Date.parse(b.starts_at)<Date.parse(a.ends_at)){
    overlaps.add(a.id);overlaps.add(b.id);
   }else break;
  }
  for(let i=1;i<list.length;i++){
   const a=list[i-1],b=list[i],aSite=siteMap.get(a.id),bSite=siteMap.get(b.id);
   if(aSite?.client_site_id&&bSite?.client_site_id&&aSite.client_site_id!==bSite.client_site_id
    &&Date.parse(b.starts_at)>=Date.parse(a.ends_at)
    &&Date.parse(b.starts_at)-Date.parse(a.ends_at)<=3600000){
    travels.add(a.id);travels.add(b.id);
   }
  }
 }
 const filtered=eligible.filter(sh=>{
  const destination=siteMap.get(sh.id);
  return (!worker||sh.worker_id===worker)&&(!department||sh.department_id===department)
    &&(!site||destination?.client_site_id===site);
 }).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||String(a.id).localeCompare(String(b.id)));
 const groups=new Map();
 for(const sh of filtered){
  const destination=siteMap.get(sh.id);
  const workerName=sh.worker_id?(rosterMap.get(sh.worker_id)||'Salarié'):'Quart à combler';
  const clientName=destination?.client_name||'';
  const placeName=destination?.site_name||'Adresse d’intervention non affectée';
  const key=view==='employee'?(sh.worker_id||'__vacant__'):(destination?.client_site_id||'__no_site__');
  const label=view==='employee'?workerName:(clientName?clientName+' · '+placeName:placeName);
  if(!groups.has(key))groups.set(key,{key,label,items:[]});
  groups.get(key).items.push({id:sh.id,shift:sh,workerName,clientName,placeName,
   address:destination?[destination.address_line,destination.unit,destination.city,
    destination.region,destination.postal_code].filter(Boolean).join(', '):'',
   overlap:overlaps.has(sh.id),travelCheck:travels.has(sh.id)});
 }
 return {from,to,view,groups:[...groups.values()].sort((a,b)=>a.label.localeCompare(b.label,'fr-CA')),
  shown:filtered.length,overlapShifts:filtered.filter(s=>overlaps.has(s.id)).length,
  noWorker:filtered.filter(s=>!s.worker_id).length,
  noSite:filtered.filter(s=>!siteMap.get(s.id)?.client_site_id).length,
  travelCheckShifts:filtered.filter(s=>travels.has(s.id)).length,
  incomplete:(shifts||[]).length>=1000};
}
