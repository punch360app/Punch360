// Provider adapter: no SDK globals, no secrets in error messages, injectable HTTP for tests.
export function billingQuote(p,seats,cadence){
 if(!Number.isSafeInteger(seats)||seats<1||seats>100000||!['monthly','yearly'].includes(cadence))throw Error('INVALID_QUOTE');
 for(const k of ['base_cents','included_seats','extra_seat_cents','annual_discount'])if(!Number.isSafeInteger(p[k])||p[k]<0)throw Error('INVALID_PRICE');
 if(p.included_seats<1||p.annual_discount>100)throw Error('INVALID_PRICE');
 const monthly=p.base_cents+Math.max(0,seats-p.included_seats)*p.extra_seat_cents;
 const amount=cadence==='yearly'?Math.round(monthly*12*(100-p.annual_discount)/100):monthly;
 if(!Number.isSafeInteger(amount)||amount>99999999)throw Error('PRICE_TOO_LARGE');
 return {monthly_cents:monthly,amount_cents:amount,cadence,seats};
}
export function stripeClient(secret,fetcher=fetch){
 if(!/^sk_(test|live)_/.test(secret||''))throw Error('STRIPE_NOT_CONFIGURED');
 /** @param {string} path @param {any} params @param {string|null} key */
 return async(path,params=null,key=null)=>{
  if(!/^\/[a-z0-9_/-]+(?:\?[a-z_]+=[a-zA-Z0-9_]+(?:&[a-z_]+=[a-zA-Z0-9_]+)*)?$/.test(path))throw Error('INVALID_STRIPE_PATH');
  const headers={Authorization:`Bearer ${secret}`,'Stripe-Version':'2025-02-24.acacia'};
  if(key)headers['Idempotency-Key']=key;
  const flatten=(v,p,out)=>{if(v===undefined||v===null)return;if(Array.isArray(v))v.forEach((x,i)=>flatten(x,`${p}[${i}]`,out));else if(typeof v==='object')Object.entries(v).forEach(([k,x])=>flatten(x,p?`${p}[${k}]`:k,out));else out.append(p,String(v));};
  const form=new URLSearchParams();if(params)flatten(params,'',form);
  const response=await fetcher(`https://api.stripe.com/v1${path}`,{method:params?'POST':'GET',headers,body:params?form:undefined,signal:AbortSignal.timeout(20000)});
  const data=await response.json();if(!response.ok)throw Error(`STRIPE_${response.status}_${data.error?.code||'REQUEST_FAILED'}`);return data;
 };
}
export async function verifyStripeSignature(raw,signature,secret,now=Date.now()){
 if(!secret||!signature)throw Error('INVALID_SIGNATURE');const parts=signature.split(',').map(x=>x.split('=')),t=Number(parts.find(x=>x[0]==='t')?.[1]);
 if(!Number.isSafeInteger(t)||Math.abs(now/1000-t)>300)throw Error('INVALID_SIGNATURE');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${t}.${raw}`)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const match=parts.filter(x=>x[0]==='v1').some(([,s])=>{if(s?.length!==digest.length)return false;let d=0;for(let i=0;i<s.length;i++)d|=s.charCodeAt(i)^digest.charCodeAt(i);return d===0;});
 if(!match)throw Error('INVALID_SIGNATURE');return JSON.parse(raw);
}
export function safeHostedUrl(url){if(typeof url!=='string')throw Error('INVALID_PROVIDER_URL');const u=new URL(url);if(u.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com','invoice.stripe.com','pay.stripe.com'].includes(u.hostname))throw Error('INVALID_PROVIDER_URL');return u.href;}
