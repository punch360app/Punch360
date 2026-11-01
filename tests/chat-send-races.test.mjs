import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
const match=app.match(/async function sendMessage\(\)\{[\s\S]*?\n\}\n\/\/ A single client request at a time/);
assert.ok(match,'Load the actual message sending handler');
const source=match[0].replace(/\n\/\/ A single client request at a time$/,'');

function deferred(){
 let resolve;
 const promise=new Promise(r=>{resolve=r;});
 return {promise,resolve};
}

function harness(){
 let tenant='company-A';
 const sent=deferred(),refreshed=deferred(),inserts=[],errors=[],draws=[];
 const input={value:'Bonjour'},main={scrollTop:0,scrollHeight:650};
 const state={sendingMessage:false,chatId:'chat-1',section:'messages',user:{id:'person-1'}};
 const drafts=new Map();
 const context={
  state,chatDrafts:drafts,
  chatDraftKey:(companyId,chatId)=>companyId+':'+chatId,
  saveChatDraft:()=>drafts.set(tenant+':'+state.chatId,input.value),
  company:()=>tenant,
  currentCompanyChat:chatId=>chatId==='chat-1',
  isEssential:()=>false,essentialMessagesAllowed:()=>true,
  $val:id=>id==='chatMessage'?input.value.trim():'',
  $:id=>id==='chatMessage'?input:id==='main'?main:null,
  sb:{from:table=>{
   assert.equal(table,'conversation_messages');
   return {insert:values=>{inserts.push(values);return sent.promise;}};
  }},
  loadChat:async()=>refreshed.promise,
  draw:()=>draws.push('draw'),
  error:err=>errors.push(err)
 };
 const api=runInNewContext(source+'\n({sendMessage})',context);
 return {api,state,input,main,drafts,sent,refreshed,inserts,errors,draws,switchCompany:id=>{tenant=id;}};
}

test('An acknowledged message draws once and clears only the sent draft',async()=>{
 const h=harness();
 const first=h.api.sendMessage(),second=h.api.sendMessage();
 assert.equal(h.inserts.length,1,'concurrent taps must not duplicate insertion');
 assert.equal(h.inserts[0].company_id,'company-A');
 assert.equal(h.inserts[0].conversation_id,'chat-1');
 h.sent.resolve({error:null});
 await Promise.resolve();
 h.refreshed.resolve();
 await Promise.all([first,second]);
 assert.equal(h.input.value,'');
 assert.equal(h.drafts.has('company-A:chat-1'),false);
 assert.deepEqual(h.draws,['draw']);
 assert.equal(h.main.scrollTop,650);
 assert.equal(h.state.sendingMessage,false);
});

test('A finished refresh cannot redraw a different company',async()=>{
 const h=harness(),pending=h.api.sendMessage();
 h.sent.resolve({error:null});
 await Promise.resolve();await Promise.resolve();
 h.switchCompany('company-B');
 h.refreshed.resolve();
 await pending;
 assert.deepEqual(h.draws,[]);
 assert.equal(h.main.scrollTop,0);
 assert.equal(h.state.sendingMessage,false);
});

test('Leaving the conversation while the refresh is pending cannot redraw the new page',async()=>{
 const h=harness(),pending=h.api.sendMessage();
 h.sent.resolve({error:null});
 await Promise.resolve();await Promise.resolve();
 h.state.section='home';
 h.refreshed.resolve();
 await pending;
 assert.deepEqual(h.draws,[]);
 assert.equal(h.main.scrollTop,0);
});

test('New text typed while sending is never cleared by an old acknowledgement',async()=>{
 const h=harness(),pending=h.api.sendMessage();
 h.input.value='Un autre message';
 h.drafts.set('company-A:chat-1','Un autre message');
 h.sent.resolve({error:null});
 await Promise.resolve();
 h.refreshed.resolve();
 await pending;
 assert.equal(h.input.value,'Un autre message');
 assert.equal(h.drafts.get('company-A:chat-1'),'Un autre message');
 assert.equal(h.draws.length,1);
});

test('An insertion failure retains the draft, unlocks the action and avoids redraw',async()=>{
 const h=harness(),pending=h.api.sendMessage();
 h.sent.resolve({error:{message:'network unavailable'}});
 await pending;
 assert.equal(h.errors.length,1);
 assert.equal(h.state.sendingMessage,false);
 assert.equal(h.input.value,'Bonjour');
 assert.equal(h.drafts.get('company-A:chat-1'),'Bonjour');
 assert.deepEqual(h.draws,[]);
});
