/** Transient identity tokens for the break policy UI. Server authorization stays authoritative. */
const id=(company,user,role)=>JSON.stringify([String(company||''),String(user||''),String(role||'')]);
export function createBreakPolicyScope(company,user,role){
 let key=id(company,user,role),revision=0;
 const current=()=>({key,revision});
 return {
  matches:(c,u,r)=>key===id(c,u,r),
  enter(c,u,r){key=id(c,u,r);revision++;return current();},
  invalidate(){revision++},
  current,
  allows:token=>Boolean(token&&token.key===key&&token.revision===revision)
 };
}
/** Ensure numeric form values cannot be rounded, truncated, or submitted as NaN. */
export function parseBreakPolicyMinutes(value,max,min=0){
 if(value==='')return null;
 if(typeof value!=='string'||!/^\d+$/.test(value))throw Error('Nombre entier requis.');
 const parsed=Number(value);
 if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw Error('Durée hors limites.');
 return parsed;
}
export function currentDepartmentPolicy(rows,departmentId,nowMs){
 const matches=rows.filter(r=>r.department_id===departmentId&&Number.isFinite(Date.parse(r.effective_at))&&Date.parse(r.effective_at)<=nowMs);
 matches.sort((a,b)=>Date.parse(b.effective_at)-Date.parse(a.effective_at)||b.version-a.version);
 return matches[0]||null;
}
