export function invitationEmailPayload(item,from){
 if(!/^[0-9a-f]{64}$/i.test(item.token)||typeof item.company_name!=='string'||typeof item.to!=='string')throw Error('InvalidInvitation');
 const link='https://punch360app.github.io/Punch360/?workerInvite='+encodeURIComponent(item.token);
 return {from,to:[item.to],subject:'Invitation PUNCH 360°',text:`Vous êtes invité à rejoindre ${item.company_name} sur PUNCH 360°.\n\nConfirmez le courriel invité puis utilisez ce lien unique avant son expiration :\n${link}\n\nSi vous ne reconnaissez pas cette entreprise, ignorez ce courriel.`};
}
export function createInvitationEmailHandler({rpc,fetch:transport=fetch,serviceKey,enabled=false,apiKey,from}){
 const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 return async req=>{
  if(req.method!=='POST')return reply(405,{error:'MethodNotAllowed'});
  if(!serviceKey||req.headers.get('Authorization')!==`Bearer ${serviceKey}`)return reply(401,{error:'Unauthorized'});
  if(!enabled||!apiKey||!from||/[\r\n]/.test(from))return reply(503,{error:'EmailDeliveryNotConfigured'});
  try{
   const items=await rpc('claim_invitation_email',{});let processed=0;
   for(const item of items){let status='retry',provider=null,error=null;
    try{
     const payload=invitationEmailPayload(item,from);
     const r=await transport('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`,'Idempotency-Key':'punch-worker-invite/'+item.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
     if(r.ok){const result=await r.json();if(typeof result.id==='string'&&result.id.length<=200){provider=result.id;status='sent'}else{error='MissingProviderID'}}
     else if(r.status===429||r.status>=500){error='ProviderTemporary'+r.status}
     else if(r.status===409){const body=await r.json();status=body.name==='concurrent_idempotent_requests'?'retry':'failed';error=status==='retry'?'ConcurrentRequest':'IdempotencyConflict'}
     else{status='failed';error='ProviderRejected'+r.status}
    }catch{error='TransportRetryWithinDeduplicationWindow'}
    await rpc('finish_invitation_email',{p_id:item.id,p_lease:item.lease,p_status:status,p_provider:provider,p_error:error});processed++;
   }
   return reply(200,{processed});
  }catch{return reply(500,{error:'EmailWorkerFailed'})}
 }
}
