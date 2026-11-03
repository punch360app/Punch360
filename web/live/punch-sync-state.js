/** Local, non-authoritative status of attendance events persisted on this device.
 * This never converts a journal event into an official punch or hours record.
 * Only show records of the authenticated worker in the selected company.
 */
const LABELS=Object.freeze({
 in:'Entrée',out:'Sortie',transfer:'Changement de chantier',
 break_start:'Début de pause',break_end:'Fin de pause'
});
export function isOwnPunchJournalEvent(event,companyId,userId){
 return typeof companyId==='string'&&companyId.length>0&&
  typeof userId==='string'&&userId.length>0&&
  event?.company===companyId&&event.user===userId&&
  typeof event.id==='string'&&event.id.length>0;
}
export function localPunchSyncState(events,companyId,userId){
 const pending=[],conflicts=[];
 if(!Array.isArray(events)||typeof companyId!=='string'||!companyId||
    typeof userId!=='string'||!userId)return {pending,conflicts};
 for(const event of events){
  if(!isOwnPunchJournalEvent(event,companyId,userId))continue;
  if(event.status!=='pending'&&event.status!=='conflict')continue;
  // Never surface raw GPS fixes, server responses or cached job information.
  const record={
   label:Object.hasOwn(LABELS,event.action)?LABELS[event.action]:'Action inconnue',
   occurredAt:typeof event.occurredAt==='string'&&
    /^\d{4}-\d{2}-\d{2}T/.test(event.occurredAt)&&
    Number.isFinite(Date.parse(event.occurredAt))?event.occurredAt:null
  };
  if(event.status==='pending')pending.push(record);
  else conflicts.push(record);
 }
 return {pending,conflicts};
}

/**
 * UI wording is deliberately not equivalent to payroll approval.
 * A locally acknowledged event may still require GPS review or reconciliation.
 */
export function localPunchStatusSummary({events,companyId,userId,snapshotCompanyId,snapshotFetchedAt,journalBlocked=false}={}){
 // A corrupt local queue must not be hidden behind a valid but unrelated
 // server snapshot label. Server hours remain separately readable.
 if(journalBlocked===true&&typeof companyId==='string'&&companyId&&
  typeof userId==='string'&&userId)
  return {kind:'blocked',label:'Journal local à vérifier'};
 const {pending,conflicts}=localPunchSyncState(events,companyId,userId);
 if(pending.length&&conflicts.length)
  return {kind:'mixed',label:'En attente et conflit à vérifier'};
 if(conflicts.length)return {kind:'conflict',label:'Conflit à vérifier'};
 if(pending.length)return {kind:'pending',label:'En attente d’envoi'};
 if(typeof companyId==='string'&&companyId&&snapshotCompanyId===companyId&&
    Number.isFinite(snapshotFetchedAt))
  return {kind:'server',label:'Dernier relevé serveur'};
 return {kind:'unverified',label:'Relevé à vérifier'};
}
