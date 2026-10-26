import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readLimitedUtf8Request} from '../supabase/functions/_shared/limited-body.mjs';

const encoder=new TextEncoder();
function request(parts,contentLength){
 const byteParts=parts.map(part=>typeof part==='string'?encoder.encode(part):part);
 const headers=new Headers(contentLength===undefined?{}:{'content-length':String(contentLength)});
 let cancelled=false,readCount=0;
 const body=new ReadableStream({
  pull(controller){
   readCount++;
   const part=byteParts.shift();
   if(part)controller.enqueue(part);else controller.close();
  },
  cancel(){cancelled=true;}
 });
 return {request:{headers,body},info:()=>({cancelled,readCount})};
}
test('read exactly the body up to the cap, including UTF-8 chunk boundaries',async()=>{
 const utf8=encoder.encode('{"émoji":"✅"}');
 const {request:req}=request([utf8.slice(0,3),utf8.slice(3,9),utf8.slice(9)],utf8.length);
 assert.equal(await readLimitedUtf8Request(req,utf8.length),'{"émoji":"✅"}');
});
test('reject too large Content-Length before reading any bytes',async()=>{
 const {request:req,info}=request(['{"x":1}'],4097);
 await assert.rejects(readLimitedUtf8Request(req,4096),/BODY_TOO_LARGE/);
 assert.equal(info().readCount,0);
});
test('reject lying Content-Length and streamed overflow before concatenating it',async()=>{
 const bytes=encoder.encode('xxxxxxxx');
 const over=request([bytes,bytes,bytes],undefined);
 await assert.rejects(readLimitedUtf8Request(over.request,12),/BODY_TOO_LARGE/);
 assert.ok(over.info().readCount<=2,'stop after first overflow');
 assert.equal(over.info().cancelled,true,'abandon remaining bytes');
 const fake=request(['abcdef'],3);
 await assert.rejects(readLimitedUtf8Request(fake.request,4096),/INVALID_CONTENT_LENGTH/);
});
test('reject invalid length headers, binary decoding errors and invalid limits',async()=>{
 for(const bad of ['-1','bad','Infinity','1.5','99999999999999999']){
  const x=request(['safe'],bad);
  await assert.rejects(readLimitedUtf8Request(x.request,4096),/INVALID_CONTENT_LENGTH/);
 }
 const binary=request([new Uint8Array([0xff,0xfe])]);
 await assert.rejects(readLimitedUtf8Request(binary.request,4096),/TypeError/);
 const invalid=request(['x']);
 await assert.rejects(readLimitedUtf8Request(invalid.request,0),/INVALID_BODY_LIMIT/);
});
test('empty valid body and a body exactly 1 MiB are accepted',async()=>{
 assert.equal(await readLimitedUtf8Request(request([],0).request,4096),'');
 const full=encoder.encode('x'.repeat(1048576));
 const result=await readLimitedUtf8Request(request([full],full.length).request,1048576);
 assert.equal(result.length,1048576);
});
test('billing/webhook stream limits are enforced before any JSON or signature parse',()=>{
 const billing=readFileSync(new URL('../supabase/functions/essential-billing/index.ts',import.meta.url),'utf8');
 const webhook=readFileSync(new URL('../supabase/functions/essential-stripe-webhook/index.ts',import.meta.url),'utf8');
 assert.match(billing,/readLimitedUtf8Request\(req,4096\)/);
 assert.match(billing,/m==='BODY_TOO_LARGE'\)return response\(413/);
 assert.ok(billing.indexOf('readLimitedUtf8Request(req,4096)')<billing.indexOf('JSON.parse(raw)'));
 assert.match(webhook,/readLimitedUtf8Request\(req,1048576\)/);
 assert.match(webhook,/new Response\('TOO_LARGE',\{status:413\}\)/);
 assert.ok(webhook.indexOf('readLimitedUtf8Request(req,1048576)')<webhook.indexOf('verifyStripeSignature(raw'));
 assert.doesNotMatch(billing,/await req\.text\(\)/);
 assert.doesNotMatch(webhook,/await req\.text\(\)/);
});
