/**
 * Private Storage response reader used as a reviewable building block for
 * company-archive-files. The Edge handler must still import/call this helper
 * before this protection is active in production (tracked in issue #81).
 *
 * The 25 MiB limit applies to bytes received, not HTTP Content-Length.
 */
export const MAX_PRIVATE_PDF_BYTES=25*1024*1024;

export class StorageReadError extends Error{
 constructor(code){super(code);this.name='StorageReadError';this.code=code}
}

export async function readBoundedStorageResponse(response,{maxBytes=MAX_PRIVATE_PDF_BYTES}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_PRIVATE_PDF_BYTES)
  throw new StorageReadError('INVALID_SIZE_LIMIT');
 const rawHeader=response?.headers?.get?.('content-length');
 const declared=rawHeader==null?NaN:Number(rawHeader);
 if(Number.isFinite(declared)&&declared>maxBytes){
  await response?.body?.cancel?.().catch(()=>{});
  throw new StorageReadError('DOCUMENT_TOO_LARGE');
 }
 if(!response?.body?.getReader)
  throw new StorageReadError('DOCUMENT_STREAM_UNAVAILABLE');
 const reader=response.body.getReader();
 let total=0,buffer=new Uint8Array(Math.min(maxBytes,65536));
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))throw new StorageReadError('DOCUMENT_STREAM_INVALID');
   if(value.byteLength>maxBytes-total){
    await reader.cancel().catch(()=>{});
    throw new StorageReadError('DOCUMENT_TOO_LARGE');
   }
   const required=total+value.byteLength;
   if(required>buffer.length){
    const capacity=Math.min(maxBytes,Math.max(required,buffer.length*2));
    const expanded=new Uint8Array(capacity);
    expanded.set(buffer.subarray(0,total));
    buffer=expanded;
   }
   buffer.set(value,total);
   total=required;
  }
  return buffer.slice(0,total);
 }catch(err){
  if(!(err instanceof StorageReadError)){
   await reader.cancel().catch(()=>{});
   throw new StorageReadError('DOCUMENT_READ_FAILED');
  }
  throw err;
 }finally{reader.releaseLock()}
}
