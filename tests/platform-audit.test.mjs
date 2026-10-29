import test from 'node:test';import assert from 'node:assert/strict';import {createPlatformAuditController} from '../web/live/platform-audit.js';
const escape=s=>String(s??'').replaceAll('<','&lt;');
test('audit ignores late responses after logout including errors',async()=>{let release;const ui=createPlatformAuditController({sb:{rpc:()=>new Promise(r=>{release=r})},redraw(){},escape});const loading=ui.load();ui.reset();release({error:Error('Private detail')});await loading;assert.deepEqual(ui.state.rows,[]);assert.equal(ui.state.error,'')});
test('audit paging freezes filters and CSV neutralises formulas',async()=>{const calls=[];let exported;const rows=Array.from({length:100},(_,i)=>({id:String(i),created_at:'2026-10-25',action:i===0?'=1+2':'changed',detail:{a:'<test>'}}));const ui=createPlatformAuditController({sb:{rpc:async(name,args)=>{calls.push(args);return {data:calls.length===1?rows:[]}}},redraw(){},escape,download:s=>{exported=s}});await ui.load();ui.input({id:'audit-query',value:'new filter'});await ui.handle({dataset:{action:'audit:more'}});assert.equal(calls[1].p_query,'');assert.equal(calls[1].p_before_id,'99');assert.equal(ui.state.rows.length,100);await ui.handle({dataset:{action:'audit:export'}});assert.match(exported,/'=1\+2/);assert.match(ui.render(),/&lt;test>/)});

test('MFA revocation clears previously loaded private audit data and blocks export',async()=>{
 let deny=false,exported=null,fetches=0;
 const rows=Array.from({length:100},(_,i)=>({id:String(i),created_at:'2026-10-25T12:00:00Z',actor_id:'private-test-user',entity_id:'private-test-tenant',action:'private_event',detail:{token:'synthetic'}}));
 const ui=createPlatformAuditController({sb:{rpc:async()=>{fetches++;return deny?{error:{code:'42501',message:'SQL private tenant key'}}:{data:rows}}},redraw(){},escape,download:s=>exported=s});
 await ui.load();
 assert.equal(ui.state.rows.length,100);
 assert.equal(ui.state.more,true);
 deny=true;
 await ui.handle({dataset:{action:'audit:more'}});
 assert.deepEqual(ui.state.rows,[]);
 assert.equal(ui.state.more,false);
 assert.equal(ui.state.filters,null);
 assert.match(ui.state.error,/Reconnectez-vous avec MFA/);
 assert.doesNotMatch(ui.render(),/private-test-tenant|SQL private tenant key/);
 assert.match(ui.render(),/data-action="audit:export" disabled/);
 await ui.handle({dataset:{action:'audit:export'}});
 assert.ok(exported?.includes('Date'));
 assert.doesNotMatch(exported,/private-test-user|private-test-tenant/);
 assert.equal(fetches,2);
});

test('audit rejects malformed or reversed date filters before RPC',async()=>{
 let queries=0;
 const ui=createPlatformAuditController({sb:{rpc:async()=>{queries++;return {data:[]}}},redraw(){},escape});
 await ui.load();
 ui.input({id:'audit-from',value:'2026-10-29T00:00:00-04:00'});
 ui.input({id:'audit-until',value:'2026-10-27T00:00:00-04:00'});
 await ui.handle({dataset:{action:'audit:search'}});
 assert.equal(queries,1);
 assert.match(ui.state.error,/précéder/);
 ui.input({id:'audit-until',value:'not a date'});
 await ui.handle({dataset:{action:'audit:search'}});
 assert.equal(queries,1);
 assert.match(ui.state.error,/dates complètes/);
});

test('untrusted provider messages are not displayed, and unknown buttons do not trigger a search',async()=>{
 let calls=0;
 const ui=createPlatformAuditController({sb:{rpc:async()=>{calls++;return {error:{message:'raw server internal secret'}}}},redraw(){},escape});
 await ui.load();
 assert.match(ui.state.error,/Impossible de charger/);
 assert.doesNotMatch(ui.render(),/raw server internal secret/);
 await ui.handle({dataset:{action:'audit:unknown'}});
 assert.equal(calls,1);
 ui.reset();
 assert.equal(ui.state.error,'');
});
