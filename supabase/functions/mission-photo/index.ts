import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { boundedRequestBody, identifyMissionPhoto, MAX_PHOTO_BYTES } from './image-validation.mjs';

// Photo evidence is never written through a public bucket or an authenticated
// client Storage policy. The privileged client is used ONLY after user-scoped RPC.
const HEADERS = {'Content-Type':'application/json','Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
 'Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const BUCKET='mission-photo-evidence';
function response(value,status=200){return new Response(JSON.stringify(value),{status,headers:HEADERS});}
function uuid(s){return typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
 if(request.method!=='POST')return response({error:'Méthode refusée'},405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),
  serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!serviceKey)return response({error:'Service photo non configuré'},503);
 const token=/^Bearer (\S+)$/i.exec(request.headers.get('authorization')||'')?.[1];
 if(!token)return response({error:'Connexion requise'},401);
 const userClient=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}},
   auth:{autoRefreshToken:false,persistSession:false}});
 const {data:{user},error:userError}=await userClient.auth.getUser(token);
 if(userError||!user)return response({error:'Connexion invalide'},401);
 const storageClient=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 try {
  const contentType=request.headers.get('content-type')||'';
  if(contentType.startsWith('application/json')){
   if(Number(request.headers.get('content-length')||0)>2048)return response({error:'Requête trop longue'},413);
   const payload=await request.json();
   if(payload?.action!=='view'||!uuid(payload.company)||!uuid(payload.photo))
    return response({error:'Paramètres invalides'},400);
   const {data, error}=await userClient.rpc('get_essential_mission_photo_path',
     {p_company:payload.company,p_photo:payload.photo});
   if(error||!data?.path)return response({error:'Preuve privée inaccessible'},403);
   const signed=await storageClient.storage.from(BUCKET).createSignedUrl(data.path,60);
   if(signed.error||!signed.data?.signedUrl)return response({error:'Photo non disponible'},503);
   return response({url:signed.data.signedUrl,expires_in:60});
  }
  if(!contentType.startsWith('multipart/form-data'))return response({error:'Format invalide'},415);
  let bytes;
  try{bytes=await boundedRequestBody(request.body,request.headers.get('content-length'))}
  catch{return response({error:'Fichier trop volumineux ou incomplet'},413);}
  const multipart=new Request(request.url,{method:'POST',
   headers:{'content-type':contentType},body:bytes});
  const fields=await multipart.formData(),company=fields.get('company'),mission=fields.get('mission'),
   version=Number(fields.get('version')),file=fields.get('file');
  if(!uuid(company)||!uuid(mission)||!Number.isInteger(version)||version<1||
   !(file instanceof File)||file.size<16||file.size>MAX_PHOTO_BYTES)
   return response({error:'Mission ou photo invalide'},400);
  const raw=new Uint8Array(await file.arrayBuffer());
  let identified;
  try {identified=identifyMissionPhoto(raw)}
  catch{return response({error:'Contenu image refusé'},415);}
  // SQL validates the actual employee, company, mission, current version and state.
  const stage=await userClient.rpc('prepare_essential_mission_photo',
   {p_company:company,p_mission:mission,p_version:version});
  if(stage.error||!uuid(stage.data?.photo_id)||!stage.data?.path)
   return response({error:'Mission modifiée ou accès refusé'},403);
  const path=stage.data.path+'.'+identified.extension;
  // The generated storage path is scoped to the validated company and mission.
  // The DB key includes the base path; store at that exact key to avoid mismatch.
  const objectPath=stage.data.path;
  const upload=await storageClient.storage.from(BUCKET).upload(objectPath,raw,
   {contentType:identified.mime,upsert:false,cacheControl:'0'});
  if(upload.error)return response({error:'Téléversement non confirmé; réessayez'},503);
  const mark=await storageClient.rpc('commit_essential_mission_photo_upload',
   {p_photo:stage.data.photo_id,p_mime:identified.mime,p_bytes:raw.byteLength});
  if(mark.error){
   await storageClient.storage.from(BUCKET).remove([objectPath]);
   return response({error:'Photo non confirmée par le serveur'},503);
  }
  return response({photo_id:stage.data.photo_id});
 } catch {return response({error:'Preuve photo indisponible; rien ne confirme la fin de mission'},503);}
});
