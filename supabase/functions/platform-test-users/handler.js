const headers={'Access-Control-Allow-Origin':'https://punch360app.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff'};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function createPlatformTestHandler({env,fetch:request=globalThis.fetch,randomUUID=()=>crypto.randomUUID()}){
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 return async req=>{
  if(req.method==='OPTIONS')return new Response('',{headers});if(req.method!=='POST')return reply({error:'Méthode refusée'},405);
  const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
  if(url!=='https://mlabstdxxwjdpfaxiwmg.supabase.co'||!anon||!service)return reply({error:'Configuration serveur indisponible'},503);
  const authorization=req.headers.get('Authorization')||'';if(!authorization.startsWith('Bearer '))return reply({error:'Authentification requise'},401);
  const userHeaders={apikey:anon,Authorization:authorization,'Content-Type':'application/json'},serviceHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  const call=(path,init={})=>request(url+path,{...init,signal:AbortSignal.timeout(15000)});
  const rpc=async(name,body,asService=false)=>{const response=await call('/rest/v1/rpc/'+name,{method:'POST',headers:asService?serviceHeaders:userHeaders,body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(typeof data.message==='string'?data.message:'Opération refusée');return data};
  try{
   const identity=await call('/auth/v1/user',{headers:userHeaders});if(!identity.ok)return reply({error:'Session invalide'},401);const user=await identity.json();
   try{await rpc('platform_test_access',{});}catch{return reply({error:'Super Admin et session MFA active requis'},403);}
   const raw=await req.text();if(raw.length>4096)return reply({error:'Requête trop volumineuse'},413);let body;try{body=JSON.parse(raw)}catch{return reply({error:'Requête invalide'},400)}if(!body||typeof body!=='object')return reply({error:'Requête invalide'},400);
   if(body.action==='create'){
    if(!uuid(body.company_id)||!['employee','lead','admin','boss'].includes(body.role))return reply({error:'Compagnie et rôle requis'},400);
    const email='test-'+randomUUID()+'@punch360.test.invalid',password=randomUUID()+'Aa9!';
    const created=await call('/auth/v1/admin/users',{method:'POST',headers:serviceHeaders,body:JSON.stringify({email,password,email_confirm:true})});if(!created.ok)return reply({error:'Création Auth impossible'},502);const account=await created.json();
    try{await rpc('platform_register_test_user',{p_actor:user.id,p_user:account.id,p_company:body.company_id,p_role:body.role},true);}catch{await call('/auth/v1/admin/users/'+account.id,{method:'DELETE',headers:serviceHeaders});return reply({error:'Compagnie test isolée avec des places disponibles requise'},400);}
    try{await rpc('platform_record_test_password',{p_actor:user.id,p_user:account.id,p_password:password},true);}catch{return reply({error:'Compte créé. Coffre indisponible : actualiser la liste puis réinitialiser son mot de passe.',user_id:account.id},502);}
    return reply({user_id:account.id,email,password,notice:'Compte test. Mot de passe chiffré, consultable par Super Admin avec MFA.'});
   }
   if(!uuid(body.user_id))return reply({error:'Compte test requis'},400);
   if(body.action==='reveal')return reply(await rpc('platform_reveal_test_password',{p_user:body.user_id,p_reason:body.reason}));
   if(body.action==='status'){
    if(typeof body.active!=='boolean')return reply({error:'Statut requis'},400);
    await rpc('platform_test_account_status',{p_actor:user.id,p_user:body.user_id,p_active:body.active},true);
    const ban=await call('/auth/v1/admin/users/'+body.user_id,{method:'PUT',headers:serviceHeaders,body:JSON.stringify({ban_duration:body.active?'none':'876000h'})});if(!ban.ok)return reply({error:'Droits de compagnie mis à jour; verrouillage Auth à réessayer.'},502);return reply({ok:true});
   }
   if(!['reset_password','delete'].includes(body.action))return reply({error:'Action inconnue'},400);
   const operation=await rpc('platform_begin_test_action',{p_user:body.user_id,p_action:body.action,p_reason:body.reason,p_confirmation:body.confirmation||''});
   const payload=await rpc('platform_test_action_payload',{p_actor:user.id,p_operation:operation},true);
   // Target and action come from the checked operation rather than client input.
   const deleting=payload.kind==='delete';
   const current=await call('/auth/v1/admin/users/'+payload.user_id,{headers:serviceHeaders});if(!current.ok)return reply({error:'Compte Auth indisponible; réessayer la même action.'},502);const target=await current.json();
   if(!deleting||!target.deleted_at){const updated=await call('/auth/v1/admin/users/'+payload.user_id,{method:deleting?'DELETE':'PUT',headers:serviceHeaders,body:JSON.stringify(deleting?{should_soft_delete:true}:{password:payload.password})});if(!updated.ok)return reply({error:'Opération Auth non confirmée. Réessayer la même action.',operation_id:operation},502);}
   await rpc('platform_complete_test_action',{p_actor:user.id,p_operation:operation},true);
   if(deleting)return reply({ok:true,deleted:true,history_preserved:true});
   return reply(await rpc('platform_reveal_test_password',{p_user:payload.user_id,p_reason:'Affichage après réinitialisation du compte test'}));
  }catch(error){return reply({error:error instanceof Error?error.message:'Action impossible. Réessayer la même action.'},400);}
 };
}
