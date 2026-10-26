/**
 * Bounded UTF-8 reader shared by billing and signed Stripe webhooks.
 * req.text() buffers an arbitrarily large untrusted body before a later
 * length check; reject oversized bodies DURING streaming instead.
 *
 * Do not reserialize JSON here: webhook signatures authenticate the exact
 * UTF-8 text as received, including whitespace and field order.
 */
export async function readLimitedUtf8Request(request,maxBytes){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('INVALID_BODY_LIMIT');
 const header=request?.headers?.get('content-length');
 let expected=null;
 if(header!==null&&header!==undefined){
  if(!/^[0-9]{1,16}$/.test(header))throw Error('INVALID_CONTENT_LENGTH');
  expected=Number(header);
  if(!Number.isSafeInteger(expected))throw Error('INVALID_CONTENT_LENGTH');
  if(expected>maxBytes)throw Error('BODY_TOO_LARGE');
 }
 if(!request?.body)return expected===null||expected===0?'':Promise.reject(Error('INVALID_CONTENT_LENGTH'));
 const reader=request.body.getReader();
 const decoder=new TextDecoder('utf-8',{fatal:true});
 let count=0,raw='';
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))throw Error('INVALID_BODY_CHUNK');
   count+=value.byteLength;
   if(count>maxBytes)throw Error('BODY_TOO_LARGE');
   raw+=decoder.decode(value,{stream:true});
  }
  raw+=decoder.decode();
  if(expected!==null&&count!==expected)throw Error('INVALID_CONTENT_LENGTH');
  return raw;
 }catch(error){
  try{await reader.cancel('BODY_REJECTED');}catch{}
  throw error;
 }finally{reader.releaseLock();}
}
