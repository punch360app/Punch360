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

/** Limit display time to the last complete server fetch, without changing
 * pending local events. Legacy caches without a fetch timestamp can still
 * display closed shifts, but must not infer how long an open shift lasted.
 * A short 10s clock tolerance covers state-render delays; a large clock
 * rollback cannot turn an old snapshot into verified open time.
 * @param {{now:number,snapshotFetchedAt?:number|null,hasLocalProjection?:boolean}} options
 */
export function essentialMobileHoursLimit({now,snapshotFetchedAt=null,hasLocalProjection=false}){
 if(!Number.isFinite(now))return {until:0,excludeOpen:true};
 if(hasLocalProjection===true)return {until:now,excludeOpen:false};
 if(typeof snapshotFetchedAt==='number'&&Number.isFinite(snapshotFetchedAt)&&
   snapshotFetchedAt>0&&snapshotFetchedAt<=now+10000)
  return {until:Math.min(now,snapshotFetchedAt),excludeOpen:false};
 return {until:now,excludeOpen:true};
}
/** Day-by-day native estimates: one scoped segment source and one break engine.
 * These rows may contain pending local events; they are not payroll approvals.
 * Use local civil midnights instead of fixed 24h intervals across DST.
 *
 * Explicit JSDoc keeps TypeScript from inferring never[] for the default
 * empty arrays when this shared JS function is imported by native Expo.
 * @param {{
 *   sessions?: Array<{id:string,company_id:string,user_id:string|null}>,
 *   segments?: Array<{session_id:string,company_id:string,user_id?:string|null,started_at:string,ended_at:string|null}>,
 *   breaks?: Array<{session_id:string,company_id?:string|null,user_id?:string|null,started_at:string,ended_at:string|null,is_paid?:boolean}>,
 *   companyId?: string,
 *   userId?: string,
 *   now?: number,
 *   cutoff?: number,
 *   weekAt?: number
 * }} [options]
 */
export function essentialMobileDailyHours({sessions=[],segments=[],breaks=[],companyId,userId,now=Date.now(),cutoff=now,weekAt=now}={}){
 if(typeof companyId!=='string'||!companyId||typeof userId!=='string'||!userId||
  !Number.isFinite(now)||!Number.isFinite(cutoff)||!Number.isFinite(weekAt)||!Array.isArray(sessions)||!Array.isArray(segments)||
  !Array.isArray(breaks))return [];
 const ids=new Set(sessions.filter(s=>s?.company_id===companyId&&s.user_id===userId&&
  typeof s.id==='string'&&s.id).map(s=>s.id));
 const parts=segments.filter(s=>s&&ids.has(s.session_id)&&s.company_id===companyId&&
  (s.user_id==null||s.user_id===userId));
 const pauses=new Map();
 for(const b of breaks)if(b&&ids.has(b.session_id)&&
  (b.company_id==null||b.company_id===companyId)&&
  (b.user_id==null||b.user_id===userId)){
  const list=pauses.get(b.session_id)||[];list.push(b);pauses.set(b.session_id,list);
 }
 const latest=Math.min(now,cutoff);
 const today=new Date(weekAt),week=new Date(today.getFullYear(),today.getMonth(),
  today.getDate()-(today.getDay()+6)%7);
 const rows=[];
 for(let n=0;n<7;n++){
  const dayStart=new Date(week.getFullYear(),week.getMonth(),week.getDate()+n).getTime();
  if(dayStart>latest)break;
  const until=Math.min(latest,new Date(week.getFullYear(),week.getMonth(),week.getDate()+n+1).getTime());
  const grossMs=parts.reduce((sum,s)=>sum+
   netSegmentMilliseconds(s,[],dayStart,until),0);
  const netMs=parts.reduce((sum,s)=>sum+
   netSegmentMilliseconds(s,pauses.get(s.session_id)||[],dayStart,until),0);
  // Even a full-day unpaid pause needs a visible daily record (zero net).
  if(grossMs>0)rows.unshift({dayStart,netMs,grossMs,unpaidMs:Math.max(0,grossMs-netMs)});
 }
 return rows;
}

/** An employee can refresh a cached hours snapshot even without pending punches.
 * Unknown or blocked journal state must not bypass local journal protections.
 * @param {{readSource?:'server'|'cache',pending?:number,blocked?:boolean}} [options]
 */
export function shouldOfferEssentialCachedRefresh({readSource,pending,blocked}={}){
 return readSource==='cache'&&pending===0&&blocked===false;
}

export function essentialHoursView({companyId,userId,snapshotCompanyId,snapshot,
 projectedSessions=[],projectedSegments=[],projectedBreaks=[],pendingCount=0,now=Date.now(),snapshotFetchedAt=null,weekOffset=0}={}){
 const ready=typeof companyId==='string'&&companyId.length>0&&
  typeof userId==='string'&&userId.length>0&&snapshotCompanyId===companyId&&
  Array.isArray(snapshot?.sessions)&&Array.isArray(snapshot?.segments)&&
  Array.isArray(snapshot?.breaks)&&Number.isFinite(now)&&
  Number.isInteger(weekOffset)&&weekOffset>=0&&weekOffset<=4;
 if(!ready)return {ready:false,confirmedSessions:[],confirmedDays:[],confirmedWeekDays:[],confirmedDaily:[],confirmedWeekMs:0,projectedWeekMs:null,
  pending:0,hasPending:false};
 const cutoff=Number.isFinite(snapshotFetchedAt)&&snapshotFetchedAt>0?Math.min(now,snapshotFetchedAt):now;
 // The requested week belongs to the viewer's current clock, not the
 // time the last server snapshot was fetched. A stale Sunday cache must
 // never appear as this Monday's confirmed hours.
 const d=new Date(now);
 // Local calendar boundaries (not 7 * 24 hours), including DST transitions.
 const mondayDate=new Date(d.getFullYear(),d.getMonth(),d.getDate()-(d.getDay()+6)%7-7*weekOffset);
 const monday=mondayDate.getTime();
 const weekEnd=new Date(mondayDate.getFullYear(),mondayDate.getMonth(),mondayDate.getDate()+7).getTime();
 const weekUntil=Math.min(cutoff,weekEnd);
 const confirmedSessions=snapshot.sessions.filter(s=>s?.company_id===companyId&&
  s.user_id===userId&&validDate(s.started_at)!==null&&
  (s.ended_at==null||(validDate(s.ended_at)!==null&&validDate(s.ended_at)>=validDate(s.started_at))))
  .sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at));
 const approvedIds=new Set(confirmedSessions.map(s=>s.id));
 const confirmedSegments=snapshot.segments.filter(s=>approvedIds.has(s.session_id)&&
  (!s.company_id||s.company_id===companyId)&&
  (s.user_id==null||s.user_id===userId));
 const confirmedBreaks=snapshot.breaks.filter(s=>approvedIds.has(s.session_id)&&
  (!s.company_id||s.company_id===companyId)&&
  (s.user_id==null||s.user_id===userId));
 const confirmedWeekMs=netMilliseconds(confirmedSegments,confirmedBreaks,monday,weekUntil);
 // Web daily detail uses the same scoped, read-only calculation as Expo,
 // bounded by the last server read rather than the viewer's later clock.
 const confirmedDaily=essentialMobileDailyHours({companyId,userId,
  sessions:confirmedSessions,segments:confirmedSegments,breaks:confirmedBreaks,now,
  cutoff:weekUntil,weekAt:monday});
 const confirmedDays=confirmedSessions.map(session=>{
  const parts=confirmedSegments.filter(segment=>segment.session_id===session.id);
  const pauses=confirmedBreaks.filter(pause=>pause.session_id===session.id);
  const from=validDate(session.started_at);
  const until=session.ended_at==null?cutoff:Math.min(cutoff,validDate(session.ended_at));
  return {session,netMs:until!==null&&from!==null&&until>=from?
   netMilliseconds(parts,pauses,from,until):0,open:session.ended_at==null};
 });
 // A selected week's session history must use the same server-only, local-week
 // boundaries as the weekly total. Clipping each segment (rather than the
 // session start date) includes overnight work spanning two weeks, without
 // exposing hours worked in adjacent weeks.
 const confirmedWeekDays=weekUntil>monday?confirmedDays.map(({session,open})=>{
  const parts=confirmedSegments.filter(segment=>segment.session_id===session.id);
  const grossMs=netMilliseconds(parts,[],monday,weekUntil);
  if(grossMs<=0)return null;
  const pauses=confirmedBreaks.filter(pause=>pause.session_id===session.id);
  return {session,netMs:netMilliseconds(parts,pauses,monday,weekUntil),open};
 }).filter(Boolean):[];
 const pending=Number.isSafeInteger(pendingCount)&&pendingCount>0?pendingCount:0;
 let projectedWeekMs=null;
 if(pending&&Array.isArray(projectedSessions)&&Array.isArray(projectedSegments)&&Array.isArray(projectedBreaks)){
  const projectedIds=new Set(projectedSessions.filter(s=>
   s?.company_id===companyId&&s.user_id===userId).map(s=>s.id));
  projectedWeekMs=netMilliseconds(
   projectedSegments.filter(s=>projectedIds.has(s.session_id)&&
    (!s.company_id||s.company_id===companyId)&&
    (s.user_id==null||s.user_id===userId)),
   projectedBreaks.filter(s=>projectedIds.has(s.session_id)&&
    (!s.company_id||s.company_id===companyId)&&
    (s.user_id==null||s.user_id===userId)),
   monday,Math.min(now,weekEnd));
 }
 return {ready:true,confirmedSessions,confirmedDays,confirmedWeekDays,confirmedDaily,confirmedWeekMs,projectedWeekMs,
  pending,hasPending:pending>0};
}

/**
 * Personal J1 adjustment tracking. Inputs are independently scoped server
 * views; a partial read must not be described as an empty confirmed inbox.
 * Review statuses are decisions on requests, never an approval of payroll.
 */
export function employeeHoursRequestTimeline({companyId,userId,correctionView,breakView,missingView,leaveView,limit=8}={}){
 const empty={complete:false,pendingCount:0,total:0,items:[],unavailable:[]};
 if(typeof companyId!=='string'||!companyId||typeof userId!=='string'||!userId)return empty;
 const allowed=new Set(['pending','approved','rejected','cancelled']);
 const sources=[
  {kind:'heures',title:'Correction d’heures',view:correctionView,
   rows:correctionView?.requests,belongs:r=>r?.requested_by===userId&&
    (r.company_id==null||r.company_id===companyId),date:r=>r.created_at},
  {kind:'pauses',title:'Correction de pause',view:breakView,
   rows:breakView?.requests,belongs:r=>r?.requested_by===userId&&
    r.company_id===companyId,date:r=>r.created_at},
  {kind:'journée',title:'Journée oubliée',view:missingView,
   rows:missingView?.requests,belongs:r=>typeof r?.startsAt==='string',
   date:r=>r.createdAt||r.startsAt},
  // Optional for older callers; My Hours supplies this scoped personal
  // leave inbox to show all J1 requests without inventing payroll status.
  ...(leaveView===undefined?[]:[{kind:'congé',title:'Congé ou absence',view:leaveView,
   rows:leaveView?.requests,belongs:r=>r?.company_id===companyId&&r.user_id===userId,
   date:r=>r.created_at||r.begins_on}])
 ];
 const unavailable=[],found=[];
 for(const source of sources){
  if(source.view?.ready!==true||!Array.isArray(source.rows)){
   unavailable.push(source.title);continue;
  }
  for(const row of source.rows){
   if(!source.belongs(row)||!allowed.has(row.status)||typeof row.id!=='string'||!row.id)continue;
   const at=source.date(row),when=typeof at==='string'&&Number.isFinite(Date.parse(at))?at:null;
   found.push({key:source.kind+':'+row.id,title:source.title,status:row.status,
    label:({pending:'En attente',approved:'Approuvée',rejected:'Refusée',cancelled:'Annulée'})[row.status],
    at:when});
  }
 }
 found.sort((a,b)=>(b.at?Date.parse(b.at):0)-(a.at?Date.parse(a.at):0));
 const max=Number.isSafeInteger(limit)?Math.min(100,Math.max(0,limit)):8;
 return {complete:unavailable.length===0,
  pendingCount:found.filter(r=>r.status==='pending').length,total:found.length,
  items:found.slice(0,max),unavailable};
}
