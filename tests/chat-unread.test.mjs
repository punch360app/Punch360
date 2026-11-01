import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChatUnreadController} from '../web/live/chat-unread.js';
const sql=readFileSync(new URL('../supabase/migrations/20261101201000_chat_unread_receipts.sql',import.meta.url),'utf8');
test('Unread is company-scoped, capped at 99 and malformed values fail closed',async()=>{
 const calls=[];
 const c=createChatUnreadController({sb:{rpc:async(name,p)=>{calls.push({name,p});return {data:[
 {conversation_id:'one',unread:8},{conversation_id:'two',unread:222},
 {conversation_id:'bad',unread:-2},{conversation_id:'text',unread:'99'}]}}}});
 assert.equal(c.total(),0);await c.load('company-A');
 assert.equal(c.count('one'),8);assert.equal(c.count('two'),99);
 assert.equal(c.total(),99);assert.equal(c.count('bad'),0);
 assert.deepEqual(calls[0],{name:'chat_unread_counts',p:{p_company:'company-A'}});
 c.reset();assert.equal(c.total(),0);assert.equal(c.count('one'),0);
});
test('Stale company responses cannot restore another tenant unread badge',async()=>{
 let release;const deferred=new Promise(resolve=>{release=resolve;});
 const c=createChatUnreadController({sb:{rpc:async(_,p)=>p.p_company==='A'?deferred:{data:[{conversation_id:'B',unread:2}]}}});
 const old=c.load('A');await c.load('B');
 release({data:[{conversation_id:'A',unread:10}]});
 assert.equal(await old,false);assert.equal(c.state.company,'B');
 assert.equal(c.count('A'),0);assert.equal(c.count('B'),2);
});
test('Read receipt uses server message ID and refuses another company',async()=>{
 const calls=[];
 const c=createChatUnreadController({sb:{rpc:async(name,p)=>{calls.push({name,p});return name==='chat_unread_counts'?{data:[]}:{data:null};}}});
 await c.load('company-A');
 assert.equal(await c.mark('company-B','chat','msg'),false);
 assert.equal(await c.mark('company-A','chat',null),false);
 assert.equal(await c.mark('company-A','chat','msg'),true);
 assert.deepEqual(calls[1],{name:'chat_mark_read',p:{p_company:'company-A',p_conversation:'chat',p_message:'msg'}});
});
test('SQL uses private rights, not writable client cursor tables',()=>{
 assert.match(sql,/private\.company_chat_enabled\(p_company\)/);
 assert.match(sql,/private\.is_chat_member\(p_conversation\)/);
 assert.match(sql,/on conflict\(company_id,conversation_id,user_id\) do update/);
 assert.match(sql,/revoke all on public\.chat_read_cursors from public,anon,authenticated/);
 assert.match(sql,/m\.sender_id<>auth\.uid\(\)/);
});
