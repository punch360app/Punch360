/**
 * Employee's Essential hours: never present a projected local punch as a
 * server-confirmed session or official payroll. All records are scoped to the
 * authenticated user and the currently selected company.
 */
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
import {netSegmentMilliseconds} from './essential-hours-export.js';
function netMilliseconds(segments,breaks,from,until){
 const bySession=new Map();
 for(const pause of breaks){
  const id=pause?.session_id;
  if(typeof id!=='string')continue;
  const current=bySession.get(id)||[];
  current.push(pause);bySession.set(id,current);
 }
 return segments.reduce((total,segment)=>
  total+netSegmentMilliseconds(segment,bySession.get(segment.session_id)||[],from,until),0);
}
export function essentialHoursView({companyId,userId,snapshotCompanyId,snapshot,
 projectedSessions=[],projectedSegments=[],projectedBreaks=[],pendingCount=0,now=Date.now(),snapshotFetchedAt=null}={}){
 const ready=typeof companyId==='string'&&companyId.length>0&&
  typeof userId==='string'&&userId.length>0&&snapshotCompanyId===companyId&&
  Array.isArray(snapshot?.sessions)&&Array.isArray(snapshot?.segments)&&
  Array.isArray(snapshot?.breaks)&&Number.isFinite(now);
 if(!ready)return {ready:false,confirmedSessions:[],confirmedDays:[],confirmedWeekMs:0,projectedWeekMs:null,
  pending:0,hasPending:false};
 const cutoff=Number.isFinite(snapshotFetchedAt)&&snapshotFetchedAt>0?Math.min(now,snapshotFetchedAt):now;
 // The requested week belongs to the viewer's current clock, not the
 // time the last server snapshot was fetched. A stale Sunday cache must
 // never appear as this Monday's confirmed hours.
 const d=new Date(now),monday=new Date(d.getFullYear(),d.getMonth(),d.getDate()-(d.getDay()+6)%7).getTime();
 const confirmedSessions=snapshot.sessions.filter(s=>s?.company_id===companyId&&
  s.user_id===userId&&validDate(s.started_at)!==null&&
  (s.ended_at==null||(validDate(s.ended_at)!==null&&validDate(s.ended_at)>=validDate(s.started_at))))
  .sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at));
 const approvedIds=new Set(confirmedSessions.map(s=>s.id));
 const confirmedSegments=snapshot.segments.filter(s=>approvedIds.has(s.session_id)&&
  (!s.company_id||s.company_id===companyId));
 const confirmedBreaks=snapshot.breaks.filter(s=>approvedIds.has(s.session_id)&&
  (!s.company_id||s.company_id===companyId));
 const confirmedWeekMs=netMilliseconds(confirmedSegments,confirmedBreaks,monday,cutoff);
 const confirmedDays=confirmedSessions.map(session=>{
  const parts=confirmedSegments.filter(segment=>segment.session_id===session.id);
  const pauses=confirmedBreaks.filter(pause=>pause.session_id===session.id);
  const from=validDate(session.started_at);
  const until=session.ended_at==null?cutoff:Math.min(cutoff,validDate(session.ended_at));
  return {session,netMs:until!==null&&from!==null&&until>=from?
   netMilliseconds(parts,pauses,from,until):0,open:session.ended_at==null};
 });
 const pending=Number.isSafeInteger(pendingCount)&&pendingCount>0?pendingCount:0;
 let projectedWeekMs=null;
 if(pending&&Array.isArray(projectedSessions)&&Array.isArray(projectedSegments)&&Array.isArray(projectedBreaks)){
  const projectedIds=new Set(projectedSessions.filter(s=>
   s?.company_id===companyId&&s.user_id===userId).map(s=>s.id));
  projectedWeekMs=netMilliseconds(
   projectedSegments.filter(s=>projectedIds.has(s.session_id)&&(!s.company_id||s.company_id===companyId)),
   projectedBreaks.filter(s=>projectedIds.has(s.session_id)&&(!s.company_id||s.company_id===companyId)),
   monday,now);
 }
 return {ready:true,confirmedSessions,confirmedDays,confirmedWeekMs,projectedWeekMs,
  pending,hasPending:pending>0};
}
