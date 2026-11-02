/** The visible pause and the next pause action must belong to the same
 * authenticated worker, company and currently open punch session.
 * A mixed/stale offline cache cannot authorize break_end for another worker.
 */
export function currentOpenPunchBreak(companyId,userId,activeSession,breaks){
 if(typeof companyId!=='string'||!companyId||typeof userId!=='string'||!userId||
  activeSession?.company_id!==companyId||activeSession.user_id!==userId||
  typeof activeSession.id!=='string'||!activeSession.id||activeSession.ended_at!=null||
  !Array.isArray(breaks))return null;
 return breaks.find(item=>item?.company_id===companyId&&item.user_id===userId&&
  item.session_id===activeSession.id&&item.ended_at==null&&
  typeof item.id==='string'&&item.id.length>0)||null;
}
