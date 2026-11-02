/**
 * Read-only employee request overview. Every input is an already-scoped view
 * from its own J1 Essentiel controller. This is not a payroll approval state.
 * Counts describe recent server-loaded rows, never all historical requests.
 */
const LABELS=Object.freeze({
 leave:'Congés et absences',
 correction:'Corrections d’heures',
 break:'Corrections de pauses',
 missing:'Journées oubliées'
});
const ROUTES=Object.freeze({
 leave:'leave',correction:'essentialCorrection',break:'breakCorrections',missing:'missingDays'
});
const STATUSES=new Set(['pending','approved','rejected','cancelled']);
const isId=x=>typeof x==='string'&&x.length>0;

export function essentialRequestOverview({companyId,userId,leave,correction,breaks,missing}={}){
 const scopeValid=isId(companyId)&&isId(userId);
 const datasets=[
  ['leave',leave,row=>row.company_id===companyId&&row.user_id===userId],
  ['correction',correction,row=>row.requested_by===userId&&
    (row.company_id==null||row.company_id===companyId)],
  ['break',breaks,row=>row.company_id===companyId&&row.requested_by===userId],
  // Missing-day summary is already scoped to company + worker + account by its
  // dedicated controller. Its mapped rows intentionally contain no personal ID.
  ['missing',missing,row=>isId(row.id)]
 ];
 return {ready:scopeValid,sections:datasets.map(([kind,view,own])=>{
  const ready=scopeValid&&view?.ready===true&&Array.isArray(view.requests);
  const rows=ready?view.requests.filter(r=>r&&isId(r.id)&&STATUSES.has(r.status)&&own(r)):[];
  const pending=rows.filter(r=>r.status==='pending').length;
  return {kind,title:LABELS[kind],route:ROUTES[kind],
    ready,pending:ready?pending:null,recent:ready?rows.length:null};
 })};
}
