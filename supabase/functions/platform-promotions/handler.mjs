import {stripeClient} from '../_shared/stripe.mjs';
import {synchronisePromotion} from './provider.mjs';
const origin='https://punch360app.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store, private'};
export function createPromotionHandler({env,fetch:request=globalThis.fetch}){
 return async req=>{
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return reply(403,{error:'ORIGIN_DENIED'});
  const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
  if(url!=='https://mlabstdxxwjdpfaxiwmg.supabase.co'||!anon||!service)return reply(503,{error:'SERVER_NOT_CONFIGURED'});
  const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))return reply(401,{error:'AUTH_REQUIRED'});
  const userHeaders={apikey:anon,Authorization:authorization,'Content-Type':'application/json'},serviceHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  const rpc=async(name,body,privileged=false)=>{const r=await request(url+'/rest/v1/rpc/'+name,{method:'POST',headers:privileged?serviceHeaders:userHeaders,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error('SERVER_OPERATION_REFUSED');return d};
  let actor,body,started=false;
  try{
   const r=await request(url+'/auth/v1/user',{headers:userHeaders,signal:AbortSignal.timeout(15000)});if(!r.ok)return reply(401,{error:'AUTH_REQUIRED'});actor=(await r.json()).id;
   try{await rpc('platform_commercial_access',{})}catch{return reply(403,{error:'LIVE_PLATFORM_MFA_REQUIRED'})}
   const raw=await req.text();if(raw.length>4096)return reply(413,{error:'REQUEST_TOO_LARGE'});body=JSON.parse(raw);
   const secret=env('STRIPE_SECRET_KEY'),enabled=env('PUNCH_STRIPE_ENABLED')==='true',configured=!!secret&&/^sk_(test|live)_/.test(secret)&&enabled,mode=secret?.startsWith('sk_live_')?'live':'test';
   if(body?.action==='status')return reply(200,{configured,mode});if(!configured)return reply(503,{error:'STRIPE_NOT_CONFIGURED'});
   if(!['publish','disable','refresh'].includes(body?.action)||typeof body.id!=='string'||!(/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.id))||!Number.isSafeInteger(body.version)||typeof body.reason!=='string'||body.reason.trim().length<3)return reply(400,{error:'INVALID_REQUEST'});
   // Check provider mode before reserving a network operation; a wrong key must leave the draft untouched.
   const required=await rpc('platform_begin_promotion',{p_id:body.id,p_action:body.action,p_expected_version:body.version,p_reason:body.reason,p_mode:mode});if(required===false)return reply(200,{ok:true,provider_confirmed:true,already_confirmed:true});started=true;
   const ctx=await rpc('platform_promotion_context',{p_actor:actor,p_id:body.id,p_action:body.action},true);
   const provider=await synchronisePromotion(ctx,body.action,stripeClient(secret,request),mode);
   await rpc('platform_complete_promotion',{p_actor:actor,p_id:body.id,p_action:body.action,p_provider:provider},true);
   return reply(200,{ok:true,provider_confirmed:true});
  }catch(err){const message=err instanceof Error?err.message:'PROMOTION_ERROR';
   if(started&&/^STRIPE_4\d{2}_[A-Za-z0-9_]+$/.test(message)&&!/^STRIPE_(408|409|429)_/.test(message)){try{await rpc('platform_complete_promotion',{p_actor:actor,p_id:body.id,p_action:body.action,p_error:message},true)}catch{}}
   return reply(400,{error:/^[A-Z][A-Z0-9_]{1,159}$/.test(message)?message:'PROMOTION_RETRY_REQUIRED'});
  }
 };
}
