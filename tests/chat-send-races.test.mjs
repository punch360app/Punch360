import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
const match=app.match(/async function sendMessage\(\)\{[\s\S]*?\n\}\n\/\/ A single client request at a time/);
assert.ok(match,'Load the actual message sending handler');
const source=match[0].replace(/\n\/\/ A single client request at a time$/,'');

function deferred(){
 let resolve,reject;
 const promise=new Promise((r,j)=>{resolve=r;reject=j;});
 return {promise,resolve,reject};
}

function harness(){
 let tenant='company-A';
 const sent=deferred(),refreshed=deferred(),inserts=[],errors=[],draws=[],toasts=[];
 const input={value:'Bonjour'},main={scrollTop:0,scrollHeight:650};
 const button={isConnected:true,disabled:false,busy:false,
  setAttribute(name,value){if(name==='aria-busy')this.busy=value;},
  removeAttribute(name){if(name==='aria-busy')this.busy=false;}
 };
 let activeButton=button;
 const state={sendingMessage:false,chatId:'chat-1',section:'messages',user:{id:'person-1'}};
 const drafts=new Map();
 const context={
  state,chatDrafts:drafts,document:{querySelector:()=>activeButton},
  chatDraftKey:(companyId,chatId)=>companyId+':'+chatId,
  saveChatDraft:()=>drafts.set(tenant+':'+state.chatId,input.value),
  company:()=>tenant,
  currentCompanyChat:chatId=>chatId==='chat-1'||chatId==='chat-2',
  isEssential:()=>false,essentialMessagesAllowed:()=>true,
  $val:id=>id==='chatMessage'?input.value.trim():'',
  $:id=>id==='chatMessage'?input:id==='main'?main:null,
  sb:{from:table=>{
   assert.equal(table,'conversation_messages');
   return {insert:values=>{inserts.push(values);return sent.promise;}};
  }},
  loadChat:async()=>refreshed.promise,
  draw:()=>draws.push('draw'),
  error:err=>errors.push(err),
  toast:message=>toasts.push(message)
 };
 const api=runInNewContext(source+'\n({sendMessage})',context);
 return {api,state,input,main,button,drafts,sent,refreshed,inserts,errors,draws,toasts,switchCompany:id=>{tenant=id;},replaceButton:()=>{button.isConnected=false;activeButton={...button,isConnected:true,disabled:true,busy:'true'};return activeButton;}};
}

test('An acknowledged message draws once and clears only the sent draft',async()=>{
 const h=harness();
 const first=h.api.sendMessage(),second=h.api.sendMessage();
 assert.equal(h.inserts.length,1,'concurrent taps must not duplicate insertion');
 assert.equal(h.button.disabled,true,'send button must lock while request is pending');
 assert.equal(h.button.busy,'true','pending request must be exposed as aria-busy');
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

test('Failed send restores button availability for a retry',async()=>{
 const h=harness(),pending=h.api.sendMessage();
 assert.equal(h.button.disabled,true);
 h.sent.resolve({error:{message:'network unavailable'}});
 await pending;
 assert.equal(h.button.disabled,false);
 assert.equal(h.button.busy,false);
 assert.equal(h.state.sendingMessage,false);
 assert.equal(h.drafts.get('company-A:chat-1'),'Bonjour');
});

test('A failed send from the previous company never displays its error in the new company',async()=>{
 const h=harness(),pending=h.api.sendMessage();
 h.switchCompany('company-B');
 h.sent.resolve({error:{message:'private backend error from company-A'}});
 await pending;
 assert.deepEqual(h.errors,[]);
 assert.deepEqual(h.draws,[]);
 assert.equal(h.state.sendingMessage,false);
});

test('A failed send from a conversation left behind never alerts on another screen',async()=>{
 const h=harness(),pending=h.api.sendMessage();
 h.state.section='home';
 h.sent.resolve({error:{message:'late error'}});
 await pending;
 assert.deepEqual(h.errors,[]);
 assert.deepEqual(h.draws,[]);
});

test('Replaced send button is not mutated after a navigation during delivery',async()=>{
 const h=harness(),pending=h.api.sendMessage();
 h.button.isConnected=false;
 h.state.section='home';
 h.sent.resolve({error:null});
 await pending;
 assert.equal(h.button.disabled,true,'detached button should not be manipulated');
 assert.deepEqual(h.draws,[]);
});


test('A successful insert followed by a failed refresh is never reported as a failed send',async()=>{
 const h=harness(),pending=h.api.sendMessage();
 h.sent.resolve({error:null});
 await Promise.resolve();await Promise.resolve();
 h.refreshed.reject(new Error('Read failed after successful write'));
 await pending;
 assert.equal(h.errors.length,0,'a sent message must not be shown as a failed send');
 assert.equal(h.toasts.length,1);
 assert.match(h.toasts[0],/Message envoyé/);
 assert.equal(h.drafts.has('company-A:chat-1'),false);
 assert.equal(h.input.value,'');
 assert.equal(h.state.sendingMessage,false);
 assert.equal(h.button.disabled,false);
 assert.deepEqual(h.draws,[],'do not render stale messages after a failed refresh');
 assert.equal(h.inserts.length,1,'no retry of an acknowledged write');
});

test('A delayed refresh failure cannot alert after leaving the conversation',async()=>{
 const h=harness(),pending=h.api.sendMessage();
 h.sent.resolve({error:null});
 await Promise.resolve();await Promise.resolve();
 h.state.section='home';
 h.refreshed.reject(new Error('Old conversation read failed'));
 await pending;
 assert.deepEqual(h.errors,[]);
 assert.deepEqual(h.toasts,[]);
 assert.deepEqual(h.draws,[]);
 assert.equal(h.state.sendingMessage,false);
});


test('A replacement composer is unlocked after a send finishes in a previous conversation',async()=>{
 const h=harness(),pending=h.api.sendMessage();
 const nextButton=h.replaceButton();
 h.state.chatId='chat-2';
 h.sent.resolve({error:null});
 await pending;
 assert.equal(h.button.disabled,true,'the detached old button must not be touched');
 assert.equal(nextButton.disabled,false,'new conversation must become usable');
 assert.equal(nextButton.busy,false,'new button must not remain aria-busy');
 assert.equal(h.state.sendingMessage,false);
 assert.deepEqual(h.draws,[],'old send must not redraw new chat');
 assert.equal(h.inserts.length,1);
});

test('A stale send must not unlock a composer without active chat authorization',async()=>{
 const h=harness(),pending=h.api.sendMessage();
 const nextButton=h.replaceButton();
 h.state.chatId='unauthorized-chat';
 h.sent.resolve({error:null});
 await pending;
 assert.equal(nextButton.disabled,true,'unauthorized composer stays unavailable');
 assert.equal(nextButton.busy,'true');
 assert.deepEqual(h.draws,[]);
});
