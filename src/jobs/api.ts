import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';
import {DEMO_JOBS, Job} from './catalog';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const configured=!!url&&!!key;
export const supabase=configured ? createClient(url!,key!,{auth:{detectSessionInUrl:false,persistSession:false}}) : null;
export type JobLoad={jobs:Job[];demo:boolean;message:string};
// Démo explicite si PUNCH Supabase n'est pas lié. Jamais de requête vers les autres projets.
export async function listMyCompanyJobs():Promise<JobLoad>{
  if(!supabase)return {jobs:DEMO_JOBS,demo:true,message:'Démonstration — PUNCH Supabase non connecté'};
  const {data:userInfo,error:authError}=await supabase.auth.getUser();
  if(authError||!userInfo.user)return {jobs:DEMO_JOBS,demo:true,message:'Démonstration — connectez un compte PUNCH avant de charger les jobs'};
  const {data:memberships,error:mError}=await supabase.from('company_members').select('company_id').eq('user_id',userInfo.user.id).eq('status','active').limit(1);
  if(mError)throw mError;
  const companyId=memberships?.[0]?.company_id;
  if(!companyId)return {jobs:[],demo:false,message:'Aucune compagnie associée'};
  const {data,error}=await supabase.from('jobs').select('id,company_id,number,name,address,latitude,longitude,photo_url').eq('company_id',companyId).eq('active',true).order('number');
  if(error)throw error;
  const {data:assignments,error:aError}=await supabase.from('job_assignments').select('job_id').eq('company_id',companyId).eq('user_id',userInfo.user.id).eq('active',true);
  if(aError)throw aError;
  const mine=new Set((assignments||[]).map(a=>a.job_id));
  return {jobs:(data||[]).map(j=>({...j,assigned_to_me:mine.has(j.id),plan_count:0,open_order_count:0})),demo:false,message:''};
}
