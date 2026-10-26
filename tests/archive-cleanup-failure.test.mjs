import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto as crypto} from 'node:crypto';
import {createArchivesController} from '../web/live/archives.js';

test('Close wipes decrypted archive and PDF content even when server copy disposal fails',async()=>{
 const company='11111111-1111-4111-8111-111111111111',called=[];
 let fail=true,redraws=0;
 const password={value:'never-keep-this-password'};
 const sb={rpc:async(name,args)=>{
  called.push({name,args});
  if(name==='company_archive_pending')return {data:[{id:'opaque-copy-id'}]};
  if(name==='company_export_discard')return fail?{error:{message:'synthetic remote temporary failure'}}:{data:true};
  throw Error('Unexpected RPC '+name);
 }};
 const ui=createArchivesController({sb,redraw:()=>redraws++,escape:String,crypto,document:{getElementById:id=>id==='archive-password'?password:null}});
 ui.reset(company);
 Object.assign(ui.state,{
  summary:{company_name:'Private fixture',rows:1,documents:1,exported_at:'2026-10-26'},
  header:{id:'opaque-copy-id'},archive:{payload_text:'SENSITIVE FICTIVE DATA'},
  files:[{data:'UERG',status:'missing'}],plan:{company_name:'Private fixture'},
  reason:'test only',confirmation:'Private fixture',restoreRequest:'random-test-request'
 });
 const result=await ui.handle({dataset:{action:'archive:close'}});
 assert.equal(result,true);
 assert.equal(ui.state.error,'');
 assert.equal(ui.state.archive,null);
 assert.deepEqual(ui.state.files,[]);
 assert.equal(ui.state.plan,null);
 assert.equal(ui.state.header,null);
 assert.equal(ui.state.summary,null);
 assert.equal(ui.state.reason,'');
 assert.equal(ui.state.restoreRequest,null);
 assert.equal(ui.state.confirmation,'');
 assert.equal(password.value,'');
 assert.deepEqual(ui.state.cleanup,['opaque-copy-id'],'opaque copy ID remains available for retry');
 assert.match(ui.state.notice,/Copie serveur encore présente/);
 assert.ok(redraws>0);
 fail=false;
 await ui.handle({dataset:{action:'archive:close'}});
 assert.deepEqual(ui.state.cleanup,[]);
 assert.equal(ui.state.archive,null);
 assert.equal(ui.state.company,company);
 assert.equal(ui.state.notice,'');
 assert.equal(called.filter(x=>x.name==='company_export_discard').length,2);
});

test('Close also clears decrypted memory if pending-copy lookup itself fails',async()=>{
 const ui=createArchivesController({
  sb:{rpc:async()=>({error:{message:'synthetic failure'}})},redraw(){},escape:String,crypto,
  document:{getElementById:()=>({value:'secret phrase'})}
 });
 ui.reset('fixture-company');
 ui.state.archive={attachments:[{data:'secret pdf content'}]};
 ui.state.files=[{data:'secret pdf'}];ui.state.plan={plan_hash:'test'};
 await ui.handle({dataset:{action:'archive:close'}});
 assert.equal(ui.state.archive,null);
 assert.deepEqual(ui.state.files,[]);
 assert.equal(ui.state.plan,null);
 assert.ok(ui.state.error);
});
