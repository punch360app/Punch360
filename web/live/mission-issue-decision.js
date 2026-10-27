// Manager-only decision on an employee's impossible mission.
// Web and Expo share the same input/optimistic-version guard.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ISSUE_DECISIONS=[['resume','Reprendre cette mission'],['cancel','Annuler après examen']];
export const issueDecisionLabel=decision=>decision==='resume'?'Mission remise à faire':
 decision==='cancel'?'Mission annulée après examen':decision==='postpone'?'Mission reportée':'Décision non disponible';
export function missionIssueDecisionArgs(company,mission,decision,reason,request){
 const note=String(reason??'').trim(),version=Number(mission?.version);
 if(!company||!mission?.id||mission.status!=='impossible'||!Number.isSafeInteger(version)||version<1||
  !ISSUE_DECISIONS.some(x=>x[0]===decision)||note.length<5||note.length>200||!UUID.test(String(request||'')))
  throw Error('Décision de mission invalide : actualisez et indiquez un motif de 5 à 200 caractères.');
 return {p_company:company,p_mission:mission.id,p_version:version,
  p_request:request,p_decision:decision,p_reason:note};
}
export function resolvedMissionNotice(mission){
 if(!mission||!mission.issue_decision_at||!['resume','cancel','postpone'].includes(mission.issue_decision))return '';
 return issueDecisionLabel(mission.issue_decision)+
  ' — '+String(mission.title||'Intervention')+(mission.issue_decision==='postpone'?' au '+String(mission.mission_day||'nouveau jour'):'')+' : '+String(mission.issue_decision_reason||'');
}
