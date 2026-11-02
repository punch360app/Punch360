/**
 * Employee's Essential hours: never present a projected local punch as a
 * server-confirmed session or official payroll. All records are scoped to the
 * authenticated user and the currently selected company.
 */
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
const bounded=(start,end,from,until)=>{
 const a=validDate(start),b=end==null?until:validDate(end);
 if(a===null||b===null||b<a)return 0;
 return Math.max(0,Math.min(b,until)-Math.max(a,from));
};
function netMilliseconds(segments,breaks,from,until){
 const gross=segments.reduce((total,row)=>total+bounded(row.started_at,row.ended_at,from,until),0);
 const unpaid=breaks.filter(x=>x.is_paid===false).reduce((total,row)=>
  total+bounded(row.started_at,row.ended_at,from,until),0);
 return Math.max(0,gross-unpaid);
}
export function essentialHoursView({companyId,userId,snapshotCompanyId,snapshot,
 projectedSessions=[],projectedSegments=[],projectedBreaks=[],pendingCount=0,now=Date.now()}={}){
 const ready=typeof companyId==='string'&&companyId.length>0&&
  typeof userId==='string'&&userId.length>0&&snapshotCompanyId===companyId&&
  Array.isArray(snapshot?.sessions)&&Array.isArray(snapshot?.segments)&&
  Array.isArray(snapshot?.breaks)&&Number.isFinite(now);
 if(!ready)return {ready:false,confirmedSessions:[],confirmedWeekMs:0,projectedWeekMs:null,
  pending:0,hasPending:false};
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
 const confirmedWeekMs=netMilliseconds(confirmedSegments,confirmedBreaks,monday,now);
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
 return {ready:true,confirmedSessions,confirmedWeekMs,projectedWeekMs,
  pending,hasPending:pending>0};
}
