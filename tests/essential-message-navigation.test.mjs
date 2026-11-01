import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canUseEssentialMessages,essentialTabs} from '../web/live/essential-message-navigation.js';
const read=name=>readFileSync(new URL('../web/live/'+name,import.meta.url),'utf8');
const app=read('app.js'),planning=read('planning.js'),css=read('essential.css');
const ids=features=>essentialTabs({companyId:'A',entitlementCompanyId:'A',entitlement:{features}}).map(x=>x[0]);

test('CORE-001: four Basic tabs; Plus/Pro add a fifth Messages between Horaire and Plus',()=>{
 assert.deepEqual(ids([]),['home','hours','schedule','more']);
 assert.deepEqual(ids(['hours','punch']),['home','hours','schedule','more']);
 assert.deepEqual(ids(['messages']),['home','hours','schedule','messages','more']);
 assert.deepEqual(ids(['advanced_schedules','messages']),['home','hours','schedule','messages','more']);
 assert.deepEqual(ids(['messages','messages']),['home','hours','schedule','messages','more']);
});
test('Missing, foreign or malformed tenant entitlement never exposes Messages',()=>{
 for(const entitlement of [null,undefined,{}, {features:'messages'},{features:['MESSAGES']}])
  assert.equal(canUseEssentialMessages('A','A',entitlement),false);
 assert.equal(canUseEssentialMessages('A','B',{features:['messages']}),false);
 assert.equal(canUseEssentialMessages(null,'A',{features:['messages']}),false);
 assert.equal(canUseEssentialMessages('A','A',{features:['messages']}),true);
 assert.deepEqual(essentialTabs({companyId:'B',entitlementCompanyId:'A',entitlement:{features:['messages']}}).map(x=>x[0]),['home','hours','schedule','more']);
});
test('Shared app guards Essential routes, chat actions and stale company access',()=>{
 assert.match(app,/function essentialMessagesAllowed\(\)/);
 assert.match(app,/essentialTabs\(\{companyId:company\(\)/);
 assert.match(app,/if\(s==='messages'&&isEssential\(\)&&!essentialMessagesAllowed\(\)\)/);
 assert.match(app,/if\(state.section==='messages'\)return messagesPage\(\)/);
 assert.match(app,/if\(isEssential\(\)&&!essentialMessagesAllowed\(\)\)return card\('Messages non inclus/);
 assert.match(app,/\['chat','sendMessage','newGroup','createGroup','privateChat'\]\.includes\(a\)/);
 assert.match(app,/state.sub==='group'&&!essentialMessagesAllowed\(\)/);
 assert.match(planning,/s.company=account.company_id;s.entitlement=\{\}/);
 assert.match(planning,/s.company=null;s.entitlement=\{\}/);
 assert.match(css,/\.essential \.nav\.ess-five-tabs\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});
