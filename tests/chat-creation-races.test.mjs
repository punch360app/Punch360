import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
const source=app.match(/function chatCreationStillCurrent\([\s\S]*?\n\/\/ Auth Google et Apple/)?.[0].replace(/\n\/\/ Auth Google et Apple$/,'');
assert.ok(source,'Load the real group and private chat creation handlers');

function deferred(){
 let resolve;
 const promise=new Promise(r=>{resolve=r;});
 return {promise,resolve};
}

function harness({privateTeam=false,loadData}={}){
 let tenant='company-A';
 const request=deferred(),calls=[],errors=[],notices=[],loaded=[],draws=[];
 const button={
  isConnected:true,disabled:false,busy:false,
  setAttribute(name,value){if(name==='aria-busy')this.busy=value;},
  removeAttribute(name){if(name==='aria-busy')this.busy=false;}
 };
 const state={
  user:{id:'person-1'},chatId:null,section:privateTeam?'messages':'sub',
  sub:privateTeam?'':'group',creatingConversation:false,messages:[],
  teamList:[{id:'team-1',lead_user_id:'person-1'}]
 };
 const context={
  state,company:()=>tenant,isEssential:()=>false,essentialMessagesAllowed:()=>true,
  $val:()=> 'Groupe de test',
  document:{
   querySelector:()=>button,
   querySelectorAll:()=>[{value:'person-2'},{value:'person-3'}]
  },
  sb:{rpc:(name,params)=>{calls.push({name,params});return request.promise;}},
  loadData:loadData||(()=>{loaded.push('data');}),
  loadChat:async id=>{loaded.push(id);},
  draw:()=>{draws.push('draw');},
  toast:value=>{notices.push(value);},
  error:err=>{errors.push(err);}
 };
 const api=runInNewContext(source+'\n({createGroup,privateChat})',context);
 return {api,state,button,request,calls,errors,notices,loaded,draws,switchCompany:value=>{tenant=value;}};
}

test('Double-click creates one group and unlocks the button after success',async()=>{
 const h=harness();
 const first=h.api.createGroup(),second=h.api.createGroup();
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].name,'create_company_group');
 assert.equal(h.calls[0].params.p_company,'company-A');
 assert.equal(h.button.disabled,true);
 assert.equal(h.button.busy,'true');
 h.request.resolve({data:'chat-1'});
 await Promise.all([first,second]);
 assert.equal(h.state.chatId,'chat-1');
 assert.equal(h.state.section,'messages');
 assert.deepEqual(h.draws,['draw']);
 assert.equal(h.button.disabled,false);
 assert.equal(h.button.busy,false);
 assert.equal(h.state.creatingConversation,false);
});

test('Late group RPC from previous company never changes navigation',async()=>{
 const h=harness();
 const pending=h.api.createGroup();
 h.switchCompany('company-B');
 h.request.resolve({data:'chat-A'});
 await pending;
 assert.equal(h.state.chatId,null);
 assert.equal(h.state.section,'sub');
 assert.deepEqual(h.draws,[]);
 assert.deepEqual(h.loaded,[]);
 assert.equal(h.button.disabled,false);
});

test('Failed group RPC restores controls and allows retry',async()=>{
 const h=harness();
 const pending=h.api.createGroup();
 h.request.resolve({error:{message:'test error'}});
 await pending;
 assert.equal(h.errors.length,1);
 assert.equal(h.state.creatingConversation,false);
 assert.equal(h.button.disabled,false);
 assert.equal(h.state.chatId,null);
});

test('Private team chat rejects duplicate taps and late company switch',async()=>{
 const h=harness({privateTeam:true});
 const first=h.api.privateChat(),second=h.api.privateChat();
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].name,'create_private_team_chat');
 assert.equal(h.calls[0].params.p_team,'team-1');
 h.switchCompany('company-B');
 h.request.resolve({data:'private-A'});
 await Promise.all([first,second]);
 assert.equal(h.state.chatId,null);
 assert.deepEqual(h.loaded,[]);
 assert.deepEqual(h.draws,[]);
 assert.equal(h.button.disabled,false);
});

test('Leaving the group form before RPC returns must not hijack the current page',async()=>{
 const h=harness();
 const pending=h.api.createGroup();
 h.state.sub='profile';
 h.request.resolve({data:'chat-1'});
 await pending;
 assert.equal(h.state.sub,'profile');
 assert.equal(h.state.chatId,null);
 assert.deepEqual(h.draws,[]);
});

test('Switching companies while group refresh is pending must not open stale group',async()=>{
 const refresh=deferred();
 const h=harness({loadData:()=>refresh.promise});
 const pending=h.api.createGroup();
 h.request.resolve({data:'chat-1'});
 await Promise.resolve();await Promise.resolve();
 h.switchCompany('company-B');
 refresh.resolve();
 await pending;
 assert.equal(h.state.chatId,null);
 assert.deepEqual(h.draws,[]);
 assert.equal(h.button.disabled,false);
});
