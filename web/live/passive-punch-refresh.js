/**
 * Passive Web journal retry: a cached identity is not server authorization.
 * Verify the logged-in user and their active company membership before
 * triggering a network refresh that may flush durable punch events.
 * Offline refresh is local-only and keeps the normal hours projection.
 */
export function createScopedPassivePunchRefresh({
 getScope,isCurrent,isOnline,isBusy,getVerifiedUser,getMembership,refresh
}){
 let inFlight=null;
 let revision=0;
 let observedScope=null;
 const sameScope=(a,b)=>a.companyId===b.companyId&&
  a.userId===b.userId&&a.role===b.role;
 return function passivePunchRefresh(){
  // Capture an immutable identity snapshot: another workspace must not inherit
  // the pending verification or result from the previous workspace.
  const current=getScope();
  const scope=current?{companyId:current.companyId,userId:current.userId,role:current.role}:null;
  if(!scope||typeof scope.companyId!=='string'||!scope.companyId||
   typeof scope.userId!=='string'||!scope.userId||
   !isCurrent(scope)){
   if(observedScope){observedScope=null;revision++}
   return Promise.resolve(false);
  }
  // A workspace switch invalidates the previous verification even when busy.
  // Otherwise A -> busy B -> A could reuse an obsolete authorized request.
  if(!observedScope||!sameScope(observedScope,scope)){
   observedScope=scope;
   revision++;
  }
  // The same workspace shares only its current generation of verification.
  if(inFlight&&inFlight.token===revision&&sameScope(inFlight.scope,scope))return inFlight.task;
  if(isBusy())return Promise.resolve(false);
  const token=revision;
  const stillCurrent=()=>token===revision&&isCurrent(scope);
  const run=async()=>{
   try{
    if(isOnline()){
     const verifiedId=await getVerifiedUser();
     if(verifiedId!==scope.userId||!stillCurrent())return false;
     const membership=await getMembership(scope);
     if(!stillCurrent()||membership?.company_id!==scope.companyId||
      membership?.user_id!==scope.userId||membership?.status!=='active'||
      membership?.role!==scope.role)return false;
    }
    if(isBusy()||!stillCurrent())return false;
    await refresh(scope);
    // A stale completion must never be reported as a synced workspace.
    return stillCurrent();
   }catch{return false}
  };
  const task=run();
  const entry={scope,task,token};
  inFlight=entry;
  task.finally(()=>{if(inFlight===entry)inFlight=null});
  return task;
 };
}
