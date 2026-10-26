import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto as crypto} from 'node:crypto';
import {collectArchiveChunks,MAX_ARCHIVE_CHUNKS,MAX_ARCHIVE_PAYLOAD_BYTES} from '../web/live/archive-preflight.js';
import {createArchivesController} from '../web/live/archives.js';

const company='11111111-1111-4111-8111-111111111111';
const password='a-valid-archive-password';
const escape=s=>String(s??'').replaceAll('<','&lt;');

test('chunk collector validates count before any remote call',async()=>{
 let calls=0;
 for(const chunks of [0,-1,4097,NaN,Infinity,'2',1.5,Number.MAX_SAFE_INTEGER+1]){
  await assert.rejects(collectArchiveChunks({chunks,getChunk:async()=>{calls++;return 'x'}}),/nombre de blocs/);
 }
 assert.equal(calls,0);
 assert.equal(MAX_ARCHIVE_CHUNKS,4096);
 assert.equal(MAX_ARCHIVE_PAYLOAD_BYTES,20*1024*1024);
});

test('chunk collector rejects missing strings and oversized output before requesting more blocks',async()=>{
 await assert.rejects(collectArchiveChunks({chunks:1,getChunk:async()=>null}),/bloc manquant/);
 let calls=0;
 await assert.rejects(collectArchiveChunks({
  chunks:4,maxBytes:10,getChunk:async()=>{calls++;return '123456'}
 }),/trop volumineuse/);
 assert.equal(calls,2,'no further chunk RPC after aggregate limit');
});

test('UTF-8 cap works with a surrogate pair split between chunks',async()=>{
 const parts=['😀'.slice(0,1),'😀'.slice(1)];
 assert.equal(await collectArchiveChunks({chunks:2,maxBytes:4,getChunk:async i=>parts[i]}),'😀');
 await assert.rejects(collectArchiveChunks({chunks:2,maxBytes:3,getChunk:async i=>parts[i]}),/trop volumineuse/);
});

function archiveUI({header,chunk,payload}){
 const calls=[],pw={value:password};
 let downloaded=false,functions=0;
 const sb={
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='company_export_create')return {data:{id:'ephemeral-id',chunks:1,...header}};
   if(name==='company_export_chunk')return {data:chunk??payload};
   if(name==='company_export_discard')return {data:true};
   return {error:{message:'Do not show internal database state'}};
  },
  functions:{invoke:async()=>{functions++;return {error:{message:'SECRET INTERNAL STORAGE STACK TRACE'}}}}
 };
 const ui=createArchivesController({
  sb,redraw(){},escape,crypto,
  document:{getElementById:id=>id==='archive-password'?pw:null},
  download:()=>{downloaded=true}
 });
 ui.reset(company);ui.input({id:'archive-reason',value:'Test archive failure'});
 return {ui,pw,calls,get downloaded(){return downloaded},get functions(){return functions}};
}

test('UI discards ephemeral export when header count is out of bounds',async()=>{
 const h=archiveUI({header:{chunks:MAX_ARCHIVE_CHUNKS+1}});
 await h.ui.handle({dataset:{action:'archive:export'}});
 assert.match(h.ui.state.error,/nombre de blocs/);
 assert.equal(h.calls.filter(c=>c.name==='company_export_chunk').length,0);
 assert.equal(h.calls.filter(c=>c.name==='company_export_discard').length,1);
 assert.equal(h.downloaded,false);
 assert.equal(h.pw.value,'');
});

test('UI rejects untrusted file lengths without invoking private file handler',async()=>{
 for(const size of [-1,NaN,Infinity,25*1024*1024+1,'not-a-number']){
  const h=archiveUI({payload:JSON.stringify({files:[{exists:true,required:true,size}]})});
  await h.ui.handle({dataset:{action:'archive:export'}});
  assert.match(h.ui.state.error,/Taille de document invalide/);
  assert.equal(h.functions,0);
  assert.equal(h.downloaded,false);
  assert.equal(h.calls.filter(c=>c.name==='company_export_discard').length,1);
 }
});

test('UI hides raw Storage errors and still cleans up temporary export',async()=>{
 const payload=JSON.stringify({files:[{
  bucket:'job-documents',path:company+'/job/document.pdf',exists:true,size:12
 }]});
 const h=archiveUI({payload});
 await h.ui.handle({dataset:{action:'archive:export'}});
 assert.match(h.ui.state.error,/Document inaccessible ou opération refusée/);
 assert.doesNotMatch(h.ui.state.error,/SECRET|STACK|TRACE|STORAGE/);
 assert.equal(h.functions,1);
 assert.equal(h.calls.filter(c=>c.name==='company_export_discard').length,1);
 assert.equal(h.pw.value,'');
 assert.equal(h.downloaded,false);
});
