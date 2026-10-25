const notFound=err=>String(err?.message).startsWith('STRIPE_404_');
function owned(p,id,mode){if(p?.metadata?.punch_promotion!==id||p.livemode!==(mode==='live'))throw Error('PROVIDER_OWNERSHIP_MISMATCH');return p}
export async function synchronisePromotion(ctx,action,stripe,mode){
 if(ctx.mode!==mode)throw Error('STRIPE_MODE_MISMATCH');
 const id=ctx.id,couponId='punch-essential-'+id;
 let promotion=null;
 if(ctx.promotion_id)promotion=owned(await stripe('/promotion_codes/'+ctx.promotion_id),id,mode);
 else {const list=await stripe('/promotion_codes?code='+ctx.code+'&limit=100');const ours=list.data.filter(p=>p.metadata?.punch_promotion===id);if(ours.length>1)throw Error('PROVIDER_DUPLICATE_PROMOTION');if(ours[0])promotion=owned(ours[0],id,mode);}
 if(action==='publish'&&!promotion){
  let coupon;try{coupon=await stripe('/coupons/'+couponId)}catch(err){if(!notFound(err))throw err;}
  if(coupon){if(coupon.metadata?.punch_promotion!==id||coupon.livemode!==(mode==='live'))throw Error('PROVIDER_OWNERSHIP_MISMATCH');}
  else {
   const products=new Set();
   for(const priceId of [...new Set(ctx.prices||[])]){if(!/^price_[a-zA-Z0-9]+$/.test(priceId))throw Error('INVALID_CONFIGURED_PRICE');try{const p=await stripe('/prices/'+priceId);if(p.livemode===(mode==='live')&&typeof p.product==='string')products.add(p.product);}catch(err){if(!notFound(err))throw err;}}
   for(const plan of ctx.plans||[]){if(!['essential','essential_plus','essential_pro'].includes(plan.id))throw Error('INVALID_PLAN');const productId='punch-'+plan.id;let product;try{product=await stripe('/products/'+productId)}catch(err){if(!notFound(err))throw err;product=await stripe('/products',{id:productId,name:plan.title,metadata:{punch_edition:'essential'}},productId)}if(product.livemode!==(mode==='live'))throw Error('STRIPE_MODE_MISMATCH');products.add(product.id);}
   if(!products.size)throw Error('PUNCH_PRODUCTS_REQUIRED');
   const params={id:couponId,name:'PUNCH '+ctx.code,percent_off:ctx.percent_off,duration:ctx.duration,applies_to:{products:[...products]},metadata:{punch_promotion:id,punch_edition:'essential'}};
   if(ctx.duration==='repeating')params.duration_in_months=ctx.duration_months;
   coupon=await stripe('/coupons',params,id+':coupon');
  }
  const params={coupon:coupon.id,code:ctx.code,metadata:{punch_promotion:id,punch_edition:'essential'},restrictions:{first_time_transaction:ctx.first_transaction}};
  if(ctx.max_redemptions)params.max_redemptions=ctx.max_redemptions;
  if(ctx.expires_at)params.expires_at=Math.floor(Date.parse(ctx.expires_at)/1000);
  promotion=owned(await stripe('/promotion_codes',params,id+':promotion'),id,mode);
 }
 if(action==='disable'&&promotion?.active)promotion=owned(await stripe('/promotion_codes/'+promotion.id,{active:false},id+':disable'),id,mode);
 if(action==='refresh'&&!promotion)throw Error('PROVIDER_PROMOTION_NOT_FOUND');
 return {mode,coupon_id:promotion?.coupon?.id||null,promotion_id:promotion?.id||null,active:promotion?.active===true,times_redeemed:promotion?.times_redeemed||0};
}
