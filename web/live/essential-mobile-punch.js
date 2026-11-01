// Kiosk-only employees retain the other employee views, but cannot initiate a
// mobile punch. UI fail-closed is not a substitute for server RPC policy.
export function canUseEssentialMobilePunch(companyId,userId,worker){
 return typeof companyId==='string'&&companyId.length>0&&
  typeof userId==='string'&&userId.length>0&&
  worker?.company_id===companyId&&worker?.auth_user_id===userId&&
  worker?.status==='active'&&worker?.can_mobile_punch===true;
}
export function essentialMobilePunchNotice(worker){
 return worker?.can_mobile_punch===false
  ?'Le pointage se fait sur la borne de votre entreprise. Vos heures et horaires restent accessibles.'
  :'Pointage mobile non confirmé. Consultez votre responsable avant de pointer.';
}
