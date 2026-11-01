// Kiosk-only employees retain the other employee views, but cannot initiate a
// mobile punch. UI fail-closed is not a substitute for server RPC policy.
export function canUseEssentialMobilePunch(companyId,userId,worker){
 return typeof companyId==='string'&&companyId.length>0&&
  typeof userId==='string'&&userId.length>0&&
  worker?.company_id===companyId&&worker?.auth_user_id===userId&&
  worker?.status==='active'&&worker?.personal_access===true&&worker?.can_mobile_punch===true;
}
export function essentialMobilePunchNotice(worker){
 return worker?.can_mobile_punch===false
  ?'Le pointage se fait sur la borne de votre entreprise. Vos heures et horaires restent accessibles.'
  :'Pointage mobile non confirmé. Consultez votre responsable avant de pointer.';
}

// An informational summary from the last server-acknowledged session snapshot.
// Never use optimistic offline punch projections or another company's records.
export function lastConfirmedKioskPunch(companyId,snapshotCompanyId,userId,snapshot){
 if(typeof companyId!=='string'||!companyId||companyId!==snapshotCompanyId||
    typeof userId!=='string'||!userId||!Array.isArray(snapshot?.sessions))return null;
 const sessions=snapshot.sessions.filter(s=>
  s?.user_id===userId&&typeof s.started_at==='string'&&Number.isFinite(Date.parse(s.started_at))&&
  (s.ended_at==null||(typeof s.ended_at==='string'&&Number.isFinite(Date.parse(s.ended_at))&&
    Date.parse(s.ended_at)>=Date.parse(s.started_at))));
 if(!sessions.length)return null;
 const latest=sessions.reduce((a,b)=>Date.parse(a.started_at)>=Date.parse(b.started_at)?a:b);
 return {type:latest.ended_at?'out':'in',at:latest.ended_at||latest.started_at};
}
