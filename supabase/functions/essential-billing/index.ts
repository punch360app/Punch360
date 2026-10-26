import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {billingQuote,stripeClient,safeHostedUrl} from '../_shared/stripe.mjs';
import {planPriceKeys,checkRegisteredPrices,checkStripeProductPair,selectRegisteredPrice,preflightBillingAction,orderPriceStrategy,checkOrderStripePrice,verifySubscriptionPreview} from '../_shared/essential-price-catalog.mjs';
const origin='https://punch360app.github.io',returnUrl=origin+'/Punch360/?edition=essential';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const response=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return response(405,{error:'METHOD_NOT_ALLOWED'});
 if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return response(403,{error:'ORIGIN_DENIED'});
 const authorization=req.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return response(401,{error:'AUTH_REQUIRED'});
 const url=Deno.env.get('SUPABASE_URL')!,user=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}}),admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const auth=await user.auth.getUser();if(auth.error||!auth.data.user)return response(401,{error:'AUTH_REQUIRED'});
 try{
  const raw=await req.text();if(raw.length>4096)return response(413,{error:'REQUEST_TOO_LARGE'});const body=JSON.parse(raw);
  const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
  if(!uuid(body.companyId)||!['status','checkout','preview','confirm','portal','invoices','cancel','resume'].includes(body.action))return response(400,{error:'INVALID_REQUEST'});
  const context=await admin.rpc('billing_service_context',{p_actor:auth.data.user.id,p_company:body.companyId,p_order:body.orderId||null});if(context.error)return response(403,{error:'CONTRACT_ACCESS_DENIED'});
  const secret=Deno.env.get('STRIPE_SECRET_KEY'),enabled=Deno.env.get('PUNCH_STRIPE_ENABLED')==='true';
  if(body.action==='status')return response(200,{configured:!!secret&&enabled,mode:secret?.startsWith('sk_live_')?'live':'test'});
  if(!enabled||!secret)return response(503,{error:'STRIPE_NOT_CONFIGURED'});
  const stripe=stripeClient(secret),ctx=context.data,o=ctx.order,a=ctx.account;
  const save=async(values:unknown,customer:string)=>{const r=await admin.rpc('billing_service_save',{p_actor:auth.data.user!.id,p_company:body.companyId,p_order:body.orderId||null,p_customer:customer,p_values:values});if(r.error)throw Error(r.error.message);};
  if(body.action==='invoices'){
   if(!a?.customer_id)return response(200,{invoices:[]});const invoices=await stripe(`/invoices?customer=${a.customer_id}`);return response(200,{invoices:invoices.data.map((i:any)=>({id:i.id,number:i.number,status:i.status,total:i.total,paid:i.amount_paid,currency:i.currency,url:i.hosted_invoice_url? safeHostedUrl(i.hosted_invoice_url):null,created:i.created}))});
  }
  if(body.action==='portal'){
   if(!a?.customer_id)throw Error('NO_CUSTOMER');const p=await stripe('/billing_portal/sessions',{customer:a.customer_id,return_url:returnUrl});return response(200,{url:safeHostedUrl(p.url)});
  }
  if(['cancel','resume'].includes(body.action)){
   if(!a?.subscription_id)throw Error('NO_SUBSCRIPTION');const sub=await stripe(`/subscriptions/${a.subscription_id}`,{cancel_at_period_end:body.action==='cancel'},`${body.companyId}:${body.action}:${body.requestId}`);return response(200,{cancel_at_period_end:sub.cancel_at_period_end,effective_at:sub.current_period_end,pending_server_confirmation:true});
  }
  if(!o)throw Error('ORDER_REQUIRED');
  const expected=billingQuote(o.snapshot,o.seats,o.cadence);
  if(expected.amount_cents!==Number(o.amount_cents))throw Error('ORDER_AMOUNT_MISMATCH');
  // Never infer the Stripe product from amount alone: all six existing IDs belong
  // to distinct plan/cadence pairs, even if a negotiated offer matches another price.
  const keys=planPriceKeys(o.plan_id);
  const catalog=await admin.from('essential_stripe_prices')
    .select('id,stripe_price_id,amount_cents,currency,billing_interval,active')
    .in('id',[keys.monthly,keys.yearly]);
  if(catalog.error)throw Error('STRIPE_CATALOG_UNAVAILABLE');
  const registered=checkRegisteredPrices(o.plan_id,catalog.data);
  const remote=await Promise.all([
   stripe(`/prices/${registered.monthly.stripe_price_id}`),
   stripe(`/prices/${registered.yearly.stripe_price_id}`)
  ]);
  const productId=checkStripeProductPair(registered,{monthly:remote[0],yearly:remote[1]},secret.startsWith('sk_live_'));
  // Preflight before POST /prices: reject checkout on an existing subscription
  // and reject preview/confirm without an eligible subscription. Previously
  // these checks ran AFTER creating a custom Price on the provider.
  let sub:any=null,item:any=null;
  if(body.action==='checkout')preflightBillingAction(body.action,a,null);
  else {
   if(!a?.subscription_id)throw Error('NO_SUBSCRIPTION');
   sub=await stripe(`/subscriptions/${a.subscription_id}`);
   item=preflightBillingAction(body.action,a,sub);
  }
  const interval=o.cadence==='yearly'?'year':'month';
  const registeredPrice=selectRegisteredPrice(registered,o.cadence,o.amount_cents);
  const strategy=orderPriceStrategy(body.action,registeredPrice,o.preview);
  // Unlike preview/checkout, confirm never creates a Stripe Price. It reads
  // the server-saved preview ID, verifies the actual provider object, and
  // only then submits the subscription change. Safe across retries.
  const price:any=strategy.kind==='fetch'
    ? registeredPrice===strategy.priceId?remote[o.cadence==='yearly'?1:0]:await stripe(`/prices/${strategy.priceId}`)
    : await stripe('/prices',{
      currency:'cad',unit_amount:o.amount_cents,recurring:{interval},product:productId,
      metadata:{punch_order:o.id,punch_plan:o.plan_id,punch_company:body.companyId}
    },`${o.id}:price`);
  checkOrderStripePrice(price,{
    expectedId:strategy.priceId,amount:o.amount_cents,cadence:o.cadence,
    productId,liveMode:secret.startsWith('sk_live_')
  });
  if(body.action==='checkout'){
   const customer=a?.customer_id?{id:a.customer_id}:await stripe('/customers',{metadata:{punch_company:body.companyId}},`${body.companyId}:customer`);
   await save({},customer.id);
   await save({status:'creating',preview:{price_id:price.id}},customer.id);
   const checkout=await stripe('/checkout/sessions',{customer:customer.id,mode:'subscription',line_items:[{price:price.id,quantity:1}],allow_promotion_codes:true,automatic_tax:{enabled:true},billing_address_collection:'required',customer_update:{address:'auto'},client_reference_id:body.companyId,subscription_data:{metadata:{punch_company:body.companyId,punch_order:o.id}},success_url:returnUrl+'&billing=returned',cancel_url:returnUrl+'&billing=cancelled',expires_at:Math.floor(Date.parse(o.created_at)/1000)+3600},`${o.id}:checkout`);
   await save({status:'checkout',checkout_id:checkout.id},customer.id);return response(200,{url:safeHostedUrl(checkout.url)});
  }
  const prorationDate=Math.floor(Date.now()/1000);
  if(body.action==='preview'){
   const invoice=await stripe('/invoices/create_preview',{customer:a.customer_id,subscription:sub.id,subscription_details:{items:[{id:item.id,price:price.id,quantity:1}],proration_date:prorationDate,proration_behavior:'always_invoice'}});
   const preview={price_id:price.id,item_id:item.id,proration_date:prorationDate,subscription_id:sub.id,subscription_price:item.price.id,amount_due:invoice.amount_due,currency:invoice.currency,total:invoice.total,effective_at:prorationDate,expires_at:prorationDate+600};
   await save({status:'previewed',preview},a.customer_id);return response(200,{preview});
  }
  const p=verifySubscriptionPreview(o.preview,sub,item,price.id);
  // Do not grant new seats from this response. Signed webhook confirms paid changes.
  await save({status:'submitted',subscription_id:sub.id},a.customer_id);
  const updated=await stripe(`/subscriptions/${sub.id}`,{items:[{id:p.item_id,price:p.price_id,quantity:1}],proration_date:p.proration_date,proration_behavior:'always_invoice',payment_behavior:'pending_if_incomplete'},`${o.id}:confirm`);
  // Pending updates cannot include metadata: store the accepted order separately for webhook resolution.
  await save({status:'submitted',subscription_id:sub.id},a.customer_id);
  return response(200,{pending_payment:!!updated.pending_update,pending_server_confirmation:true});
 }catch(err){const m=err instanceof Error?err.message:'BILLING_ERROR';return response(400,{error:m.startsWith('STRIPE_')||/^[A-Z_]+$/.test(m)?m:'BILLING_REQUEST_FAILED'});}
});
