import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import {createInvitationMailWebhook} from './handler.mjs';
const sb=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
const rpc=async(name:string,args:Record<string,unknown>)=>{const r=await sb.rpc(name,args);if(r.error)throw Error('InvitationMailEventFailed');return r.data};
Deno.serve(createInvitationMailWebhook({rpc,secret:Deno.env.get('RESEND_WEBHOOK_SECRET')}));
