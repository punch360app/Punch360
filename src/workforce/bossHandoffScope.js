/** Ephemeral UI guards. Never bypass live AAL2 or the server's dual-consent RPCs. */
export const bossHandoffIdentity=a=>JSON.stringify([
 String(a?.companyId||''),String(a?.userId||''),String(a?.role||''),String(a?.edition||'')
]);
export function createBossHandoffScope(account){
 let identity=bossHandoffIdentity(account),revision=0;
 return {
  matches:a=>identity===bossHandoffIdentity(a),
  current:()=>({identity,revision}),
  enter(a){identity=bossHandoffIdentity(a);revision++;return {identity,revision}},
  invalidate(){revision++},
  allows:token=>Boolean(token&&token.identity===identity&&token.revision===revision)
 };
}
export const canViewHandoff=a=>a?.edition==='essential'&&['boss','admin'].includes(a?.role);
export function activeHandoffAdmins(rows,a){
 if(!canViewHandoff(a)||a.role!=='boss'||!Array.isArray(rows)||rows.length>500)throw Error('Administrateurs indisponibles');
 const ids=new Set();
 return rows.filter(row=>{
  if(!row||typeof row.user_id!=='string'||row.role!=='admin'||row.status!=='active'||row.user_id===a.userId)return false;
  if(ids.has(row.user_id))return false;ids.add(row.user_id);return true;
 });
}
export function validHandoffStatus(h,a){
 if(h==null)return null;
 if(!canViewHandoff(a)||h.company_id!==a.companyId||
 !['pending','accepted','expired'].includes(h.status)||
 !Number.isInteger(h.version)||h.version<=0||
 typeof h.id!=='string'||typeof h.from_user!=='string'||typeof h.to_user!=='string'||
 (h.from_user!==a.userId&&h.to_user!==a.userId))throw Error('Statut de direction non valide');
 return h;
}
export function handoffActionAllowed(action,h,a,admins,successor,reason){
 if(!canViewHandoff(a))return false;
 if(action==='request')return a.role==='boss'&&(!h||h.status==='expired')&&
 admins.some(row=>row.user_id===successor&&row.role==='admin'&&row.status==='active')&&
 typeof reason==='string'&&reason.trim().length>=8&&reason.trim().length<=1000;
 if(!h||!['pending','accepted'].includes(h.status))return false;
 if(action==='accept')return h.status==='pending'&&h.can_accept===true&&h.to_user===a.userId;
 if(action==='complete')return a.role==='boss'&&h.status==='accepted'&&h.can_complete===true&&h.from_user===a.userId;
 if(action==='cancel')return h.from_user===a.userId||h.to_user===a.userId;
 return false;
}
export function handoffExpected(action,company,h,successor){
 if(action==='request')return company+':'+successor;
 if(!h)return '';
 if(action==='accept')return company+':'+h.from_user;
 if(action==='complete')return company+':'+h.to_user;
 return '';
}
