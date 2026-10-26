// Read-only alternate presentations of the ONE authoritative scheduled_shifts dataset.
// No extra calendar table, no publish, no GPS or travel-duration inference.
const dateOnly=(iso,zone)=>{
 const d=new Date(iso);
 if(!Number.isFinite(d.getTime()))return null;
 try{
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
 }catch{return null;}
};
const dayStamp=value=>{const d=new Date(value+'T12:00:00Z');return !Number.isFinite(d.getTime())?null:d;};
const dayString=d=>d.toISOString().slice(0,10);
export function weekStartIso(value){
 const d=dayStamp(value);if(!d||dayString(d)!==value)throw Error('Choisissez une date AAAA-MM-JJ valide.');
 const weekday=d.getUTCDay()||7;
 d.setUTCDate(d.getUTCDate()-(weekday-1));
 return dayString(d);
}
export function scheduleViewWindow(day,period){
 if(period==='all')return null;
 if(!['day','week'].includes(period))throw Error('Période invalide.');
 const date=period==='week'?weekStartIso(day):day;
 const d=dayStamp(date);
 if(!d||dayString(d)!==date)throw Error('Choisissez une date valide.');
 const end=new Date(d);end.setUTCDate(end.getUTCDate()+(period==='week'?7:1));
 return {from:date,to:dayString(end)};
}
function shiftAtDate(shift,window){
 if(!window)return true;
 const zone=shift.timezone||'UTC';
 const start=dateOnly(shift.starts_at,zone),end=dateOnly(shift.ends_at,zone);
 if(!start||!end)return false;
 // Start/end spans local days; midnight termination does not occupy the next day.
 const endAtMidnight=String(shift.ends_at)&&new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(shift.ends_at))==='00:00';
 return start<window.to&&(end>window.from||(end===window.from&&!endAtMidnight));
}
export function scheduleViewOptions(shifts,assignedSites){
 const byId=new Map((assignedSites||[]).map(x=>[x.shift_id,x]));
 const clientNames=new Set(),sites=new Map(),workers=new Map();
 for(const sh of shifts||[]){
  if(sh.cancelled_at)continue;
  const a=byId.get(sh.id);
  if(a?.client_name)clientNames.add(a.client_name);
  if(a?.client_site_id)sites.set(a.client_site_id,[a.client_name,a.site_name,a.city].filter(Boolean).join(' · '));
  if(sh.worker_id)workers.set(sh.worker_id,sh.worker_id);
 }
 return {clients:[...clientNames].sort((a,b)=>a.localeCompare(b,'fr-CA')),
  sites:[...sites].map(([id,label])=>({id,label})).sort((a,b)=>a.label.localeCompare(b.label,'fr-CA')),
  workerIds:[...workers.keys()]};
}
export function buildScheduleView({shifts=[],assignedSites=[],mode='employee',period='all',day='',department='',client='',site='',worker='',workerName=(id)=>'',branchName=(id)=>''}={}){
 if(!['employee','site'].includes(mode))throw Error('Vue calendrier inconnue.');
 const window=scheduleViewWindow(day,period);
 const byId=new Map(assignedSites.map(s=>[s.shift_id,s]));
 const rows=[];
 for(const sh of shifts){
  if(sh.cancelled_at||!shiftAtDate(sh,window))continue;
  if(department&&sh.department_id!==department)continue;
  const dest=byId.get(sh.id)||null;
  if(client&&dest?.client_name!==client)continue;
  if(site&&dest?.client_site_id!==site)continue;
  if(worker&&sh.worker_id!==worker)continue;
  const workerLabel=sh.worker_id?workerName(sh.worker_id):'Quart sans salarié';
  const label=dest?[dest.client_name,dest.site_name,dest.city].filter(Boolean).join(' · ')
   :'Adresse client non attribuée · '+branchName(sh.location_id);
  const key=mode==='employee'?'employee:'+(sh.worker_id||'vacant'):'site:'+(dest?.client_site_id||'none:'+sh.location_id);
  rows.push({...sh,assignedSite:dest,groupKey:key,groupTitle:mode==='employee'?workerLabel:label,
   simultaneousConflict:false,immediateSiteChange:false,vacant:!sh.worker_id,withoutClientSite:!dest});
 }
 // Real intersections only; two colleagues at one site are allowed.
 const groupsByWorker=new Map();
 for(const sh of rows)if(sh.worker_id){
  if(!groupsByWorker.has(sh.worker_id))groupsByWorker.set(sh.worker_id,[]);
  groupsByWorker.get(sh.worker_id).push(sh);
 }
 const clashes=new Set(),backToBack=new Set();
 for(const list of groupsByWorker.values()){
  list.sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||a.id.localeCompare(b.id));
  for(let i=0;i<list.length;i++){
   const a=list[i],aEnd=Date.parse(a.ends_at);
   for(let j=i+1;j<list.length;j++){
    const b=list[j],bStart=Date.parse(b.starts_at);
    if(bStart>=aEnd){
     if(bStart===aEnd&&a.client_site_id&&b.client_site_id&&a.client_site_id!==b.client_site_id){
      backToBack.add(a.id);backToBack.add(b.id);
     }
     break;
    }
    // Real overlap in UTC regardless of timezone and DST.
    if(bStart<aEnd&&Date.parse(b.ends_at)>Date.parse(a.starts_at)){
     clashes.add(a.id);clashes.add(b.id);
    }
   }
  }
 }
 for(const sh of rows){sh.simultaneousConflict=clashes.has(sh.id);sh.immediateSiteChange=backToBack.has(sh.id);}
 rows.sort((a,b)=>a.groupTitle.localeCompare(b.groupTitle,'fr-CA')||
  Date.parse(a.starts_at)-Date.parse(b.starts_at)||a.id.localeCompare(b.id));
 const groups=[];for(const sh of rows){
  let group=groups[groups.length-1];
  if(!group||group.key!==sh.groupKey){group={key:sh.groupKey,title:sh.groupTitle,shifts:[]};groups.push(group);}
  group.shifts.push(sh);
 }
 const stats={shifts:rows.length,overlappingShifts:rows.filter(x=>x.simultaneousConflict).length,
  unassigned:rows.filter(x=>x.vacant).length,withoutClientSite:rows.filter(x=>x.withoutClientSite).length,
  immediateChanges:rows.filter(x=>x.immediateSiteChange).length};
 return {groups,rows,stats,period:window,mode};
}
