import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const origin='https://punch360app.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type, apikey','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
// No general Auth session: pairing code or limited device token + personal PIN are required.
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{ok:false,error:'METHOD_DENIED'});
 if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return reply(403,{ok:false,error:'ORIGIN_DENIED'});
 try{
  if(Number(req.headers.get('content-length'))>4096)return reply(413,{ok:false});const raw=await req.text();if(raw.length>4096)return reply(413,{ok:false});const p=JSON.parse(raw);
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  let result;
  if(p.action==='pair'){
   if(typeof p.code!=='string'||p.code.length!==101)return reply(400,{ok:false});
   result=await client.rpc('kiosk_pair_device',{p_code:p.code});
  }else{
   if(typeof p.deviceId!=='string'||!/^[0-9a-f-]{36}$/i.test(p.deviceId)||typeof p.token!=='string'||!/^[0-9a-f]{64}$/i.test(p.token)||typeof p.number!=='string'||p.number.length>40||typeof p.pin!=='string'||!/^\d{6,12}$/.test(p.pin)||!['identify','enroll','in','out','break_start','break_end'].includes(p.action))return reply(400,{ok:false,error:'INVALID_REQUEST'});
   if(p.eventId!=null&&(typeof p.eventId!=='string'||!/^[0-9a-f-]{36}$/i.test(p.eventId)))return reply(400,{ok:false});
   result=await client.rpc('kiosk_execute',{p_device:p.deviceId,p_token:p.token,p_number:p.number,p_pin:p.pin,p_action:p.action,p_event:p.eventId||null,p_enrollment:p.enrollment||null});
  }
  if(result.error)return reply(409,{ok:false,error:'OPERATION_REFUSED'});
  return reply(result.data?.ok?200:403,result.data);
 }catch{return reply(400,{ok:false,error:'INVALID_REQUEST'});}
});
