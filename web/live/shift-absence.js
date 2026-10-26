// Shared Essentiel Plus/Pro absence vocabulary. Reasons remain server-private.
export const ABSENCE_REASONS=Object.freeze([
 ['illness','Maladie'],
 ['child_illness','Enfant malade'],
 ['medical_appointment','Rendez-vous médical'],
 ['family_emergency','Urgence familiale'],
 ['family_care','Obligation familiale ou garde'],
 ['transport','Problème de transport'],
 ['personal','Raison personnelle'],
 ['other','Autre'],
 ['undisclosed','Je préfère ne pas préciser']
]);
const CODES=new Set(ABSENCE_REASONS.map(([code])=>code));
export const ABSENCE_STATUS=Object.freeze({
 reported:'Absence signalée · en attente de prise en charge',
 acknowledged:'Absence signalée · prise en charge',
 follow_up:'Absence signalée · votre responsable communiquera avec vous'
});
export function absenceStatus(status){
 return ABSENCE_STATUS[status]||'Absence signalée';
}
export function prepareAbsence(reason,note){
 if(!CODES.has(reason))throw Error('Choisissez un motif, ou « Je préfère ne pas préciser ».');
 const detail=String(note??'').trim();
 if(detail.length>400)throw Error('La précision est limitée à 400 caractères.');
 return {p_reason:reason,p_note:detail};
}
export function canReportShift(shift,workerId,alreadyReported,now=Date.now()){
 if(!shift||!workerId||alreadyReported||shift.cancelled_at||shift.worker_id!==workerId)return false;
 const start=Date.parse(shift.starts_at),end=Date.parse(shift.ends_at);
 return Number.isFinite(start)&&Number.isFinite(end)&&end>now&&start<=now+90*86400000;
}
export function absenceForShift(rows,shiftId){return (rows||[]).find(a=>a.shift_id===shiftId)||null;}
