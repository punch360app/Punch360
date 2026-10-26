// Shared staff shift preferences: wishes are not labour-law or payroll rules.
export const PERIOD_CHOICES=Object.freeze([
 ['','Aucune préférence'],['day','Jour'],['evening','Soir'],['night','Nuit'],
 ['day,evening','Jour ou soir'],['evening,night','Soir ou nuit'],
 ['day,night','Jour ou nuit'],['day,evening,night','Tous les quarts']
]);
export const WEEKEND_CHOICES=Object.freeze([
 ['flexible','Flexible'],['prefer','Je préfère les fins de semaine'],['avoid','J’évite les fins de semaine']
]);
const PERIODS=new Set(['day','evening','night']);
export function parseHour(value,max,label){
 const s=String(value??'').trim().replace(',','.');
 if(!s)return null;
 if(!/^\d+(?:\.\d{1,2})?$/.test(s)||Number(s)>max)throw Error(label+' doit être compris entre 0 et '+max+' heures.');
 return Number(s);
}
export function preferencePayload(form,worker,request,version){
 if(!worker)throw Error('Choisissez un salarié.');
 const periods=String(form.prefPeriods??'').split(',').filter(Boolean);
 if(periods.length>3||new Set(periods).size!==periods.length||periods.some(x=>!PERIODS.has(x)))throw Error('Préférences de quart invalides.');
 if(!WEEKEND_CHOICES.some(x=>x[0]===form.prefWeekend))throw Error('Préférence de fin de semaine invalide.');
 const volunteer=form.prefVolunteer==='true',late=volunteer&&form.prefLastMinute==='true';
 if(!['true','false'].includes(form.prefVolunteer)||!['true','false'].includes(form.prefLastMinute))throw Error('Confirmez votre disponibilité pour les quarts supplémentaires.');
 return {p_worker:worker,p_desired:parseHour(form.prefDesired,80,'Heures souhaitées'),
  p_periods:periods,p_weekend:form.prefWeekend,p_volunteer:volunteer,p_last_minute:late,
  p_extra:volunteer?parseHour(form.prefExtra,40,'Heures supplémentaires souhaitées'):null,
  p_version:Number(version||0),p_request:request};
}
export function contractPayload(form,worker,version){
 if(!worker)throw Error('Choisissez un salarié.');
 const min=parseHour(form.contractMin,80,'Minimum déclaré'),max=parseHour(form.contractMax,80,'Maximum déclaré');
 if(min!==null&&max!==null&&min>max)throw Error('Le minimum déclaré dépasse le maximum.');
 const seniority=String(form.contractSeniority??'').trim();
 if(seniority&&!/^\d{4}-\d{2}-\d{2}$/.test(seniority))throw Error('Date d’ancienneté invalide.');
 return {p_worker:worker,p_seniority:seniority||null,p_min:min,p_max:max,p_version:Number(version||0)};
}
export function periodLabel(periods){
 return (periods||[]).map(x=>({day:'jour',evening:'soir',night:'nuit'})[x]||'?').join(', ')||'Aucune préférence';
}
