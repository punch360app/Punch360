// Ephemeral client-side safeguards: Supabase RPC and RLS remain the authority.
export const workforceIdentity=(account,managementOnly=false)=>JSON.stringify([
 String(account?.companyId||''),String(account?.userId||''),String(account?.role||''),
 String(account?.edition||''),Boolean(managementOnly)
]);
export function createWorkforceScope(account,managementOnly=false){
 let identity=workforceIdentity(account,managementOnly),revision=0;
 return {
  matches:(a,management)=>identity===workforceIdentity(a,management),
  enter(a,management){identity=workforceIdentity(a,management);revision++;return {identity,revision}},
  invalidate(){revision++},
  current:()=>({identity,revision}),
  allows:token=>Boolean(token&&token.identity===identity&&token.revision===revision)
 };
}
export const canManageWorkforce=account=>account?.role==='boss'||account?.role==='admin';
export function canReviewWorkforceRequest(record,account,kind){
 if(!canManageWorkforce(account)||record?.company_id!==account.companyId||record?.status!=='pending')return false;
 if(kind==='correction')return record.requested_by!==account.userId;
 if(kind==='leave')return record.user_id!==account.userId;
 return false;
}
export function canChangeOrder(order,account,next){
 if(!canManageWorkforce(account)||order?.company_id!==account.companyId)return false;
 return ({requested:['approved','rejected'],approved:['ordered'],ordered:['delivered']})[order.status]?.includes(next)===true;
}
export function belongsToActiveSession(session,sessions,account,managementOnly){
 return !managementOnly&&Boolean(session?.id&&session.company_id===account?.companyId&&session.user_id===account?.userId&&
 sessions.some(s=>s.id===session.id&&s.ended_at));
}
export function workforceCorrectionDates(start,end){
 const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
 if(!iso.test(start)||!iso.test(end))throw Error('Dates complètes avec fuseau requises');
 const a=Date.parse(start),b=Date.parse(end);
 if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>26*3600000)throw Error('Heures invalides, maximum 26 h');
 return {start:new Date(a).toISOString(),end:new Date(b).toISOString()};
}
export function payrollMonday(week){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(week))throw Error('Lundi AAAA-MM-JJ requis');
 const d=new Date(week+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==week||d.getUTCDay()!==1)throw Error('Choisis un lundi valide');
 return week;
}
export function csvCell(value){
 return '"'+String(value??'').replace(/^[=+@\t\r-]/,"'$&").replace(/"/g,'""')+'"';
}
export function exportSessionIds(segments){
 return [...new Set(segments.map(r=>r.session_id).filter(Boolean))];
}
