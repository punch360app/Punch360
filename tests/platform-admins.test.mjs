import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformAdminsController} from '../web/live/platform-admins.js';
const root={id:'11111111-1111-4111-8111-111111111111',email:'root@example.invalid',role:'root',mfa_ready:true};
const alice={id:'22222222-2222-4222-8222-222222222222',email:'alice@example.invalid',role:'delegate',mfa_ready:false};
const bob={id:'33333333-3333-4333-8333-333333333333',email:'bob@example.invalid',role:'delegate',mfa_ready:true};
const esc=v=>String(v??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
function create({isRoot=true,items=[root],prompt=()=>null,fail=false}={}){
 const calls=[],notices=[];let failed=fail;
 const sb={async rpc(name,args){
  calls.push({name,args});
  if(failed)return {error:failed===true?{code:'42501',message:'Session MFA refusée'}:failed};
  if(name==='platform_admin_members')return{data:{max:3,count:items.length,is_root:isRoot,items}};
  if(name==='platform_admin_add'){
   assert.equal(args.p_confirmation,'AJOUTER alice@example.invalid');
   items=[...items,alice];
   return{data:{max:3,count:items.length,is_root:true,items}};
  }
  if(name==='platform_admin_remove'){
   items=items.filter(x=>x.id!==args.p_user);
   return{data:{max:3,count:items.length,is_root:true,items}};
  }
  throw Error('unexpected rpc '+name);
 }};
 const ctrl=createPlatformAdminsController({sb,redraw(){},escape:esc,prompt,notify:x=>notices.push(x)});
 return{ctrl,calls,notices,setError:(value=true)=>{failed=value}};
}
function submit(ctrl,email='alice@example.invalid',confirmation='AJOUTER alice@example.invalid',
 reason='Accès confirmé par propriétaire de PUNCH'){
 ctrl.input({id:'platform-admin-email',value:email});
 ctrl.input({id:'platform-admin-confirm',value:confirmation});
 ctrl.input({id:'platform-admin-reason',value:reason});
}
test('root explicitly confirms a second Super Admin after an MFA-scoped list',async()=>{
 const {ctrl,calls,notices}=create();
 assert.equal(await ctrl.load(),true);
 assert.match(ctrl.render(),/1 \/ 3/);
 submit(ctrl);
 await ctrl.handle({dataset:{action:'platform-admin:add'}});
 assert.deepEqual(calls.map(x=>x.name),['platform_admin_members','platform_admin_add']);
 assert.equal(calls[1].args.p_email,'alice@example.invalid');
 assert.equal(ctrl.state.items.length,2);
 assert.match(ctrl.render(),/MFA à configurer/);
 assert.match(notices.join(' '),/Compte Super Admin autorisé/);
 assert.equal(ctrl.state.email,'');
});
test('missing typed confirmation or justification performs no grant',async()=>{
 const {ctrl,calls}=create();await ctrl.load();
 submit(ctrl,'alice@example.invalid','wrong');
 await ctrl.handle({dataset:{action:'platform-admin:add'}});
 assert.equal(calls.length,1);assert.match(ctrl.state.error,/AJOUTER/);
 submit(ctrl,'alice@example.invalid','AJOUTER alice@example.invalid','short');
 await ctrl.handle({dataset:{action:'platform-admin:add'}});
 assert.equal(calls.length,1);assert.match(ctrl.state.error,/Motif/);
});
test('delegate has all operational platform access but cannot manage memberships',async()=>{
 const {ctrl,calls}=create({isRoot:false,items:[root,alice]});await ctrl.load();
 submit(ctrl);await ctrl.handle({dataset:{action:'platform-admin:add'}});
 assert.equal(calls.length,1);
 assert.doesNotMatch(ctrl.render(),/Autoriser un Super Admin/);
 assert.match(ctrl.state.error,/propriétaire principal/);
});
test('full 3/3 board rejects fourth account',async()=>{
 const {ctrl,calls}=create({items:[root,alice,bob]});
 await ctrl.load();submit(ctrl);
 await ctrl.handle({dataset:{action:'platform-admin:add'}});
 assert.equal(calls.length,1);assert.match(ctrl.state.error,/trois/);
 assert.match(ctrl.render(),/3 \/ 3/);
});
test('root removal only accepts typed confirmation of a secondary account',async()=>{
 let text='invalid';
 const {ctrl,calls}=create({items:[root,alice],prompt:()=>text});await ctrl.load();
 submit(ctrl);
 await ctrl.handle({dataset:{action:'platform-admin:remove',id:root.id}});
 assert.equal(calls.length,1);
 await ctrl.handle({dataset:{action:'platform-admin:remove',id:alice.id}});
 assert.equal(calls.length,1);
 text='RETIRER alice@example.invalid';
 await ctrl.handle({dataset:{action:'platform-admin:remove',id:alice.id}});
 assert.equal(calls.length,2);
 assert.equal(calls[1].args.p_user,alice.id);
 assert.equal(ctrl.state.items.length,1);
});
test('permission loss clears potentially sensitive directory and reset clears forms',async()=>{
 const x=create({items:[root,alice]});await x.ctrl.load();
 x.setError();await x.ctrl.load();
 assert.equal(x.ctrl.state.items.length,0);
 assert.equal(x.ctrl.state.loaded,false);
 assert.match(x.ctrl.render(),/Accès expiré ou refusé/);
 assert.doesNotMatch(x.ctrl.render(),/Session MFA refusée/);
 submit(x.ctrl);x.ctrl.reset();
 assert.equal(x.ctrl.state.reason,'');
 assert.equal(x.ctrl.state.email,'');
});
test('untrusted email escaped in render and malformed membership responses fail closed',async()=>{
 const x=create({items:[root,{...alice,email:'<script>alert(1)</script>'}]});
 await x.ctrl.load();const html=x.ctrl.render();
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 const s=create({items:[root,alice,bob,bob]});
 assert.equal(await s.ctrl.load(),false);
 assert.deepEqual(s.ctrl.state.items,[]);
});

test('main Web event dispatcher routes new platform-admin actions to their controller',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(source,/if\(a\.startsWith\('platform-admin:'\)\)\{await essentialUI\.platformAdmins\.handle\(el\);return;\}/);
 const idx=source.indexOf("if(a.startsWith('platform-admin:'))");
 const general=source.indexOf("if(a.startsWith('ess:'))");
 assert.ok(idx>0&&general>idx,'Platform buttons must dispatch before generic Essentiel routing');
});


test('HTTP 401 and 403 always revoke previously visible Super Admin list without leaking diagnostics',async()=>{
 for(const status of [401,'403']){
  const x=create({items:[root,alice]});
  await x.ctrl.load();
  assert.match(x.ctrl.render(),/alice@example.invalid/);
  submit(x.ctrl);
  x.setError({status,message:'internal backend account secret'});
  assert.equal(await x.ctrl.load(),false);
  assert.equal(x.ctrl.state.loaded,false);
  assert.equal(x.ctrl.state.isRoot,false);
  assert.deepEqual(x.ctrl.state.items,[]);
  assert.equal(x.ctrl.state.email,'');
  assert.equal(x.ctrl.state.confirmation,'');
  assert.equal(x.ctrl.state.reason,'');
  assert.doesNotMatch(x.ctrl.render(),/alice@example.invalid|root@example.invalid|backend account secret/);
  assert.match(x.ctrl.render(),/Reconnectez-vous avec MFA/);
 }
});

test('authorization denied during an add removes all previous memberships and controls',async()=>{
 const x=create({items:[root,alice]});await x.ctrl.load();
 submit(x.ctrl,'nobody@example.invalid','AJOUTER nobody@example.invalid');
 x.setError({status:403,message:'private SQL owner details'});
 await x.ctrl.handle({dataset:{action:'platform-admin:add'}});
 assert.deepEqual(x.ctrl.state.items,[]);
 assert.equal(x.ctrl.state.loaded,false);
 assert.equal(x.ctrl.state.isRoot,false);
 assert.equal(x.ctrl.state.reason,'');
 assert.doesNotMatch(x.ctrl.render(),/root@example.invalid|alice@example.invalid|private SQL|Autoriser un Super Admin/);
 assert.match(x.ctrl.render(),/Reconnectez-vous avec MFA/);
});

test('refresh hides stale Super Admin names immediately, even while server reply is pending',async()=>{
 let release;
 const waiting=new Promise(resolve=>{release=resolve});
 let calls=0;
 const sb={rpc:async()=>{
  calls++;
  if(calls===1)return {data:{max:3,count:2,is_root:true,items:[root,alice]}};
  await waiting;
  return {error:{status:503,message:'private database unavailable'}};
 }};
 const ctrl=createPlatformAdminsController({sb,redraw(){},escape:esc});
 await ctrl.load();
 assert.match(ctrl.render(),/alice@example.invalid/);
 const pending=ctrl.load();
 assert.equal(ctrl.state.busy,true);
 assert.equal(ctrl.state.loaded,false);
 assert.deepEqual(ctrl.state.items,[]);
 assert.doesNotMatch(ctrl.render(),/alice@example.invalid/);
 release();await pending;
 assert.doesNotMatch(ctrl.render(),/private database unavailable/);
 assert.match(ctrl.render(),/Impossible de vérifier les accès Super Admin/);
});
