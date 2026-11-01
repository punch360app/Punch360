import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCurrentCompanyChat} from '../web/live/company-chat-context.js';
const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
const base={companyId:'A',loadedCompanyId:'A',conversations:[{id:'chat-A',company_id:'A'}],chatId:'chat-A'};

test('Client accepts only a visible conversation for this company',()=>{
 assert.equal(isCurrentCompanyChat(base),true);
 for(const changed of [{companyId:'B'},{loadedCompanyId:'B'},{loadedCompanyId:null},
  {conversations:[{id:'chat-A',company_id:'B'}]},{conversations:[{id:'chat-B',company_id:'A'}]},
  {conversations:null},{chatId:'chat-B'},{chatId:''},{companyId:null}])
  assert.equal(isCurrentCompanyChat({...base,...changed}),false);
});
test('Chat requests and responses are scoped to verified current company and revision',()=>{
 assert.match(app,/function currentCompanyChat\(id\)/);
 assert.match(app,/state.conversationsCompany=companyId/);
 assert.match(app,/state.conversationsCompany=null/);
 assert.match(app,/state.chatLoadRevision\+\+/);
 assert.match(app,/\.eq\('company_id',companyId\)\.eq\('conversation_id',id\)/);
 assert.match(app,/if\(revision!==state.chatLoadRevision\|\|company\(\)!==companyId\|\|!currentCompanyChat\(id\)\)return/);
 assert.match(app,/if\(!currentCompanyChat\(state.chatId\)\)return/);
 assert.match(app,/if\(!currentCompanyChat\(id\)\)\{toast\('Conversation indisponible/);
 assert.match(app,/if\(state.chatId&&!currentCompanyChat\(state.chatId\)\)/);
});
