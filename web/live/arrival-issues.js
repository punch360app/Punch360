// NAV-007: voluntary notice, not verified lateness, attendance, wages or location.
export const ARRIVAL_ISSUE_LABELS=[['late','Prévenir d’un retard'],['access','Signaler un problème d’accès']];
export function arrivalIssuePayload(kind,message,estimate){
 if(!ARRIVAL_ISSUE_LABELS.some(row=>row[0]===kind))throw Error('Choisissez le type de signalement.');
 const note=String(message??'').trim();
 if(note.length>500)throw Error('La précision ne peut dépasser 500 caractères.');
 const eta=String(estimate??'').trim();
 if(kind==='access'&&eta)throw Error('Aucune estimation de retard pour un problème d’accès.');
 let minutes=null;
 if(kind==='late'&&eta){
  if(!/^\d{1,3}$/.test(eta)||Number(eta)<1||Number(eta)>240)throw Error('Estimation facultative entre 1 et 240 minutes.');
  minutes=Number(eta);
 }
 return {p_kind:kind,p_message:note,p_estimate_minutes:minutes};
}
export function arrivalIssueForShift(items,shiftId,kind){
 return Array.isArray(items)?items.find(item=>item.shift_id===shiftId&&item.kind===kind)||null:null;
}
export function canReportArrivalIssue(shift,own,existing,now=Date.now()){
 if(!own||!shift||shift.worker_id!==own||shift.cancelled_at||existing)return false;
 const start=Date.parse(shift.starts_at),end=Date.parse(shift.ends_at);
 return Number.isFinite(start)&&Number.isFinite(end)&&start<end&&end>=now-12*3600000&&start<=now+90*86400000;
}
export function arrivalStatusLabel(row){
 return row?.status==='acknowledged'?'Pris en charge par le responsable':'Signalement transmis — en attente de prise en charge';
}
