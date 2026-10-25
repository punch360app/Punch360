const EXPO='https://exp.host/--/api/v2/push/';
/** Inject transport for deterministic tests; tokens and provider responses never enter logs. */
export function createPushDeliveryHandler({rpc,fetch:transport=fetch,serviceKey,enabled=false,expoAccessToken}){
 const response=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 return async request=>{
  if(request.method!=='POST')return response(405,{error:'MethodNotAllowed'});
  if(!serviceKey||request.headers.get('Authorization')!==`Bearer ${serviceKey}`)return response(401,{error:'Unauthorized'});
  if(!enabled)return response(503,{error:'PushDeliveryNotEnabled'});
  try{
   const items=await rpc('claim_push_delivery',{});let processed=0;
   for(const item of items){
    let status='unknown',ticket=null,error=null;const isReceipt=!!item.ticket_id;
    try{
     const r=await transport(EXPO+(isReceipt?'getReceipts':'send'),{method:'POST',headers:{'Content-Type':'application/json',...(expoAccessToken?{Authorization:`Bearer ${expoAccessToken}`}:{})},body:JSON.stringify(isReceipt?{ids:[item.ticket_id]}:{to:item.token,title:'PUNCH 360°',body:'Une nouvelle notification vous attend dans votre espace sécurisé.',data:{notification_id:item.notification_id,company_id:item.company_id},channelId:'work',ttl:3600}),signal:AbortSignal.timeout(12000)});
     if(!r.ok){status=r.status===429||r.status>=500?'retry':'failed';error='ProviderHTTP'+r.status;}
     else{
      const body=await r.json(),result=isReceipt?body.data?.[item.ticket_id]:body.data;
      if(!result){status=isReceipt?'retry':'unknown';error='MissingProviderResult';}
      else if(result.status==='ok'){
       if(isReceipt)status='provider_received';
       else if(typeof result.id==='string'&&result.id.length<=200){status='accepted';ticket=result.id;}
       else{status='unknown';error='MissingTicket';}
      }else{error=['DeviceNotRegistered','MessageTooBig','MessageRateExceeded','MismatchSenderId','InvalidCredentials'].includes(result.details?.error)?result.details.error:'ProviderRejected';status=error==='MessageRateExceeded'?'retry':'failed';}
     }
    }catch{status=isReceipt?'retry':'unknown';error=isReceipt?'ReceiptLookupFailed':'TransportOutcomeUnknown';}
    await rpc('finish_push_delivery',{p_id:item.id,p_lease:item.lease,p_status:status,p_ticket:ticket,p_error:error});processed++;
   }
   return response(200,{processed});
  }catch{return response(500,{error:'PushWorkerFailed'});}
 }
}
