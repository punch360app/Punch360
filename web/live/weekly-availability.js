// Shared Web/Expo weekly scheduling input and display. Server remains authoritative.
export const WEEKDAYS=Object.freeze(['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']);
export function parseWeekdays(value){
 const parts=String(value??'').split(',').map(x=>x.trim());
 const days=parts.map(Number);
 if(!parts.length||parts.some(x=>! /^[1-7]$/.test(x))||new Set(days).size!==days.length){
  throw Error('Indiquez des jours ISO uniques, de 1 (lundi) à 7 (dimanche), séparés par des virgules.');
 }
 return days.sort((a,b)=>a-b);
}
export function weeklyArgs(form,workerId,requestId){
 const days=parseWeekdays(form.weeklyDays);
 const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
 const start=String(form.weeklyStart??''),end=String(form.weeklyEnd??'');
 if(!time.test(start)||!time.test(end)||start>=end)throw Error('Heures 24 h valides requises (07:00–15:00). Pour la nuit, créez deux plages.');
 const date=/^\d{4}-\d{2}-\d{2}$/;
 const from=String(form.weeklyFrom??''),until=String(form.weeklyUntil??'');
 if(!date.test(from)||!Number.isFinite(Date.parse(from+'T12:00:00Z')))throw Error('Date de début requise.');
 if(until&&(!date.test(until)||!Number.isFinite(Date.parse(until+'T12:00:00Z'))||until<from))throw Error('Date de fin invalide.');
 if(!workerId)throw Error('Choisissez le salarié.');
 if(!form.weeklyLocation)throw Error('Choisissez un établissement.');
 if(form.weeklyAvailable!=='true'&&form.weeklyAvailable!=='false')throw Error('Choisissez disponible ou indisponible.');
 return {p_worker:workerId,p_location:form.weeklyLocation,p_days:days,p_start:start,p_end:end,
  p_from:from,p_until:until||null,p_available:form.weeklyAvailable==='true',p_request:requestId};
}
export function weeklyDaysLabel(days){return (days||[]).map(x=>WEEKDAYS[x-1]||'?').join(', ');}
export function weeklyPreviewLabel(p){
 return ({available:'Disponible',unavailable:'Indisponible',unknown:'Inconnu'})[p?.status]||'Inconnu';
}
