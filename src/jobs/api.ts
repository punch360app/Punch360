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
  offline=network.isConnected!==true||network.isInternetReachable!==true;
 }catch{/* Network probe failure: consult scoped offline cache. */}
 if(offline){const fallback=await cached();if(fallback)return fallback;
  throw Error('Chantiers hors ligne indisponibles : reconnectez cet appareil pour les charger');}
 // A request can throw before Supabase returns {error} when connectivity
 // drops after the network probe. Keep the last identity-scoped snapshot.
 let jobsResponse;
 try{
  jobsResponse=await supabase.from('jobs').select('id,company_id,number,name,address,latitude,longitude,photo_url,active').eq('company_id',companyId).eq('active',true).order('number');
 }catch(error){
  const fallback=await cached();if(fallback)return fallback;
  throw error;
 }
 const {data,error}=jobsResponse;
 if(error||!Array.isArray(data)){
  const fallback=await cached();if(fallback)return fallback;
  throw error||Error('Relevé chantiers incomplet : synchronisation non confirmée');
 }
 if(data.some(job=>job?.company_id!==companyId))
  throw Error('Réponse chantiers hors entreprise : affichage et cache bloqués');
 // A partial "successful" response must not erase verified jobs or
 // replace a worker's last usable offline catalogue.
 if(data.some(job=>typeof job.id!=='string'||!job.id||
  typeof job.number!=='string'||typeof job.name!=='string'||
  typeof job.address!=='string'||job.active!==true||
  (job.latitude!==null&&(!Number.isFinite(job.latitude)||Math.abs(job.latitude)>90))||
  (job.longitude!==null&&(!Number.isFinite(job.longitude)||Math.abs(job.longitude)>180))||
  (job.photo_url!==null&&typeof job.photo_url!=='string'))){
  const fallback=await cached();if(fallback)return fallback;
  throw Error('Données chantiers incomplètes : synchronisation non confirmée');
 }
 const user=identity;
 if(!user)throw Error('Session expirée');
 let assignmentResponse;
 try{
  assignmentResponse=await supabase.from('job_assignments').select('job_id,planned_start').eq('company_id',companyId).eq('user_id',user.id).eq('active',true);
 }catch(error){
  const fallback=await cached();if(fallback)return fallback;
  throw error;
 }
 const {data:assignments,error:aError}=assignmentResponse;
 if(aError||!Array.isArray(assignments)||assignments.some(a=>!a||
  typeof a.job_id!=='string'||!a.job_id||
  (a.planned_start!==null&&(typeof a.planned_start!=='string'||
   !Number.isFinite(Date.parse(a.planned_start)))))){
  const fallback=await cached();if(fallback)return fallback;
  throw aError||Error('Affectations incomplètes : synchronisation non confirmée');
 }
 const map=new Map<string,string|null>(assignments.map(a=>[a.job_id,a.planned_start]));
 let shifts;
 try{
  shifts=await supabase.from('scheduled_shifts').select('job_id,starts_at').eq('company_id',companyId).eq('user_id',user.id).is('cancelled_at',null).gt('starts_at',new Date().toISOString()).order('starts_at');
 }catch(error){
  const fallback=await cached();if(fallback)return fallback;
  throw error;
 }
 if(shifts.error||!Array.isArray(shifts.data)||shifts.data.some(shift=>!shift||
  typeof shift.job_id!=='string'||!shift.job_id||
  typeof shift.starts_at!=='string'||!Number.isFinite(Date.parse(shift.starts_at)))){
  const fallback=await cached();if(fallback)return fallback;
  throw shifts.error||Error('Horaires incomplets : synchronisation non confirmée');
 }
 for(const shift of [...shifts.data].reverse())map.set(shift.job_id,shift.starts_at);
 const jobs:Job[]=(data||[]).map(j=>({
  id:j.id,company_id:j.company_id,number:j.number,name:j.name,address:j.address,
  latitude:j.latitude,longitude:j.longitude,photo_url:j.photo_url,
  assigned_to_me:map.has(j.id),planned_start:map.get(j.id)||null
 }));
 const result:JobLoad={jobs,demo:false,message:jobs.length===0?'Aucun chantier. Le boss peut ajouter la première job.':'',readSource:'server'};
 // A full or read-only local cache must never hide freshly fetched server jobs.
 try{await AsyncStorage.setItem(key,JSON.stringify(result))}
 catch{result.message=[result.message,'Sauvegarde hors ligne indisponible sur cet appareil.'].filter(Boolean).join(' ');}
 return result;
}
/** One validated manager-created job; never queue job creation on an
 * uncertain connection, because retrying an unknown insert could duplicate it.
 */
export function validatedJobDraft(companyId:string,number:string,name:string,address:string){
 if(typeof companyId!=='string'||!companyId.trim())
  throw Error('Entreprise indisponible : aucun chantier créé.');
 if(typeof number!=='string'||!number.trim())
  throw Error('Numéro de chantier requis.');
 if(typeof name!=='string'||!name.trim())
  throw Error('Nom du chantier requis.');
 if(typeof address!=='string')
  throw Error('Adresse du chantier invalide.');
 return {company_id:companyId,number:number.trim(),name:name.trim(),address:address.trim()};
}
export async function createJob(companyId:string,number:string,name:string,address:string){
 const draft=validatedJobDraft(companyId,number,name,address);
 // An old UI instance may still carry another company's form after sign-out.
 const origin=await getLocalIdentity();
 if(!origin?.id)throw Error('Compte non confirmé : aucun chantier créé.');
 let online=false;
 try{const net=await Network.getNetworkStateAsync();
  online=net.isConnected===true&&net.isInternetReachable===true;
 }catch{/* An unknown connection must not submit a non-idempotent insert. */}
 if(!online)throw Error('Connexion Internet requise pour créer un chantier.');
 const verified=await supabase.auth.getUser();
 if(verified.error||verified.data?.user?.id!==origin.id)
  throw Error('Compte changé ou non vérifié : aucun chantier créé.');
 // A worker/company switch during network checks must not submit a stale form.
 const current=await getLocalIdentity();
 if(current?.id!==origin.id)
  throw Error('Compte changé pendant la création : aucun chantier envoyé.');
 const {data,error}=await supabase.from('jobs').insert(draft).select('id').single();
 if(error)throw error;
 if(typeof data?.id!=='string'||!data.id)
  throw Error('Réponse de création non confirmée. Vérifiez la liste des chantiers avant de réessayer, pour éviter un doublon.');
 return data.id;
}
