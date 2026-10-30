/** Ephemeral guards for approval UI. Server-side delegation and anti-self-approval remain authoritative. */
const identity=(company,user,role)=>JSON.stringify([String(company||''),String(user||''),String(role||'')]);
export function createApprovalScope(company,user,role){
 let key=identity(company,user,role),generation=0;
 const current=()=>({key,generation});
 return {
  matches:(c,u,r)=>key===identity(c,u,r),
  enter(c,u,r){key=identity(c,u,r);generation++;return current();},
  invalidate(){generation++},
  current,
  allows:token=>Boolean(token&&token.key===key&&token.generation===generation)
 };
}
export const approvalRpcNames=Object.freeze({
 time:'review_punch_correction',
 pause:'review_essential_break_correction',
 day:'review_essential_missing_day',
 leave:'review_leave'
});
export function canActOnApproval(rows,kind,id){
 return Boolean(approvalRpcNames[kind]&&typeof id==='string'&&id.length&&
  Array.isArray(rows)&&rows.some(r=>r?.kind===kind&&r.id===id));
}
