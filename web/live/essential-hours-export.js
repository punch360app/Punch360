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
/** Segment-specific time; unpaid breaks are clipped to segment boundaries.
 * Overlapping break intervals are merged to prevent double subtraction.
 */
export function segmentExportDuration(row,breaks=[]){
 const start=timestamp(row?.started_at),end=timestamp(row?.ended_at);
 if(start===null)return {gross:'',unpaid:'',net:'',anomaly:'HORODATAGE INVALIDE'};
 if(row?.ended_at==null)return {gross:'',unpaid:'',net:'',anomaly:'SORTIE MANQUANTE'};
 if(end===null)return {gross:'',unpaid:'',net:'',anomaly:'HORODATAGE INVALIDE'};
 if(end<start)return {gross:'',unpaid:'',net:'',anomaly:'SORTIE AVANT ENTRÉE'};
 const periods=(Array.isArray(breaks)?breaks:[]).filter(b=>b?.session_id===row.session_id&&b.is_paid!==true)
  .map(b=>{const a=timestamp(b.started_at),z=b.ended_at==null?end:timestamp(b.ended_at);
    return a===null||z===null||z<a?null:[Math.max(a,start),Math.min(z,end)];})
  .filter(interval=>interval&&interval[1]>interval[0]).sort((a,b)=>a[0]-b[0]);
 let unpaid=0,lo=null,hi=null;
 for(const [a,z] of periods){
  if(lo===null){lo=a;hi=z;continue}
  if(a<=hi){hi=Math.max(hi,z);continue}
  unpaid+=hi-lo;lo=a;hi=z;
 }
 if(lo!==null)unpaid+=hi-lo;
 const gross=end-start,net=Math.max(0,gross-unpaid);
 return {gross:hours(gross),unpaid:hours(Math.min(unpaid,gross)),net:hours(net),
  anomaly:gross>16*3600000?'PLUS DE 16H':''};
}
