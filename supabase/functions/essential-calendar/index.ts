import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {buildSubscribedCalendar} from './ical.mjs';

const headers={
 'Cache-Control':'private, max-age=120',
 'Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff'
};
const fail=(status:number)=>new Response(status===404?'Calendar not found':'Calendar unavailable',
 {status,headers:{...headers,'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});
// Calendar subscription clients do not have JWTs. Authorization is the revocable,
// unguessable 256-bit secret URL; DB holds SHA256 only and checks membership on every read.
Deno.serve(async(req:Request)=>{
 if(req.method!=='GET')return fail(405);
 let token;
 try{token=new URL(req.url).searchParams.get('token');}catch{return fail(404);}
 if(!token||!(/^[0-9a-f]{64}$/.test(token)))return fail(404);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return fail(503);
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc('personal_calendar_feed_read',{p_token:token});
  if(error)return fail(503);
  if(!data)return fail(404);
  const result=buildSubscribedCalendar({
   companyId:data.company_id,workerId:data.worker_id,
   shifts:data.shifts||[],locations:data.locations||[]
  });
  return new Response(result.content,{status:200,headers:{
   ...headers,'Content-Type':'text/calendar; charset=utf-8',
   'Content-Disposition':'inline; filename="PUNCH-Horaire.ics"'
  }});
 }catch{return fail(503);}
});
