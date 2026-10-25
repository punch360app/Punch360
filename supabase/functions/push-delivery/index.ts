import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import {createPushDeliveryHandler} from './handler.mjs';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const sb=createClient(Deno.env.get('SUPABASE_URL')||'',key,{auth:{persistSession:false,autoRefreshToken:false}});
const rpc=async(name:string,args:Record<string,unknown>)=>{const r=await sb.rpc(name,args);if(r.error)throw Error('PushRPCFailed');return r.data};
Deno.serve(createPushDeliveryHandler({rpc,serviceKey:key,enabled:Deno.env.get('PUNCH_PUSH_ENABLED')==='true',expoAccessToken:Deno.env.get('EXPO_ACCESS_TOKEN')}));
