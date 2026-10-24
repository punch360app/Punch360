import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {verifyTwilioSignature} from '../_shared/twilio.mjs';
Deno.serve(async(req:Request)=>{
 const reply=(status:number)=>new Response(null,{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply(405);
 const token=Deno.env.get('TWILIO_AUTH_TOKEN'),account=Deno.env.get('TWILIO_ACCOUNT_SID'),url=Deno.env.get('SUPABASE_URL');
 if(!token||!account||!url)return reply(503);
 if(!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return reply(415);
 if(Number(req.headers.get('content-length'))>16384)return reply(413);
 const body=await req.text();if(body.length>16384)return reply(413);const form=new URLSearchParams(body);
 if(form.getAll('AccountSid').length!==1||form.getAll('MessageSid').length!==1||form.getAll('MessageStatus').length!==1)return reply(400);
 if(!await verifyTwilioSignature({authToken:token,publicUrl:`${url}/functions/v1/essential-sms-status`,form,signature:req.headers.get('x-twilio-signature')}))return reply(403);
 if(form.get('AccountSid')!==account)return reply(403);
 const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const result=await admin.rpc('worker_invitation_sms_callback',{p_message:form.get('MessageSid'),p_status:form.get('MessageStatus')});
 return reply(result.error?503:204);
});
