import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedStorageResponse,MAX_PRIVATE_PDF_BYTES} from '../supabase/functions/company-archive-files/limited-reader.mjs';

function response(chunks,header){
 let reads=0,cancelled=false,index=0;
 const stream=new ReadableStream({
  pull(controller){
   reads++;
   if(index===chunks.length){controller.close();return}
   controller.enqueue(chunks[index++]);
  },
  cancel(){cancelled=true}
 });
 const headers=header===undefined?{}:{'content-length':String(header)};
 return {result:new Response(stream,{headers}),state:{get reads(){return reads},get cancelled(){return cancelled}}};
}

test('small stream without Content-Length retains exact binary bytes',async()=>{
 const chunks=[Uint8Array.from([0,255,1]),Uint8Array.from([2,3,4,5])];
 const r=response(chunks);
 const output=await readBoundedStorageResponse(r.result);
 assert.deepEqual([...output],[0,255,1,2,3,4,5]);
 assert.equal(r.state.cancelled,false);
});

test('stream accepts the exact 25 MiB boundary even when Content-Length is absent',async()=>{
 const r=response([new Uint8Array(24*1024*1024),new Uint8Array(1024*1024)]);
 const output=await readBoundedStorageResponse(r.result);
 assert.equal(output.length,MAX_PRIVATE_PDF_BYTES);
 assert.equal(output[0],0);
 assert.equal(output.at(-1),0);
});

test('rejects oversized actual stream with NO Content-Length and cancels the stream',async()=>{
 const r=response([new Uint8Array(24*1024*1024),new Uint8Array(2*1024*1024)]);
 await assert.rejects(readBoundedStorageResponse(r.result),{code:'DOCUMENT_TOO_LARGE'});
 assert.equal(r.state.cancelled,true);
});

test('ignores a deceptive smaller Content-Length and checks actual bytes',async()=>{
 const r=response([new Uint8Array(700),new Uint8Array(400)],100);
 await assert.rejects(readBoundedStorageResponse(r.result,{maxBytes:1024}),{code:'DOCUMENT_TOO_LARGE'});
 assert.equal(r.state.cancelled,true);
});

test('too-large declared Content-Length fails before consuming any chunk',async()=>{
 const r=response([new Uint8Array(8)],MAX_PRIVATE_PDF_BYTES+1);
 await assert.rejects(readBoundedStorageResponse(r.result),{code:'DOCUMENT_TOO_LARGE'});
 assert.ok(r.state.reads<=1,'no payload should be drained on an oversized header');
});

test('invalid limit settings fail closed',async()=>{
 for(const maxBytes of [-1,0,Infinity,NaN,MAX_PRIVATE_PDF_BYTES+1,'1024']){
  const r=response([Uint8Array.from([1,2])]);
  await assert.rejects(readBoundedStorageResponse(r.result,{maxBytes}),{code:'INVALID_SIZE_LIMIT'});
 }
});

test('stream read errors fail closed without leaking provider error text',async()=>{
 const stream=new ReadableStream({pull(controller){controller.error(Error('Private storage internal details'))}});
 const r=new Response(stream);
 await assert.rejects(readBoundedStorageResponse(r),err=>{
  assert.equal(err.code,'DOCUMENT_READ_FAILED');
  assert.doesNotMatch(err.message,/Private storage|details/);
  return true;
 });
});
