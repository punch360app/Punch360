const origin='https://punch360app.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store, private'};
const MAX=25*1024*1024;
const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
const base64=b=>{let s='';for(let i=0;i<b.length;i+=16384)s+=String.fromCharCode(...b.subarray(i,i+16384));return btoa(s)};
/** Read at most MAX actual Storage bytes, even when Content-Length is absent or lies.
 * Return null on overflow and cancel the upstream stream; never call arrayBuffer().
 */
export async function readStorageBounded(response){
 const n=Number(response.headers.get('content-length'));
 if(Number.isFinite(n)&&n>MAX){await response.body?.cancel().catch(()=>{});return null;}
 const reader=response.body?.getReader();if(!reader)throw Error('STORAGE_STREAM_UNAVAILABLE');
 let total=0,parts=[],overflow=false;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))throw Error('STORAGE_CHUNK_INVALID');
   total+=value.byteLength;
   if(total>MAX){overflow=true;parts=[];await reader.cancel().catch(()=>{});break;}
   parts.push(value);
  }
 }finally{reader.releaseLock();}
 if(overflow)return null;
 const bytes=new Uint8Array(total);
 let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}
 return bytes;
}
export function createArchiveFilesHandler({env,fetch:request=globalThis.fetch,crypto=globalThis.crypto}){
 return async req=>{
  const reply=(s,d)=>new Response(JSON.stringify(d),{status:s,headers});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return reply(403,{error:'ORIGIN_DENIED'});
  const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
  if(url!=='https://mlabstdxxwjdpfaxiwmg.supabase.co'||!anon||!service)return reply(503,{error:'SERVER_NOT_CONFIGURED'});
  const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return reply(401,{error:'AUTH_REQUIRED'});
  const userHeaders={apikey:anon,Authorization:auth,'Content-Type':'application/json'},adminHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  const rpc=async(name,body,admin=false)=>{const r=await request(url+'/rest/v1/rpc/'+name,{method:'POST',headers:admin?adminHeaders:userHeaders,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('ARCHIVE_ACCESS_DENIED');return r.json()};
  try{
   const u=await request(url+'/auth/v1/user',{headers:userHeaders,signal:AbortSignal.timeout(15000)});if(!u.ok)return reply(401,{error:'AUTH_REQUIRED'});const actor=(await u.json()).id;
   if(Number(req.headers.get('content-length'))>MAX*1.4+4096)return reply(413,{error:'REQUEST_TOO_LARGE'});
   // Stream cap also covers requests without Content-Length.
   const reader=req.body?.getReader();if(!reader)return reply(400,{error:'INVALID_REQUEST'});let size=0;const chunks=[];
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX*1.4+4096){await reader.cancel();return reply(413,{error:'REQUEST_TOO_LARGE'})}chunks.push(value)}
   const bytes=new Uint8Array(size);let offset=0;for(const v of chunks){bytes.set(v,offset);offset+=v.length}const body=JSON.parse(new TextDecoder().decode(bytes));
   if(!['download','preview','restore'].includes(body.action)||typeof body.id!=='string'||!['essential-hr','job-documents'].includes(body.bucket)||typeof body.path!=='string')return reply(400,{error:'INVALID_REQUEST'});
   const params={p_id:body.id,p_bucket:body.bucket,p_path:body.path};
   const ctx=await rpc('company_archive_file_context',params); // Revalidates live session and current role on every request.
   if((body.action==='download'&&ctx.kind!=='export')||(body.action!=='download'&&ctx.kind!=='import'))return reply(403,{error:'WRONG_ARCHIVE_OPERATION'});
   if(!ctx.file.exists||ctx.file.size>MAX)return reply(409,{error:'DOCUMENT_NOT_AVAILABLE_IN_SNAPSHOT'});
   const objectUrl=url+'/storage/v1/object/'+body.bucket+'/'+body.path.split('/').map(encodeURIComponent).join('/');
   if(body.action==='download'){
    const r=await request(objectUrl,{headers:adminHeaders,signal:AbortSignal.timeout(30000)});if(!r.ok)return reply(409,{error:'DOCUMENT_UNAVAILABLE'});
    const content=await readStorageBounded(r);if(!content)return reply(413,{error:'DOCUMENT_TOO_LARGE'});
    if(content.length!==ctx.file.size)return reply(409,{error:'DOCUMENT_CHANGED_SINCE_SNAPSHOT'});
    const hash=hex(await crypto.subtle.digest('SHA-256',content));
    await rpc('company_archive_file_context',params);
    const signature=await rpc('company_archive_file_proof',{p_actor:actor,...params,p_sha256:hash},true);
    return reply(200,{bucket:body.bucket,path:body.path,data:base64(content),sha256:hash,signature});
   }
   if(typeof body.data!=='string'||body.data.length>Math.ceil(MAX/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.data)||body.data.length%4)return reply(400,{error:'INVALID_DOCUMENT'});
   const raw=atob(body.data),content=Uint8Array.from(raw,c=>c.charCodeAt(0));if(content.length!==ctx.file.size||content.length>MAX)return reply(400,{error:'INVALID_DOCUMENT_SIZE'});
   const hash=hex(await crypto.subtle.digest('SHA-256',content));if(hash!==body.sha256||typeof body.signature!=='string')return reply(400,{error:'DOCUMENT_HASH_MISMATCH'});
   await rpc('company_archive_file_proof',{p_actor:actor,...params,p_sha256:hash,p_signature:body.signature},true);
   const existing=await request(objectUrl,{headers:adminHeaders,signal:AbortSignal.timeout(30000)});
   if(existing.ok){const current=await readStorageBounded(existing);if(!current)return reply(413,{error:'DOCUMENT_TOO_LARGE'});const unchanged=current.length===content.length&&hex(await crypto.subtle.digest('SHA-256',current))===hash;return reply(200,{status:unchanged?'unchanged':'conflict',preserved:true})}
   // Supabase Storage uses JSON statusCode 404 (sometimes HTTP 400) for a missing key.
   let missing=false;try{const d=await existing.json();missing=String(d.statusCode)==='404'}catch{}if(!missing)return reply(409,{error:'DOCUMENT_LOOKUP_FAILED'});
   if(body.action==='preview')return reply(200,{status:'missing'});
   await rpc('company_archive_file_context',params);
   const upload=await request(objectUrl,{method:'POST',headers:{...adminHeaders,'Content-Type':ctx.file.mimetype||'application/pdf','x-upsert':'false'},body:content,signal:AbortSignal.timeout(30000)});
   if(!upload.ok)return reply(409,{error:'DOCUMENT_UPLOAD_CONFLICT_RETRY_PREVIEW'});
   await rpc('company_archive_file_restored',{p_actor:actor,...params,p_sha256:hash,p_signature:body.signature},true);
   return reply(200,{status:'restored'});
  }catch{return reply(400,{error:'ARCHIVE_OPERATION_REFUSED'})}
 };
}
