import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {stripeClient,verifyStripeSignature,stripeInvoiceSubscriptionId,verifyStripeWebhookInvoice,stripeWebhookSubscriptionPrice} from '../_shared/stripe.mjs';
import {readLimitedUtf8Request} from '../_shared/limited-body.mjs';
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response('METHOD_NOT_ALLOWED',{status:405});
 const secret=Deno.env.get('STRIPE_SECRET_KEY'),signing=Deno.env.get('STRIPE_WEBHOOK_SECRET');
 if(!secret||!signing||Deno.env.get('PUNCH_STRIPE_ENABLED')!=='true')return new Response('NOT_CONFIGURED',{status:503});
 let event:any,raw:string;
 try{raw=await readLimitedUtf8Request(req,1048576);}
 catch(err){return err instanceof Error&&err.message==='BODY_TOO_LARGE'?new Response('TOO_LARGE',{status:413}):new Response('BAD_REQUEST',{status:400});}
 try{event=await verifyStripeSignature(raw,req.headers.get('stripe-signature'),signing);}
 catch{return new Response('BAD_SIGNATURE',{status:400});}
 if(event.livemode!==secret.startsWith('sk_live_'))return new Response('WRONG_MODE',{status:400});
 const obj=event.data?.object;
 const allowed=['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed','invoice.finalized'];
 if(!allowed.includes(event.type))return Response.json({received:true,ignored:true});
 try{
  const stripe=stripeClient(secret),subId=event.type.startsWith('customer.subscription.')?obj?.id:stripeInvoiceSubscriptionId(obj);
  if(!subId)return Response.json({received:true,ignored:true});
  const sub=await stripe(`/subscriptions/${subId}`),company=sub.metadata?.punch_company;
  if(!company)return Response.json({received:true,ignored:true});
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const latestId=typeof sub.latest_invoice==='string'?sub.latest_invoice:sub.latest_invoice?.id;
  const invoice=latestId?await stripe(`/invoices/${latestId}`):null;
  if(invoice)verifyStripeWebhookInvoice(invoice,sub,secret.startsWith('sk_live_'));
  const paid=invoice?.status==='paid',periodEnd=sub.current_period_end;
  const state={status:sub.status,paid_through:paid?periodEnd:null,first_unpaid_at:!paid&&['past_due','unpaid','incomplete'].includes(sub.status)?invoice?.created||event.created:null,canceled:sub.cancel_at_period_end||['canceled','incomplete_expired'].includes(sub.status)};
  const priceId=stripeWebhookSubscriptionPrice(sub);
  const resolve=await admin.rpc('billing_service_resolve_order',{p_company:company,p_subscription:sub.id,p_price:priceId,p_original:sub.metadata.punch_order||null});if(resolve.error)throw resolve.error;if(!resolve.data)throw Error('UNKNOWN_CONTRACT_PRICE');
  let receivedInvoice=invoice;
  if(event.type.startsWith('invoice.')){
   if(!obj?.id||typeof obj.id!=='string'||!/^in_[a-zA-Z0-9_]+$/.test(obj.id))throw Error('STRIPE_INVOICE_EVENT_INVALID');
   if(obj.id!==latestId)receivedInvoice=await stripe(`/invoices/${obj.id}`);
   if(!receivedInvoice||receivedInvoice.id!==obj.id)throw Error('STRIPE_INVOICE_EVENT_INVALID');
   verifyStripeWebhookInvoice(receivedInvoice,sub,secret.startsWith('sk_live_'));
  }
  const i=receivedInvoice;
  const applied=await admin.rpc('billing_service_apply',{p_event:event.id,p_type:event.type,p_created:event.created,p_company:company,p_order:resolve.data,p_customer:typeof sub.customer==='string'?sub.customer:sub.customer.id,p_subscription:sub.id,p_state:state,p_invoice:i?{id:i.id,status:i.status,total:i.total,amount_paid:i.amount_paid,currency:i.currency,period_end:i.period_end,paid_at:i.status_transitions?.paid_at}:null});
  if(applied.error)throw applied.error;return Response.json({received:true});
 }catch{return new Response('RETRY_REQUIRED',{status:500});}
});
