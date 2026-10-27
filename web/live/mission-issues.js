// MISSION-007 (partial): explicit worker-only "mission impossible" report.
// Server remains the authority: company membership, worker assignment, version,
// reason whitelist, request-id replay and manager-only private notes.
export const MISSION_ISSUE_REASONS=[
 ['client_absent','Client absent'],
 ['wrong_address','Mauvaise adresse'],
 ['access_blocked','Accès impossible'],
 ['return_needed','Retour nécessaire'],
 ['other','Autre problème']
];
export function missionIssueLabel(value){
 return MISSION_ISSUE_REASONS.find(x=>x[0]===value)?.[1]||'Problème à vérifier';
}
/** @param {string} company @param {Record<string,any>} mission @param {string} reason @param {string} note @param {string} request */
export function missionIssueArgs(company,mission,reason,note,request){
 const v=Number(mission?.version),message=String(note??'').trim();
 if(!company||!mission?.id||mission.status!=='published'||!Number.isInteger(v)||v<1||
  !MISSION_ISSUE_REASONS.some(x=>x[0]===reason)||message.length>300||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(request||'')))
  throw Error('Mission, motif ou confirmation invalide. Actualisez si nécessaire.');
 return {p_company:company,p_mission:mission.id,p_version:v,p_request:request,
  p_reason:reason,p_note:message||null};
}
export function missionIssueState(items){
 const rows=Array.isArray(items)?items:[];
 return {done:rows.filter(x=>x.status==='completed').length,
  blocked:rows.filter(x=>x.status==='impossible').length,
  remaining:rows.filter(x=>x.status==='published').length};
}
