/** Identify the open pause only within the authenticated employee's active session.
 * Never choose the first item when the same scope has multiple open pauses.
 * An invalid open pause is also unsafe to start or end automatically.
 */
export function currentPunchBreakState(companyId,userId,activeSession,breaks){
 if(typeof companyId!=='string'||!companyId||typeof userId!=='string'||!userId||
  activeSession?.company_id!==companyId||activeSession.user_id!==userId||
  typeof activeSession.id!=='string'||!activeSession.id||activeSession.ended_at!=null||
  !Array.isArray(breaks))return {status:'unavailable',break:null};
 let open=null;
 for(const item of breaks){
  if(item?.company_id!==companyId||item.user_id!==userId||
   item.session_id!==activeSession.id||item.ended_at!=null)continue;
  // Even a single scoped open pause with no usable ID cannot be closed safely.
  if(open||typeof item.id!=='string'||!item.id)
   return {status:'ambiguous',break:null};
  open=item;
 }
 return {status:open?'open':'none',break:open};
}

/** Kept for the home status; only a unique scoped pause may be displayed. */
export function currentOpenPunchBreak(companyId,userId,activeSession,breaks){
 return currentPunchBreakState(companyId,userId,activeSession,breaks).break;
}

/** Keep the existing home indicator in sync with the fail-closed action. */
export function hasConflictingOpenPunchBreak(companyId,userId,activeSession,breaks){
 return currentPunchBreakState(companyId,userId,activeSession,breaks).status==='ambiguous';
}
