import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPlatformAuthorizationDenied,platformSafeError,renderPlatformFeedback,PLATFORM_ACCESS_DENIED_MESSAGE} from '../web/live/platform-ui-guards.js';

test('both Super Admin pages share one permission-denial contract',()=>{
 for(const error of [{code:'42501'},{status:401},{status:'403'}]){
  assert.equal(isPlatformAuthorizationDenied(error),true);
  assert.equal(platformSafeError(error),PLATFORM_ACCESS_DENIED_MESSAGE);
 }
 assert.equal(isPlatformAuthorizationDenied({status:503}),false);
 assert.equal(platformSafeError({message:'SQL internal owner email'},{
  fallback:'Action impossible.'
 }),'Action impossible.');
});

test('shared status is accessible, escaped and has no empty decorative box',()=>{
 const e=x=>String(x).replaceAll('<','&lt;').replaceAll('>','&gt;');
 assert.equal(renderPlatformFeedback({},e),'');
 const html=renderPlatformFeedback({error:'<private>',busy:true},e);
 assert.match(html,/role="alert"/);
 assert.match(html,/role="status"/);
 assert.match(html,/aria-live="polite"/);
 assert.doesNotMatch(html,/<private>/);
 assert.match(html,/&lt;private&gt;/);
});

test('only explicitly approved local explanations may reach the UI',()=>{
 assert.equal(platformSafeError({message:'Date incorrecte'},{
  local:['Date incorrecte'],fallback:'Erreur'
 }),'Date incorrecte');
 assert.equal(platformSafeError({message:'debug_token'},{
  local:['Date incorrecte'],fallback:'Erreur'
 }),'Erreur');
});
