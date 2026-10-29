import test from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';import {createSupportController} from '../web/live/support.js';
const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
test('late support responses cannot restore a thread after logout',async()=>{let release;const ui=createSupportController({sb:{rpc:()=>new Promise(r=>{release=r})},redraw(){},escape});const loading=ui.load('company');ui.reset();release({data:[{id:'private-ticket'}]});await loading;assert.deepEqual(ui.state.tickets,[]);assert.equal(ui.state.company,null)});
test('support retries preserve event identity and escape message HTML',async()=>{const w=new Window(),calls=[];let fail=true;const detail={id:'ticket',subject:'Test',version:1,status:'open',messages:[{body:'<script>bad</script>',created_at:'2026-10-25',is_platform:false}]};const ui=createSupportController({sb:{rpc:async(name,args)=>{calls.push({name,args});if(name==='support_create_ticket'&&fail){fail=false;return {error:Error('Network')}}return {data:name==='support_list_tickets'?[]:name==='support_create_ticket'?'ticket':detail}}},redraw(){},escape,document:w.document,crypto:{randomUUID:()=> 'stable-id'}});await ui.load('company');ui.input({id:'support-subject',value:'Question'});ui.input({id:'support-body',value:'Un problème'});await ui.handle({dataset:{action:'support:create'}});assert.equal(ui.state.body,'Un problème');await ui.handle({dataset:{action:'support:create'}});const writes=calls.filter(x=>x.name==='support_create_ticket');assert.equal(writes.length,2);assert.deepEqual(writes[0].args,writes[1].args);assert.match(ui.render(),/&lt;script&gt;/);assert.doesNotMatch(ui.render(),/<script>/);await w.happyDOM.close()});
test('support paging preserves company scope and cursor',async()=>{const calls=[];const list=Array.from({length:50},(_,i)=>({id:String(i),updated_at:'2026-10-25'}));const ui=createSupportController({sb:{rpc:async(name,args)=>{calls.push(args);return {data:calls.length===1?list:[]}}},redraw(){},escape});await ui.load('tenant');await ui.handle({dataset:{action:'support:more'}});assert.equal(calls[1].p_company,'tenant');assert.equal(calls[1].p_before_id,'49');assert.equal(ui.state.more,false);assert.equal(ui.state.tickets.length,50)});

test('Support PUNCH clears previously read private messages and tickets when access is revoked',async()=>{
 let deny=false;
 const ticket={id:'test-ticket',subject:'Dossier fictif privé',updated_at:'2026-10-28T15:00:00Z',status:'open'};
 const detail={...ticket,version:1,messages:[{id:'m1',body:'Message privé fictif',created_at:'2026-10-28T15:00:00Z',is_platform:false}]};
 const calls=[];
 const ui=createSupportController({sb:{rpc:async(name,args)=>{
  calls.push(name);
  if(deny)return {error:{code:'42501',message:'SECRET_INTERNAL_SUPPORT_SQL'}};
  return {data:name==='support_list_tickets'?[ticket]:detail};
 }},escape,redraw(){}});
 await ui.load('company-test');
 await ui.handle({dataset:{action:'support:open',id:'test-ticket'}});
 assert.match(ui.render(),/Message privé fictif/);
 deny=true;
 await ui.handle({dataset:{action:'support:refresh'}});
 assert.deepEqual(ui.state.tickets,[]);
 assert.equal(ui.state.detail,null);
 assert.equal(ui.state.more,false);
 assert.equal(ui.state.reply,'');
 assert.match(ui.render(),/Accès au support expiré/);
 assert.doesNotMatch(ui.render(),/Dossier fictif privé|Message privé fictif|SECRET_INTERNAL_SUPPORT_SQL/);
 assert.ok(calls.filter(x=>x==='support_list_tickets').length>=2);
});

test('Support PUNCH displays an accessible pending message and prevents duplicate sends',async()=>{
 let finish;let calls=0;
 const ui=createSupportController({sb:{rpc:async()=>{
  calls++;await new Promise(resolve=>{finish=resolve});
  return {data:[]};
 }},escape,redraw(){}});
 const loading=ui.load('company-test');
 assert.equal(ui.state.busy,false,'initial load is not a submitted action');
 finish();await loading;
 ui.input({id:'support-subject',value:'Test de support'});
 ui.input({id:'support-body',value:'Contenu fictif'});
 const pending=ui.handle({dataset:{action:'support:refresh'}});
 assert.equal(ui.state.busy,true);
 assert.match(ui.render(),/role="status"/);
 assert.match(ui.render(),/Vérification en cours/);
 assert.match(ui.render(),/data-action="support:refresh" data-id="" disabled/);
 assert.match(ui.render(),/id="support-subject"[^>]*disabled/);
 await ui.handle({dataset:{action:'support:refresh'}});
 assert.equal(calls,2);
 finish();await pending;
 assert.equal(ui.state.busy,false);
 assert.doesNotMatch(ui.render(),/Vérification en cours/);
 assert.equal(ui.state.subject,'Test de support');
 assert.equal(ui.state.body,'Contenu fictif');
});

test('Support PUNCH does not show provider diagnostics or query on unknown action',async()=>{
 let calls=0;
 const ui=createSupportController({sb:{rpc:async()=>{
  calls++;return {error:{message:'DATABASE SUPPORT PRIVATE TOKEN'}};
 }},escape,redraw(){}});
 await ui.load('company-test',true);
 assert.match(ui.render(),/Impossible de charger ou modifier les demandes/);
 assert.doesNotMatch(ui.render(),/DATABASE SUPPORT PRIVATE TOKEN/);
 await ui.handle({dataset:{action:'support:not-an-action'}});
 assert.equal(calls,1);
});

test('Support PUNCH rejects malformed list and invalid status actions without writing',async()=>{
 let writes=0;
 const ui=createSupportController({sb:{rpc:async(name)=>{
  if(name==='support_set_status')writes++;
  return {data:name==='support_list_tickets'?{}:null};
 }},escape,redraw(){}});
 await ui.load('company-test');
 assert.deepEqual(ui.state.tickets,[]);
 assert.match(ui.state.error,/Impossible de charger/);
 await ui.handle({dataset:{action:'support:status',id:'unexpected'}});
 assert.equal(writes,0);
 assert.match(ui.state.error,/Sélectionnez une demande ouverte/);
});
