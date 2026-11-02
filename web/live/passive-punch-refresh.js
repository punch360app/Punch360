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
 return function passivePunchRefresh(){
  if(inFlight)return inFlight;
  const scope=getScope();
  if(!scope||typeof scope.companyId!=='string'||!scope.companyId||
   typeof scope.userId!=='string'||!scope.userId||
   isBusy()||!isCurrent(scope))return Promise.resolve(false);
  const run=async()=>{
   try{
    if(isOnline()){
     const verifiedId=await getVerifiedUser();
     if(verifiedId!==scope.userId||!isCurrent(scope))return false;
     const membership=await getMembership(scope);
     if(!isCurrent(scope)||membership?.company_id!==scope.companyId||
      membership?.user_id!==scope.userId||membership?.status!=='active'||
      membership?.role!==scope.role)return false;
    }
    if(isBusy()||!isCurrent(scope))return false;
    await refresh(scope);
    return true;
   }catch{return false}
  };
  const task=run();
  inFlight=task;
  task.finally(()=>{if(inFlight===task)inFlight=null});
  return task;
 };
}
