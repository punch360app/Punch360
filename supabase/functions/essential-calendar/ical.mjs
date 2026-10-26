/** Portable RFC 5545 generator for subscribed personal calendars, including cancellations. */
const stamp=value=>{
 const d=new Date(value);
 if(!Number.isFinite(d.getTime()))throw Error('Invalid calendar date');
 return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
};
const esc=value=>String(value??'').replace(/\\/g,'\\\\').replace(/\r\n?|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const fold=line=>{
 let pieces=[],part='',size=0;
 for(const char of line){const n=char.codePointAt(0)<128?1:char.codePointAt(0)<2048?2:char.codePointAt(0)<65536?3:4;
  if(size+n>75){pieces.push(part);part=' '+char;size=n+1;}else{part+=char;size+=n;}
 }
 pieces.push(part);return pieces.join('\r\n');
};
const safe=value=>String(value??'').replace(/[^a-z0-9-]/gi,'').slice(0,72);
export function buildSubscribedCalendar({companyId,workerId,shifts=[],locations=[],now=new Date()}){
 if(!companyId||!workerId||!Array.isArray(shifts)||shifts.length>1000)throw Error('Invalid personal schedule');
 const nowStamp=stamp(now);
 const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PUNCH 360//Mon Horaire//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+esc('Mon horaire PUNCH')];
 const valid=shifts.filter(x=>x?.company_id===companyId&&x?.worker_id===workerId&&x.id&&x.starts_at&&x.ends_at)
 .filter(x=>Number.isFinite(Date.parse(x.starts_at))&&Number.isFinite(Date.parse(x.ends_at))&&Date.parse(x.starts_at)<Date.parse(x.ends_at))
 .sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||String(a.id).localeCompare(String(b.id)));
 for(const x of valid){
  const place=locations.find(l=>l.id===x.location_id&&(!l.company_id||l.company_id===companyId));
  const seq=Number.isSafeInteger(Number(x.version))?Math.max(0,Number(x.version)):0;
  rows.push('BEGIN:VEVENT','UID:'+safe(x.id)+'@'+safe(companyId)+'.punch360.app','DTSTAMP:'+nowStamp,
   'DTSTART:'+stamp(x.starts_at),'DTEND:'+stamp(x.ends_at),'SEQUENCE:'+seq,
   'SUMMARY:'+esc('PUNCH · Quart de travail'),
   'STATUS:'+(x.cancelled_at?'CANCELLED':'CONFIRMED'),
   ...(place?.name?['LOCATION:'+esc(place.name)]:[]),'END:VEVENT');
 }
 rows.push('END:VCALENDAR');
 return {content:rows.map(fold).join('\r\n')+'\r\n',count:valid.length};
}
