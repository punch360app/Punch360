import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {invitationMessage,sendTwilioSms} from '../_shared/twilio.mjs';
const origin='https://punch360app.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const json=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
 if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return json(403,{error:'ORIGIN_DENIED'});
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const authorization=req.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return json(401,{error:'AUTH_REQUIRED'});
 const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const auth=await userClient.auth.getUser();if(auth.error||!auth.data.user)return json(401,{error:'AUTH_REQUIRED'});
 try{
  if(Number(req.headers.get('content-length'))>4096)return json(413,{error:'REQUEST_TOO_LARGE'});
  const raw=await req.text();if(raw.length>4096)return json(413,{error:'REQUEST_TOO_LARGE'});const body=JSON.parse(raw);
  if(typeof body.workerId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.workerId))return json(400,{error:'WORKER_REQUIRED'});
  const created=await userClient.rpc('create_worker_invitation',{p_worker:body.workerId});if(created.error)return json(403,{error:created.error.message});
  const invitation=created.data,activationUrl=`${origin}/Punch360/?workerInvite=${encodeURIComponent(invitation.token)}`;
  const base={invitationId:invitation.id,activationUrl,expiresInHours:invitation.expires_in_hours};
  // Explicit server switch: adding credentials never silently enables real sending.
  const accountSid=Deno.env.get('TWILIO_ACCOUNT_SID'),authToken=Deno.env.get('TWILIO_AUTH_TOKEN'),messagingServiceSid=Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  if(Deno.env.get('PUNCH_SMS_ENABLED')!=='true'||!accountSid||!authToken||!messagingServiceSid)return json(200,{...base,smsStatus:'not_configured'});
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const claim=await admin.rpc('worker_invitation_sms_claim',{p_actor:auth.data.user.id,p_invitation:invitation.id});
  if(claim.error)return json(200,{...base,smsStatus:'not_authorized'});
  let status='unknown',sid:string|null=null;
  try{
   const result=await sendTwilioSms({enabled:true,environment:'production',accountSid,authToken,messagingServiceSid,statusCallbackUrl:`${url}/functions/v1/essential-sms-status`},
    {to:claim.data.to,body:invitationMessage({firstName:claim.data.first_name,companyName:claim.data.company_name,activationUrl,allowedOrigin:origin}),consent:true,testCompany:false});
   status=result.status;sid=result.providerMessageId;
  }catch(err){status=(err as {outcome?:string}).outcome||'failed';}
  const saved=await admin.rpc('worker_invitation_sms_result',{p_invitation:invitation.id,p_status:status,p_message:sid});
  return json(200,{...base,smsStatus:saved.error?'unknown':status});
 }catch{return json(400,{error:'INVALID_REQUEST'});}
});
