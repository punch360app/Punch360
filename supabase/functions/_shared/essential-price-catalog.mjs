// Existing Stripe products and their six registered Price IDs are authoritative.
// Historical Stripe names predate the current Essentiel / Plus / Pro UI titles.
// Never create a replacement product just because a company's seats/offer changed.
const KEYS=Object.freeze({
 essential:Object.freeze({monthly:'punch_essentiel_monthly',yearly:'punch_essentiel_yearly'}),
 essential_plus:Object.freeze({monthly:'punch_pro_monthly',yearly:'punch_pro_yearly'}),
 essential_pro:Object.freeze({monthly:'punch_entreprise_monthly',yearly:'punch_entreprise_yearly'})
});
const validPriceId=x=>typeof x==='string'&&/^price_[a-zA-Z0-9]{8,80}$/.test(x);
export function planPriceKeys(planId){
 const key=KEYS[planId];
 if(!key)throw Error('UNKNOWN_ESSENTIAL_PLAN');
 return key;
}
export function checkRegisteredPrices(planId,rows){
 const keys=planPriceKeys(planId);
 if(!Array.isArray(rows))throw Error('STRIPE_CATALOG_INVALID');
 const result={};
 for(const cadence of ['monthly','yearly']){
  const found=rows.filter(row=>row?.id===keys[cadence]);
  if(found.length!==1)throw Error('STRIPE_CATALOG_INCOMPLETE');
  const row=found[0],expectedInterval=cadence==='yearly'?'year':'month';
  if(!row.active||row.currency!=='cad'||row.billing_interval!==expectedInterval||!validPriceId(row.stripe_price_id)||
     !Number.isSafeInteger(row.amount_cents)||row.amount_cents<1)throw Error('STRIPE_CATALOG_INVALID');
  result[cadence]=row;
 }
 if(result.yearly.stripe_price_id===result.monthly.stripe_price_id)throw Error('STRIPE_CATALOG_DUPLICATE');
 return result;
}
export function checkStripeProductPair(registered,remote,liveMode){
 if(!registered||!remote)throw Error('STRIPE_PRICE_UNVERIFIED');
 let product=null;
 for(const cadence of ['monthly','yearly']){
  const row=registered[cadence],price=remote[cadence];
  if(!price||price.id!==row.stripe_price_id||price.currency!=='cad'||price.active!==true||
     price.livemode!==liveMode||price.unit_amount!==row.amount_cents||
     price.recurring?.interval!==(cadence==='yearly'?'year':'month')||
     (price.recurring.interval_count??1)!==1||
     price.type!=='recurring'||price.billing_scheme!=='per_unit'||
     (typeof price.product!=='string'&&!price.product?.id)||
     price.transform_quantity||price.tiers_mode)throw Error('STRIPE_PRICE_UNVERIFIED');
  const id=typeof price.product==='string'?price.product:price.product.id;
  if(!/^prod_[a-zA-Z0-9]{5,80}$/.test(id))throw Error('STRIPE_PRICE_UNVERIFIED');
  if(product&&product!==id)throw Error('STRIPE_PRODUCT_MISMATCH');
  product=id;
 }
 return product;
}
export function selectRegisteredPrice(registered,cadence,amount){
 if(!['monthly','yearly'].includes(cadence)||!Number.isSafeInteger(amount)||amount<1||amount>99999999)throw Error('INVALID_ORDER_PRICE');
 const configured=registered?.[cadence];
 if(!configured)throw Error('STRIPE_CATALOG_INCOMPLETE');
 // Use one of the six existing IDs only for its exact amount. Changed seat counts and
 // negotiated amounts create a new Price *on the same verified existing product*, never a Product.
 return configured.amount_cents===amount?configured.stripe_price_id:null;
}



/**
 * Stripe's Customer ID stored in the company account is not sufficient to
 * authorize opening a billing portal or disclosing invoice history. Verify
 * the actual provider's tenant marker and test/live mode first.
 */
export function verifyStripeCustomerTenant(account,customer,companyId,liveMode){
 if(typeof account?.customer_id!=='string'||!account.customer_id||
    typeof companyId!=='string'||!companyId||typeof liveMode!=='boolean'||
    !customer||customer.object!=='customer'||customer.deleted===true||
    customer.id!==account.customer_id||customer.metadata?.punch_company!==companyId||
    customer.livemode!==liveMode)throw Error('STRIPE_CUSTOMER_TENANT_MISMATCH');
 return customer;
}
/**
 * Read an existing Stripe Customer *before* any price or session creation.
 * The dependency is injected so the same sequence can be tested offline.
 * Initial Checkout is the only action allowed without a saved Customer.
 */
export async function preflightStripeOrderCustomer(action,account,companyId,liveMode,stripe){
 if(!['checkout','preview','confirm'].includes(action))throw Error('INVALID_BILLING_ACTION');
 if(!account?.customer_id){
  if(action==='checkout')return null;
  throw Error('NO_CUSTOMER');
 }
 if(typeof stripe!=='function')throw Error('STRIPE_CUSTOMER_TENANT_MISMATCH');
 const customer=await stripe(`/customers/${account.customer_id}`);
 return verifyStripeCustomerTenant(account,customer,companyId,liveMode);
}

/**
 * A list filtered by a customer ID must not return an invoice owned by
 * another Stripe customer or one originating from the other Stripe mode.
 */
export function verifyStripeInvoiceListTenant(list,customerId,liveMode){
 if(!Array.isArray(list?.data)||typeof customerId!=='string'||!customerId||
    typeof liveMode!=='boolean')throw Error('STRIPE_INVOICE_TENANT_MISMATCH');
 for(const invoice of list.data){
  const owner=typeof invoice?.customer==='string'?invoice.customer:invoice?.customer?.id;
  if(owner!==customerId||invoice.livemode!==liveMode)
   throw Error('STRIPE_INVOICE_TENANT_MISMATCH');
 }
 return list.data;
}

/**
 * Verify Stripe's own subscription-to-customer and tenant binding before any
 * customer-facing mutation. The private DB subscription ID alone is not proof
 * that the provider object still belongs to this Essentiel company.
 * A missing company marker fails closed; do not infer ownership from price.
 */
export function verifyStripeSubscriptionTenant(account,subscription,companyId,liveMode){
 const customer=typeof subscription?.customer==='string'?subscription.customer:subscription?.customer?.id;
 if(typeof companyId!=='string'||!companyId||typeof liveMode!=='boolean'||
    typeof account?.subscription_id!=='string'||typeof account?.customer_id!=='string'||
    !subscription||subscription.id!==account.subscription_id||
    customer!==account.customer_id||subscription.metadata?.punch_company!==companyId||
    subscription.livemode!==liveMode)throw Error('SUBSCRIPTION_TENANT_MISMATCH');
 return subscription;
}
// A provider Price must never be created until the action is known to be
// eligible. For an existing subscription, validate its identity and pending
// update state before any POST /prices or POST /invoices/create_preview.
export function preflightBillingAction(action,account,subscription){
 if(!['checkout','preview','confirm'].includes(action))throw Error('INVALID_BILLING_ACTION');
 if(action==='checkout'){
  if(account?.subscription_id)throw Error('SUBSCRIPTION_EXISTS_USE_PREVIEW');
  return null;
 }
 if(!account?.subscription_id)throw Error('NO_SUBSCRIPTION');
 if(!subscription||subscription.id!==account.subscription_id)throw Error('SUBSCRIPTION_MISMATCH');
 if(subscription.pending_update)throw Error('PENDING_PAYMENT_COMPLETE_FIRST');
 if(!Array.isArray(subscription.items?.data)||subscription.items.data.length!==1||
    typeof subscription.items.data[0]?.id!=='string'||
    typeof subscription.items.data[0]?.price?.id!=='string')throw Error('UNSUPPORTED_SUBSCRIPTION_ITEMS');
 return subscription.items.data[0];
}

// Checkout and preview may create a new Price only when the exact registered
// base amount cannot be reused. Confirm must be read-only for Prices: use the
// server-saved preview identifier and refuse missing/stale/mismatched IDs.
export function orderPriceStrategy(action,registeredPriceId,storedPreview){
 if(!['checkout','preview','confirm'].includes(action))throw Error('INVALID_BILLING_ACTION');
 if(registeredPriceId!==null&&!validPriceId(registeredPriceId))throw Error('STRIPE_CATALOG_INVALID');
 if(action==='confirm'){
  if(!validPriceId(storedPreview?.price_id)||
     (registeredPriceId!==null&&registeredPriceId!==storedPreview.price_id))throw Error('PREVIEW_EXPIRED');
  return {kind:'fetch',priceId:storedPreview.price_id};
 }
 return registeredPriceId!==null?{kind:'fetch',priceId:registeredPriceId}:{kind:'create',priceId:null};
}
// Check a negotiated or registered Price returned by Stripe before referring
// to it in an order. An ID alone cannot prove its product, amount or mode.
export function checkOrderStripePrice(price,{expectedId,amount,cadence,productId,liveMode}){
 if(!validPriceId(price?.id)||
    (expectedId!==null&&price.id!==expectedId)||
    !Number.isSafeInteger(amount)||amount<1||amount>99999999||
    !['monthly','yearly'].includes(cadence)||
    price.active!==true||price.livemode!==liveMode||
    price.currency!=='cad'||price.unit_amount!==amount||
    price.type!=='recurring'||price.billing_scheme!=='per_unit'||
    price.recurring?.interval!==(cadence==='yearly'?'year':'month')||
    (price.recurring?.interval_count??1)!==1||
    price.product!==productId||price.transform_quantity||price.tiers_mode
 )throw Error('STRIPE_ORDER_PRICE_UNVERIFIED');
 return price;
}

/**
 * Fail closed before submitting a Stripe subscription change. The stored
 * preview must still describe this exact order price, subscription and item.
 * No user-provided preview identifiers are trusted.
 */
export function verifySubscriptionPreview(preview,subscription,item,intendedPriceId,nowSeconds=Math.floor(Date.now()/1000)){
 const fail=()=>{throw Error('PREVIEW_EXPIRED');};
 if(!preview||typeof preview!=='object'||!subscription||!item||
    typeof intendedPriceId!=='string'||!/^price_[a-zA-Z0-9]{8,80}$/.test(intendedPriceId)||
    !Number.isSafeInteger(nowSeconds)||nowSeconds<0)fail();
 if(preview.price_id!==intendedPriceId||preview.subscription_id!==subscription.id||
    preview.item_id!==item.id||preview.subscription_price!==item.price?.id)fail();
 if(!Number.isSafeInteger(preview.proration_date)||!Number.isSafeInteger(preview.expires_at)||
    preview.proration_date>nowSeconds||preview.expires_at!==preview.proration_date+600||
    nowSeconds>=preview.expires_at)fail();
 if(subscription.pending_update||subscription.items?.data?.length!==1)fail();
 return preview;
}

/**
 * One UUID v4 identifies one Boss decision, and can be reused for an
 * uncertain retry of THAT decision. Stripe remembers idempotency results;
 * reusing a constant, missing or timestamp-only key risks stale mutations.
 * Scope also includes tenant, subscription and action (cancel/resume).
 */
export function stripeRenewalIdempotencyKey(companyId,subscriptionId,action,requestId){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const v4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!uuid.test(companyId||'')||
    typeof subscriptionId!=='string'||!/^sub_[a-zA-Z0-9_]{8,100}$/.test(subscriptionId)||
    !['cancel','resume'].includes(action)||!v4.test(requestId||''))
    throw Error('INVALID_RENEWAL_REQUEST_ID');
 return `punch-renewal:${companyId}:${subscriptionId}:${action}:${requestId}`;
}
