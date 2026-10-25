import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import {createInvitationEmailHandler} from './handler.mjs';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const sb=createClient(Deno.env.get('SUPABASE_URL')||'',key,{auth:{persistSession:false,autoRefreshToken:false}});
const rpc=async(name:string,args:Record<string,unknown>)=>{const r=await sb.rpc(name,args);if(r.error)throw Error('InvitationMailRPCFailed');return r.data};
Deno.serve(createInvitationEmailHandler({rpc,serviceKey:key,enabled:Deno.env.get('PUNCH_INVITATION_EMAIL_ENABLED')==='true',apiKey:Deno.env.get('RESEND_API_KEY'),from:Deno.env.get('PUNCH_MAIL_FROM')}));
