// MISSION-008 partial: deliberate, versioned reprogramming of one published mission.
// The server owns authorization, uniqueness, idempotency, audit and notifications.
export function missionRescheduleArgs(company,mission,day,site,order,reason,request){
 const date=String(day||''),rank=Number(order),message=String(reason??'').trim();
 const parsed=/^\d{4}-\d{2}-\d{2}$/.test(date)?new Date(date+'T12:00:00Z'):null;
 if(!company||!mission?.id||mission.status!=='published'||!Number.isInteger(mission.version)||mission.version<1||
  !parsed||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||
  !site||!Number.isInteger(rank)||rank<1||rank>999||message.length<5||message.length>200||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(request||''))||
  (mission.mission_day===date&&mission.site_id===site&&Number(mission.sort_order)===rank))
  throw Error('Date, lieu, rang, motif ou version invalide. Sélectionnez une modification réelle.');
 return {p_company:company,p_id:mission.id,p_version:mission.version,p_request:request,
  p_target_day:date,p_target_site:site,p_target_order:rank,p_reason:message};
}
