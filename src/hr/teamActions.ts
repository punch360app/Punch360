/** Preflight team management with the exact lists fetched for this company.
 * Backend RPCs and RLS remain responsible for final authorization.
 */
export type TeamChoice={id:string};
export type MemberChoice={user_id:string;role:string};
export type JobChoice={id:string};

function requiredChoice(value:string,label:string):string{
 if(typeof value!=='string'||!value.trim())throw Error(label+' requis.');
 return value;
}
export function validatedTeamCreation(
 companyId:string,name:string,leadId:string,people:readonly MemberChoice[]
){
 const company=requiredChoice(companyId,'Entreprise');
 const title=typeof name==='string'?name.trim():'';
 if(!title||Array.from(title).length>140)
  throw Error('Nom de l’équipe requis (maximum 140 caractères).');
 const lead=requiredChoice(leadId,'Chef d’équipe');
 if(!people.some(p=>p?.user_id===lead&&p.role==='lead'))
  throw Error('Choisis un chef actif de cette entreprise.');
 return {p_company:company,p_name:title,p_lead:lead};
}
export function validatedTeamMemberAssignment(
 teamId:string,workerId:string,
 teams:readonly TeamChoice[],people:readonly MemberChoice[]
){
 const team=requiredChoice(teamId,'Équipe');
 const employee=requiredChoice(workerId,'Employé');
 if(!teams.some(t=>t?.id===team))
  throw Error('Équipe introuvable dans cette entreprise.');
 if(!people.some(p=>p?.user_id===employee&&
   (p.role==='lead'||p.role==='employee')))
  throw Error('Sélectionne un employé actif de cette entreprise.');
 return {p_team:team,p_employee:employee};
}
export function validatedTeamJobAssignment(
 companyId:string,teamId:string,jobId:string,
 teams:readonly TeamChoice[],jobs:readonly JobChoice[]
){
 const company=requiredChoice(companyId,'Entreprise');
 const team=requiredChoice(teamId,'Équipe');
 const job=requiredChoice(jobId,'Chantier');
 if(!teams.some(t=>t?.id===team))
  throw Error('Équipe introuvable dans cette entreprise.');
 if(!jobs.some(j=>j?.id===job))
  throw Error('Sélectionne un chantier actif de cette entreprise.');
 return {company_id:company,team_id:team,job_id:job};
}
