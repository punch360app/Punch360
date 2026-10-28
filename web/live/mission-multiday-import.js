// MISSION-012: multi-date CSV-to-DRAFT preview. No server writes or hidden
// scheduling: manager must fetch authorized full day snapshots for EVERY date.
import {validateMissionDraftRows} from './mission-batch-import.js';
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS=50,MAX_WINDOW=14;
function calendarDay(value){
 if(typeof value!=='string'||!DAY.test(value))throw Error('Date CSV invalide : format AAAA-MM-JJ.');
 const d=new Date(value+'T12:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)
  throw Error('Date CSV impossible : '+value);
 return d;
}
/** Accept today through today+14 calendar days, max 50 rows / 15 unique days.
 * Only dates are exposed; no names, addresses or other private CSV fields.
 */
export function missionImportDays(rows,today){
 if(!Array.isArray(rows)||rows.length===0||rows.length>MAX_ROWS)
  throw Error('Import limité à 1 à 50 missions.');
 const now=calendarDay(today),days=new Set();
 for(const row of rows){
  const when=calendarDay(row?.day);
  const offset=Math.round((when.getTime()-now.getTime())/86400000);
  if(offset<0||offset>MAX_WINDOW)
   throw Error('Ligne '+String(row?.line??'?')+' : date autorisée de la journée actuelle aux 14 prochains jours.');
  days.add(row.day);
 }
 return [...days].sort();
}
/** Merge the existing strict single-day validation per day. Any missing,
 * partial or foreign snapshot fails the whole batch without a write.
 */
export function validateMissionDraftBatch(rows,{roster,sites,byDay,sitesComplete=true,today}={}){
 const days=missionImportDays(rows,today);
 if(!byDay||typeof byDay!=='object'||!sitesComplete)
  throw Error('Liste des journées ou carnet incomplet : import refusé.');
 const validRows=[],errors=[];
 for(const day of days){
  const data=Object.hasOwn(byDay,day)?byDay[day]:null;
  if(!data||data.enabled!==true||data.truncated===true||!Array.isArray(data.items)||
    data.items.some(x=>!x||(x.mission_day&&x.mission_day!==day)))
   throw Error('Journée '+day+' non autorisée, incomplète ou incohérente : import refusé.');
  const group=rows.filter(row=>row.day===day);
  const result=validateMissionDraftRows(group,
   {roster,sites,existing:data.items,day,sitesComplete});
  validRows.push(...result.rows);
  errors.push(...result.errors);
 }
 // Preserve original CSV order after grouping, including across dates.
 const order=new Map(rows.map((r,i)=>[r.line,i]));
 validRows.sort((a,b)=>order.get(a.line)-order.get(b.line));
 errors.sort((a,b)=>order.get(a.line)-order.get(b.line));
 return {valid:errors.length===0&&validRows.length===rows.length,
  rows:validRows,errors,total:rows.length,days};
}
