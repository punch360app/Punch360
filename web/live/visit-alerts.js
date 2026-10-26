// NAV-007 — a voluntary communication about an assigned scheduled visit.
// Never compute a delay, arrival, ETA, distance or GPS position from this input.
export const VISIT_ALERT_KINDS=[
 {id:'possible_delay',label:'Retard possible'},
 {id:'access_issue',label:'Problème d’accès'}
];
export function canSendVisitAlert(shift,workerId,now=Date.now()){
 if(!shift||!workerId||!shift.id||shift.worker_id!==workerId||shift.cancelled_at)return false;
 const start=Date.parse(shift.starts_at),end=Date.parse(shift.ends_at);
 return Number.isFinite(start)&&Number.isFinite(end)&&end>start&&
  now>=start-48*3600000&&now<=end+6*3600000;
}
export function prepareVisitAlert(shift,workerId,kind,note,request,now=Date.now()){
 if(!canSendVisitAlert(shift,workerId,now))throw Error('Ce quart n’est pas autorisé ou sa période de signalement est terminée.');
 if(!VISIT_ALERT_KINDS.some(x=>x.id===kind))throw Error('Choisissez un type de signalement.');
 const clean=String(note??'').trim();
 if(clean.length>500)throw Error('Le commentaire ne peut dépasser 500 caractères.');
 if(typeof request!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(request))
  throw Error('Identifiant de demande invalide.');
 return {p_shift:shift.id,p_kind:kind,p_note:clean,p_request:request};
}
export function visitAlertLabel(row){
 if(!row)return '';
 const kind=VISIT_ALERT_KINDS.find(x=>x.id===row.kind)?.label||'Signalement';
 return kind+' · '+(row.status==='acknowledged'?'Pris en charge':'Transmis au responsable');
}
