import * as Network from 'expo-network';
import {getLocalIdentity} from '../auth/localIdentity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '../lib/supabase';
import {Job} from './catalog';
export type JobLoad={jobs:Job[];demo:boolean;message:string;readSource?:'cache'|'server'};
// Cached jobs are advisory, but must never reveal an old or foreign tenant's job.
// Reject a mixed legacy cache as a whole and preserve its bytes for recovery.
export function scopedJobCache(value:unknown,companyId:string):JobLoad|null{
 if(!value||typeof value!=='object')return null;
 const snapshot=value as Partial<JobLoad>;
 if(snapshot.demo!==false||!Array.isArray(snapshot.jobs))return null;
 if(snapshot.jobs.some(job=>!job||typeof job.id!=='string'||!job.id||
  job.company_id!==companyId||typeof job.number!=='string'||
  typeof job.name!=='string'||typeof job.address!=='string'||
  (job.latitude!==null&&(!Number.isFinite(job.latitude)||Math.abs(job.latitude)>90))||
  (job.longitude!==null&&(!Number.isFinite(job.longitude)||Math.abs(job.longitude)>180))||
  (job.photo_url!==null&&typeof job.photo_url!=='string')))return null;
 return {jobs:snapshot.jobs,demo:false,message:typeof snapshot.message==='string'?snapshot.message:'',readSource:'cache'};
}
export async function listMyCompanyJobs(companyId:string):Promise<JobLoad>{
 const identity=await getLocalIdentity();
 if(!identity?.id||!companyId)throw Error('Identité ou entreprise indisponible');
 const key='punch-jobs:'+identity.id+':'+companyId;
 const cached=async()=>{
  try{const raw=await AsyncStorage.getItem(key);
   return raw?scopedJobCache(JSON.parse(raw),companyId):null;
  }catch{return null}
 };
 let offline=true;
 try{const network=await Network.getNetworkStateAsync();
  offline=network.isConnected===false||network.isInternetReachable===false;
 }catch{/* Network probe failure: consult scoped offline cache. */}
 if(offline){const fallback=await cached();if(fallback)return fallback;
  throw Error('Chantiers hors ligne indisponibles : reconnectez cet appareil pour les charger');}
 const {data,error}=await supabase.from('jobs').select('id,company_id,number,name,address,latitude,longitude,photo_url,active').eq('company_id',companyId).eq('active',true).order('number');
 if(error){const fallback=await cached();if(fallback)return fallback;throw error;}
 if((data||[]).some(job=>job.company_id!==companyId))
  throw Error('Réponse chantiers hors entreprise : affichage et cache bloqués');
 const user=identity;
 if(!user)throw Error('Session expirée');
 const {data:assignments,error:aError}=await supabase.from('job_assignments').select('job_id,planned_start').eq('company_id',companyId).eq('user_id',user.id).eq('active',true);
 if(aError){const fallback=await cached();if(fallback)return fallback;throw aError;}
 const map=new Map<string,string|null>((assignments||[]).map(a=>[a.job_id,a.planned_start]));
 const shifts=await supabase.from('scheduled_shifts').select('job_id,starts_at').eq('company_id',companyId).eq('user_id',user.id).is('cancelled_at',null).gt('starts_at',new Date().toISOString()).order('starts_at');
 for(const shift of [...(shifts.data||[])].reverse())map.set(shift.job_id,shift.starts_at);
 const jobs:Job[]=(data||[]).map(j=>({
  id:j.id,company_id:j.company_id,number:j.number,name:j.name,address:j.address,
  latitude:j.latitude,longitude:j.longitude,photo_url:j.photo_url,
  assigned_to_me:map.has(j.id),planned_start:map.get(j.id)||null
 }));
 const result:JobLoad={jobs,demo:false,message:jobs.length===0?'Aucun chantier. Le boss peut ajouter la première job.':'',readSource:'server'};await AsyncStorage.setItem(key,JSON.stringify(result));return result;
}
export async function createJob(companyId:string,number:string,name:string,address:string){
 const {data,error}=await supabase.from('jobs')
 .insert({company_id:companyId,number:number.trim(),name:name.trim(),address:address.trim()})
 .select('id').single();
 if(error)throw error;
 return data.id as string;
}
