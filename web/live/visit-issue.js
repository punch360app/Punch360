/** NAV-007: voluntary messages for an employee's own published shift. */
export const VISIT_ISSUE_KINDS=[['late','Prévenir d’un retard'],['access','Signaler un problème d’accès']];
export function visitIssueForShift(items,shiftId,kind){
 return (Array.isArray(items)?items:[]).find(x=>x.shift_id===shiftId&&x.kind===kind)||null;
}
export function canReportVisitIssue(shift,workerId,existing,now=Date.now()){
 const start=Date.parse(shift?.starts_at),end=Date.parse(shift?.ends_at);
 return !!(workerId&&shift?.id&&shift.worker_id===workerId&&shift.version>0&&!shift.cancelled_at&&
  Number.isFinite(start)&&Number.isFinite(end)&&end>now&&start<=now+72*3600000&&!existing);
}
export function prepareVisitIssue(kind,note){
 if(!VISIT_ISSUE_KINDS.some(([value])=>value===kind))throw Error('Choisissez retard ou problème d’accès.');
 const normalized=String(note??'').trim();
 if(normalized.length>240)throw Error('Précision trop longue (240 caractères maximum).');
 return {p_kind:kind,p_note:normalized};
}
export function visitIssueLabel(issue){
 return issue?.kind==='late'?'Retard signalé':issue?.kind==='access'?'Problème d’accès signalé':'Avis indisponible';
}
