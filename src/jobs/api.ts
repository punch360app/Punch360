import {supabase} from '../lib/supabase';
import {Job} from './catalog';
export type JobLoad={jobs:Job[];demo:boolean;message:string};
export async function listMyCompanyJobs(companyId:string):Promise<JobLoad>{
 const {data,error}=await supabase.from('jobs').select('id,company_id,number,name,address,latitude,longitude,photo_url,active').eq('company_id',companyId).eq('active',true).order('number');
 if(error)throw error;
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw Error('Session expirée');
 const {data:assignments,error:aError}=await supabase.from('job_assignments').select('job_id,planned_start').eq('company_id',companyId).eq('user_id',user.id).eq('active',true);
 if(aError)throw aError;
 const map=new Map((assignments||[]).map(a=>[a.job_id,a.planned_start]));
 const jobs:Job[]=(data||[]).map(j=>({
  id:j.id,company_id:j.company_id,number:j.number,name:j.name,address:j.address,
  latitude:j.latitude,longitude:j.longitude,photo_url:j.photo_url,
  assigned_to_me:map.has(j.id),planned_start:map.get(j.id)||null
 }));
 return {jobs,demo:false,message:jobs.length===0?'Aucun chantier. Le boss peut ajouter la première job.':''};
}
export async function createJob(companyId:string,number:string,name:string,address:string){
 const {data,error}=await supabase.from('jobs')
 .insert({company_id:companyId,number:number.trim(),name:name.trim(),address:address.trim()})
 .select('id').single();
 if(error)throw error;
 return data.id as string;
}
