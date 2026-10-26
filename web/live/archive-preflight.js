// The payload is assembled in memory, never written to browser storage.
// Keep the same 20 MiB UTF-8 data limit as archive-codec.js.
export const MAX_ARCHIVE_PAYLOAD_BYTES=20*1024*1024;
export const MAX_ARCHIVE_CHUNKS=4096;

/**
 * Validate server-provided chunk metadata before issuing any chunk RPC.
 * Bound UTF-16 character count during assembly, then check exact UTF-8 bytes.
 * This also handles multibyte characters/surrogate pairs split across chunks.
 */
export async function collectArchiveChunks({chunks,getChunk,maxBytes=MAX_ARCHIVE_PAYLOAD_BYTES}){
 if(!Number.isSafeInteger(chunks)||chunks<1||chunks>MAX_ARCHIVE_CHUNKS)
  throw Error('Archive invalide : nombre de blocs hors limite');
 if(typeof getChunk!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_ARCHIVE_PAYLOAD_BYTES)
  throw Error('Paramètres de récupération invalides');
 const pieces=[];
 let characters=0;
 for(let index=0;index<chunks;index++){
  const part=await getChunk(index);
  if(typeof part!=='string'||part.length===0)
   throw Error('Archive incomplète : bloc manquant');
  characters+=part.length;
  // For valid UTF-8, the number of bytes is never less than JS string length.
  // This early bound prevents accumulating an unbounded server response.
  if(characters>maxBytes)
   throw Error('Archive trop volumineuse : export opérateur requis');
  pieces.push(part);
 }
 const payload=pieces.join('');
 if(new TextEncoder().encode(payload).length>maxBytes)
  throw Error('Archive trop volumineuse : export opérateur requis');
 return payload;
}
