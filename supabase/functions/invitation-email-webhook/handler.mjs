const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function verifyInvitationMailWebhook({secret,body,headers,now=Date.now()}){
 const id=headers.get('svix-id'),timestamp=headers.get('svix-timestamp'),signatures=headers.get('svix-signature');
 if(!secret?.startsWith('whsec_')||!id||id.length>200||!/^\d{1,12}$/.test(timestamp||'')||!signatures||signatures.length>4096||Math.abs(now/1000-Number(timestamp))>300)throw Error('InvalidWebhook');
 const key=await crypto.subtle.importKey('raw',bytes(secret.slice(6)),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 let valid=false;for(const signature of signatures.split(' ')){if(!signature.startsWith('v1,'))continue;try{if(await crypto.subtle.verify('HMAC',key,bytes(signature.slice(3)),new TextEncoder().encode(`${id}.${timestamp}.${body}`)))valid=true}catch{}}
 if(!valid)throw Error('InvalidWebhook');return {id,event:JSON.parse(body)};
}
export function createInvitationMailWebhook({rpc,secret,now=Date.now}){
 return async req=>{
  if(req.method!=='POST')return new Response(null,{status:405});if(!secret)return new Response(null,{status:503});
  let verified;try{if(Number(req.headers.get('content-length'))>65536)return new Response(null,{status:413});const body=await req.text();if(body.length>65536)return new Response(null,{status:413});verified=await verifyInvitationMailWebhook({secret,body,headers:req.headers,now:now()})}catch{return new Response(null,{status:400})}
  const {id,event}=verified;if(!['email.sent','email.delivered','email.opened','email.bounced','email.failed','email.complained'].includes(event.type))return new Response(null,{status:204});
  try{if(typeof event.data?.email_id!=='string'||event.data.email_id.length>200)return new Response(null,{status:400});await rpc('invitation_email_event',{p_event:id,p_provider:event.data.email_id,p_type:event.type});return new Response(null,{status:204})}catch{return new Response(null,{status:500})}
 }
}
