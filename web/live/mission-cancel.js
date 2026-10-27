// MISSION-008 (partial): explicit manager cancellation of a published mission.
// Only the server can authorize this transition and notify the assigned worker.
export function missionCancelArgs(company,mission,reason,request){
 const v=Number(mission?.version),message=String(reason??'').trim();
 if(!company||!mission?.id||mission.status!=='published'||!Number.isInteger(v)||v<1||
   message.length<5||message.length>200||
   !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(request||'')))
  throw Error('Mission, version, demande ou motif invalide. Actualisez la journée.');
 return {p_company:company,p_id:mission.id,p_version:v,p_request:request,p_reason:message};
}
