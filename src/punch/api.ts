import {supabase} from '../lib/supabase';
export type PunchSession={id:string;company_id:string;user_id:string;started_at:string;ended_at:string|null};
export type PunchSegment={id:string;session_id:string;company_id:string;job_id:string;started_at:string;ended_at:string|null};
export type PunchState={sessions:PunchSession[];segments:PunchSegment[];active:PunchSession|null;lastJobId:string|null};
export async function loadPunchState(companyId:string):Promise<PunchState>{
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw Error('Utilisateur non connecté');
 const {data:sessions,error}=await supabase.from('punch_sessions')
  .select('id,company_id,user_id,started_at,ended_at')
  .eq('company_id',companyId).eq('user_id',user.id)
  .order('started_at',{ascending:false}).limit(500);
 if(error)throw error;
 const list=sessions as PunchSession[]||[];
 if(!list.length)return {sessions:[],segments:[],active:null,lastJobId:null};
 const {data:segments,error:segmentsError}=await supabase.from('punch_segments')
  .select('id,company_id,session_id,job_id,started_at,ended_at')
  .eq('company_id',companyId).in('session_id',list.map(s=>s.id))
  .order('started_at',{ascending:false});
 if(segmentsError)throw segmentsError;
 const sorted=(segments||[]) as PunchSegment[];
 return {sessions:list,segments:sorted,active:list.find(s=>s.ended_at===null)||null,lastJobId:sorted[0]?.job_id||null};
}
export async function punchIn(companyId:string,jobId:string){
 const {error}=await supabase.rpc('punch_in',{p_company:companyId,p_job:jobId});
 if(error)throw error;
}
export async function punchOut(companyId:string){
 const {error}=await supabase.rpc('punch_out',{p_company:companyId});
 if(error)throw error;
}
export async function punchTransfer(companyId:string,jobId:string){
 const {error}=await supabase.rpc('punch_transfer',{p_company:companyId,p_job:jobId});
 if(error)throw error;
}
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
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return [];
 const {data,error}=await supabase.from('punch_archive_preferences').select('segment_id').eq('user_id',user.id);
 if(error)throw error;
 return (data||[]).map(row=>row.segment_id as string);
}
export function hoursFor(segments:PunchSegment[],nowMs:number,fromMs:number,toMs:number){
 return segments.reduce((acc,s)=>{
  const begin=Math.max(Date.parse(s.started_at),fromMs);
  const finish=Math.min(s.ended_at?Date.parse(s.ended_at):nowMs,toMs);
  return acc+Math.max(0,finish-begin);
 },0);
}
