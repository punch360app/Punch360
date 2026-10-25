/** Read-only, one-time iCalendar export of a worker's own published shifts.
 * Not an auto-synchronizing subscription or an employee directory export.
 */
const stamp=value=>{
 const d=new Date(value);
 if(!Number.isFinite(d.getTime()))throw Error('Date invalide dans le calendrier.');
 return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
};
const quote=value=>String(value??'').replace(/\\/g,'\\\\').replace(/\r\n?|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const fold=line=>{
 const enc=new TextEncoder();let rows=[],chunk='',bytes=0;
 for(const char of line){
  const n=enc.encode(char).length;
  if(bytes+n>75){rows.push(chunk);chunk=' '+char;bytes=1+n;}
  else {chunk+=char;bytes+=n;}
 }
 rows.push(chunk);return rows.join('\r\n');
};
const safeId=id=>String(id).replace(/[^a-zA-Z0-9-]/g,'').slice(0,72);
export function buildPersonalCalendar({companyId,workerId,companyName='PUNCH Essentiel',shifts=[],locations=[],now=new Date()}={}){
 if(!companyId||!workerId)throw Error('Dossier salarié introuvable : export désactivé.');
 const issued=stamp(now),range=shifts.slice(0,1000);
 const valid=range.filter(x=>x?.company_id===companyId&&x?.worker_id===workerId&&!x.cancelled_at&&x.id&&x.starts_at&&x.ends_at)
  .filter(x=>Date.parse(x.starts_at)<Date.parse(x.ends_at)&&Number.isFinite(Date.parse(x.starts_at))&&Number.isFinite(Date.parse(x.ends_at)))
  .sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||String(a.id).localeCompare(String(b.id)));
 const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PUNCH 360//Horaire personnel//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+quote('Mon horaire PUNCH')];
 for(const x of valid){
  const place=locations.find(l=>l.id===x.location_id&&(!l.company_id||l.company_id===companyId));
  const version=Math.max(0,Number.isSafeInteger(Number(x.version))?Number(x.version):0);
  const event=['BEGIN:VEVENT',`UID:${safeId(x.id)}@${safeId(companyId)}.punch360.app`,'DTSTAMP:'+issued,'DTSTART:'+stamp(x.starts_at),'DTEND:'+stamp(x.ends_at),'SEQUENCE:'+version,'SUMMARY:'+quote('PUNCH · Quart de travail'),'STATUS:CONFIRMED',...(place?.name?['LOCATION:'+quote(place.name)]:[]),'END:VEVENT'];
  rows.push(...event);
 }
 rows.push('END:VCALENDAR');
 return {content:rows.map(fold).join('\r\n')+'\r\n',count:valid.length,truncated:shifts.length>1000};
}
export function downloadCalendarIcs({content,document=globalThis.document,urlApi=globalThis.URL,BlobType=globalThis.Blob}){
 if(!document||typeof urlApi?.createObjectURL!=='function')throw Error('Téléchargement de calendrier indisponible.');
 const blob=new BlobType([content],{type:'text/calendar;charset=utf-8'});
 const url=urlApi.createObjectURL(blob),a=document.createElement('a');
 try{a.href=url;a.download='PUNCH_horaire_personnel.ics';a.style.display='none';document.body.appendChild(a);a.click();}
 finally{a.remove();if(typeof globalThis.setTimeout==='function')globalThis.setTimeout(()=>urlApi.revokeObjectURL(url),1000);else urlApi.revokeObjectURL(url);}
}
