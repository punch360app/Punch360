/** Validate mobile scheduling inputs before calling the existing secured RPC.
 * The server still enforces membership, conflicts, leave, and a 24-hour maximum.
 */
function zonedIsoTime(value:string,label:string):string{
 const input=value.trim();
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/i.exec(input);
 if(!match)throw Error(label+' : indique une date ISO complète avec fuseau (ex. 2026-11-03T07:00:00-05:00).');
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
 const hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]||0);
 const maxDay=month>=1&&month<=12?new Date(Date.UTC(year,month,0)).getUTCDate():0;
 const zoneHour=Number(match[10]||0),zoneMinute=Number(match[11]||0);
 if(year<100||day<1||day>maxDay||hour>23||minute>59||second>59||
   zoneHour>14||zoneMinute>59||(zoneHour===14&&zoneMinute!==0))
  throw Error(label+' : date ou fuseau invalide.');
 const time=Date.parse(input);
 if(!Number.isFinite(time))throw Error(label+' : date invalide.');
 return new Date(time).toISOString();
}
export function validatedScheduleShift(params:{
 companyId:string;userId:string;jobId:string;start:string;end:string;note:string;
}){
 if(!params.companyId.trim())throw Error('Entreprise requise pour planifier.');
 if(!params.userId.trim())throw Error('Sélectionne un employé actif.');
 if(!params.jobId.trim())throw Error('Sélectionne un chantier.');
 const p_start=zonedIsoTime(params.start,'Début');
 const p_end=zonedIsoTime(params.end,'Fin');
 const duration=Date.parse(p_end)-Date.parse(p_start);
 if(duration<=0)throw Error('La fin du quart doit être après le début.');
 if(duration>24*60*60*1000)throw Error('Un quart ne peut pas dépasser 24 heures.');
 return {p_company:params.companyId,p_user:params.userId,p_job:params.jobId,
  p_start,p_end,p_note:params.note.trim()};
}
export function validatedShiftCancellationReason(reason:string):string{
 const value=reason.trim();
 if(value.length<3)throw Error('Indique un motif d’annulation d’au moins 3 caractères.');
 return value;
}
