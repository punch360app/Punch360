import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { validCleanupItem,cleanupSummary } from './cleanup.mjs';

// pg_cron bearer is a 256-bit secret kept in Vault. This endpoint cannot use
// gateway JWT verification; it validates the bearer with a service-role-only RPC
// before any read or deletion. Caller supplies no company, path or cleanup limit.
const BUCKET='mission-photo-evidence';
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
function reply(status:number,body:Record<string,unknown>){
 return new Response(JSON.stringify(body),{status,headers});
}
Deno.serve(async request=>{
 if(request.method!=='POST')return reply(405,{error:'Méthode refusée'});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key||!url.startsWith('https://mlabstdxxwjdpfaxiwmg.supabase.co'))
  return reply(503,{error:'Maintenance non configurée'});
 const match=/^Bearer ([0-9a-f]{64})$/i.exec(request.headers.get('authorization')||'');
 if(!match)return reply(403,{error:'Accès refusé'});
 const service=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const auth=await service.rpc('mission_photo_retention_authorized',{p_token:match[1]});
 if(auth.error||auth.data!==true)return reply(403,{error:'Accès refusé'});
 const summary=cleanupSummary();
 try{
  for(let batch=0;batch<4;batch++){
   const claim=await service.rpc('claim_expired_mission_photos',{p_limit:25});
   if(claim.error||!Array.isArray(claim.data))return reply(503,{error:'Nettoyage indisponible',...summary});
   if(!claim.data.length)break;
   for(const item of claim.data){
    summary.claimed++;
    let removed=false;
    if(validCleanupItem(item)){
     try{
      const result=await service.storage.from(BUCKET).remove([item.path]);
      removed=!result.error;
     }catch{removed=false;}
    }else summary.invalid++;
    try{
     const done=await service.rpc('finish_expired_mission_photo',
      {p_photo:item.id,p_claim:item.claim,p_deleted:removed});
     if(removed&&!done.error&&done.data===true)summary.deleted++;
     else summary.failed++;
    }catch{summary.failed++;}
   }
   if(claim.data.length<25)break;
  }
  return reply(summary.failed?207:200,summary);
 }catch{return reply(503,{error:'Nettoyage interrompu',...summary});}
});
