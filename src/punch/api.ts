import * as Network from 'expo-network';
import {getLocalIdentity} from '../auth/localIdentity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getPunchJournal} from './journal';
import {projectPendingPunches} from '../../web/live/journal.js';
import {netSegmentMilliseconds} from '../../web/live/essential-hours-export.js';
import * as Location from 'expo-location';
import {supabase} from '../lib/supabase';
export type PunchSession={id:string;company_id:string;user_id:string|null;worker_id?:string|null;started_at:string;ended_at:string|null};
export type PunchSegment={id:string;session_id:string;company_id:string;job_id:string;started_at:string;ended_at:string|null};
export type PunchBreak={id:string;session_id:string;started_at:string;ended_at:string|null;is_paid?:boolean};
export type PunchState={sessions:PunchSession[];segments:PunchSegment[];breaks?:PunchBreak[];active:PunchSession|null;lastJobId:string|null};
export async function loadPunchState(companyId:string):Promise<PunchState>{
 const user=await getLocalIdentity();
 const journal=await getPunchJournal(companyId);await journal.flush();
 const cacheKey='punch-state:'+user.id+':'+companyId;
 const overlay=async(state:PunchState)=>projectPendingPunches(state,await journal.read(),{company:companyId,user:user.id}) as PunchState;
 const network=await Network.getNetworkStateAsync();if(network.isConnected===false||network.isInternetReachable===false){const cached=await AsyncStorage.getItem(cacheKey);return overlay(cached?JSON.parse(cached):{sessions:[],segments:[],active:null,lastJobId:null});}
 const {data:sessions,error}=await supabase.from('punch_sessions')
  .select('id,company_id,user_id,started_at,ended_at')
  .eq('company_id',companyId).eq('user_id',user.id)
  .order('started_at',{ascending:false}).limit(500);
 if(error){const cached=await AsyncStorage.getItem(cacheKey);if(cached)return overlay(JSON.parse(cached));throw error;}
 const list=sessions as PunchSession[]||[];
 if(!list.length){const empty={sessions:[],segments:[],active:null,lastJobId:null};await AsyncStorage.setItem(cacheKey,JSON.stringify(empty));return overlay(empty);}
 const {data:segments,error:segmentsError}=await supabase.from('punch_segments')
  .select('id,company_id,session_id,job_id,started_at,ended_at')
  .eq('company_id',companyId).in('session_id',list.map(s=>s.id))
  .order('started_at',{ascending:false});
 if(segmentsError){const cached=await AsyncStorage.getItem(cacheKey);if(cached)return overlay(JSON.parse(cached));throw segmentsError;}
 const sorted=(segments||[]) as PunchSegment[];
 const breakResult=await supabase.from('punch_breaks').select('id,session_id,started_at,ended_at,is_paid').eq('company_id',companyId).eq('user_id',user.id);if(breakResult.error)throw breakResult.error;
 const snapshot={breaks:breakResult.data||[],sessions:list,segments:sorted,active:list.find(s=>s.ended_at===null)||null,lastJobId:sorted[0]?.job_id||null};await AsyncStorage.setItem(cacheKey,JSON.stringify(snapshot));return overlay(snapshot);
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
 const sync=await journal.flush();const saved=sync.events.find(e=>e.id===event.id);
 if(saved?.status==='conflict')throw Error('Punch conservé sur le serveur, conflit transmis à l’administration : '+saved.result?.message);
 return {...saved?.result,queued:saved?.status==='pending',review_status:saved?.status==='pending'?'local':saved?.result?.review_status} as LocationCheckResult;
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
