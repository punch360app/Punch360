/** Prepare a server-only attendance CSV. Never use projected offline events.
 * Rows are already scoped by RLS and company/user query in the caller.
 */
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
const hours=ms=>(ms/3600000).toFixed(4);
export function sessionIdChunks(rows,size=100){
 if(!Array.isArray(rows)||!Number.isSafeInteger(size)||size<1||size>200)return [];
 const ids=[...new Set(rows.map(x=>x?.session_id).filter(x=>typeof x==='string'&&x.length>0))];
 const chunks=[];for(let n=0;n<ids.length;n+=size)chunks.push(ids.slice(n,n+size));
 return chunks;
}
/** Shared exact millisecond calculator for the live hours view and CSV export.
 * All intervals are clipped to this segment, and overlapping unpaid breaks
 * are counted once. The caller scopes the parent session to the logged-in
 * company and employee; this never authorizes server access.
 */
export function netSegmentMilliseconds(row,breaks,from,until){
 if(!Number.isFinite(from)||!Number.isFinite(until)||until<from)return 0;
 const start=timestamp(row?.started_at),end=row?.ended_at==null?until:timestamp(row.ended_at);
 if(start===null||end===null||end<start)return 0;
 const lo=Math.max(start,from),hi=Math.min(end,until);
 if(hi<=lo)return 0;
 const intervals=(Array.isArray(breaks)?breaks:[]).filter(p=>
  p?.session_id===row.session_id&&p.is_paid===false)
  .map(p=>{
   const a=timestamp(p.started_at),z=p.ended_at==null?hi:timestamp(p.ended_at);
   if(a===null||z===null||z<a)return null;
   return [Math.max(lo,a),Math.min(hi,z)];
  }).filter(i=>i&&i[1]>i[0]).sort((a,b)=>a[0]-b[0]);
 let unpaid=0,endOfBreak=lo;
 for(const [a,z] of intervals){
  unpaid+=Math.max(0,z-Math.max(a,endOfBreak));
  endOfBreak=Math.max(endOfBreak,z);
 }
 return Math.max(0,hi-lo-unpaid);
}
/** Segment-specific time; unpaid breaks are clipped to segment boundaries.
 * Overlapping break intervals are merged to prevent double subtraction.
 */
export function segmentExportDuration(row,breaks=[],session=row?.punch_sessions){
 const start=timestamp(row?.started_at),end=timestamp(row?.ended_at);
 if(start===null)return {gross:'',unpaid:'',net:'',anomaly:'HORODATAGE INVALIDE'};
 if(row?.ended_at==null)return {gross:'',unpaid:'',net:'',anomaly:'SORTIE MANQUANTE'};
 if(end===null)return {gross:'',unpaid:'',net:'',anomaly:'HORODATAGE INVALIDE'};
 if(end<start)return {gross:'',unpaid:'',net:'',anomaly:'SORTIE AVANT ENTRÉE'};
 // The exported segment must not claim payable time beyond its RLS-scoped
 // parent session, even if a legacy/corrupt segment has wider timestamps.
 const sessionStart=timestamp(session?.started_at);
 const sessionEnd=session?.ended_at==null?null:timestamp(session.ended_at);
 if(sessionStart===null||(session?.ended_at!=null&&
    (sessionEnd===null||sessionEnd<sessionStart)))
  return {gross:'',unpaid:'',net:'',anomaly:'SESSION NON VÉRIFIÉE'};
 const lo=Math.max(start,sessionStart),hi=Math.min(end,sessionEnd??end);
 if(hi<=lo)return {gross:'',unpaid:'',net:'',anomaly:'SEGMENT HORS SESSION'};
 const gross=hi-lo,net=netSegmentMilliseconds(row,breaks,lo,hi);
 return {gross:hours(gross),unpaid:hours(Math.max(0,gross-net)),net:hours(net),
  anomaly:lo!==start||hi!==end?'SEGMENT HORS SESSION':gross>16*3600000?'PLUS DE 16H':''};
}
