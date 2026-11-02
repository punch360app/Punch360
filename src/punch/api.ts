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
export type PunchSegment={id:string;session_id:string;company_id:string;job_id:string;started_at:string;ended_at:string|null};
export type PunchBreak={id:string;session_id:string;started_at:string;ended_at:string|null;is_paid?:boolean;company_id?:string;user_id?:string};
export type PunchState={sessions:PunchSession[];segments:PunchSegment[];breaks?:PunchBreak[];active:PunchSession|null;lastJobId:string|null;localJournalBlocked?:boolean;readSource?:'server'|'cache';hasLocalProjection?:boolean;cacheWriteFailed?:boolean};
export async function loadPunchState(companyId:string):Promise<PunchState>{
 const user=await getLocalIdentity();
 const journal=await getPunchJournal(companyId);
 // A blocked local queue must not prevent official hours from loading.
 let journalBlocked=false;
 try{await journal.flush()}catch{journalBlocked=true}
 const cacheKey='punch-state:'+user.id+':'+companyId;
 const overlay=async(state:PunchState,readSource:'server'|'cache',cacheWriteFailed=false)=>{
  // Prevent cross-company hours from legacy mixed offline snapshots.
  const ownSessions=(state.sessions||[]).filter(s=>s.company_id===companyId&&s.user_id===user.id);
  const ids=new Set(ownSessions.map(s=>s.id));
  const ownSegments=(state.segments||[]).filter(s=>s.company_id===companyId&&ids.has(s.session_id));
  const ownBreaks=(state.breaks||[]).filter(b=>ids.has(b.session_id)&&
   (b.company_id==null||b.company_id===companyId)&&
   (b.user_id==null||b.user_id===user.id));
  const own={...state,sessions:ownSessions,segments:ownSegments,breaks:ownBreaks};
  let events:LocalPunchEvent[]=[];
  if(!journalBlocked)try{events=await journal.read()}catch{journalBlocked=true}
  return {...projectPendingPunches(own,journalBlocked?[]:events,{company:companyId,user:user.id}),
   localJournalBlocked:journalBlocked,readSource,cacheWriteFailed,
   hasLocalProjection:!journalBlocked&&events.some(e=>e.status==='pending'&&e.company===companyId&&e.user===user.id)} as PunchState;
 };
 // If Expo cannot read network state, retain access to the last locally
 // saved, identity-scoped snapshot instead of hiding the worker's hours.
 let networkAvailable=false;
 try{
  const network=await Network.getNetworkStateAsync();
  networkAvailable=network.isConnected!==false&&network.isInternetReachable!==false;
 }catch{/* The cached snapshot is the safe fallback on network-state failure. */}
 if(!networkAvailable){const cached=await AsyncStorage.getItem(cacheKey);return overlay(cached?JSON.parse(cached):{sessions:[],segments:[],active:null,lastJobId:null},'cache');}
 const {data:sessions,error}=await supabase.from('punch_sessions')
  .select('id,company_id,user_id,started_at,ended_at')
  .eq('company_id',companyId).eq('user_id',user.id)
  .order('started_at',{ascending:false}).limit(500);
 if(error){const cached=await AsyncStorage.getItem(cacheKey);if(cached)return overlay(JSON.parse(cached),'cache');throw error;}
 const list=sessions as PunchSession[]||[];
 if(!list.length){const empty={sessions:[],segments:[],active:null,lastJobId:null};let cacheWriteFailed=false;try{await AsyncStorage.setItem(cacheKey,JSON.stringify(empty))}catch{cacheWriteFailed=true}return overlay(empty,'server',cacheWriteFailed);}
 const {data:segments,error:segmentsError}=await supabase.from('punch_segments')
  .select('id,company_id,session_id,job_id,started_at,ended_at')
  .eq('company_id',companyId).in('session_id',list.map(s=>s.id))
  .order('started_at',{ascending:false});
 if(segmentsError){const cached=await AsyncStorage.getItem(cacheKey);if(cached)return overlay(JSON.parse(cached),'cache');throw segmentsError;}
 const sorted=(segments||[]) as PunchSegment[];
 const breakResult=await supabase.from('punch_breaks').select('id,session_id,started_at,ended_at,is_paid').eq('company_id',companyId).eq('user_id',user.id);if(breakResult.error){const cached=await AsyncStorage.getItem(cacheKey);if(cached)return overlay(JSON.parse(cached),'cache');throw breakResult.error;}
 const snapshot={breaks:breakResult.data||[],sessions:list,segments:sorted,active:list.find(s=>s.ended_at===null)||null,lastJobId:sorted[0]?.job_id||null};let cacheWriteFailed=false;try{await AsyncStorage.setItem(cacheKey,JSON.stringify(snapshot))}catch{cacheWriteFailed=true}return overlay(snapshot,'server',cacheWriteFailed);
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
