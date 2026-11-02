/** Read the server-authorized lead-only team overview.
 * Never infer a team from every visible punch segment: a lead can also see
 * their own punches and (depending on RLS) other unrelated segments.
 */
export type LeadTeamHours={
 workers:number;
 present:number;
 todayMs:number;
 weekMs:number;
};
export function parseLeadTeamHours(value:unknown):LeadTeamHours{
 if(!Array.isArray(value))throw Error('Relevé des heures de l’équipe incomplet.');
 const seen=new Set<string>();
 let present=0,todayMs=0,weekMs=0;
 for(const row of value){
  if(!row||typeof row!=='object')throw Error('Relevé des heures de l’équipe invalide.');
  const person=row as Record<string,unknown>;
  const id=person.user_id;
  if(typeof id!=='string'||!id.trim()||seen.has(id)||
   typeof person.present!=='boolean')
   throw Error('Relevé des employés de l’équipe invalide.');
  // JSONB SQL sums can be numeric; never silently replace missing values with 0.
  for(const amount of [person.today_gross_ms,person.week_gross_ms]){
   if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0)
    throw Error('Total des heures de l’équipe invalide.');
  }
  seen.add(id);
  if(person.present)present++;
  todayMs+=person.today_gross_ms as number;
  weekMs+=person.week_gross_ms as number;
  if(!Number.isFinite(todayMs)||!Number.isFinite(weekMs))
   throw Error('Total des heures de l’équipe invalide.');
 }
 return {workers:seen.size,present,todayMs,weekMs};
}
