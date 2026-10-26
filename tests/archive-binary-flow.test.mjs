import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto as crypto} from 'node:crypto';
import {createArchivesController} from '../web/live/archives.js';
import {decryptArchive,sha256} from '../web/live/archive-codec.js';
import {createArchiveFilesHandler} from '../supabase/functions/company-archive-files/handler.mjs';

const COMPANY='11111111-1111-4111-8111-111111111111';
const PASSWORD='a-private-test-password';
const URL='https://mlabstdxxwjdpfaxiwmg.supabase.co';
const PATH=COMPANY+'/job/fixture.pdf';
const PDF=new TextEncoder().encode('%PDF-1.4\nTEST PUNCH archive PDF\n%%EOF');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});

async function mockArchiveHarness(){
 let stored=PDF,output=null,uploads=0;
 const actions=[],storageCalls=[],rpcCalls=[],notices=[];
 const payload={format:'punch-company-data',version:1,project:'mlabstdxxwjdpfaxiwmg',
  company_id:COMPANY,company_name:'Fixture Ltd',exported_at:'2026-10-26T12:00:00Z',
  collections:{'public.jobs':[{id:'fixture-job',company_id:COMPANY}]},
  files:[{bucket:'job-documents',path:PATH,size:PDF.byteLength,exists:true,required:true,mimetype:'application/pdf'}]};
 const payloadText=JSON.stringify(payload),hash=await sha256(payloadText,crypto),pdfHash=await sha256(PDF,crypto);
 const header={id:'export-123',company_id:COMPANY,sha256:hash,signature:'a'.repeat(64),key_id:'key-1',chunks:2};
 const fakeFetch=async(rawUrl,init={})=>{
  const u=String(rawUrl);
  if(u.endsWith('/auth/v1/user'))return json({id:'actor-123'});
  if(u.includes('/rest/v1/rpc/')){
   const name=u.split('/').pop(),args=JSON.parse(init.body);
   actions.push({name,args});
   if(name==='company_archive_file_context')
    return json({kind:args.p_id==='export-123'?'export':'import',file:{exists:true,size:PDF.byteLength,mimetype:'application/pdf'}});
   if(name==='company_archive_file_proof'){
    assert.equal(args.p_sha256,pdfHash);
    if(args.p_signature!==undefined)assert.equal(args.p_signature,'b'.repeat(64));
    return json('b'.repeat(64));
   }
   if(name==='company_archive_file_restored'){
    assert.equal(args.p_signature,'b'.repeat(64));
    return json(null);
   }
   throw Error('Unrecognized test RPC: '+name);
  }
  if(u.includes('/storage/v1/object/')){
   storageCalls.push({method:init.method||'GET',headers:init.headers});
   if(init.method==='POST'){
    assert.equal(init.headers['x-upsert'],'false','storage restoration must never overwrite existing PDFs');
    assert.equal(stored,null,'test must only restore missing binary objects');
    stored=new Uint8Array(init.body);uploads++;
    return json({Key:PATH});
   }
   return stored?new Response(stored,{status:200,headers:{'Content-Type':'application/pdf'}}):json({statusCode:'404'},400);
  }
  throw Error('Unexpected test transport: '+u);
 };
 const handler=createArchiveFilesHandler({env:name=>({
  SUPABASE_URL:URL,SUPABASE_ANON_KEY:'fixture-publishable',SUPABASE_SERVICE_ROLE_KEY:'fixture-server-only'
 })[name],fetch:fakeFetch,crypto});
 const sb={
  rpc:async(name,args)=>{
   rpcCalls.push({name,args});
   if(name==='company_export_create')return {data:header};
   if(name==='company_export_chunk'){
    assert.equal(args.p_id,header.id);
    return {data:args.p_index===0?payloadText.slice(0,Math.floor(payloadText.length/2)):payloadText.slice(Math.floor(payloadText.length/2))};
   }
   if(name==='company_archive_import'){
    assert.equal(args.p_payload,payloadText);
    assert.equal(args.p_signature,header.signature);
    return {data:{id:'import-456'}};
   }
   if(name==='company_restore_plan')return {data:{company_name:'Fixture Ltd',missing:1,conflicts:0,blocked:0,policy_skipped:0,plan_hash:'fixture-plan',tables:[{name:'public.jobs',restored:1,conflicts:0,blocked:0}]}};
   if(name==='company_restore_missing'){
    assert.ok(stored,'PDF must be present before restoring its database reference');
    assert.equal(args.p_plan_hash,'fixture-plan');
    assert.equal(args.p_confirmation,'Fixture Ltd');
    return {data:{restored:1}};
   }
   if(name==='company_archive_pending')return {data:[]};
   if(name==='company_export_discard')return {data:true};
   throw Error('Unexpected client RPC: '+name);
  },
  functions:{invoke:async(name,{body})=>{
   assert.equal(name,'company-archive-files');
   const req=new Request(URL+'/functions/v1/company-archive-files',{
    method:'POST',headers:{Authorization:'Bearer synthetic-user',Origin:'https://punch360app.github.io','Content-Type':'application/json'},
    body:JSON.stringify(body)
   });
   const res=await handler(req),data=await res.json();
   if(!res.ok)return {error:{message:'synthetic handler refused'},data};
   return {data,error:null};
  }}
 };
 const pw={value:PASSWORD};
 const selected={files:[]};
 const doc={getElementById:id=>id==='archive-password'?pw:id==='archive-file'?selected:null};
 const ui=createArchivesController({sb,redraw(){},escape,crypto,document:doc,download:(text,filename)=>{output={text,filename}}});
 ui.reset(COMPANY);ui.input({id:'archive-reason',value:'Test of archive recovery'});
 return {
  ui,pw,selected,rpcCalls,actions,storageCalls,notices,
  get output(){return output},get stored(){return stored},set stored(next){stored=next},
  get uploads(){return uploads}
 };
}

test('binary PDF archive flows through browser controller, Edge handler, mock Storage and restore without overwrite',async()=>{
 const h=await mockArchiveHarness();
 await h.ui.handle({dataset:{action:'archive:export'}});
 assert.equal(h.ui.state.error,'');
 assert.ok(h.output.filename.endsWith('.punch'));
 assert.equal(h.pw.value,'');
 assert.equal(h.ui.state.cleanup.length,0,'temporary export must be discarded after encrypted download');
 assert.equal(h.rpcCalls.filter(c=>c.name==='company_export_chunk').length,2);
 const decrypted=await decryptArchive(h.output.text,PASSWORD,crypto);
 assert.equal(decrypted.attachments.length,1);
 assert.equal(decrypted.attachments[0].path,PATH);
 assert.equal(h.actions.filter(x=>x.name==='company_archive_file_proof').length,1);
 assert.ok(!h.output.text.includes('Fixture Ltd'),'archive download must remain encrypted');
 // Simulate a lost private PDF in a test-only in-memory Storage.
 h.stored=null;
 h.pw.value=PASSWORD;
 h.selected.files=[{size:h.output.text.length,text:async()=>h.output.text}];
 await h.ui.handle({dataset:{action:'archive:inspect'}});
 assert.equal(h.ui.state.error,'');
 assert.equal(h.ui.state.summary.company_name,'Fixture Ltd');
 assert.equal(h.ui.state.files[0].status,'missing');
 assert.equal(h.uploads,0,'preview must be read-only');
 assert.equal(h.pw.value,'','inspect must not retain a password');
 await h.ui.handle({dataset:{action:'archive:files'}});
 assert.equal(h.ui.state.error,'');
 assert.equal(h.ui.state.files[0].status,'restored');
 assert.deepEqual(h.stored,PDF);
 assert.equal(h.uploads,1,'missing PDF restored exactly once');
 assert.equal(h.ui.state.result,null,'restoring a PDF must not commit business rows');
 h.ui.input({id:'archive-confirmation',value:'Fixture Ltd'});
 await h.ui.handle({dataset:{action:'archive:restore'}});
 assert.equal(h.ui.state.error,'');
 assert.equal(h.ui.state.result.restored,1);
 assert.equal(h.ui.state.header,null);
 assert.equal(h.ui.state.archive,null,'decrypted archive must be released after data restore');
 assert.ok(h.rpcCalls.some(c=>c.name==='company_restore_missing'));
 assert.ok(h.rpcCalls.some(c=>c.name==='company_export_discard'&&c.args.p_id==='import-456'));
});

test('wrong archive password blocks import and never calls server archive import',async()=>{
 const h=await mockArchiveHarness();
 await h.ui.handle({dataset:{action:'archive:export'}});
 h.pw.value='incorrect-fixture-passphrase';
 h.selected.files=[{size:h.output.text.length,text:async()=>h.output.text}];
 await h.ui.handle({dataset:{action:'archive:inspect'}});
 assert.match(h.ui.state.error,/incorrect|endommagée/i);
 assert.equal(h.pw.value,'');
 assert.equal(h.ui.state.archive,null);
 assert.equal(h.rpcCalls.filter(c=>c.name==='company_archive_import').length,0);
 assert.equal(h.uploads,0);
});
