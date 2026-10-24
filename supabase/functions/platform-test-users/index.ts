const headers={'Access-Control-Allow-Origin':'https://punch360app.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('',{headers});
 if(req.method!=='POST')return reply({error:'Méthode refusée'},405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(url!=='https://mlabstdxxwjdpfaxiwmg.supabase.co'||!anon||!service)return reply({error:'Configuration serveur indisponible'},503);
 const authorization=req.headers.get('Authorization')||'';
 if(!authorization.startsWith('Bearer '))return reply({error:'Authentification requise'},401);
 const userHeaders={apikey:anon,Authorization:authorization,'Content-Type':'application/json'};
 const serviceHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
 try{
  const identity=await fetch(url+'/auth/v1/user',{headers:userHeaders});
  if(!identity.ok)return reply({error:'Session invalide'},401);
  const user=await identity.json();
  const permitted=await fetch(url+'/rest/v1/rpc/platform_access',{method:'POST',headers:userHeaders,body:'{}'});
  if(!permitted.ok||await permitted.json()!==true)return reply({error:'Accès plateforme refusé'},403);
  const stronger=await fetch(url+'/rest/v1/rpc/platform_snapshot',{method:'POST',headers:userHeaders,body:'{}'});
  if(!stronger.ok)return reply({error:'Authentification à deux facteurs requise'},403);
  const raw=await req.text();if(raw.length>4096)return reply({error:'Requête trop volumineuse'},413);
  const body=JSON.parse(raw);
  if(body.action==='create'){
   if(!/^[0-9a-f-]{36}$/i.test(body.company_id)||!['employee','lead','admin','boss'].includes(body.role))return reply({error:'Compagnie et rôle requis'},400);
   const email='test-'+crypto.randomUUID()+'@punch360.test.invalid',password=crypto.randomUUID()+'Aa9!';
   const created=await fetch(url+'/auth/v1/admin/users',{method:'POST',headers:serviceHeaders,body:JSON.stringify({email,password,email_confirm:true})});
   if(!created.ok)return reply({error:'Création Auth impossible'},502);
   const account=await created.json();
   const registered=await fetch(url+'/rest/v1/rpc/platform_register_test_user',{method:'POST',headers:serviceHeaders,body:JSON.stringify({p_actor:user.id,p_user:account.id,p_company:body.company_id,p_role:body.role})});
   if(!registered.ok){await fetch(url+'/auth/v1/admin/users/'+account.id,{method:'DELETE',headers:serviceHeaders});return reply({error:'La compagnie doit être un environnement de test avec des places disponibles.'},400);}
   return reply({user_id:account.id,email,password,notice:'Compte fictif uniquement. Mot de passe affiché une seule fois.'});
  }
  if(body.action==='status'){
   if(!/^[0-9a-f-]{36}$/i.test(body.user_id)||typeof body.active!=='boolean')return reply({error:'Compte et statut requis'},400);
   const updated=await fetch(url+'/rest/v1/rpc/platform_test_account_status',{method:'POST',headers:serviceHeaders,body:JSON.stringify({p_actor:user.id,p_user:body.user_id,p_active:body.active})});
   if(!updated.ok)return reply({error:'Compte de test requis; terminer ses punchs avant désactivation.'},400);
   const ban=await fetch(url+'/auth/v1/admin/users/'+body.user_id,{method:'PUT',headers:serviceHeaders,body:JSON.stringify({ban_duration:body.active?'none':'876000h'})});
   if(!ban.ok)return reply({error:'Droits de compagnie mis à jour; verrouillage Auth à réessayer.'},502);
   return reply({ok:true});
  }
  return reply({error:'Action inconnue'},400);
 }catch{return reply({error:'Action impossible. Réessaie sans modifier des données de production.'},400);}
});

