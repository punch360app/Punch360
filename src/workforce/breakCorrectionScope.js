// Client-side account scope only; server RPC/RLS remain authoritative.
export const breakCorrectionIdentity=a=>JSON.stringify([String(a?.companyId||''),String(a?.userId||''),String(a?.role||''),String(a?.edition||'')]);
export function createBreakCorrectionScope(account){
 let identity=breakCorrectionIdentity(account),revision=0;
 return {
  matches:a=>identity===breakCorrectionIdentity(a),
  current:()=>({identity,revision}),
  enter(a){identity=breakCorrectionIdentity(a);revision++;return {identity,revision}},
  invalidate(){revision++},
  allows:token=>Boolean(token&&token.identity===identity&&token.revision===revision)
 };
}
export const canManageBreakCorrections=a=>a?.role==='boss'||a?.role==='admin';
export function canChooseBreakSession(s,sessions,a){
 return Boolean(s?.id&&s.company_id===a?.companyId&&s.ended_at&&sessions.some(x=>x.id===s.id)&&
  (canManageBreakCorrections(a)||s.user_id===a.userId));
}
export const canSelectOriginalBreak=(b,sessionId,breaks)=>Boolean(b?.id&&b.session_id===sessionId&&b.ended_at&&breaks.some(x=>x.id===b.id));
export function canCancelBreakCorrection(r,a,requests){
 return Boolean(r?.id&&r.company_id===a?.companyId&&r.status==='pending'&&r.requested_by===a.userId&&requests.some(x=>x.id===r.id));
}
export function canReviewBreakCorrection(r,a,requests,sessions,people=[]){
 if(!canManageBreakCorrections(a)||!r?.id||r.company_id!==a.companyId||r.status!=='pending'||r.requested_by===a.userId||!requests.some(x=>x.id===r.id))return false;
 const s=sessions.find(x=>x.id===r.session_id&&x.company_id===a.companyId);
 if(!s||s.user_id===a.userId)return false;
 const worker=people.find(w=>w.id===s.worker_id);
 return !worker||worker.auth_user_id!==a.userId;
}
export const validDecisionNote=note=>typeof note==='string'&&note.trim().length>=3&&note.trim().length<=1000;
