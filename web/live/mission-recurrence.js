// MISSION-012: generate a bounded list of UNPUBLISHED weekly/biweekly
// mission drafts. UTC calendar math preserves local calendar dates across DST.
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const norm=s=>String(s??'').trim().normalize('NFKC').toLocaleLowerCase('fr-CA');
export function missionCalendarDay(date){
 const raw=String(date??'');
 if(!DAY.test(raw))throw Error('Date invalide.');
 const d=new Date(raw+'T12:00:00Z');
 if(Number.isNaN(d.valueOf())||d.toISOString().slice(0,10)!==raw)
  throw Error('Date impossible.');
 return d;
}
export function recurringMissionDrafts(form,{today}={}){
 if(!form||typeof form!=='object')throw Error('Mission modèle absente.');
 const now=missionCalendarDay(today),start=missionCalendarDay(form.day);
 const weeks=Number(form.intervalWeeks),count=Number(form.count),order=Number(form.order);
 if(![1,2].includes(weeks)||!Number.isInteger(count)||count<2||count>12)
  throw Error('Répétition hebdomadaire ou aux deux semaines, 2 à 12 occurrences.');
 if(!Number.isInteger(order)||order<1||order>999||
    !form.workerId||!form.siteId||norm(form.title).length<2||
    String(form.title).trim().length>140||String(form.instructions??'').length>500)
  throw Error('Mission modèle incomplète ou invalide.');
 if(start<now)throw Error('Une récurrence ne peut pas commencer dans le passé.');
 const end=new Date(now.valueOf());end.setUTCDate(end.getUTCDate()+180);
 const entries=[];
 for(let i=0;i<count;i++){
  const date=new Date(start.valueOf());date.setUTCDate(date.getUTCDate()+i*7*weeks);
  if(date>end)throw Error('Horizon maximum de 180 jours pour les brouillons récurrents.');
  entries.push({day:date.toISOString().slice(0,10),workerId:form.workerId,
   siteId:form.siteId,order,title:form.title.trim(),instructions:String(form.instructions??''),
   index:i+1});
 }
 return entries;
}
export function recurringMissionConflict(row,existing){
 if(!Array.isArray(existing))throw Error('Missions serveur non vérifiées.');
 for(const m of existing){
  if(!m||['cancelled','postponed'].includes(m.status)||
     m.mission_day!==row.day||m.worker_id!==row.workerId)continue;
  if(Number(m.sort_order)===row.order)
   return 'Rang déjà occupé pour le salarié à cette date';
  if(m.site_id===row.siteId&&norm(m.title)===norm(row.title))
   return 'Mission du même salarié, lieu et titre déjà présente';
 }
 return null;
}
