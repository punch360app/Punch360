// MISSION-008 (partial): client checks before calling the server-owned reassignment.
export function missionReassignArgs(company,mission,worker,order,reason,request){
 const version=Number(mission?.version),rank=Number(order),message=String(reason??'').trim();
 if(!company||!mission?.id||mission.status!=='published'||!Number.isInteger(version)||version<1||
  !worker||worker===mission.worker_id||!Number.isInteger(rank)||rank<1||rank>999||
  message.length<5||message.length>200||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(request||'')))
  throw Error('Mission, salarié, rang, motif ou version invalide. Actualisez la journée.');
 return {p_company:company,p_id:mission.id,p_version:version,p_request:request,
  p_target_worker:worker,p_target_order:rank,p_reason:message};
}
