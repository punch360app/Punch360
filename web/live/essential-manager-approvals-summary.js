/**
 * Read-only manager overview. Sources are the already scoped server-read
 * J1 approval views. Unknown sources must never count as zero approved work.
 * Counts describe loaded, bounded inboxes, not total company history.
 */
export function essentialManagerApprovalsSummary({
 companyId,reviewerId,role,leaveView,correctionView,breakView,missingView
}={}){
 const authorized=typeof companyId==='string'&&companyId.length>0&&
  typeof reviewerId==='string'&&reviewerId.length>0&&
  (role==='boss'||role==='admin');
 const unavailable={ready:false,count:null};
 if(!authorized)return {authorized:false,complete:false,total:null,sections:[]};
 const validPending=(view,rows,owns)=>{
  if(view?.ready!==true||!Array.isArray(rows))return unavailable;
  return {ready:true,count:rows.filter(r=>r?.status==='pending'&&
   typeof r.id==='string'&&r.id.length>0&&
   owns(r)).length};
 };
 const sections=[
  {kind:'corrections',title:'Corrections d’heures',
   ...validPending(correctionView,correctionView?.requests,r=>
    r.company_id===companyId&&typeof r.requested_by==='string'&&
    r.requested_by&&r.requested_by!==reviewerId)},
  {kind:'leaves',title:'Congés et absences',
   ...validPending(leaveView,leaveView?.requests,r=>
    r.company_id===companyId&&typeof r.user_id==='string'&&
    r.user_id&&r.user_id!==reviewerId)},
  {kind:'breaks',title:'Corrections de pauses',
   ...validPending(breakView,breakView?.requests,r=>
    r.company_id===companyId&&typeof r.requested_by==='string'&&
    r.requested_by&&r.requested_by!==reviewerId)},
  {kind:'missing',title:'Journées oubliées',
   ...(missingView?.ready===true&&Number.isSafeInteger(missingView.count)&&
    missingView.count>=0?{ready:true,count:missingView.count}:unavailable)}
 ];
 const complete=sections.every(s=>s.ready);
 const knownTotal=sections.reduce((n,s)=>n+(s.ready?s.count:0),0);
 return {authorized:true,complete,total:knownTotal,sections};
}
