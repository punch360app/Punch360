/** Ephemeral client-side guards for missing-day UI. RLS and RPC authorization remain authoritative. */
const identity=(company,user,role)=>JSON.stringify([String(company||''),String(user||''),String(role||'')]);
export function createMissingDayScope(company,user,role){
 let key=identity(company,user,role),revision=0;
 const current=()=>({key,revision});
 return {
  matches:(c,u,r)=>key===identity(c,u,r),
  enter(c,u,r){key=identity(c,u,r);revision++;return current();},
  invalidate(){revision++},
  current,
  allows:token=>Boolean(token&&token.key===key&&token.revision===revision)
 };
}
export function canReviewMissingDay(row,account,workers){
 if(!['boss','admin'].includes(account?.role)||row?.status!=='pending'||row?.requested_by===account?.userId)return false;
 const employee=workers.find(w=>w?.id===row.worker_id);
 return Boolean(employee&&employee.auth_user_id!==account.userId);
}
export function canCancelMissingDay(row,userId){
 return Boolean(row?.status==='pending'&&row.requested_by===userId);
}
export function chooseMissingDaySelection(form,workers,jobs){
 const workerId=workers.some(w=>w.id===form.worker)?form.worker:(workers[0]?.id||'');
 const jobId=jobs.some(j=>j.id===form.job)?form.job:(jobs[0]?.id||'');
 return {...form,worker:workerId,job:jobId};
}
