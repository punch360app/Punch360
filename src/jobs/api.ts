import * as Network from 'expo-network';
import {getLocalIdentity} from '../auth/localIdentity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '../lib/supabase';
import {Job} from './catalog';
export type JobLoad={jobs:Job[];demo:boolean;message:string};
export async function listMyCompanyJobs(companyId:string):Promise<JobLoad>{
 const identity=await getLocalIdentity();
 const key='punch-jobs:'+identity.id+':'+companyId;
 const network=await Network.getNetworkStateAsync();if(network.isConnected===false||network.isInternetReachable===false){const cached=await AsyncStorage.getItem(key);if(cached)return JSON.parse(cached);throw Error('Connecte cet appareil une première fois pour charger les chantiers');}
 const {data,error}=await supabase.from('jobs').select('id,company_id,number,name,address,latitude,longitude,photo_url,active').eq('company_id',companyId).eq('active',true).order('number');
 if(error){const cached=await AsyncStorage.getItem(key);if(cached)return JSON.parse(cached);throw error;}
 const user=identity;
 if(!user)throw Error('Session expirée');
 const {data:assignments,error:aError}=await supabase.from('job_assignments').select('job_id,planned_start').eq('company_id',companyId).eq('user_id',user.id).eq('active',true);
 if(aError){const cached=await AsyncStorage.getItem(key);if(cached)return JSON.parse(cached);throw aError;}
 const map=new Map<string,string|null>((assignments||[]).map(a=>[a.job_id,a.planned_start]));
 const shifts=await supabase.from('scheduled_shifts').select('job_id,starts_at').eq('company_id',companyId).eq('user_id',user.id).is('cancelled_at',null).gt('starts_at',new Date().toISOString()).order('starts_at');
 for(const shift of [...(shifts.data||[])].reverse())map.set(shift.job_id,shift.starts_at);
 const jobs:Job[]=(data||[]).map(j=>({
  id:j.id,company_id:j.company_id,number:j.number,name:j.name,address:j.address,
  latitude:j.latitude,longitude:j.longitude,photo_url:j.photo_url,
  assigned_to_me:map.has(j.id),planned_start:map.get(j.id)||null
 }));
 const result={jobs,demo:false,message:jobs.length===0?'Aucun chantier. Le boss peut ajouter la première job.':''};await AsyncStorage.setItem(key,JSON.stringify(result));return result;
}
export async function createJob(companyId:string,number:string,name:string,address:string){
 const {data,error}=await supabase.from('jobs')
 .insert({company_id:companyId,number:number.trim(),name:name.trim(),address:address.trim()})
 .select('id').single();
 if(error)throw error;
 return data.id as string;
}
