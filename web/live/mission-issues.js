// MISSION-007: voluntary, idempotent "mission impossible" report.
// This is NOT a time clock, absence, late arrival, GPS fix, or exit punch.
export const MISSION_ISSUE_REASONS=[
 ['client_absent','Client absent'],
 ['wrong_address','Mauvaise adresse'],
 ['access_blocked','Accès impossible'],
 ['return_needed','Retour nécessaire'],
 ['other','Autre problème']
];
export function missionIssueArgs(company,mission,reason,note,request){
 const trimmed=String(note??'').trim();
 if(!company||!mission?.id||mission.status!=='published'||!Number.isInteger(mission.version)
  ||mission.version<1||!MISSION_ISSUE_REASONS.some(([id])=>id===reason)||trimmed.length>300||!request)
  throw Error('Choisissez une mission publiée et un motif valide (note de 300 caractères maximum).');
 return {p_company:company,p_mission:mission.id,p_version:mission.version,p_request:request,
  p_reason:reason,p_note:trimmed||null};
}
export function missionIssueLabel(reason){
 return MISSION_ISSUE_REASONS.find(([id])=>id===reason)?.[1]||'À vérifier';
}
