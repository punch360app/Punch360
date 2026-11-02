/** Personal leave requests: the server decides access and approval.
 * This module only validates form input and scopes what the client displays.
 */
const TYPES=Object.freeze(['vacation','personal','sick','other']);
const dateValue=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [y,m,d]=value.split('-').map(Number);
 const date=new Date(Date.UTC(y,m-1,d));
 return date.getUTCFullYear()===y&&date.getUTCMonth()+1===m&&date.getUTCDate()===d?value:null;
};
export function essentialLeaveView({companyId,userId,loaded=false,requests=[]}={}){
 const ready=loaded===true&&typeof companyId==='string'&&companyId.length>0&&
  typeof userId==='string'&&userId.length>0&&Array.isArray(requests);
 if(!ready)return {ready:false,requests:[]};
 return {ready:true,requests:requests.filter(row=>
   row?.company_id===companyId&&row.user_id===userId&&
   typeof row.id==='string'&&row.id.length>0&&
   dateValue(row.begins_on)&&dateValue(row.ends_on))
  .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))};
}
export function validateEssentialLeaveRequest({view,companyId,userId,type,from,to,reason=''}={}){
 if(!view?.ready||!companyId||!userId)
  return {ok:false,message:'Vos demandes ne sont pas vérifiées. Actualisez avant de soumettre.'};
 if(!TYPES.includes(type))
  return {ok:false,message:'Choisissez un type de congé valide.'};
 const start=dateValue(from),end=dateValue(to);
 if(!start||!end||end<start)
  return {ok:false,message:'Vérifiez les dates de début et de fin.'};
 if(typeof reason!=='string'||reason.trim().length>1000)
  return {ok:false,message:'Le commentaire ne peut dépasser 1 000 caractères.'};
 return {ok:true,companyId,userId,type,from:start,to:end,reason:reason.trim()||null};
}

/**
 * Only server-read, pending requests in the current company are candidates for
 * manager review. The database RPC still authorizes and records the decision.
 */
export function essentialLeaveApprovalView({companyId,reviewerId,manager=false,loaded=false,requests=[]}={}){
 const ready=loaded===true&&manager===true&&typeof companyId==='string'&&companyId.length>0&&
  typeof reviewerId==='string'&&reviewerId.length>0&&Array.isArray(requests);
 if(!ready)return {ready:false,requests:[]};
 const valid=request=>request?.company_id===companyId&&request.status==='pending'&&
  typeof request.id==='string'&&request.id.length>0&&
  typeof request.user_id==='string'&&request.user_id.length>0&&request.user_id!==reviewerId&&
  dateValue(request.begins_on)!==null&&dateValue(request.ends_on)!==null&&
  request.ends_on>=request.begins_on;
 return {ready:true,requests:requests.filter(valid).sort((a,b)=>a.begins_on.localeCompare(b.begins_on))};
}
