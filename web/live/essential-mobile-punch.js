// Kiosk-only employees retain the other employee views, but cannot initiate a
// mobile punch. UI fail-closed is not a substitute for server RPC policy.
export function canUseEssentialMobilePunch(companyId,userId,worker){
 return typeof companyId==='string'&&companyId.length>0&&
  typeof userId==='string'&&userId.length>0&&
  worker?.company_id===companyId&&worker?.auth_user_id===userId&&
  worker?.status==='active'&&worker?.personal_access===true&&worker?.can_mobile_punch===true;
}
export function essentialMobilePunchNotice(worker){
 return worker?.can_mobile_punch===false
  ?'Le pointage se fait sur la borne de votre entreprise. Vos heures et horaires restent accessibles.'
  :'Pointage mobile non confirmé. Consultez votre responsable avant de pointer.';
}

// An informational summary from the last server-acknowledged session snapshot.
// Never use optimistic offline punch projections or another company's records.
export function lastConfirmedKioskPunch(companyId,snapshotCompanyId,userId,snapshot){
 if(typeof companyId!=='string'||!companyId||companyId!==snapshotCompanyId||
    typeof userId!=='string'||!userId||!Array.isArray(snapshot?.sessions))return null;
 const sessions=snapshot.sessions.filter(s=>
  s?.company_id===companyId&&s.user_id===userId&&
  typeof s.started_at==='string'&&Number.isFinite(Date.parse(s.started_at))&&
  (s.ended_at==null||(typeof s.ended_at==='string'&&Number.isFinite(Date.parse(s.ended_at))&&
    Date.parse(s.ended_at)>=Date.parse(s.started_at))));
 if(!sessions.length)return null;
 const latest=sessions.reduce((a,b)=>Date.parse(a.started_at)>=Date.parse(b.started_at)?a:b);
 return {type:latest.ended_at?'out':'in',at:latest.ended_at||latest.started_at};
}

/** Bind the pointage action to the worker's server-selected workplace.
 * Never fall back to an unrelated selected Job if the location is absent.
 * The server must still revalidate all permissions on the actual event.
 */
export function resolveEssentialPunchJob(companyId,jobId,jobs){
 if(typeof companyId!=='string'||!companyId||
  typeof jobId!=='string'||!jobId||!Array.isArray(jobs))return null;
 return jobs.find(job=>job?.id===jobId&&job.company_id===companyId&&job.active===true)||null;
}

/** An existing Punch OUT belongs to the authenticated worker's open
 * session/segment, even when that location is now inactive or absent from
 * the ACTIVE jobs list. The SQL sync_punch_event -> punch_with_location
 * derives the OUT job from the open server segment: p_job must be null.
 * PUNCH IN continues to require an active job of the same company.
 * This is a UI guard only; the server remains authoritative.
 */
export function resolveEssentialMobilePunchAction(companyId,userId,activeSession,segments,assignedJobId,jobs){
 if(typeof companyId!=='string'||!companyId||
  typeof userId!=='string'||!userId)return null;
 if(activeSession){
  if(activeSession.company_id!==companyId||
   activeSession.user_id!==userId||
   typeof activeSession.id!=='string'||!activeSession.id||
   activeSession.ended_at!=null||!Array.isArray(segments))return null;
  const matching=segments.filter(segment=>
   segment?.session_id===activeSession.id&&segment.company_id===companyId&&
   segment.ended_at==null&&
   (segment.user_id==null||segment.user_id===userId)&&
   typeof segment.job_id==='string'&&segment.job_id.length>0);
  return matching.length===1?{action:'out',jobId:null}:null;
 }
 const workplace=resolveEssentialPunchJob(companyId,assignedJobId,jobs);
 return workplace?{action:'in',jobId:workplace.id}:null;
}

/** First-use guidance only from the current company's server-acknowledged
 * session snapshot. Pending journal events do not imply a first punch.
 */
export function firstEssentialPunchGuidance(companyId,userId,worker,snapshotCompanyId,
 snapshot,pendingCount,workplace){
 if(!canUseEssentialMobilePunch(companyId,userId,worker)||
  snapshotCompanyId!==companyId||!Array.isArray(snapshot?.sessions)||
  !Number.isSafeInteger(pendingCount)||pendingCount!==0)return null;
 // A conflicting same-user session from another company is not evidence
 // of a first punch in this company. Do not trust a mixed saved snapshot.
 if(snapshot.sessions.some(session=>session?.user_id===userId&&
  session.company_id!==companyId))return null;
 if(snapshot.sessions.some(session=>session?.company_id===companyId&&
  session.user_id===userId))return null;
 return workplace?'ready':'missing-workplace';
}

/** A worker assigned to a location must never silently be punched at the
 * company's default location if their assigned location is unavailable.
 */
export function essentialWorkerPunchJobId(companyId,worker,locations,defaultJobId){
 if(worker?.location_id){
  if(!Array.isArray(locations))return null;
  const location=locations.find(item=>item?.id===worker.location_id&&item.company_id===companyId&&item.active===true);
  return typeof location?.punch_job_id==='string'?location.punch_job_id:null;
 }
 return typeof defaultJobId==='string'?defaultJobId:null;
}
