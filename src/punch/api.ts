import * as Network from 'expo-network';
import {getLocalIdentity} from '../auth/localIdentity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getPunchJournal} from './journal';
import {projectPendingPunches,hasUnsafePunchJournalEntries} from '../../web/live/journal.js';
import type {LocalPunchEvent} from '../../web/live/journal.js';
import {netSegmentMilliseconds} from '../../web/live/essential-hours-export.js';
import * as Location from 'expo-location';
import {supabase} from '../lib/supabase';
export type PunchSession={id:string;company_id:string;user_id:string|null;worker_id?:string|null;started_at:string;ended_at:string|null};
export type PunchSegment={id:string;session_id:string;company_id:string;user_id?:string|null;job_id:string;started_at:string;ended_at:string|null};
export type PunchBreak={id:string;session_id:string;started_at:string;ended_at:string|null;is_paid?:boolean;company_id?:string;user_id?:string};
export type PunchState={sessions:PunchSession[];segments:PunchSegment[];breaks?:PunchBreak[];active:PunchSession|null;lastJobId:string|null;localJournalBlocked?:boolean;readSource?:'server'|'cache';hasLocalProjection?:boolean;cacheWriteFailed?:boolean;snapshotUnverified?:boolean;snapshotFetchedAt?:number|null;hasAppliedLocalProjection?:boolean;baselineSnapshot?:{sessions:PunchSession[];segments:PunchSegment[];breaks:PunchBreak[]}};
export async function loadPunchState(companyId:string):Promise<PunchState>{
 const user=await getLocalIdentity();
 const journal=await getPunchJournal(companyId);
 // A blocked local queue must not prevent official hours from loading.
 let journalBlocked=false;
 try{await journal.flush()}catch{journalBlocked=true}
 const cacheKey='punch-state:'+user.id+':'+companyId;
 let snapshotUnverified=false;
 const overlay=async(state:PunchState,readSource:'server'|'cache',cacheWriteFailed=false)=>{
  // Prevent cross-company hours from legacy mixed offline snapshots.
  const ownSessions=(state.sessions||[]).filter(s=>s.company_id===companyId&&s.user_id===user.id);
  const ids=new Set(ownSessions.map(s=>s.id));
  // Older cached segments can carry an explicit user_id; reject foreign
  // ones even if their session_id collides with a valid personal session.
  // A valid segment must also fit inside its verified parent shift.
  // Legacy caches or inconsistent RPC rows may otherwise add hours before
  // PUNCH IN or after PUNCH OUT. Clip only the displayed projection; retain
  // the original stored snapshot for audit/recovery, not payroll approval.
  const sessionsById=new Map(ownSessions.map(s=>[s.id,s]));
  const ownSegments=(state.segments||[]).filter(s=>s.company_id===companyId&&
   ids.has(s.session_id)&&(s.user_id==null||s.user_id===user.id))
   .flatMap(s=>{
    const parent=sessionsById.get(s.session_id);
    if(!parent)return [];
    const start=Date.parse(s.started_at),shiftStart=Date.parse(parent.started_at);
    const end=s.ended_at===null?Infinity:Date.parse(s.ended_at);
    const shiftEnd=parent.ended_at===null?Infinity:Date.parse(parent.ended_at);
    if(!Number.isFinite(start)||!Number.isFinite(shiftStart)||
       Number.isNaN(end)||Number.isNaN(shiftEnd))return [];
    const clippedStart=Math.max(start,shiftStart),clippedEnd=Math.min(end,shiftEnd);
    if(clippedEnd<clippedStart)return [];
    if(start===clippedStart&&end===clippedEnd)return [s];
    return [{...s,
     started_at:new Date(clippedStart).toISOString(),
     ended_at:Number.isFinite(clippedEnd)?new Date(clippedEnd).toISOString():null}];
   });
  const ownBreaks=(state.breaks||[]).filter(b=>ids.has(b.session_id)&&
   (b.company_id==null||b.company_id===companyId)&&
   (b.user_id==null||b.user_id===user.id));
  const own={...state,sessions:ownSessions,segments:ownSegments,breaks:ownBreaks};
  let events:LocalPunchEvent[]=[];
  if(!journalBlocked)try{events=await journal.read()}catch{journalBlocked=true}
  const projected=projectPendingPunches(own,journalBlocked?[]:events,{company:companyId,user:user.id});
  return {...projected,
   localJournalBlocked:journalBlocked||snapshotUnverified,readSource,cacheWriteFailed,snapshotUnverified,
   snapshotFetchedAt:state.snapshotFetchedAt??null,
   // Immutable, identity-filtered baseline before local queue projection:
   // never present an offline event as server-acknowledged hours.
   baselineSnapshot:{sessions:ownSessions,segments:ownSegments,breaks:ownBreaks},
   hasAppliedLocalProjection:!journalBlocked&&projected.appliedLocalEvents>0,
   hasLocalProjection:!journalBlocked&&events.some(e=>e.status==='pending'&&e.company===companyId&&e.user===user.id)} as PunchState;
 };
 // A missing or corrupt cache is UNKNOWN attendance, not a verified empty day.
 // Keep damaged bytes intact and retain pending journal projections for review.
 // Repeated IDs can count one shift or pause twice in a corrupted cache
 // or a partial RPC read. Reject the snapshot instead of picking a winner.
 const hasDistinctIds=(rows:Array<{id:string}>)=>
  new Set(rows.map(row=>row.id)).size===rows.length;
 const offlineState=async()=>{
  let cached:PunchState|null=null;
  try{
   const raw=await AsyncStorage.getItem(cacheKey);
   if(raw)cached=JSON.parse(raw);
  }catch{/* Recover on the next successful server read. */}
  // Validate both ends of every cached interval. A partially corrupted
  // snapshot is UNKNOWN attendance, never a verified shift or pause.
  const validCachedRange=(row:{started_at:string;ended_at:string|null})=>
   typeof row?.started_at==='string'&&Number.isFinite(Date.parse(row.started_at))&&
   (row.ended_at===null||(typeof row.ended_at==='string'&&
    Number.isFinite(Date.parse(row.ended_at))&&
    Date.parse(row.ended_at)>=Date.parse(row.started_at)));
  const valid=cached&&Array.isArray(cached.sessions)&&Array.isArray(cached.segments)&&
   (cached.breaks==null||Array.isArray(cached.breaks))&&
   cached.sessions.every(s=>s&&typeof s.id==='string'&&!!s.id&&
    typeof s.company_id==='string'&&typeof s.user_id==='string'&&
    validCachedRange(s))&&
   cached.segments.every(s=>s&&typeof s.id==='string'&&!!s.id&&
    typeof s.company_id==='string'&&typeof s.session_id==='string'&&!!s.session_id&&
    typeof s.job_id==='string'&&!!s.job_id&&validCachedRange(s))&&
   (cached.breaks||[]).every(b=>b&&typeof b.id==='string'&&!!b.id&&
    typeof b.session_id==='string'&&!!b.session_id&&validCachedRange(b))&&
   hasDistinctIds(cached.sessions)&&hasDistinctIds(cached.segments)&&
   hasDistinctIds(cached.breaks||[]);
  if(!valid||!cached){
   snapshotUnverified=true;
   return overlay({sessions:[],segments:[],breaks:[],active:null,lastJobId:null},'cache');
  }
  return overlay(cached,'cache');
 };
 // If Expo cannot read network state, retain access to the last locally
 // saved, identity-scoped snapshot instead of hiding the worker's hours.
 let networkAvailable=false;
 try{
  const network=await Network.getNetworkStateAsync();
  networkAvailable=network.isConnected!==false&&network.isInternetReachable!==false;
 }catch{/* The cached snapshot is the safe fallback on network-state failure. */}
 if(!networkAvailable)return offlineState();
 // Supabase can reject a request promise or throw before returning a result.
 // A transport failure must retain the last complete scoped snapshot, not hide hours.
 try{
 const {data:sessions,error}=await supabase.from('punch_sessions')
  .select('id,company_id,user_id,started_at,ended_at')
  .eq('company_id',companyId).eq('user_id',user.id)
  .order('started_at',{ascending:false}).limit(500);
 // A structurally incomplete row must not masquerade as an empty or
 // confirmed attendance record. Keep the previous cache until a complete
 // server snapshot can be fetched; other tenant rows are filtered below.
 const validServerRange=(row:Record<string,unknown>|null)=>typeof row?.started_at==='string'&&
  Number.isFinite(Date.parse(row.started_at))&&
  (row.ended_at===null||(typeof row.ended_at==='string'&&
   Number.isFinite(Date.parse(row.ended_at))&&
   Date.parse(row.ended_at)>=Date.parse(row.started_at)));
 const validServerSession=(row:Record<string,unknown>|null)=>typeof row?.id==='string'&&!!row.id&&
  typeof row.company_id==='string'&&typeof row.user_id==='string'&&validServerRange(row);
 const validServerSegment=(row:Record<string,unknown>|null)=>typeof row?.id==='string'&&!!row.id&&
  typeof row.company_id==='string'&&typeof row.session_id==='string'&&!!row.session_id&&
  typeof row.job_id==='string'&&!!row.job_id&&validServerRange(row);
 const validServerBreak=(row:Record<string,unknown>|null)=>typeof row?.id==='string'&&!!row.id&&
  typeof row.session_id==='string'&&!!row.session_id&&validServerRange(row);
 if(error||!Array.isArray(sessions)||!sessions.every(validServerSession)||
    !hasDistinctIds(sessions))return offlineState();
 // A null or malformed successful response is not a verified empty shift.
 // Filter untrusted RPC rows before writing the offline snapshot. Filtering
 // only during UI projection would leave another tenant's records on disk.
 const list=((sessions||[]) as PunchSession[]).filter(s=>s&&s.company_id===companyId&&s.user_id===user.id);
 if(!list.length){const empty={sessions:[],segments:[],breaks:[],active:null,lastJobId:null,snapshotFetchedAt:Date.now()};let cacheWriteFailed=false;try{await AsyncStorage.setItem(cacheKey,JSON.stringify(empty))}catch{cacheWriteFailed=true}return overlay(empty,'server',cacheWriteFailed);}
 const {data:segments,error:segmentsError}=await supabase.from('punch_segments')
  .select('id,company_id,session_id,job_id,started_at,ended_at')
  .eq('company_id',companyId).in('session_id',list.map(s=>s.id))
  .order('started_at',{ascending:false});
 if(segmentsError||!Array.isArray(segments)||!segments.every(validServerSegment)||
    !hasDistinctIds(segments))return offlineState();
 const ownSessionIds=new Set(list.map(s=>s.id));
 const sorted=((segments||[]) as PunchSegment[]).filter(s=>s&&s.company_id===companyId&&
  ownSessionIds.has(s.session_id)&&(s.user_id==null||s.user_id===user.id));
 const breakResult=await supabase.from('punch_breaks').select('id,session_id,started_at,ended_at,is_paid').eq('company_id',companyId).eq('user_id',user.id);if(breakResult.error||!Array.isArray(breakResult.data)||
    !breakResult.data.every(validServerBreak)||!hasDistinctIds(breakResult.data))
  return offlineState();
 // Break rows do not select company_id/user_id on all schema versions;
 // their session_id must belong to a verified session before caching.
 const ownBreaks=((breakResult.data||[]) as PunchBreak[]).filter(b=>b&&ownSessionIds.has(b.session_id)&&
  (b.company_id==null||b.company_id===companyId)&&(b.user_id==null||b.user_id===user.id));
 const snapshot={breaks:ownBreaks,sessions:list,segments:sorted,active:list.find(s=>s.ended_at===null)||null,lastJobId:sorted[0]?.job_id||null,snapshotFetchedAt:Date.now()};let cacheWriteFailed=false;try{await AsyncStorage.setItem(cacheKey,JSON.stringify(snapshot))}catch{cacheWriteFailed=true}return overlay(snapshot,'server',cacheWriteFailed);
 }catch{return offlineState();}
}
export type LocationCheckResult={session_id:string;check_id:string;location_status:string;review_status:string;distance_m:number|null;radius_m:number;queued?:boolean};
async function punchWithLocation(companyId:string,action:'in'|'out'|'transfer'|'break_start'|'break_end',jobId?:string,paid=false):Promise<LocationCheckResult>{
 const occurredAt=new Date().toISOString();
 // Persist the network state at the point of capture, before a reconnect
 // can make an offline event appear to be an ordinary online punch.
 let offline=false;
 try{
  const network=await Network.getNetworkStateAsync();
  offline=network.isConnected===false||network.isInternetReachable===false;
 }catch{offline=true;}
 let latitude:number|null=null,longitude:number|null=null,accuracy:number|null=null;
 try{const permission=action.startsWith('break_')?null:await Location.requestForegroundPermissionsAsync();if(permission?.status==='granted'){
 const fix=await Promise.race([Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High}),new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('GPS indisponible')),6000))]);latitude=fix.coords.latitude;longitude=fix.coords.longitude;accuracy=fix.coords.accuracy;
 }}catch{/* A missing fix must never erase worked time; server flags it for review. */}
 const journal=await getPunchJournal(companyId);
 const event=await journal.append(action,jobId,latitude===null?null:{latitude,longitude:longitude!,accuracy},occurredAt,paid,offline);
 // The append was persisted before network. A failed flush may still leave
 // a valid pending or already acknowledged event; inspect that exact event.
 let events:LocalPunchEvent[]|null=null;
 try{events=(await journal.flush()).events}catch{/* Inspect persisted journal. */}
 if(!events||!events.some(e=>e.id===event.id)){
  try{events=await journal.read()}catch{
   throw Error('Pointage enregistré localement, mais journal illisible : vérifiez Mes heures avant de repointer.');
  }
 }
 if(hasUnsafePunchJournalEntries(events,journal.company,journal.user))
  throw Error('Journal local non vérifiable : pointage à vérifier avant une nouvelle opération.');
 const saved=events.find(e=>e.id===event.id);
 if(!saved)throw Error('Statut du pointage introuvable dans le journal local : vérifiez Mes heures avant de repointer.');
 if(saved.status==='conflict')
  throw Error('Conflit de pointage conservé pour vérification : '+(saved.result?.message||'contactez votre responsable.'));
 if(saved.status==='pending')
  return {queued:true,review_status:'local'} as LocationCheckResult;
 if(saved.status!=='synced'||!saved.result)
  throw Error('Accusé serveur du pointage indisponible : vérifiez Mes heures avant de repointer.');
 return {...saved.result,queued:false,review_status:saved.result.review_status} as LocationCheckResult;
}
export const punchIn=(companyId:string,jobId:string)=>punchWithLocation(companyId,'in',jobId);
export const punchOut=(companyId:string)=>punchWithLocation(companyId,'out');
export const punchBreak=(companyId:string,resume:boolean,paid=false)=>punchWithLocation(companyId,resume?'break_end':'break_start',undefined,paid);
export const punchTransfer=(companyId:string,jobId:string)=>punchWithLocation(companyId,'transfer',jobId);
export async function archiveSegment(segmentId:string){
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw Error('Utilisateur non connecté');
 const {error}=await supabase.from('punch_archive_preferences').insert({user_id:user.id,segment_id:segmentId});
 if(error && error.code!=='23505')throw error;
}
export async function restoreSegment(segmentId:string){
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw Error('Utilisateur non connecté');
 const {error}=await supabase.from('punch_archive_preferences')
  .delete().eq('user_id',user.id).eq('segment_id',segmentId);
 if(error)throw error;
}
export async function loadArchives(){
 const user=await getLocalIdentity();
 const key='punch-archives:'+user.id;
 const network=await Network.getNetworkStateAsync();if(network.isConnected===false||network.isInternetReachable===false)return JSON.parse(await AsyncStorage.getItem(key)||'[]') as string[];
 const {data,error}=await supabase.from('punch_archive_preferences').select('segment_id').eq('user_id',user.id);
 if(error)return JSON.parse(await AsyncStorage.getItem(key)||'[]') as string[];
 const ids=(data||[]).map(row=>row.segment_id as string);await AsyncStorage.setItem(key,JSON.stringify(ids));return ids;
}
/** The mobile totals must match the web's CSV and Essential hours view:
 * unpaid overlapping breaks are merged and clipped to each job segment.
 * No projected event is treated as server-confirmed by this calculator.
 */
export function hoursFor(segments:PunchSegment[],nowMs:number,fromMs:number,toMs:number,breaks:PunchBreak[]=[]){
 if(!Array.isArray(segments)||!Number.isFinite(nowMs)||!Number.isFinite(fromMs)||!Number.isFinite(toMs))return 0;
 const until=Math.min(nowMs,toMs);
 const bySession=new Map<string,PunchBreak[]>();
 for(const pause of Array.isArray(breaks)?breaks:[]){
  if(typeof pause?.session_id!=='string')continue;
  const current=bySession.get(pause.session_id)||[];
  current.push(pause);bySession.set(pause.session_id,current);
 }
 return segments.reduce((total,segment)=>
  total+netSegmentMilliseconds(segment,bySession.get(segment.session_id)||[],fromMs,until),0);
}
