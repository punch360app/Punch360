/** Local, non-authoritative status of attendance events persisted on this device.
 * This never converts a journal event into an official punch or hours record.
 * Only show records of the authenticated worker in the selected company.
 */
const LABELS=Object.freeze({
 in:'Entrée',out:'Sortie',transfer:'Changement de chantier',
 break_start:'Début de pause',break_end:'Fin de pause'
});
export function localPunchSyncState(events,companyId,userId){
 const pending=[],conflicts=[];
 if(!Array.isArray(events)||typeof companyId!=='string'||!companyId||
    typeof userId!=='string'||!userId)return {pending,conflicts};
 for(const event of events){
  if(!event||event.company!==companyId||event.user!==userId||
     typeof event.id!=='string'||!event.id)continue;
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
