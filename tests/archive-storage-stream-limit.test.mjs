import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createArchiveFilesHandler} from '../supabase/functions/company-archive-files/handler.mjs';

const URL='https://mlabstdxxwjdpfaxiwmg.supabase.co';
const ORIGIN='https://punch360app.github.io';
const LIMIT=25*1024*1024;
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
const sha=async bytes=>Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');

function setup({action='download',contentLength=null,totalChunks=26}={}){
 const calls=[],chunk=new Uint8Array(1024*1024);
 let reads=0,cancelled=false,proofs=0;
 const pdf=new TextEncoder().encode('%PDF-1.4\nSynthetic\n%%EOF');
 const stream=new ReadableStream({
  pull(controller){reads++;if(reads>totalChunks){controller.close();return;}controller.enqueue(chunk);},
  cancel(){cancelled=true;}
 },{highWaterMark:0});
 const fetch=async(url,options={})=>{
  calls.push({url:String(url),method:options.method||'GET'});
  if(String(url).endsWith('/auth/v1/user'))return json({id:'synthetic-user'});
  if(String(url).includes('/rpc/company_archive_file_context'))
   return json({kind:action==='download'?'export':'import',file:{exists:true,size:pdf.length,mimetype:'application/pdf'}});
  if(String(url).includes('/rpc/company_archive_file_proof')){proofs++;return json('synthetic-signature');}
  if(String(url).includes('/storage/v1/object/')){
   const headers=contentLength==null?{}:{'Content-Length':String(contentLength)};
   return new Response(stream,{status:200,headers});
  }
  throw Error('Unexpected mock route: '+url);
 };
 const handler=createArchiveFilesHandler({
  env:name=>({SUPABASE_URL:URL,SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-server'})[name],
  fetch,crypto:webcrypto
 });
 async function run(){
  const hash=await sha(pdf);
  const body={action,id:'synthetic-export',bucket:'job-documents',path:'company/test.pdf',
   ...(action==='download'?{}:{data:Buffer.from(pdf).toString('base64'),sha256:hash,signature:'synthetic-signature'})};
  const req=new Request(URL+'/functions/v1/company-archive-files',{method:'POST',
   headers:{Authorization:'Bearer synthetic-user',Origin:ORIGIN,'Content-Type':'application/json'},
   body:JSON.stringify(body)});
  const res=await handler(req);return {status:res.status,result:await res.json()};
 }
 return {run,calls,get reads(){return reads},get cancelled(){return cancelled},get proofs(){return proofs}};
}

test('download stream without Content-Length stops at 25 MiB instead of arrayBuffer buffering',async()=>{
 const h=setup({action:'download'});
 const {status,result}=await h.run();
 assert.equal(status,413);
 assert.equal(result.error,'DOCUMENT_TOO_LARGE');
 assert.ok(h.cancelled,'Storage stream must be cancelled');
 assert.ok(h.reads<=26,'Reader stops on first excess chunk');
 assert.equal(h.proofs,0,'Oversized data never reaches proof-signing RPC');
});

test('lying small Content-Length cannot bypass actual byte cap on restore preview',async()=>{
 const h=setup({action:'preview',contentLength:1});
 const {status,result}=await h.run();
 assert.equal(status,413);
 assert.equal(result.error,'DOCUMENT_TOO_LARGE');
 assert.ok(h.cancelled);
 assert.equal(h.calls.filter(x=>x.method==='POST'&&x.url.includes('/storage/v1/object/')).length,0);
});

test('Content-Length exceeding 25 MiB rejects before consuming the Storage stream',async()=>{
 const h=setup({action:'download',contentLength:LIMIT+1});
 const {status,result}=await h.run();
 assert.equal(status,413);
 assert.equal(result.error,'DOCUMENT_TOO_LARGE');
 assert.equal(h.reads,0);
 assert.equal(h.proofs,0);
});
