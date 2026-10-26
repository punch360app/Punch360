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
