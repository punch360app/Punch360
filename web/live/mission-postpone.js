// A postponed impossible mission keeps the same assignment, at a new day/rank.
// No new shift, punch session, payroll record, GPS tracking or auto-confirmation.
import {missionIssueDecisionArgs} from './mission-issue-decision.js';
export function missionPostponeArgs(company,mission,day,order,reason,request){
 const args=missionIssueDecisionArgs(company,mission,'resume',reason,request);
 const value=String(day||''),rank=Number(order);
 const date=/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(value+'T12:00:00Z'):null;
 if(!date||Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value||
  !Number.isSafeInteger(rank)||rank<1||rank>999||value<=String(mission.mission_day||''))
  throw Error('Choisissez une nouvelle journée après la mission et un rang de 1 à 999.');
 return {p_company:args.p_company,p_mission:args.p_mission,p_version:args.p_version,
  p_request:args.p_request,p_day:value,p_order:rank,p_reason:args.p_reason};
}
